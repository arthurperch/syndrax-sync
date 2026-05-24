/**
 * order-intelligence.ts — Order routing intelligence service
 * Analyzes orders against inventory to recommend fulfillment route.
 */

import type { Order, InventoryItem, Settings, OrderIntelligence } from './storage';

export function analyzeOrder(
  order: Order,
  inventory: InventoryItem[],
  _settings: Settings
): OrderIntelligence {
  // Step 1: Find matching inventory item by title substring or ASIN
  const orderTitleLower = order.itemTitle.toLowerCase();
  const match = inventory.find(item => {
    const itemTitleLower = item.title.toLowerCase();
    // Substring match: either direction
    if (itemTitleLower.includes(orderTitleLower) || orderTitleLower.includes(itemTitleLower)) {
      return true;
    }
    // ASIN match if available in itemId
    if (order.itemId && item.asin && order.itemId === item.asin) {
      return true;
    }
    return false;
  });

  // Step 2: No match found
  if (!match) {
    return {
      route: 'manual',
      confidence: 'low',
      reason: 'Item not found in inventory',
      margin: 0,
      supplierPrice: 0,
      profit: 0,
      riskFlags: ['UNKNOWN_ITEM']
    };
  }

  // Step 3: Match found — calculate financials
  const supplierPrice = match.supplierPrice;
  const profit = order.salePrice - supplierPrice;
  const margin = supplierPrice > 0 ? (profit / order.salePrice) * 100 : 0;

  const riskFlags: OrderIntelligence['riskFlags'] = [];
  let route: OrderIntelligence['route'] = 'manual';
  let confidence: OrderIntelligence['confidence'] = 'low';
  let reason = '';

  // Out of stock check
  if (match.stockLevel === 'out_of_stock') {
    route = 'aliexpress';
    confidence = 'medium';
    reason = 'Item is out of stock on Amazon — routing to AliExpress';
    riskFlags.push('OUT_OF_STOCK');
  } else if (margin >= 15 && match.inStock) {
    route = 'amazon';
    confidence = 'high';
    reason = `Strong margin of ${margin.toFixed(1)}% with item in stock`;
  } else if (margin >= 8) {
    route = 'amazon';
    confidence = 'medium';
    reason = `Acceptable margin of ${margin.toFixed(1)}% — fulfil via Amazon`;
  } else if (margin >= 3) {
    route = 'aliexpress';
    confidence = 'medium';
    reason = `Low Amazon margin — AliExpress may offer better cost`;
  } else {
    route = 'manual';
    confidence = 'low';
    reason = `Margin too low (${margin.toFixed(1)}%) — manual review required`;
    riskFlags.push('LOW_MARGIN');
  }

  // Unknown supplier price
  if (supplierPrice === 0) {
    riskFlags.push('UNKNOWN_ITEM');
    confidence = 'low';
    if (!reason) {
      reason = 'Supplier price unknown — manual review required';
    }
  }

  return {
    route,
    confidence,
    reason,
    margin,
    supplierPrice,
    profit,
    riskFlags
  };
}
