import { storpaage, type InventoryItem } from './services/storage';
import type { Message } from './services/messaging';

interface AmazonCheckItem {
  listingId: string;
  title: string;
  price: number;
  asin: string;
  amazonUrl: string;
}

interface AmazonResult {
  action: string;
  amazonPrice?: number;
  amazonTitle?: string;
  newEbayPrice?: number;
  priceWentUp?: boolean;
  similarity?: number;
}

interface AmazonScrapeData {
  asin: string;
  price: number;
  inStock: boolean;
  stockLevel: string;
  title: string;
  availabilityText?: string;  // Raw availability text for debugging
  hasAddToCart?: boolean;     // Whether Add to Cart button was found
}

// Pending Amazon scrape results
const pendingAmazonScrapes: Map<number, (data: AmazonScrapeData | null) => void> = new Map();

// Setup on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Syndrax Sync installed');
  
  // Create daily sync alarm
  chrome.alarms.create('dailySync', {
    when: Date.now() + 60000,
    periodInMinutes: 1440
  });
  
  chrome.alarms.create('activityCheck', {
    periodInMinutes: 360
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailySync') {
    const autoSyncEnabled = await storage.get<boolean>('syndrax_auto_sync');
    if (autoSyncEnabled !== false) {
      await storage.addActivity('Scheduled sync ready - open eBay listings to run', 'success');
    }
  }
  
  if (alarm.name === 'activityCheck') {
    await storage.addActivity('Activity check completed', 'success');
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message: Message<unknown> & { type: string }, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message: Message<unknown> & { type: string }, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'ORDER_EXTRACTED': {
      const order = message.payload as {
        id: string;
        buyerName: string;
        buyerAddress: string;
        buyerCity: string;
        buyerState: string;
        buyerZip: string;
        buyerCountry: string;
        itemTitle: string;
        itemId: string;
        quantity: number;
        salePrice: number;
      };
      await storage.saveOrder({
        ...order,
        sourcePlatform: 'amazon',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await storage.addActivity(`Order extracted: ${order.itemTitle.substring(0, 30)}...`, 'success');
      return { success: true };
    }

    case 'SCAN_PROGRESS':
    case 'SYNC_STARTED':
    case 'SYNC_PROGRESS':
      return { success: true };

    case 'SCAN_COMPLETE': {
      const { totalItems } = message.payload as { totalItems: number };
      await storage.addActivity(`Inventory scan complete: ${totalItems} listings found`, 'success');
      return { success: true };
    }

    case 'SYNC_COMPLETE': {
      const payload = message.payload as { totalChecked: number; totalUpdated: number; totalOutOfStock: number };
      await storage.addActivity(
        `Sync complete: ${payload.totalChecked} checked, ${payload.totalUpdated} updated, ${payload.totalOutOfStock} OOS`,
        'success'
      );
      return { success: true };
    }

    case 'AMAZON_SCRAPE_RESULT': {
      const { tabId, data } = message.payload as { tabId: number; data: AmazonScrapeData };
      const resolver = pendingAmazonScrapes.get(tabId);
      if (resolver) {
        resolver(data);
        pendingAmazonScrapes.delete(tabId);
      }
      return { success: true };
    }

    case 'CHECK_AMAZON_BATCH': {
      const { items } = message.payload as { items: AmazonCheckItem[] };
      const results = await checkAmazonBatch(items);
      return { success: true, results };
    }

    case 'GET_SYNC_STATS': {
      const stats = await getSyncStats();
      return { success: true, stats };
    }

    case 'GET_STORAGE': {
      const key = message.payload as string;
      const value = await storage.get(key);
      return { success: true, value };
    }

    case 'SET_STORAGE': {
      const { key, value } = message.payload as { key: string; value: unknown };
      await storage.set(key, value);
      return { success: true };
    }

    case 'ADD_ACTIVITY': {
      const { msg, status } = message.payload as { msg: string; status: 'success' | 'error' | 'warning' };
      await storage.addActivity(msg, status);
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// Check batch of Amazon URLs
async function checkAmazonBatch(items: AmazonCheckItem[]): Promise<AmazonResult[]> {
  console.log('[BG] CHECK_AMAZON_BATCH received for', items.length, 'items');
  const results: AmazonResult[] = [];
  
  // Open all tabs simultaneously
  const tabs: chrome.tabs.Tab[] = [];
  for (const item of items) {
    try {
      console.log('[BG] Opening tab for ASIN:', item.asin);
      const tab = await chrome.tabs.create({ url: item.amazonUrl, active: false });
      tabs.push(tab);
      console.log('[BG] Tab opened:', tab.id);
    } catch (err) {
      console.error('[BG] Failed to open tab:', err);
      tabs.push({ id: undefined } as chrome.tabs.Tab);
    }
  }
  
  // Wait for all tabs to load
  console.log('[BG] Waiting for tabs to load...');
  await Promise.all(tabs.map(tab => tab.id ? waitForTabLoad(tab.id, 20000) : Promise.resolve()));
  console.log('[BG] All tabs loaded, scraping...');
  
  // Scrape all tabs
  const scrapeResults = await Promise.all(
    tabs.map((tab, idx) => tab.id ? scrapeAmazonTab(tab.id, items[idx]) : Promise.resolve(null))
  );
  console.log('[BG] Scrape results:', scrapeResults);
  
  // Process results
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const scrapeData = scrapeResults[i];
    const result = processDecision(item, scrapeData);
    console.log('[BG] Decision for', item.asin, ':', result.action, result);
    results.push(result);
  }
  
  // Close all tabs
  console.log('[BG] Closing tabs...');
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch {}
    }
  }
  
  console.log('[BG] Batch complete, returning', results.length, 'results');
  return results;
}

// Wait for tab to load
function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Scrape Amazon tab
function scrapeAmazonTab(tabId: number, item: AmazonCheckItem): Promise<AmazonScrapeData | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingAmazonScrapes.delete(tabId);
      resolve(null);
    }, 12000);

    pendingAmazonScrapes.set(tabId, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });

    chrome.scripting.executeScript({
      target: { tabId },
      func: (tid: number) => {
        console.log('[Amazon Scraper] Starting scrape on:', window.location.href);
        
        // Check if page exists / is a valid product page
        const isPageNotFound = () => {
          // Amazon dog page (404)
          if (document.querySelector('img[alt*="dog"]') && document.body.textContent?.includes("sorry")) {
            return true;
          }
          // No product title means probably not a valid product page
          if (!document.querySelector('#productTitle')) {
            return true;
          }
          // Check for error messages
          const bodyText = document.body.textContent?.toLowerCase() || '';
          if (bodyText.includes("looking for something") || 
              bodyText.includes("page you requested") ||
              bodyText.includes("no longer available")) {
            return true;
          }
          return false;
        };

        const getPrice = () => {
          // Try multiple price selectors - Amazon uses different layouts
          const priceSelectors = [
            // Current main price selectors
            '#corePrice_feature_div .a-price .a-offscreen',
            '#corePrice_feature_div .a-price-whole',
            '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
            '#corePriceDisplay_desktop_feature_div .a-price-whole',
            // Older selectors
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '#priceblock_saleprice',
            '#priceblock_snsprice_Based .a-price .a-offscreen',
            // Generic price classes
            '.a-price .a-offscreen',
            '.a-price-whole',
            '.a-price[data-a-color="base"] .a-offscreen',
            '.a-price[data-a-color="price"] .a-offscreen',
            // Buy box price
            '#newBuyBoxPrice',
            '#buybox .a-price .a-offscreen',
            '.offer-price'
          ];
          
          for (const sel of priceSelectors) {
            const el = document.querySelector(sel);
            if (el?.textContent) {
              // Clean the price text - remove currency symbols and commas
              const priceText = el.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
              const p = parseFloat(priceText);
              if (p > 0) {
                console.log('[Amazon Scraper] Found price:', p, 'using selector:', sel);
                return p;
              }
            }
          }
          console.log('[Amazon Scraper] No price found');
          return 0;
        };

        const getStock = () => {
          // Check for the specific "Currently unavailable" message first
          const unavailableSpan = document.querySelector('.primary-availability-message, .a-color-price.primary-availability-message');
          if (unavailableSpan) {
            const text = unavailableSpan.textContent?.toLowerCase() || '';
            if (text.includes('currently unavailable') || text.includes('unavailable')) {
              console.log('[Amazon Scraper] Found primary-availability-message: Currently unavailable');
              return { inStock: false, stockLevel: 'out_of_stock' };
            }
          }
          
          // Comprehensive stock status check
          const stockSelectors = [
            '#availability',
            '#availability span',
            '#availability_feature_div',
            '.a-declarative[data-action="show-all-offers-display"]',
            '#outOfStock',
            '#buybox-see-all-buying-choices',
            '.a-color-price' // Also check price-colored text for unavailable messages
          ];
          
          // Get all text from availability areas
          let availabilityText = '';
          for (const sel of stockSelectors) {
            const elements = document.querySelectorAll(sel);
            elements.forEach(el => {
              if (el?.textContent) {
                availabilityText += ' ' + el.textContent.toLowerCase();
              }
            });
          }
          console.log('[Amazon Scraper] Availability text:', availabilityText.substring(0, 300));
          
          // Check for out of stock indicators
          const outOfStockPhrases = [
            'currently unavailable',
            'out of stock',
            'unavailable',
            "doesn't ship",
            'not available',
            'no sellers',
            'see all buying options', // Often means main seller is out
            'sign up to be notified',
            'we don\'t know when',
            'item is no longer available',
            'this item cannot be shipped',
            'temporarily out of stock'
          ];
          
          for (const phrase of outOfStockPhrases) {
            if (availabilityText.includes(phrase)) {
              console.log('[Amazon Scraper] Out of stock detected:', phrase);
              return { inStock: false, stockLevel: 'out_of_stock' };
            }
          }
          
          // Check for low stock
          if (availabilityText.includes('only') && availabilityText.includes('left')) {
            const match = availabilityText.match(/only\s*(\d+)\s*left/);
            const qty = match ? parseInt(match[1]) : 5;
            console.log('[Amazon Scraper] Low stock:', qty, 'left');
            return { inStock: true, stockLevel: 'low_stock', quantity: qty };
          }
          
          // Check if Add to Cart button exists (strong in-stock indicator)
          const addToCartBtn = document.querySelector('#add-to-cart-button');
          if (!addToCartBtn) {
            console.log('[Amazon Scraper] No Add to Cart button found - likely out of stock');
            return { inStock: false, stockLevel: 'out_of_stock' };
          }
          
          // Check for "In Stock" explicitly
          if (availabilityText.includes('in stock')) {
            console.log('[Amazon Scraper] In stock confirmed');
            return { inStock: true, stockLevel: 'in_stock' };
          }
          
          // If Add to Cart exists, assume in stock even without explicit text
          console.log('[Amazon Scraper] Add to Cart exists, assuming in stock');
          return { inStock: true, stockLevel: 'in_stock' };
        };

        const getTitle = () => {
          const el = document.querySelector('#productTitle');
          const title = el?.textContent?.trim() || '';
          console.log('[Amazon Scraper] Title:', title.substring(0, 50));
          return title;
        };

        // Check if page exists first
        if (isPageNotFound()) {
          console.log('[Amazon Scraper] Page not found or invalid product page');
          chrome.runtime.sendMessage({
            type: 'AMAZON_SCRAPE_RESULT',
            payload: { tabId: tid, data: { asin: '', price: 0, inStock: false, stockLevel: 'page_not_found', title: '' } },
            timestamp: Date.now()
          });
          return;
        }

        const price = getPrice();
        const { inStock, stockLevel } = getStock();
        const title = getTitle();
        const asin = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || '';

        chrome.runtime.sendMessage({
          type: 'AMAZON_SCRAPE_RESULT',
          payload: { tabId: tid, data: { asin, price, inStock, stockLevel, title } },
          timestamp: Date.now()
        });
      },
      args: [tabId]
    }).catch(() => {
      resolve(null);
    });
  });
}

// Process decision based on Amazon data
function processDecision(item: AmazonCheckItem, amazonData: AmazonScrapeData | null): AmazonResult {
  const MARKUP = 2; // 100% markup = 2x
  const THRESHOLD = 5; // 5% change threshold

  console.log('[BG] processDecision for', item.asin, 'amazonData:', amazonData);

  // No data at all - couldn't scrape
  if (!amazonData) {
    console.log('[BG] No amazon data - SOURCE_NOT_FOUND');
    return { action: 'SOURCE_NOT_FOUND' };
  }

  // Page doesn't exist / product removed
  if (amazonData.stockLevel === 'page_not_found') {
    console.log('[BG] Page not found - treating as OUT_OF_STOCK');
    return { action: 'OUT_OF_STOCK', amazonPrice: 0, amazonTitle: '' };
  }

  // Out of stock - even if price is 0, this is a valid OOS detection
  if (!amazonData.inStock || amazonData.stockLevel === 'out_of_stock') {
    console.log('[BG] Out of stock detected');
    return { action: 'OUT_OF_STOCK', amazonPrice: amazonData.price || 0, amazonTitle: amazonData.title };
  }

  // If no price found but page exists and was "in stock", something is wrong
  if (amazonData.price <= 0) {
    console.log('[BG] No price found - SOURCE_NOT_FOUND');
    return { action: 'SOURCE_NOT_FOUND' };
  }

  // Skip title matching - trust the ASIN since it's encoded in the SKU
  // Dropshipping titles are usually different between Amazon and eBay
  // If you want to enable it, change threshold to 0.15 or higher
  const similarity = calcSimilarity(item.title, amazonData.title);
  console.log('[BG] Title similarity:', similarity, '(check disabled, trusting ASIN)');
  // DISABLED - trust ASIN:
  // if (similarity < 0.1 && amazonData.title) {
  //   return { action: 'WRONG_ITEM', similarity, amazonTitle: amazonData.title, amazonPrice: amazonData.price };
  // }

  // Calculate new price
  const newEbayPrice = parseFloat((amazonData.price * MARKUP).toFixed(2));
  const diffPct = Math.abs((newEbayPrice - item.price) / item.price * 100);
  console.log('[BG] Price check - Amazon:', amazonData.price, 'Current eBay:', item.price, 'New eBay:', newEbayPrice, 'Diff:', diffPct.toFixed(1), '%');

  if (diffPct < THRESHOLD) {
    return { action: 'NO_CHANGE', amazonPrice: amazonData.price, amazonTitle: amazonData.title };
  }

  return {
    action: 'PRICE_UPDATED',
    amazonPrice: amazonData.price,
    amazonTitle: amazonData.title,
    newEbayPrice,
    priceWentUp: newEbayPrice > item.price
  };
}

// Calculate title similarity
function calcSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const w1 = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const w2 = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = [...w1].filter(w => w2.has(w));
  const union = new Set([...w1, ...w2]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

// Get sync stats
async function getSyncStats() {
  const inventoryObj = await storage.get<Record<string, InventoryItem>>('syndrax_inventory') || {};
  const inventory = Object.values(inventoryObj);
  const lastSync = await storage.getLastSync();

  return {
    lastSync: lastSync ? new Date(lastSync).toISOString() : null,
    totalItems: inventory.length,
    withSource: inventory.filter(i => i.sourceUrl).length,
    withoutSource: inventory.filter(i => !i.sourceUrl).length,
    outOfStockCount: inventory.filter(i => i.stockLevel === 'out_of_stock').length
  };
}

// Tab update listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('ebay.com/ord') || tab.url.includes('ebay.com/sh/ord')) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PAGE_READY' });
      } catch {}
    }
  }
});
