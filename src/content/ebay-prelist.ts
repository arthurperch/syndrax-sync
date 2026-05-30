// Content script for eBay prelist page — drives the full search → match → condition flow
// Runs on: *://*.ebay.com/sl/prelist/home*
//
// Flow:
//   1. URL arrives with ?title= pre-filled by listing-handler.ts
//   2. Click Search (keyword already in box from URL param; fill it if missing)
//   3. "Find a match" page → always click "Continue without match"
//   4. Condition dialog → select New (1000) → click "Continue to listing"
//   5. eBay redirects to /sl/sell?... → ebay-listing-creator.ts takes over

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll<T>(
  fn: () => T | null,
  timeout = 15000,
  interval = 400
): Promise<T | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }
  return null;
}

function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function showStatus(msg: string, color = '#00CFFF'): HTMLDivElement {
  document.getElementById('syndrax-prelist-status')?.remove();
  const el = document.createElement('div');
  el.id = 'syndrax-prelist-status';
  el.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 999999;
    background: #0a0f1e; border: 1px solid ${color}; border-radius: 8px;
    padding: 10px 14px; color: ${color}; font-family: system-ui, sans-serif;
    font-size: 12px; font-weight: 600; line-height: 1.5; max-width: 300px;
    box-shadow: 0 4px 20px rgba(0,207,255,0.25);
  `;
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  document.body.appendChild(el);
  return el as HTMLDivElement;
}

function updateStatus(el: HTMLDivElement, msg: string, color?: string): void {
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  if (color) { el.style.borderColor = color; el.style.color = color; }
}

async function phaseSearch(title: string, statusEl: HTMLDivElement): Promise<boolean> {
  updateStatus(statusEl, `Searching: ${title.slice(0, 40)}…`);

  const searchBtn = await poll<HTMLButtonElement>(
    () => document.querySelector<HTMLButtonElement>(
      'button.keywords-search-im__field-button[aria-label="Search"]'
    ),
    12000
  );

  if (!searchBtn) {
    console.log('[Syndrax Prelist] Search button not found');
    return false;
  }

  const searchInput = document.querySelector<HTMLInputElement>(
    'input[aria-label="Enter brand, model, description, etc."]'
  );
  if (searchInput && !searchInput.value.trim()) {
    searchInput.focus();
    setNativeValue(searchInput, title);
    await sleep(300);
  }

  console.log('[Syndrax Prelist] Clicking Search...');
  searchBtn.click();
  return true;
}

async function phaseMatch(statusEl: HTMLDivElement): Promise<void> {
  updateStatus(statusEl, 'Waiting for match page…');

  const skipBtn = await poll<HTMLButtonElement>(
    () => document.querySelector<HTMLButtonElement>('button.prelist-radix__next-action'),
    15000
  );

  if (!skipBtn) {
    console.log('[Syndrax Prelist] Match page not shown, continuing...');
    return;
  }

  updateStatus(statusEl, 'Skipping catalog match…');
  console.log('[Syndrax Prelist] Clicking Continue without match...');
  skipBtn.click();
}

async function phaseCondition(statusEl: HTMLDivElement): Promise<boolean> {
  updateStatus(statusEl, 'Setting condition: New…');

  const newRadio = await poll<HTMLInputElement>(
    () => document.querySelector<HTMLInputElement>('input[name="condition"][value="1000"]'),
    10000
  );

  if (!newRadio) {
    console.log('[Syndrax Prelist] Condition radio not found');
    return false;
  }

  if (!newRadio.checked) {
    newRadio.click();
    await sleep(300);
  }

  const continueBtn = await poll<HTMLButtonElement>(
    () => document.querySelector<HTMLButtonElement>('button.condition-dialog-radix__continue-btn'),
    5000
  );

  if (!continueBtn) {
    console.log('[Syndrax Prelist] Continue to listing button not found');
    return false;
  }

  updateStatus(statusEl, '✓ Condition set — opening listing form…', '#4ade80');
  console.log('[Syndrax Prelist] Clicking Continue to listing...');
  continueBtn.click();
  return true;
}

async function init(): Promise<void> {
  const { pendingListing } = await chrome.storage.local.get('pendingListing');

  if (!pendingListing?.title) {
    console.log('[Syndrax Prelist] No pending listing — skipping');
    return;
  }

  const title: string = pendingListing.title;
  console.log(`[Syndrax Prelist] Starting flow for: "${title}"`);

  await sleep(2000);

  const statusEl = showStatus('Starting…');

  const searched = await phaseSearch(title, statusEl);
  if (!searched) {
    updateStatus(statusEl, `⚠ Search failed — enter title manually:<br><b>${title.slice(0, 50)}</b>`, '#f59e0b');
    return;
  }

  await phaseMatch(statusEl);

  const continued = await phaseCondition(statusEl);
  if (!continued) {
    updateStatus(statusEl, '⚠ Condition step failed — select "New" manually then Continue to listing', '#f59e0b');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
