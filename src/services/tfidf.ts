/**
 * tfidf.ts — Pure TF-IDF Keyword Extraction Service
 * Tokenizes eBay listing titles and computes TF-IDF scores for keyword snowball.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface KeywordScore {
  term: string;
  tf: number;       // term frequency in this document (averaged)
  idf: number;      // inverse document frequency across corpus
  tfidf: number;    // tf * idf
  count: number;    // raw occurrences across all documents
}

export interface SnowballResult {
  seed: string;              // original search term
  keywords: KeywordScore[];  // ranked by tfidf score, top 20
  titles: string[];          // source titles used
  generatedAt: string;       // ISO timestamp
}

// ═══════════════════════════════════════════════════════════════
// STOPWORDS
// ═══════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'has', 'have', 'had', 'will', 'would', 'could', 'should', 'this', 'that',
  'these', 'those', 'it', 'its', 'new', 'used', 'lot', 'set', 'buy', 'get',
  'free', 'fast', 'ship', 'ships', 'shipping',
]);

// ═══════════════════════════════════════════════════════════════
// PURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

export function computeTFIDF(titles: string[]): KeywordScore[] {
  if (titles.length === 0) return [];

  const totalDocs = titles.length;

  // Tokenize each document
  const tokenizedDocs = titles.map(t => tokenize(t));

  // Build per-document term frequency maps
  const docTFMaps: Map<string, number>[] = tokenizedDocs.map(tokens => {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
    // Normalize by document length
    const docLen = tokens.length || 1;
    const tfMap = new Map<string, number>();
    freq.forEach((count, term) => {
      tfMap.set(term, count / docLen);
    });
    return tfMap;
  });

  // Count raw occurrences and docs containing each term
  const rawCount = new Map<string, number>();
  const docsContaining = new Map<string, number>();

  tokenizedDocs.forEach(tokens => {
    const seen = new Set<string>();
    tokens.forEach(token => {
      rawCount.set(token, (rawCount.get(token) || 0) + 1);
      if (!seen.has(token)) {
        docsContaining.set(token, (docsContaining.get(token) || 0) + 1);
        seen.add(token);
      }
    });
  });

  // Compute IDF and average TF across all docs
  const allTerms = new Set<string>();
  docTFMaps.forEach(m => m.forEach((_, term) => allTerms.add(term)));

  const scores: KeywordScore[] = [];

  allTerms.forEach(term => {
    const df = docsContaining.get(term) || 0;
    const idf = Math.log(totalDocs / (1 + df));

    // Average TF across all documents
    let tfSum = 0;
    docTFMaps.forEach(tfMap => {
      tfSum += tfMap.get(term) || 0;
    });
    const tf = tfSum / totalDocs;

    const tfidf = tf * idf;
    const count = rawCount.get(term) || 0;

    scores.push({ term, tf, idf, tfidf, count });
  });

  // Sort by tfidf descending, return top 30
  return scores
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 30);
}

export function generateSnowball(seed: string, titles: string[]): SnowballResult {
  const allKeywords = computeTFIDF(titles);
  return {
    seed,
    keywords: allKeywords.slice(0, 20),
    titles,
    generatedAt: new Date().toISOString(),
  };
}
