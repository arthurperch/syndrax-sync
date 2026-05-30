// eBay Prelist Controller
// Handles the full eBay listing creation flow:
// 1. Navigate to prelist URL with competitor title
// 2. Search → handle match/no-match
// 3. Select "New" condition
// 4. Fill out the listing form


function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = { info: '#00CFFF', success: '#22c55e', error: '#ef4444', warn: '#FFD700' };
  console.log(`%c[Prelist] ${msg}`, `color: ${colors[type]}`);
}

// Wait for an element to appear in the DOM
async function waitForElement(selector: string, timeoutMs = 15000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(300);
  }
  return null;
}

// Wait for element by text content
async function waitForElementByText(tag: string, text: string, timeoutMs = 10000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const els = document.querySelectorAll(tag);
    for (const el of els) {
      if (el.textContent?.trim().toLowerCase().includes(text.toLowerCase())) return el;
    }
    await sleep(300);
  }
  return null;
}

// ─── STEP 1: Navigate to prelist URL ───────────────────────────────────────
export function navigateToPrelist(title: string): void {
  const encoded = encodeURIComponent(title);
  const url = `https://www.ebay.com/sl/prelist/home?title=${encoded}`;
  log(`Navigating to prelist: ${url}`, 'info');
  window.location.href = url;
}

// ─── STEP 2: Handle the prelist search page ────────────────────────────────
async function handlePrelistSearchPage(): Promise<boolean> {
  log('Handling prelist search page...', 'info');

  // eBay prelist "Start listing with item info" page:
  // The title is pre-filled in the search input from the URL param.
  // We just need to find the input and click Search.
  const searchInput = await waitForElement(
    // Modern eBay prelist selectors (2025+)
    'input[type="search"], input[type="text"][value], input[placeholder*="item" i], input[placeholder*="search" i], input[placeholder*="title" i], .search-input input, input.textbox',
    10000
  ) as HTMLInputElement | null;

  // Fallback: grab any visible non-disabled text input on page
  const fallbackInput = !searchInput
    ? (Array.from(document.querySelectorAll('input[type="text"]:not([disabled]):not([readonly])'))
        .find(el => (el as HTMLElement).offsetParent !== null) as HTMLInputElement | null)
    : null;

  const input = searchInput || fallbackInput;

  if (!input) {
    log('Search input not found — trying to click Search button directly', 'warn');
  } else {
    log(`Found search input: "${input.value?.substring(0, 40) || '(empty)'}"`, 'info');

    // If input is empty, fill it from URL
    if (!input.value.trim()) {
      const urlParams = new URLSearchParams(window.location.search);
      const title = urlParams.get('title') || '';
      if (title) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(input, title);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(300);
        log(`Filled input with: "${title.substring(0, 50)}..."`, 'info');
      }
    }
  }

  // Find Search button by text content (most reliable across eBay redesigns)
  const searchBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(el => {
    const text = el.textContent?.trim().toLowerCase() || (el as HTMLInputElement).value?.toLowerCase() || '';
    return text === 'search' || text === 'find a match' || text === 'search ebay';
  }) as HTMLElement | null;

  if (searchBtn) {
    log(`Clicking search button: "${searchBtn.textContent?.trim()}"`, 'info');
    searchBtn.click();
    await sleep(3000);
    return true;
  }

  // Last resort: press Enter on the input
  if (input) {
    log('No search button found — pressing Enter on input', 'warn');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(3000);
    return true;
  }

  log('Search page handling failed', 'error');
  return false;
}

// ─── STEP 3: Handle match/no-match decision ────────────────────────────────
async function handleMatchDecision(): Promise<boolean> {
  log('Checking for match/no-match options...', 'info');

  // Wait for results to load
  await sleep(2500);

  // Search ALL buttons/links by text — most reliable across eBay redesigns
  const keywords = ['continue without match', 'continue without', 'without a match', 'without match', 'skip', 'continue without selecting'];

  // Poll for up to 8 seconds in case results load slowly
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const allClickable = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const el of allClickable) {
      const text = el.textContent?.trim().toLowerCase() || '';
      if (keywords.some(kw => text.includes(kw))) {
        log(`✓ Clicking: "${el.textContent?.trim()}"`, 'success');
        (el as HTMLElement).click();
        await sleep(2000);
        return true;
      }
    }
    await sleep(400);
  }

  // If no "continue without match" found — may have auto-matched, keep going
  log('No "continue without match" button found — may have auto-matched', 'warn');
  return true;
}

// ─── STEP 4: Select "New" condition ───────────────────────────────────────
async function selectNewCondition(): Promise<boolean> {
  log('Selecting "New" condition...', 'info');

  // Wait for condition selection to appear
  await sleep(1500);

  // Try radio button with value="1000" (New condition)
  const newRadio = await waitForElement(
    'input[type="radio"][value="1000"], input[id*="condition-1000"]',
    10000
  ) as HTMLInputElement | null;

  if (newRadio) {
    log('Found New condition radio, clicking...', 'info');
    newRadio.click();
    newRadio.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);
  } else {
    // Try clicking by label text
    const labels = document.querySelectorAll('label, span, div[role="radio"]');
    for (const label of labels) {
      const text = label.textContent?.trim().toLowerCase() || '';
      if (text === 'new' || text === 'new with tags' || text === 'brand new') {
        log(`Clicking condition label: "${label.textContent?.trim()}"`, 'info');
        (label as HTMLElement).click();
        await sleep(500);
        break;
      }
    }
  }

  // Click "Continue to listing" button
  const continueBtn = await waitForElement(
    '.condition-dialog-radix__continue-btn, button[class*="primary"][class*="btn"]',
    8000
  ) as HTMLButtonElement | null;

  if (continueBtn) {
    const btnText = continueBtn.textContent?.trim().toLowerCase() || '';
    if (btnText.includes('continue') || btnText.includes('listing') || btnText.includes('next')) {
      log(`Clicking: "${continueBtn.textContent?.trim()}"`, 'info');
      continueBtn.click();
      await sleep(3000);
      return true;
    }
  }

  // Search all buttons for "Continue to listing"
  const allBtns = document.querySelectorAll('button');
  for (const btn of allBtns) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if (text.includes('continue to listing') || text.includes('continue to list') || text.includes('list it')) {
      log(`Clicking: "${btn.textContent?.trim()}"`, 'info');
      (btn as HTMLButtonElement).click();
      await sleep(3000);
      return true;
    }
  }

  log('Could not find Continue button', 'error');
  return false;
}

// ─── STEP 5: Fill the listing form ────────────────────────────────────────
export interface ListingData {
  title: string;
  description: string;
  price: number;
  quantity: number;
  sku?: string;
  brand?: string;
  mpn?: string;
  upc?: string;
  condition?: string; // default: 'New'
  shippingService?: string; // default: 'FedExHomeDelivery'
  freeShipping?: boolean; // default: true
  handlingDays?: number; // default: 2
}

async function fillListingForm(data: ListingData): Promise<boolean> {
  log('Filling listing form...', 'info');

  // Wait for the listing form to load
  const titleInput = await waitForElement(
    'input[name="title"], input[id*="title"], textarea[name="title"]',
    20000
  ) as HTMLInputElement | null;

  if (!titleInput) {
    log('Listing form title input not found', 'error');
    return false;
  }

  // ── Title ──
  log('Setting title...', 'info');
  titleInput.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(titleInput, data.title);
  titleInput.dispatchEvent(new Event('input', { bubbles: true }));
  titleInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(300);

  // ── Price ──
  log('Setting price...', 'info');
  const priceInput = document.querySelector(
    'input[name="price"], input[id*="price"], input[aria-label*="price" i]'
  ) as HTMLInputElement | null;

  if (priceInput) {
    priceInput.focus();
    if (nativeSetter) nativeSetter.call(priceInput, data.price.toFixed(2));
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);
  }

  // ── Quantity ──
  log('Setting quantity...', 'info');
  const qtyInput = document.querySelector(
    'input[name="quantity"], input[id*="quantity"], input[aria-label*="quantity" i]'
  ) as HTMLInputElement | null;

  if (qtyInput) {
    qtyInput.focus();
    if (nativeSetter) nativeSetter.call(qtyInput, data.quantity.toString());
    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);
  }

  // ── SKU / Custom Label ──
  if (data.sku) {
    log('Setting SKU...', 'info');
    const skuInput = document.querySelector(
      'input[name="customLabel"], input[id*="customLabel"], input[id*="sku"], input[aria-label*="SKU" i]'
    ) as HTMLInputElement | null;

    if (skuInput) {
      skuInput.focus();
      if (nativeSetter) nativeSetter.call(skuInput, data.sku);
      skuInput.dispatchEvent(new Event('input', { bubbles: true }));
      skuInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(200);
    }
  }

  // ── Description ──
  if (data.description) {
    log('Setting description...', 'info');
    const descInput = document.querySelector(
      'textarea[name="description"], div[contenteditable="true"][id*="description"], iframe[id*="description"]'
    ) as HTMLElement | null;

    if (descInput) {
      if (descInput.tagName === 'TEXTAREA') {
        const textarea = descInput as HTMLTextAreaElement;
        if (nativeSetter) {
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (textareaSetter) textareaSetter.call(textarea, data.description);
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (descInput.contentEditable === 'true') {
        descInput.textContent = data.description;
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await sleep(300);
    }
  }

  // ── Item Specifics: Brand ──
  if (data.brand) {
    await setItemSpecific('Brand', data.brand);
  }

  // ── Item Specifics: MPN ──
  if (data.mpn) {
    await setItemSpecific('MPN', data.mpn);
  }

  // ── Shipping: Free Shipping toggle ──
  if (data.freeShipping !== false) {
    log('Enabling free shipping...', 'info');
    const freeShipToggle = document.querySelector(
      'input[name="freeShipping"], input[id*="freeShipping"]'
    ) as HTMLInputElement | null;

    if (freeShipToggle && !freeShipToggle.checked) {
      freeShipToggle.click();
      await sleep(300);
    }
  }

  log('Form filled successfully!', 'success');
  return true;
}

// Helper: Set an item specific field by label
async function setItemSpecific(label: string, value: string): Promise<void> {
  log(`Setting item specific: ${label} = ${value}`, 'info');

  // Find the field by label text
  const allLabels = document.querySelectorAll('label, span[class*="label"], div[class*="label"]');
  for (const lbl of allLabels) {
    if (lbl.textContent?.trim().toLowerCase() === label.toLowerCase()) {
      // Find the associated input
      const parent = lbl.closest('[class*="attribute"], [class*="specific"], [class*="field"]');
      if (parent) {
        const input = parent.querySelector('input, textarea') as HTMLInputElement | null;
        if (input) {
          input.focus();
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(200);
          return;
        }
      }
    }
  }

  // Fallback: try name-based selector
  const nameInput = document.querySelector(
    `input[name="attributes.${label}"], input[aria-label="${label}"]`
  ) as HTMLInputElement | null;

  if (nameInput) {
    nameInput.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(nameInput, value);
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);
  }
}

// ─── MAIN ORCHESTRATOR ─────────────────────────────────────────────────────
// Detects which step of the prelist flow we're on and handles it
async function handlePrelistFlow(): Promise<void> {
  const url = window.location.href;
  log(`Prelist flow — URL: ${url}`, 'info');

  // Check what page we're on
  const isPrelistHome = url.includes('/sl/prelist/home') || url.includes('/sl/prelist/identify');
  const isConditionPage = url.includes('/sl/prelist/') && (
    url.includes('condition') || url.includes('dialog') || url.includes('radix')
  );
  const isListingForm = url.includes('/sl/sell') || url.includes('/sl/list') || url.includes('/sl/revise');

  // Load pending listing data from storage
  const { pendingListing } = await chrome.storage.local.get('pendingListing');

  if (isPrelistHome) {
    // ebay-prelist.ts handles the full identify/search/match flow — skip here to avoid conflicts
    log('On prelist search page — handled by ebay-prelist.ts, skipping controller', 'info');
    return;

    // After search, handle match/no-match
    await sleep(2000);
    await handleMatchDecision();

    // Then select condition
    await sleep(1000);
    await selectNewCondition();

  } else if (isConditionPage) {
    log('On condition selection page', 'info');
    await selectNewCondition();

  } else if (isListingForm && pendingListing) {
    log('On listing form page — filling data', 'info');
    await sleep(2000); // Wait for form to fully render
    const ok = await fillListingForm(pendingListing as ListingData);

    if (ok) {
      // Clear pending listing from storage
      await chrome.storage.local.remove('pendingListing');
      log('Listing form filled! Ready to review and submit.', 'success');

      // Notify background
      chrome.runtime.sendMessage({
        type: 'LISTING_FORM_FILLED',
        payload: { title: (pendingListing as ListingData).title },
        timestamp: Date.now()
      });
    }
  }
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────
// Called from background or popup to start a new listing
export async function startNewListing(data: ListingData): Promise<void> {
  log(`Starting new listing: ${data.title.substring(0, 50)}...`, 'info');

  // Save listing data to storage so it persists across page navigations
  await chrome.storage.local.set({ pendingListing: data });

  // Navigate to prelist
  navigateToPrelist(data.title);
}

// ─── INIT ──────────────────────────────────────────────────────────────────
async function init(): Promise<void> {
  const url = window.location.href;

  // Only run on eBay prelist/listing pages
  const isPrelistPage =
    url.includes('ebay.com/sl/prelist') ||
    url.includes('ebay.com/sl/sell') ||
    url.includes('ebay.com/sl/list');

  if (!isPrelistPage) return;

  log('Prelist controller initialized', 'info');

  // Small delay to let the page render
  await sleep(1000);

  await handlePrelistFlow();
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_NEW_LISTING') {
    startNewListing(msg.payload as ListingData)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }

  if (msg.type === 'NAVIGATE_PRELIST') {
    navigateToPrelist(msg.payload.title);
    sendResponse({ ok: true });
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
