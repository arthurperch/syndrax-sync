/**
 * pricing-strategy.test.ts — Unit tests for pricing rules engine
 */

import { describe, it, expect } from 'vitest';
import { evaluateConditions, applyAction, applyPricingRules } from './pricing-strategy';
import type { InventoryItem } from './storage';
import type { PricingCondition, PricingRule } from './pricing-strategy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    listingId: 'test-001',
    title: 'Test Product',
    ebayPrice: 100,
    quantity: 1,
    customLabel: '',
    asin: 'B001234567',
    sourceUrl: '',
    sourcePlatform: 'amazon',
    imageUrl: '',
    listingUrl: '',
    lastScanned: new Date().toISOString(),
    supplierPrice: 50,
    inStock: true,
    stockLevel: 'in_stock',
    ...overrides,
  };
}

function makeRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: 'rule-001',
    name: 'Test Rule',
    enabled: true,
    priority: 1,
    conditions: [],
    action: { type: 'markup', value: 2 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─── evaluateConditions() ─────────────────────────────────────────────────────

describe('evaluateConditions()', () => {
  it('supplier_price min=50 matches item with supplierPrice=60', () => {
    const item = makeItem({ supplierPrice: 60 });
    const conditions: PricingCondition[] = [{ field: 'supplier_price', min: 50 }];
    expect(evaluateConditions(item, conditions)).toBe(true);
  });

  it('supplier_price min=50 does NOT match item with supplierPrice=40', () => {
    const item = makeItem({ supplierPrice: 40 });
    const conditions: PricingCondition[] = [{ field: 'supplier_price', min: 50 }];
    expect(evaluateConditions(item, conditions)).toBe(false);
  });

  it('multiple conditions use AND logic — all must match', () => {
    const item = makeItem({ supplierPrice: 60, ebayPrice: 120, stockLevel: 'in_stock' });
    // Both conditions must match
    const conditions: PricingCondition[] = [
      { field: 'supplier_price', min: 50 },
      { field: 'stock_level', stockLevel: 'in_stock' },
    ];
    expect(evaluateConditions(item, conditions)).toBe(true);
  });

  it('multiple conditions — fails if any one does not match', () => {
    const item = makeItem({ supplierPrice: 40, stockLevel: 'in_stock' });
    const conditions: PricingCondition[] = [
      { field: 'supplier_price', min: 50 }, // fails
      { field: 'stock_level', stockLevel: 'in_stock' }, // passes
    ];
    expect(evaluateConditions(item, conditions)).toBe(false);
  });

  it('empty conditions array always matches', () => {
    const item = makeItem();
    expect(evaluateConditions(item, [])).toBe(true);
  });

  it('supplier_price max condition works correctly', () => {
    const item = makeItem({ supplierPrice: 30 });
    const conditions: PricingCondition[] = [{ field: 'supplier_price', max: 50 }];
    expect(evaluateConditions(item, conditions)).toBe(true);
  });

  it('supplier_price max condition fails when price exceeds max', () => {
    const item = makeItem({ supplierPrice: 80 });
    const conditions: PricingCondition[] = [{ field: 'supplier_price', max: 50 }];
    expect(evaluateConditions(item, conditions)).toBe(false);
  });
});

// ─── applyAction() ────────────────────────────────────────────────────────────

describe('applyAction()', () => {
  it('markup type: value=2 on $10 supplier → $20', () => {
    // markup: newPrice = supplierPrice × value
    const result = applyAction(10, 15, { type: 'markup', value: 2 });
    expect(result).toBe(20);
  });

  it('margin type: value=0.5 on $10 supplier → $20', () => {
    // margin: newPrice = supplierPrice / (1 - 0.5) = 10 / 0.5 = 20
    const result = applyAction(10, 15, { type: 'margin', value: 0.5 });
    expect(result).toBe(20);
  });

  it('percentage_reduction type: value=0.10 on $100 current → $90', () => {
    // percentage_reduction: newPrice = currentPrice × (1 - 0.10) = 100 × 0.90 = 90
    const result = applyAction(50, 100, { type: 'percentage_reduction', value: 0.10 });
    expect(result).toBe(90);
  });

  it('fixed_price type: value=25 → $25 regardless of input', () => {
    const result = applyAction(10, 999, { type: 'fixed_price', value: 25 });
    expect(result).toBe(25);
  });

  it('fixed_price type: value=25 → $25 even with different supplier price', () => {
    const result = applyAction(100, 50, { type: 'fixed_price', value: 25 });
    expect(result).toBe(25);
  });

  it('markup with supplierPrice=0 returns currentEbayPrice unchanged', () => {
    const result = applyAction(0, 50, { type: 'markup', value: 2 });
    expect(result).toBe(50);
  });
});

// ─── applyPricingRules() ──────────────────────────────────────────────────────

describe('applyPricingRules()', () => {
  it('higher priority rule wins when both conditions match', () => {
    const item = makeItem({ supplierPrice: 10, ebayPrice: 20 });
    const rules: PricingRule[] = [
      makeRule({
        id: 'rule-low-priority',
        name: 'Low Priority',
        priority: 2,
        conditions: [],
        action: { type: 'fixed_price', value: 99 },
      }),
      makeRule({
        id: 'rule-high-priority',
        name: 'High Priority',
        priority: 1,
        conditions: [],
        action: { type: 'fixed_price', value: 25 },
      }),
    ];
    const result = applyPricingRules(item, rules);
    // Priority 1 wins → price = 25
    expect(result.calculatedPrice).toBe(25);
    expect(result.appliedRule?.name).toBe('High Priority');
  });

  it('returns original price when no rules match', () => {
    const item = makeItem({ supplierPrice: 10, ebayPrice: 50 });
    // Condition that won't match
    const rules: PricingRule[] = [
      makeRule({
        conditions: [{ field: 'supplier_price', min: 999 }], // won't match
        action: { type: 'fixed_price', value: 1 },
      }),
    ];
    const result = applyPricingRules(item, rules);
    expect(result.calculatedPrice).toBe(50); // unchanged
    expect(result.appliedRule).toBeNull();
  });

  it('disabled rules are skipped', () => {
    const item = makeItem({ supplierPrice: 10, ebayPrice: 50 });
    const rules: PricingRule[] = [
      makeRule({
        enabled: false,
        conditions: [],
        action: { type: 'fixed_price', value: 1 }, // would change price drastically
      }),
    ];
    const result = applyPricingRules(item, rules);
    // Disabled rule skipped → no rule applied
    expect(result.appliedRule).toBeNull();
    expect(result.calculatedPrice).toBe(50);
  });

  it('returns correct changeAmount and changePercent', () => {
    const item = makeItem({ supplierPrice: 10, ebayPrice: 100 });
    const rules: PricingRule[] = [
      makeRule({
        conditions: [],
        action: { type: 'fixed_price', value: 80 },
      }),
    ];
    const result = applyPricingRules(item, rules);
    expect(result.changeAmount).toBeCloseTo(-20, 5);
    expect(result.changePercent).toBeCloseTo(-20, 5);
  });
});
