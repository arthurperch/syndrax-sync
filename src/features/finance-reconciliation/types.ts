/**
 * Amazon/eBay Finance Reconciliation - Type Definitions
 * 
 * SAFETY: This module is READ-ONLY. No destructive operations.
 * - Does NOT place orders
 * - Does NOT click Buy/Confirm/Cancel buttons
 * - Only extracts data from pages where user is logged in
 */

// ==================== EBAY SOLD ORDER ====================

export type OrderStatus = 
  | 'ebay_found'           // Found in eBay sold list
  | 'payment_scanned'      // Payment details extracted
  | 'amazon_search_pending'// Ready to search Amazon
  | 'amazon_matched'       // Matched with Amazon order
  | 'possible_match'       // Weak match, needs review
  | 'needs_verification'   // User must verify match
  | 'incomplete'           // Missing data
  | 'error'                // Extraction error
  | 'skipped_refund_or_cancel' // Refunded or canceled order
  | 'duplicate_possible';  // Possible duplicate entry

export interface EbaySoldOrder {
  id: string;                      // Unique identifier for this record
  orderId?: string;                // eBay order ID
  itemId?: string;                 // eBay item ID
  transactionId?: string;          // eBay transaction ID
  sku?: string;                    // Custom label / SKU
  ebayTitle?: string;              // Item title on eBay
  ebayItemUrl?: string;            // Link to eBay item
  orderDetailsUrl?: string;        // Link to order details page
  paymentDetailsUrl?: string;      // Link to payment details page
  soldDate?: string;               // ISO date string when sold
  scanSourceUrl: string;           // URL where this was scanned from
  payment?: EbayPaymentDetails;    // Extracted payment info
  amazonMatch?: AmazonOrderMatch;  // Amazon order match
  calculated?: ProfitCalculation;  // Profit calculation
  status: OrderStatus;
  notes?: string[];                // Any notes/warnings
  raw?: {
    ebayListSnippet?: string;      // Raw HTML for debugging
    paymentSnippet?: string;
    amazonSnippet?: string;
  };
  createdAt: number;               // Timestamp when record created
  updatedAt: number;               // Timestamp when last updated
}

// ==================== EBAY PAYMENT DETAILS ====================

export type FundsStatus = 'Available' | 'Pending' | 'Hold' | 'Unknown';

export interface EbayPaymentDetails {
  fundsStatus?: FundsStatus;
  // What buyer paid
  buyerSubtotal?: number | null;
  buyerShipping?: number | null;
  buyerSalesTax?: number | null;
  buyerDiscount?: number | null;
  buyerOrderTotal?: number | null;
  // What seller earned
  earnedOrderTotal?: number | null;
  ebayCollectedSalesTax?: number | null;
  transactionFees?: number | null;
  orderEarnings?: number | null;     // THE KEY VALUE - net after fees
  // Metadata
  paymentDetailsUrl?: string;
  payoutStatusText?: string;
  rawPaymentTextSnippet?: string;
  extractedAt?: number;              // Timestamp
}

// ==================== AMAZON ORDER MATCH ====================

export type MatchMethod = 'sku' | 'url' | 'title' | 'manual' | 'unknown';
export type MatchStatus = 'matched' | 'possible_match' | 'not_found' | 'needs_review';

export interface AmazonOrderMatch {
  amazonOrderId?: string;
  amazonTitle?: string;
  amazonOrderUrl?: string;
  amazonOrderDate?: string;
  amazonOrderTotal?: number | null;  // What we paid on Amazon
  confidenceScore: number;           // 0-100
  matchMethod: MatchMethod;
  verified: boolean;                 // User confirmed match
  status: MatchStatus;
  rawOrderCardHtml?: string;         // For debugging
  extractedAt?: number;
}

// ==================== PROFIT CALCULATION ====================

export type CalculationStatus = 
  | 'verified'                       // Match verified, calculation complete
  | 'unverified'                     // Calculated but not verified
  | 'blocked_missing_amazon_cost'    // No Amazon cost found
  | 'blocked_needs_match_verification'; // Match needs user verification

export interface ProfitCalculation {
  ebayOrderEarnings?: number | null;
  amazonCost?: number | null;
  estimatedNetProfit?: number | null;
  calculationStatus: CalculationStatus;
  calculatedAt?: number;
}

// ==================== SCAN RUN STATE ====================

export type ScanPhase = 
  | 'idle'
  | 'scanning_ebay_list'
  | 'extracting_payment_details'
  | 'searching_amazon'
  | 'matching'
  | 'paused'
  | 'completed'
  | 'error';

export type ScanPeriod = 'CURRENT_YEAR' | 'LAST_YEAR' | 'CUSTOM';

export interface ScanRunConfig {
  period: ScanPeriod;
  startDate?: number;                // Unix timestamp for custom range
  endDate?: number;                  // Unix timestamp for custom range
  maxConcurrentTabs: number;         // Default 5 for eBay, 2 for Amazon
  delayBetweenRequests: number;      // MS delay
}

export interface ScanProgress {
  currentPhase: ScanPhase;
  currentPageUrl?: string;
  pagesScanned: number;
  totalPagesEstimate?: number;
  ebayOrdersFound: number;
  paymentPagesScanned: number;
  amazonMatchesFound: number;
  needsVerificationCount: number;
  incompleteCount: number;
  errorsCount: number;
  lastScannedOrderId?: string;
  pausedAt?: number;
}

export interface ScanRun {
  id: string;                        // Unique run ID
  config: ScanRunConfig;
  progress: ScanProgress;
  orders: EbaySoldOrder[];           // All orders in this run
  startedAt: number;
  endedAt?: number;
  errors: ScanError[];
}

export interface ScanError {
  id: string;
  orderId?: string;
  phase: ScanPhase;
  message: string;
  url?: string;
  timestamp: number;
  recovered: boolean;
}

// ==================== UI STATE ====================

export interface FinanceReconciliationState {
  activeRun: ScanRun | null;
  isScanning: boolean;
  isPaused: boolean;
  selectedTab: 'results' | 'verification' | 'errors';
  filterStatus: OrderStatus | 'all';
  searchQuery: string;
}

// ==================== EXPORT TYPES ====================

export interface ExportOptions {
  includeRaw: boolean;
  includeUnverified: boolean;
  dateFormat: 'iso' | 'us' | 'eu';
}

export interface CSVExportRow {
  scanRunId: string;
  ebayOrderId: string;
  ebayItemId: string;
  ebayTransactionId: string;
  ebaySku: string;
  ebayTitle: string;
  ebayItemUrl: string;
  ebayPaymentDetailsUrl: string;
  soldDate: string;
  fundsStatus: string;
  buyerSubtotal: string;
  buyerShipping: string;
  buyerSalesTax: string;
  buyerDiscount: string;
  buyerOrderTotal: string;
  earnedOrderTotal: string;
  ebayCollectedSalesTax: string;
  transactionFees: string;
  orderEarnings: string;
  amazonOrderId: string;
  amazonTitle: string;
  amazonOrderUrl: string;
  amazonOrderDate: string;
  amazonOrderTotal: string;
  matchMethod: string;
  confidenceScore: string;
  verified: string;
  estimatedNetProfit: string;
  status: string;
  notes: string;
}

// ==================== MESSAGE TYPES ====================

export interface ScanMessage {
  type: 'START_SCAN' | 'PAUSE_SCAN' | 'RESUME_SCAN' | 'STOP_SCAN' | 'SCAN_STATUS';
  payload?: any;
}

export interface ExtractMessage {
  type: 'EXTRACT_EBAY_SOLD_LIST' | 'EXTRACT_EBAY_PAYMENT' | 'EXTRACT_AMAZON_ORDER';
  payload?: {
    url?: string;
    orderId?: string;
  };
}

export interface ExtractResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  url: string;
  timestamp: number;
}
