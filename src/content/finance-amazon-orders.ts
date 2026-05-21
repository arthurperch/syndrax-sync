/**
 * Finance Reconciliation - Amazon Order History Scanner
 * 
 * Searches and extracts order data from: https://www.amazon.com/gp/your-account/order-history
 * SAFETY: READ-ONLY - Only extracts data, NO clicks on Buy/Place Order/etc.
 */

import type { AmazonOrderMatch } from '../features/finance-reconciliation/types';
import { parseMoney } from '../features/finance-reconciliation/parsers/moneyParser';
import { scoreTitleMatch } from '../features/finance-reconciliation/parsers/titleMatcher';

// ==================== ORDER EXTRACTION ====================

interface AmazonOrderCard {
  orderId: string;
  orderDate: string;
  orderTotal: number | null;
  titles: string[];
  productUrls: string[];
  orderDetailsUrl: string;
  rawHtml: string;
}

function extractOrdersFromPage(): AmazonOrderCard[] {
  console.log('📦 Extracting Amazon orders from page...');
  
  const orders: AmazonOrderCard[] = [];
  
  // Find all order cards
  const orderCards = document.querySelectorAll('.order-card.js-order-card, .order, .a-box-group.order');
  
  console.log(`📦 Found ${orderCards.length} order cards`);
  
  orderCards.forEach((card, index) => {
    try {
      const order = extractOrderFromCard(card);
      if (order) {
        orders.push(order);
        console.log(`📦 Order ${index}: ID=${order.orderId}, Total=$${order.orderTotal}, Date=${order.orderDate}`);
      }
    } catch (err) {
      console.warn(`Failed to extract order ${index}:`, err);
    }
  });
  
  return orders;
}

function extractOrderFromCard(card: Element): AmazonOrderCard | null {
  const text = card.textContent || '';
  
  // === Order ID ===
  // Look for order ID link or text pattern
  let orderId = '';
  const orderIdLink = card.querySelector('a[href*="order-details"], a[href*="orderID"]');
  if (orderIdLink) {
    const href = (orderIdLink as HTMLAnchorElement).href;
    const match = href.match(/orderID=([^&]+)/i) || href.match(/order-details\/([^?/]+)/);
    if (match) orderId = match[1];
  }
  if (!orderId) {
    const orderIdMatch = text.match(/\d{3}-\d{7}-\d{7}/);
    if (orderIdMatch) orderId = orderIdMatch[0];
  }
  
  // === Order Date ===
  let orderDate = '';
  // Look for "Order placed" text
  const dateEl = card.querySelector('.order-info .a-size-base, .order-header__header-list-item');
  if (dateEl) {
    const dateMatch = dateEl.textContent?.match(/(\w+ \d+, \d{4})/);
    if (dateMatch) orderDate = dateMatch[1];
  }
  if (!orderDate) {
    const dateMatch = text.match(/(?:Order placed|Ordered|Delivered)\s*(\w+ \d+,? \d{4})/i);
    if (dateMatch) orderDate = dateMatch[1];
  }
  
  // === Order Total ===
  // IMPORTANT: Find "Total" label and its value, NOT "Ship to" text
  let orderTotal: number | null = null;
  
  // Strategy 1: Look for Total in header section
  const headerItems = card.querySelectorAll('.order-header__header-list-item, .a-column');
  for (const item of headerItems) {
    const itemText = item.textContent || '';
    if (itemText.toLowerCase().includes('total') && !itemText.toLowerCase().includes('ship')) {
      // Find the amount in this section
      const amountEl = item.querySelector('.a-color-secondary, .a-size-base');
      if (amountEl) {
        const amount = parseMoney(amountEl.textContent);
        if (amount !== null && amount > 0) {
          orderTotal = amount;
          break;
        }
      }
      // Fallback: regex
      const priceMatch = itemText.match(/\$[\d,]+\.?\d*/);
      if (priceMatch) {
        const amount = parseMoney(priceMatch[0]);
        if (amount !== null && amount > 0) {
          orderTotal = amount;
          break;
        }
      }
    }
  }
  
  // Strategy 2: Find "Total" text label followed by price
  if (orderTotal === null) {
    const totalLabel = card.querySelector('.a-text-caps');
    if (totalLabel?.textContent?.toLowerCase().includes('total')) {
      const nextRow = totalLabel.closest('.a-row')?.nextElementSibling || totalLabel.parentElement?.querySelector('.a-row');
      if (nextRow) {
        const amount = parseMoney(nextRow.textContent);
        if (amount !== null && amount > 0) {
          orderTotal = amount;
        }
      }
    }
  }
  
  // Strategy 3: Specific DOM structure
  // <span class="a-color-secondary a-text-caps">Total</span>
  // <span class="a-size-base a-color-secondary">$8.59</span>
  if (orderTotal === null) {
    const spans = card.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].textContent?.toLowerCase().trim() === 'total') {
        // Look at next few siblings
        for (let j = i + 1; j < Math.min(i + 5, spans.length); j++) {
          const amount = parseMoney(spans[j].textContent);
          if (amount !== null && amount > 0) {
            orderTotal = amount;
            break;
          }
        }
        break;
      }
    }
  }
  
  // === Product Titles ===
  const titles: string[] = [];
  const titleEls = card.querySelectorAll('.a-link-normal[href*="/dp/"], .a-link-normal[href*="/gp/product/"]');
  titleEls.forEach(el => {
    const title = el.textContent?.trim();
    if (title && title.length > 5 && !titles.includes(title)) {
      titles.push(title);
    }
  });
  
  // === Product URLs ===
  const productUrls: string[] = [];
  titleEls.forEach(el => {
    const href = (el as HTMLAnchorElement).href;
    if (href && !productUrls.includes(href)) {
      productUrls.push(href);
    }
  });
  
  // === Order Details URL ===
  let orderDetailsUrl = '';
  const detailsLink = card.querySelector('a[href*="order-details"]');
  if (detailsLink) {
    orderDetailsUrl = (detailsLink as HTMLAnchorElement).href;
  }
  
  // Skip if no useful data
  if (!orderId && titles.length === 0) {
    return null;
  }
  
  return {
    orderId,
    orderDate,
    orderTotal,
    titles,
    productUrls,
    orderDetailsUrl,
    rawHtml: card.innerHTML.substring(0, 2000)
  };
}

// ==================== ORDER MATCHING ====================

function findMatchingOrder(
  searchTitle: string, 
  orders: AmazonOrderCard[]
): { order: AmazonOrderCard; score: number } | null {
  console.log(`🔍 Searching for match: "${searchTitle.substring(0, 50)}..."`);
  
  let bestMatch: { order: AmazonOrderCard; score: number } | null = null;
  
  for (const order of orders) {
    for (const title of order.titles) {
      const score = scoreTitleMatch(searchTitle, title);
      console.log(`   → Score ${score} for: "${title.substring(0, 40)}..."`);
      
      if (score > 40 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { order, score };
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Best match: score=${bestMatch.score}, total=$${bestMatch.order.orderTotal}`);
  } else {
    console.log('❌ No match found');
  }
  
  return bestMatch;
}

function buildAmazonOrderMatch(
  order: AmazonOrderCard, 
  score: number, 
  method: 'title' | 'sku' | 'url' | 'manual' = 'title'
): AmazonOrderMatch {
  return {
    amazonOrderId: order.orderId,
    amazonTitle: order.titles[0] || '',
    amazonOrderUrl: order.orderDetailsUrl || `https://www.amazon.com/gp/your-account/order-details?orderID=${order.orderId}`,
    amazonOrderDate: order.orderDate,
    amazonOrderTotal: order.orderTotal,
    confidenceScore: score,
    matchMethod: method,
    verified: score >= 80, // Auto-verify high confidence matches
    status: score >= 80 ? 'matched' : score >= 60 ? 'possible_match' : 'needs_review',
    rawOrderCardHtml: order.rawHtml,
    extractedAt: Date.now()
  };
}

// ==================== SEARCH FUNCTION ====================

function getSearchUrl(searchTerm: string): string {
  // Amazon order history search URL
  return `https://www.amazon.com/gp/your-account/order-history?search=${encodeURIComponent(searchTerm)}`;
}

function getCurrentSearchTerm(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get('search');
}

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('📦 Amazon orders scanner received message:', msg.type);
  
  if (msg.type === 'EXTRACT_AMAZON_ORDERS') {
    try {
      const orders = extractOrdersFromPage();
      sendResponse({
        success: true,
        orders: orders,
        currentSearch: getCurrentSearchTerm(),
        url: window.location.href,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('❌ Amazon order extraction failed:', err);
      sendResponse({
        success: false,
        error: String(err),
        url: window.location.href
      });
    }
    return true;
  }
  
  if (msg.type === 'SEARCH_AMAZON_FOR_TITLE') {
    // Extract and find best match
    try {
      const { searchTitle, searchTermUsed } = msg.payload as { searchTitle: string; searchTermUsed: string };
      const orders = extractOrdersFromPage();
      const match = findMatchingOrder(searchTitle, orders);
      
      sendResponse({
        success: true,
        match: match ? buildAmazonOrderMatch(match.order, match.score, 'title') : null,
        ordersFound: orders.length,
        searchTerm: searchTermUsed || getCurrentSearchTerm(),
        url: window.location.href,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('❌ Amazon search failed:', err);
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

console.log('📦 Finance Amazon Orders Scanner loaded on:', window.location.href);

// Report ready if on order history page
if (window.location.href.includes('order-history') || window.location.href.includes('your-orders')) {
  console.log('📋 On Amazon order history page - ready to scan');
  
  chrome.runtime.sendMessage({
    type: 'FINANCE_AMAZON_PAGE_READY',
    url: window.location.href,
    searchTerm: getCurrentSearchTerm()
  }).catch(() => {});
}
