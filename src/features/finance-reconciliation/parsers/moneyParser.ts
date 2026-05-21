/**
 * Money Parser Utility
 * Safely parses money strings from eBay/Amazon pages
 * 
 * Handles:
 * - "$8.59" → 8.59
 * - "-$1.07" → -1.07
 * - "$0.00" → 0
 * - "--" → null
 * - "" → null
 * - "N/A" → null
 */

/**
 * Parse a money string to a number
 * @param input The raw money string (e.g., "$8.59", "-$1.07")
 * @returns The parsed number or null if invalid
 */
export function parseMoney(input: string | null | undefined): number | null {
  if (!input) return null;
  
  const trimmed = input.trim();
  
  // Handle empty, dashes, N/A
  if (trimmed === '' || trimmed === '--' || trimmed === '-' || 
      trimmed.toLowerCase() === 'n/a' || trimmed === '—') {
    return null;
  }
  
  // Check for negative sign (could be at start or after $)
  const isNegative = trimmed.startsWith('-') || trimmed.includes('-$');
  
  // Extract numeric portion
  // Matches: digits, commas, decimal point
  const numMatch = trimmed.match(/([\d,]+\.?\d*)/);
  
  if (!numMatch) {
    return null;
  }
  
  // Remove commas and parse
  const numStr = numMatch[1].replace(/,/g, '');
  const value = parseFloat(numStr);
  
  if (isNaN(value)) {
    return null;
  }
  
  return isNegative ? -value : value;
}

/**
 * Format a number as a money string
 * @param value The number to format
 * @param includeSign Whether to include + for positive numbers
 * @returns Formatted string (e.g., "$8.59", "-$1.07", "+$5.00")
 */
export function formatMoney(value: number | null | undefined, includeSign = false): string {
  if (value === null || value === undefined) {
    return '--';
  }
  
  const absValue = Math.abs(value);
  const formatted = absValue.toFixed(2);
  
  if (value < 0) {
    return `-$${formatted}`;
  }
  
  if (includeSign && value > 0) {
    return `+$${formatted}`;
  }
  
  return `$${formatted}`;
}

/**
 * Extract all money values from a text block
 * Useful for debugging/parsing entire payment sections
 * @param text The text to search
 * @returns Array of parsed money values with their original strings
 */
export function extractAllMoneyValues(text: string): Array<{ original: string; value: number }> {
  const results: Array<{ original: string; value: number }> = [];
  
  // Match patterns like $8.59, -$1.07, $1,234.56
  const regex = /-?\$[\d,]+\.?\d*/g;
  const matches = text.match(regex);
  
  if (!matches) return results;
  
  for (const match of matches) {
    const value = parseMoney(match);
    if (value !== null) {
      results.push({ original: match, value });
    }
  }
  
  return results;
}

/**
 * Find a money value near a label in text
 * @param text The full text to search
 * @param label The label to find (e.g., "Order earnings")
 * @returns The first money value found after the label, or null
 */
export function findMoneyNearLabel(text: string, label: string): number | null {
  const lowerText = text.toLowerCase();
  const lowerLabel = label.toLowerCase();
  
  const labelIndex = lowerText.indexOf(lowerLabel);
  if (labelIndex === -1) return null;
  
  // Search in the text after the label (within ~100 chars)
  const searchText = text.substring(labelIndex, labelIndex + 100);
  
  // Find first money value
  const moneyMatch = searchText.match(/-?\$[\d,]+\.?\d*/);
  if (!moneyMatch) return null;
  
  return parseMoney(moneyMatch[0]);
}

/**
 * Validate that a parsed money value is within reasonable bounds
 * Helps catch parsing errors
 * @param value The parsed value
 * @param min Minimum expected value (default -10000)
 * @param max Maximum expected value (default 100000)
 * @returns Whether the value is within bounds
 */
export function isReasonableAmount(
  value: number | null, 
  min = -10000, 
  max = 100000
): boolean {
  if (value === null) return false;
  return value >= min && value <= max;
}
