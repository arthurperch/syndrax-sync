// Content script for eBay prelist page — auto-submits ASIN to create a draft
// Runs on: *://*.ebay.com/sl/prelist/home*

interface PendingListing { asin: string; title: string; price: number; }

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

function findByText(selector: string, text: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.textContent?.trim() === text) return el;
  }
  return null;
}

async function waitForText(selector: string, text: string, timeout = 12000): Promise<Element | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = findByText(selector, text);
    if (el) return el;
    await sleep(400);
  }
  return null;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function showStatus(msg: string, color = '#00CFFF'): HTMLDivElement {
  document.getElementById('syndrax-prelist-status')?.remove();
  const el = document.createElement('div');
  el.id = 'syndrax-prelist-status';
  el.style.cssText = `position:fixed;top:10px;right:10px;background:#0a0f1e;border:1px solid ${color};border-radius:8px;padding:10px 14px;z-index:999999;color:${color};font-family:system-ui,sans-serif;font-size:12px;font-weight:600;box-shadow:0 4px 20px rgba(0,207,255,0.25);max-width:300px;line-height:1.5;`;
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  document.body.appendChild(el);
  return el as HTMLDivElement;
}

function clickSubmit(): boolean {
  const candidates = [
    document.querySelector<HTMLButtonElement>('button[aria-label="Search"]'),
    document.querySelector<HTMLButtonElement>('.keywords-search-im__field-button'),
    document.querySelector<HTMLButtonElement>('button.btn--primary[type="button"]'),
  ];
  for (const btn of candidates) { if (btn && !btn.disabled) { btn.click(); return true; } }
  for (const btn of document.querySelectorAll<HTMLButtonElement>('button')) {
    const t = btn.textContent?.trim().toLowerCase() || '';
    if ((t === 'search' || t === 'create draft') && !btn.disabled) { btn.click(); return true; }
  }
  return false;
}

async function tryProductIdTab(asin: string): Promise<boolean> {
  const tab = await waitForText('button, a, [role="tab"]', 'Product ID', 8000);
  if (!tab) return false;
  (tab as HTMLElement).click();
  await sleep(800);
  for (const sel of document.querySelectorAll<HTMLSelectElement>('select')) {
    const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes('amazon') || o.value.toLowerCase().includes('amazon'));
    if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); break; }
  }
  let asinInput: HTMLInputElement | null = null;
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
    const ph = (input.placeholder || '').toLowerCase();
    if (ph.includes('asin') || ph.includes('isbn') || ph.includes('gtin') || ph.includes('product id')) { asinInput = input; break; }
  }
  if (!asinInput) return false;
  asinInput.focus(); setNativeInputValue(asinInput, asin); await sleep(400);
  return clickSubmit();
}

async function tryWebUrlTab(asin: string): Promise<boolean> {
  const tab = await waitForText('button, a, [role="tab"]', 'Web URL', 5000);
  if (!tab) return false;
  (tab as HTMLElement).click();
  await sleep(800);
  let urlInput: HTMLInputElement | null = null;
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
    const ph = (input.placeholder || '').toLowerCase();
    if (ph.includes('amazon') || ph.includes('url') || ph.includes('walmart')) { urlInput = input; break; }
  }
  if (!urlInput) return false;
  urlInput.focus(); setNativeInputValue(urlInput, `https://www.amazon.com/dp/${asin}`); await sleep(400);
  return clickSubmit();
}

/**
 * Wait for eBay to navigate away from the prelist page, which signals the
 * draft was created and eBay is loading the listing form.
 * We watch for the URL to change away from /sl/prelist/home.
 */
async function waitForPrelistNavigation(timeout = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!window.location.href.includes('/sl/prelist/home')) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function init(): Promise<void> {
  const { pendingListing } = await chrome.storage.local.get('pendingListing');
  if (!pendingListing?.asin) { console.log('[Syndrax Prelist] No pending ASIN — skipping'); return; }
  const asin: string = pendingListing.asin;
  console.log(`[Syndrax Prelist] Starting auto-fill for ASIN: ${asin}`);
  await sleep(2500);
  const statusEl = showStatus(`Importing ASIN: ${asin}…`);

  let ok = await tryProductIdTab(asin);
  if (!ok) {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>Trying Web URL…`;
    ok = await tryWebUrlTab(asin);
  }

  if (ok) {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>✓ Submitted — waiting for eBay draft…`;
    statusEl.style.borderColor = '#4ade80';
    statusEl.style.color = '#4ade80';

    // Wait for eBay to navigate away from prelist (draft created)
    const navigated = await waitForPrelistNavigation(60_000);

    // Clear pendingListing so other content scripts don't interfere
    await chrome.storage.local.remove('pendingListing');

    // Signal completion back to the background service worker
    chrome.runtime.sendMessage({
      type: 'LISTING_COMPLETE',
      payload: { success: navigated, error: navigated ? undefined : 'eBay did not navigate away from prelist page' }
    }).catch(() => {});

    setTimeout(() => statusEl.remove(), 3000);
  } else {
    statusEl.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>⚠ Auto-fill failed — enter ASIN manually: <b>${asin}</b>`;
    statusEl.style.borderColor = '#f59e0b';
    statusEl.style.color = '#f59e0b';

    // Clear pendingListing so the queue doesn't get stuck
    await chrome.storage.local.remove('pendingListing');

    // Signal failure back to background
    chrome.runtime.sendMessage({
      type: 'LISTING_COMPLETE',
      payload: { success: false, error: 'Auto-fill failed on eBay prelist page' }
    }).catch(() => {});
  }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
