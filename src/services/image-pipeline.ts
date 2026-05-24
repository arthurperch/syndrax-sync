/**
 * image-pipeline.ts — Image fetching, validation and optimization service
 * Session R: Fetch → decode → resize → JPEG → quality-gate → eBay-ready
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageResult {
  url: string;              // original URL
  dataUrl: string;          // base64 data URL (jpeg)
  width: number;
  height: number;
  sizeKb: number;
  quality: 'good' | 'low_res' | 'too_large' | 'failed';
  reason: string;
}

export interface ImagePipelineResult {
  asin: string;
  images: ImageResult[];    // all processed images
  primary: ImageResult | null;  // best image (highest res, good quality)
  processedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Send a message to the background service worker */
async function bgMsg<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch {
    return null;
  }
}

/** Load a dataUrl into an HTMLImageElement */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetch a single image URL via background service worker (bypasses CORS),
 * decode it to canvas, optionally resize, convert to JPEG, and return an ImageResult.
 */
export async function fetchAndProcessImage(url: string): Promise<ImageResult> {
  // 1. Fetch via background (CORS bypass)
  const fetchResult = await bgMsg<{ ok: boolean; dataUrl?: string; error?: string }>(
    'FETCH_IMAGE_FOR_PIPELINE',
    { url }
  );

  if (!fetchResult || !fetchResult.ok || !fetchResult.dataUrl) {
    return {
      url,
      dataUrl: '',
      width: 0,
      height: 0,
      sizeKb: 0,
      quality: 'failed',
      reason: fetchResult?.error ?? 'Fetch failed',
    };
  }

  // 2. Decode to canvas
  let img: HTMLImageElement;
  try {
    img = await loadImage(fetchResult.dataUrl);
  } catch {
    return {
      url,
      dataUrl: '',
      width: 0,
      height: 0,
      sizeKb: 0,
      quality: 'failed',
      reason: 'Image decode failed',
    };
  }

  let { naturalWidth: w, naturalHeight: h } = img;

  // 3. Resize if > 1600px on longest side (maintain aspect ratio)
  const MAX_SIDE = 1600;
  if (w > MAX_SIDE || h > MAX_SIDE) {
    if (w >= h) {
      h = Math.round((h / w) * MAX_SIDE);
      w = MAX_SIDE;
    } else {
      w = Math.round((w / h) * MAX_SIDE);
      h = MAX_SIDE;
    }
  }

  // 4. Draw to canvas and convert to JPEG at 85% quality
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      url,
      dataUrl: '',
      width: w,
      height: h,
      sizeKb: 0,
      quality: 'failed',
      reason: 'Canvas context unavailable',
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  // 5. Compute sizeKb from dataUrl length
  // base64 overhead: each char ≈ 0.75 bytes; subtract the data:image/jpeg;base64, prefix
  const base64Data = dataUrl.split(',')[1] ?? '';
  const sizeKb = Math.round((base64Data.length * 0.75) / 1024);

  // 6. Quality logic
  let quality: ImageResult['quality'];
  let reason: string;

  if (sizeKb > 500) {
    quality = 'too_large';
    reason = `${sizeKb}kb after resize (>500kb limit)`;
    console.warn(`[ImagePipeline] Image too large after resize: ${url} — ${sizeKb}kb`);
  } else if (w < 400 || h < 400) {
    quality = 'low_res';
    reason = `${w}×${h}px (minimum 400px required)`;
  } else {
    quality = 'good';
    reason = `${w}×${h}px, ${sizeKb}kb`;
  }

  return { url, dataUrl, width: w, height: h, sizeKb, quality, reason };
}

/**
 * Process up to 6 images for a product ASIN.
 * Sorts results: good → low_res → too_large → failed.
 * Sets primary = first 'good' image, or first 'low_res' if no good ones.
 */
export async function processProductImages(
  asin: string,
  imageUrls: string[]
): Promise<ImagePipelineResult> {
  const urls = imageUrls.slice(0, 6);

  // Process all images in parallel
  const images = await Promise.all(urls.map(url => fetchAndProcessImage(url)));

  // Sort by quality tier
  const qualityOrder: Record<ImageResult['quality'], number> = {
    good: 0,
    low_res: 1,
    too_large: 2,
    failed: 3,
  };
  images.sort((a, b) => qualityOrder[a.quality] - qualityOrder[b.quality]);

  // Determine primary image
  const primary =
    images.find(img => img.quality === 'good') ??
    images.find(img => img.quality === 'low_res') ??
    null;

  return {
    asin,
    images,
    primary,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Returns an array of dataUrls from non-failed images, capped at 12 (eBay limit).
 */
export function getEbayImageUrls(result: ImagePipelineResult): string[] {
  return result.images
    .filter(img => img.quality !== 'failed')
    .map(img => img.dataUrl)
    .slice(0, 12);
}
