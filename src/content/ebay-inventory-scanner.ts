// eBay Inventory Scanner - Injected into https://www.ebay.com/sh/lst/active
// Uses CONFIRMED REAL selectors from actual eBay Seller Hub HTML

interface InventoryItem {
  listingId: string;
  title: string;
  ebayPrice: number;
  quantity: number;
  customLabel: string;        // Raw base64 SKU from eBay
  asin: string;               // Decoded ASIN
  sourceUrl: string;          // https://www.amazon.com/dp/{ASIN}
  sourcePlatform: 'amazon' | 'aliexpress' | 'unknown';
  imageUrl: string;
  listingUrl: string;
  lastScanned: string;
  supplierPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
}

// CONFIRMED: SKUs are base64 encoded ASINs
// QjA4OVhWU1pNWQ== → atob() → B089XVSZMY → https://www.amazon.com/dp/B089XVSZMY
function decodeCustomLabel(label: string): { asin: string; sourceUrl: string; platform: string } {
  if (!label) return { asin: '', sourceUrl: '', platform: 'unknown' };
  
  const trimmed = label.trim();
  
  // Try base64 decode first — confirmed working on this account
  try {
    const decoded = atob(trimmed);
    // ASIN pattern: 10 alphanumeric characters
    if (/^[A-Z0-9]{10}$/i.test(decoded)) {
      return {
        asin: decoded.toUpperCase(),
        sourceUrl: `https://www.amazon.com/dp/${decoded.toUpperCase()}`,
        platform: 'amazon'
      };
    }
  } catch {
    // Not valid base64
  }
  
  // Try raw value as ASIN
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return {
      asin: trimmed.toUpperCase(),
      sourceUrl: `https://www.amazon.com/dp/${trimmed.toUpperCase()}`,
      platform: 'amazon'
    };
  }
  
  // Extract ASIN pattern from longer string
  const asinMatch = trimmed.match(/\b([A-Z0-9]{10})\b/i);
  if (asinMatch) {
    return {
      asin: asinMatch[1].toUpperCase(),
      sourceUrl: `https://www.amazon.com/dp/${asinMatch[1].toUpperCase()}`,
      platform: 'amazon'
    };
  }
  
  // AliExpress numeric ID (8+ digits)
  if (/^\d{8,}$/.test(trimmed)) {
    return {
      asin: '',
      sourceUrl: `https://www.aliexpress.com/item/${trimmed}.html`,
      platform: 'aliexpress'
    };
  }
  
  return { asin: '', sourceUrl: '', platform: 'unknown' };
}

// CONFIRMED: Price text is like "$45.99Buy It Nowor Best OfferResearch prices"
// Extract just the first dollar amount
function extractPrice(priceText: string): number {
  const match = priceText.match(/\$([0-9,]+\.?[0-9]*)/);
  return match ? parseFloat(match[1].replace(',', '')) : 0;
}

function scanCurrentPage(): InventoryItem[] {
  // CONFIRMED SELECTOR: tr.grid-row
  const rows = document.querySelectorAll('tr.grid-row');
  const items: InventoryItem[] = [];

  console.log(`[Syndrax Sync] Found ${rows.length} listing rows on current page`);

  rows.forEach((row, index) => {
    try {
      // CONFIRMED: Item ID from data-id attribute
      const listingId = (row as HTMLElement).dataset.id || '';
      
      // CONFIRMED: Title from .shui-dt-column__title a
      const titleEl = row.querySelector('.shui-dt-column__title a');
      const title = titleEl?.textContent?.trim() || '';
      
      // CONFIRMED: Listing URL from .shui-dt-column__title a href
      const hrefRaw = titleEl?.getAttribute('href') || '';
      const listingUrl = hrefRaw.startsWith('http') 
        ? hrefRaw 
        : `https://www.ebay.com${hrefRaw}`;
      
      // CONFIRMED: Image from .shui-dt-column__title img
      const imageUrl = row.querySelector('.shui-dt-column__title img')
        ?.getAttribute('src') || '';
      
      // CONFIRMED: SKU from .shui-dt-column__listingSKU
      const customLabel = row.querySelector('.shui-dt-column__listingSKU')
        ?.textContent?.trim() || '';
      
      // CONFIRMED: Price from .shui-dt-column__price
      const priceText = row.querySelector('.shui-dt-column__price')
        ?.textContent?.trim() || '0';
      const ebayPrice = extractPrice(priceText);
      
      // CONFIRMED: Quantity from .shui-dt-column__availableQuantity
      const qtyText = row.querySelector('.shui-dt-column__availableQuantity')
        ?.textContent?.trim() || '0';
      const quantity = parseInt(qtyText) || 0;
      
      // Decode SKU to get Amazon ASIN
      const sourceInfo = decodeCustomLabel(customLabel);
      
      if (listingId && title) {
        items.push({
          listingId,
          title,
          ebayPrice,
          quantity,
          customLabel,
          asin: sourceInfo.asin,
          sourceUrl: sourceInfo.sourceUrl,
          sourcePlatform: sourceInfo.platform as 'amazon' | 'aliexpress' | 'unknown',
          imageUrl,
          listingUrl,
          lastScanned: new Date().toISOString(),
          supplierPrice: 0,
          inStock: true,
          stockLevel: 'in_stock'
        });
      }
    } catch (err) {
      console.error(`[Syndrax Sync] Error parsing row ${index}:`, err);
    }
  });

  return items;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveInventory(items: InventoryItem[]): Promise<void> {
  return new Promise<void>(resolve => {
    // Get existing inventory first to merge
    chrome.storage.local.get('syndrax_inventory', (result) => {
      const existing: Record<string, InventoryItem> = result.syndrax_inventory || {};
      
      items.forEach(item => {
        if (existing[item.listingId]) {
          // Keep supplier data from previous price checks
          existing[item.listingId] = {
            ...existing[item.listingId],
            title: item.title,
            ebayPrice: item.ebayPrice,
            quantity: item.quantity,
            customLabel: item.customLabel,
            asin: item.asin || existing[item.listingId].asin,
            sourceUrl: item.sourceUrl || existing[item.listingId].sourceUrl,
            sourcePlatform: item.sourcePlatform,
            imageUrl: item.imageUrl,
            listingUrl: item.listingUrl,
            lastScanned: item.lastScanned
          };
        } else {
          existing[item.listingId] = item;
        }
      });

      chrome.storage.local.set({
        syndrax_inventory: existing,
        syndrax_inventory_count: Object.keys(existing).length,
        syndrax_last_scan: new Date().toISOString()
      }, () => {
        console.log(`[Syndrax Sync] Saved ${Object.keys(existing).length} items to storage`);
        resolve();
      });
    });
  });
}

async function scanAllPages(): Promise<InventoryItem[]> {
  const allItems: InventoryItem[] = [];
  let pageNum = 1;

  console.log('[Syndrax Sync] Starting inventory scan...');

  while (true) {
    // Send progress to popup
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      payload: {
        page: pageNum,
        itemsFound: allItems.length
      },
      timestamp: Date.now()
    });

    // Wait for table to be present
    await sleep(1000);

    // Scan current page
    const pageItems = scanCurrentPage();
    allItems.push(...pageItems);

    console.log(`[Syndrax Sync] Page ${pageNum}: Found ${pageItems.length} items. Total: ${allItems.length}`);

    // CONFIRMED SELECTOR: a.pagination__next
    const nextBtn = document.querySelector('a.pagination__next') as HTMLAnchorElement;
    
    // If no next button or no href — we are on the last page
    if (!nextBtn || !nextBtn.href) {
      console.log('[Syndrax Sync] No more pages, scan complete');
      break;
    }

    // Click next page
    nextBtn.click();
    pageNum++;

    // Wait for new page to load
    await sleep(3000);
  }

  // Save to storage
  await saveInventory(allItems);

  // Notify popup scan is complete
  chrome.runtime.sendMessage({
    type: 'SCAN_COMPLETE',
    payload: {
      totalItems: allItems.length,
      items: allItems
    },
    timestamp: Date.now()
  });

  console.log(`[Syndrax Sync] Scan complete! ${allItems.length} total listings saved.`);

  return allItems;
}

// Listen for manual scan trigger from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCAN_INVENTORY' || message.type === 'START_SCAN') {
    scanAllPages().then(items => {
      sendResponse({ success: true, count: items.length });
    });
    return true; // Keep channel open for async response
  }
});

// Auto-detect if we're on the active listings page and should scan
async function init() {
  const url = window.location.href;
  
  // Only auto-start if on the correct page
  if (url.includes('ebay.com/sh/lst/active') || url.includes('ebay.com/sh/lst?')) {
    // Guard: don't run if listing creation is in progress
    const { pendingListing } = await chrome.storage.local.get('pendingListing');
    if (pendingListing) {
      console.log('[Syndrax Sync] Skipping auto-scan — listing creation in progress');
      return;
    }

    console.log('[Syndrax Sync] eBay Active Listings page detected');
    
    // Create floating panel to show we're ready
    const panel = document.createElement('div');
    panel.id = 'syndrax-scan-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3e 100%);
        border: 1px solid #00CFFF;
        border-radius: 8px;
        padding: 12px 16px;
        z-index: 999999;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 20px rgba(0,207,255,0.3);
      ">
        <div style="color: #00CFFF; font-size: 12px; font-weight: 600; margin-bottom: 6px;">
          ⚡ Syndrax Sync
        </div>
        <button id="syndrax-scan-btn" style="
          background: linear-gradient(135deg, #00CFFF 0%, #7A5CFF 50%, #FF00D4 100%);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
        ">
          🔍 Scan All Listings
        </button>
        <div id="syndrax-status" style="color: #888; font-size: 11px; margin-top: 6px;"></div>
      </div>
    `;
    document.body.appendChild(panel);
    
    // Add click handler
    document.getElementById('syndrax-scan-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('syndrax-status');
      const btn = document.getElementById('syndrax-scan-btn') as HTMLButtonElement;
      
      btn.disabled = true;
      btn.textContent = '⏳ Scanning...';
      
      if (statusEl) statusEl.textContent = 'Starting scan...';
      
      try {
        const items = await scanAllPages();
        if (statusEl) statusEl.textContent = `✓ Found ${items.length} listings!`;
        btn.textContent = '✓ Scan Complete';
      } catch (err) {
        if (statusEl) statusEl.textContent = `Error: ${err}`;
        btn.disabled = false;
        btn.textContent = '🔍 Retry Scan';
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
