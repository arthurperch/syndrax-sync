// Session J — Enhanced ebay-listing-creator.ts
// Fills title, price, description, condition, quantity
// Logs images for manual upload (DOM upload unreliable)

interface ListingData {
  title: string;
  description: string;
  price: number;
  keywords?: string[];
  condition?: string;
  quantity?: number;
  categoryId?: string;
  images?: string[];
}

const SELECTORS = {
  title: 'input[name="title"], #listing-title, [data-testid="listing-title"]',
  description: 'textarea[name="description"], #listing-description, [data-testid="listing-description"], .ql-editor',
  price: 'input[name="price"], #listing-price, [data-testid="listing-price"]',
  condition: 'select[name="condition"], #listing-condition, [data-testid="listing-condition"]',
  quantity: 'input[name="quantity"], #listing-quantity, [data-testid="listing-quantity"]',
  submitBtn: 'button[type="submit"], #listing-submit, [data-testid="submit-listing"]'
};

async function checkForPendingListing(): Promise<ListingData | null> {
  const data = await chrome.storage.local.get('pendingListing');
  if (data.pendingListing) {
    return data.pendingListing as ListingData;
  }
  return null;
}

function fillInput(selector: string, value: string | number): boolean {
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

function fillRichTextEditor(selector: string, html: string): boolean {
  const editor = document.querySelector(selector);
  if (editor) {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

/**
 * Fill condition dropdown — maps condition string to eBay option
 * 'New' → option value '1000' or text containing 'New'
 */
function fillCondition(conditionStr: string): boolean {
  const select = document.querySelector<HTMLSelectElement>(SELECTORS.condition);
  if (!select) return false;

  const condLower = conditionStr.toLowerCase();

  // Try to find matching option by value or text
  const options = Array.from(select.options);

  // Priority: exact value match (eBay uses '1000' for New)
  const valueMap: Record<string, string[]> = {
    'new': ['1000', '1'],
    'used': ['3000', '2', '4'],
    'refurbished': ['2000', '2500'],
    'open box': ['1500'],
    'for parts': ['7000'],
  };

  const targetValues = Object.entries(valueMap).find(([key]) => condLower.includes(key))?.[1] ?? [];

  // Try value match first
  for (const val of targetValues) {
    const opt = options.find(o => o.value === val);
    if (opt) {
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }

  // Fall back to text match
  const textOpt = options.find(o => o.text.toLowerCase().includes(condLower.split(' ')[0]));
  if (textOpt) {
    select.value = textOpt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Last resort: select first option that isn't a placeholder
  const firstReal = options.find(o => o.value && o.value !== '' && o.value !== '0');
  if (firstReal) {
    select.value = firstReal.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(`[Syndrax] Condition fallback: selected "${firstReal.text}" for "${conditionStr}"`);
    return true;
  }

  return false;
}

async function fillListingForm(data: ListingData): Promise<{ filled: number; summary: string[] }> {
  const summary: string[] = [];
  let filled = 0;

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Title
  if (fillInput(SELECTORS.title, data.title)) {
    filled++;
    summary.push('✓ Title filled');
  } else {
    summary.push('✗ Title not found');
  }

  // Description
  const descriptionFilled = fillInput(SELECTORS.description, data.description) ||
                            fillRichTextEditor('.ql-editor', data.description);
  if (descriptionFilled) {
    filled++;
    summary.push('✓ Description filled');
  } else {
    summary.push('✗ Description not found');
  }

  // Price
  if (fillInput(SELECTORS.price, data.price.toFixed(2))) {
    filled++;
    summary.push(`✓ Price: $${data.price.toFixed(2)}`);
  } else {
    summary.push('✗ Price not found');
  }

  // Condition
  const conditionStr = data.condition ?? 'New';
  if (fillCondition(conditionStr)) {
    filled++;
    summary.push(`✓ Condition: ${conditionStr}`);
  } else {
    summary.push(`⚠ Condition not filled (set manually)`);
  }

  // Quantity
  const qty = data.quantity ?? 1;
  if (fillInput(SELECTORS.quantity, String(qty))) {
    filled++;
    summary.push(`✓ Quantity: ${qty}`);
  } else {
    summary.push('⚠ Quantity not found');
  }

  // Images — log for manual upload (DOM upload unreliable)
  if (data.images && data.images.length > 0) {
    console.log('[Syndrax] Images to upload manually:', data.images);
    summary.push(`⚠ Review images (${data.images.length} to upload manually)`);
  } else {
    summary.push('⚠ Review images');
  }

  return { filled, summary };
}

function showStatus(message: string, isError = false): void {
  const existing = document.getElementById('syndrax-status');
  if (existing) existing.remove();

  const status = document.createElement('div');
  status.id = 'syndrax-status';
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${isError ? '#ef4444' : '#1e293b'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    border: 1px solid ${isError ? '#f87171' : '#22d3ee'};
    line-height: 1.6;
    max-width: 340px;
    font-family: monospace;
  `;
  status.innerHTML = `<div style="font-weight:700;margin-bottom:4px;color:#22d3ee">Syndrax Sync</div>${message}`;
  document.body.appendChild(status);

  setTimeout(() => status.remove(), 7000);
}

async function init(): Promise<void> {
  const pending = await checkForPendingListing();
  if (!pending) return;

  showStatus('Auto-filling listing data...');

  const { filled, summary } = await fillListingForm(pending);

  if (filled > 0) {
    // Enhanced status overlay with per-field summary
    const summaryHtml = summary.map(line => {
      const color = line.startsWith('✓') ? '#4ade80' : line.startsWith('✗') ? '#f87171' : '#fbbf24';
      return `<div style="color:${color}">${line}</div>`;
    }).join('');
    showStatus(summaryHtml);

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
    showStatus('Could not fill listing fields — check page loaded correctly', true);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_LISTING') {
    const data = message.payload as ListingData | undefined;
    if (!data) { sendResponse({ success: false, filled: 0 }); return true; }
    fillListingForm(data).then(({ filled }) => {
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
