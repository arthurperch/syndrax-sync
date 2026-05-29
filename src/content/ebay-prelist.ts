// Content script for eBay prelist page — auto-submits ASIN to create a draft
// Runs on: *://*.ebay.com/sl/prelist/home*
// Flow: pendingListing.asin → Product ID tab (ASIN) → submit → eBay creates draft

interface PendingListing {
  asin: string;
  title: string;
  price: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findByText(selector: string, text: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.textContent?.trim() === text) return el;
  }
  return null;
}

async function waitForText(
  selector: string,
  text: string,
  timeout = 12000
): Promise<Element | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = findByText(selector, text);
    if (el) return el;
    await sleep(400);
  }
  return null;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  // React intercepts value via native setter, not just .value assignment
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function showStatus(msg: string, color = '#00CFFF'): HTMLDivElement {
  const existing = document.getElementById('syndrax-prelist-status');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'syndrax-prelist-status';
  el.style.cssText = `
    position: fixed; top: 10px; right: 10px;
    background: #0a0f1e; border: 1px solid ${color};
    border-radius: 8px; padding: 10px 14px; z-index: 999999;
    color: ${color}; font-family: system-ui, sans-serif; font-size: 12px;
    font-weight: 600; box-shadow: 0 4px 20px rgba(0,207,255,0.25);
    max-width: 300px; line-height: 1.5;
  `;
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  document.body.appendChild(el);
  return el as HTMLDivElement;
}

async function tryProductIdTab(asin: string): Promise<boolean> {
  const tab = await waitForText('button, a, [role="tab"]', 'Product ID', 8000);
  if (!tab) {
    console.log('[Syndrax Prelist] Product ID tab not found');
    return false;
  }

  (tab as HTMLElement).click();
  await sleep(800);

  // Select "Amazon" from type dropdown if present
  const selects = document.querySelectorAll<HTMLSelectElement>('select');
  for (const sel of selects) {
    const amazonOpt = Array.from(sel.options).find(
      o => o.text.toLowerCase().includes('amazon') || o.value.toLowerCase().includes('amazon')
    );
    if (amazonOpt) {
      sel.value = amazonOpt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
      break;
    }
  }

  // Find the ASIN input by placeholder
  let asinInput: HTMLInputElement | null = null;
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
    const ph = (input.placeholder || '').toLowerCase();
    if (ph.includes('asin') || ph.includes('isbn') || ph.includes('gtin') || ph.includes('product id')) {
      asinInput = input;
      break;
    }
  }

  if (!asinInput) {
    console.log('[Syndrax Prelist] ASIN input not found');
    return false;
  }

  asinInput.focus();
  setNativeInputValue(asinInput, asin);
  console.log(`[Syndrax Prelist] Filled ASIN: ${asin}`);
  await sleep(400);

  return clickSubmit();
}

async function tryWebUrlTab(asin: string): Promise<boolean> {
  const tab = await waitForText('button, a, [role="tab"]', 'Web URL', 5000);
  if (!tab) {
    console.log('[Syndrax Prelist] Web URL tab not found');
    return false;
  }

  (tab as HTMLElement).click();
  await sleep(800);

  // Find URL input by placeholder
  let urlInput: HTMLInputElement | null = null;
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
    const ph = (input.placeholder || '').toLowerCase();
    if (ph.includes('amazon') || ph.includes('url') || ph.includes('walmart')) {
      urlInput = input;
      break;
    }
  }

  if (!urlInput) {
    console.log('[Syndrax Prelist] URL input not found');
    return false;
  }

  const amazonUrl = `https://www.amazon.com/dp/${asin}`;
  urlInput.focus();
  setNativeInputValue(urlInput, amazonUrl);
  console.log(`[Syndrax Prelist] Filled URL: ${amazonUrl}`);
  await sleep(400);

  return clickSubmit();
}

function clickSubmit(): boolean {
  // Try specific selectors first
  const candidates = [
    document.querySelector<HTMLButtonElement>('button[aria-label="Search"]'),
    document.querySelector<HTMLButtonElement>('.keywords-search-im__field-button'),
    document.querySelector<HTMLButtonElement>('button.btn--primary[type="button"]'),
  ];

  for (const btn of candidates) {
    if (btn && !btn.disabled) {
      btn.click();
      console.log('[Syndrax Prelist] Clicked submit');
      return true;
    }
  }

  // Text-content fallback
  for (const btn of document.querySelectorAll<HTMLButtonElement>('button')) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if ((text === 'search' || text === 'create draft') && !btn.disabled) {
      btn.click();
      console.log('[Syndrax Prelist] Clicked submit (text match)');
      return true;
    }
  }

  console.log('[Syndrax Prelist] Submit button not found');
  return false;
}

async function init(): Promise<void> {
  const { pendingListing } = await chrome.storage.local.get('pendingListing');

  if (!pendingListing?.asin) {
    console.log('[Syndrax Prelist] No pending ASIN — skipping');
    return;
  }

  const asin: string = pendingListing.asin;
  console.log(`[Syndrax Prelist] Starting auto-fill for ASIN: ${asin}`);

  // Wait for React to hydrate
  await sleep(2500);

  const statusEl = showStatus(`Importing ASIN: ${asin}…`);

  // Try Product ID tab first (direct ASIN — cleanest)
  let ok = await tryProductIdTab(asin);

  // Fallback: Web URL tab
  if (!ok) {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>Trying Web URL…`;
    ok = await tryWebUrlTab(asin);
  }

  if (ok) {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>✓ Submitted — eBay is creating draft…`;
    statusEl.style.borderColor = '#4ade80';
    statusEl.style.color = '#4ade80';
    // Auto-hide after 6s
    setTimeout(() => statusEl.remove(), 6000);
  } else {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>⚠ Auto-fill failed<br>Enter ASIN manually: <b>${asin}</b>`;
    statusEl.style.borderColor = '#f59e0b';
    statusEl.style.color = '#f59e0b';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
