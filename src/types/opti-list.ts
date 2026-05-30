// ============================================================================
// Opti-List Type Definitions — v1
// Single source of truth for all per-ASIN product data.
// Stored in chrome.storage.local under 'syndrax_opti_list'.
// ============================================================================

export type ImageSource = 'amazon' | 'edited' | 'ai' | 'manual';
export type ImageQuality = 'good' | 'low_res' | 'too_large' | 'failed';
export type OptiItemStatus = 'DRAFT' | 'READY' | 'PROCESSING' | 'LISTED' | 'FAILED' | 'SKIPPED' | 'BLOCKED';

// ─── Image Variant ─────────────────────────────────────────────────────────
// One image per variant entry. A product can have many (original + edited + ai).

export interface ImageVariant {
  id: string;                  // uuid — unique per variant
  source: ImageSource;
  url: string;                 // Original Amazon/external URL
  dataUrl?: string;            // Base64 data URL (populated after fetch)
  order: number;               // Gallery order for eBay (0 = first)
  quality: ImageQuality;
  qualityReason?: string;      // e.g. "< 400px width"
  label?: string;              // User label: "Front", "Detail", "Box"
  sizeKb?: number;
  width?: number;
  height?: number;
  isApproved: boolean;         // User manually approved this variant
  createdAt: number;
  aiMetadata?: {
    model: string;
    prompt: string;
  };
}

// ─── Opti-List Item ────────────────────────────────────────────────────────
// Complete data record for one ASIN. Populated incrementally as pipeline runs.

export interface OptiListItem {
  asin: string;                // Primary key — never changes
  name: string;                // User-editable display name (defaults to amazon.title)

  // Raw data from Amazon scrape
  amazon: {
    title: string;
    description: string;
    brand: string;
    price: number;             // Current Amazon price (USD)
    mainImageUrl: string;      // First Amazon image URL
    imageUrls: string[];       // All image URLs from Amazon
    fetchedAt: number;
  };

  // Processed image variants (amazon originals + edited + AI-generated)
  images: ImageVariant[];
  primaryImageId: string;      // Which ImageVariant.id to use for eBay

  // AI-generated eBay listing content
  ebay: {
    title: string;             // SEO-optimized eBay title (≤80 chars)
    description: string;       // Formatted eBay description (HTML-safe)
    keywords: string[];
    generatedAt: number;
  };

  // Per-ASIN pricing — NOT global config
  pricing: {
    cost: number;              // = amazon.price
    markupPct: number;         // Per-item markup %, e.g. 100 = 2x price
    ebayPrice: number;         // = cost * (1 + markupPct / 100), rounded to 2dp
    quantity: number;          // Quantity to list on eBay
    calculatedAt: number;
  };

  status: OptiItemStatus;

  error?: {
    code: string;
    message: string;
    timestamp: number;
  };

  // Set after successful listing
  ebayItemId?: string;
  ebayListingUrl?: string;
  listedAt?: number;

  // Which fields the user has manually edited (so AI re-gen doesn't overwrite)
  userEdits: {
    title?: boolean;
    description?: boolean;
    markupPct?: boolean;
    quantity?: boolean;
    primaryImageId?: boolean;
  };

  notes?: string;
  createdAt: number;
  updatedAt: number;
  listingAttempts: number;
}

// ─── Opti-List Storage ─────────────────────────────────────────────────────
// Root container persisted to chrome.storage.local['syndrax_opti_list'].

export interface OptiListStorage {
  version: 1;

  // ASIN → OptiListItem — O(1) lookup
  items: Record<string, OptiListItem>;

  // Ordered ASIN sequence for bulk runs — user controls this order
  order: string[];

  metadata: {
    name: string;
    createdAt: number;
    updatedAt: number;
    lastBulkRunAt?: number;
  };

  // Default config for new items (user can override per-ASIN)
  defaults: {
    markupPct: number;         // Default markup %
    quantity: number;          // Default listing quantity
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function calcEbayPrice(cost: number, markupPct: number): number {
  return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

export function makeDefaultItem(asin: string, markupPct = 100): OptiListItem {
  const now = Date.now();
  return {
    asin,
    name: asin,
    amazon: {
      title: '',
      description: '',
      brand: '',
      price: 0,
      mainImageUrl: '',
      imageUrls: [],
      fetchedAt: 0,
    },
    images: [],
    primaryImageId: '',
    ebay: {
      title: '',
      description: '',
      keywords: [],
      generatedAt: 0,
    },
    pricing: {
      cost: 0,
      markupPct,
      ebayPrice: 0,
      quantity: 1,
      calculatedAt: now,
    },
    status: 'DRAFT',
    userEdits: {},
    createdAt: now,
    updatedAt: now,
    listingAttempts: 0,
  };
}

export function makeDefaultStorage(): OptiListStorage {
  return {
    version: 1,
    items: {},
    order: [],
    metadata: {
      name: 'My Opti-List',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    defaults: {
      markupPct: 100,
      quantity: 1,
    },
  };
}
