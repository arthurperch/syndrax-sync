// TASK-008: EbayLister - eBay Listing Builder
import type { AmazonProduct } from './research';
import { storage } from './storage';

export interface EbayListing {
  title: string;
  price: number;
  description: string;
  images: string[];
  category: string;
  condition: 'New' | 'Like New' | 'Good' | 'Acceptable';
  quantity: number;
  shippingCost: number;
  handlingTime: number;
  amazonPrice: number;
  amazonAsin: string;
  markup: number;
  margin: number;
}

/**
 * Create an eBay listing from an Amazon product
 * Applies markup from storage settings and calculates pricing
 */
export async function createListing(product: AmazonProduct): Promise<EbayListing> {
  // Get markup settings from storage
  const settings = await storage.getSettings();
  const markupPercent = settings.markupPercent || 200; // Default 2.0x (200%)
  const markup = markupPercent / 100; // Convert to multiplier (e.g., 200% = 2.0)
  
  // Enforce minimum markup of 1.1x
  const MIN_MARKUP = 1.1;
  const finalMarkup = Math.max(markup, MIN_MARKUP);
  
  // Calculate eBay price
  const ebayPrice = parseFloat((product.price * finalMarkup).toFixed(2));
  
  // Calculate margin
  const ebayFees = ebayPrice * 0.129; // ~12.9% eBay fees
  const netMargin = ((ebayPrice - product.price - ebayFees) / ebayPrice) * 100;
  
  // Build listing title
  const title = buildListingTitle(product);
  
  // Build listing description
  const description = buildListingDescription(product, ebayPrice);
  
  // Prepare images (limit to 12 for eBay)
  const images = prepareImages(product);
  
  const listing: EbayListing = {
    title,
    price: ebayPrice,
    description,
    images,
    category: product.category || 'Miscellaneous',
    condition: 'New',
    quantity: 1,
    shippingCost: calculateShippingCost(product.price),
    handlingTime: 1, // 1 business day
    amazonPrice: product.price,
    amazonAsin: product.asin,
    markup: finalMarkup,
    margin: netMargin
  };
  
  console.log(`[Lister] Created listing for ${product.title}`);
  console.log(`  Amazon: $${product.price} → eBay: $${ebayPrice} (${finalMarkup}x markup, ${netMargin.toFixed(1)}% margin)`);
  
  return listing;
}

/**
 * Build optimized eBay listing title
 * eBay titles have 80 character limit
 */
function buildListingTitle(product: AmazonProduct): string {
  let title = product.title;
  
  // Remove common Amazon phrases that don't help on eBay
  title = title.replace(/\s*\(.*?Amazon.*?\)/gi, '');
  title = title.replace(/\s*\[.*?Amazon.*?\]/gi, '');
  title = title.replace(/\s*-\s*Amazon.*?$/gi, '');
  
  // Add key selling points if space allows
  if (title.length < 60) {
    if (product.rating >= 4.5) {
      title += ' | Highly Rated';
    }
  }
  
  // Truncate to 80 characters (eBay limit)
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }
  
  return title;
}

/**
 * Build eBay listing description
 */
function buildListingDescription(product: AmazonProduct, ebayPrice: number): string {
  const lines: string[] = [];
  
  lines.push('=== PRODUCT DETAILS ===');
  lines.push(product.title);
  lines.push('');
  
  if (product.description) {
    lines.push('=== DESCRIPTION ===');
    lines.push(product.description);
    lines.push('');
  }
  
  lines.push('=== RATINGS ===');
  lines.push(`⭐ Rating: ${product.rating} stars`);
  lines.push(`📝 Reviews: ${product.reviewCount} customer reviews`);
  lines.push('');
  
  lines.push('=== PRICING ===');
  lines.push(`💰 Our Price: $${ebayPrice.toFixed(2)}`);
  lines.push(`📦 Condition: New`);
  lines.push('');
  
  lines.push('=== SHIPPING ===');
  lines.push('🚚 Fast & Reliable Shipping');
  lines.push('📍 Ships within 1 business day');
  lines.push('');
  
  lines.push('=== ABOUT THIS ITEM ===');
  lines.push(`ASIN: ${product.asin}`);
  lines.push(`Brand: ${product.brand || 'Unknown'}`);
  lines.push(`Category: ${product.category || 'Miscellaneous'}`);
  lines.push('');
  
  lines.push('=== GUARANTEE ===');
  lines.push('✓ 100% Authentic');
  lines.push('✓ Money-back guarantee if not as described');
  lines.push('✓ Fast customer service');
  lines.push('');
  
  lines.push('Thank you for your purchase!');
  
  return lines.join('\n');
}

/**
 * Prepare images for eBay listing
 * eBay allows up to 12 images
 */
function prepareImages(product: AmazonProduct): string[] {
  const images: string[] = [];
  
  // Add main product image
  if (product.imageUrl) {
    images.push(product.imageUrl);
  }
  
  // Limit to 12 images (eBay maximum)
  return images.slice(0, 12);
}

/**
 * Calculate estimated shipping cost based on product price
 * This is a simple heuristic - actual shipping depends on weight/size
 */
function calculateShippingCost(productPrice: number): number {
  // Estimate based on price tier
  if (productPrice < 10) {
    return 3.99; // Small items
  } else if (productPrice < 50) {
    return 5.99; // Medium items
  } else if (productPrice < 100) {
    return 8.99; // Larger items
  } else {
    return 12.99; // Large/heavy items
  }
}

/**
 * Format listing for display/logging
 */
export function formatListingForDisplay(listing: EbayListing): string {
  return `
📦 eBay Listing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title: ${listing.title}
Price: $${listing.price.toFixed(2)}
Condition: ${listing.condition}
Quantity: ${listing.quantity}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amazon Price: $${listing.amazonPrice.toFixed(2)}
Markup: ${(listing.markup * 100).toFixed(0)}%
Net Margin: ${listing.margin.toFixed(1)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Shipping: $${listing.shippingCost.toFixed(2)}
Handling Time: ${listing.handlingTime} business day(s)
Images: ${listing.images.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}
