/**
 * Finance Reconciliation - eBay Payment Page Extractor
 * 
 * Extracts payment details from: https://www.ebay.com/mes/transactiondetails
 * SAFETY: READ-ONLY - Only extracts data, no clicks on destructive buttons
 */

import type { EbayPaymentDetails } from '../features/finance-reconciliation/types';
import { parseMoney } from '../features/finance-reconciliation/parsers/moneyParser';

// ==================== EXTRACTION ====================

function extractPaymentDetails(): EbayPaymentDetails {
  console.log('💰 Extracting eBay payment details from:', window.location.href);
  
  const result: EbayPaymentDetails = {
    extractedAt: Date.now(),
    paymentDetailsUrl: window.location.href,
  };
  
  try {
    // Get page text for fallback
    const pageText = document.body.innerText || '';
    result.rawPaymentTextSnippet = pageText.substring(0, 3000);
    
    // === Funds Status ===
    result.fundsStatus = extractFundsStatus(pageText);
    
    // === What buyer paid section ===
    result.buyerSubtotal = findLabeledAmount('Subtotal', pageText);
    result.buyerShipping = findLabeledAmount('Shipping', pageText);
    result.buyerSalesTax = findLabeledAmount('Sales tax', pageText);
    result.buyerDiscount = findLabeledAmount('Discount', pageText);
    result.buyerOrderTotal = findBuyerOrderTotal(pageText);
    
    // === What you earned section ===
    result.earnedOrderTotal = findEarnedOrderTotal(pageText);
    result.ebayCollectedSalesTax = findLabeledAmount('eBay collected', pageText);
    result.transactionFees = findLabeledAmount('Transaction fees', pageText);
    
    // === THE KEY VALUE: Order earnings ===
    result.orderEarnings = extractOrderEarnings();
    
    // === Payout status ===
    result.payoutStatusText = extractPayoutStatus(pageText);
    
    console.log('💰 Extracted payment details:', result);
    
  } catch (err) {
    console.error('❌ Payment extraction failed:', err);
  }
  
  return result;
}

function extractFundsStatus(pageText: string): 'Available' | 'Pending' | 'Hold' | 'Unknown' {
  const lower = pageText.toLowerCase();
  
  // Look for funds status area
  if (lower.includes('funds status') || lower.includes('payment')) {
    if (lower.includes('available')) return 'Available';
    if (lower.includes('pending')) return 'Pending';
    if (lower.includes('hold') || lower.includes('on hold')) return 'Hold';
  }
  
  // Check specific selectors
  const statusEl = document.querySelector('.fund-status-value, .fund-status .info-value, [class*="fund-status"]');
  if (statusEl) {
    const text = statusEl.textContent?.toLowerCase() || '';
    if (text.includes('available')) return 'Available';
    if (text.includes('pending')) return 'Pending';
    if (text.includes('hold')) return 'Hold';
  }
  
  return 'Unknown';
}

function findLabeledAmount(label: string, pageText: string): number | null {
  // Strategy 1: DOM-based extraction
  const allElements = document.querySelectorAll('dt, .label, [class*="label"]');
  
  for (const el of allElements) {
    const labelText = el.textContent?.toLowerCase() || '';
    if (labelText.includes(label.toLowerCase())) {
      // Find next sibling or nearest value element
      const nextEl = el.nextElementSibling;
      if (nextEl) {
        const amountText = nextEl.textContent || '';
        const amount = parseMoney(amountText);
        if (amount !== null) {
          console.log(`💰 Found ${label}: ${amount}`);
          return amount;
        }
      }
    }
  }
  
  // Strategy 2: Text pattern search
  const pattern = new RegExp(label + '[:\\s]*([\\-\\$\\d,\\.]+)', 'i');
  const match = pageText.match(pattern);
  if (match) {
    const amount = parseMoney(match[1]);
    if (amount !== null) return amount;
  }
  
  return null;
}

function findBuyerOrderTotal(pageText: string): number | null {
  // Look for "What your buyer paid" section
  const buyerPaidIndex = pageText.toLowerCase().indexOf('what your buyer paid');
  if (buyerPaidIndex !== -1) {
    const section = pageText.substring(buyerPaidIndex, buyerPaidIndex + 500);
    
    // Find "Order total" in this section
    const totalMatch = section.match(/Order total[:\s]*\*?\*?[\s]*([\$\d,\.]+)/i);
    if (totalMatch) {
      return parseMoney(totalMatch[1]);
    }
  }
  
  // Fallback: DOM-based
  const buyerSection = document.querySelector('.buyer-paid, [class*="buyer"]');
  if (buyerSection) {
    const totalEl = buyerSection.querySelector('dl.total dd.amount .sh-bold, .total .amount');
    if (totalEl) {
      return parseMoney(totalEl.textContent);
    }
  }
  
  return null;
}

function findEarnedOrderTotal(pageText: string): number | null {
  // Look for "What you earned" section
  const earnedIndex = pageText.toLowerCase().indexOf('what you earned');
  if (earnedIndex !== -1) {
    const section = pageText.substring(earnedIndex, earnedIndex + 300);
    
    // Find first "Order total" in this section (not Order earnings)
    const totalMatch = section.match(/Order total[:\s]*([\$\d,\.]+)/i);
    if (totalMatch) {
      return parseMoney(totalMatch[1]);
    }
  }
  
  return null;
}

/**
 * THE KEY FUNCTION - Extract Order Earnings
 * This is the NET amount after eBay fees
 */
function extractOrderEarnings(): number | null {
  console.log('🔍 Searching for Order earnings...');
  
  // Strategy 1: Find button with "Order earnings" text and get nearby amount
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent?.toLowerCase().includes('order earnings')) {
      // Navigate up to find the dl.total container
      const container = btn.closest('dl.total, dl, .total');
      if (container) {
        const amountEl = container.querySelector('dd.amount .sh-bold, .amount .sh-bold, .value');
        if (amountEl) {
          const amount = parseMoney(amountEl.textContent);
          if (amount !== null) {
            console.log(`✅ Found Order earnings via button: $${amount}`);
            return amount;
          }
        }
      }
    }
  }
  
  // Strategy 2: Find in .earnings section
  const earningsSection = document.querySelector('.earnings, [class*="earnings"]');
  if (earningsSection) {
    const totalDl = earningsSection.querySelector('dl.total');
    if (totalDl) {
      const amountEl = totalDl.querySelector('dd.amount .sh-bold');
      if (amountEl) {
        const amount = parseMoney(amountEl.textContent);
        if (amount !== null) {
          console.log(`✅ Found Order earnings via .earnings section: $${amount}`);
          return amount;
        }
      }
    }
  }
  
  // Strategy 3: XPath for button
  try {
    const xpath = "//button[contains(text(), 'Order earnings')]";
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const btn = result.singleNodeValue as Element | null;
    if (btn) {
      const container = btn.closest('dl.total');
      if (container) {
        const amountEl = container.querySelector('dd.amount .sh-bold');
        if (amountEl) {
          const amount = parseMoney(amountEl.textContent);
          if (amount !== null) {
            console.log(`✅ Found Order earnings via XPath: $${amount}`);
            return amount;
          }
        }
      }
    }
  } catch {}
  
  // Strategy 4: Text pattern search - "Order earnings" followed by $amount
  const pageText = document.body.innerText;
  const patterns = [
    /Order earnings[\s\S]{0,30}\$([\d,\.]+)/i,
    /Order earnings[:\s]*([\$\d,\.]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = pageText.match(pattern);
    if (match) {
      const amount = parseMoney(match[1].startsWith('$') ? match[1] : `$${match[1]}`);
      if (amount !== null) {
        console.log(`✅ Found Order earnings via regex: $${amount}`);
        return amount;
      }
    }
  }
  
  // Strategy 5: Look for last bolded amount in earnings section
  if (earningsSection) {
    const boldAmounts = earningsSection.querySelectorAll('.sh-bold, strong');
    const lastBold = boldAmounts[boldAmounts.length - 1];
    if (lastBold) {
      const amount = parseMoney(lastBold.textContent);
      if (amount !== null && amount > 0) {
        console.log(`⚠️ Found Order earnings via fallback (last bold): $${amount}`);
        return amount;
      }
    }
  }
  
  console.warn('❌ Could not find Order earnings');
  return null;
}

function extractPayoutStatus(pageText: string): string | undefined {
  if (pageText.includes('funds available for payout')) {
    return 'Funds available for payout';
  }
  if (pageText.includes('funds are on hold')) {
    return 'Funds on hold';
  }
  if (pageText.includes('pending')) {
    return 'Pending';
  }
  
  const statusEl = document.querySelector('.status-message p, .section-notice__main p');
  return statusEl?.textContent?.trim();
}

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('💰 Payment extractor received message:', msg.type);
  
  if (msg.type === 'EXTRACT_EBAY_PAYMENT') {
    try {
      const details = extractPaymentDetails();
      sendResponse({
        success: true,
        payment: details,
        url: window.location.href,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('❌ Payment extraction failed:', err);
      sendResponse({
        success: false,
        error: String(err),
        url: window.location.href
      });
    }
    return true;
  }
  
  if (msg.type === 'PING') {
    sendResponse({ success: true, scriptLoaded: true });
    return true;
  }
  
  return false;
});

// ==================== AUTO-INIT ====================

console.log('💰 Finance eBay Payment Extractor loaded on:', window.location.href);

// Extract order ID from URL
function getOrderIdFromUrl(): string | null {
  const url = window.location.href;
  const match = url.match(/orderId=([^&]+)/);
  return match ? match[1] : null;
}

// Auto-extract and send data when page loads
function autoExtractAndSend(): void {
  const orderId = getOrderIdFromUrl();
  if (!orderId) {
    console.log('💰 No orderId in URL, skipping auto-extract');
    return;
  }
  
  console.log('💰 Auto-extracting payment data for order:', orderId);
  
  // Wait for page to fully render
  setTimeout(() => {
    try {
      const details = extractPaymentDetails();
      
      // Add orderId to details
      const data = {
        ...details,
        orderId,
        orderEarnings: details.orderEarnings ? `$${details.orderEarnings.toFixed(2)}` : null
      };
      
      console.log('💰 Extracted data:', data);
      
      // Send to background
      chrome.runtime.sendMessage({
        type: 'PAYMENT_DATA_EXTRACTED',
        payload: { data },
        timestamp: Date.now()
      }).then(() => {
        console.log('✅ Payment data sent to background');
      }).catch((err) => {
        console.error('❌ Failed to send payment data:', err);
      });
      
    } catch (err) {
      console.error('❌ Auto-extraction failed:', err);
    }
  }, 2000); // Wait 2 seconds for page to render
}

// Check if this is a payment details page (from batch scan)
if (window.location.href.includes('mesh/pmt/details') || 
    window.location.href.includes('transactiondetails') ||
    window.location.href.includes('payments/paymentSummary')) {
  console.log('💰 Payment page detected, starting auto-extract...');
  autoExtractAndSend();
}

// Also report ready for manual extraction requests
chrome.runtime.sendMessage({
  type: 'FINANCE_PAYMENT_PAGE_READY',
  url: window.location.href
}).catch(() => {});
