/**
 * eBay Payment Details Extractor
 * 
 * Extracts payment data from eBay payment details page:
 * https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=ORDER_ID
 * 
 * SAFETY: READ-ONLY - Only extracts data, no clicks on destructive buttons
 * 
 * Key value to extract: "Order earnings" - net after eBay fees
 */

import { EbayPaymentDetails, FundsStatus } from '../types';
import { parseMoney, findMoneyNearLabel } from '../parsers/moneyParser';

/**
 * Extract payment details from the current page DOM
 * @param doc The document to extract from (default: current document)
 */
export function extractEbayPaymentDetails(doc: Document = document): EbayPaymentDetails {
  const result: EbayPaymentDetails = {
    extractedAt: Date.now(),
    paymentDetailsUrl: doc.location?.href,
  };
  
  try {
    // Get the raw text for fallback parsing
    const paymentSection = doc.querySelector('.payment-info, .widget, [class*="payment"]');
    const rawText = paymentSection?.textContent || doc.body.textContent || '';
    result.rawPaymentTextSnippet = rawText.substring(0, 2000);
    
    // === Extract Funds Status ===
    result.fundsStatus = extractFundsStatus(doc, rawText);
    
    // === Extract "What your buyer paid" section ===
    result.buyerSubtotal = extractLabeledAmount(doc, rawText, 'Subtotal');
    result.buyerShipping = extractLabeledAmount(doc, rawText, 'Shipping');
    result.buyerSalesTax = extractLabeledAmount(doc, rawText, 'Sales tax');
    result.buyerDiscount = extractLabeledAmount(doc, rawText, 'Discount');
    result.buyerOrderTotal = extractBuyerOrderTotal(doc, rawText);
    
    // === Extract "What you earned" section ===
    result.earnedOrderTotal = extractEarnedOrderTotal(doc, rawText);
    result.ebayCollectedSalesTax = extractLabeledAmount(doc, rawText, 'eBay collected', 'Sales tax');
    result.transactionFees = extractLabeledAmount(doc, rawText, 'Transaction fees');
    
    // === THE KEY VALUE: Order earnings ===
    result.orderEarnings = extractOrderEarnings(doc, rawText);
    
    // === Payout status text ===
    result.payoutStatusText = extractPayoutStatus(doc, rawText);
    
    console.log('💰 Extracted eBay payment details:', result);
    
  } catch (err) {
    console.error('❌ Error extracting eBay payment details:', err);
  }
  
  return result;
}

/**
 * Extract funds status (Available, Pending, Hold)
 */
function extractFundsStatus(doc: Document, rawText: string): FundsStatus {
  // Look for funds status indicator
  const statusSelectors = [
    '.fund-status-value .text',
    '.fund-status-indicator + .text',
    '.fund-status .info-value',
  ];
  
  for (const sel of statusSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim().toLowerCase();
      if (text?.includes('available')) return 'Available';
      if (text?.includes('pending')) return 'Pending';
      if (text?.includes('hold')) return 'Hold';
    }
  }
  
  // Fallback: search raw text
  const lowerText = rawText.toLowerCase();
  if (lowerText.includes('funds status') && lowerText.includes('available')) return 'Available';
  if (lowerText.includes('funds status') && lowerText.includes('pending')) return 'Pending';
  if (lowerText.includes('funds status') && lowerText.includes('hold')) return 'Hold';
  
  return 'Unknown';
}

/**
 * Extract a labeled amount from the page
 * @param doc Document to search
 * @param rawText Raw text fallback
 * @param primaryLabel Main label to find
 * @param secondaryLabel Optional secondary label (for nested items)
 */
function extractLabeledAmount(
  doc: Document, 
  rawText: string, 
  primaryLabel: string,
  secondaryLabel?: string
): number | null {
  const searchLabel = secondaryLabel 
    ? `${primaryLabel}.*${secondaryLabel}` 
    : primaryLabel;
  
  // Strategy 1: Find by DOM structure
  // eBay uses: <dt class="label">Label</dt><dd class="amount"><span>$X.XX</span></dd>
  const allDts = doc.querySelectorAll('dt.label, dt');
  
  for (const dt of allDts) {
    const labelText = dt.textContent?.trim() || '';
    
    // Check if this label matches our search
    const labelLower = labelText.toLowerCase();
    const searchLower = primaryLabel.toLowerCase();
    
    if (labelLower.includes(searchLower)) {
      // If secondary label required, check for it too
      if (secondaryLabel && !labelLower.includes(secondaryLabel.toLowerCase())) {
        continue;
      }
      
      // Find the corresponding <dd> with amount
      const dd = dt.nextElementSibling as Element;
      if (dd && dd.tagName === 'DD') {
        const amountText = dd.textContent?.trim() || '';
        const amount = parseMoney(amountText);
        if (amount !== null) {
          return amount;
        }
      }
    }
  }
  
  // Strategy 2: Find by data-item structure
  const dataItems = doc.querySelectorAll('.data-item, [class*="data-item"]');
  for (const item of dataItems) {
    const label = item.querySelector('.label, dt')?.textContent?.toLowerCase() || '';
    if (label.includes(primaryLabel.toLowerCase())) {
      const amount = item.querySelector('.amount, dd')?.textContent || '';
      const parsed = parseMoney(amount);
      if (parsed !== null) return parsed;
    }
  }
  
  // Strategy 3: Fallback to raw text search
  return findMoneyNearLabel(rawText, primaryLabel);
}

/**
 * Extract the "Order total" from "What your buyer paid" section
 * IMPORTANT: There are TWO "Order total" values on the page!
 * This extracts the BUYER's order total (higher up on page)
 */
function extractBuyerOrderTotal(doc: Document, rawText: string): number | null {
  // Look specifically in "buyer-paid" section
  const buyerSection = doc.querySelector('.buyer-paid');
  if (buyerSection) {
    const total = buyerSection.querySelector('dl.total dd.amount .sh-bold');
    if (total) {
      return parseMoney(total.textContent);
    }
  }
  
  // Fallback: Find "What your buyer paid" then find "Order total" after it
  const buyerPaidIndex = rawText.toLowerCase().indexOf('what your buyer paid');
  if (buyerPaidIndex !== -1) {
    const afterBuyerPaid = rawText.substring(buyerPaidIndex, buyerPaidIndex + 500);
    return findMoneyNearLabel(afterBuyerPaid, 'Order total');
  }
  
  return null;
}

/**
 * Extract the "Order total" from "What you earned" section
 * This is different from buyer order total
 */
function extractEarnedOrderTotal(doc: Document, rawText: string): number | null {
  // Look specifically in "earnings" section
  const earningsSection = doc.querySelector('.earnings');
  if (earningsSection) {
    // First "Order total" in earnings section (not the final Order earnings!)
    const dataItems = earningsSection.querySelectorAll('.data-item');
    for (const item of dataItems) {
      const label = item.querySelector('.label')?.textContent?.toLowerCase() || '';
      if (label.includes('order total') && !label.includes('earnings')) {
        const amount = item.querySelector('.amount .sh-bold')?.textContent;
        if (amount) return parseMoney(amount);
      }
    }
  }
  
  // Fallback
  const earnedIndex = rawText.toLowerCase().indexOf('what you earned');
  if (earnedIndex !== -1) {
    const afterEarned = rawText.substring(earnedIndex, earnedIndex + 300);
    return findMoneyNearLabel(afterEarned, 'Order total');
  }
  
  return null;
}

/**
 * THE MOST IMPORTANT FUNCTION
 * Extract "Order earnings" - the net profit after eBay fees
 * 
 * Structure on page:
 * <dl class="total">
 *   <dt class="label">
 *     <button>Order earnings</button>
 *   </dt>
 *   <dd class="amount">
 *     <span class="sh-bold">$14.33</span>
 *   </dd>
 * </dl>
 */
function extractOrderEarnings(doc: Document, rawText: string): number | null {
  console.log('🔍 Extracting Order earnings...');
  
  // Strategy 1: Find the specific "Order earnings" in earnings section
  const earningsSection = doc.querySelector('.earnings');
  if (earningsSection) {
    const totalDl = earningsSection.querySelector('dl.total');
    if (totalDl) {
      const labelBtn = totalDl.querySelector('button');
      const labelText = labelBtn?.textContent?.toLowerCase() || '';
      
      if (labelText.includes('order earnings')) {
        const amountEl = totalDl.querySelector('dd.amount .sh-bold');
        if (amountEl) {
          const amount = parseMoney(amountEl.textContent);
          console.log(`✅ Found Order earnings via .earnings dl.total: $${amount}`);
          return amount;
        }
      }
    }
  }
  
  // Strategy 2: Find button containing "Order earnings" and navigate to value
  const allButtons = doc.querySelectorAll('button');
  for (const btn of allButtons) {
    const btnText = btn.textContent?.toLowerCase() || '';
    if (btnText.includes('order earnings')) {
      // Navigate up to find parent dl.total
      let parent: Element | null = btn.parentElement;
      while (parent && !parent.matches('dl.total')) {
        parent = parent.parentElement;
      }
      
      if (parent) {
        const amountEl = parent.querySelector('dd.amount .sh-bold, dd.amount .value');
        if (amountEl) {
          const amount = parseMoney(amountEl.textContent);
          console.log(`✅ Found Order earnings via button navigation: $${amount}`);
          return amount;
        }
      }
    }
  }
  
  // Strategy 3: XPath search (for complex nested structures)
  try {
    const xpathResult = doc.evaluate(
      "//button[contains(text(), 'Order earnings')]",
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    
    const btn = xpathResult.singleNodeValue as Element | null;
    if (btn) {
      const dlTotal = btn.closest('dl.total');
      if (dlTotal) {
        const amountEl = dlTotal.querySelector('dd.amount .sh-bold');
        if (amountEl) {
          const amount = parseMoney(amountEl.textContent);
          console.log(`✅ Found Order earnings via XPath: $${amount}`);
          return amount;
        }
      }
    }
  } catch (e) {
    // XPath may fail in some contexts
  }
  
  // Strategy 4: Text pattern search
  // Look for "Order earnings" followed by a money value
  const orderEarningsMatch = rawText.match(/Order earnings[\s\S]{0,50}\$([\d,.]+)/i);
  if (orderEarningsMatch) {
    const amount = parseMoney(`$${orderEarningsMatch[1]}`);
    console.log(`✅ Found Order earnings via regex: $${amount}`);
    return amount;
  }
  
  // Strategy 5: Find in .earnings section, last .total amount
  if (earningsSection) {
    const lastTotal = earningsSection.querySelector('.total dd.amount .sh-bold');
    if (lastTotal) {
      const amount = parseMoney(lastTotal.textContent);
      console.log(`⚠️ Found earnings via fallback .total: $${amount}`);
      return amount;
    }
  }
  
  console.warn('❌ Could not find Order earnings');
  return null;
}

/**
 * Extract payout status message
 */
function extractPayoutStatus(doc: Document, rawText: string): string | undefined {
  // Look for status message
  const statusMsg = doc.querySelector('.status-message p, .section-notice__main p');
  if (statusMsg) {
    return statusMsg.textContent?.trim();
  }
  
  // Check for common messages in raw text
  if (rawText.includes("funds available for payout")) {
    return "This order is complete and we've made the funds available for payout.";
  }
  if (rawText.includes("funds are on hold")) {
    return "Funds are on hold.";
  }
  
  return undefined;
}

/**
 * Check if we're on an eBay payment details page
 */
export function isEbayPaymentDetailsPage(url: string = window.location.href): boolean {
  return url.includes('ebay.com/mes/transactiondetails') || 
         url.includes('ebay.com/mesh/ord/details');
}

/**
 * Validate extracted payment details
 * Returns warnings if data seems incomplete or suspicious
 */
export function validatePaymentDetails(details: EbayPaymentDetails): string[] {
  const warnings: string[] = [];
  
  if (details.orderEarnings === null || details.orderEarnings === undefined) {
    warnings.push('Order earnings not found - this is the key value!');
  }
  
  if (details.fundsStatus === 'Unknown') {
    warnings.push('Funds status could not be determined');
  }
  
  const buyerTotal = details.buyerOrderTotal;
  const earnings = details.orderEarnings;
  if (buyerTotal !== null && buyerTotal !== undefined && 
      earnings !== null && earnings !== undefined) {
    if (earnings > buyerTotal) {
      warnings.push('Order earnings exceeds buyer total - possible parsing error');
    }
  }
  
  const fees = details.transactionFees;
  if (fees !== null && fees !== undefined && fees > 0) {
    warnings.push('Transaction fees should be negative but found positive value');
  }
  
  return warnings;
}
