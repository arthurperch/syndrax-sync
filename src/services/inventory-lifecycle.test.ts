/**
 * inventory-lifecycle.test.ts — Unit tests for 90-day lifecycle engine
 */

import { describe, it, expect } from 'vitest';
import { getLifecycleStage, buildLifecycleItem } from './inventory-lifecycle';
import type { InventoryItem } from './storage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    listingId: 'test-123',
    title: 'Test Product Title',
    ebayPrice: 50,
    quantity: 1,
    customLabel: '',
    asin: 'B001234567',
    sourceUrl: 'https://amazon.com/dp/B001234567',
    sourcePlatform: 'amazon',
    imageUrl: '',
    listingUrl: '',
    lastScanned: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    supplierPrice: 20,
    inStock: true,
    stockLevel: 'in_stock',
    ...overrides,
  };
}

// ─── getLifecycleStage() ──────────────────────────────────────────────────────

describe('getLifecycleStage()', () => {
  it('ageDays=5 → stage=fresh, urgency=none', () => {
    const result = getLifecycleStage(5, 50, 20);
    expect(result.stage).toBe('fresh');
    expect(result.urgency).toBe('none');
    expect(result.recommendedAction).toBe('hold');
  });

  it('ageDays=20 → stage=active, urgency=low', () => {
    const result = getLifecycleStage(20, 50, 20);
    expect(result.stage).toBe('active');
    expect(result.urgency).toBe('low');
    expect(result.recommendedAction).toBe('hold');
  });

  it('ageDays=45 → stage=aging, urgency=medium', () => {
    const result = getLifecycleStage(45, 50, 20);
    expect(result.stage).toBe('aging');
    expect(result.urgency).toBe('medium');
    expect(result.recommendedAction).toBe('markdown_5');
  });

  it('ageDays=65 → stage=stale, urgency=high', () => {
    const result = getLifecycleStage(65, 50, 20);
    expect(result.stage).toBe('stale');
    expect(result.urgency).toBe('high');
    expect(result.recommendedAction).toBe('markdown_10');
  });

  it('ageDays=80 → stage=clearance, urgency=critical', () => {
    const result = getLifecycleStage(80, 50, 20);
    expect(result.stage).toBe('clearance');
    expect(result.urgency).toBe('critical');
    expect(result.recommendedAction).toBe('markdown_20');
  });

  it('ageDays=88 → stage=dead, urgency=critical', () => {
    const result = getLifecycleStage(88, 50, 20);
    expect(result.stage).toBe('dead');
    expect(result.urgency).toBe('critical');
  });

  it('dead stage: current price >= minimumViablePrice → action=relist', () => {
    // supplierPrice=20, minimumViablePrice=21.60, currentPrice=50 → relist
    const result = getLifecycleStage(88, 50, 20);
    expect(result.recommendedAction).toBe('relist');
  });

  it('dead stage: current price < minimumViablePrice → action=end_listing', () => {
    // supplierPrice=20, minimumViablePrice=21.60, currentPrice=15 → end_listing
    const result = getLifecycleStage(88, 15, 20);
    expect(result.recommendedAction).toBe('end_listing');
  });

  it('markdown would breach minimumViablePrice → action=end_listing', () => {
    // aging stage (markdown_5): currentPrice=21, supplierPrice=20
    // minimumViablePrice = 20 * 1.08 = 21.60
    // projected = 21 * 0.95 = 19.95 < 21.60 → end_listing
    const result = getLifecycleStage(45, 21, 20);
    expect(result.recommendedAction).toBe('end_listing');
  });

  it('nextStageAt is set to the next threshold boundary', () => {
    const fresh = getLifecycleStage(5, 50, 20);
    expect(fresh.nextStageAt).toBe(15);

    const active = getLifecycleStage(20, 50, 20);
    expect(active.nextStageAt).toBe(31);

    const aging = getLifecycleStage(45, 50, 20);
    expect(aging.nextStageAt).toBe(61);
  });

  it('daysInStage is calculated correctly', () => {
    // active starts at day 15, so day 20 → daysInStage = 5
    const result = getLifecycleStage(20, 50, 20);
    expect(result.daysInStage).toBe(5);
  });
});

// ─── buildLifecycleItem() ─────────────────────────────────────────────────────

describe('buildLifecycleItem()', () => {
  it('minimumViablePrice = supplierPrice * 1.08', () => {
    const item = makeItem({ supplierPrice: 25 });
    const result = buildLifecycleItem(item);
    expect(result.minimumViablePrice).toBeCloseTo(25 * 1.08, 5);
  });

  it('profitAtCurrentPrice = ebayPrice - supplierPrice', () => {
    const item = makeItem({ ebayPrice: 50, supplierPrice: 20 });
    const result = buildLifecycleItem(item);
    expect(result.profitAtCurrentPrice).toBeCloseTo(30, 5);
  });

  it('ageDays > 0 for items with past lastScanned date', () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ lastScanned: pastDate });
    const result = buildLifecycleItem(item);
    expect(result.ageDays).toBeGreaterThan(0);
  });

  it('ageDays is approximately correct for known past date', () => {
    const daysAgo = 45;
    const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ lastScanned: pastDate });
    const result = buildLifecycleItem(item);
    // Allow ±1 day for timing precision
    expect(result.ageDays).toBeGreaterThanOrEqual(daysAgo - 1);
    expect(result.ageDays).toBeLessThanOrEqual(daysAgo + 1);
  });

  it('profitAtRecommendedPrice is 0 when action is end_listing', () => {
    // Force end_listing: price below minimum viable
    const item = makeItem({ ebayPrice: 21, supplierPrice: 20, lastScanned: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() });
    const result = buildLifecycleItem(item);
    if (result.stage.recommendedAction === 'end_listing') {
      expect(result.profitAtRecommendedPrice).toBe(0);
    }
  });

  it('returns correct listingId and title from source item', () => {
    const item = makeItem({ listingId: 'ebay-999', title: 'My Test Product' });
    const result = buildLifecycleItem(item);
    expect(result.listingId).toBe('ebay-999');
    expect(result.title).toBe('My Test Product');
  });
});
