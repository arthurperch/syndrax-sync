/**
 * MINIMAL BULK LISTER TEST SCRIPT
 * Goal: Amazon product → eBay listing page
 *
 * Flow:
 * 1. Extract product from Amazon page (title, price, image)
 * 2. Navigate to eBay prelist
 * 3. Search for product (or continue without match)
 * 4. Reach listing form
 */

function log(msg: string) {
  console.log(`%c[Bulk Lister TEST] ${msg}`, 'color: #00CFFF; font-weight: bold');
}

interface Product {
  title: string;
  price: number;
  image: string;
  asin: string;
}

// ─── STEP 1: Extract product from Amazon page ───────────────────────────────
export function extractAmazonProduct(): Product | null {
  log('Extracting Amazon product...');

  const titleEl = document.querySelector('#productTitle');
  const priceEl = document.querySelector('.a-price-whole, [data-a-color="price"]');
  const imageEl = document.querySelector('#landingImage, #imgBlkFront') as HTMLImageElement;
  const asinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);

  const title = titleEl?.textContent?.trim() || '';
  const priceText = priceEl?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
  const image = imageEl?.src || '';
  const asin = asinMatch?.[1] || '';

  if (!title || !asin) {
    log('❌ Could not extract product data');
    return null;
  }

  log(`✓ Extracted: "${title.substring(0, 50)}..." (${asin}) - $${price}`);
  return { title, price, image, asin };
}

// ─── STEP 2: Navigate to eBay prelist ────────────────────────────────────────
export function navigateToEbayPrelist(product: Product): void {
  const url = `https://www.ebay.com/sl/prelist/identify?title=${encodeURIComponent(product.title)}`;
  log(`Navigating to eBay: ${url.substring(0, 100)}...`);
  window.location.href = url;
}

// ─── STEP 3: Handle eBay prelist page ────────────────────────────────────────
export async function handleEbayPrelistPage(): Promise<boolean> {
  log('Handling eBay prelist page...');

  // Wait 2s for page to load
  await new Promise(r => setTimeout(r, 2000));

  // Find the search input — eBay's current structure uses a regular input
  const searchInput = document.querySelector(
    'input[type="text"]:not([disabled])'
  ) as HTMLInputElement | null;

  if (!searchInput) {
    log('❌ Search input not found');
    return false;
  }

  log(`✓ Found search input`);

  // The product title should already be pre-filled, but let's verify
  const inputValue = searchInput.value || searchInput.placeholder || '';
  log(`Current input: "${inputValue.substring(0, 50)}..."`);

  // Find and click the search/blue button
  // On the current page it says "Search"
  const searchBtn = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent?.trim().toLowerCase().includes('search')
  ) as HTMLButtonElement | null;

  if (searchBtn) {
    log(`✓ Clicking search button...`);
    searchBtn.click();
    await new Promise(r => setTimeout(r, 3000)); // Wait for results
  } else {
    log(`⚠ Search button not found, trying Enter key...`);
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 3000));
  }

  return true;
}

// ─── STEP 4: Handle match results page ───────────────────────────────────────
export async function handleMatchResults(): Promise<boolean> {
  log('Handling match results...');

  // Wait for page to load
  await new Promise(r => setTimeout(r, 2000));

  // Look for "Continue without match" button
  const continueBtn = Array.from(document.querySelectorAll('button, a')).find(el =>
    el.textContent?.trim().toLowerCase().includes('continue')
  ) as HTMLElement | null;

  if (continueBtn) {
    log(`✓ Clicking "${continueBtn.textContent?.trim()}"...`);
    continueBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    return true;
  }

  log(`⚠ Continue button not found`);
  return false;
}

// ─── STEP 5: Verify we reached listing form ──────────────────────────────────
export async function verifyListingFormReached(): Promise<boolean> {
  log('Checking if listing form is present...');

  // Wait for form to load
  await new Promise(r => setTimeout(r, 2000));

  // Look for title input on listing form
  const titleInput = document.querySelector(
    'input[name="title"], input[id*="title"], textarea'
  ) as HTMLInputElement | null;

  if (titleInput) {
    log(`✅ SUCCESS! Listing form found. Title input ready.`);
    return true;
  }

  log(`❌ Listing form not found`);
  return false;
}

// ─── MAIN: Run the flow ──────────────────────────────────────────────────────
export async function startBulkListingFlow(): Promise<void> {
  try {
    log('=== STARTING BULK LISTING FLOW ===');

    // Step 1: Extract
    const product = extractAmazonProduct();
    if (!product) {
      log('❌ Failed to extract Amazon product');
      return;
    }

    // Step 2: Navigate
    navigateToEbayPrelist(product);
    // After navigation, a new content script will handle the eBay page
  } catch (err) {
    log(`❌ ERROR: ${err}`);
  }
}

// ─── LISTEN FOR MESSAGES FROM BACKGROUND ─────────────────────────────────────
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_BULK_LISTING') {
    await startBulkListingFlow();
  }

  if (message.type === 'HANDLE_EBAY_PRELIST') {
    const success = await handleEbayPrelistPage();
    sendResponse({ success });
  }

  if (message.type === 'HANDLE_MATCH_RESULTS') {
    const success = await handleMatchResults();
    sendResponse({ success });
  }

  if (message.type === 'VERIFY_LISTING_FORM') {
    const success = await verifyListingFormReached();
    sendResponse({ success });
  }
});

// Auto-run if we're on an eBay prelist page
if (window.location.href.includes('ebay.com/sl/prelist')) {
  log('Detected eBay prelist page, auto-running handler...');
  setTimeout(async () => {
    await handleEbayPrelistPage();
    await new Promise(r => setTimeout(r, 5000));
    await handleMatchResults();
    await new Promise(r => setTimeout(r, 5000));
    await verifyListingFormReached();
  }, 1000);
}
