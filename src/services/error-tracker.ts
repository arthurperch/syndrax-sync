/**
 * error-tracker.ts — Structured error routing for Syndrax Sync
 *
 * Every failure in the automation pipeline gets a typed error code so you can
 * pinpoint exactly which step broke without digging through console logs.
 *
 * Error code format:  CATEGORY_SPECIFIC_DETAIL
 * Categories: VALIDATION | AMAZON | EBAY | SYSTEM | AUTOMATION
 */

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ErrorCode = {
  // Validation errors — bad input before any network call
  VALIDATION_INVALID_ASIN:       'VALIDATION_INVALID_ASIN',
  VALIDATION_EMPTY_QUEUE:        'VALIDATION_EMPTY_QUEUE',
  VALIDATION_PRICE_BELOW_FLOOR:  'VALIDATION_PRICE_BELOW_FLOOR',
  VALIDATION_DAILY_LIMIT:        'VALIDATION_DAILY_LIMIT',

  // Amazon errors — scraping / tab automation
  AMAZON_TAB_OPEN_FAILED:        'AMAZON_TAB_OPEN_FAILED',
  AMAZON_PAGE_NOT_FOUND:         'AMAZON_PAGE_NOT_FOUND',
  AMAZON_SCRAPE_TIMEOUT:         'AMAZON_SCRAPE_TIMEOUT',
  AMAZON_SCRAPE_NO_TITLE:        'AMAZON_SCRAPE_NO_TITLE',
  AMAZON_PRICE_ZERO:             'AMAZON_PRICE_ZERO',
  AMAZON_OUT_OF_STOCK:           'AMAZON_OUT_OF_STOCK',
  AMAZON_CAPTCHA_DETECTED:       'AMAZON_CAPTCHA_DETECTED',

  // VERO / compliance errors
  VERO_BRAND_BLOCKED:            'VERO_BRAND_BLOCKED',
  VERO_HIGH_RISK_BRAND:          'VERO_HIGH_RISK_BRAND',

  // eBay errors — listing creation
  EBAY_TAB_OPEN_FAILED:          'EBAY_TAB_OPEN_FAILED',
  EBAY_LISTING_TIMEOUT:          'EBAY_LISTING_TIMEOUT',
  EBAY_LISTING_FORM_ERROR:       'EBAY_LISTING_FORM_ERROR',
  EBAY_DUPLICATE_LISTING:        'EBAY_DUPLICATE_LISTING',
  EBAY_CONTENT_SCRIPT_MISSING:   'EBAY_CONTENT_SCRIPT_MISSING',

  // System errors — extension internals
  SYSTEM_STORAGE_FAILED:         'SYSTEM_STORAGE_FAILED',
  SYSTEM_MESSAGE_FAILED:         'SYSTEM_MESSAGE_FAILED',
  SYSTEM_TAB_CLOSED_EARLY:       'SYSTEM_TAB_CLOSED_EARLY',
  SYSTEM_UNKNOWN:                'SYSTEM_UNKNOWN',

  // Automation errors — bulk engine
  AUTOMATION_ENGINE_BUSY:        'AUTOMATION_ENGINE_BUSY',
  AUTOMATION_PAUSED:             'AUTOMATION_PAUSED',
  AUTOMATION_STOPPED:            'AUTOMATION_STOPPED',
  AUTOMATION_MAX_RETRIES:        'AUTOMATION_MAX_RETRIES',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ─── Structured Error ─────────────────────────────────────────────────────────

export interface SyndraxError {
  code: ErrorCode;
  message: string;
  asin?: string;
  step: PipelineStep;
  timestamp: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type PipelineStep =
  | 'INIT'
  | 'AMAZON_FETCH'
  | 'VERO_CHECK'
  | 'PRICE_CALC'
  | 'EBAY_LIST'
  | 'COMPLETE';

// ─── Error Factory ────────────────────────────────────────────────────────────

export function makeError(
  code: ErrorCode,
  message: string,
  step: PipelineStep,
  opts?: { asin?: string; retryable?: boolean; details?: Record<string, unknown> }
): SyndraxError {
  return {
    code,
    message,
    step,
    timestamp: Date.now(),
    retryable: opts?.retryable ?? isRetryable(code),
    asin: opts?.asin,
    details: opts?.details,
  };
}

/** Codes that are safe to retry automatically */
function isRetryable(code: ErrorCode): boolean {
  return [
    ErrorCode.AMAZON_SCRAPE_TIMEOUT,
    ErrorCode.AMAZON_TAB_OPEN_FAILED,
    ErrorCode.EBAY_LISTING_TIMEOUT,
    ErrorCode.SYSTEM_MESSAGE_FAILED,
    ErrorCode.SYSTEM_TAB_CLOSED_EARLY,
  ].includes(code as any);
}

// ─── In-Memory Error Log ──────────────────────────────────────────────────────

const MAX_LOG_SIZE = 500;
const errorLog: SyndraxError[] = [];

export function logError(err: SyndraxError): void {
  errorLog.push(err);
  if (errorLog.length > MAX_LOG_SIZE) errorLog.shift();
  console.error(
    `[Syndrax][${err.step}][${err.code}] ${err.message}`,
    err.asin ? `ASIN: ${err.asin}` : '',
    err.details ?? ''
  );
}

export function getErrorLog(): SyndraxError[] {
  return [...errorLog];
}

export function clearErrorLog(): void {
  errorLog.length = 0;
}

/** Returns errors grouped by code for the failure-point dashboard */
export function getErrorSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const e of errorLog) {
    summary[e.code] = (summary[e.code] ?? 0) + 1;
  }
  return summary;
}

/** Returns errors for a specific ASIN */
export function getErrorsForAsin(asin: string): SyndraxError[] {
  return errorLog.filter(e => e.asin === asin);
}
