// Vue reactivity helper - triggers Vue's reactive system
function setVueInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

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
  name: 'input.address-name, input[name*="name"], input[placeholder*="name"]',
  street: 'input.address-detail, input[name*="address"], input[placeholder*="address"], textarea[name*="address"]',
  city: 'input.address-city, input[name*="city"], input[placeholder*="city"]',
  state: 'input[name*="state"], select[name*="state"], input[placeholder*="state"]',
  zip: 'input.address-zip, input[name*="zip"], input[placeholder*="zip"], input[name*="postal"]',
  phone: 'input[name*="phone"], input[type="tel"], input[placeholder*="phone"]',
  country: 'select[name*="country"], input[name*="country"]'
};

async function checkForPendingFulfillment() {
  const data = await chrome.storage.local.get('pendingFulfillment');
  if (data.pendingFulfillment) {
    return data.pendingFulfillment as FulfillmentData;
  }
  return null;
}

function fillInput(selector: string, value: string) {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector);
  for (const input of inputs) {
    if (input && value) {
      input.focus();
      setVueInputValue(input, value);
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
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
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (fillInput(SELECTORS.name, data.buyerName)) filled++;
  if (fillInput(SELECTORS.street, data.buyerAddress)) filled++;
  if (fillInput(SELECTORS.city, data.buyerCity)) filled++;
  if (fillInput(SELECTORS.state, data.buyerState) || selectOption(SELECTORS.state, data.buyerState)) filled++;
  if (fillInput(SELECTORS.zip, data.buyerZip)) filled++;
  
  return filled;
}

function checkLoginRequired(): boolean {
  const loginIndicators = [
    'input[name="loginId"]',
    '.login-container',
    '[class*="login-form"]'
  ];
  
  return loginIndicators.some(sel => document.querySelector(sel) !== null);
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
  
  if (checkLoginRequired()) {
    showStatus('Please log in to AliExpress first', true);
    chrome.runtime.sendMessage({
      type: 'FULFILLMENT_STATUS',
      payload: {
        orderId: pending.orderId,
        success: false,
        message: 'AliExpress login required'
      },
      timestamp: Date.now()
    });
    return;
  }
  
  if (window.location.href.includes('/order/') || window.location.href.includes('/checkout/')) {
    const filled = await fillShippingForm(pending);
    if (filled > 0) {
      showStatus(`Filled ${filled} address fields`);
      chrome.runtime.sendMessage({
        type: 'FULFILLMENT_STATUS',
        payload: {
          orderId: pending.orderId,
          success: true,
          message: `Filled ${filled} AliExpress address fields`
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
