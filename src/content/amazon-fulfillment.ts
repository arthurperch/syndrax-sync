interface FulfillmentData {
  orderId: string;
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerZip: string;
  buyerCountry: string;
}

const SELECTORS = {
  name: 'input[name="address-ui-widgets-enterAddressFullName"], #enterAddressFullName',
  street: 'input[name="address-ui-widgets-enterAddressLine1"], #enterAddressLine1',
  street2: 'input[name="address-ui-widgets-enterAddressLine2"], #enterAddressLine2',
  city: 'input[name="address-ui-widgets-enterAddressCity"], #enterAddressCity',
  state: 'select[name="address-ui-widgets-enterAddressStateOrRegion"], #enterAddressStateOrRegion',
  zip: 'input[name="address-ui-widgets-enterAddressPostalCode"], #enterAddressPostalCode',
  phone: 'input[name="address-ui-widgets-enterAddressPhoneNumber"], #enterAddressPhoneNumber',
  addToCart: '#add-to-cart-button',
  buyNow: '#buy-now-button',
  placeOrder: '[name="placeYourOrder1"], #submitOrderButtonId'
};

async function checkForPendingFulfillment() {
  const data = await chrome.storage.local.get('pendingFulfillment');
  if (data.pendingFulfillment) {
    return data.pendingFulfillment as FulfillmentData;
  }
  return null;
}

function fillInput(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (input && value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function selectOption(selector: string, value: string) {
  const select = document.querySelector<HTMLSelectElement>(selector);
  if (select && value) {
    const options = Array.from(select.options);
    const option = options.find(o => 
      o.value.toLowerCase().includes(value.toLowerCase()) ||
      o.text.toLowerCase().includes(value.toLowerCase())
    );
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

async function fillShippingForm(data: FulfillmentData) {
  let filled = 0;
  
  if (fillInput(SELECTORS.name, data.buyerName)) filled++;
  if (fillInput(SELECTORS.street, data.buyerAddress)) filled++;
  if (fillInput(SELECTORS.city, data.buyerCity)) filled++;
  if (selectOption(SELECTORS.state, data.buyerState)) filled++;
  if (fillInput(SELECTORS.zip, data.buyerZip)) filled++;
  
  return filled;
}

function checkForCaptcha(): boolean {
  const captchaIndicators = [
    '#captchacharacters',
    '.a-box-inner img[src*="captcha"]',
    '[data-a-target="captcha-challenge"]'
  ];
  
  return captchaIndicators.some(sel => document.querySelector(sel) !== null);
}

function showStatus(message: string, isError = false) {
  const existing = document.getElementById('syndrax-status');
  if (existing) existing.remove();
  
  const status = document.createElement('div');
  status.id = 'syndrax-status';
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${isError ? '#ef4444' : '#22c55e'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  status.textContent = `Syndrax: ${message}`;
  document.body.appendChild(status);
  
  setTimeout(() => status.remove(), 5000);
}

async function init() {
  const pending = await checkForPendingFulfillment();
  if (!pending) return;
  
  if (checkForCaptcha()) {
    showStatus('CAPTCHA detected - please solve it manually', true);
    chrome.runtime.sendMessage({
      type: 'FULFILLMENT_STATUS',
      payload: {
        orderId: pending.orderId,
        success: false,
        message: 'CAPTCHA detected on Amazon'
      },
      timestamp: Date.now()
    });
    return;
  }
  
  if (window.location.href.includes('/gp/buy/')) {
    const filled = await fillShippingForm(pending);
    if (filled > 0) {
      showStatus(`Filled ${filled} address fields`);
      chrome.runtime.sendMessage({
        type: 'FULFILLMENT_STATUS',
        payload: {
          orderId: pending.orderId,
          success: true,
          message: `Filled ${filled} Amazon address fields`
        },
        timestamp: Date.now()
      });
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_ADDRESS') {
    const data = message.payload as FulfillmentData;
    fillShippingForm(data).then(filled => {
      sendResponse({ success: filled > 0, filled });
    });
    return true;
  }
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
