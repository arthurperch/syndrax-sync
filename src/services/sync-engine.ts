// Syndrax Sync - Automated Price and Stock Sync Engine
// Fully automatic - no manual steps after triggering

import { storage, type InventoryItem } from './storage';

export type SyncAction = 
  | 'NO_CHANGE'
  | 'PRICE_INCREASED' 
  | 'PRICE_DECREASED'
  | 'OUT_OF_STOCK'
  | 'BACK_IN_STOCK'
  | 'WRONG_ITEM'
  | 'SOURCE_NOT_FOUND'
  | 'ERROR';

export interface AmazonPriceData {
  asin: string;
  currentPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  title: string;
  checkedAt: string;
}

export interface SyncResult {
  listingId: string;
  title: string;
  action: SyncAction;
  oldEbayPrice: number;
  newEbayPrice: number;
  amazonPrice: number;
  amazonTitle: string;
  similarity: number;
  verified: boolean;
  reason: string;
  timestamp: string;
  error?: string;
}

export interface SyncSession {
  id: string;
  startedAt: string;
  completedAt: string;
  totalItems: number;
  checked: number;
  noChange: number;
  priceUpdated: number;
  outOfStock: number;
  errors: number;
  flagged: number;
  results: SyncResult[];
}

const MARKUP_PERCENT = 100; // 100% = sell at 2x cost
const CHANGE_THRESHOLD = 5; // Only update if price changed 5%+
const SIMILARITY_THRESHOLD = 0.25; // 25% word overlap to verify same item
const BATCH_SIZE = 3; // Check 3 Amazon pages at once
const BATCH_DELAY = 3000; // 3 seconds between batches

// Pending Amazon price results
const pendingPriceResults: Map<number, (data: AmazonPriceData | null) => void> = new Map();

// Register handler for price results
export function registerPriceResultHandler(tabId: number, resolver: (data: AmazonPriceData | null) => void) {
  pendingPriceResults.set(tabId, resolver);
}

// Handle incoming price result
export function handlePriceResult(tabId: number, data: AmazonPriceData | null) {
  const resolver = pendingPriceResults.get(tabId);
  if (resolver) {
    resolver(data);
    pendingPriceResults.delete(tabId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500); // Extra wait for dynamic content
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Title similarity using Jaccard index
function calculateSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  
  const words1 = new Set(
    title1.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  const words2 = new Set(
    title2.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.length / union.size;
}

// Get price from Amazon tab
async function getPriceFromTab(tabId: number): Promise<AmazonPriceData | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingPriceResults.delete(tabId);
      resolve(null);
    }, 15000);

    registerPriceResultHandler(tabId, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });

    // Inject price extraction script
    chrome.scripting.executeScript({
      target: { tabId },
      func: (tid: number) => {
        // Price selectors
        const PRICE_SELECTORS = [
          '.a-price-whole',
          '#priceblock_ourprice',
          '#priceblock_dealprice',
          '.a-price .a-offscreen',
          '#corePrice_feature_div .a-price-whole',
          '.a-price[data-a-color="base"] .a-offscreen',
          '[data-a-color="price"] .a-offscreen',
          '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen'
        ];

        // Stock selectors
        const STOCK_SELECTORS = [
          '#availability span',
          '#outOfStock',
          '#availability',
          '[data-csa-c-availability]'
        ];

        // Title selectors
        const TITLE_SELECTORS = [
          '#productTitle',
          '#title span',
          'h1.a-size-large'
        ];

        let price = 0;
        for (const sel of PRICE_SELECTORS) {
          const el = document.querySelector(sel);
          if (el?.textContent) {
            const cleaned = el.textContent.replace(/[^0-9.]/g, '');
            const parsed = parseFloat(cleaned);
            if (parsed > 0) {
              price = parsed;
              break;
            }
          }
        }

        let inStock = true;
        let stockLevel = 'in_stock';
        for (const sel of STOCK_SELECTORS) {
          const el = document.querySelector(sel);
          if (el?.textContent) {
            const text = el.textContent.toLowerCase();
            if (text.includes('out of stock') || text.includes('unavailable') || text.includes('currently unavailable')) {
              inStock = false;
              stockLevel = 'out_of_stock';
            } else if (text.includes('only') && text.includes('left')) {
              stockLevel = 'low_stock';
            }
            break;
          }
        }

        let title = '';
        for (const sel of TITLE_SELECTORS) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) {
            title = el.textContent.trim();
            break;
          }
        }

        const asin = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || '';

        chrome.runtime.sendMessage({
          type: 'AMAZON_PRICE_RESULT',
          payload: {
            tabId: tid,
            data: {
              asin,
              currentPrice: price,
              inStock,
              stockLevel,
              title,
              checkedAt: new Date().toISOString()
            }
          },
          timestamp: Date.now()
        });
      },
      args: [tabId]
    }).catch(() => {
      resolve(null);
    });
  });
}

// Update eBay price via content script injection
async function updateEbayPrice(listingId: string, newPrice: number): Promise<boolean> {
  try {
    // Open eBay listing edit page
    const editUrl = `https://www.ebay.com/sl/list?mode=ReviseItem&itemId=${listingId}`;
    const tab = await chrome.tabs.create({ url: editUrl, active: false });
    
    if (!tab.id) return false;
    
    await waitForTabLoad(tab.id, 20000);
    await sleep(2000);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (price: number) => {
        // Find price input and update
        const priceSelectors = [
          'input[id*="price"]',
          'input[name*="price"]',
          '#price',
          '.price-input input',
          '[data-test-id="price-input"]'
        ];
        for (const sel of priceSelectors) {
          const input = document.querySelector(sel) as HTMLInputElement;
          if (input) {
            input.value = price.toFixed(2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
        // Find and click save/submit button
        setTimeout(() => {
          const saveSelectors = [
            'button[data-action="SAVE"]',
            'button[type="submit"]',
            '.save-btn',
            '#submitBtn',
            '[data-test-id="submit"]'
          ];
          for (const sel of saveSelectors) {
            const btn = document.querySelector(sel) as HTMLButtonElement;
            if (btn) {
              btn.click();
              break;
            }
          }
        }, 500);
      },
      args: [newPrice]
    });

    await sleep(3000);
    await chrome.tabs.remove(tab.id);
    return true;
  } catch {
    return false;
  }
}

// Update eBay quantity to 0 for out of stock
async function updateEbayQuantity(listingId: string, quantity: number): Promise<boolean> {
  try {
    const editUrl = `https://www.ebay.com/sl/list?mode=ReviseItem&itemId=${listingId}`;
    const tab = await chrome.tabs.create({ url: editUrl, active: false });
    
    if (!tab.id) return false;
    
    await waitForTabLoad(tab.id, 20000);
    await sleep(2000);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (qty: number) => {
        const qtySelectors = [
          'input[id*="quantity"]',
          'input[name*="quantity"]',
          '#quantity',
          '.quantity-input input',
          '[data-test-id="quantity-input"]'
        ];
        for (const sel of qtySelectors) {
          const input = document.querySelector(sel) as HTMLInputElement;
          if (input) {
            input.value = qty.toString();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
        setTimeout(() => {
          const saveSelectors = [
            'button[data-action="SAVE"]',
            'button[type="submit"]',
            '.save-btn',
            '#submitBtn',
            '[data-test-id="submit"]'
          ];
          for (const sel of saveSelectors) {
            const btn = document.querySelector(sel) as HTMLButtonElement;
            if (btn) {
              btn.click();
              break;
            }
          }
        }, 500);
      },
      args: [quantity]
    });

    await sleep(3000);
    await chrome.tabs.remove(tab.id);
    return true;
  } catch {
    return false;
  }
}

// Process a single item result and determine action
async function processItemResult(
  item: InventoryItem,
  amazonData: AmazonPriceData | null
): Promise<SyncResult> {
  const timestamp = new Date().toISOString();
  const baseResult: SyncResult = {
    listingId: item.listingId,
    title: item.title,
    action: 'ERROR',
    oldEbayPrice: item.ebayPrice,
    newEbayPrice: item.ebayPrice,
    amazonPrice: 0,
    amazonTitle: '',
    similarity: 0,
    verified: false,
    reason: '',
    timestamp
  };

  // Step 1 — Source not found or error
  if (!amazonData || amazonData.currentPrice <= 0) {
    return {
      ...baseResult,
      action: 'SOURCE_NOT_FOUND',
      reason: 'Could not load Amazon page or extract price data'
    };
  }

  // Step 2 — Verify it's the same item using title similarity
  const similarity = calculateSimilarity(item.title, amazonData.title);
  const verified = similarity >= SIMILARITY_THRESHOLD;

  if (!verified && amazonData.title) {
    return {
      ...baseResult,
      amazonPrice: amazonData.currentPrice,
      amazonTitle: amazonData.title,
      similarity,
      verified: false,
      action: 'WRONG_ITEM',
      reason: `Title similarity too low (${(similarity * 100).toFixed(0)}%). May be wrong product.`
    };
  }

  // Step 3 — Check stock status
  if (!amazonData.inStock) {
    // AUTO ACTION: Update eBay quantity to 0
    const updated = await updateEbayQuantity(item.listingId, 0);
    return {
      ...baseResult,
      amazonPrice: amazonData.currentPrice,
      amazonTitle: amazonData.title,
      similarity,
      verified,
      action: 'OUT_OF_STOCK',
      reason: updated 
        ? `Amazon out of stock. eBay quantity set to 0.`
        : `Amazon out of stock. Failed to update eBay.`
    };
  }

  // Step 4 — Calculate correct eBay price (100% markup = 2x Amazon price)
  const correctEbayPrice = parseFloat(
    (amazonData.currentPrice * (1 + MARKUP_PERCENT / 100)).toFixed(2)
  );
  const priceDiffPct = Math.abs(
    (correctEbayPrice - item.ebayPrice) / item.ebayPrice * 100
  );

  // Step 5 — No change needed
  if (priceDiffPct < CHANGE_THRESHOLD) {
    return {
      ...baseResult,
      amazonPrice: amazonData.currentPrice,
      amazonTitle: amazonData.title,
      similarity,
      verified,
      newEbayPrice: item.ebayPrice,
      action: 'NO_CHANGE',
      reason: `Price within ${CHANGE_THRESHOLD}% threshold. Amazon: $${amazonData.currentPrice}, eBay: $${item.ebayPrice}`
    };
  }

  // Step 6 — Price needs updating
  const priceWentUp = correctEbayPrice > item.ebayPrice;
  const action: SyncAction = priceWentUp ? 'PRICE_INCREASED' : 'PRICE_DECREASED';

  // AUTO ACTION: Update eBay listing price
  const updated = await updateEbayPrice(item.listingId, correctEbayPrice);
  
  return {
    ...baseResult,
    amazonPrice: amazonData.currentPrice,
    amazonTitle: amazonData.title,
    similarity,
    verified,
    newEbayPrice: updated ? correctEbayPrice : item.ebayPrice,
    action,
    reason: updated
      ? `Amazon ${priceWentUp ? 'increased' : 'decreased'} to $${amazonData.currentPrice}. eBay updated to $${correctEbayPrice}.`
      : `Price change needed but failed to update eBay.`
  };
}

// Run full sync
export async function runFullSync(): Promise<SyncSession> {
  const sessionId = crypto.randomUUID();
  const session: SyncSession = {
    id: sessionId,
    startedAt: new Date().toISOString(),
    completedAt: '',
    totalItems: 0,
    checked: 0,
    noChange: 0,
    priceUpdated: 0,
    outOfStock: 0,
    errors: 0,
    flagged: 0,
    results: []
  };

  // Get all inventory
  const inventoryObj = await storage.get<Record<string, InventoryItem>>('syndrax_inventory') || {};
  const items = Object.values(inventoryObj).filter(item => item.sourceUrl);

  session.totalItems = items.length;

  if (items.length === 0) {
    session.completedAt = new Date().toISOString();
    return session;
  }

  // Send start notification
  chrome.runtime.sendMessage({
    type: 'SYNC_STARTED',
    payload: { totalItems: session.totalItems, sessionId },
    timestamp: Date.now()
  });

  await storage.addActivity(`Starting sync of ${session.totalItems} items...`, 'warning');

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const tabs: chrome.tabs.Tab[] = [];

    // Open tabs for batch
    for (const item of batch) {
      try {
        const tab = await chrome.tabs.create({ url: item.sourceUrl, active: false });
        tabs.push(tab);
      } catch {
        tabs.push({ id: undefined } as chrome.tabs.Tab);
      }
    }

    // Wait for all to load
    await Promise.all(
      tabs.map(tab => tab.id ? waitForTabLoad(tab.id, 20000) : Promise.resolve())
    );

    // Get price data from all tabs
    const amazonResults = await Promise.all(
      tabs.map(tab => tab.id ? getPriceFromTab(tab.id) : Promise.resolve(null))
    );

    // Process each result
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const amazonData = amazonResults[j];
      const result = await processItemResult(item, amazonData);

      session.results.push(result);
      session.checked++;

      switch (result.action) {
        case 'NO_CHANGE': session.noChange++; break;
        case 'PRICE_INCREASED':
        case 'PRICE_DECREASED': session.priceUpdated++; break;
        case 'OUT_OF_STOCK': session.outOfStock++; break;
        case 'WRONG_ITEM':
        case 'SOURCE_NOT_FOUND': session.flagged++; break;
        case 'ERROR': session.errors++; break;
      }

      // Update stored item
      if (amazonData) {
        inventoryObj[item.listingId] = {
          ...item,
          supplierPrice: amazonData.currentPrice,
          inStock: amazonData.inStock,
          stockLevel: amazonData.stockLevel as 'in_stock' | 'low_stock' | 'out_of_stock',
          lastScanned: result.timestamp,
          ebayPrice: result.newEbayPrice
        };
      }

      // Send live progress
      chrome.runtime.sendMessage({
        type: 'SYNC_PROGRESS',
        payload: {
          sessionId,
          checked: session.checked,
          total: session.totalItems,
          lastAction: result.action,
          lastItem: item.title.substring(0, 40)
        },
        timestamp: Date.now()
      });
    }

    // Close all tabs
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.remove(tab.id);
        } catch {
          // Tab may already be closed
        }
      }
    }

    // Save updated inventory after each batch
    await storage.set('syndrax_inventory', inventoryObj);

    // Rate limit between batches
    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY);
    }
  }

  // Complete session
  session.completedAt = new Date().toISOString();

  // Save session log
  const existingLogs = await storage.get<SyncSession[]>('syndrax_sync_logs') || [];
  existingLogs.unshift(session);
  await storage.set('syndrax_sync_logs', existingLogs.slice(0, 30));

  // Update last sync time
  await storage.updateLastSync();

  // Log summary
  await storage.addActivity(
    `Sync complete: ${session.checked} checked, ${session.priceUpdated} updated, ${session.outOfStock} OOS, ${session.flagged} flagged`,
    session.errors > 0 ? 'warning' : 'success'
  );

  // Send completion
  chrome.runtime.sendMessage({
    type: 'SYNC_COMPLETE',
    payload: { session },
    timestamp: Date.now()
  });

  return session;
}
