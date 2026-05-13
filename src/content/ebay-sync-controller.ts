// eBay Sync Controller - Injected into https://www.ebay.com/sh/lst/active
// This script controls the entire sync process from the eBay page
// eBay page stays open as control hub, Amazon tabs open/close in background

import { discord } from '../services/discord-logger';
import { checkFingerprint, SCORES } from '../services/fingerprint';

// Track start time for duration calculation
let syncStartTime = 0;
let totalErrors = 0;
let totalItemsOnPage = 0;

interface ItemData {
  listingId: string;
  title: string;
  price: number;
  rawSku: string;
  asin: string;
  row: Element;
}

interface SyncStats {
  pageNum: number;
  totalChecked: number;
  totalUpdated: number;
  totalOutOfStock: number;
  totalFlagged: number;
  totalNoChange: number;
  totalRestocked: number;
}

const stats: SyncStats = {
  pageNum: 1,
  totalChecked: 0,
  totalUpdated: 0,
  totalOutOfStock: 0,
  totalFlagged: 0,
  totalNoChange: 0,
  totalRestocked: 0
};

let isRunning = false;
let shouldStop = false;

// State persistence for multi-page sync
interface SyncState {
  isRunning: boolean;
  pageNum: number;
  totalChecked: number;
  totalUpdated: number;
  totalOutOfStock: number;
  totalFlagged: number;
  totalNoChange: number;
  totalRestocked: number;
  startTime: number;
  logMessages: string[];
}

// Store log messages for persistence
let logMessages: string[] = [];

// Daily scan memory - tracks scanned items, resets each day
interface DailyScanMemory {
  date: string; // YYYY-MM-DD
  scannedListingIds: string[]; // Already processed listing IDs
  lastCompletedPage: number; // Last fully completed page
  totalScannedToday: number;
  totalUpdatedToday: number;
  totalOOSToday: number;
}

// Get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Load daily scan memory
async function loadDailyScanMemory(): Promise<DailyScanMemory> {
  const result = await chrome.storage.local.get('dailyScanMemory');
  const memory = result.dailyScanMemory as DailyScanMemory | undefined;
  
  // Check if memory exists and is from today
  if (memory && memory.date === getTodayString()) {
    console.log('[Sync] Loaded daily memory:', memory.scannedListingIds.length, 'items scanned today');
    return memory;
  }
  
  // Create fresh memory for today
  console.log('[Sync] Creating fresh daily memory');
  return {
    date: getTodayString(),
    scannedListingIds: [],
    lastCompletedPage: 0,
    totalScannedToday: 0,
    totalUpdatedToday: 0,
    totalOOSToday: 0
  };
}

// Save daily scan memory
async function saveDailyScanMemory(memory: DailyScanMemory): Promise<void> {
  await chrome.storage.local.set({ dailyScanMemory: memory });
}

// Mark items as scanned today
async function markItemsScanned(listingIds: string[]): Promise<void> {
  const memory = await loadDailyScanMemory();
  memory.scannedListingIds = [...new Set([...memory.scannedListingIds, ...listingIds])];
  memory.totalScannedToday = memory.scannedListingIds.length;
  await saveDailyScanMemory(memory);
}

// Check if item was already scanned today
async function wasScannedToday(listingId: string): Promise<boolean> {
  const memory = await loadDailyScanMemory();
  return memory.scannedListingIds.includes(listingId);
}

// Mark page as completed
async function markPageCompleted(pageNum: number): Promise<void> {
  const memory = await loadDailyScanMemory();
  if (pageNum > memory.lastCompletedPage) {
    memory.lastCompletedPage = pageNum;
    await saveDailyScanMemory(memory);
  }
}

// Get the starting page for resume
async function getResumeStartPage(): Promise<number> {
  const memory = await loadDailyScanMemory();
  // Start from the page after the last completed one
  return memory.lastCompletedPage + 1;
}

// Update daily totals
async function updateDailyTotals(updated: number, oos: number): Promise<void> {
  const memory = await loadDailyScanMemory();
  memory.totalUpdatedToday += updated;
  memory.totalOOSToday += oos;
  await saveDailyScanMemory(memory);
}

// Global daily memory reference
let dailyMemory: DailyScanMemory | null = null;

async function saveSyncState() {
  // Collect log messages from the panel
  const logEl = document.getElementById('syndrax-log');
  if (logEl) {
    logMessages = Array.from(logEl.children).slice(-30).map(el => el.textContent || '');
  }
  
  const state: SyncState = {
    isRunning: true,
    pageNum: stats.pageNum,
    totalChecked: stats.totalChecked,
    totalUpdated: stats.totalUpdated,
    totalOutOfStock: stats.totalOutOfStock,
    totalFlagged: stats.totalFlagged,
    totalNoChange: stats.totalNoChange,
    totalRestocked: stats.totalRestocked,
    startTime: Date.now(),
    logMessages: logMessages
  };
  await chrome.storage.local.set({ syncState: state });
  console.log('[Sync] Saved state before navigation:', state);
}

async function loadSyncState(): Promise<SyncState | null> {
  const result = await chrome.storage.local.get('syncState');
  return result.syncState || null;
}

async function clearSyncState() {
  await chrome.storage.local.remove('syncState');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for table rows to appear with timeout
async function waitForTableRows(maxWaitMs: number = 15000): Promise<Element[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const rows = Array.from(document.querySelectorAll('tr.grid-row[data-id]'));
    if (rows.length > 0) {
      console.log(`[Sync] Found ${rows.length} rows after ${Date.now() - startTime}ms`);
      return rows;
    }
    await sleep(500);
  }
  
  console.log('[Sync] Timeout waiting for rows');
  return [];
}

// Log to both console and panel
function logToPanel(text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const logEl = document.getElementById('syndrax-log');
  if (logEl) {
    const colors = {
      info: '#00CFFF',
      success: '#22c55e',
      error: '#ef4444',
      warn: '#FFD700'
    };
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.style.cssText = `
      font-size: 10px;
      color: ${colors[type]};
      margin-bottom: 2px;
      word-break: break-all;
    `;
    line.textContent = `[${time}] ${text}`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
    
    // Keep only last 50 lines
    while (logEl.children.length > 50) {
      logEl.removeChild(logEl.firstChild!);
    }
  }
  console.log(`[Sync ${type}]`, text);
}

// Update status in the floating panel
function updateStatus(text: string) {
  const statusEl = document.getElementById('syndrax-status');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.color = '#00CFFF';
  }
  
  // Update loading message
  const loadingMsg = document.getElementById('syndrax-loading-msg');
  if (loadingMsg) {
    loadingMsg.textContent = text;
  }
  
  logToPanel(text, 'info');
}

// Update progress bar (0-100)
function updateProgressBar(percent: number) {
  const bar = document.getElementById('syndrax-progress-bar');
  if (bar) {
    bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
}

// Decode base64 SKU to ASIN
function decodeSkuToAsin(rawSku: string): string {
  if (!rawSku) return '';
  
  // Try base64 decode
  try {
    const decoded = atob(rawSku.trim());
    if (/^[A-Z0-9]{10}$/i.test(decoded)) {
      return decoded.toUpperCase();
    }
  } catch {}
  
  // Try raw value
  if (/^[A-Z0-9]{10}$/i.test(rawSku.trim())) {
    return rawSku.trim().toUpperCase();
  }
  
  // Try to extract ASIN pattern
  const match = rawSku.match(/[A-Z0-9]{10}/i);
  if (match) return match[0].toUpperCase();
  
  return '';
}

// Extract data from a listing row
function extractRowData(row: Element): ItemData | null {
  const listingId = row.getAttribute('data-id') || '';
  if (!listingId) return null;
  
  // Title - look for the link text
  const titleEl = row.querySelector('.shui-dt-column__title a') ||
                  row.querySelector('.column-title__text a') ||
                  row.querySelector('[data-test-id="item-title"]');
  const title = titleEl?.textContent?.trim() || '';
  
  // Price - get the current price text
  const priceEl = row.querySelector('.shui-dt-column__price') ||
                  row.querySelector('.col-price__current');
  const priceText = priceEl?.textContent || '';
  const priceMatch = priceText.match(/\$([0-9,]+\.?[0-9]*)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;
  
  // SKU
  const skuEl = row.querySelector('.shui-dt-column__listingSKU') ||
                row.querySelector('[data-test-id="listing-sku"]');
  const rawSku = skuEl?.textContent?.trim() || '';
  
  const asin = decodeSkuToAsin(rawSku);
  
  console.log(`[Sync] Row ${listingId}: "${title.substring(0, 30)}..." Price: $${price} SKU: ${rawSku} ASIN: ${asin}`);
  
  return { listingId, title, price, rawSku, asin, row };
}

// Get current eBay quantity from the row
function getEbayQuantity(row: Element): number {
  // Look for quantity input or text in the Available column
  const qtyInput = row.querySelector('input[name*="availableQuantity"]') as HTMLInputElement;
  if (qtyInput) return parseInt(qtyInput.value) || 0;
  
  // Look for the quantity text in the Available column
  const qtyCell = row.querySelector('.shui-dt-column__availableQuantity');
  if (qtyCell) {
    const text = qtyCell.textContent?.trim() || '';
    const match = text.match(/\d+/);
    if (match) return parseInt(match[0]) || 0;
  }
  
  return 1; // Default to 1 if we can't find it
}

// Update price inline on the eBay page
async function updatePriceInline(row: Element, newPrice: number): Promise<boolean> {
  const rowEl = row as HTMLElement;
  
  // Find the edit price button
  const editBtn = rowEl.querySelector('button[aria-label="Edit Current price"]') as HTMLButtonElement ||
                  rowEl.querySelector('button[column="price"]') as HTMLButtonElement;
  
  if (!editBtn) {
    console.log('[Sync Debug] Edit price button not found');
    logToPanel(`  ❌ Edit price button not found`, 'error');
    return false;
  }
  
  // Click the edit button
  logToPanel(`  📝 Clicking Edit Price...`, 'info');
  editBtn.click();
  await sleep(1200);
  
  // Find the price input in the dialog
  let input: HTMLInputElement | null = null;
  
  const dialogs = document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');
  console.log('[Sync Debug] Found price dialogs:', dialogs.length);
  
  for (const dialog of dialogs) {
    const inp = dialog.querySelector('input[name*="price"]') as HTMLInputElement ||
                dialog.querySelector('input[aria-label*="price" i]') as HTMLInputElement ||
                dialog.querySelector('input.textbox__control') as HTMLInputElement;
    if (inp) {
      input = inp;
      console.log('[Sync Debug] Found price input:', inp.name || inp.className);
      break;
    }
  }
  
  if (!input) {
    input = document.querySelector('input[name*="price"]') as HTMLInputElement ||
            document.querySelector('input.textbox__control') as HTMLInputElement;
  }
  
  if (!input) {
    logToPanel(`  ❌ Price input not found`, 'error');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  // Set the price value
  const priceStr = newPrice.toFixed(2);
  logToPanel(`  ✏️ Setting price to $${priceStr}...`, 'info');
  
  input.focus();
  await sleep(100);
  input.select();
  await sleep(100);
  
  // Use execCommand on the focused input (not selectAll which selects entire page)
  input.setSelectionRange(0, input.value.length);
  document.execCommand('insertText', false, priceStr);
  
  await sleep(100);
  
  // Check if value was set
  if (input.value !== priceStr) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, priceStr);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  // Force set if still not set
  if (input.value !== priceStr) {
    input.value = priceStr;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  console.log('[Sync Debug] Price input value after setting:', input.value);
  
  await sleep(300);
  
  // Find and click Submit button
  logToPanel(`  💾 Submitting price...`, 'info');
  
  let submitBtn: HTMLButtonElement | null = null;
  
  // Search all buttons, find one with "Submit" text
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if (text === 'submit') {
      submitBtn = btn as HTMLButtonElement;
      console.log('[Sync Debug] Found price Submit button with text:', btn.className);
      break;
    }
  }
  
  // Fallback: Try various selectors
  if (!submitBtn) {
    submitBtn = document.querySelector('button.btn--primary[type="submit"]') as HTMLButtonElement ||
                document.querySelector('button[type="submit"].btn--primary') as HTMLButtonElement ||
                document.querySelector('.lightbox-dialog__main button[type="submit"]') as HTMLButtonElement ||
                document.querySelector('form button[type="submit"]') as HTMLButtonElement;
  }
  
  if (submitBtn) {
    console.log('[Sync Debug] Clicking price Submit button');
    
    // IMPORTANT: Prevent any form from submitting with page navigation
    const parentForm = submitBtn.closest('form');
    if (parentForm) {
      parentForm.addEventListener('submit', (e) => {
        e.preventDefault();
      }, { once: true });
    }
    
    submitBtn.focus();
    await sleep(100);
    
    // Use dispatchEvent instead of click()
    submitBtn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  } else {
    console.log('[Sync Debug] Price Submit button not found');
    logToPanel(`  ⚠️ Could not find Submit button for price`, 'warn');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  await sleep(1500);
  
  // Verify dialog closed
  const dialogStillOpen = document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])');
  if (dialogStillOpen) {
    logToPanel(`  ⚠️ Price dialog still open`, 'warn');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  logToPanel(`  ✅ Price updated to $${priceStr}!`, 'success');
  return true;
}

// Update quantity inline with detailed debugging
async function updateQuantityInline(row: Element, quantity: number): Promise<boolean> {
  const rowEl = row as HTMLElement;
  
  // Find the edit button
  const editBtn = rowEl.querySelector('button[aria-label="Edit Available quantity"]') as HTMLButtonElement;
  
  if (!editBtn) {
    // Check if item has variations (can't be edited inline)
    const hasVariations = rowEl.querySelector('[data-test-id="variation-count"]') ||
                          rowEl.textContent?.includes('variation');
    if (hasVariations) {
      logToPanel(`  ⚠️ Has variations - skip inline edit`, 'warn');
      return false;
    }
    logToPanel(`  ❌ Edit button not found`, 'error');
    return false;
  }
  
  // Check if button is disabled
  if (editBtn.disabled || editBtn.getAttribute('aria-disabled') === 'true') {
    logToPanel(`  ⚠️ Edit disabled - item may be locked`, 'warn');
    return false;
  }
  
  // Click the edit button
  logToPanel(`  📝 Clicking Edit...`, 'info');
  editBtn.click();
  await sleep(1200);
  
  // Find the input - be more specific about the modal
  let input: HTMLInputElement | null = null;
  
  // Try to find input in lightbox/dialog
  const dialogs = document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"], [class*="modal"]');
  console.log('[Sync Debug] Found dialogs:', dialogs.length);
  
  for (const dialog of dialogs) {
    const inp = dialog.querySelector('input[type="text"], input.textbox__control, input') as HTMLInputElement;
    if (inp) {
      input = inp;
      console.log('[Sync Debug] Found input in dialog:', inp.className);
      break;
    }
  }
  
  // Fallback: find any focused input or input with specific class
  if (!input) {
    input = document.querySelector('input.textbox__control:focus') as HTMLInputElement ||
            document.querySelector('input[aria-label*="quantity" i]') as HTMLInputElement ||
            document.querySelector('input.textbox__control') as HTMLInputElement;
  }
  
  if (!input) {
    logToPanel(`  ❌ Input not found`, 'error');
    // Press Escape to close
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  // Set the value
  logToPanel(`  ✏️ Setting to ${quantity}...`, 'info');
  input.focus();
  await sleep(100);
  
  // Select text in the input
  input.select();
  input.setSelectionRange(0, input.value.length);
  await sleep(100);
  
  // Method 1: Use insertText on the selected input
  document.execCommand('insertText', false, quantity.toString());
  
  await sleep(100);
  
  // Check if value was set
  if (input.value !== quantity.toString()) {
    // Method 2: Use native setter for React-controlled inputs
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, quantity.toString());
    }
    
    // Trigger all necessary events
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: quantity.toString(), inputType: 'insertText' }));
  }
  
  await sleep(100);
  
  // Check again and try keyboard simulation
  if (input.value !== quantity.toString()) {
    // Method 3: Simulate keyboard typing
    input.focus();
    input.select();
    
    // Clear with backspace
    for (let i = 0; i < 5; i++) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
    }
    
    // Type the number
    const char = quantity.toString();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Digit${char}`, keyCode: 48 + parseInt(char), bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: `Digit${char}`, keyCode: 48 + parseInt(char), bubbles: true }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Digit${char}`, keyCode: 48 + parseInt(char), bubbles: true }));
    
    // Force set value directly
    input.value = quantity.toString();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  console.log('[Sync Debug] Input value after setting:', input.value);
  
  await sleep(300);
  
  // Find and click Submit button directly
  logToPanel(`  💾 Finding Submit button...`, 'info');
  
  // Log all buttons in any open dialog for debugging
  const openDialogs = document.querySelectorAll('.lightbox-dialog, [role="dialog"], .quick-edit-modal');
  console.log('[Sync Debug] Open dialogs:', openDialogs.length);
  
  let submitBtn: HTMLButtonElement | null = null;
  
  // Search all buttons, find one with "Submit" text
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if (text === 'submit') {
      submitBtn = btn as HTMLButtonElement;
      console.log('[Sync Debug] Found button with text "Submit":', btn.className);
      break;
    }
  }
  
  // Fallback: Try various selectors
  if (!submitBtn) {
    submitBtn = document.querySelector('button.btn--primary[type="submit"]') as HTMLButtonElement ||
                document.querySelector('button[type="submit"].btn--primary') as HTMLButtonElement ||
                document.querySelector('.lightbox-dialog__main button[type="submit"]') as HTMLButtonElement ||
                document.querySelector('form button[type="submit"]') as HTMLButtonElement;
  }
  
  if (submitBtn) {
    console.log('[Sync Debug] Clicking Submit button:', submitBtn.outerHTML.substring(0, 100));
    
    // IMPORTANT: Prevent any form from submitting with page navigation
    const parentForm = submitBtn.closest('form');
    if (parentForm) {
      parentForm.addEventListener('submit', (e) => {
        e.preventDefault();
      }, { once: true });
    }
    
    submitBtn.focus();
    await sleep(100);
    
    // Use dispatchEvent instead of click() to have more control
    submitBtn.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    
    console.log('[Sync Debug] Clicked Submit button');
  } else {
    console.log('[Sync Debug] Submit button not found');
    logToPanel(`  ⚠️ Could not find Submit button`, 'warn');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  await sleep(1500);
  
  // Verify dialog closed
  const dialogStillOpen = document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])');
  if (dialogStillOpen) {
    logToPanel(`  ⚠️ Dialog still open - may need manual submit`, 'warn');
    // Press Escape to close
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }
  
  logToPanel(`  ✅ Updated!`, 'success');
  return true;
}

// Add visual badge to row showing what happened
function addRowBadge(row: Element, text: string, color: string) {
  const rowEl = row as HTMLElement;
  
  // Remove existing badge
  const existing = rowEl.querySelector('.syndrax-badge');
  if (existing) existing.remove();
  
  const badge = document.createElement('span');
  badge.className = 'syndrax-badge';
  badge.textContent = text;
  badge.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: ${color}22;
    border: 1px solid ${color};
    color: ${color};
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    z-index: 9999;
    white-space: nowrap;
  `;
  
  rowEl.style.position = 'relative';
  rowEl.appendChild(badge);
}

// Helper to send Discord webhook for fingerprint alerts
async function sendFingerprintWebhook(
  fp: { action: string; score: number; signals: string[]; reasons: string[] },
  item: { title: string; listingId: string; asin: string }
) {
  const WEBHOOK_ERRORS = 'https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-';
  
  const fields = [
    ...fp.reasons.map((reason, i) => ({
      name: `${fp.action === 'delist' ? '🔴' : '⚠️'} ${fp.signals[i]} (+${
        (SCORES as Record<string, number>)[fp.signals[i]] || 0
      } pts)`,
      value: reason,
      inline: false
    })),
    { name: '📊 Total Score', value: `${fp.score} pts`, inline: true },
    { name: '🏪 eBay', value: `[View Listing](https://www.ebay.com/itm/${item.listingId})`, inline: true },
    { name: '🛒 Amazon', value: `[View on Amazon](https://www.amazon.com/dp/${item.asin})`, inline: true },
    { name: '⚡ Action Taken', value: 'eBay quantity set to 0. Listing stays active but cannot receive orders. Review and manually reinstate when confirmed safe.', inline: false }
  ];

  try {
    await fetch(WEBHOOK_ERRORS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Syndrax Sync',
        avatar_url: 'https://syndrax.io/assets/images/logo.png',
        embeds: [{
          title: fp.action === 'delist'
            ? '🚨 CRITICAL — Product Changed — Quantity Set to 0'
            : '⚠️ WARNING — Suspicious Changes — Quantity Set to 0',
          description: `**${item.title.substring(0, 80)}**\nASIN: \`${item.asin}\` | Listing: \`${item.listingId}\``,
          color: fp.action === 'delist' ? 0xFF0000 : 0xFF8C00,
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'Syndrax Sync — Fingerprint Check' }
        }]
      })
    });
  } catch (err) {
    console.error('Fingerprint webhook failed:', err);
  }
}

// Process the result from Amazon check and update eBay
async function processResult(item: ItemData, amazonData: {
  action: string;
  amazonPrice?: number;
  amazonTitle?: string;
  newEbayPrice?: number;
  priceWentUp?: boolean;
  similarity?: number;
  // Fingerprint fields from Amazon scraper
  title?: string;
  brand?: string;
  imageUrl?: string;
  imageCount?: number;
  category?: string;
  dimensions?: string;
  weight?: string;
  reviewCount?: number;
  starRating?: number;
  bullets?: string[];
  finalAsin?: string;
}) {
  const rowEl = item.row as HTMLElement;
  const currentEbayQty = getEbayQuantity(item.row);
  const shortTitle = item.title.substring(0, 25);
  
  // ========== FINGERPRINT CHECK — runs before price/stock logic ==========
  // Only run fingerprint check if we have the required Amazon data
  if (amazonData.title && amazonData.brand !== undefined) {
    const fp = await checkFingerprint(
      { listingId: item.listingId, title: item.title, asin: item.asin },
      {
        title: amazonData.title || '',
        price: amazonData.amazonPrice || 0,
        brand: amazonData.brand || '',
        imageUrl: amazonData.imageUrl || '',
        imageCount: amazonData.imageCount || 0,
        category: amazonData.category || '',
        dimensions: amazonData.dimensions || '',
        weight: amazonData.weight || '',
        reviewCount: amazonData.reviewCount || 0,
        starRating: amazonData.starRating || 0,
        bullets: amazonData.bullets || [],
        finalAsin: amazonData.finalAsin || item.asin
      }
    );

    if (fp.action === 'delist' || fp.action === 'flag') {
      logToPanel(`🔍 Fingerprint: ${fp.action.toUpperCase()} (${fp.score}pts)`, fp.action === 'delist' ? 'error' : 'warn');
      
      // Set eBay quantity to 0 to prevent orders
      const qtyCell = rowEl.querySelector('.shui-dt-column__availableQuantity') as HTMLElement;
      if (qtyCell) {
        qtyCell.click();
        await sleep(500);
        const input = qtyCell.querySelector('input') as HTMLInputElement;
        if (input) {
          input.value = '0';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          await sleep(500);
        }
      }

      // Send Discord alert
      await sendFingerprintWebhook(fp, item);

      // Show badge on eBay row
      rowEl.style.outline = `2px solid ${fp.action === 'delist' ? '#FF0000' : '#FF8C00'}`;
      addRowBadge(
        rowEl,
        `${fp.action === 'delist' ? '🚨' : '⚠️'} ${fp.score}pts — Qty Set to 0`,
        fp.action === 'delist' ? '#FF0000' : '#FF8C00'
      );

      stats.totalFlagged++;
      stats.totalChecked++;
      updatePanelStats();
      
      // Stop here — do not run price or stock update for this item
      return;
    }

    // If baseline captured — show blue badge and continue normally
    if (fp.action === 'baseline') {
      addRowBadge(rowEl, '📸 Baseline Saved', '#00CFFF');
      logToPanel(`📸 ${shortTitle}... → Baseline captured`, 'info');
    }
  }
  // ========== END FINGERPRINT CHECK ==========
  
  // Highlight row being processed
  rowEl.style.outline = '2px solid #00CFFF';
  rowEl.style.background = 'rgba(0, 207, 255, 0.05)';
  
  // Detailed debug info
  const amazonPrice = amazonData.amazonPrice ? `$${amazonData.amazonPrice.toFixed(2)}` : 'N/A';
  const ebayPrice = `$${item.price.toFixed(2)}`;
  logToPanel(`${item.asin}: ${amazonData.action}`, 'info');
  logToPanel(`  eBay: qty=${currentEbayQty} price=${ebayPrice} | Amazon: ${amazonPrice}`, 'info');
  
  switch (amazonData.action) {
    case 'WRONG_ITEM':
      stats.totalFlagged++;
      rowEl.style.outline = '2px solid #FF8C00';
      rowEl.style.background = 'rgba(255, 140, 0, 0.08)';
      addRowBadge(rowEl, `⚠ Wrong Item (${Math.round((amazonData.similarity || 0) * 100)}%)`, '#FF8C00');
      logToPanel(`⚠ ${shortTitle}... → Wrong item match`, 'warn');
      break;
      
    case 'OUT_OF_STOCK':
      // Amazon is OUT OF STOCK - if eBay qty > 0, set to 0
      if (currentEbayQty > 0) {
        logToPanel(`🔴 ${shortTitle}... → OOS! Needs qty 0`, 'error');
        const updated = await updateQuantityInline(item.row, 0);
        stats.totalOutOfStock++;
        if (updated) {
          stats.totalUpdated++;
          logToPanel(`✓ Quantity updated to 0`, 'success');
          // Discord: Out of stock
          await discord.outOfStock({
            title: item.title,
            listingId: item.listingId,
            amazonUrl: `https://www.amazon.com/dp/${item.asin}`,
            amazonPrice: amazonData.amazonPrice || 0
          });
        } else {
          logToPanel(`⚠ Manual update needed`, 'warn');
        }
        rowEl.style.outline = '2px solid #FF3D3D';
        rowEl.style.background = 'rgba(255, 61, 61, 0.08)';
        addRowBadge(rowEl, `✗ OOS (was ${currentEbayQty})`, '#FF3D3D');
      } else {
        stats.totalOutOfStock++;
        rowEl.style.outline = '2px solid #888';
        addRowBadge(rowEl, '✗ Already 0', '#888');
        logToPanel(`- ${shortTitle}... → Already 0`, 'info');
      }
      break;
      
    case 'PRICE_UPDATED':
    case 'NO_CHANGE':
      // Amazon is IN STOCK - if eBay qty is 0, set to 1 (restock)
      if (currentEbayQty === 0) {
        logToPanel(`💚 ${shortTitle}... → IN STOCK! Needs qty 1`, 'success');
        const updated = await updateQuantityInline(item.row, 1);
        if (updated) {
          stats.totalUpdated++;
          stats.totalRestocked++;
          logToPanel(`✓ Restocked to 1`, 'success');
        } else {
          logToPanel(`⚠ Manual restock needed`, 'warn');
        }
        rowEl.style.outline = '2px solid #00FF88';
        rowEl.style.background = 'rgba(0, 255, 136, 0.08)';
        addRowBadge(rowEl, '↑ Restocked to 1', '#00FF88');
      } else {
        // Already in stock, handle price update if needed
        if (amazonData.action === 'PRICE_UPDATED' && amazonData.newEbayPrice) {
          const priceColor = amazonData.priceWentUp ? '#FFD700' : '#00FF88';
          rowEl.style.outline = `2px solid ${priceColor}`;
          rowEl.style.background = amazonData.priceWentUp ? 'rgba(255, 215, 0, 0.08)' : 'rgba(0, 255, 136, 0.08)';
          logToPanel(`💰 ${shortTitle}... → Price ${amazonData.priceWentUp ? '↑' : '↓'} $${amazonData.amazonPrice}→$${amazonData.newEbayPrice?.toFixed(2)}`, amazonData.priceWentUp ? 'warn' : 'success');
          
          // Actually update the price on eBay
          const priceUpdated = await updatePriceInline(item.row, amazonData.newEbayPrice);
          if (priceUpdated) {
            stats.totalUpdated++;
            addRowBadge(rowEl, `${amazonData.priceWentUp ? '↑' : '↓'} $${amazonData.newEbayPrice?.toFixed(2)} ✓`, priceColor);
            logToPanel(`✓ Price updated to $${amazonData.newEbayPrice.toFixed(2)}`, 'success');
            // Discord: Price updated
            await discord.priceUpdated({
              title: item.title,
              listingId: item.listingId,
              oldPrice: item.price,
              newPrice: amazonData.newEbayPrice,
              amazonPrice: amazonData.amazonPrice || 0,
              direction: amazonData.priceWentUp ? 'up' : 'down'
            });
          } else {
            addRowBadge(rowEl, `${amazonData.priceWentUp ? '↑' : '↓'} $${amazonData.newEbayPrice?.toFixed(2)} ⚠`, priceColor);
            logToPanel(`⚠ Manual price update needed`, 'warn');
          }
        } else {
          stats.totalNoChange++;
          rowEl.style.outline = '2px solid #22c55e';
          rowEl.style.background = 'rgba(34, 197, 94, 0.03)';
          addRowBadge(rowEl, '✓ OK', '#22c55e');
          logToPanel(`✓ ${shortTitle}... → OK ($${amazonData.amazonPrice})`, 'success');
          setTimeout(() => {
            rowEl.style.outline = '';
            rowEl.style.background = '';
          }, 2000);
        }
      }
      break;
      
    case 'ERROR':
    case 'SOURCE_NOT_FOUND':
      stats.totalFlagged++;
      rowEl.style.outline = '2px solid #888';
      addRowBadge(rowEl, '? Error', '#888');
      logToPanel(`? ${shortTitle}... → ${amazonData.action}`, 'error');
      break;
  }
  
  stats.totalChecked++;
  updatePanelStats();
}

// Main sync function
async function runSync() {
  if (isRunning) {
    logToPanel('⚠ Sync already running!', 'warn');
    return;
  }
  
  isRunning = true;
  
  // Only reset stats if starting fresh (not resuming)
  const isResuming = stats.totalChecked > 0;
  
  if (!isResuming) {
    // Clear the log
    const logEl = document.getElementById('syndrax-log');
    if (logEl) logEl.innerHTML = '';
    
    logToPanel('🚀 Starting sync...', 'success');
    
    // Reset stats
    stats.pageNum = 1;
    stats.totalChecked = 0;
    stats.totalUpdated = 0;
    stats.totalOutOfStock = 0;
    stats.totalFlagged = 0;
    stats.totalNoChange = 0;
    totalErrors = 0;
    syncStartTime = Date.now();
    
    // Get total items count
    const rows = document.querySelectorAll('tr.grid-row[data-id]');
    totalItemsOnPage = rows.length;
    
    // Discord: Sync started
    await discord.syncStarted(totalItemsOnPage);
  } else {
    logToPanel(`🚀 Continuing sync on page ${stats.pageNum}...`, 'success');
  }
  
  // Notify popup that sync started
  chrome.runtime.sendMessage({
    type: 'SYNC_STARTED',
    payload: { pageNum: stats.pageNum },
    timestamp: Date.now()
  });
  
  while (true && !shouldStop) {
    console.log(`[Sync] Processing page ${stats.pageNum}`);
    
    // Wait for table to be present
    await sleep(1000);
    
    // Get all listing rows on current page
    const rows = Array.from(document.querySelectorAll('tr.grid-row[data-id]'));
    console.log(`[Sync] Found ${rows.length} rows on page ${stats.pageNum}`);
    
    if (rows.length === 0) {
      console.log('[Sync] No rows found, stopping');
      break;
    }
    
    // Process 3 rows at a time
    for (let i = 0; i < rows.length; i += 3) {
      // Check if user requested stop
      if (shouldStop) {
        logToPanel('⏹️ Sync stopped by user', 'warn');
        break;
      }
      
      const batch = rows.slice(i, i + 3);
      
      // Extract data from each row
      const batchData: ItemData[] = [];
      for (const row of batch) {
        const data = extractRowData(row);
        if (data) batchData.push(data);
      }
      
      // Filter to items with ASINs
      const validItems = batchData.filter(item => item.asin);
      
      if (validItems.length === 0) {
        console.log(`[Sync] No valid ASINs in batch ${i / 3 + 1}, skipping`);
        stats.totalFlagged += batchData.length;
        stats.totalChecked += batchData.length;
        
        // Mark items without ASIN
        for (const item of batchData) {
          if (!item.asin) {
            const rowEl = item.row as HTMLElement;
            rowEl.style.outline = '2px solid #888';
            addRowBadge(rowEl, '⚠ No ASIN', '#888');
          }
        }
        continue;
      }
      
      console.log(`[Sync] Checking ${validItems.length} items with ASINs...`);
      updateStatus(`Checking batch ${Math.floor(i / 3) + 1}...`);
      
      // Build Amazon URLs
      const checkData = validItems.map(item => ({
        listingId: item.listingId,
        title: item.title,
        price: item.price,
        asin: item.asin,
        amazonUrl: `https://www.amazon.com/dp/${item.asin}`
      }));
      
      // Log ASINs being checked
      const asins = checkData.map(d => d.asin).join(', ');
      logToPanel(`📦 Batch ASINs: ${asins}`, 'info');
      console.log('[Sync] Sending to background:', checkData.map(d => d.asin));
      logToPanel(`🌐 Opening ${validItems.length} Amazon tabs...`, 'info');
      
      try {
        // Send to background to open Amazon tabs and check
        const response = await chrome.runtime.sendMessage({
          type: 'CHECK_AMAZON_BATCH',
          payload: { items: checkData },
          timestamp: Date.now()
        });
        
        console.log('[Sync] Response from background:', response);
        
        if (response?.results) {
          updateStatus(`Processing ${response.results.length} results...`);
          // Process results and update eBay
          for (let j = 0; j < response.results.length; j++) {
            const item = validItems[j];
            const result = response.results[j];
            console.log(`[Sync] Result for ${item.asin}:`, result);
            await processResult(item, result);
          }
        } else {
          console.error('[Sync] No results in response:', response);
          updateStatus('Error: No response from Amazon check');
        }
      } catch (error) {
        console.error('[Sync] Error checking Amazon:', error);
        updateStatus(`Error: ${(error as Error).message}`);
        for (const item of validItems) {
          await processResult(item, { action: 'ERROR' });
        }
      }
      
      // Send progress update
      chrome.runtime.sendMessage({
        type: 'SYNC_PROGRESS',
        payload: {
          pageNum: stats.pageNum,
          checked: stats.totalChecked,
          updated: stats.totalUpdated,
          outOfStock: stats.totalOutOfStock,
          flagged: stats.totalFlagged,
          noChange: stats.totalNoChange
        },
        timestamp: Date.now()
      });
      
      // Wait between batches
      await sleep(3000);
    }
    
    // Navigate to next page using URL offset
    const currentUrl = new URL(window.location.href);
    const currentOffset = parseInt(currentUrl.searchParams.get('offset') || '0');
    
    // Detect actual page size from number of rows we found
    const actualPageSize = rows.length;
    const limit = parseInt(currentUrl.searchParams.get('limit') || actualPageSize.toString());
    const newOffset = currentOffset + actualPageSize;
    
    // Check if there are more pages - look for pagination controls
    const nextButton = document.querySelector('button[aria-label="Go to next page"]') ||
                       document.querySelector('.pagination__next:not([disabled])') ||
                       document.querySelector('a[rel="next"]');
    
    // Also check total items count if available
    const totalItemsText = document.querySelector('.pagination-results, .shui-pagination-status')?.textContent || '';
    const totalMatch = totalItemsText.match(/of\s+([\d,]+)/i);
    const totalItems = totalMatch ? parseInt(totalMatch[1].replace(',', '')) : 0;
    
    // Determine if we should continue
    const hasMorePages = nextButton !== null || (totalItems > 0 && (currentOffset + actualPageSize) < totalItems);
    
    if (!hasMorePages) {
      console.log('[Sync] Last page reached - no more pages to process');
      logToPanel(`📄 Last page - no Next button found`, 'info');
      break;
    }
    
    console.log(`[Sync] Going to next page: offset ${currentOffset} → ${newOffset}`);
    logToPanel(`📄 Going to page ${stats.pageNum + 1}...`, 'info');
    
    // Save state before navigating
    stats.pageNum++;
    await saveSyncState();
    
    currentUrl.searchParams.set('offset', newOffset.toString());
    window.location.href = currentUrl.toString();
    
    // Script will re-initialize on new page and auto-resume
    return; // Exit - will continue on new page
  }
  
  // All done
  isRunning = false;
  
  logToPanel(`✅ COMPLETE! Checked: ${stats.totalChecked}, OOS: ${stats.totalOutOfStock}`, 'success');
  console.log('[Sync] Complete!', stats);
  
  // Discord: Sync complete
  const duration = `${Math.round((Date.now() - syncStartTime) / 1000)}s`;
  await discord.syncComplete({
    checked: stats.totalChecked,
    updated: stats.totalUpdated,
    outOfStock: stats.totalOutOfStock,
    flagged: stats.totalFlagged,
    errors: totalErrors,
    duration: duration
  });
  
  chrome.runtime.sendMessage({
    type: 'SYNC_COMPLETE',
    payload: {
      totalPages: stats.pageNum,
      totalChecked: stats.totalChecked,
      totalUpdated: stats.totalUpdated,
      totalOutOfStock: stats.totalOutOfStock,
      totalFlagged: stats.totalFlagged,
      totalNoChange: stats.totalNoChange
    },
    timestamp: Date.now()
  });
}

// Create floating control panel
function createControlPanel() {
  const existing = document.getElementById('syndrax-control-panel');
  if (existing) existing.remove();
  
  const panel = document.createElement('div');
  panel.id = 'syndrax-control-panel';
  panel.innerHTML = `
    <div style="
      position: fixed;
      top: 10px;
      right: 10px;
      width: 280px;
      background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3e 100%);
      border: 1px solid #00CFFF;
      border-radius: 10px;
      padding: 14px;
      z-index: 999999;
      font-family: Inter, system-ui, sans-serif;
      box-shadow: 0 4px 30px rgba(0,207,255,0.3);
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      ">
        <span style="
          color: #00CFFF;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          ⚡ Syndrax Sync
        </span>
        <button id="syndrax-minimize" style="
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 16px;
        ">−</button>
      </div>
      
      <div id="syndrax-content">
        <div id="syndrax-stats" style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-bottom: 12px;
        ">
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-checked" style="font-size: 18px; font-weight: 700; color: #00CFFF;">0</div>
            <div style="font-size: 9px; color: #888;">Checked</div>
          </div>
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-updated" style="font-size: 18px; font-weight: 700; color: #22c55e;">0</div>
            <div style="font-size: 9px; color: #888;">Updated</div>
          </div>
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-oos" style="font-size: 18px; font-weight: 700; color: #ef4444;">0</div>
            <div style="font-size: 9px; color: #888;">OOS</div>
          </div>
        </div>
        
        <div id="syndrax-status" style="
          font-size: 11px;
          color: #888;
          margin-bottom: 12px;
          min-height: 20px;
        ">Ready to sync</div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-direction: column;">
          <div id="syndrax-progress-container" style="
            width: 100%;
            height: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            overflow: hidden;
          ">
            <div id="syndrax-progress-bar" style="
              height: 100%;
              width: 0%;
              background: linear-gradient(90deg, #00CFFF 0%, #7A5CFF 50%, #FF00D4 100%);
              border-radius: 4px;
              transition: width 0.3s ease;
              animation: progressPulse 1.5s ease-in-out infinite;
            "></div>
          </div>
          <style>
            @keyframes progressPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          </style>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div id="syndrax-loading-text" style="
              flex: 1;
              color: #00CFFF;
              font-size: 12px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              <span class="syndrax-spinner" style="
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(0,207,255,0.3);
                border-top-color: #00CFFF;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              "></span>
              <style>
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              </style>
              <span id="syndrax-loading-msg">Starting...</span>
            </div>
            <button id="syndrax-stop" style="
              background: #FF3D3D;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 12px;
              font-family: Inter, system-ui, sans-serif;
            ">
              ⏹ Stop
            </button>
          </div>
        </div>
        
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        ">
          <span style="font-size: 10px; color: #888; font-weight: 600;">📋 Live Log:</span>
          <button id="syndrax-copy" style="
            background: rgba(0,207,255,0.1);
            border: 1px solid #00CFFF;
            color: #00CFFF;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9px;
            cursor: pointer;
            font-family: Inter, system-ui, sans-serif;
          ">📋 Copy</button>
        </div>
        <div id="syndrax-log" style="
          background: #000;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          max-height: 200px;
          overflow-y: auto;
          font-family: 'Consolas', monospace;
          font-size: 10px;
          color: #00CFFF;
        ">
          <div style="color: #888;">[Ready] Waiting for sync to start...</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Add event listeners
  const runBtn = document.getElementById('syndrax-run') as HTMLButtonElement;
  const stopBtn = document.getElementById('syndrax-stop') as HTMLButtonElement;
  const minimizeBtn = document.getElementById('syndrax-minimize');
  const content = document.getElementById('syndrax-content');
  
  runBtn?.addEventListener('click', async () => {
    if (isRunning) return;
    shouldStop = false;
    runBtn.textContent = '⏳ Running...';
    runBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    createStatsOverlay();
    await runSync();
    // Remove overlay when done
    const bigStats = document.getElementById('syndrax-big-stats');
    if (bigStats) bigStats.remove();
    stopBtn.style.display = 'none';
    runBtn.style.display = 'block';
    runBtn.textContent = '✓ Complete';
    shouldStop = false;
    setTimeout(() => {
      runBtn.textContent = '▶ Run Sync';
    }, 3000);
  });
  
  stopBtn?.addEventListener('click', () => {
    shouldStop = true;
    stopBtn.textContent = '⏹ Stopping...';
    logToPanel('⏹️ Stop requested...', 'warn');
  });
  
  minimizeBtn?.addEventListener('click', () => {
    if (content) {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      minimizeBtn.textContent = isHidden ? '−' : '+';
    }
  });
  
  // Copy button
  const copyBtn = document.getElementById('syndrax-copy');
  copyBtn?.addEventListener('click', () => {
    const logEl = document.getElementById('syndrax-log');
    if (logEl) {
      const text = logEl.innerText;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
        }, 2000);
      }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
        }, 2000);
      });
    }
  });
}

// Create large transparent stats overlay
function createStatsOverlay() {
  const existing = document.getElementById('syndrax-big-stats');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'syndrax-big-stats';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 15, 30, 0.85);
      border: 2px solid #00CFFF;
      border-radius: 16px;
      padding: 16px 32px;
      z-index: 999998;
      font-family: Inter, system-ui, sans-serif;
      display: flex;
      gap: 32px;
      align-items: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 40px rgba(0,207,255,0.4);
    ">
      <div style="text-align: center;">
        <div id="big-page" style="font-size: 28px; font-weight: 800; color: #7A5CFF;">1</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Page</div>
      </div>
      <div style="width: 1px; height: 40px; background: #333;"></div>
      <div style="text-align: center;">
        <div id="big-checked" style="font-size: 36px; font-weight: 800; color: #00CFFF;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Checked</div>
      </div>
      <div style="text-align: center;">
        <div id="big-updated" style="font-size: 36px; font-weight: 800; color: #22c55e;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Updated</div>
      </div>
      <div style="text-align: center;">
        <div id="big-oos" style="font-size: 36px; font-weight: 800; color: #ef4444;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">OOS</div>
      </div>
      <div style="text-align: center;">
        <div id="big-restocked" style="font-size: 36px; font-weight: 800; color: #00FF88;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Restocked</div>
      </div>
      <div style="text-align: center;">
        <div id="big-ok" style="font-size: 36px; font-weight: 800; color: #888;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">OK</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Update stats in the control panel and big overlay
function updatePanelStats() {
  const checkedEl = document.getElementById('stat-checked');
  const updatedEl = document.getElementById('stat-updated');
  const oosEl = document.getElementById('stat-oos');
  const statusEl = document.getElementById('syndrax-status');
  
  if (checkedEl) checkedEl.textContent = stats.totalChecked.toString();
  if (updatedEl) updatedEl.textContent = stats.totalUpdated.toString();
  if (oosEl) oosEl.textContent = stats.totalOutOfStock.toString();
  if (statusEl && isRunning) {
    statusEl.textContent = `Page ${stats.pageNum} | ${stats.totalFlagged} flagged | ${stats.totalNoChange} unchanged`;
  }
  
  // Update big overlay
  const bigPage = document.getElementById('big-page');
  const bigChecked = document.getElementById('big-checked');
  const bigUpdated = document.getElementById('big-updated');
  const bigOos = document.getElementById('big-oos');
  const bigRestocked = document.getElementById('big-restocked');
  const bigOk = document.getElementById('big-ok');
  
  if (bigPage) bigPage.textContent = stats.pageNum.toString();
  if (bigChecked) bigChecked.textContent = stats.totalChecked.toString();
  if (bigUpdated) bigUpdated.textContent = stats.totalUpdated.toString();
  if (bigOos) bigOos.textContent = stats.totalOutOfStock.toString();
  if (bigRestocked) bigRestocked.textContent = stats.totalRestocked.toString();
  if (bigOk) bigOk.textContent = stats.totalNoChange.toString();
}

// Listen for messages to update stats
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SYNC_PROGRESS') {
    updatePanelStats();
  }
});

// Show error indicator on panel
function showResumeError() {
  const panel = document.getElementById('syndrax-control-panel');
  if (panel) {
    // Add error badge
    let errorBadge = document.getElementById('syndrax-error-badge');
    if (!errorBadge) {
      errorBadge = document.createElement('div');
      errorBadge.id = 'syndrax-error-badge';
      errorBadge.style.cssText = `
        position: absolute;
        top: -8px;
        left: -8px;
        background: #FF3D3D;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(255,61,61,0.5);
        z-index: 9999999;
        animation: pulse 1s infinite;
      `;
      errorBadge.textContent = '⚠️';
      
      // Add animation style
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `;
      document.head.appendChild(style);
      
      const panelDiv = panel.querySelector('div');
      if (panelDiv) {
        panelDiv.style.position = 'relative';
        panelDiv.appendChild(errorBadge);
      }
    }
  }
}

// Emergency fallback: auto-click run button
async function emergencyResume(savedState: SyncState) {
  console.log('[Syndrax Sync] 🚨 EMERGENCY RESUME - Normal resume failed, auto-clicking Run button');
  showResumeError();
  logToPanel(`🚨 Resume failed! Emergency auto-start...`, 'error');
  
  // Restore stats even in emergency
  stats.pageNum = savedState.pageNum;
  stats.totalChecked = savedState.totalChecked;
  stats.totalUpdated = savedState.totalUpdated;
  stats.totalOutOfStock = savedState.totalOutOfStock;
  stats.totalFlagged = savedState.totalFlagged;
  stats.totalNoChange = savedState.totalNoChange;
  stats.totalRestocked = savedState.totalRestocked || 0;
  
  updatePanelStats();
  
  // Wait for table
  await waitForTableRows(10000);
  
  // Click the run button
  const runBtn = document.getElementById('syndrax-run') as HTMLButtonElement;
  if (runBtn) {
    console.log('[Syndrax Sync] Clicking Run button as fallback');
    runBtn.click();
  } else {
    logToPanel(`❌ Could not find Run button!`, 'error');
  }
}

// Block navigation to bad pages and redirect back
function setupNavigationBlocker() {
  // Block beforeunload if sync is running
  window.addEventListener('beforeunload', (e) => {
    if (isRunning) {
      console.log('[Syndrax Sync] 🛑 Blocking navigation - sync in progress');
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
  
  // Intercept all link clicks that might go to bad pages
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a') as HTMLAnchorElement;
    
    if (link && link.href) {
      // Block navigation to the categories page
      if (link.href.includes('/n/all-categories') || 
          link.href.includes('_nkw=') ||
          link.href.includes('/sch/') && !link.href.includes('/sh/')) {
        console.log('[Syndrax Sync] 🛑 Blocked bad navigation:', link.href);
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);
  
  // Also intercept form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (form.action && (form.action.includes('/n/all-categories') || 
                        form.action.includes('_nkw=') ||
                        form.action.includes('/sch/'))) {
      console.log('[Syndrax Sync] 🛑 Blocked bad form submission:', form.action);
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);
  
  // Monitor for programmatic navigation
  const originalAssign = window.location.assign;
  window.location.assign = function(url: string) {
    if (url.includes('/n/all-categories') || url.includes('_nkw=')) {
      console.log('[Syndrax Sync] 🛑 Blocked location.assign:', url);
      return;
    }
    return originalAssign.call(window.location, url);
  };
  
  // Also override href setter (more aggressive)
  const originalHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  if (originalHref && originalHref.set) {
    Object.defineProperty(window.location, 'href', {
      set: function(url: string) {
        if (url.includes('/n/all-categories') || (url.includes('_nkw=') && !url.includes('/sh/lst'))) {
          console.log('[Syndrax Sync] 🛑 Blocked location.href:', url);
          return;
        }
        return originalHref.set!.call(window.location, url);
      },
      get: function() {
        return originalHref.get!.call(window.location);
      }
    });
  }
}

// Initialize
async function init() {
  const url = window.location.href;
  console.log('[Syndrax Sync] Checking URL:', url);
  
  // EMERGENCY: If we somehow landed on the bad page, redirect back immediately
  if (url.includes('/n/all-categories') || (url.includes('_nkw=') && !url.includes('/sh/lst'))) {
    console.log('[Syndrax Sync] 🚨 EMERGENCY: On bad page! Redirecting back to listings...');
    window.location.href = 'https://www.ebay.com/sh/lst/active';
    return;
  }
  
  // Match any eBay listing page
  const isListingsPage = 
    url.includes('ebay.com/sh/lst') ||
    url.includes('ebay.com/mys/active') ||
    url.includes('ebay.com/sh/lst/active') ||
    url.includes('ebay.com/sh/lst?') ||
    url.includes('/sh/lst');
  
  if (!isListingsPage) {
    console.log('[Syndrax Sync] Not a listings page, skipping');
    return;
  }
  
  console.log('[Syndrax Sync] eBay Active Listings page detected!');
  
  // Setup navigation blocker to prevent bad redirects
  setupNavigationBlocker();
  
  createControlPanel();
  
  // Check for saved sync state and auto-resume
  console.log('[Syndrax Sync] Checking for saved state...');
  let savedState: SyncState | null = null;
  
  try {
    savedState = await loadSyncState();
    console.log('[Syndrax Sync] Loaded state:', savedState);
  } catch (e) {
    console.error('[Syndrax Sync] Error loading state:', e);
    logToPanel(`❌ Error loading state: ${e}`, 'error');
  }
  
  // If no saved running state, AUTO-START the sync!
  if (!savedState || !savedState.isRunning) {
    console.log('[Syndrax Sync] No running state - auto-starting fresh sync...');
    logToPanel(`🚀 Auto-starting sync...`, 'success');
    
    // Wait for table to load
    logToPanel(`⏳ Waiting for table...`, 'info');
    const rows = await waitForTableRows(15000);
    
    if (rows.length === 0) {
      logToPanel(`⚠️ No table found after 15s`, 'warn');
      return;
    }
    
    logToPanel(`✅ Found ${rows.length} items, starting...`, 'success');
    
    // Create overlay and start
    createStatsOverlay();
    await runSync();
    
    // After complete
    const bigStats = document.getElementById('syndrax-big-stats');
    if (bigStats) bigStats.remove();
    
    logToPanel(`✅ Sync complete!`, 'success');
    
    // Update loading message
    const loadingMsg = document.getElementById('syndrax-loading-msg');
    if (loadingMsg) loadingMsg.textContent = 'Complete!';
    
    return;
  }
  
  const timeSinceSave = Date.now() - savedState.startTime;
  console.log('[Syndrax Sync] Time since save:', timeSinceSave, 'ms');
  
  // If state is too old, clear it
  if (timeSinceSave >= 5 * 60 * 1000) {
    console.log('[Syndrax Sync] Saved state too old, clearing');
    await clearSyncState();
    return;
  }
  
  console.log('[Syndrax Sync] Attempting to resume from saved state:', savedState);
  
  // Set a timeout - if resume doesn't complete in 30 seconds, do emergency fallback
  const resumeTimeout = setTimeout(() => {
    console.error('[Syndrax Sync] ⚠️ Resume timeout! Triggering emergency fallback');
    emergencyResume(savedState!);
  }, 30000);
  
  try {
    // Restore stats
    stats.pageNum = savedState.pageNum;
    stats.totalChecked = savedState.totalChecked;
    stats.totalUpdated = savedState.totalUpdated;
    stats.totalOutOfStock = savedState.totalOutOfStock;
    stats.totalFlagged = savedState.totalFlagged;
    stats.totalNoChange = savedState.totalNoChange;
    stats.totalRestocked = savedState.totalRestocked || 0;
    
    // Restore log messages from previous pages
    const logEl = document.getElementById('syndrax-log');
    if (logEl && savedState.logMessages && savedState.logMessages.length > 0) {
      logEl.innerHTML = '';
      for (const msg of savedState.logMessages) {
        const line = document.createElement('div');
        line.style.cssText = 'font-size: 10px; color: #888; margin-bottom: 2px;';
        line.textContent = msg;
        logEl.appendChild(line);
      }
    }
    
    updatePanelStats();
    logToPanel(`📄 Resumed on page ${stats.pageNum}`, 'success');
    
    // Create big overlay for resumed sync
    createStatsOverlay();
    
    // Wait for table rows to actually appear
    logToPanel(`⏳ Waiting for table to load...`, 'info');
    const rows = await waitForTableRows(15000);
    
    if (rows.length === 0) {
      logToPanel(`⚠️ Table not loaded after 15s, trying emergency...`, 'warn');
      clearTimeout(resumeTimeout);
      await emergencyResume(savedState);
      return;
    }
    
    logToPanel(`✅ Found ${rows.length} rows, continuing sync...`, 'success');
    
    // Update buttons
    const runBtn = document.getElementById('syndrax-run') as HTMLButtonElement;
    const stopBtn = document.getElementById('syndrax-stop') as HTMLButtonElement;
    if (runBtn) runBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
    
    // Clear the timeout since we're proceeding normally
    clearTimeout(resumeTimeout);
    
    // Resume sync
    await runSync();
    
    // After complete
    if (stopBtn) stopBtn.style.display = 'none';
    if (runBtn) {
      runBtn.style.display = 'block';
      runBtn.textContent = '✓ Complete';
      setTimeout(() => {
        runBtn.textContent = '▶ Run Sync';
      }, 3000);
    }
    
    // Clear the saved state
    await clearSyncState();
    
  } catch (error) {
    console.error('[Syndrax Sync] Error in resume:', error);
    logToPanel(`❌ Resume error: ${error}`, 'error');
    clearTimeout(resumeTimeout);
    
    // Try emergency fallback
    await emergencyResume(savedState);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
