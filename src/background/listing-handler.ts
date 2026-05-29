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

// Maps tabId → resolver. Resolved when content script sends LISTING_COMPLETE.
export const pendingListingResolvers: Map<number, (result: { success: boolean; error?: string }) => void> = new Map();

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

  await chrome.storage.local.set({
    pendingListing: { title, description, price: ebayPrice, condition, quantity, images: [], asin }
  });

  // Pass title via URL param — eBay pre-fills the keyword search box.
  // ebay-prelist.ts clicks Search → skips match → selects New → Continue to listing.
  const tab = await chrome.tabs.create({
    url: `https://www.ebay.com/sl/prelist/home?title=${encodeURIComponent(title)}`,
    active: true,
  });
  const tabId = tab.id!;

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const TIMEOUT_MS = 90_000;

    const timer = setTimeout(() => {
      pendingListingResolvers.delete(tabId);
      chrome.tabs.remove(tabId).catch(() => {});
      resolve({ success: false, error: 'Listing timed out after 90 seconds' });
    }, TIMEOUT_MS);

    pendingListingResolvers.set(tabId, (result) => {
      clearTimeout(timer);
      chrome.tabs.remove(tabId).catch(() => {});
      resolve(result);
    });
  });
}
