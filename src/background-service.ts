import { storage, type InventoryItem } from './services/storage';
import type { Message } from './services/messaging';
import { discord, sendDailySummaryWebhook } from './services/discord-logger';

// Helper to get next midnight timestamp
function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

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
  // Variant fields
  isVariantProduct?: boolean;
  isParentAsin?: boolean;
  currentChildAsin?: string;
  selectedVariantLabel?: string;
  matchedChildAsin?: string;
  matchedChildUrl?: string;
  variantStockStatus?: boolean;
  allVariants?: Array<{
    asin: string;
    label: string;
    dimensions: string[];
    available: boolean;
    selected: boolean;
    url: string;
  }>;
  variantDimensions?: string[];
}

// Pending Amazon scrape results
const pendingAmazonScrapes: Map<number, (data: AmazonScrapeData | null) => void> = new Map();

// ==================== EARNINGS SCAN STATE ====================
interface EarningsScanState {
  orders: any[];
  processed: number;
  total: number;
  batchSize: number;
  activeTabs: Map<number, string>;
  sourceTabId: number;
}

let earningsScanState: EarningsScanState = {
  orders: [],
  processed: 0,
  total: 0,
  batchSize: 5,
  activeTabs: new Map(),
  sourceTabId: 0
};

// Process a batch of payment pages
async function processEarningsBatch(): Promise<void> {
  const { orders, processed, batchSize, activeTabs } = earningsScanState;
  
  const startIndex = processed;
  const endIndex = Math.min(processed + batchSize, orders.length);
  const batch = orders.slice(startIndex, endIndex);
  
  if (batch.length === 0) {
    console.log('✅ All orders processed!');
    await finishEarningsScan();
    return;
  }
  
  console.log(`📦 Processing batch: ${startIndex + 1} to ${endIndex} of ${orders.length}`);
  
  for (const order of batch) {
    if (!order.paymentUrl) continue;
    
    try {
      const tab = await chrome.tabs.create({
        url: order.paymentUrl,
        active: false
      });
      
      if (tab.id) {
        activeTabs.set(tab.id, order.orderId);
        console.log(`🔗 Opened tab ${tab.id} for order ${order.orderId}`);
      }
    } catch (error) {
      console.error(`❌ Error opening tab for ${order.orderId}:`, error);
    }
  }
}

// Update sold inventory storage
async function updateSoldInventory(data: any): Promise<void> {
  const storageData = await chrome.storage.local.get('soldInventory');
  const inventory: any[] = storageData.soldInventory || [];
  
  const orderData = earningsScanState.orders.find(o => o.orderId === data.orderId);
  const existingIndex = inventory.findIndex(i => i.orderId === data.orderId);
  
  const item = {
    orderId: data.orderId,
    itemTitle: orderData?.itemTitle || data.itemTitle || 'Unknown',
    saleDate: orderData?.saleDate || '',
    salePrice: orderData?.salePrice || '',
    orderEarnings: data.orderEarnings,
    paymentUrl: orderData?.paymentUrl || '',
    status: 'scanned',
    scannedAt: Date.now()
  };
  
  if (existingIndex >= 0) {
    inventory[existingIndex] = { ...inventory[existingIndex], ...item };
  } else {
    inventory.push(item);
  }
  
  await chrome.storage.local.set({ soldInventory: inventory });
  console.log(`📊 Inventory updated: ${inventory.length} items`);
}

// Finish earnings scan
async function finishEarningsScan(): Promise<void> {
  if (earningsScanState.sourceTabId) {
    try {
      await chrome.tabs.sendMessage(earningsScanState.sourceTabId, {
        type: 'EARNINGS_SCAN_COMPLETE',
        total: earningsScanState.processed
      });
    } catch {}
  }
  
  earningsScanState = {
    orders: [],
    processed: 0,
    total: 0,
    batchSize: 5,
    activeTabs: new Map(),
    sourceTabId: 0
  };
}

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
  
  // Daily summary alarm — fires at midnight
  chrome.alarms.create('dailySummary', {
    when: getNextMidnight(),
    periodInMinutes: 1440  // Repeat every 24 hours
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
  
  // Daily summary — fires at midnight
  if (alarm.name === 'dailySummary') {
    const stats = await buildDailySummary();
    await discord.dailySummary(stats);
    // Reset daily counters
    await chrome.storage.local.set({ syndrax_daily_stats: {} });
    await discord.dailyReset();
  }
});

// Build daily summary from stored stats
async function buildDailySummary() {
  const result = await chrome.storage.local.get('syndrax_daily_stats');
  const stats = result.syndrax_daily_stats || {};
  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    totalScanned: stats.totalScanned || 0,
    priceUpdates: stats.priceUpdates || 0,
    outOfStock: stats.outOfStock || 0,
    backInStock: stats.backInStock || 0,
    fingerprintFlags: stats.fingerprintFlags || 0,
    fingerprintDelists: stats.fingerprintDelists || 0,
    variantsDetected: stats.variantsDetected || 0,
    errors: stats.errors || 0,
    topOutOfStock: stats.outOfStockItems || [],
    topPriceChanges: stats.priceChangeItems || []
  };
}

// Increment daily stat counters — exported for use by content scripts via message
async function incrementDailyStat(key: string, item?: { title: string; asin: string; oldPrice?: number; newPrice?: number }) {
  const result = await chrome.storage.local.get('syndrax_daily_stats');
  const stats = result.syndrax_daily_stats || {};
  stats[key] = (stats[key] || 0) + 1;
  
  // Track items for summary
  if (key === 'outOfStock' && item) {
    stats.outOfStockItems = [...(stats.outOfStockItems || []), { title: item.title, asin: item.asin }].slice(-10);
  }
  if (key === 'priceUpdates' && item) {
    stats.priceChangeItems = [...(stats.priceChangeItems || []), item].slice(-10);
  }
  
  await chrome.storage.local.set({ syndrax_daily_stats: stats });
}

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

    default: {
      // Handle dynamic message types not in the strict type definition
      const msgType = message.type as string;
      
      if (msgType === 'INCREMENT_STAT') {
        const { key, item } = message.payload as { key: string; item?: { title: string; asin: string; oldPrice?: number; newPrice?: number } };
        await incrementDailyStat(key, item);
        return { success: true };
      }
      
      if (msgType === 'DISCORD_WEBHOOK') {
        const { method, data } = message.payload as { method: string; data: unknown };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const discordMethod = (discord as any)[method];
        if (discordMethod && typeof discordMethod === 'function') {
          await discordMethod(data);
        }
        return { success: true };
      }
      
      // ===== FINANCE RECONCILIATION SCAN =====
      if (msgType === 'START_FINANCE_SCAN') {
        const { runId, startUrl } = message.payload as { runId: string; startUrl: string };
        console.log(`💰 Starting Finance Scan: ${runId}`);
        startFinanceScan(runId, startUrl);
        return { success: true };
      }
      
      if (msgType === 'PAUSE_FINANCE_SCAN') {
        pauseFinanceScan();
        return { success: true };
      }
      
      if (msgType === 'RESUME_FINANCE_SCAN') {
        resumeFinanceScan();
        return { success: true };
      }
      
      if (msgType === 'STOP_FINANCE_SCAN') {
        stopFinanceScan();
        return { success: true };
      }
      
      // ===== FINANCE EARNINGS BATCH SCAN =====
      if (msgType === 'START_EARNINGS_BATCH_SCAN') {
        const { orders, batchSize = 5 } = message.payload as { orders: any[]; batchSize?: number };
        console.log(`💰 Starting Earnings Batch Scan: ${orders?.length} orders`);
        
        if (!orders || orders.length === 0) {
          return { success: false, error: 'No orders provided' };
        }
        
        earningsScanState = {
          orders,
          processed: 0,
          total: orders.length,
          batchSize,
          activeTabs: new Map(),
          sourceTabId: sender.tab?.id || 0
        };
        
        // Start processing batches
        setTimeout(() => processEarningsBatch(), 500);
        
        return { success: true, message: `Processing ${orders.length} orders` };
      }
      
      if (msgType === 'PAYMENT_DATA_EXTRACTED') {
        const { data } = message.payload as { data: any };
        const tabId = sender.tab?.id;
        
        console.log(`💵 Payment data from tab ${tabId}:`, data?.orderEarnings);
        
        if (data?.orderId) {
          await updateSoldInventory(data);
          earningsScanState.processed++;
          earningsScanState.activeTabs.delete(tabId!);
          
          // Notify source tab
          if (earningsScanState.sourceTabId) {
            try {
              chrome.tabs.sendMessage(earningsScanState.sourceTabId, {
                type: 'EARNINGS_SCAN_PROGRESS',
                processed: earningsScanState.processed,
                total: earningsScanState.total,
                orderId: data.orderId,
                earnings: data.orderEarnings
              });
            } catch {}
          }
          
          // Close tab
          if (tabId) {
            setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 500);
          }
          
          // Process next batch if current batch done
          if (earningsScanState.activeTabs.size === 0) {
            setTimeout(() => processEarningsBatch(), 1000);
          }
        }
        
        return { success: true };
      }
      
      if (msgType === 'FINANCE_SCANNER_READY') {
        // Content script on eBay sold page is ready
        console.log('💼 Finance scanner ready on:', message.payload);
        return { success: true };
      }
      
      return { success: false, error: 'Unknown message type' };
    }
  }
}

// Check batch of Amazon URLs with variant re-routing
async function checkAmazonBatch(items: AmazonCheckItem[]): Promise<AmazonResult[]> {
  console.log('[BG] CHECK_AMAZON_BATCH received for', items.length, 'items');
  const results: AmazonResult[] = [];
  
  // Process items one at a time to handle variant re-routing
  for (const item of items) {
    let amazonData: AmazonScrapeData | null = null;
    let currentTab: chrome.tabs.Tab | null = null;
    
    try {
      console.log('[BG] Opening tab for ASIN:', item.asin);
      currentTab = await chrome.tabs.create({ url: item.amazonUrl, active: false });
      
      if (!currentTab.id) {
        results.push({ action: 'SOURCE_NOT_FOUND' });
        continue;
      }
      
      // Wait for tab to load
      await waitForTabLoad(currentTab.id, 20000);
      
      // First scrape
      amazonData = await scrapeAmazonTab(currentTab.id, item);
      console.log('[BG] First scrape result:', amazonData);
      
      // ─────────────────────────────────────────────────────
      // VARIANT RE-ROUTING: If wrong variant, navigate to correct one
      // ─────────────────────────────────────────────────────
      if (amazonData && amazonData.isVariantProduct && amazonData.matchedChildAsin && 
          amazonData.matchedChildAsin !== amazonData.currentChildAsin) {
        
        console.log('[BG] Variant mismatch detected! Current:', amazonData.currentChildAsin, 'Matched:', amazonData.matchedChildAsin);
        
        // Close current tab
        if (currentTab.id) {
          try { await chrome.tabs.remove(currentTab.id); } catch {}
        }
        
        // Open correct child ASIN URL directly
        const correctUrl = `https://www.amazon.com/dp/${amazonData.matchedChildAsin}?th=1&psc=1`;
        console.log('[BG] Opening correct variant URL:', correctUrl);
        
        currentTab = await chrome.tabs.create({ url: correctUrl, active: false });
        
        if (currentTab.id) {
          await waitForTabLoad(currentTab.id, 20000);
          
          // Store the child ASIN for future scans
          await updateItemChildAsin(item.listingId, amazonData.matchedChildAsin, correctUrl);
          
          // Re-scrape the correct variant page
          amazonData = await scrapeAmazonTab(currentTab.id, item);
          console.log('[BG] Re-scrape result for correct variant:', amazonData);
        }
      }
      
      // Process decision
      const result = processDecision(item, amazonData);
      console.log('[BG] Decision for', item.asin, ':', result.action, result);
      results.push(result);
      
    } catch (err) {
      console.error('[BG] Failed to process item:', item.asin, err);
      results.push({ action: 'SOURCE_NOT_FOUND' });
    } finally {
      // Close tab
      if (currentTab?.id) {
        try { await chrome.tabs.remove(currentTab.id); } catch {}
      }
    }
  }
  
  console.log('[BG] Batch complete, returning', results.length, 'results');
  return results;
}

// Update stored child ASIN for an inventory item
async function updateItemChildAsin(
  listingId: string,
  childAsin: string,
  childUrl: string
): Promise<void> {
  const result = await chrome.storage.local.get('syndrax_inventory');
  const inventory = result.syndrax_inventory || {};
  if (inventory[listingId]) {
    inventory[listingId].childAsin = childAsin;
    inventory[listingId].childUrl = childUrl;
    inventory[listingId].variantConfirmed = true;
    console.log('[BG] Updated child ASIN for', listingId, ':', childAsin);
  }
  await chrome.storage.local.set({ syndrax_inventory: inventory });
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

// Scrape Amazon tab with variant detection
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

    // First, inject eBay context for variant matching
    chrome.scripting.executeScript({
      target: { tabId },
      func: (title: string, price: number) => {
        (window as any).__syndraxEbayTitle = title;
        (window as any).__syndraxEbayPrice = price;
      },
      args: [item.title, item.price]
    }).then(() => {
      // Then run the main scraper with variant detection
      return chrome.scripting.executeScript({
        target: { tabId },
        func: (tid: number) => {
          console.log('[Amazon Scraper] Starting scrape on:', window.location.href);
          
          // Get eBay context for variant matching
          const ebayTitle = (window as any).__syndraxEbayTitle || '';
          const ebayPrice = (window as any).__syndraxEbayPrice || 0;
          
          // ─────────────────────────────────────────────────────
          // VARIANT DETECTION
          // ─────────────────────────────────────────────────────
          const detectVariants = () => {
            const result = {
              isVariantProduct: false,
              currentChildAsin: '',
              isParentAsin: false,
              selectedVariantLabel: '',
              allVariants: [] as Array<{asin: string; label: string; dimensions: string[]; available: boolean; selected: boolean; url: string}>,
              variantDimensions: [] as string[],
              stockOfCurrentVariant: true,
              matchedVariantAsin: ''
            };

            // Get current ASIN from URL
            const urlAsinMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
            result.currentChildAsin = urlAsinMatch ? urlAsinMatch[1] : '';

            // Detect if parent page — parent has no price and no buy box
            const hasBuyBox = !!document.querySelector('#add-to-cart-button, #buy-now-button, #buybox');
            const hasPrice = !!document.querySelector('.a-price-whole, #priceblock_ourprice, .a-price .a-offscreen');
            result.isParentAsin = !hasBuyBox && !hasPrice;

            // Check for variant selectors on page
            const variantRows = document.querySelectorAll('div[id^="inline-twister-row"]');
            result.isVariantProduct = variantRows.length > 0 || 
              !!document.querySelector('#variation_color_name, #variation_size_name, #variation_style_name, .twister-plus-mobile-desktop-bar');

            if (!result.isVariantProduct) return result;

            // Extract dimension names (size, color, style)
            variantRows.forEach(row => {
              const id = row.getAttribute('id') || '';
              const dimName = id.replace('inline-twister-row-', '').replace('_name', '').toLowerCase();
              if (dimName) result.variantDimensions.push(dimName);
            });

            // Extract selected variant label
            const selectedParts: string[] = [];
            document.querySelectorAll('.selection, .a-button-selected .a-button-text, [data-action="a-accordion"] .a-size-base.a-color-base').forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length < 50 && !selectedParts.includes(text)) {
                selectedParts.push(text);
              }
            });
            ['#variation_size_name', '#variation_color_name', '#variation_style_name'].forEach(sel => {
              const el = document.querySelector(sel);
              if (el) {
                const selected = el.querySelector('.selection, option:checked');
                const text = selected?.textContent?.trim();
                if (text && !selectedParts.includes(text)) selectedParts.push(text);
              }
            });
            result.selectedVariantLabel = selectedParts.join(' - ');

            // Extract ALL variant options
            const allVariantItems = document.querySelectorAll('li[data-asin], .swatchSelect li[data-dp-url], .twister-plus-mobile-desktop-bar li[data-asin]');
            allVariantItems.forEach(item => {
              const asin = item.getAttribute('data-asin') || '';
              if (!asin || asin.length !== 10) return;
              const unavailable = item.getAttribute('data-initiallyUnavailable') === 'true' || item.classList.contains('a-disabled') || item.querySelector('.a-icon-unavailable') !== null;
              const isSelected = item.classList.contains('a-button-selected') || item.getAttribute('aria-checked') === 'true' || item.querySelector('.a-icon-radio-active') !== null;
              const labelEl = item.querySelector('.a-button-text, span[id*="name"], .swatch-title-text');
              const label = labelEl?.textContent?.trim() || item.textContent?.trim() || '';
              if (label) {
                result.allVariants.push({
                  asin,
                  label,
                  dimensions: label.split(/[\s\-\/,]+/).filter(d => d.length > 0),
                  available: !unavailable,
                  selected: isSelected,
                  url: `https://www.amazon.com/dp/${asin}?th=1&psc=1`
                });
              }
            });

            // Stock of currently selected variant
            const availEl = document.querySelector('#availability span');
            if (availEl) {
              const stockText = availEl.textContent?.toLowerCase() || '';
              result.stockOfCurrentVariant = !['out of stock', 'unavailable', 'currently unavailable'].some(p => stockText.includes(p));
            } else if (!hasBuyBox) {
              result.stockOfCurrentVariant = false;
            }

            // Find best matching variant
            result.matchedVariantAsin = findBestVariantMatch(ebayTitle, result.allVariants, result.currentChildAsin);
            return result;
          };

          const findBestVariantMatch = (ebayTitleStr: string, variants: Array<{asin: string; label: string; dimensions: string[]; available: boolean; selected: boolean; url: string}>, currentAsin: string): string => {
            if (variants.length === 0) return currentAsin;
            const sizePattern = /(\d+["']?\s*[xX×]\s*\d+["']?|\d+\s*(?:inch|in|ft|feet|cm|mm)?|\b(?:small|medium|large|xl|xxl|xs)\b)/gi;
            const colorPattern = /\b(black|white|grey|gray|blue|red|green|brown|tan|beige|woodgrain|wood|natural|ivory|cream|navy|charcoal)\b/gi;
            const ebaySizes = (ebayTitleStr.match(sizePattern) || []).map(s => s.toLowerCase().replace(/\s+/g, '').replace(/['"]/g, ''));
            const ebayColors = (ebayTitleStr.match(colorPattern) || []).map(c => c.toLowerCase());
            let bestMatch = currentAsin;
            let bestScore = -1;
            variants.forEach(variant => {
              if (!variant.available) return;
              let score = 0;
              const variantLower = variant.label.toLowerCase();
              const variantDims = variant.dimensions.map(d => d.toLowerCase().replace(/\s+/g, '').replace(/['"]/g, ''));
              ebaySizes.forEach(ebaySize => {
                if (variantDims.some(d => d.includes(ebaySize) || ebaySize.includes(d))) score += 50;
                if (variantLower.includes(ebaySize)) score += 40;
              });
              ebayColors.forEach(color => {
                if (variantLower.includes(color)) score += 30;
              });
              if (variant.selected) score += 10;
              if (variant.asin === currentAsin) score += 5;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = variant.asin;
              }
            });
            return bestMatch;
          };
          
          // Check if page exists / is a valid product page
          const isPageNotFound = () => {
            if (document.querySelector('img[alt*="dog"]') && document.body.textContent?.includes("sorry")) return true;
            if (!document.querySelector('#productTitle')) return true;
            const bodyText = document.body.textContent?.toLowerCase() || '';
            if (bodyText.includes("looking for something") || bodyText.includes("page you requested") || bodyText.includes("no longer available")) return true;
            return false;
          };

          const getPrice = () => {
            const priceSelectors = [
              '#corePrice_feature_div .a-price .a-offscreen',
              '#corePrice_feature_div .a-price-whole',
              '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
              '#corePriceDisplay_desktop_feature_div .a-price-whole',
              '#priceblock_ourprice', '#priceblock_dealprice', '#priceblock_saleprice',
              '#priceblock_snsprice_Based .a-price .a-offscreen',
              '.a-price .a-offscreen', '.a-price-whole',
              '.a-price[data-a-color="base"] .a-offscreen', '.a-price[data-a-color="price"] .a-offscreen',
              '#newBuyBoxPrice', '#buybox .a-price .a-offscreen', '.offer-price'
            ];
            for (const sel of priceSelectors) {
              const el = document.querySelector(sel);
              if (el?.textContent) {
                const priceText = el.textContent.replace(/[^0-9.,]/g, '').replace(',', '');
                const p = parseFloat(priceText);
                if (p > 0) return p;
              }
            }
            return 0;
          };

          const getStock = () => {
            const unavailableSpan = document.querySelector('.primary-availability-message, .a-color-price.primary-availability-message');
            if (unavailableSpan) {
              const text = unavailableSpan.textContent?.toLowerCase() || '';
              if (text.includes('currently unavailable') || text.includes('unavailable')) {
                return { inStock: false, stockLevel: 'out_of_stock' };
              }
            }
            const stockSelectors = ['#availability', '#availability span', '#availability_feature_div', '.a-declarative[data-action="show-all-offers-display"]', '#outOfStock', '#buybox-see-all-buying-choices', '.a-color-price'];
            let availabilityText = '';
            for (const sel of stockSelectors) {
              const elements = document.querySelectorAll(sel);
              elements.forEach(el => { if (el?.textContent) availabilityText += ' ' + el.textContent.toLowerCase(); });
            }
            const outOfStockPhrases = ['currently unavailable', 'out of stock', 'unavailable', "doesn't ship", 'not available', 'no sellers', 'see all buying options', 'sign up to be notified', "we don't know when", 'item is no longer available', 'this item cannot be shipped', 'temporarily out of stock'];
            for (const phrase of outOfStockPhrases) {
              if (availabilityText.includes(phrase)) return { inStock: false, stockLevel: 'out_of_stock' };
            }
            if (availabilityText.includes('only') && availabilityText.includes('left')) {
              return { inStock: true, stockLevel: 'low_stock' };
            }
            const addToCartBtn = document.querySelector('#add-to-cart-button');
            if (!addToCartBtn) return { inStock: false, stockLevel: 'out_of_stock' };
            if (availabilityText.includes('in stock')) return { inStock: true, stockLevel: 'in_stock' };
            return { inStock: true, stockLevel: 'in_stock' };
          };

          const getTitle = () => document.querySelector('#productTitle')?.textContent?.trim() || '';

          // Check if page exists first
          if (isPageNotFound()) {
            chrome.runtime.sendMessage({
              type: 'AMAZON_SCRAPE_RESULT',
              payload: { tabId: tid, data: { asin: '', price: 0, inStock: false, stockLevel: 'page_not_found', title: '' } },
              timestamp: Date.now()
            });
            return;
          }

          // Run variant detection
          const variantResult = detectVariants();
          
          const price = getPrice();
          const stockResult = getStock();
          const title = getTitle();
          const asin = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || '';

          // For variant products, use variant-specific stock
          const finalInStock = variantResult.isVariantProduct ? variantResult.stockOfCurrentVariant : stockResult.inStock;
          const finalStockLevel = variantResult.isVariantProduct && !variantResult.stockOfCurrentVariant ? 'out_of_stock' : stockResult.stockLevel;

          chrome.runtime.sendMessage({
            type: 'AMAZON_SCRAPE_RESULT',
            payload: { 
              tabId: tid, 
              data: { 
                asin, 
                price, 
                inStock: finalInStock, 
                stockLevel: finalStockLevel, 
                title,
                // Variant fields
                isVariantProduct: variantResult.isVariantProduct,
                isParentAsin: variantResult.isParentAsin,
                currentChildAsin: variantResult.currentChildAsin,
                selectedVariantLabel: variantResult.selectedVariantLabel,
                matchedChildAsin: variantResult.matchedVariantAsin,
                matchedChildUrl: variantResult.matchedVariantAsin ? `https://www.amazon.com/dp/${variantResult.matchedVariantAsin}?th=1&psc=1` : '',
                variantStockStatus: variantResult.stockOfCurrentVariant,
                allVariants: variantResult.allVariants,
                variantDimensions: variantResult.variantDimensions
              } 
            },
            timestamp: Date.now()
          });
        },
        args: [tabId]
      });
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

// ==================== FINANCE RECONCILIATION SCAN ====================

interface FinanceScanState {
  isRunning: boolean;
  isPaused: boolean;
  runId: string | null;
  currentTabId: number | null;
  startUrl: string | null;
  pagesScanned: number;
  ordersFound: number;
}

const financeScanState: FinanceScanState = {
  isRunning: false,
  isPaused: false,
  runId: null,
  currentTabId: null,
  startUrl: null,
  pagesScanned: 0,
  ordersFound: 0
};

async function startFinanceScan(runId: string, startUrl: string): Promise<void> {
  console.log('💼 Starting finance scan:', { runId, startUrl });
  
  financeScanState.isRunning = true;
  financeScanState.isPaused = false;
  financeScanState.runId = runId;
  financeScanState.startUrl = startUrl;
  financeScanState.pagesScanned = 0;
  financeScanState.ordersFound = 0;
  
  // Open the eBay sold page in a new tab
  const tab = await chrome.tabs.create({ url: startUrl, active: true });
  financeScanState.currentTabId = tab.id || null;
  
  console.log('💼 Opened eBay sold page, tab ID:', tab.id);
  
  // Wait for page to load, then start extraction
  // The content script will handle the extraction
}

async function handleFinanceScanPageReady(tabId: number): Promise<void> {
  if (!financeScanState.isRunning || financeScanState.isPaused) {
    console.log('💼 Scan not running or paused, ignoring page ready');
    return;
  }
  
  if (tabId !== financeScanState.currentTabId) {
    console.log('💼 Wrong tab, ignoring');
    return;
  }
  
  console.log('💼 Page ready, extracting orders...');
  
  // Wait a bit for page to fully render
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    // Send extraction request to content script
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_EBAY_SOLD_LIST' });
    
    if (response?.success && response.orders) {
      console.log(`💼 Extracted ${response.orders.length} orders from page`);
      
      financeScanState.ordersFound += response.orders.length;
      financeScanState.pagesScanned++;
      
      // Save orders to storage
      const existingRun = await chrome.storage.local.get(['financeReconciliationRun']);
      if (existingRun.financeReconciliationRun) {
        const run = existingRun.financeReconciliationRun;
        run.orders = [...(run.orders || []), ...response.orders];
        run.progress.pagesScanned = financeScanState.pagesScanned;
        run.progress.ebayOrdersFound = financeScanState.ordersFound;
        
        await chrome.storage.local.set({ financeReconciliationRun: run });
        
        // Notify UI to update
        chrome.runtime.sendMessage({
          type: 'FINANCE_SCAN_UPDATE',
          progress: run.progress,
          newOrders: response.orders.length
        }).catch(() => {});
      }
      
      // Check for next page
      if (response.nextPageUrl && !financeScanState.isPaused) {
        console.log('💼 Going to next page:', response.nextPageUrl);
        await new Promise(r => setTimeout(r, 1500)); // Delay between pages
        await chrome.tabs.update(tabId, { url: response.nextPageUrl });
      } else {
        console.log('💼 No more pages or scan paused, completing scan');
        await completeFinanceScan();
      }
    } else {
      console.warn('💼 Extraction failed or no orders:', response);
      await completeFinanceScan();
    }
  } catch (err) {
    console.error('💼 Error during extraction:', err);
    // Try to inject content script and retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['assets/finance-ebay-scanner.ts.js']
      });
      await new Promise(r => setTimeout(r, 500));
      // Retry extraction
      await handleFinanceScanPageReady(tabId);
    } catch {
      await completeFinanceScan();
    }
  }
}

async function completeFinanceScan(): Promise<void> {
  console.log('💼 Completing finance scan');
  
  const existingRun = await chrome.storage.local.get(['financeReconciliationRun']);
  if (existingRun.financeReconciliationRun) {
    const run = existingRun.financeReconciliationRun;
    run.progress.currentPhase = 'completed';
    run.endedAt = Date.now();
    await chrome.storage.local.set({ financeReconciliationRun: run });
  }
  
  financeScanState.isRunning = false;
  financeScanState.isPaused = false;
  financeScanState.runId = null;
  
  // Notify UI
  chrome.runtime.sendMessage({
    type: 'FINANCE_SCAN_COMPLETE',
    pagesScanned: financeScanState.pagesScanned,
    ordersFound: financeScanState.ordersFound
  }).catch(() => {});
}

function pauseFinanceScan(): void {
  console.log('💼 Pausing finance scan');
  financeScanState.isPaused = true;
}

function resumeFinanceScan(): void {
  console.log('💼 Resuming finance scan');
  financeScanState.isPaused = false;
  
  // Trigger extraction on current tab
  if (financeScanState.currentTabId) {
    handleFinanceScanPageReady(financeScanState.currentTabId);
  }
}

function stopFinanceScan(): void {
  console.log('💼 Stopping finance scan');
  financeScanState.isRunning = false;
  financeScanState.isPaused = false;
  financeScanState.runId = null;
  
  // Close the scan tab
  if (financeScanState.currentTabId) {
    chrome.tabs.remove(financeScanState.currentTabId).catch(() => {});
    financeScanState.currentTabId = null;
  }
}

// Tab update listener - handles page navigation during scan
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Original eBay order handling
    if (tab.url.includes('ebay.com/ord') || tab.url.includes('ebay.com/sh/ord')) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'PAGE_READY' });
      } catch {}
    }
    
    // Finance scan - check if this is our scan tab
    if (financeScanState.isRunning && tabId === financeScanState.currentTabId) {
      if (tab.url.includes('ebay.com/mys/sold') || tab.url.includes('ebay.com/sh/ord')) {
        console.log('💼 Finance scan tab loaded:', tab.url);
        await handleFinanceScanPageReady(tabId);
      }
    }
  }
});
