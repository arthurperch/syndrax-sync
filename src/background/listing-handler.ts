import { VERO_BRANDS } from '../services/compliance';
import { processProductImages, getEbayImageUrls } from '../services/image-pipeline';

const HIGH_RISK_BRANDS = ['Apple', 'Samsung', 'Nike', 'Louis Vuitton', 'Disney'];

export function handleCheckVero(title: string, brand: string): { blocked: boolean; reason: string } {
  const veroSet = new Set(VERO_BRANDS.map(b => b.toLowerCase()));
  if (veroSet.has(brand.toLowerCase())) {
    return { blocked: true, reason: `Brand "${brand}" is on the VERO list` };
  }
  const combined = (brand + ' ' + title).toLowerCase();
  for (const risk of HIGH_RISK_BRANDS) {
    if (combined.includes(risk.toLowerCase())) {
      return { blocked: true, reason: `High-risk brand "${risk}" detected` };
    }
  }
  return { blocked: false, reason: '' };
}

// Maps tabId → resolver. Resolved when content script sends LISTING_COMPLETE.
export const pendingListingResolvers: Map<number, (result: { success: boolean; error?: string }) => void> = new Map();

export function resolveListingCompletion(tabId: number, result: { success: boolean; error?: string }): void {
  const resolver = pendingListingResolvers.get(tabId);
  if (resolver) {
    pendingListingResolvers.delete(tabId);
    resolver(result);
  }
}

export async function handleCreateEbayListing(payload: {
  asin: string;
  ebayPrice: number;
  title: string;
  description?: string;
  image?: string;
  images?: string[];
  listingType?: string;
  condition?: string;
  quantity?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { asin, ebayPrice, title, description, image, images, listingType, condition, quantity } = payload;

  let finalTitle = title;
  let finalDescription = description;

  // For opti/seo listing types, generate an AI-optimised SEO title + description
  // Only attempt if API key is configured — skip silently if not
  if ((listingType === 'opti' || listingType === 'seo') && title) {
    try {
      const { storage } = await import('../services/storage');
      const apiKey = await storage.getApiKey().catch(() => null);
      if (apiKey) {
        const { generateEbayListing } = await import('../services/ai');
        const seoResult = await generateEbayListing({
          title,
          description: description || title,
          price: ebayPrice,
          images: image ? [image] : [],
        });
        if (seoResult?.ebayTitle)       finalTitle       = seoResult.ebayTitle;
        if (seoResult?.ebayDescription) finalDescription = seoResult.ebayDescription;
        console.log('[Syndrax] AI SEO title generated for', asin);
      } else {
        console.log('[Syndrax] No API key — using Amazon title for', asin);
      }
    } catch (e) {
      console.warn('[Syndrax] SEO generation error for', asin, '— using Amazon title');
    }
  }

  // Collect all image URLs (from payload.image or payload.images)
  const imageUrls = [];
  if (payload.image) imageUrls.push(payload.image);
  if (payload.images && Array.isArray(payload.images)) imageUrls.push(...payload.images);

  // Convert to base64 dataUrls via image pipeline
  let ebayImageUrls: string[] = [];
  if (imageUrls.length > 0) {
    try {
      const pipelineResult = await processProductImages(asin, imageUrls);
      ebayImageUrls = getEbayImageUrls(pipelineResult);
      console.log(`[Syndrax] Converted ${imageUrls.length} images to base64 for ${asin}`);
    } catch (err) {
      console.warn(`[Syndrax] Image processing failed for ${asin}:`, err);
      // Continue without images rather than failing the listing
    }
  }

  await chrome.storage.local.set({
    pendingListing: {
      title: finalTitle,
      description: finalDescription,
      price: ebayPrice,
      condition,
      quantity,
      images: ebayImageUrls,
      asin
    }
  });

  // Pass title via URL param — eBay pre-fills the keyword search box.
  // ebay-prelist.ts clicks Search → skips match → selects New → Continue to listing.
  const tab = await chrome.tabs.create({
    url: `https://www.ebay.com/sl/prelist/home?title=${encodeURIComponent(title)}`,
    active: true,
  });
  const tabId = tab.id!;

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const TIMEOUT_MS = 90_000;

    const timer = setTimeout(() => {
      pendingListingResolvers.delete(tabId);
      chrome.tabs.remove(tabId).catch(() => {});
      resolve({ success: false, error: 'Listing timed out after 90 seconds' });
    }, TIMEOUT_MS);

    pendingListingResolvers.set(tabId, (result) => {
      clearTimeout(timer);
      chrome.tabs.remove(tabId).catch(() => {});
      resolve(result);
    });
  });
}
