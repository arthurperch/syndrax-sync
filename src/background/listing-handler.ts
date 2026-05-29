import { VERO_BRANDS } from '../services/compliance';

const HIGH_RISK_BRANDS = ['Apple', 'Samsung', 'Nike', 'Louis Vuitton', 'Disney'];

export function handleCheckVero(title: string, brand: string): { blocked: boolean; reason: string } {
  const veroSet = new Set(VERO_BRANDS.map(b => b.toLowerCase()));
  if (veroSet.has(brand.toLowerCase())) {
    return { blocked: true, reason: `Brand "${brand}" is on the VERO list` };
  }
  const combined = (brand + ' ' + title).toLowerCase();
  for (const risk of HIGH_RISK_BRANDS) {
    if (combined.includes(risk.toLowerCase())) {
      return { blocked: true, reason: `High-risk brand "${risk}" detected` };
    }
  }
  return { blocked: false, reason: '' };
}

// ─── Completion tracking ──────────────────────────────────────────────────────
// Maps tabId → resolver function. When the content script sends LISTING_COMPLETE
// for that tab, we resolve the promise and the caller unblocks.
export const pendingListingResolvers: Map<number, (result: { success: boolean; error?: string }) => void> = new Map();

/**
 * Called by the background message handler when a LISTING_COMPLETE message
 * arrives from the ebay-prelist content script.
 */
export function resolveListingCompletion(tabId: number, result: { success: boolean; error?: string }): void {
  const resolver = pendingListingResolvers.get(tabId);
  if (resolver) {
    pendingListingResolvers.delete(tabId);
    resolver(result);
  }
}

export async function handleCreateEbayListing(payload: {
  asin: string;
  ebayPrice: number;
  title: string;
  description?: string;
  condition?: string;
  quantity?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { asin, ebayPrice, title, description, condition, quantity } = payload;

  // Store listing data for the content script to pick up
  await chrome.storage.local.set({
    pendingListing: { title, description, price: ebayPrice, condition, quantity, images: [], asin }
  });

  // Open eBay's prelist page — content script auto-submits ASIN via Product ID tab.
  const tab = await chrome.tabs.create({ url: 'https://www.ebay.com/sl/prelist/home', active: true });
  const tabId = tab.id!;

  // Return a promise that resolves when the content script sends LISTING_COMPLETE
  // or rejects after a 90-second timeout (eBay can be slow).
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const TIMEOUT_MS = 90_000;

    const timer = setTimeout(() => {
      pendingListingResolvers.delete(tabId);
      // Close the tab on timeout to avoid orphaned tabs
      chrome.tabs.remove(tabId).catch(() => {});
      resolve({ success: false, error: 'Listing timed out after 90 seconds' });
    }, TIMEOUT_MS);

    pendingListingResolvers.set(tabId, (result) => {
      clearTimeout(timer);
      // Close the tab once listing is done
      chrome.tabs.remove(tabId).catch(() => {});
      resolve(result);
    });
  });
}
