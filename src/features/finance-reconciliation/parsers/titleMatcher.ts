/**
 * Title Matcher Utility
 * Fuzzy matching for comparing eBay titles to Amazon titles
 * 
 * Confidence thresholds:
 * - 80%+ = Strong match (possible auto-match)
 * - 60-79% = Possible match (needs verification)
 * - Below 60% = Weak match (needs manual review)
 */

// Common filler words to remove when normalizing titles
const FILLER_WORDS = new Set([
  'new', 'sale', 'hot', 'best', 'seller', 'free', 'shipping',
  'fast', 'ship', 'ships', 'usa', 'us', 'brand', 'genuine',
  'authentic', 'original', 'oem', 'lot', 'pack', 'pcs', 'pieces',
  'set', 'kit', 'w', 'with', 'for', 'and', 'the', 'a', 'an',
  'in', 'on', 'of', 'to', 'from', '&', '+', '-',
]);

// Common size/dimension patterns to preserve
const SIZE_PATTERNS = [
  /\d+\s*x\s*\d+/gi,           // 48x72
  /\d+\s*"\s*x\s*\d+\s*"/gi,   // 48" x 72"
  /\d+\s*inch/gi,              // 48 inch
  /\d+\s*mm/gi,                // 100mm
  /\d+\s*cm/gi,                // 50cm
  /\d+\s*ft/gi,                // 6ft
  /\d+\s*oz/gi,                // 16oz
  /\d+\s*ml/gi,                // 500ml
  /\d+\s*lb/gi,                // 5lb
  /\d+\s*kg/gi,                // 2kg
];

/**
 * Normalize a title for comparison
 * - Lowercase
 * - Remove punctuation
 * - Remove filler words
 * - Collapse whitespace
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  
  let normalized = title.toLowerCase();
  
  // Preserve size patterns by marking them
  const preservedSizes: string[] = [];
  for (const pattern of SIZE_PATTERNS) {
    const matches = normalized.match(pattern);
    if (matches) {
      for (const match of matches) {
        preservedSizes.push(match.replace(/\s+/g, ''));
      }
    }
  }
  
  // Remove punctuation except numbers and letters
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Split into words
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  // Remove filler words
  const filteredWords = words.filter(word => !FILLER_WORDS.has(word));
  
  // Add preserved sizes back
  filteredWords.push(...preservedSizes);
  
  // Join and collapse whitespace
  return filteredWords.join(' ').trim();
}

/**
 * Extract key tokens from a title
 * Returns unique significant words/numbers
 */
export function extractTokens(title: string): Set<string> {
  const normalized = normalizeTitle(title);
  const words = normalized.split(/\s+/).filter(w => w.length > 1);
  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 * (intersection size / union size)
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * Calculate longest common subsequence length
 * Used for word-order similarity
 */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Score title match between two titles
 * @param titleA First title (e.g., eBay title)
 * @param titleB Second title (e.g., Amazon title)
 * @returns Score from 0 to 100
 */
export function scoreTitleMatch(titleA: string, titleB: string): number {
  if (!titleA || !titleB) return 0;
  
  const tokensA = extractTokens(titleA);
  const tokensB = extractTokens(titleB);
  
  // Empty tokens = no match
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
  // Calculate Jaccard similarity (token overlap)
  const jaccard = jaccardSimilarity(tokensA, tokensB);
  
  // Calculate LCS-based similarity for word order
  const wordsA = normalizeTitle(titleA).split(/\s+/);
  const wordsB = normalizeTitle(titleB).split(/\s+/);
  const lcs = lcsLength(wordsA, wordsB);
  const lcsScore = lcs / Math.max(wordsA.length, wordsB.length);
  
  // Weighted combination
  // Jaccard (token overlap) is more important than word order
  const score = (jaccard * 0.7 + lcsScore * 0.3) * 100;
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Check if two titles likely refer to the same product
 * @param titleA First title
 * @param titleB Second title
 * @param threshold Minimum score to consider a match (default 60)
 */
export function isTitleMatch(titleA: string, titleB: string, threshold = 60): boolean {
  return scoreTitleMatch(titleA, titleB) >= threshold;
}

/**
 * Get match confidence level based on score
 */
export function getMatchConfidence(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'none';
}

/**
 * Find best match from a list of candidate titles
 * @param searchTitle The title to match
 * @param candidates Array of candidate titles
 * @returns The best match with score, or null if no good match
 */
export function findBestMatch(
  searchTitle: string, 
  candidates: string[]
): { title: string; score: number; index: number } | null {
  if (!searchTitle || candidates.length === 0) return null;
  
  let bestMatch = { title: '', score: 0, index: -1 };
  
  for (let i = 0; i < candidates.length; i++) {
    const score = scoreTitleMatch(searchTitle, candidates[i]);
    if (score > bestMatch.score) {
      bestMatch = { title: candidates[i], score, index: i };
    }
  }
  
  // Only return if score is above minimum threshold
  if (bestMatch.score >= 40) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Extract brand name from title (if present at start)
 */
export function extractBrand(title: string): string | null {
  if (!title) return null;
  
  // Brand is often the first word or two before a dash, comma, or parenthesis
  const match = title.match(/^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Extract model number from title (alphanumeric patterns)
 */
export function extractModelNumber(title: string): string[] {
  if (!title) return [];
  
  // Match patterns like: ABC123, A1B2C3, MODEL-123
  const patterns = title.match(/\b[A-Z]{1,4}\d{2,}[A-Z\d]*\b/gi) || [];
  
  // Also match with dashes: MODEL-123-XYZ
  const dashPatterns = title.match(/\b[A-Z\d]+-[A-Z\d]+(-[A-Z\d]+)*\b/gi) || [];
  
  return [...new Set([...patterns, ...dashPatterns])];
}

/**
 * Compare two model numbers
 */
export function modelNumberMatch(modelA: string, modelB: string): boolean {
  if (!modelA || !modelB) return false;
  
  const normalizedA = modelA.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedB = modelB.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return normalizedA === normalizedB;
}
