// Amazon Price Checker - Injected into Amazon product pages silently
// Scrapes current price and stock status
// Returns data to background service

interface AmazonPriceData {
  asin: string;
  currentPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  priceUpdatedAt: string;
  // Fingerprint fields
  title: string;
  brand: string;
  imageUrl: string;
  imageCount: number;
  category: string;
  dimensions: string;
  weight: string;
  reviewCount: number;
  starRating: number;
  bullets: string[];
  finalAsin: string;
}

// Selectors to try in order for price:
const PRICE_SELECTORS = [
  '.a-price-whole',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '.a-price .a-offscreen',
  '#corePrice_feature_div .a-price-whole',
  '[data-a-color="price"] .a-offscreen',
  '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
  '.a-price[data-a-color="base"] .a-offscreen'
];

// Selectors for stock status:
const STOCK_SELECTORS = [
  '#availability span',
  '#outOfStock',
  '.a-color-success',
  '#availability',
  '#deliveryMessageMirId',
  '[data-csa-c-availability]'
];

// Fingerprint scraping helpers
const getTitle = (): string => {
  const el = document.querySelector('#productTitle');
  return el?.textContent?.trim() || '';
};

const getBrand = (): string => {
  for (const sel of ['#bylineInfo', '#brand']) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim())
      return el.textContent.trim()
        .replace('Brand: ','').replace('Visit the ','').replace(' Store','');
  }
  return '';
};

const getBullets = (): string[] => {
  const items = document.querySelectorAll('#feature-bullets li span.a-list-item');
  return Array.from(items).map(el => el.textContent?.trim() || '').filter(Boolean);
};

const getCategory = (): string => {
  const items = document.querySelectorAll('#wayfinding-breadcrumbs_feature_div a');
  return Array.from(items).map(a => a.textContent?.trim()).filter(Boolean).join(' > ');
};

const getDimensions = (): string => {
  const rows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #prodDetails tr');
  for (const row of rows) {
    const label = row.querySelector('th')?.textContent?.toLowerCase() || '';
    if (label.includes('dimension') || label.includes('size')) {
      return row.querySelector('td')?.textContent?.trim() || '';
    }
  }
  return '';
};

const getWeight = (): string => {
  const rows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #prodDetails tr');
  for (const row of rows) {
    const label = row.querySelector('th')?.textContent?.toLowerCase() || '';
    if (label.includes('weight')) {
      return row.querySelector('td')?.textContent?.trim() || '';
    }
  }
  return '';
};

const getImageUrl = (): string => {
  const img = document.querySelector('#landingImage') as HTMLImageElement;
  return img?.src || '';
};

const getImageCount = (): number =>
  document.querySelectorAll('#altImages img').length;

const getFinalAsin = (): string => {
  const m = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : '';
};

const getReviewCount = (): number => {
  const el = document.querySelector('#acrCustomerReviewText');
  const text = el?.textContent || '';
  const match = text.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, '')) : 0;
};

const getStarRating = (): number => {
  const el = document.querySelector('#acrPopover');
  const title = el?.getAttribute('title') || '';
  const match = title.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
};

function scrapePriceData(): AmazonPriceData {
  let price = 0;
  let inStock = true;
  let stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';

  // Try each price selector
  for (const selector of PRICE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const cleaned = el.textContent.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      if (parsed > 0) {
        price = parsed;
        break;
      }
    }
  }

  // Check stock status
  for (const selector of STOCK_SELECTORS) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const text = el.textContent.toLowerCase();
      if (text.includes('out of stock') || text.includes('unavailable') || text.includes('currently unavailable')) {
        inStock = false;
        stockLevel = 'out_of_stock';
        break;
      } else if (text.includes('only') && text.includes('left')) {
        stockLevel = 'low_stock';
        break;
      } else if (text.includes('in stock') || text.includes('available')) {
        inStock = true;
        stockLevel = 'in_stock';
        break;
      }
    }
  }

  // Extract ASIN from URL
  const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
  const asin = asinMatch?.[1] || '';

  return {
    asin,
    currentPrice: price,
    inStock,
    stockLevel,
    priceUpdatedAt: new Date().toISOString(),
    // Fingerprint fields
    title: getTitle(),
    brand: getBrand(),
    imageUrl: getImageUrl(),
    imageCount: getImageCount(),
    category: getCategory(),
    dimensions: getDimensions(),
    weight: getWeight(),
    reviewCount: getReviewCount(),
    starRating: getStarRating(),
    bullets: getBullets(),
    finalAsin: getFinalAsin()
  };
}

// Listen for price check requests
chrome.runtime.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'CHECK_PRICE') {
    const data = scrapePriceData();
    sendResponse({ success: true, data });
    return true;
  }
  return false;
});

// Auto-send price data when page loads (for silent tab checks)
function autoReport() {
  const data = scrapePriceData();
  
  // Only report if we got valid data
  if (data.asin && data.currentPrice > 0) {
    chrome.runtime.sendMessage({
      type: 'PRICE_CHECK_RESULT',
      payload: data,
      timestamp: Date.now()
    });
  }
}

// Run after page is fully loaded
if (document.readyState === 'complete') {
  setTimeout(autoReport, 1500);
} else {
  window.addEventListener('load', () => setTimeout(autoReport, 1500));
}

// ─────────────────────────────────────────────────────
// VARIANT SYSTEM — Added to existing amazon scraper
// ─────────────────────────────────────────────────────

interface VariantOption {
  asin: string;
  label: string;        // "48 x 72 - Woodgrain" or "Large - Blue"
  dimensions: string[]; // ["48 x 72", "Woodgrain"] split attributes
  available: boolean;   // false if data-initiallyUnavailable="true"
  selected: boolean;    // Currently selected variant
  url: string;          // Full URL to this variant
}

interface VariantDetectionResult {
  isVariantProduct: boolean;
  currentChildAsin: string;    // ASIN currently shown on page
  isParentAsin: boolean;       // True if we landed on parent (no price/stock)
  selectedVariantLabel: string; // "48 x 72 - Woodgrain"
  allVariants: VariantOption[];
  variantDimensions: string[]; // ["size", "color"] — what varies
  stockOfCurrentVariant: boolean;
  matchedVariantAsin: string;  // Best match for our eBay listing
}

// Detect if page is a variant product and extract all options
function detectVariants(ebayTitle: string, ebayPrice: number): VariantDetectionResult {
  const result: VariantDetectionResult = {
    isVariantProduct: false,
    currentChildAsin: '',
    isParentAsin: false,
    selectedVariantLabel: '',
    allVariants: [],
    variantDimensions: [],
    stockOfCurrentVariant: true,
    matchedVariantAsin: ''
  };

  // Get current ASIN from URL
  const urlAsinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
  result.currentChildAsin = urlAsinMatch ? urlAsinMatch[1] : '';

  // Detect if parent page — parent has no price and no buy box
  const hasBuyBox = !!document.querySelector('#add-to-cart-button, #buy-now-button, #buybox');
  const hasPrice = !!document.querySelector('.a-price-whole, #priceblock_ourprice, .a-price .a-offscreen');
  result.isParentAsin = !hasBuyBox && !hasPrice;

  // Check for variant selectors on page
  const variantRows = document.querySelectorAll('div[id^="inline-twister-row"]');
  result.isVariantProduct = variantRows.length > 0 || 
    !!document.querySelector('#variation_color_name, #variation_size_name, #variation_style_name, .twister-plus-mobile-desktop-bar');

  if (!result.isVariantProduct) return result;

  // Extract dimension names (size, color, style)
  variantRows.forEach(row => {
    const id = row.getAttribute('id') || '';
    const dimName = id
      .replace('inline-twister-row-', '')
      .replace('_name', '')
      .toLowerCase();
    if (dimName) result.variantDimensions.push(dimName);
  });

  // Extract selected variant label
  const selectedParts: string[] = [];

  // Method 1: inline-twister selected item
  document.querySelectorAll('.selection, .a-button-selected .a-button-text, [data-action="a-accordion"] .a-size-base.a-color-base').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 50 && !selectedParts.includes(text)) {
      selectedParts.push(text);
    }
  });

  // Method 2: dropdown selected values
  ['#variation_size_name', '#variation_color_name', '#variation_style_name'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      const selected = el.querySelector('.selection, option:checked');
      const text = selected?.textContent?.trim();
      if (text && !selectedParts.includes(text)) selectedParts.push(text);
    }
  });

  result.selectedVariantLabel = selectedParts.join(' - ');

  // Extract ALL variant options with their ASINs and availability
  const allVariantItems = document.querySelectorAll(
    'li[data-asin], ' +
    '.swatchSelect li[data-dp-url], ' +
    '.twister-plus-mobile-desktop-bar li[data-asin]'
  );

  allVariantItems.forEach(item => {
    const asin = item.getAttribute('data-asin') || '';
    if (!asin || asin.length !== 10) return;

    const unavailable = item.getAttribute('data-initiallyUnavailable') === 'true' ||
      item.classList.contains('a-disabled') ||
      item.querySelector('.a-icon-unavailable') !== null;

    const isSelected = item.classList.contains('a-button-selected') ||
      item.getAttribute('aria-checked') === 'true' ||
      item.querySelector('.a-icon-radio-active') !== null;

    // Get label from item text content
    const labelEl = item.querySelector('.a-button-text, span[id*="name"], .swatch-title-text');
    const label = labelEl?.textContent?.trim() || item.textContent?.trim() || '';

    if (label) {
      result.allVariants.push({
        asin,
        label,
        dimensions: label.split(/[\s\-\/,]+/).filter(d => d.length > 0),
        available: !unavailable,
        selected: isSelected,
        url: `https://www.amazon.com/dp/${asin}?th=1&psc=1`
      });
    }
  });

  // Stock of currently selected variant specifically
  const availEl = document.querySelector('#availability span');
  if (availEl) {
    const stockText = availEl.textContent?.toLowerCase() || '';
    result.stockOfCurrentVariant = !['out of stock', 'unavailable', 'currently unavailable'].some(p => stockText.includes(p));
  } else if (!hasBuyBox) {
    result.stockOfCurrentVariant = false;
  }

  // Find best matching variant for our eBay listing
  result.matchedVariantAsin = findBestVariantMatch(
    ebayTitle,
    ebayPrice,
    result.allVariants,
    result.currentChildAsin
  );

  return result;
}

// Find which variant best matches our eBay listing
// Uses title keywords, dimensions, and price proximity
function findBestVariantMatch(
  ebayTitle: string,
  _ebayPrice: number,
  variants: VariantOption[],
  currentAsin: string
): string {

  if (variants.length === 0) return currentAsin;

  // Extract size/dimension keywords from eBay title
  // Look for patterns like: 48x72, 48"x72", 48 x 72, Large, XL, Blue, Red
  const sizePattern = /(\d+["']?\s*[xX×]\s*\d+["']?|\d+\s*(?:inch|in|ft|feet|cm|mm)?|\b(?:small|medium|large|xl|xxl|xs)\b)/gi;
  const colorPattern = /\b(black|white|grey|gray|blue|red|green|brown|tan|beige|woodgrain|wood|natural|ivory|cream|navy|charcoal)\b/gi;

  const ebaySizes = (ebayTitle.match(sizePattern) || []).map(s => s.toLowerCase().replace(/\s+/g, '').replace(/['"]/g, ''));
  const ebayColors = (ebayTitle.match(colorPattern) || []).map(c => c.toLowerCase());

  let bestMatch = currentAsin;
  let bestScore = -1;

  variants.forEach(variant => {
    if (!variant.available) return; // Skip unavailable variants
    
    let score = 0;
    const variantLower = variant.label.toLowerCase();
    const variantDims = variant.dimensions.map(d => d.toLowerCase().replace(/\s+/g, '').replace(/['"]/g, ''));

    // Check size match
    ebaySizes.forEach(ebaySize => {
      if (variantDims.some(d => d.includes(ebaySize) || ebaySize.includes(d))) {
        score += 50; // Size match is very high value
      }
      if (variantLower.includes(ebaySize)) {
        score += 40;
      }
    });

    // Check color match
    ebayColors.forEach(color => {
      if (variantLower.includes(color)) {
        score += 30;
      }
    });

    // Bonus: currently selected variant
    if (variant.selected) score += 10;

    // Bonus: exact ASIN match if we stored child before
    if (variant.asin === currentAsin) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant.asin;
    }
  });

  return bestMatch;
}

// Navigate to correct child ASIN if we are on wrong variant or parent
async function navigateToCorrectVariant(
  targetAsin: string,
  currentAsin: string
): Promise<boolean> {
  if (targetAsin === currentAsin) return true; // Already on right variant
  
  // Find the variant element with our target ASIN and click it
  const targetItem = document.querySelector(`li[data-asin="${targetAsin}"]`) as HTMLElement;
  if (targetItem) {
    targetItem.click();
    await new Promise(r => setTimeout(r, 2000)); // Wait for page update
    return true;
  }
  
  // If click didn't work — signal background to open correct URL
  return false;
}

// Export for use in scraper
(window as any).__syndraxDetectVariants = detectVariants;
(window as any).__syndraxNavigateToVariant = navigateToCorrectVariant;
