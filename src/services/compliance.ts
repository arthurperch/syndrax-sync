// TASK-007: ComplianceFilter - Risk Assessment and Filtering
import type { AmazonProduct } from './research';

export interface ComplianceResult {
  passed: boolean;
  reasons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  filtersFailed: string[];
}

// VERO Brand Lists
const VERO_TIER1_BRANDS = [
  'Apple', 'Samsung', 'Sony', 'Microsoft', 'Google', 'Amazon',
  'Nintendo', 'PlayStation', 'Xbox',
  'Nike', 'Adidas', 'Under Armour', 'Puma', 'Reebok', 'New Balance', 'Jordan', 'Yeezy',
  'Louis Vuitton', 'Gucci', 'Chanel', 'Prada', 'Hermès', 'Hermes', 'Burberry', 'Versace', 'Dior', 'Fendi', 'Balenciaga', 'Givenchy',
  'Rolex', 'Cartier', 'Tiffany', 'Omega', 'TAG Heuer', 'Patek Philippe',
  'Lego', 'Disney', 'Marvel', 'Star Wars', 'Pokemon', 'Pokémon', 'Hello Kitty', 'Sanrio', 'Barbie', 'Hot Wheels', 'Mattel', 'Hasbro'
];

const VERO_TIER2_BRANDS = [
  'Bose', 'JBL', 'Beats', 'Dyson', 'LG', 'Panasonic', 'Canon', 'Nikon', 'GoPro', 'DJI', 'Garmin', 'Fitbit',
  'North Face', 'Patagonia', 'Columbia', 'Lululemon', 'Ralph Lauren', 'Polo', 'Tommy Hilfiger', 'Calvin Klein', 'Lacoste', 'Oakley', 'Ray-Ban',
  'MAC', 'Estée Lauder', 'Clinique', 'Urban Decay', 'Too Faced', 'Benefit', 'NARS', 'Bobbi Brown',
  'Keurig', 'KitchenAid', 'Yeti', 'Hydroflask', 'Instant Pot', 'Vitamix', 'Ninja',
  'Tesla', 'BMW', 'Mercedes', 'Audi', 'Ford', 'Harley Davidson', 'Harley-Davidson'
];

const VERO_TIER3_BRANDS = [
  'NFL', 'NBA', 'MLB', 'NHL', 'NCAA',
  'Peppa Pig', 'Paw Patrol', 'SpongeBob', 'Sesame Street', 'Dora',
  'DeWalt', 'Milwaukee', 'Makita', 'Bosch', 'Snap-On',
  'Coleman', 'REI', 'Osprey', 'Kelty',
  'Fender', 'Gibson', 'Taylor', 'Martin'
];

const VERO_BRANDS = [...VERO_TIER1_BRANDS, ...VERO_TIER2_BRANDS, ...VERO_TIER3_BRANDS];

// Compatibility Keywords (allow these even for VERO brands)
const COMPATIBILITY_KEYWORDS = [
  'for', 'compatible with', 'fits', 'replacement for', 'works with', 'designed for',
  'case for', 'cover for', 'charger for', 'cable for', 'accessory for', 'screen protector for',
  'stand for', 'mount for', 'holder for', 'adapter for', 'sleeve for', 'bag for', 'strap for', 'band for',
  'replacement', 'generic', 'aftermarket', 'third party', 'non-oem', 'compatible', 'alternative'
];

// Banned Items Keywords
const BANNED_KEYWORDS = [
  // Medical/Drug
  'syringes', 'needles', 'hypodermic', 'drug paraphernalia', 'bongs', 'pipes', 'rolling papers',
  'prescription medication', 'controlled substances', 'steroids', 'human growth hormone', 'HGH',
  // Weapons
  'firearms', 'guns', 'rifles', 'pistols', 'ammunition', 'ammo', 'bullets', 'explosives', 'grenades', 'bombs',
  'fireworks', 'stun guns', 'tasers', 'brass knuckles', 'switchblade', 'butterfly knife', 'balisong',
  'throwing stars', 'nunchucks', 'blackjack', 'slingshot', 'crossbow',
  // Dangerous
  'poison', 'toxic', 'hazardous materials', 'asbestos', 'radioactive', 'mercury', 'cyanide',
  // Fraud
  'counterfeit', 'fake', 'replica', 'knockoff', 'bootleg', 'pirated', 'stolen', 'clone',
  // Recalled
  'recalled', 'banned by FDA', 'banned by CPSC', 'safety recall',
  // Adult
  'adult content', 'pornography', 'explicit', 'xxx', 'sex toy', 'escort services',
  // Living
  'live animals', 'human remains', 'body parts', 'organs',
  // Services
  'gift cards', 'digital downloads', 'software keys', 'license codes',
  // Government
  'police badges', 'government ID', 'passport', 'driver license', 'social security', 'military insignia',
  // Tobacco/Alcohol
  'cigarettes', 'tobacco', 'vape', 'e-cigarette', 'alcohol', 'wine', 'beer', 'liquor'
];

// Fragile/Liquid Keywords
const FRAGILE_KEYWORDS = [
  'glass', 'ceramic', 'porcelain', 'crystal', 'mirror', 'china', 'delicate', 'breakable', 'fragile',
  'liquid', 'gel', 'oil', 'lotion', 'cream', 'spray', 'perfume', 'cologne', 'serum', 'toner', 'cleanser',
  'shampoo', 'conditioner', 'body wash', 'soap', 'nail polish', 'paint', 'ink', 'dye',
  'bottle', 'jar', 'candle', 'diffuser'
];

/**
 * Check if product passes all compliance filters
 * Returns detailed results with reasons for any failures
 */
export function checkCompliance(product: AmazonProduct): ComplianceResult {
  const reasons: string[] = [];
  const filtersFailed: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  // FILTER 1: VERO Brands Check (CRITICAL - Cannot Disable)
  const veroResult = checkVERO(product);
  if (!veroResult.passed) {
    reasons.push(veroResult.reason);
    filtersFailed.push('vero_brands');
    riskLevel = 'CRITICAL';
  }

  // FILTER 2: Banned Items Check (CRITICAL - Cannot Disable)
  const bannedResult = checkBannedItems(product);
  if (!bannedResult.passed) {
    reasons.push(bannedResult.reason);
    filtersFailed.push('banned_items');
    riskLevel = 'CRITICAL';
  }

  // FILTER 3: Price Threshold Check
  if (product.price < 5 || product.price > 500) {
    reasons.push(`Price out of range: $${product.price} (acceptable: $5-$500)`);
    filtersFailed.push('price_threshold');
    riskLevel = 'HIGH';
  }

  // FILTER 4: Margin Check (minimum 15% net margin)
  // Assuming 2x markup: eBay price = Amazon price * 2
  // Net margin = (eBay price - Amazon price - fees) / eBay price
  // With 2x markup and ~12.9% eBay fees: margin ≈ 43%
  // But we need minimum 15% to be safe
  const ebayPrice = product.price * 2;
  const ebayFees = ebayPrice * 0.129; // ~12.9% eBay fees
  const netMargin = ((ebayPrice - product.price - ebayFees) / ebayPrice) * 100;
  if (netMargin < 15) {
    reasons.push(`Margin too low: ${netMargin.toFixed(1)}% (minimum: 15%)`);
    filtersFailed.push('margin_check');
    riskLevel = 'HIGH';
  }

  // FILTER 5: Review Count Minimum (10 reviews)
  if (product.reviewCount < 10) {
    reasons.push(`Insufficient reviews: ${product.reviewCount} (minimum: 10)`);
    filtersFailed.push('review_count');
    riskLevel = 'MEDIUM';
  }

  // FILTER 6: Rating Minimum (3.5 stars)
  if (product.rating < 3.5) {
    reasons.push(`Rating too low: ${product.rating} stars (minimum: 3.5)`);
    filtersFailed.push('rating_minimum');
    riskLevel = 'HIGH';
  }

  // FILTER 7: Title Keyword Blacklist
  const titleLower = product.title.toLowerCase();
  for (const keyword of FRAGILE_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      reasons.push(`Fragile/liquid item detected: contains "${keyword}"`);
      filtersFailed.push('fragile_liquid');
      riskLevel = 'HIGH';
      break;
    }
  }

  const passed = filtersFailed.length === 0;

  return {
    passed,
    reasons,
    riskLevel,
    filtersFailed
  };
}

/**
 * Check if product is a VERO-protected brand
 */
function checkVERO(product: AmazonProduct): { passed: boolean; reason: string } {
  const titleLower = product.title.toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();

  // Check if it's a compatible accessory (allowed even for VERO brands)
  if (isCompatibleAccessory(product.title)) {
    return {
      passed: true,
      reason: 'Compatible accessory - allowed'
    };
  }

  // Check against VERO brand list
  for (const brand of VERO_BRANDS) {
    const brandCheck = brand.toLowerCase();
    if (titleLower.includes(brandCheck) || brandLower === brandCheck) {
      return {
        passed: false,
        reason: `VERO protected brand detected: ${brand}`
      };
    }
  }

  return {
    passed: true,
    reason: 'No VERO brand detected'
  };
}

/**
 * Check if product is a compatible accessory
 */
function isCompatibleAccessory(title: string): boolean {
  const titleLower = title.toLowerCase();
  return COMPATIBILITY_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

/**
 * Check if product contains banned items
 */
function checkBannedItems(product: AmazonProduct): { passed: boolean; reason: string } {
  const contentToCheck = `${product.title} ${product.description || ''}`.toLowerCase();

  for (const keyword of BANNED_KEYWORDS) {
    if (contentToCheck.includes(keyword.toLowerCase())) {
      return {
        passed: false,
        reason: `eBay banned item detected: contains "${keyword}"`
      };
    }
  }

  return {
    passed: true,
    reason: 'No banned items detected'
  };
}

/**
 * Get risk level color for Discord messages
 */
export function getRiskLevelColor(riskLevel: string): number {
  switch (riskLevel) {
    case 'LOW':
      return 0x00FF88; // Green
    case 'MEDIUM':
      return 0xFFD700; // Gold
    case 'HIGH':
      return 0xFF8C00; // Orange
    case 'CRITICAL':
      return 0xFF0000; // Red
    default:
      return 0x808080; // Gray
  }
}

/**
 * Get risk level emoji
 */
export function getRiskLevelEmoji(riskLevel: string): string {
  switch (riskLevel) {
    case 'LOW':
      return '✅';
    case 'MEDIUM':
      return '⚠️';
    case 'HIGH':
      return '🔴';
    case 'CRITICAL':
      return '🚨';
    default:
      return '❓';
  }
}
