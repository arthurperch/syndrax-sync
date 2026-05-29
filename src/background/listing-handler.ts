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
  const tab = await chrome.tabs.create({ url: 'https://www.ebay.com/sell/list', active: true });
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: 'FILL_LISTING' });
      }, 2500);
    }
  });
  return { success: true };
}
