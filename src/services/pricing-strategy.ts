/**
 * Pricing Strategy Service
 * Dynamic pricing rules engine for eBay dropshipping.
 * Priority-based rule matching — first match wins.
 */

import { storage, InventoryItem } from './storage';

// ─── Storage Key ──────────────────────────────────────────────────────────────

export const PRICING_RULES_KEY = 'syndrax_pricing_rules';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type ConditionField = 'supplier_price' | 'margin' | 'category' | 'age_days' | 'stock_level';
export type ActionType = 'markup' | 'margin' | 'fixed_price' | 'percentage_reduction';
export type StockLevelValue = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface PricingCondition {
  field: ConditionField;
  // Numeric range conditions (supplier_price, margin, age_days)
  min?: number;
  max?: number;
  // String match condition (category)
  value?: string;
  // Stock level condition
  stockLevel?: StockLevelValue;
}

export interface PricingAction {
  type: ActionType;
  // markup: multiplier (e.g. 1.5 = 50% markup over supplier price)
  // margin: target margin as decimal (e.g. 0.30 = 30% margin)
  // fixed_price: exact price in dollars
  // percentage_reduction: reduction as decimal (e.g. 0.10 = 10% off current eBay price)
  value: number;
}

export interface PricingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;          // Lower number = higher priority (1 = first checked)
  conditions: PricingCondition[];
  action: PricingAction;
  createdAt: number;
  updatedAt: number;
}

export interface PricingAnalysisResult {
  item: InventoryItem;
  originalPrice: number;     // Current eBay price
  calculatedPrice: number;   // Price after rule application
  appliedRule: PricingRule | null;
  changeAmount: number;      // calculatedPrice - originalPrice
  changePercent: number;     // Percentage change
  currentMargin: number;     // Current margin % based on supplierPrice
  projectedMargin: number;   // Projected margin % after rule
  reason: string;            // Human-readable explanation
}

export interface PricingAnalysisSummary {
  totalItems: number;
  itemsWithRules: number;
  itemsNoRule: number;
  avgCurrentMargin: number;
  avgProjectedMargin: number;
  totalPriceIncrease: number;
  totalPriceDecrease: number;
  results: PricingAnalysisResult[];
}

// ─── Condition Evaluation ─────────────────────────────────────────────────────

function calcCurrentMargin(item: InventoryItem): number {
  if (!item.supplierPrice || item.supplierPrice <= 0 || !item.ebayPrice || item.ebayPrice <= 0) return 0;
  return ((item.ebayPrice - item.supplierPrice) / item.ebayPrice) * 100;
}

function calcAgeDays(item: InventoryItem): number {
  if (!item.lastScanned) return 0;
  const scanned = new Date(item.lastScanned).getTime();
  const now = Date.now();
  return Math.floor((now - scanned) / (1000 * 60 * 60 * 24));
}

function evaluateCondition(item: InventoryItem, condition: PricingCondition): boolean {
  switch (condition.field) {
    case 'supplier_price': {
      const price = item.supplierPrice ?? 0;
      if (condition.min !== undefined && price < condition.min) return false;
      if (condition.max !== undefined && price > condition.max) return false;
      return true;
    }
    case 'margin': {
      const margin = calcCurrentMargin(item);
      if (condition.min !== undefined && margin < condition.min) return false;
      if (condition.max !== undefined && margin > condition.max) return false;
      return true;
    }
    case 'category': {
      if (!condition.value) return true;
      const title = (item.title || '').toLowerCase();
      return title.includes(condition.value.toLowerCase());
    }
    case 'age_days': {
      const age = calcAgeDays(item);
      if (condition.min !== undefined && age < condition.min) return false;
      if (condition.max !== undefined && age > condition.max) return false;
      return true;
    }
    case 'stock_level': {
      if (!condition.stockLevel) return true;
      return item.stockLevel === condition.stockLevel;
    }
    default:
      return false;
  }
}

/**
 * Returns true if ALL conditions in the rule match the item (AND logic).
 * An empty conditions array always matches.
 */
export function evaluateConditions(item: InventoryItem, conditions: PricingCondition[]): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(item, c));
}

// ─── Action Application ───────────────────────────────────────────────────────

/**
 * Calculate the new price based on the action type.
 * @param supplierPrice - The supplier cost (used for markup/margin)
 * @param currentEbayPrice - The current eBay listing price (used for percentage_reduction)
 * @param action - The pricing action to apply
 */
export function applyAction(
  supplierPrice: number,
  currentEbayPrice: number,
  action: PricingAction
): number {
  switch (action.type) {
    case 'markup':
      // newPrice = supplierPrice × multiplier
      // e.g. value=1.5 → 50% markup over cost
      if (supplierPrice <= 0) return currentEbayPrice;
      return Math.round(supplierPrice * action.value * 100) / 100;

    case 'margin':
      // newPrice = supplierPrice / (1 - marginDecimal)
      // e.g. value=0.30 → 30% margin (supplier is 70% of selling price)
      if (supplierPrice <= 0) return currentEbayPrice;
      if (action.value >= 1) return currentEbayPrice; // Invalid margin
      return Math.round((supplierPrice / (1 - action.value)) * 100) / 100;

    case 'fixed_price':
      // newPrice = fixed amount
      return Math.round(action.value * 100) / 100;

    case 'percentage_reduction':
      // newPrice = currentPrice × (1 - reductionDecimal)
      // e.g. value=0.10 → 10% off current eBay price
      return Math.round(currentEbayPrice * (1 - action.value) * 100) / 100;

    default:
      return currentEbayPrice;
  }
}

// ─── Rule Application ─────────────────────────────────────────────────────────

/**
 * Apply pricing rules to a single inventory item.
 * Rules are sorted by priority (ascending). First match wins.
 */
export function applyPricingRules(
  item: InventoryItem,
  rules: PricingRule[]
): PricingAnalysisResult {
  const originalPrice = item.ebayPrice ?? 0;
  const supplierPrice = item.supplierPrice ?? 0;
  const currentMargin = calcCurrentMargin(item);

  // Sort enabled rules by priority
  const activeRules = rules
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (evaluateConditions(item, rule.conditions)) {
      const calculatedPrice = applyAction(supplierPrice, originalPrice, rule.action);
      const changeAmount = calculatedPrice - originalPrice;
      const changePercent = originalPrice > 0
        ? ((calculatedPrice - originalPrice) / originalPrice) * 100
        : 0;
      const projectedMargin = calculatedPrice > 0 && supplierPrice > 0
        ? ((calculatedPrice - supplierPrice) / calculatedPrice) * 100
        : 0;

      return {
        item,
        originalPrice,
        calculatedPrice,
        appliedRule: rule,
        changeAmount,
        changePercent,
        currentMargin,
        projectedMargin,
        reason: `Rule "${rule.name}" matched`,
      };
    }
  }

  // No rule matched
  return {
    item,
    originalPrice,
    calculatedPrice: originalPrice,
    appliedRule: null,
    changeAmount: 0,
    changePercent: 0,
    currentMargin,
    projectedMargin: currentMargin,
    reason: 'No matching rule',
  };
}

// ─── Batch Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze pricing across all inventory items.
 */
export function analyzePricing(
  inventory: InventoryItem[],
  rules: PricingRule[]
): PricingAnalysisSummary {
  const results = inventory.map(item => applyPricingRules(item, rules));

  const itemsWithRules = results.filter(r => r.appliedRule !== null).length;
  const itemsNoRule = results.length - itemsWithRules;

  const margins = results.map(r => r.currentMargin).filter(m => m > 0);
  const projectedMargins = results.map(r => r.projectedMargin).filter(m => m > 0);

  const avgCurrentMargin = margins.length > 0
    ? margins.reduce((a, b) => a + b, 0) / margins.length
    : 0;
  const avgProjectedMargin = projectedMargins.length > 0
    ? projectedMargins.reduce((a, b) => a + b, 0) / projectedMargins.length
    : 0;

  const totalPriceIncrease = results.filter(r => r.changeAmount > 0).length;
  const totalPriceDecrease = results.filter(r => r.changeAmount < 0).length;

  return {
    totalItems: results.length,
    itemsWithRules,
    itemsNoRule,
    avgCurrentMargin,
    avgProjectedMargin,
    totalPriceIncrease,
    totalPriceDecrease,
    results,
  };
}

// ─── Rule Validation ──────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRule(rule: Partial<PricingRule>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!rule.name || rule.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Rule name is required' });
  }

  if (!rule.action) {
    errors.push({ field: 'action', message: 'Action is required' });
  } else {
    if (rule.action.value === undefined || rule.action.value === null) {
      errors.push({ field: 'action.value', message: 'Action value is required' });
    } else {
      switch (rule.action.type) {
        case 'markup':
          if (rule.action.value <= 0) {
            errors.push({ field: 'action.value', message: 'Markup multiplier must be > 0 (e.g. 1.5 = 50% markup)' });
          }
          break;
        case 'margin':
          if (rule.action.value <= 0 || rule.action.value >= 1) {
            errors.push({ field: 'action.value', message: 'Margin must be between 0 and 1 (e.g. 0.30 = 30%)' });
          }
          break;
        case 'fixed_price':
          if (rule.action.value <= 0) {
            errors.push({ field: 'action.value', message: 'Fixed price must be > 0' });
          }
          break;
        case 'percentage_reduction':
          if (rule.action.value <= 0 || rule.action.value >= 1) {
            errors.push({ field: 'action.value', message: 'Reduction must be between 0 and 1 (e.g. 0.10 = 10%)' });
          }
          break;
      }
    }
  }

  return errors;
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

export async function loadRules(): Promise<PricingRule[]> {
  return (await storage.get<PricingRule[]>(PRICING_RULES_KEY)) || [];
}

export async function saveRules(rules: PricingRule[]): Promise<void> {
  await storage.set(PRICING_RULES_KEY, rules);
}

export function createRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: crypto.randomUUID(),
    name: 'New Rule',
    enabled: true,
    priority: 10,
    conditions: [],
    action: { type: 'markup', value: 1.5 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export function formatActionSummary(action: PricingAction): string {
  switch (action.type) {
    case 'markup':
      return `${action.value}× markup (${((action.value - 1) * 100).toFixed(0)}% over cost)`;
    case 'margin':
      return `${(action.value * 100).toFixed(0)}% margin target`;
    case 'fixed_price':
      return `Fixed $${action.value.toFixed(2)}`;
    case 'percentage_reduction':
      return `${(action.value * 100).toFixed(0)}% price reduction`;
    default:
      return 'Unknown action';
  }
}

export function formatConditionSummary(conditions: PricingCondition[]): string {
  if (conditions.length === 0) return 'All items';
  return conditions.map(c => {
    switch (c.field) {
      case 'supplier_price':
        if (c.min !== undefined && c.max !== undefined) return `cost $${c.min}–$${c.max}`;
        if (c.min !== undefined) return `cost ≥ $${c.min}`;
        if (c.max !== undefined) return `cost ≤ $${c.max}`;
        return 'any cost';
      case 'margin':
        if (c.min !== undefined && c.max !== undefined) return `margin ${c.min}–${c.max}%`;
        if (c.min !== undefined) return `margin ≥ ${c.min}%`;
        if (c.max !== undefined) return `margin ≤ ${c.max}%`;
        return 'any margin';
      case 'category':
        return `title contains "${c.value}"`;
      case 'age_days':
        if (c.min !== undefined && c.max !== undefined) return `age ${c.min}–${c.max}d`;
        if (c.min !== undefined) return `age ≥ ${c.min}d`;
        if (c.max !== undefined) return `age ≤ ${c.max}d`;
        return 'any age';
      case 'stock_level':
        return `stock: ${c.stockLevel}`;
      default:
        return c.field;
    }
  }).join(' AND ');
}
