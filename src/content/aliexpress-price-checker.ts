// AliExpress Price Checker - Injected into AliExpress product pages silently
// Scrapes current price and stock status

interface AliExpressPriceData {
  productId: string;
  currentPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  priceUpdatedAt: string;
}

// AliExpress price selectors
const ALI_PRICE_SELECTORS = [
  '.product-price-value',
  '[class*="price--current"]',
  '.uniform-banner-box-price',
  '[data-price]',
  '.product-price-current',
  '.snow-price_SnowPrice__mainS__1gfp1p'
];

// AliExpress stock selectors
const ALI_STOCK_SELECTORS = [
  '[class*="quantity"]',
  '.product-quantity-tip',
  '.sku-property-item'
];

function scrapePriceData(): AliExpressPriceData {
  let price = 0;
  let inStock = true;
  let stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';

  // Try each price selector
  for (const selector of ALI_PRICE_SELECTORS) {
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
  for (const selector of ALI_STOCK_SELECTORS) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const text = el.textContent.toLowerCase();
      if (text.includes('out of stock') || text.includes('sold out')) {
        inStock = false;
        stockLevel = 'out_of_stock';
        break;
      } else if (text.includes('low stock') || text.match(/only \d+ left/)) {
        stockLevel = 'low_stock';
        break;
      }
    }
  }

  // Check for sold out button state
  const soldOutBtn = document.querySelector('[class*="soldout"], [class*="sold-out"]');
  if (soldOutBtn) {
    inStock = false;
    stockLevel = 'out_of_stock';
  }

  // Extract product ID from URL
  const productIdMatch = window.location.pathname.match(/\/item\/(\d+)\.html/);
  const productId = productIdMatch?.[1] || '';

  return {
    productId,
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

// Auto-send price data when page loads
function autoReport() {
  const data = scrapePriceData();
  
  if (data.productId && data.currentPrice > 0) {
    chrome.runtime.sendMessage({
      type: 'PRICE_CHECK_RESULT',
      payload: data,
      timestamp: Date.now()
    });
  }
}

if (document.readyState === 'complete') {
  setTimeout(autoReport, 2000);
} else {
  window.addEventListener('load', () => setTimeout(autoReport, 2000));
}
