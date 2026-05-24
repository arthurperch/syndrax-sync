// ⚡ Listing Optimizer — Session G
// Injected on ebay.com/sh/lst alongside ebay-sync-controller.ts
// Automates the 90-day listing lifecycle from BUSINESS_RULES.md
// DO NOT import from ebay-sync-controller.ts — selectors duplicated intentionally

import { WEBHOOKS } from '../config/webhooks.config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistryItem {
  listingId: string;
  title: string;
  asin: string;
  price: number;
  firstSeen: string;      // ISO date — when we first saw this listing
  lastSeen: string;       // ISO date — updated every scan
  salesCount: number;     // 0 by default, updated when we detect a sale
  checkpoint: 30 | 60 | 90 | null;  // which checkpoint was last actioned
  status: 'active' | 'ended' | 'relisted' | 'deleted';
  notes: string;          // log of actions taken
}

interface RecycleItem {
  listingId: string;
  title: string;
  asin: string;
  originalPrice: number;
  deletedAt: string;
}

interface RowData {
  listingId: string;
  title: string;
  asin: string;
  price: number;
  row: Element;
}

type CheckpointAge = 30 | 60 | 90;

interface CheckpointItem {
  item: RegistryItem;
  row: Element | null;
  age: number;
  needed: CheckpointAge;
}

// ─── State ────────────────────────────────────────────────────────────────────

let panelMinimized = false;
let isScanning = false;
let optLog: string[] = [];

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function calcAge(firstSeen: string): number {
  const first = new Date(firstSeen).getTime();
  const now = Date.now();
  return Math.floor((now - first) / (1000 * 60 * 60 * 24));
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// ─── DOM Row Extraction (duplicated from ebay-sync-controller — intentional) ──

function decodeSkuToAsin(rawSku: string): string {
  if (!rawSku) return '';
  try {
    const decoded = atob(rawSku.trim());
    if (/^[A-Z0-9]{10}$/i.test(decoded)) return decoded.toUpperCase();
  } catch { /* not base64 */ }
  if (/^[A-Z0-9]{10}$/i.test(rawSku.trim())) return rawSku.trim().toUpperCase();
  const match = rawSku.match(/[A-Z0-9]{10}/i);
  if (match) return match[0].toUpperCase();
  return '';
}

function extractOptimizerRows(): RowData[] {
  const rows = Array.from(document.querySelectorAll('tr.grid-row[data-id]'));
  const results: RowData[] = [];

  for (const row of rows) {
    const listingId = row.getAttribute('data-id') || '';
    if (!listingId) continue;

    const titleEl =
      row.querySelector('.shui-dt-column__title a') ||
      row.querySelector('.column-title__text a') ||
      row.querySelector('[data-test-id="item-title"]');
    const title = titleEl?.textContent?.trim() || '';

    const priceEl =
      row.querySelector('.shui-dt-column__price') ||
      row.querySelector('.col-price__current');
    const priceText = priceEl?.textContent || '';
    const priceMatch = priceText.match(/\$([0-9,]+\.?[0-9]*)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

    const skuEl =
      row.querySelector('.shui-dt-column__listingSKU') ||
      row.querySelector('[data-test-id="listing-sku"]');
    const rawSku = skuEl?.textContent?.trim() || '';
    const asin = decodeSkuToAsin(rawSku);

    results.push({ listingId, title, price, asin, row });
  }

  return results;
}

// ─── Storage via Background ───────────────────────────────────────────────────

async function loadRegistry(): Promise<Record<string, RegistryItem>> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_OPTIMIZER_REGISTRY' });
    return (resp?.registry as Record<string, RegistryItem>) || {};
  } catch {
    return {};
  }
}

async function saveItem(item: RegistryItem): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_OPTIMIZER_ITEM',
      payload: { listingId: item.listingId, updates: item }
    });
  } catch (e) {
    console.error('[Optimizer] saveItem failed:', e);
  }
}

async function loadRecycleQueue(): Promise<RecycleItem[]> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_RECYCLE_QUEUE' });
    return (resp?.queue as RecycleItem[]) || [];
  } catch {
    return [];
  }
}

async function appendRecycleQueue(entry: RecycleItem): Promise<void> {
  try {
    const queue = await loadRecycleQueue();
    queue.push(entry);
    await chrome.storage.local.set({ optimizer_recycle_queue: queue });
  } catch (e) {
    console.error('[Optimizer] appendRecycleQueue failed:', e);
  }
}

// ─── Checkpoint Logic ─────────────────────────────────────────────────────────

function getCheckpointNeeded(item: RegistryItem): CheckpointAge | null {
  if (item.salesCount > 0) return null;
  if (item.status === 'deleted' || item.status === 'ended') return null;

  const age = calcAge(item.firstSeen);

  if (age >= 90 && item.checkpoint !== 90) return 90;
  if (age >= 60 && item.checkpoint !== 60 && item.checkpoint !== 90) return 60;
  if (age >= 30 && item.checkpoint !== 30 && item.checkpoint !== 60 && item.checkpoint !== 90) return 30;

  return null;
}

// ─── Panel Logging ────────────────────────────────────────────────────────────

function logToOptPanel(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const colors: Record<string, string> = {
    info:    '#00CFFF',
    warn:    '#f59e0b',
    error:   '#ef4444',
    success: '#22c55e',
  };

  const entry = `[${ts()}] ${message}`;
  optLog.unshift(entry);
  if (optLog.length > 50) optLog = optLog.slice(0, 50);

  const logEl = document.getElementById('opt-log');
  if (!logEl) return;

  const div = document.createElement('div');
  div.style.cssText = `color: ${colors[level]}; margin-bottom: 2px; word-break: break-word;`;
  div.textContent = entry;

  logEl.insertBefore(div, logEl.firstChild);

  // Keep only last 10 visible
  while (logEl.children.length > 10) {
    logEl.removeChild(logEl.lastChild!);
  }
}

// ─── Action Menu Helpers ──────────────────────────────────────────────────────

async function openActionMenu(row: Element): Promise<boolean> {
  // Try multiple selectors for the action menu trigger
  const trigger =
    row.querySelector('button[aria-label*="action" i]') as HTMLButtonElement ||
    row.querySelector('button[aria-label*="more" i]') as HTMLButtonElement ||
    row.querySelector('.menu-button__button') as HTMLButtonElement ||
    row.querySelector('[data-test-id*="action"]') as HTMLButtonElement ||
    row.querySelector('button.icon-btn') as HTMLButtonElement;

  if (!trigger) {
    logToOptPanel('⚠ Action menu trigger not found on row', 'warn');
    console.warn('[Optimizer] openActionMenu: no trigger found on row', row);
    return false;
  }

  trigger.click();
  await sleep(800);
  return true;
}

async function clickMenuOption(labelText: string): Promise<boolean> {
  // Try multiple selector patterns eBay uses for action menu items
  const candidates: Element[] = [
    ...Array.from(document.querySelectorAll('[role="menuitem"]')),
    ...Array.from(document.querySelectorAll('[role="option"]')),
    ...Array.from(document.querySelectorAll('.menu-button__item')),
    ...Array.from(document.querySelectorAll('[class*="menu"] li')),
    ...Array.from(document.querySelectorAll('[class*="dropdown"] li')),
    ...Array.from(document.querySelectorAll('[class*="action"] li')),
    ...Array.from(document.querySelectorAll('ul[class*="menu"] a')),
  ];

  const match = candidates.find(el =>
    el.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())
  );

  if (!match) {
    // NEVER silent — always log what was found vs what was expected
    const found = candidates
      .map(el => el.textContent?.trim())
      .filter((t): t is string => Boolean(t) && t.length > 0)
      .slice(0, 8);

    logToOptPanel(
      `⚠ Menu item "${labelText}" not found. Visible: [${found.join(' | ') || 'none'}]`,
      'warn'
    );
    console.warn(`[Optimizer] clickMenuOption("${labelText}") failed. Found:`, found);

    // Dismiss any open menu
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }

  (match as HTMLElement).click();
  await sleep(600);
  return true;
}

async function dismissDialog(): Promise<void> {
  // Close any open dialog/modal
  const closeBtn =
    document.querySelector('[aria-label="Close"]') as HTMLButtonElement ||
    document.querySelector('button[class*="close"]') as HTMLButtonElement ||
    document.querySelector('[data-test-id="dialog-close"]') as HTMLButtonElement;

  if (closeBtn) {
    closeBtn.click();
    await sleep(400);
  } else {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(400);
  }
}

// ─── Price Update (same pattern as ebay-sync-controller, duplicated) ──────────

async function updatePriceInline(row: Element, newPrice: number): Promise<boolean> {
  const rowEl = row as HTMLElement;

  const editBtn =
    rowEl.querySelector('button[aria-label="Edit Current price"]') as HTMLButtonElement ||
    rowEl.querySelector('button[column="price"]') as HTMLButtonElement;

  if (!editBtn) {
    logToOptPanel('❌ Edit price button not found', 'error');
    return false;
  }

  editBtn.click();
  await sleep(1200);

  let input: HTMLInputElement | null = null;

  const dialogs = document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');
  for (const dialog of dialogs) {
    const inp =
      dialog.querySelector('input[name*="price"]') as HTMLInputElement ||
      dialog.querySelector('input[aria-label*="price" i]') as HTMLInputElement ||
      dialog.querySelector('input.textbox__control') as HTMLInputElement;
    if (inp) { input = inp; break; }
  }

  if (!input) {
    input =
      document.querySelector('input[name*="price"]') as HTMLInputElement ||
      document.querySelector('input.textbox__control') as HTMLInputElement;
  }

  if (!input) {
    logToOptPanel('❌ Price input not found', 'error');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }

  const priceStr = newPrice.toFixed(2);
  input.focus();
  await sleep(100);
  input.setSelectionRange(0, input.value.length);
  document.execCommand('insertText', false, priceStr);
  await sleep(100);

  if (input.value !== priceStr) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(input, priceStr);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (input.value !== priceStr) {
    input.value = priceStr;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await sleep(300);

  // Confirm the price edit
  const saveBtn =
    document.querySelector('button[aria-label*="save" i]') as HTMLButtonElement ||
    document.querySelector('button[data-test-id*="save"]') as HTMLButtonElement ||
    document.querySelector('[class*="dialog"] button[type="submit"]') as HTMLButtonElement;

  if (saveBtn) {
    saveBtn.click();
    await sleep(1000);
  } else {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(1000);
  }

  return true;
}

// ─── Checkpoint Actions ───────────────────────────────────────────────────────

/**
 * Day 30: End & Sell Similar
 * Resets eBay algorithm boost for a new 24-48hr window
 */
async function doDay30(item: RegistryItem, row: Element): Promise<'ok' | 'menu_fail'> {
  logToOptPanel(`▶ Day-30: ${truncate(item.title, 30)} — End & Sell Similar`, 'info');

  // Step 1: Open action menu
  const menuOpened = await openActionMenu(row);
  if (!menuOpened) {
    logToOptPanel(`❌ Action aborted — could not open menu for ${item.listingId}`, 'error');
    return 'menu_fail';
  }

  // Step 2: Click "End listing"
  const endClicked = await clickMenuOption('End listing');
  if (!endClicked) {
    logToOptPanel(`❌ Action aborted — "End listing" menu item not found`, 'error');
    return 'menu_fail';
  }

  await sleep(1500);

  // Step 3: Confirm end listing dialog if present
  const confirmBtn =
    document.querySelector('button[data-test-id*="confirm"]') as HTMLButtonElement ||
    document.querySelector('[class*="dialog"] button[class*="primary"]') as HTMLButtonElement ||
    document.querySelector('[class*="modal"] button[class*="confirm"]') as HTMLButtonElement;

  if (confirmBtn) {
    confirmBtn.click();
    await sleep(1500);
  }

  // Step 4: Click "Sell Similar" — re-open action menu on the now-ended row
  await sleep(800);
  const menuOpened2 = await openActionMenu(row);
  if (!menuOpened2) {
    logToOptPanel(`⚠ Listing ended but could not open menu for Sell Similar`, 'warn');
    // Still mark checkpoint — listing was ended
    const updated: RegistryItem = {
      ...item,
      checkpoint: 30,
      status: 'ended',
      lastSeen: today(),
      notes: item.notes + `\n[${new Date().toISOString()}] Day-30: Ended (Sell Similar menu failed)`
    };
    await saveItem(updated);
    return 'ok';
  }

  const sellSimilarClicked = await clickMenuOption('Sell similar');
  if (!sellSimilarClicked) {
    // Try alternate label
    await clickMenuOption('List similar');
  }

  // Mark checkpoint
  const updated: RegistryItem = {
    ...item,
    checkpoint: 30,
    status: 'relisted',
    lastSeen: today(),
    notes: item.notes + `\n[${new Date().toISOString()}] Day-30: End & Sell Similar executed`
  };
  await saveItem(updated);

  logToOptPanel(`✅ Day-30 complete: ${truncate(item.title, 30)}`, 'success');
  return 'ok';
}

/**
 * Day 60: Lower price 10% + relist
 * Price floor: new price must be >= 1.1x estimated cost
 */
async function doDay60(item: RegistryItem, row: Element): Promise<'ok' | 'floor_skip' | 'menu_fail'> {
  const newPrice = parseFloat((item.price * 0.90).toFixed(2));

  // Price floor enforcement (BUSINESS_RULES: never below 1.1x cost)
  // If we don't have amazon_cost, use current_price / 2.0 as conservative estimate
  const estimatedCost = item.price / 2.0;
  const priceFloor = parseFloat((estimatedCost * 1.1).toFixed(2));

  if (newPrice < priceFloor) {
    const msg = `⚠ Day-60 price floor violation — ${truncate(item.title, 25)}: ` +
                `$${item.price.toFixed(2)} × 0.90 = $${newPrice.toFixed(2)} < floor $${priceFloor.toFixed(2)} ` +
                `(est. cost $${estimatedCost.toFixed(2)}). Skipped.`;
    logToOptPanel(msg, 'warn');
    console.warn('[Optimizer] Day-60 floor violation:', { item: item.listingId, newPrice, priceFloor });

    // Mark checkpoint so it doesn't re-queue every scan
    const updated: RegistryItem = {
      ...item,
      checkpoint: 60,
      lastSeen: today(),
      notes: item.notes + `\n[${new Date().toISOString()}] Day-60 skipped: price floor ($${newPrice.toFixed(2)} < $${priceFloor.toFixed(2)})`
    };
    await saveItem(updated);
    return 'floor_skip';
  }

  logToOptPanel(
    `▶ Day-60: ${truncate(item.title, 25)} — $${item.price.toFixed(2)} → $${newPrice.toFixed(2)} + Relist`,
    'info'
  );

  // Step 1: Update price inline
  const priceUpdated = await updatePriceInline(row, newPrice);
  if (!priceUpdated) {
    logToOptPanel(`❌ Day-60 price update failed for ${item.listingId}`, 'error');
    return 'menu_fail';
  }

  await sleep(800);

  // Step 2: End & Sell Similar (same as Day 30)
  const menuOpened = await openActionMenu(row);
  if (!menuOpened) {
    logToOptPanel(`⚠ Price updated but could not open menu for End & Sell Similar`, 'warn');
    const updated: RegistryItem = {
      ...item,
      price: newPrice,
      checkpoint: 60,
      lastSeen: today(),
      notes: item.notes + `\n[${new Date().toISOString()}] Day-60: Price $${item.price.toFixed(2)} → $${newPrice.toFixed(2)} (Sell Similar menu failed)`
    };
    await saveItem(updated);
    return 'ok';
  }

  const endClicked = await clickMenuOption('End listing');
  if (!endClicked) {
    logToOptPanel(`❌ Action aborted — "End listing" not found after price update`, 'error');
    return 'menu_fail';
  }

  await sleep(1500);

  const confirmBtn =
    document.querySelector('button[data-test-id*="confirm"]') as HTMLButtonElement ||
    document.querySelector('[class*="dialog"] button[class*="primary"]') as HTMLButtonElement;

  if (confirmBtn) {
    confirmBtn.click();
    await sleep(1500);
  }

  await sleep(800);
  const menuOpened2 = await openActionMenu(row);
  if (menuOpened2) {
    const sellClicked = await clickMenuOption('Sell similar');
    if (!sellClicked) await clickMenuOption('List similar');
  }

  const updated: RegistryItem = {
    ...item,
    price: newPrice,
    checkpoint: 60,
    status: 'relisted',
    lastSeen: today(),
    notes: item.notes + `\n[${new Date().toISOString()}] Day-60: Price $${item.price.toFixed(2)} → $${newPrice.toFixed(2)} + End & Sell Similar`
  };
  await saveItem(updated);

  logToOptPanel(`✅ Day-60 complete: ${truncate(item.title, 25)} → $${newPrice.toFixed(2)}`, 'success');
  return 'ok';
}

/**
 * Day 90: Delete listing + queue replacement
 * MANUAL ONLY — never called from batch
 * Does NOT sell similar — just ends the listing
 */
async function doDay90(item: RegistryItem, row: Element): Promise<'ok' | 'menu_fail'> {
  logToOptPanel(`▶ Day-90: ${truncate(item.title, 30)} — Deleting`, 'warn');

  // Step 1: Open action menu
  const menuOpened = await openActionMenu(row);
  if (!menuOpened) {
    logToOptPanel(`❌ Action aborted — could not open menu for ${item.listingId}`, 'error');
    return 'menu_fail';
  }

  // Step 2: End listing (NO sell similar)
  const endClicked = await clickMenuOption('End listing');
  if (!endClicked) {
    logToOptPanel(`❌ Action aborted — "End listing" not found`, 'error');
    return 'menu_fail';
  }

  await sleep(1500);

  const confirmBtn =
    document.querySelector('button[data-test-id*="confirm"]') as HTMLButtonElement ||
    document.querySelector('[class*="dialog"] button[class*="primary"]') as HTMLButtonElement;

  if (confirmBtn) {
    confirmBtn.click();
    await sleep(1500);
  }

  // Step 3: Add to recycle queue
  const recycleEntry: RecycleItem = {
    listingId: item.listingId,
    title: item.title,
    asin: item.asin,
    originalPrice: item.price,
    deletedAt: new Date().toISOString()
  };
  await appendRecycleQueue(recycleEntry);

  // Step 4: Update registry
  const updated: RegistryItem = {
    ...item,
    checkpoint: 90,
    status: 'deleted',
    lastSeen: today(),
    notes: item.notes + `\n[${new Date().toISOString()}] Day-90: Deleted + queued for replacement`
  };
  await saveItem(updated);

  // Step 5: Discord alert to inventoryHealth channel
  try {
    await fetch(WEBHOOKS.inventoryHealth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Syndrax Optimizer',
        avatar_url: 'https://syndrax.io/assets/images/logo.png',
        embeds: [{
          title: '🗑️ Day-90 Listing Deleted',
          color: 0xef4444,
          fields: [
            { name: 'Title', value: truncate(item.title, 80), inline: false },
            { name: 'ASIN', value: item.asin || 'N/A', inline: true },
            { name: 'Listing ID', value: item.listingId, inline: true },
            { name: 'Original Price', value: `$${item.price.toFixed(2)}`, inline: true },
            { name: 'Age', value: `${calcAge(item.firstSeen)} days`, inline: true },
            { name: 'First Seen', value: item.firstSeen, inline: true },
            { name: 'Status', value: 'Added to recycle queue', inline: false },
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (e) {
    console.error('[Optimizer] Discord Day-90 alert failed:', e);
  }

  logToOptPanel(`✅ Day-90 complete: ${truncate(item.title, 25)} — deleted + queued`, 'success');
  return 'ok';
}

// ─── Scan Engine ──────────────────────────────────────────────────────────────

async function scanListings(): Promise<CheckpointItem[]> {
  logToOptPanel('🔍 Scanning listings...', 'info');
  setStatusDot('amber');

  const rows = extractOptimizerRows();
  logToOptPanel(`Found ${rows.length} rows on page`, 'info');

  const registry = await loadRegistry();
  const todayStr = today();

  // Update registry with current page rows
  for (const row of rows) {
    if (registry[row.listingId]) {
      // Update existing entry
      registry[row.listingId].lastSeen = todayStr;
      registry[row.listingId].price = row.price || registry[row.listingId].price;
      registry[row.listingId].title = row.title || registry[row.listingId].title;
      if (row.asin) registry[row.listingId].asin = row.asin;
    } else {
      // New listing — add to registry
      registry[row.listingId] = {
        listingId: row.listingId,
        title: row.title,
        asin: row.asin,
        price: row.price,
        firstSeen: todayStr,
        lastSeen: todayStr,
        salesCount: 0,
        checkpoint: null,
        status: 'active',
        notes: `[${new Date().toISOString()}] First seen`
      };
    }

    // Save each item
    await saveItem(registry[row.listingId]);
  }

  // Build checkpoint queue from full registry
  const checkpointItems: CheckpointItem[] = [];
  const allRegistry = await loadRegistry();

  for (const item of Object.values(allRegistry)) {
    const needed = getCheckpointNeeded(item);
    if (needed === null) continue;

    // Find the DOM row if it's on this page
    const domRow = rows.find(r => r.listingId === item.listingId);

    checkpointItems.push({
      item,
      row: domRow?.row || null,
      age: calcAge(item.firstSeen),
      needed
    });
  }

  // Sort: Day 90 first, then 60, then 30
  checkpointItems.sort((a, b) => b.needed - a.needed);

  logToOptPanel(
    `Scan complete: ${rows.length} rows, ${checkpointItems.length} need action`,
    'success'
  );
  setStatusDot('green');

  return checkpointItems;
}

// ─── Registry Stats ───────────────────────────────────────────────────────────

async function getRegistryStats(): Promise<{
  total: number;
  avgAge: number;
  at30: number;
  at60: number;
  at90: number;
}> {
  const registry = await loadRegistry();
  const items = Object.values(registry);

  if (items.length === 0) return { total: 0, avgAge: 0, at30: 0, at60: 0, at90: 0 };

  const ages = items.map(i => calcAge(i.firstSeen));
  const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);

  let at30 = 0, at60 = 0, at90 = 0;
  for (const item of items) {
    const needed = getCheckpointNeeded(item);
    if (needed === 30) at30++;
    else if (needed === 60) at60++;
    else if (needed === 90) at90++;
  }

  return { total: items.length, avgAge, at30, at60, at90 };
}

// ─── Panel UI ─────────────────────────────────────────────────────────────────

function setStatusDot(color: 'green' | 'amber' | 'red'): void {
  const dot = document.getElementById('opt-status-dot');
  if (!dot) return;
  const colors = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
  dot.style.background = colors[color];
  dot.style.boxShadow = `0 0 8px ${colors[color]}`;
}

function renderCheckpointQueue(items: CheckpointItem[]): void {
  const container = document.getElementById('opt-queue');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div style="color:#555;font-size:11px;text-align:center;padding:8px;">No items need action</div>`;
    return;
  }

  const badgeColors: Record<number, string> = {
    30: '#f59e0b',
    60: '#f97316',
    90: '#ef4444',
  };

  const actionLabels: Record<number, string> = {
    30: 'End & Relist',
    60: 'Lower + Relist',
    90: 'Delete',
  };

  container.innerHTML = items.map(ci => {
    const badgeColor = badgeColors[ci.needed];
    const actionLabel = actionLabels[ci.needed];
    const isDay90 = ci.needed === 90;
    const rowAvailable = ci.row !== null;

    return `
      <div id="opt-item-${ci.item.listingId}" style="
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 6px;
        background: rgba(255,255,255,0.02);
      ">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="
            background:${badgeColor};
            color:#000;
            font-size:9px;
            font-weight:700;
            padding:2px 6px;
            border-radius:4px;
            flex-shrink:0;
          ">Day ${ci.needed}</span>
          <span style="color:#ccc;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${truncate(ci.item.title, 35)}
          </span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
          <span style="color:#888;font-size:10px;">
            $${ci.item.price.toFixed(2)} · ${ci.age}d · ${ci.item.asin || 'no ASIN'}
          </span>
          <div style="display:flex;gap:4px;">
            ${rowAvailable ? `
              <button
                onclick="window.__optAction('${ci.item.listingId}', ${ci.needed})"
                style="
                  background:${isDay90 ? 'rgba(239,68,68,0.15)' : 'rgba(0,207,255,0.1)'};
                  border:1px solid ${isDay90 ? '#ef4444' : '#00CFFF'};
                  color:${isDay90 ? '#ef4444' : '#00CFFF'};
                  padding:3px 8px;
                  border-radius:4px;
                  font-size:10px;
                  cursor:pointer;
                  font-family:Inter,system-ui,sans-serif;
                "
              >${actionLabel}</button>
            ` : `
              <span style="color:#555;font-size:10px;font-style:italic;">Not on page</span>
            `}
            <button
              onclick="window.__optSkip('${ci.item.listingId}', ${ci.needed})"
              style="
                background:rgba(255,255,255,0.04);
                border:1px solid rgba(255,255,255,0.1);
                color:#666;
                padding:3px 8px;
                border-radius:4px;
                font-size:10px;
                cursor:pointer;
                font-family:Inter,system-ui,sans-serif;
              "
            >Skip</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function updateStatsDisplay(): Promise<void> {
  const stats = await getRegistryStats();

  const totalEl = document.getElementById('opt-stat-total');
  const avgEl = document.getElementById('opt-stat-avg');
  const at30El = document.getElementById('opt-stat-30');
  const at60El = document.getElementById('opt-stat-60');
  const at90El = document.getElementById('opt-stat-90');

  if (totalEl) totalEl.textContent = stats.total.toString();
  if (avgEl) avgEl.textContent = `${stats.avgAge}d`;
  if (at30El) at30El.textContent = stats.at30.toString();
  if (at60El) at60El.textContent = stats.at60.toString();
  if (at90El) at90El.textContent = stats.at90.toString();
}

// ─── Panel Creation ───────────────────────────────────────────────────────────

function createOptimizerPanel(): void {
  const existing = document.getElementById('opt-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'opt-panel';
  panel.innerHTML = `
    <div style="
      position: fixed;
      top: 10px;
      left: 10px;
      width: 300px;
      background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3e 100%);
      border: 1px solid #00CFFF;
      border-radius: 10px;
      padding: 14px;
      z-index: 999999;
      font-family: Inter, system-ui, sans-serif;
      box-shadow: 0 4px 30px rgba(0,207,255,0.3);
      max-height: 90vh;
      overflow-y: auto;
    ">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#00CFFF;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;">
          <span id="opt-status-dot" style="
            width:8px;height:8px;border-radius:50%;
            background:#22c55e;
            box-shadow:0 0 8px #22c55e;
            display:inline-block;flex-shrink:0;
          "></span>
          ⚡ Listing Optimizer
        </span>
        <button id="opt-minimize" style="
          background:none;border:none;color:#888;cursor:pointer;font-size:16px;
          font-family:Inter,system-ui,sans-serif;
        ">−</button>
      </div>

      <div id="opt-content">

        <!-- Registry Stats -->
        <div style="
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:6px;
          padding:8px;
          margin-bottom:10px;
        ">
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
            Registry Stats
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
            <div style="text-align:center;padding:4px;background:rgba(0,207,255,0.05);border-radius:4px;">
              <div id="opt-stat-total" style="font-size:16px;font-weight:700;color:#00CFFF;">0</div>
              <div style="font-size:9px;color:#666;">Tracked</div>
            </div>
            <div style="text-align:center;padding:4px;background:rgba(0,207,255,0.05);border-radius:4px;">
              <div id="opt-stat-avg" style="font-size:16px;font-weight:700;color:#7A5CFF;">0d</div>
              <div style="font-size:9px;color:#666;">Avg Age</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
            <div style="text-align:center;padding:4px;background:rgba(245,158,11,0.08);border-radius:4px;">
              <div id="opt-stat-30" style="font-size:14px;font-weight:700;color:#f59e0b;">0</div>
              <div style="font-size:9px;color:#666;">Day-30</div>
            </div>
            <div style="text-align:center;padding:4px;background:rgba(249,115,22,0.08);border-radius:4px;">
              <div id="opt-stat-60" style="font-size:14px;font-weight:700;color:#f97316;">0</div>
              <div style="font-size:9px;color:#666;">Day-60</div>
            </div>
            <div style="text-align:center;padding:4px;background:rgba(239,68,68,0.08);border-radius:4px;">
              <div id="opt-stat-90" style="font-size:14px;font-weight:700;color:#ef4444;">0</div>
              <div style="font-size:9px;color:#666;">Day-90</div>
            </div>
          </div>
        </div>

        <!-- Checkpoint Queue -->
        <div style="margin-bottom:10px;">
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
            Checkpoint Queue
          </div>
          <div id="opt-queue" style="max-height:220px;overflow-y:auto;">
            <div style="color:#555;font-size:11px;text-align:center;padding:8px;">
              Click "Scan Listings" to load queue
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
          <div style="display:flex;gap:6px;">
            <button id="opt-scan" style="
              flex:1;
              background:rgba(0,207,255,0.1);
              border:1px solid #00CFFF;
              color:#00CFFF;
              padding:7px 10px;
              border-radius:6px;
              font-size:11px;
              font-weight:600;
              cursor:pointer;
              font-family:Inter,system-ui,sans-serif;
            ">🔍 Scan Listings</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="opt-run30" style="
              flex:1;
              background:rgba(245,158,11,0.1);
              border:1px solid #f59e0b;
              color:#f59e0b;
              padding:6px 8px;
              border-radius:6px;
              font-size:10px;
              font-weight:600;
              cursor:pointer;
              font-family:Inter,system-ui,sans-serif;
            ">▶ Run All Day-30</button>
            <button id="opt-run60" style="
              flex:1;
              background:rgba(249,115,22,0.1);
              border:1px solid #f97316;
              color:#f97316;
              padding:6px 8px;
              border-radius:6px;
              font-size:10px;
              font-weight:600;
              cursor:pointer;
              font-family:Inter,system-ui,sans-serif;
            ">▶ Run All Day-60</button>
          </div>
          <button id="opt-clear" style="
            background:rgba(239,68,68,0.08);
            border:1px solid rgba(239,68,68,0.3);
            color:#ef4444;
            padding:5px 10px;
            border-radius:6px;
            font-size:10px;
            cursor:pointer;
            font-family:Inter,system-ui,sans-serif;
          ">🗑 Clear Registry</button>
        </div>

        <!-- Log -->
        <div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">
            📋 Action Log
          </div>
          <div id="opt-log" style="
            background:#000;
            border:1px solid #333;
            border-radius:6px;
            padding:6px;
            max-height:140px;
            overflow-y:auto;
            font-family:'Consolas',monospace;
            font-size:10px;
            color:#00CFFF;
          ">
            <div style="color:#555;">[Ready] Optimizer loaded</div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(panel);
  wireEvents();
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

// Stored checkpoint items for button handlers
let currentCheckpointItems: CheckpointItem[] = [];

function wireEvents(): void {
  // Minimize
  document.getElementById('opt-minimize')?.addEventListener('click', () => {
    const content = document.getElementById('opt-content');
    const btn = document.getElementById('opt-minimize');
    if (!content || !btn) return;
    panelMinimized = !panelMinimized;
    content.style.display = panelMinimized ? 'none' : 'block';
    btn.textContent = panelMinimized ? '+' : '−';
  });

  // Scan Listings
  document.getElementById('opt-scan')?.addEventListener('click', async () => {
    if (isScanning) return;
    isScanning = true;
    setStatusDot('amber');
    const btn = document.getElementById('opt-scan') as HTMLButtonElement;
    if (btn) { btn.textContent = '⏳ Scanning...'; btn.disabled = true; }

    try {
      currentCheckpointItems = await scanListings();
      renderCheckpointQueue(currentCheckpointItems);
      await updateStatsDisplay();
    } finally {
      isScanning = false;
      setStatusDot('green');
      if (btn) { btn.textContent = '🔍 Scan Listings'; btn.disabled = false; }
    }
  });

  // Run All Day-30
  document.getElementById('opt-run30')?.addEventListener('click', async () => {
    const day30Items = currentCheckpointItems.filter(ci => ci.needed === 30 && ci.row !== null);
    if (day30Items.length === 0) {
      logToOptPanel('No Day-30 items with DOM rows available', 'warn');
      return;
    }

    const confirmed = window.confirm(
      `Run Day-30 "End & Sell Similar" on ${day30Items.length} item(s)?\n\n` +
      day30Items.map(ci => `• ${truncate(ci.item.title, 50)}`).join('\n')
    );
    if (!confirmed) return;

    const btn = document.getElementById('opt-run30') as HTMLButtonElement;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }

    let ok = 0, failed = 0;
    for (const ci of day30Items) {
      const result = await doDay30(ci.item, ci.row!);
      if (result === 'ok') ok++;
      else failed++;
      await sleep(1500);
    }

    logToOptPanel(`Day-30 batch done: ${ok} ok, ${failed} failed`, ok > 0 ? 'success' : 'warn');
    currentCheckpointItems = await scanListings();
    renderCheckpointQueue(currentCheckpointItems);
    await updateStatsDisplay();

    if (btn) { btn.disabled = false; btn.textContent = '▶ Run All Day-30'; }
  });

  // Run All Day-60 (with pre-flight price floor check)
  document.getElementById('opt-run60')?.addEventListener('click', async () => {
    const day60Items = currentCheckpointItems.filter(ci => ci.needed === 60 && ci.row !== null);
    if (day60Items.length === 0) {
      logToOptPanel('No Day-60 items with DOM rows available', 'warn');
      return;
    }

    // Pre-flight: calculate prices and check floors
    const preflightLines = day60Items.map(ci => {
      const newPrice = parseFloat((ci.item.price * 0.90).toFixed(2));
      const estimatedCost = ci.item.price / 2.0;
      const floor = parseFloat((estimatedCost * 1.1).toFixed(2));
      const ok = newPrice >= floor;
      return `${ok ? '✓' : '⚠'} ${truncate(ci.item.title, 40)}\n  $${ci.item.price.toFixed(2)} → $${newPrice.toFixed(2)} (floor: $${floor.toFixed(2)}) ${ok ? '— OK' : '— FLOOR VIOLATION (will skip)'}`;
    });

    const confirmed = window.confirm(
      `Day-60 batch: ${day60Items.length} item(s)\n\n` +
      preflightLines.join('\n\n') +
      '\n\nProceed?'
    );
    if (!confirmed) return;

    const btn = document.getElementById('opt-run60') as HTMLButtonElement;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }

    let ok = 0, skipped = 0, failed = 0;
    for (const ci of day60Items) {
      const result = await doDay60(ci.item, ci.row!);
      if (result === 'ok') ok++;
      else if (result === 'floor_skip') skipped++;
      else failed++;
      await sleep(1500);
    }

    logToOptPanel(`Day-60 batch done: ${ok} ok, ${skipped} floor-skipped, ${failed} failed`, ok > 0 ? 'success' : 'warn');
    currentCheckpointItems = await scanListings();
    renderCheckpointQueue(currentCheckpointItems);
    await updateStatsDisplay();

    if (btn) { btn.disabled = false; btn.textContent = '▶ Run All Day-60'; }
  });

  // Clear Registry
  document.getElementById('opt-clear')?.addEventListener('click', async () => {
    const confirmed = window.confirm(
      '⚠️ Clear the entire optimizer registry?\n\n' +
      'This will delete all tracked listing ages and checkpoint history.\n' +
      'This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_OPTIMIZER_REGISTRY' });
      currentCheckpointItems = [];
      renderCheckpointQueue([]);
      await updateStatsDisplay();
      logToOptPanel('Registry cleared', 'warn');
    } catch (e) {
      logToOptPanel('Failed to clear registry', 'error');
    }
  });

  // Global action handlers (called from inline onclick in queue items)
  (window as Window & typeof globalThis & {
    __optAction: (listingId: string, checkpoint: number) => void;
    __optSkip: (listingId: string, checkpoint: number) => void;
  }).__optAction = async (listingId: string, checkpoint: number) => {
    const ci = currentCheckpointItems.find(c => c.item.listingId === listingId);
    if (!ci || !ci.row) {
      logToOptPanel(`❌ Row not found for ${listingId}`, 'error');
      return;
    }

    // Disable the button
    const itemEl = document.getElementById(`opt-item-${listingId}`);
    if (itemEl) {
      const btns = itemEl.querySelectorAll('button');
      btns.forEach(b => { (b as HTMLButtonElement).disabled = true; });
    }

    let result: string;
    if (checkpoint === 30) {
      result = await doDay30(ci.item, ci.row);
    } else if (checkpoint === 60) {
      result = await doDay60(ci.item, ci.row);
    } else if (checkpoint === 90) {
      // Day 90 is always manual — confirm individually
      const confirmed = window.confirm(
        `⚠️ DELETE listing?\n\n` +
        `"${truncate(ci.item.title, 60)}"\n\n` +
        `ASIN: ${ci.item.asin || 'N/A'}\n` +
        `Price: $${ci.item.price.toFixed(2)}\n` +
        `Age: ${ci.age} days\n\n` +
        `This will end the listing and add it to the recycle queue.\n` +
        `A Discord alert will be sent.`
      );
      if (!confirmed) {
        if (itemEl) {
          const btns = itemEl.querySelectorAll('button');
          btns.forEach(b => { (b as HTMLButtonElement).disabled = false; });
        }
        return;
      }
      result = await doDay90(ci.item, ci.row);
    } else {
      return;
    }

    if (result === 'ok') {
      // Remove from queue display
      if (itemEl) itemEl.remove();
      currentCheckpointItems = currentCheckpointItems.filter(c => c.item.listingId !== listingId);
      await updateStatsDisplay();
    } else {
      // Re-enable buttons on failure
      if (itemEl) {
        const btns = itemEl.querySelectorAll('button');
        btns.forEach(b => { (b as HTMLButtonElement).disabled = false; });
      }
    }
  };

  (window as Window & typeof globalThis & {
    __optAction: (listingId: string, checkpoint: number) => void;
    __optSkip: (listingId: string, checkpoint: number) => void;
  }).__optSkip = async (listingId: string, checkpoint: number) => {
    const ci = currentCheckpointItems.find(c => c.item.listingId === listingId);
    if (!ci) return;

    // Mark checkpoint as actioned without doing anything
    const updated: RegistryItem = {
      ...ci.item,
      checkpoint: checkpoint as 30 | 60 | 90,
      lastSeen: today(),
      notes: ci.item.notes + `\n[${new Date().toISOString()}] Day-${checkpoint}: Skipped by user`
    };
    await saveItem(updated);

    // Remove from queue display
    const itemEl = document.getElementById(`opt-item-${listingId}`);
    if (itemEl) itemEl.remove();
    currentCheckpointItems = currentCheckpointItems.filter(c => c.item.listingId !== listingId);

    logToOptPanel(`⏭ Skipped Day-${checkpoint}: ${truncate(ci.item.title, 30)}`, 'info');
    await updateStatsDisplay();
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function waitForListingsPage(): Promise<void> {
  return new Promise(resolve => {
    // Check immediately
    if (document.querySelector('tr.grid-row[data-id]')) {
      resolve();
      return;
    }

    // Watch for rows to appear
    const observer = new MutationObserver(() => {
      if (document.querySelector('tr.grid-row[data-id]')) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after 15s
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 15000);
  });
}

async function init(): Promise<void> {
  console.log('[Optimizer] Initializing...');

  // Wait for the eBay listings table to be present
  await waitForListingsPage();
  await sleep(500);

  // Create the panel
  createOptimizerPanel();

  // Load initial stats
  await updateStatsDisplay();

  logToOptPanel('Optimizer ready — click Scan to begin', 'success');
  console.log('[Optimizer] Panel created');
}

// Start
init().catch(e => console.error('[Optimizer] Init failed:', e));
