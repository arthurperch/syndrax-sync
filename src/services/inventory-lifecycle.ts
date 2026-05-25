/**
 * inventory-lifecycle.ts — 90-Day Inventory Lifecycle Engine
 * Age tracking, markdown trigger logic, and clearance automation.
 */

import { InventoryItem } from './storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifecycleStage {
  stage: 'fresh' | 'active' | 'aging' | 'stale' | 'clearance' | 'dead';
  ageDays: number;
  daysInStage: number;
  nextStageAt: number;       // age in days when next stage triggers
  recommendedAction: 'hold' | 'markdown_5' | 'markdown_10' | 'markdown_20' | 'end_listing' | 'relist';
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface LifecycleItem {
  listingId: string;
  title: string;
  currentPrice: number;
  supplierPrice: number;
  ageDays: number;
  stage: LifecycleStage;
  listedAt: string;          // ISO date when first listed (proxy: lastScanned)
  lastSaleAt: string | null;
  salesCount: number;
  profitAtCurrentPrice: number;
  profitAtRecommendedPrice: number;
  minimumViablePrice: number; // supplierPrice * 1.08 (8% min margin)
}

export interface LifecycleOverride {
  snoozedUntil: string;      // ISO date string
  manualStage?: string;
}

// ─── Stage thresholds ─────────────────────────────────────────────────────────

const STAGE_THRESHOLDS = {
  fresh:     { min: 0,  max: 14,  next: 15 },
  active:    { min: 15, max: 30,  next: 31 },
  aging:     { min: 31, max: 60,  next: 61 },
  stale:     { min: 61, max: 75,  next: 76 },
  clearance: { min: 76, max: 85,  next: 86 },
  dead:      { min: 86, max: 999, next: 999 },
} as const;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Determine lifecycle stage from age and price constraints.
 * Clamps recommended action to never go below minimumViablePrice.
 */
export function getLifecycleStage(
  ageDays: number,
  currentPrice: number,
  supplierPrice: number
): LifecycleStage {
  const minimumViablePrice = supplierPrice * 1.08;

  // Determine raw stage from age
  let stage: LifecycleStage['stage'];
  let daysInStage: number;
  let nextStageAt: number;
  let rawAction: LifecycleStage['recommendedAction'];
  let urgency: LifecycleStage['urgency'];

  if (ageDays <= 14) {
    stage = 'fresh';
    daysInStage = ageDays;
    nextStageAt = STAGE_THRESHOLDS.fresh.next;
    rawAction = 'hold';
    urgency = 'none';
  } else if (ageDays <= 30) {
    stage = 'active';
    daysInStage = ageDays - STAGE_THRESHOLDS.active.min;
    nextStageAt = STAGE_THRESHOLDS.active.next;
    rawAction = 'hold';
    urgency = 'low';
  } else if (ageDays <= 60) {
    stage = 'aging';
    daysInStage = ageDays - STAGE_THRESHOLDS.aging.min;
    nextStageAt = STAGE_THRESHOLDS.aging.next;
    rawAction = 'markdown_5';
    urgency = 'medium';
  } else if (ageDays <= 75) {
    stage = 'stale';
    daysInStage = ageDays - STAGE_THRESHOLDS.stale.min;
    nextStageAt = STAGE_THRESHOLDS.stale.next;
    rawAction = 'markdown_10';
    urgency = 'high';
  } else if (ageDays <= 85) {
    stage = 'clearance';
    daysInStage = ageDays - STAGE_THRESHOLDS.clearance.min;
    nextStageAt = STAGE_THRESHOLDS.clearance.next;
    rawAction = 'markdown_20';
    urgency = 'critical';
  } else {
    stage = 'dead';
    daysInStage = ageDays - STAGE_THRESHOLDS.dead.min;
    nextStageAt = STAGE_THRESHOLDS.dead.next;
    rawAction = 'end_listing'; // will be resolved below
    urgency = 'critical';
  }

  // Clamp action: check if markdown would breach minimum viable price
  let recommendedAction = rawAction;

  if (rawAction === 'markdown_5') {
    const projectedPrice = currentPrice * 0.95;
    if (projectedPrice < minimumViablePrice) {
      recommendedAction = 'end_listing';
    }
  } else if (rawAction === 'markdown_10') {
    const projectedPrice = currentPrice * 0.90;
    if (projectedPrice < minimumViablePrice) {
      recommendedAction = 'end_listing';
    }
  } else if (rawAction === 'markdown_20') {
    const projectedPrice = currentPrice * 0.80;
    if (projectedPrice < minimumViablePrice) {
      recommendedAction = 'end_listing';
    }
  } else if (rawAction === 'end_listing' && stage === 'dead') {
    // Dead stage: end_listing if markdown would go below minimum, else relist at original
    // Since we're at dead stage, check if current price is still above minimum
    if (currentPrice >= minimumViablePrice) {
      recommendedAction = 'relist';
    } else {
      recommendedAction = 'end_listing';
    }
  }

  return {
    stage,
    ageDays,
    daysInStage,
    nextStageAt,
    recommendedAction,
    urgency,
  };
}

/**
 * Calculate the recommended price based on action.
 */
export function getRecommendedPrice(
  currentPrice: number,
  action: LifecycleStage['recommendedAction'],
  supplierPrice: number
): number {
  const minimumViablePrice = supplierPrice * 1.08;

  switch (action) {
    case 'markdown_5':
      return Math.max(currentPrice * 0.95, minimumViablePrice);
    case 'markdown_10':
      return Math.max(currentPrice * 0.90, minimumViablePrice);
    case 'markdown_20':
      return Math.max(currentPrice * 0.80, minimumViablePrice);
    case 'hold':
    case 'relist':
      return currentPrice;
    case 'end_listing':
      return 0; // No price — listing ends
    default:
      return currentPrice;
  }
}

/**
 * Build a LifecycleItem from a raw InventoryItem.
 * Uses lastScanned as proxy for listed date.
 */
export function buildLifecycleItem(item: InventoryItem): LifecycleItem {
  const minimumViablePrice = item.supplierPrice * 1.08;

  // Calculate age from lastScanned (proxy for listed date)
  const listedAt = item.lastScanned || new Date().toISOString();
  const listedDate = new Date(listedAt);
  const now = new Date();
  const ageDays = Math.floor((now.getTime() - listedDate.getTime()) / (1000 * 60 * 60 * 24));

  const currentPrice = item.ebayPrice || 0;
  const supplierPrice = item.supplierPrice || 0;

  const stage = getLifecycleStage(ageDays, currentPrice, supplierPrice);
  const recommendedPrice = getRecommendedPrice(currentPrice, stage.recommendedAction, supplierPrice);

  // Profit calculations (simple: price - supplierPrice)
  const profitAtCurrentPrice = currentPrice - supplierPrice;
  const profitAtRecommendedPrice = stage.recommendedAction === 'end_listing'
    ? 0
    : recommendedPrice - supplierPrice;

  return {
    listingId: item.listingId,
    title: item.title || 'Untitled',
    currentPrice,
    supplierPrice,
    ageDays,
    stage,
    listedAt,
    lastSaleAt: null,   // Not tracked in current InventoryItem schema
    salesCount: 0,      // Not tracked in current InventoryItem schema
    profitAtCurrentPrice,
    profitAtRecommendedPrice,
    minimumViablePrice,
  };
}

/**
 * Run a full lifecycle scan across all inventory items.
 * Returns enriched items and a summary breakdown.
 */
export function runLifecycleScan(inventory: InventoryItem[]): {
  items: LifecycleItem[];
  summary: {
    fresh: number;
    active: number;
    aging: number;
    stale: number;
    clearance: number;
    dead: number;
    totalActionNeeded: number;
    estimatedRevenueLoss: number;
  };
} {
  const items = inventory.map(buildLifecycleItem);

  const summary = {
    fresh: 0,
    active: 0,
    aging: 0,
    stale: 0,
    clearance: 0,
    dead: 0,
    totalActionNeeded: 0,
    estimatedRevenueLoss: 0,
  };

  for (const item of items) {
    const s = item.stage.stage;
    summary[s]++;

    // Count items that need action (not hold)
    if (item.stage.recommendedAction !== 'hold') {
      summary.totalActionNeeded++;
    }

    // Estimate revenue loss = price reduction amount
    const priceDelta = item.currentPrice - getRecommendedPrice(
      item.currentPrice,
      item.stage.recommendedAction,
      item.supplierPrice
    );
    if (priceDelta > 0) {
      summary.estimatedRevenueLoss += priceDelta;
    }
  }

  return { items, summary };
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

const LIFECYCLE_OVERRIDES_KEY = 'lifecycle_overrides';

export async function getLifecycleOverrides(): Promise<Map<string, LifecycleOverride>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return new Map();
    }
    const result = await chrome.storage.local.get(LIFECYCLE_OVERRIDES_KEY);
    const raw = result[LIFECYCLE_OVERRIDES_KEY] as Record<string, LifecycleOverride> | undefined;
    if (!raw) return new Map();
    return new Map(Object.entries(raw));
  } catch {
    return new Map();
  }
}

export async function setLifecycleOverride(
  listingId: string,
  override: LifecycleOverride
): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const existing = await getLifecycleOverrides();
    existing.set(listingId, override);
    const raw = Object.fromEntries(existing.entries());
    await chrome.storage.local.set({ [LIFECYCLE_OVERRIDES_KEY]: raw });
  } catch {
    // Silently fail in non-extension context
  }
}

export async function clearOverride(listingId: string): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const existing = await getLifecycleOverrides();
    existing.delete(listingId);
    const raw = Object.fromEntries(existing.entries());
    await chrome.storage.local.set({ [LIFECYCLE_OVERRIDES_KEY]: raw });
  } catch {
    // Silently fail in non-extension context
  }
}

/**
 * Store applied price updates for audit trail.
 */
export async function applyLifecyclePriceUpdate(
  listingId: string,
  newPrice: number
): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const result = await chrome.storage.local.get('lifecycle_price_updates');
    const updates: Array<{ listingId: string; newPrice: number; appliedAt: string }> =
      result['lifecycle_price_updates'] || [];
    // Remove any existing entry for this listing
    const filtered = updates.filter(u => u.listingId !== listingId);
    filtered.push({ listingId, newPrice, appliedAt: new Date().toISOString() });
    await chrome.storage.local.set({ lifecycle_price_updates: filtered });
  } catch {
    // Silently fail in non-extension context
  }
}
