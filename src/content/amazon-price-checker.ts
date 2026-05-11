// Amazon Price Checker - Injected into Amazon product pages silently
// Scrapes current price and stock status
// Returns data to background service

interface AmazonPriceData {
  asin: string;
  currentPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  priceUpdatedAt: string;
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
    priceUpdatedAt: new Date().toISOString()
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
