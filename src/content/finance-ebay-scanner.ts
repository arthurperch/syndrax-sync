/**
 * Finance Reconciliation - eBay Sold Page Scanner
 * 
 * Extracts sold orders from: https://www.ebay.com/mys/sold
 * SAFETY: READ-ONLY - Only extracts data, no clicks on destructive buttons
 */

import type { EbaySoldOrder } from '../features/finance-reconciliation/types';

// ==================== EXTRACTION ====================

function extractSoldOrdersFromPage(): EbaySoldOrder[] {
  const orders: EbaySoldOrder[] = [];
  
  console.log('🔍 Scanning eBay sold page for orders...');
  
  // Find all order cards on the page
  // eBay uses various class patterns for sold items
  const orderCards = document.querySelectorAll(
    '.sold-item, .m-order-card, [class*="order-item"], .sh-revison-card, .soldItemContainer'
  );
  
  console.log(`📦 Found ${orderCards.length} potential order cards`);
  
  // If no cards found with specific classes, try general approach
  if (orderCards.length === 0) {
    // Look for order info patterns in text
    extractOrdersFromGenericPage(orders);
  } else {
    orderCards.forEach((card, index) => {
      try {
        const order = extractOrderFromCard(card, index);
        if (order) {
          orders.push(order);
        }
      } catch (err) {
        console.warn(`Failed to extract order ${index}:`, err);
      }
    });
  }
  
  // Also try extracting from different page structures
  if (orders.length === 0) {
    extractOrdersFromListView(orders);
  }
  
  console.log(`✅ Extracted ${orders.length} orders from page`);
  return orders;
}

function extractOrderFromCard(card: Element, index: number): EbaySoldOrder | null {
  const text = card.textContent || '';
  
  // Extract order ID from various patterns
  const orderIdMatch = text.match(/Order ID[:\s]*(\d{2}-\d{5}-\d{5})/i) ||
                       text.match(/(\d{2}-\d{5}-\d{5})/) ||
                       text.match(/Order[:\s#]*(\d+)/i);
  
  // Extract item ID
  const itemIdMatch = text.match(/Item ID[:\s]*(\d{10,14})/i) ||
                      text.match(/Item[:\s#]*(\d{10,14})/i);
  
  // Extract from href if available
  const itemLink = card.querySelector('a[href*="/itm/"]') as HTMLAnchorElement;
  const itemUrl = itemLink?.href;
  const itemIdFromUrl = itemUrl?.match(/\/itm\/(\d+)/)?.[1];
  
  // Extract title
  const titleEl = card.querySelector('.item-title, .sh-listing-title, [class*="title"] a, a[href*="/itm/"]');
  const title = titleEl?.textContent?.trim();
  
  // Extract SKU/custom label
  const skuMatch = text.match(/Custom label[:\s]*([^\n\r]+)/i) ||
                   text.match(/SKU[:\s]*([^\n\r]+)/i);
  
  // Extract sold date
  const dateMatch = text.match(/(Sold|Paid)\s+on\s+(\w+\s+\d+,?\s*\d*)/i) ||
                    text.match(/(\w+\s+\d+,?\s*\d{4})/);
  
  // Look for payment details link
  const paymentLink = card.querySelector('a[href*="transactiondetails"], a[href*="mes/"]') as HTMLAnchorElement;
  const paymentUrl = paymentLink?.href;
  
  // Look for order details link
  const orderDetailsLink = card.querySelector('a[href*="mesh/ord/details"]') as HTMLAnchorElement;
  const orderDetailsUrl = orderDetailsLink?.href;
  
  // Only create order if we have some identifying info
  if (!title && !orderIdMatch && !itemIdFromUrl && !itemIdMatch) {
    return null;
  }
  
  const orderId = orderIdMatch?.[1];
  const itemId = itemIdFromUrl || itemIdMatch?.[1];
  
  const order: EbaySoldOrder = {
    id: `ebay-${orderId || itemId || index}-${Date.now()}`,
    orderId: orderId,
    itemId: itemId,
    sku: skuMatch?.[1]?.trim(),
    ebayTitle: title,
    ebayItemUrl: itemUrl,
    orderDetailsUrl: orderDetailsUrl,
    paymentDetailsUrl: paymentUrl,
    soldDate: dateMatch?.[2] || dateMatch?.[1],
    scanSourceUrl: window.location.href,
    status: 'ebay_found',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    raw: {
      ebayListSnippet: card.innerHTML.substring(0, 1000)
    }
  };
  
  // If we found a payment URL, construct one if missing
  if (!order.paymentDetailsUrl && orderId) {
    order.paymentDetailsUrl = `https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${orderId}`;
  }
  
  console.log(`📦 Order ${index}: ID=${orderId}, Item=${itemId}, Title="${title?.substring(0, 30)}..."`);
  
  return order;
}

function extractOrdersFromGenericPage(orders: EbaySoldOrder[]): void {
  // Scan entire page for order patterns
  const pageText = document.body.innerText;
  
  // Find all order ID patterns
  const orderIds = pageText.match(/\d{2}-\d{5}-\d{5}/g) || [];
  const uniqueOrderIds = [...new Set(orderIds)];
  
  console.log(`📋 Found ${uniqueOrderIds.length} unique order IDs via text scan`);
  
  uniqueOrderIds.forEach((orderId, index) => {
    orders.push({
      id: `ebay-${orderId}-${Date.now()}`,
      orderId: orderId,
      paymentDetailsUrl: `https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${orderId}`,
      scanSourceUrl: window.location.href,
      status: 'ebay_found',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

function extractOrdersFromListView(orders: EbaySoldOrder[]): void {
  // Look for specific eBay sold list structure
  // The newer eBay UI uses different patterns
  
  // Find all links that contain order-related URLs
  const allLinks = document.querySelectorAll('a[href]');
  const processedOrderIds = new Set<string>();
  
  allLinks.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    
    // Payment details link
    if (href.includes('transactiondetails') || href.includes('mes/transactiondetails')) {
      const orderIdMatch = href.match(/ordid=([^&]+)/);
      if (orderIdMatch && !processedOrderIds.has(orderIdMatch[1])) {
        processedOrderIds.add(orderIdMatch[1]);
        
        // Try to find title near this link
        const parentCard = link.closest('.sold-item, .m-order-card, [class*="order"]');
        const titleEl = parentCard?.querySelector('[class*="title"]') || 
                       link.parentElement?.parentElement?.querySelector('[class*="title"]');
        
        orders.push({
          id: `ebay-${orderIdMatch[1]}-${Date.now()}`,
          orderId: orderIdMatch[1],
          ebayTitle: titleEl?.textContent?.trim(),
          paymentDetailsUrl: href,
          scanSourceUrl: window.location.href,
          status: 'ebay_found',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    
    // Order details link
    if (href.includes('mesh/ord/details')) {
      const orderIdMatch = href.match(/orderid=([^&]+)/);
      if (orderIdMatch && !processedOrderIds.has(orderIdMatch[1])) {
        processedOrderIds.add(orderIdMatch[1]);
        
        orders.push({
          id: `ebay-${orderIdMatch[1]}-${Date.now()}`,
          orderId: orderIdMatch[1],
          orderDetailsUrl: href,
          paymentDetailsUrl: `https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${orderIdMatch[1]}`,
          scanSourceUrl: window.location.href,
          status: 'ebay_found',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  });
  
  console.log(`📋 Found ${orders.length} orders via link scan`);
}

// ==================== PAGINATION ====================

function getNextPageUrl(): string | null {
  // Look for next page button with data-url (eBay's new pagination style)
  const nextBtn = document.querySelector('button.pagination__next[data-url]') as HTMLButtonElement;
  if (nextBtn && !nextBtn.hasAttribute('aria-disabled')) {
    const dataUrl = nextBtn.getAttribute('data-url');
    if (dataUrl) {
      // data-url contains relative params, build full URL
      const baseUrl = window.location.origin + window.location.pathname;
      const nextUrl = baseUrl.replace('/rf/', '/rf/') + (dataUrl.startsWith('?') ? dataUrl : '?' + dataUrl);
      console.log(`📄 Found next page via data-url: ${nextUrl}`);
      return nextUrl;
    }
  }
  
  // Fallback: Look for next page button/link
  const nextSelectors = [
    'a[aria-label*="Next"]',
    'a[title*="Next"]',
    '.pagination__next a',
    '.pagination a[rel="next"]',
    'a.pagination__item--next'
  ];
  
  for (const sel of nextSelectors) {
    const el = document.querySelector(sel) as HTMLAnchorElement;
    if (el?.href) {
      console.log(`📄 Found next page: ${el.href}`);
      return el.href;
    }
  }
  
  // Check page info from pagination heading
  const pageInfo = document.querySelector('.pagination h2')?.textContent;
  if (pageInfo) {
    const match = pageInfo.match(/Page (\d+) of (\d+)/i);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      console.log(`📄 Page ${current} of ${total}`);
      if (current < total) {
        // Build next page URL with offset
        const url = new URL(window.location.href);
        const offset = current * 25; // 25 items per page
        url.searchParams.set('offset', String(offset));
        console.log(`📄 Next page URL: ${url.href}`);
        return url.href;
      }
    }
  }
  
  console.log('📄 No next page found');
  return null;
}

function hasMorePages(): boolean {
  return getNextPageUrl() !== null;
}

function goToNextPage(): void {
  const nextUrl = getNextPageUrl();
  if (nextUrl) {
    addLog(`Going to next page...`, 'info');
    window.location.href = nextUrl;
  }
}

// ==================== SCANNER UI ====================

function createScannerUI(): void {
  if (document.getElementById('earnings-scanner-ui')) return;
  
  const container = document.createElement('div');
  container.id = 'earnings-scanner-ui';
  container.innerHTML = `
    <style>
      #earnings-scanner-ui {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 380px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white;
        overflow: hidden;
      }
      .es-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .es-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .es-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
      }
      .es-body { padding: 16px; }
      .es-stats {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      .es-stat {
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px;
        text-align: center;
      }
      .es-stat-val { font-size: 20px; font-weight: 700; color: #4ade80; }
      .es-stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
      .es-progress {
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
        height: 6px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .es-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4ade80, #22d3ee);
        width: 0%;
        transition: width 0.3s;
      }
      .es-status { font-size: 12px; color: #94a3b8; margin-bottom: 12px; min-height: 18px; }
      .es-btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 8px;
        transition: all 0.2s;
      }
      .es-btn-primary {
        background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
        color: #0f172a;
      }
      .es-btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
      }
      .es-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .es-btn-secondary {
        background: rgba(255,255,255,0.1);
        color: white;
      }
      .es-log {
        background: rgba(0,0,0,0.3);
        border-radius: 8px;
        padding: 10px;
        max-height: 150px;
        overflow-y: auto;
        font-size: 10px;
        font-family: monospace;
      }
      .es-log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .es-log-success { color: #4ade80; }
      .es-log-error { color: #f87171; }
      .es-log-info { color: #60a5fa; }
    </style>
    
    <div class="es-header">
      <h3>💰 eBay Earnings Scanner</h3>
      <button class="es-close" id="es-close">×</button>
    </div>
    
    <div class="es-body">
      <div class="es-stats">
        <div class="es-stat">
          <div class="es-stat-val" id="es-found">0</div>
          <div class="es-stat-label">Found</div>
        </div>
        <div class="es-stat">
          <div class="es-stat-val" id="es-processed">0</div>
          <div class="es-stat-label">Processed</div>
        </div>
        <div class="es-stat">
          <div class="es-stat-val" id="es-total">$0</div>
          <div class="es-stat-label">Earnings</div>
        </div>
      </div>
      
      <div class="es-progress">
        <div class="es-progress-bar" id="es-progress"></div>
      </div>
      
      <div class="es-status" id="es-status">Ready. Click "Start Scan" to begin.</div>
      
      <button class="es-btn es-btn-primary" id="es-start">🚀 Start Earnings Scan</button>
      <button class="es-btn es-btn-secondary" id="es-view">📋 View Inventory</button>
      
      <div class="es-log" id="es-log">
        <div class="es-log-entry es-log-info">Scanner ready.</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Event listeners
  document.getElementById('es-close')?.addEventListener('click', () => container.remove());
  document.getElementById('es-start')?.addEventListener('click', startBatchScan);
  document.getElementById('es-view')?.addEventListener('click', viewInventory);
}

function addLog(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const log = document.getElementById('es-log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `es-log-entry es-log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.insertBefore(entry, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild!);
}

function updateUI(updates: { found?: number; processed?: number; total?: string; status?: string; progress?: number }): void {
  if (updates.found !== undefined) {
    const el = document.getElementById('es-found');
    if (el) el.textContent = String(updates.found);
  }
  if (updates.processed !== undefined) {
    const el = document.getElementById('es-processed');
    if (el) el.textContent = String(updates.processed);
  }
  if (updates.total !== undefined) {
    const el = document.getElementById('es-total');
    if (el) el.textContent = updates.total;
  }
  if (updates.status !== undefined) {
    const el = document.getElementById('es-status');
    if (el) el.textContent = updates.status;
  }
  if (updates.progress !== undefined) {
    const el = document.getElementById('es-progress') as HTMLElement;
    if (el) el.style.width = `${updates.progress}%`;
  }
}

// ==================== BATCH SCAN ====================

async function startBatchScan(): Promise<void> {
  const btn = document.getElementById('es-start') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Scanning...';
  }
  
  addLog('Extracting orders from page...', 'info');
  updateUI({ status: 'Extracting orders...' });
  
  // Extract orders
  const orders = extractSoldOrdersFromPage();
  
  if (orders.length === 0) {
    addLog('No orders found on page', 'error');
    updateUI({ status: 'No orders found' });
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Start Earnings Scan';
    }
    return;
  }
  
  addLog(`Found ${orders.length} orders`, 'success');
  updateUI({ found: orders.length, status: `Opening ${orders.length} payment pages...` });
  
  // Build payment URLs for each order
  const ordersWithUrls = orders.map(order => ({
    ...order,
    paymentUrl: order.paymentDetailsUrl || `https://www.ebay.com/mesh/pmt/details?orderId=${order.orderId}`
  }));
  
  console.log('📤 Sending orders to background:', ordersWithUrls);
  
  // Send to background for batch processing
  chrome.runtime.sendMessage({
    type: 'START_EARNINGS_BATCH_SCAN',
    payload: { orders: ordersWithUrls, batchSize: 5 },
    timestamp: Date.now()
  }).then((response: any) => {
    console.log('📥 Response:', response);
    if (response?.success) {
      addLog('Batch scan started', 'success');
    } else {
      addLog(`Error: ${response?.error}`, 'error');
    }
  }).catch((err: Error) => {
    addLog(`Error: ${err.message}`, 'error');
  });
}

async function viewInventory(): Promise<void> {
  const data = await chrome.storage.local.get('soldInventory');
  const inventory = data.soldInventory || [];
  
  let totalEarnings = 0;
  inventory.forEach((item: any) => {
    if (item.orderEarnings) {
      const match = item.orderEarnings.match(/[\d,.]+/);
      if (match) totalEarnings += parseFloat(match[0].replace(',', ''));
    }
  });
  
  const modal = document.createElement('div');
  modal.id = 'es-inventory-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); z-index: 9999999;
    display: flex; align-items: center; justify-content: center;
  `;
  modal.innerHTML = `
    <div style="background: #1a1a2e; border-radius: 16px; width: 90%; max-width: 1000px; max-height: 80vh; overflow: auto; color: white; font-family: sans-serif;">
      <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 16px 20px; display: flex; justify-content: space-between;">
        <h2 style="margin: 0;">📋 Sold Inventory (${inventory.length} items) - $${totalEarnings.toFixed(2)} Total</h2>
        <button id="es-close-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Close</button>
      </div>
      <div style="padding: 20px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; color: white; font-size: 12px;">
          <thead>
            <tr style="background: rgba(255,255,255,0.1);">
              <th style="padding: 10px; text-align: left;">Order ID</th>
              <th style="padding: 10px; text-align: left;">Title</th>
              <th style="padding: 10px; text-align: right;">Earnings</th>
              <th style="padding: 10px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${inventory.length === 0 ? 
              '<tr><td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8;">No items yet. Run an earnings scan!</td></tr>' :
              inventory.map((item: any) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <td style="padding: 10px; font-family: monospace;">${item.orderId || '—'}</td>
                  <td style="padding: 10px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.itemTitle || '—'}</td>
                  <td style="padding: 10px; text-align: right; color: #4ade80; font-weight: bold;">${item.orderEarnings || '—'}</td>
                  <td style="padding: 10px; text-align: center;"><span style="background: #4ade80; color: black; padding: 2px 8px; border-radius: 10px; font-size: 10px;">${item.status || 'pending'}</span></td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('es-close-modal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ==================== MESSAGE HANDLER FOR PROGRESS ====================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('📨 Finance scanner received message:', msg.type);
  
  if (msg.type === 'FINANCE_PAGE_READY') {
    console.log('💼 Received FINANCE_PAGE_READY - starting scan');
    // Trigger the scan automatically
    setTimeout(() => {
      startBatchScan();
    }, 500);
    sendResponse({ success: true });
    return true;
  }
  
  if (msg.type === 'EXTRACT_EBAY_SOLD_LIST') {
    try {
      const orders = extractSoldOrdersFromPage();
      const nextPageUrl = getNextPageUrl();
      
      sendResponse({
        success: true,
        orders: orders,
        nextPageUrl: nextPageUrl,
        currentUrl: window.location.href,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('❌ Extraction failed:', err);
      sendResponse({
        success: false,
        error: String(err),
        currentUrl: window.location.href
      });
    }
    return true;
  }
  
  if (msg.type === 'EARNINGS_SCAN_PROGRESS') {
    updateUI({
      processed: msg.processed,
      progress: (msg.processed / msg.total) * 100,
      status: `Processing ${msg.processed}/${msg.total}...`
    });
    addLog(`${msg.orderId} → ${msg.earnings || 'extracting...'}`, msg.earnings ? 'success' : 'info');
    return false;
  }
  
  if (msg.type === 'EARNINGS_SCAN_COMPLETE') {
    updateUI({
      processed: msg.total,
      progress: 100,
      status: 'Scan complete!'
    });
    addLog(`✅ Scan complete! ${msg.total} orders processed.`, 'success');
    
    const btn = document.getElementById('es-start') as HTMLButtonElement;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Start Earnings Scan';
    }
    
    // Update total earnings
    chrome.storage.local.get('soldInventory').then((data) => {
      const inventory = data.soldInventory || [];
      let total = 0;
      inventory.forEach((item: any) => {
        if (item.orderEarnings) {
          const match = item.orderEarnings.match(/[\d,.]+/);
          if (match) total += parseFloat(match[0].replace(',', ''));
        }
      });
      updateUI({ total: `$${total.toFixed(2)}` });
    });
    
    return false;
  }
  
  if (msg.type === 'PING') {
    sendResponse({ success: true, scriptLoaded: true });
    return true;
  }
  
  return false;
});

// ==================== AUTO-INIT ====================

console.log('💰 Finance eBay Scanner V2 loaded on:', window.location.href);

// If this is a sold page, show the scanner UI
if (window.location.href.includes('/mys/sold') || window.location.href.includes('/sh/ord/')) {
  console.log('📋 On eBay sold page - showing scanner UI');
  
  // Wait for page to load
  setTimeout(() => {
    createScannerUI();
    addLog('Scanner ready. Click Start to scan this page.', 'info');
    
    // Load existing inventory
    chrome.storage.local.get('soldInventory').then((data) => {
      const inventory = data.soldInventory || [];
      if (inventory.length > 0) {
        let total = 0;
        inventory.forEach((item: any) => {
          if (item.orderEarnings) {
            const match = item.orderEarnings.match(/[\d,.]+/);
            if (match) total += parseFloat(match[0].replace(',', ''));
          }
        });
        updateUI({ total: `$${total.toFixed(2)}` });
        addLog(`Loaded ${inventory.length} items from storage`, 'info');
      }
    });
  }, 1500);
  
  // Notify background
  chrome.runtime.sendMessage({
    type: 'FINANCE_SCANNER_READY',
    url: window.location.href
  }).catch(() => {});
}
