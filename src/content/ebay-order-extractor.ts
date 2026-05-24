const PANEL_STYLES = `
#syndrax-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  background: #0a0f1e;
  border: 1px solid rgba(0,207,255,0.3);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 0 30px rgba(0,207,255,0.15), 0 0 60px rgba(122,92,255,0.1);
  width: 200px;
  font-family: Inter, -apple-system, sans-serif;
}

#syndrax-panel .panel-logo {
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(90deg, #00CFFF, #7A5CFF, #FF00D4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

#syndrax-panel button {
  display: block;
  width: 100%;
  padding: 7px 10px;
  margin-bottom: 5px;
  background: rgba(0,207,255,0.08);
  border: 1px solid rgba(0,207,255,0.2);
  border-radius: 6px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  font-family: Inter, -apple-system, sans-serif;
  transition: all 0.2s;
}

#syndrax-panel button:hover {
  background: rgba(0,207,255,0.15);
  border-color: rgba(0,207,255,0.4);
}

#syndrax-panel button:last-child {
  margin-bottom: 0;
}
`;

function injectStyles() {
  if (document.getElementById('syndrax-styles')) return;
  const style = document.createElement('style');
  style.id = 'syndrax-styles';
  style.textContent = PANEL_STYLES;
  document.head.appendChild(style);
}

function createPanel() {
  if (document.getElementById('syndrax-panel')) return;
  
  const panel = document.createElement('div');
  panel.id = 'syndrax-panel';
  panel.innerHTML = `
    <div class="panel-logo">SYNDRAX SYNC</div>
    <button id="syndrax-extract">📦 Extract Order</button>
    <button id="syndrax-fulfill">🚀 Auto Fulfill</button>
    <button id="syndrax-copy">📋 Copy Address</button>
    <button id="syndrax-tracking">📍 Update Tracking</button>
  `;
  document.body.appendChild(panel);
  
  document.getElementById('syndrax-extract')?.addEventListener('click', extractOrder);
  document.getElementById('syndrax-fulfill')?.addEventListener('click', autoFulfill);
  document.getElementById('syndrax-copy')?.addEventListener('click', copyAddress);
  document.getElementById('syndrax-tracking')?.addEventListener('click', updateTracking);
}

function extractOrder() {
  const order = scrapeOrderData();
  if (order) {
    chrome.runtime.sendMessage({
      type: 'ORDER_EXTRACTED',
      payload: order,
      timestamp: Date.now()
    });
    showNotification('Order extracted successfully!');
  } else {
    showNotification('Could not extract order data', true);
  }
}

function scrapeOrderData() {
  try {
    // Extract buyer name from multiple possible selectors
    const buyerName = document.querySelector('[data-testid="buyer-name"], .buyer-info .name, [class*="buyer"] [class*="name"]')?.textContent?.trim() ||
                      document.querySelector('.ship-to-name, [class*="shipTo"] [class*="name"]')?.textContent?.trim() || '';
    
    // Extract address using pattern-based detection instead of fragile newline splitting
    let buyerAddress = '';
    let buyerCity = '';
    let buyerState = '';
    let buyerZip = '';
    let buyerCountry = 'United States';
    
    const addressEl = document.querySelector('[data-testid="shipping-address"], .shipping-address, [class*="address"]');
    const addressText = addressEl?.textContent || '';
    
    // Normalize whitespace - replace multiple spaces/newlines with single space
    const normalizedText = addressText.replace(/\s+/g, ' ').trim();
    
    // Pattern 1: Try to find "City, State ZIP" or "City State ZIP" pattern anywhere in the text
    const cityStateZipPattern = /([A-Za-z\s]+?),?\s*([A-Z]{2})\s+(\d{5}(-\d{4})?)/;
    const cityStateZipMatch = normalizedText.match(cityStateZipPattern);
    
    if (cityStateZipMatch) {
      buyerCity = cityStateZipMatch[1].trim();
      buyerState = cityStateZipMatch[2];
      buyerZip = cityStateZipMatch[3];
      
      // Everything before the city/state/zip is likely the street address
      const beforeCityStateZip = normalizedText.substring(0, cityStateZipMatch.index || 0).trim();
      
      // Try to separate name from street address if name is in the text
      if (buyerName && beforeCityStateZip.startsWith(buyerName)) {
        buyerAddress = beforeCityStateZip.substring(buyerName.length).trim();
      } else {
        // Street address is typically the part with numbers (like "123 Main St")
        const streetPattern = /\d+\s+[A-Za-z0-9\s,#.-]+/;
        const streetMatch = beforeCityStateZip.match(streetPattern);
        buyerAddress = streetMatch ? streetMatch[0].trim() : beforeCityStateZip;
      }
      
      // Everything after the ZIP is likely country
      const afterZip = normalizedText.substring((cityStateZipMatch.index || 0) + cityStateZipMatch[0].length).trim();
      if (afterZip && afterZip.length > 2) {
        // Check if it looks like a country name
        const countryPatterns = ['United States', 'USA', 'US', 'Canada', 'UK', 'Australia', 'Germany', 'France'];
        for (const country of countryPatterns) {
          if (afterZip.toLowerCase().includes(country.toLowerCase())) {
            buyerCountry = country === 'USA' || country === 'US' ? 'United States' : country;
            break;
          }
        }
        if (!countryPatterns.some(c => afterZip.toLowerCase().includes(c.toLowerCase()))) {
          buyerCountry = afterZip.split(/[,\s]/)[0] || 'United States';
        }
      }
    } else {
      // Fallback: Try splitting by newlines if pattern didn't match
      const addressParts = addressText.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);
      if (addressParts.length >= 1) buyerAddress = addressParts[0] || '';
      if (addressParts.length >= 2) {
        const fallbackMatch = addressParts[1].match(/^(.+?),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
        if (fallbackMatch) {
          buyerCity = fallbackMatch[1] || '';
          buyerState = fallbackMatch[2] || '';
          buyerZip = fallbackMatch[3] || '';
        }
      }
      if (addressParts.length >= 3) buyerCountry = addressParts[2] || 'United States';
    }
    
    // Extract item details
    const itemTitle = document.querySelector('[data-testid="item-title"], .item-title, [class*="itemTitle"]')?.textContent?.trim() ||
                      document.querySelector('h1')?.textContent?.trim() || '';
    
    const itemIdEl = document.querySelector('[data-testid="item-id"], [class*="itemId"]');
    const itemId = itemIdEl?.textContent?.replace(/\D/g, '') || 
                   window.location.href.match(/\/(\d{12,})/)?.[1] || '';
    
    const priceEl = document.querySelector('[data-testid="item-price"], .item-price, [class*="price"]');
    const priceText = priceEl?.textContent || '0';
    const salePrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    
    const quantityEl = document.querySelector('[data-testid="quantity"], .quantity');
    const quantity = parseInt(quantityEl?.textContent || '1') || 1;
    
    if (!buyerName && !itemTitle) {
      return null;
    }
    
    return {
      id: `order-${Date.now()}`,
      buyerName,
      buyerAddress,
      buyerCity,
      buyerState,
      buyerZip,
      buyerCountry,
      itemTitle,
      itemId,
      quantity,
      salePrice
    };
  } catch (error) {
    console.error('Syndrax: Error extracting order:', error);
    return null;
  }
}

async function autoFulfill() {
  const order = scrapeOrderData();
  if (!order) {
    showNotification('Extract order first', true);
    return;
  }
  
  await chrome.storage.local.set({ pendingFulfillment: order });
  
  const settings = await chrome.storage.local.get('syndrax_settings');
  const supplier = settings.syndrax_settings?.defaultSupplier || 'amazon';
  
  const searchUrl = supplier === 'amazon' 
    ? `https://www.amazon.com/s?k=${encodeURIComponent(order.itemTitle)}`
    : `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(order.itemTitle)}`;
  
  window.open(searchUrl, '_blank');
  showNotification(`Opening ${supplier} to fulfill order`);
}

function copyAddress() {
  const order = scrapeOrderData();
  if (!order) {
    showNotification('Could not find address', true);
    return;
  }
  
  const address = `${order.buyerName}\n${order.buyerAddress}\n${order.buyerCity}, ${order.buyerState} ${order.buyerZip}\n${order.buyerCountry}`;
  navigator.clipboard.writeText(address);
  showNotification('Address copied!');
}

function updateTracking() {
  const trackingInput = document.querySelector<HTMLInputElement>('[data-testid="tracking-input"], input[name*="tracking"], [class*="tracking"] input');
  if (trackingInput) {
    trackingInput.focus();
    trackingInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showNotification('Enter tracking number');
  } else {
    showNotification('Tracking input not found', true);
  }
}

function showNotification(message: string, isError = false) {
  const existing = document.getElementById('syndrax-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'syndrax-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 250px;
    right: 24px;
    z-index: 9999999;
    background: ${isError ? '#ef4444' : '#22c55e'};
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: Inter, -apple-system, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_ORDER') {
    const order = scrapeOrderData();
    sendResponse({ success: !!order, order });
  } else if (message.type === 'PAGE_READY') {
    createPanel();
    sendResponse({ success: true });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    createPanel();
  });
} else {
  injectStyles();
  createPanel();
}
