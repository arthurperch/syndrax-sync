// Listing handler — extracted from background-service.ts default: block
// Handles: FETCH_AMAZON_PRODUCT, CHECK_VERO, CREATE_EBAY_LISTING

import { VERO_BRANDS } from '../services/compliance';

// ─── VERO lookup (built once) ──────────────────────────────────────────────────

const VERO_SET = new Set(VERO_BRANDS.map(b => b.toLowerCase()));

// Tier 1 & 2 brands — substring-matched against title AND brand field
const HIGH_RISK_BRANDS = [
  // Tier 1 — auto-remove on eBay
  'Apple', 'Samsung', 'Sony', 'Microsoft', 'Google', 'Amazon',
  'Nintendo', 'PlayStation', 'Xbox',
  'Nike', 'Adidas', 'Under Armour', 'Puma', 'Reebok', 'New Balance', 'Jordan', 'Yeezy',
  'Louis Vuitton', 'Gucci', 'Chanel', 'Prada', 'Hermès', 'Hermes', 'Burberry', 'Versace',
  'Dior', 'Fendi', 'Balenciaga', 'Givenchy', 'Rolex', 'Cartier', 'Tiffany', 'Omega',
  'TAG Heuer', 'Patek Philippe', 'Lego', 'Disney', 'Marvel', 'Star Wars', 'Pokemon',
  'Pokémon', 'Hello Kitty', 'Sanrio', 'Barbie', 'Hot Wheels', 'Mattel', 'Hasbro',
  // Tier 2 — high risk
  'Bose', 'JBL', 'Beats', 'Dyson', 'LG', 'Panasonic', 'Canon', 'Nikon', 'GoPro',
  'DJI', 'Garmin', 'Fitbit', 'North Face', 'Patagonia', 'Columbia', 'Lululemon',
  'Ralph Lauren', 'Polo', 'Tommy Hilfiger', 'Calvin Klein', 'Lacoste', 'Oakley',
  'Ray-Ban', 'MAC', 'Estée Lauder', 'Clinique', 'Urban Decay', 'Too Faced',
  'Keurig', 'KitchenAid', 'Yeti', 'Hydroflask', 'Instant Pot', 'Vitamix', 'Ninja',
  'Tesla', 'BMW', 'Mercedes', 'Audi', 'Ford', 'Harley Davidson', 'Harley-Davidson',
];

export function handleCheckVero(
  title: string,
  brand: string
): { blocked: boolean; reason: string } {
  const titleLower = title.toLowerCase();
  const brandLower = brand.toLowerCase().trim();

  // Exact brand match against full VERO list
  if (brandLower && VERO_SET.has(brandLower)) {
    return { blocked: true, reason: `Protected brand: ${brand}` };
  }

  // Tier 1 & 2 substring match in brand field or title
  for (const pb of HIGH_RISK_BRANDS) {
    const pbl = pb.toLowerCase();
    if (brandLower.includes(pbl) || titleLower.includes(pbl)) {
      return { blocked: true, reason: `VERO brand detected: ${pb}` };
    }
  }

  return { blocked: false, reason: '' };
}

// ─── Pending listing shape ─────────────────────────────────────────────────────

interface PendingListing {
  title: string;
  description: string;
  price: number;
  condition: string;
  quantity: number;
  images: string[];
  asin: string;
}

// ─── CREATE_EBAY_LISTING ───────────────────────────────────────────────────────
// Uses ebayPrice directly — BulkLister already applied the markup from the slider.
// The old handler passed ebayPrice into createListing() as the "Amazon cost"
// which then applied a second 200% markup. This is the fix.

export async function handleCreateEbayListing(payload: {
  asin: string;
  ebayPrice: number;
  title: string;
  description?: string;
  condition?: string;
  quantity?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { asin, ebayPrice, title, description, condition, quantity } = payload;

  const pendingListing: PendingListing = {
    title,
    description: description || '',
    price: ebayPrice,
    condition: condition || 'New',
    quantity: quantity || 1,
    images: [],
    asin,
  };

  await chrome.storage.local.set({ pendingListing });

  // Open eBay's prelist page — content script auto-submits ASIN via Product ID tab.
  // After eBay creates the draft, ebay-listing-creator.ts sets the price.
  const tab = await chrome.tabs.create({
    url: 'https://www.ebay.com/sl/prelist/home',
    active: true,
  });

  if (tab.id) {
    const tabId = tab.id;
    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Give eBay's JS time to mount the form before injecting
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'FILL_LISTING',
            payload: pendingListing,
          }).catch(() => {
            // Content script not ready — init() will pick it up from storage
          });
        }, 2500);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  }

  return { success: true };
}
