// ============================================================================
// opti-list.ts — Storage + CRUD for Opti-List
//
// Storage key:  'syndrax_opti_list'
// Pattern:      Follows existing storage.ts conventions
//
// Usage:
//   import { optiList } from './opti-list';
//   await optiList.addItem('B08N5WRWNW');
//   await optiList.updatePricing('B08N5WRWNW', 29.99, 100, 1);
//   const all = await optiList.getAll();
// ============================================================================

import {
  type OptiListStorage,
  type OptiListItem,
  type ImageVariant,
  makeDefaultItem,
  makeDefaultStorage,
  calcEbayPrice,
} from '../types/opti-list';

const STORAGE_KEY = 'syndrax_opti_list';

// ─── Low-level load / save ─────────────────────────────────────────────────

async function load(): Promise<OptiListStorage> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw) return makeDefaultStorage();
  // Schema migration point — bump version here when types change
  if (raw.version !== 1) return makeDefaultStorage();
  return raw as OptiListStorage;
}

async function save(data: OptiListStorage): Promise<void> {
  data.metadata.updatedAt = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

// ─── Public API ───────────────────────────────────────────────────────────

export const optiList = {

  // ── Read ──────────────────────────────────────────────────────────────

  async getAll(): Promise<OptiListStorage> {
    return load();
  },

  async getItem(asin: string): Promise<OptiListItem | null> {
    const data = await load();
    return data.items[asin] ?? null;
  },

  /** Returns items in user-defined order (for UI and bulk run) */
  async getOrdered(): Promise<OptiListItem[]> {
    const data = await load();
    return data.order
      .map(asin => data.items[asin])
      .filter(Boolean);
  },

  // ── Create ────────────────────────────────────────────────────────────

  /**
   * Add a new ASIN to the list. Returns the created item.
   * Idempotent — if ASIN already exists, returns existing item.
   */
  async addItem(asin: string, partial?: Partial<OptiListItem>): Promise<OptiListItem> {
    const data = await load();

    if (data.items[asin]) return data.items[asin]; // Already exists

    const item: OptiListItem = {
      ...makeDefaultItem(asin, data.defaults.markupPct),
      ...partial,
    };

    data.items[asin] = item;
    if (!data.order.includes(asin)) data.order.push(asin);

    await save(data);
    return item;
  },

  /**
   * Import multiple ASINs at once, respecting insertion order.
   */
  async addItems(asins: string[]): Promise<OptiListItem[]> {
    const data = await load();
    const created: OptiListItem[] = [];

    for (const asin of asins) {
      if (!data.items[asin]) {
        const item = makeDefaultItem(asin, data.defaults.markupPct);
        data.items[asin] = item;
        data.order.push(asin);
        created.push(item);
      } else {
        created.push(data.items[asin]);
      }
    }

    await save(data);
    return created;
  },

  // ── Update ────────────────────────────────────────────────────────────

  async updateItem(asin: string, patch: Partial<OptiListItem>): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    data.items[asin] = {
      ...data.items[asin],
      ...patch,
      updatedAt: Date.now(),
    };

    await save(data);
    return data.items[asin];
  },

  /** Set Amazon scraped data */
  async setAmazonData(asin: string, amazon: OptiListItem['amazon']): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    item.amazon = amazon;
    item.name = amazon.title || asin;
    item.pricing.cost = amazon.price;
    item.pricing.ebayPrice = calcEbayPrice(amazon.price, item.pricing.markupPct);
    item.pricing.calculatedAt = Date.now();
    item.status = 'DRAFT';
    item.updatedAt = Date.now();

    await save(data);
    return item;
  },

  /** Set AI-generated eBay listing content */
  async setEbayContent(
    asin: string,
    content: OptiListItem['ebay'],
    forceOverwrite = false
  ): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];

    // Don't overwrite user edits unless explicitly forced
    if (!item.userEdits.title || forceOverwrite) {
      item.ebay.title = content.title;
    }
    if (!item.userEdits.description || forceOverwrite) {
      item.ebay.description = content.description;
    }
    item.ebay.keywords = content.keywords;
    item.ebay.generatedAt = content.generatedAt;

    // Mark READY only if we have price + content
    if (item.pricing.cost > 0 && item.ebay.title) {
      item.status = 'READY';
    }

    item.updatedAt = Date.now();
    await save(data);
    return item;
  },

  /** Per-ASIN pricing — markupPct overrides global default */
  async updatePricing(
    asin: string,
    cost: number,
    markupPct: number,
    quantity = 1
  ): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    item.pricing = {
      cost,
      markupPct,
      ebayPrice: calcEbayPrice(cost, markupPct),
      quantity,
      calculatedAt: Date.now(),
    };
    item.userEdits.markupPct = true;
    item.updatedAt = Date.now();

    await save(data);
    return item;
  },

  async setStatus(asin: string, status: OptiListItem['status'], error?: OptiListItem['error']): Promise<void> {
    const data = await load();
    if (!data.items[asin]) return;

    data.items[asin].status = status;
    if (error) data.items[asin].error = error;
    data.items[asin].updatedAt = Date.now();

    await save(data);
  },

  async markListed(asin: string, ebayItemId?: string, ebayListingUrl?: string): Promise<void> {
    const data = await load();
    if (!data.items[asin]) return;

    const item = data.items[asin];
    item.status = 'LISTED';
    item.listedAt = Date.now();
    item.listingAttempts++;
    if (ebayItemId) item.ebayItemId = ebayItemId;
    if (ebayListingUrl) item.ebayListingUrl = ebayListingUrl;
    item.updatedAt = Date.now();

    await save(data);
  },

  // ── Image CRUD ────────────────────────────────────────────────────────

  async addImage(asin: string, variant: Omit<ImageVariant, 'id' | 'order' | 'createdAt'>): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    const newVariant: ImageVariant = {
      ...variant,
      id: crypto.randomUUID(),
      order: item.images.length,
      createdAt: Date.now(),
    };

    item.images.push(newVariant);

    // Auto-set primary if none set yet
    if (!item.primaryImageId && newVariant.quality === 'good') {
      item.primaryImageId = newVariant.id;
    }

    item.updatedAt = Date.now();
    await save(data);
    return item;
  },

  async removeImage(asin: string, variantId: string): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    item.images = item.images.filter(img => img.id !== variantId);

    // Recompute order indices
    item.images.forEach((img, i) => { img.order = i; });

    // If primary was deleted, auto-select first good image
    if (item.primaryImageId === variantId) {
      const first = item.images.find(img => img.quality === 'good') ?? item.images[0];
      item.primaryImageId = first?.id ?? '';
    }

    item.updatedAt = Date.now();
    await save(data);
    return item;
  },

  async setPrimaryImage(asin: string, variantId: string): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    if (!item.images.find(img => img.id === variantId)) return null;

    item.primaryImageId = variantId;
    item.userEdits.primaryImageId = true;
    item.updatedAt = Date.now();

    await save(data);
    return item;
  },

  async reorderImages(asin: string, orderedIds: string[]): Promise<OptiListItem | null> {
    const data = await load();
    if (!data.items[asin]) return null;

    const item = data.items[asin];
    const map = Object.fromEntries(item.images.map(img => [img.id, img]));

    item.images = orderedIds
      .filter(id => map[id])
      .map((id, i) => ({ ...map[id], order: i }));

    item.updatedAt = Date.now();
    await save(data);
    return item;
  },

  // ── Queue Order ───────────────────────────────────────────────────────

  async reorder(newOrder: string[]): Promise<void> {
    const data = await load();
    // Only allow ASINs that actually exist in items
    data.order = newOrder.filter(asin => data.items[asin]);
    await save(data);
  },

  async moveUp(asin: string): Promise<void> {
    const data = await load();
    const idx = data.order.indexOf(asin);
    if (idx > 0) {
      [data.order[idx - 1], data.order[idx]] = [data.order[idx], data.order[idx - 1]];
      await save(data);
    }
  },

  async moveDown(asin: string): Promise<void> {
    const data = await load();
    const idx = data.order.indexOf(asin);
    if (idx >= 0 && idx < data.order.length - 1) {
      [data.order[idx], data.order[idx + 1]] = [data.order[idx + 1], data.order[idx]];
      await save(data);
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────

  async removeItem(asin: string): Promise<void> {
    const data = await load();
    delete data.items[asin];
    data.order = data.order.filter(a => a !== asin);
    await save(data);
  },

  async clear(): Promise<void> {
    await save(makeDefaultStorage());
  },

  // ── Config ────────────────────────────────────────────────────────────

  async setDefaults(markupPct: number, quantity: number): Promise<void> {
    const data = await load();
    data.defaults = { markupPct, quantity };
    await save(data);
  },

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Get the primary image URL for a given ASIN (for eBay listing) */
  async getPrimaryImageUrl(asin: string): Promise<string> {
    const item = await this.getItem(asin);
    if (!item) return '';
    const primary = item.images.find(img => img.id === item.primaryImageId);
    return primary?.dataUrl || primary?.url || item.amazon.mainImageUrl || '';
  },

  /** Stats for the header bar */
  async getStats(): Promise<{ total: number; ready: number; listed: number; failed: number }> {
    const data = await load();
    const items = Object.values(data.items);
    return {
      total: items.length,
      ready: items.filter(i => i.status === 'READY').length,
      listed: items.filter(i => i.status === 'LISTED').length,
      failed: items.filter(i => i.status === 'FAILED' || i.status === 'BLOCKED').length,
    };
  },
};
