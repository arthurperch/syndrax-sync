const FINGERPRINT_KEY = 'syndrax_fingerprints';

const SCORES = {
  ASIN_REDIRECT:          100,
  BRAND_CHANGED:           90,
  DIMENSIONS_CHANGED:      85,
  IMAGE_HASH_CHANGED:      80,
  WEIGHT_CHANGED:          80,
  KEYWORD_SIMILARITY_ZERO: 70,
  IMAGE_URL_CHANGED:       65,
  CATEGORY_CHANGED:        60,
  REVIEWS_DROPPED_80PCT:   50,
  VARIANT_CHANGED:         45,  // NEW: variant label changed
  RATING_DROPPED_2PT:      30,
  KEYWORD_SIMILARITY_LOW:  30,
  IMAGE_COUNT_CHANGED:     25,
};

const THRESHOLD_DELIST = 80;
const THRESHOLD_FLAG   = 50;
const THRESHOLD_LOG    = 30;

const IGNORE_WORDS = new Set([
  'the','and','for','with','your','our','this','that',
  'have','from','are','was','will','has','perfect','great',
  'best','high','quality','easy','new','free','includes',
  'included','features','product','item','made','make',
  'use','used','using','also','more','very','can'
]);

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function extractKeywords(bullets: string[]): string[] {
  const text = bullets.join(' ').toLowerCase();
  return text.split(/\s+/)
    .filter(w => w.length > 4)
    .filter(w => !IGNORE_WORDS.has(w))
    .filter(w => /^[a-z0-9-]+$/.test(w))
    .slice(0, 20);
}

function keywordSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 1; // No keywords = skip check
  const s1 = new Set(a);
  const s2 = new Set(b);
  const intersection = [...s1].filter(w => s2.has(w));
  const union = new Set([...s1, ...s2]);
  return union.size === 0 ? 1 : intersection.length / union.size;
}

async function loadFingerprints(): Promise<Record<string, any>> {
  const r = await chrome.storage.local.get(FINGERPRINT_KEY);
  return r[FINGERPRINT_KEY] || {};
}

async function saveFingerprints(data: Record<string, any>): Promise<void> {
  await chrome.storage.local.set({ [FINGERPRINT_KEY]: data });
}

export async function checkFingerprint(
  item: { listingId: string; title: string; asin: string; variantLabel?: string },
  amazon: {
    title: string;
    price: number;
    brand: string;
    imageUrl: string;
    imageCount: number;
    category: string;
    dimensions: string;
    weight: string;
    reviewCount: number;
    starRating: number;
    bullets: string[];
    finalAsin: string;
    selectedVariantLabel?: string; // NEW: current variant label from Amazon
  }
): Promise<{ action: 'clean'|'log'|'flag'|'delist'|'baseline'; score: number; signals: string[]; reasons: string[] }> {

  const prints = await loadFingerprints();
  const baseline = prints[item.listingId]?.fingerprint;

  // First time — capture baseline, no action
  if (!baseline) {
    prints[item.listingId] = {
      fingerprint: {
        capturedAt: new Date().toISOString(),
        brand: amazon.brand,
        imageUrl: amazon.imageUrl,
        imageHash: simpleHash(amazon.imageUrl),
        imageCount: amazon.imageCount,
        category: amazon.category,
        dimensions: amazon.dimensions,
        weight: amazon.weight,
        reviewCount: amazon.reviewCount,
        starRating: amazon.starRating,
        keywords: extractKeywords(amazon.bullets),
        variantLabel: amazon.selectedVariantLabel || '' // NEW: store variant label
      }
    };
    await saveFingerprints(prints);
    return { action: 'baseline', score: 0, signals: [], reasons: ['First scan — baseline captured'] };
  }

  const signals: string[] = [];
  const reasons: string[] = [];
  let score = 0;

  const add = (sig: string, pts: number, reason: string) => {
    score += pts;
    signals.push(sig);
    reasons.push(reason);
  };

  // ASIN redirect
  if (amazon.finalAsin && amazon.finalAsin !== item.asin) {
    add('ASIN_REDIRECT', SCORES.ASIN_REDIRECT,
      `Amazon redirected ${item.asin} → ${amazon.finalAsin}. Original product no longer exists at this URL.`);
  }

  // Brand changed
  if (baseline.brand && amazon.brand &&
      baseline.brand.toLowerCase() !== amazon.brand.toLowerCase()) {
    add('BRAND_CHANGED', SCORES.BRAND_CHANGED,
      `Brand changed: "${baseline.brand}" → "${amazon.brand}". Different manufacturer — likely ASIN hijack.`);
  }

  // Dimensions changed
  if (baseline.dimensions && amazon.dimensions &&
      baseline.dimensions !== amazon.dimensions) {
    add('DIMENSIONS_CHANGED', SCORES.DIMENSIONS_CHANGED,
      `Dimensions changed: "${baseline.dimensions}" → "${amazon.dimensions}". Different physical size = different product.`);
  }

  // Image hash changed
  const currentHash = simpleHash(amazon.imageUrl);
  if (baseline.imageHash && currentHash !== baseline.imageHash) {
    add('IMAGE_HASH_CHANGED', SCORES.IMAGE_HASH_CHANGED,
      `Main product image changed. Supplier uploaded new photo — possible design or product change.`);
  }

  // Weight changed
  if (baseline.weight && amazon.weight &&
      baseline.weight !== amazon.weight) {
    add('WEIGHT_CHANGED', SCORES.WEIGHT_CHANGED,
      `Weight changed: ${baseline.weight} → ${amazon.weight}. Different weight = different physical product.`);
  }

  // Keyword similarity
  const currentKeywords = extractKeywords(amazon.bullets);
  const similarity = keywordSimilarity(baseline.keywords || [], currentKeywords);
  if (similarity < 0.10) {
    add('KEYWORD_SIMILARITY_ZERO', SCORES.KEYWORD_SIMILARITY_ZERO,
      `Description keywords have ${(similarity*100).toFixed(0)}% overlap with baseline. Product description is completely different — almost certainly a different product.`);
  } else if (similarity < 0.25) {
    add('KEYWORD_SIMILARITY_LOW', SCORES.KEYWORD_SIMILARITY_LOW,
      `Description keywords only ${(similarity*100).toFixed(0)}% match with baseline. Significant product description change detected.`);
  }

  // Image URL changed
  if (baseline.imageUrl && amazon.imageUrl &&
      baseline.imageUrl !== amazon.imageUrl &&
      !signals.includes('IMAGE_HASH_CHANGED')) {
    add('IMAGE_URL_CHANGED', SCORES.IMAGE_URL_CHANGED,
      `Amazon image URL changed. New product photo was uploaded to this listing.`);
  }

  // Category changed
  if (baseline.category && amazon.category &&
      baseline.category !== amazon.category) {
    add('CATEGORY_CHANGED', SCORES.CATEGORY_CHANGED,
      `Category changed: "${baseline.category}" → "${amazon.category}". Product type classification changed.`);
  }

  // Reviews dropped 80%+
  if (baseline.reviewCount > 50 && amazon.reviewCount > 0) {
    const drop = (baseline.reviewCount - amazon.reviewCount) / baseline.reviewCount * 100;
    if (drop >= 80) {
      add('REVIEWS_DROPPED_80PCT', SCORES.REVIEWS_DROPPED_80PCT,
        `Reviews dropped ${drop.toFixed(0)}%: ${baseline.reviewCount.toLocaleString()} → ${amazon.reviewCount.toLocaleString()}. Likely ASIN hijack — new product wiped original reviews.`);
    }
  }

  // Rating dropped 2+ stars
  if (baseline.starRating > 0 && amazon.starRating > 0) {
    const drop = baseline.starRating - amazon.starRating;
    if (drop >= 2.0) {
      add('RATING_DROPPED_2PT', SCORES.RATING_DROPPED_2PT,
        `Star rating dropped ${drop.toFixed(1)} points: ${baseline.starRating} → ${amazon.starRating}. Severe customer dissatisfaction detected.`);
    }
  }

  // Image count changed
  if (baseline.imageCount > 0 && Math.abs(amazon.imageCount - baseline.imageCount) >= 3) {
    add('IMAGE_COUNT_CHANGED', SCORES.IMAGE_COUNT_CHANGED,
      `Image count changed: ${baseline.imageCount} → ${amazon.imageCount} photos. Photo gallery significantly changed.`);
  }

  // ─────────────────────────────────────────────────────
  // VARIANT CHANGED — size or color we sell may have changed
  // ─────────────────────────────────────────────────────
  const baselineVariant = baseline.variantLabel || '';
  const currentVariant = amazon.selectedVariantLabel || '';

  if (baselineVariant && currentVariant && baselineVariant !== currentVariant) {
    add('VARIANT_CHANGED', SCORES.VARIANT_CHANGED,
      `Variant changed from "${baselineVariant}" to "${currentVariant}". ` +
      `The specific size/color your eBay listing shows may now be different from what Amazon ships.`);
  }

  // Determine action
  let action: 'clean'|'log'|'flag'|'delist' = 'clean';
  if (score >= THRESHOLD_DELIST) action = 'delist';
  else if (score >= THRESHOLD_FLAG) action = 'flag';
  else if (score >= THRESHOLD_LOG) action = 'log';

  // Update stored record
  prints[item.listingId].lastScore = score;
  prints[item.listingId].lastSignals = signals;
  prints[item.listingId].lastScanned = new Date().toISOString();
  prints[item.listingId].status = action;
  await saveFingerprints(prints);

  return { action, score, signals, reasons };
}

export { SCORES };
