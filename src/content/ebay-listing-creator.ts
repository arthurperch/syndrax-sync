interface ListingData {
  title: string;
  description: string;
  price: number;
  keywords?: string[];
}

const SELECTORS = {
  title: 'input[name="title"], #listing-title, [data-testid="listing-title"]',
  description: 'textarea[name="description"], #listing-description, [data-testid="listing-description"], .ql-editor',
  price: 'input[name="price"], #listing-price, [data-testid="listing-price"]',
  condition: 'select[name="condition"], #listing-condition',
  quantity: 'input[name="quantity"], #listing-quantity',
  submitBtn: 'button[type="submit"], #listing-submit, [data-testid="submit-listing"]'
};

async function checkForPendingListing() {
  const data = await chrome.storage.local.get('pendingListing');
  if (data.pendingListing) {
    return data.pendingListing as ListingData;
  }
  return null;
}

function fillInput(selector: string, value: string | number) {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (input) {
    input.focus();
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

function fillRichTextEditor(selector: string, html: string) {
  const editor = document.querySelector(selector);
  if (editor) {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

async function fillListingForm(data: ListingData) {
  let filled = 0;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (fillInput(SELECTORS.title, data.title)) filled++;
  
  const descriptionFilled = fillInput(SELECTORS.description, data.description) ||
                            fillRichTextEditor('.ql-editor', data.description);
  if (descriptionFilled) filled++;
  
  if (fillInput(SELECTORS.price, data.price.toFixed(2))) filled++;
  
  if (fillInput(SELECTORS.quantity, '1')) filled++;
  
  return filled;
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
  const pending = await checkForPendingListing();
  if (!pending) return;
  
  showStatus('Auto-filling listing data...');
  
  const filled = await fillListingForm(pending);
  
  if (filled > 0) {
    showStatus(`Filled ${filled} listing fields`);
    
    await chrome.storage.local.remove('pendingListing');
    
    chrome.runtime.sendMessage({
      type: 'LISTING_CREATED',
      payload: {
        success: true,
        filled,
        title: pending.title
      },
      timestamp: Date.now()
    });
  } else {
    showStatus('Could not fill listing fields', true);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_LISTING') {
    const data = message.payload as ListingData;
    fillListingForm(data).then(filled => {
      sendResponse({ success: filled > 0, filled });
    });
    return true;
  }
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 2000));
} else {
  setTimeout(init, 2000);
}
