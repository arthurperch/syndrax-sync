# SYNDRAX SYNC - COMPLIANCE RULES

## Overview

This document contains all compliance rules that MUST be enforced to protect eBay accounts from suspension, VERO strikes, and policy violations. These rules are non-negotiable and form the foundation of safe dropshipping operations.

**Golden Rule: It's better to skip 100 profitable products than to list 1 product that gets your account suspended.**

---

## VERO (Verified Rights Owner Program)

### What is VERO?
VERO is eBay's intellectual property protection program. Brand owners can report listings that violate their trademarks. A single VERO strike can:
- Remove your listing immediately
- Add a strike to your account
- 3 strikes = permanent account suspension
- No appeal process for repeat offenders

### VERO Detection Logic

```typescript
// The key distinction: BRAND ITEM vs COMPATIBLE ACCESSORY

// BLOCKED: Actual brand product
"Nike Air Max 90 Running Shoes" → BLOCK (selling Nike product)

// ALLOWED: Compatible accessory
"Case for iPhone 15 Pro Max" → ALLOW (accessory FOR Apple product)
"Charger Compatible with Samsung Galaxy" → ALLOW (accessory FOR Samsung)
"Replacement Laces for Nike Shoes" → ALLOW (accessory FOR Nike)
```

### Compatibility Keywords (ALLOW if present)
These keywords indicate the product is an accessory, not the actual brand item:

```typescript
const COMPATIBILITY_KEYWORDS = [
  // Primary indicators
  'for',
  'compatible with',
  'fits',
  'replacement for',
  'works with',
  'designed for',
  
  // Accessory-specific
  'case for',
  'cover for',
  'charger for',
  'cable for',
  'accessory for',
  'screen protector for',
  'stand for',
  'mount for',
  'holder for',
  'adapter for',
  'sleeve for',
  'bag for',
  'strap for',
  'band for',
  
  // Replacement parts
  'replacement',
  'generic',
  'aftermarket',
  'third party',
  'non-oem',
  'compatible',
  'alternative'
];

function isCompatibleAccessory(title: string): boolean {
  const titleLower = title.toLowerCase();
  return COMPATIBILITY_KEYWORDS.some(keyword => 
    titleLower.includes(keyword)
  );
}
```

### VERO Detection Implementation

```typescript
interface VEROCheckResult {
  isBlocked: boolean;
  matchedBrand: string | null;
  isAccessory: boolean;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

function checkVERO(product: AmazonProduct): VEROCheckResult {
  const titleLower = product.title.toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();
  
  // Check against VERO brand list
  for (const brand of VERO_BRANDS) {
    const brandLower = brand.toLowerCase();
    
    if (titleLower.includes(brandLower) || brandLower === brandLower) {
      // Found a VERO brand - check if it's an accessory
      if (isCompatibleAccessory(product.title)) {
        return {
          isBlocked: false,
          matchedBrand: brand,
          isAccessory: true,
          reason: `Compatible accessory for ${brand} - ALLOWED`,
          confidence: 'HIGH'
        };
      } else {
        return {
          isBlocked: true,
          matchedBrand: brand,
          isAccessory: false,
          reason: `VERO protected brand product: ${brand} - BLOCKED`,
          confidence: 'HIGH'
        };
      }
    }
  }
  
  return {
    isBlocked: false,
    matchedBrand: null,
    isAccessory: false,
    reason: 'No VERO brand detected',
    confidence: 'HIGH'
  };
}
```

---

## Known VERO Brands List

### Tier 1: ALWAYS BLOCK (Extremely Aggressive Enforcement)
These brands file VERO claims within hours and have zero tolerance policies:

```typescript
const VERO_TIER1_BRANDS = [
  // Tech Giants
  'Apple',
  'Samsung',
  'Sony',
  'Microsoft',
  'Google',
  'Amazon',          // Yes, Amazon reports eBay listings
  
  // Gaming
  'Nintendo',
  'PlayStation',
  'Xbox',
  
  // Sportswear
  'Nike',
  'Adidas',
  'Under Armour',
  'Puma',
  'Reebok',
  'New Balance',
  'Jordan',
  'Yeezy',
  
  // Luxury Fashion
  'Louis Vuitton',
  'Gucci',
  'Chanel',
  'Prada',
  'Hermès',
  'Hermes',
  'Burberry',
  'Versace',
  'Dior',
  'Fendi',
  'Balenciaga',
  'Givenchy',
  
  // Luxury Accessories
  'Rolex',
  'Cartier',
  'Tiffany',
  'Omega',
  'TAG Heuer',
  'Patek Philippe',
  
  // Toys & Entertainment
  'Lego',
  'Disney',
  'Marvel',
  'Star Wars',
  'Pokemon',
  'Pokémon',
  'Hello Kitty',
  'Sanrio',
  'Barbie',
  'Hot Wheels',
  'Mattel',
  'Hasbro'
];
```

### Tier 2: HIGH RISK (Frequent Enforcement)
These brands actively monitor eBay and file regular claims:

```typescript
const VERO_TIER2_BRANDS = [
  // Electronics
  'Bose',
  'JBL',
  'Beats',
  'Dyson',
  'LG',
  'Panasonic',
  'Canon',
  'Nikon',
  'GoPro',
  'DJI',
  'Garmin',
  'Fitbit',
  
  // Fashion
  'North Face',
  'Patagonia',
  'Columbia',
  'Lululemon',
  'Ralph Lauren',
  'Polo',
  'Tommy Hilfiger',
  'Calvin Klein',
  'Lacoste',
  'Oakley',
  'Ray-Ban',
  
  // Beauty
  'MAC',
  'Estée Lauder',
  'Clinique',
  'Urban Decay',
  'Too Faced',
  'Benefit',
  'NARS',
  'Bobbi Brown',
  
  // Home
  'Keurig',
  'KitchenAid',
  'Yeti',
  'Hydroflask',
  'Instant Pot',
  'Vitamix',
  'Ninja',
  
  // Automotive
  'Tesla',
  'BMW',
  'Mercedes',
  'Audi',
  'Ford',
  'Harley Davidson',
  'Harley-Davidson'
];
```

### Tier 3: MODERATE RISK (Periodic Enforcement)
These brands file claims occasionally:

```typescript
const VERO_TIER3_BRANDS = [
  // Sports Teams (NFL, NBA, MLB, NHL)
  'NFL',
  'NBA',
  'MLB',
  'NHL',
  'NCAA',
  
  // Character Brands
  'Peppa Pig',
  'Paw Patrol',
  'SpongeBob',
  'Sesame Street',
  'Dora',
  
  // Tools
  'DeWalt',
  'Milwaukee',
  'Makita',
  'Bosch',
  'Snap-On',
  
  // Outdoors
  'Coleman',
  'REI',
  'Osprey',
  'Kelty',
  
  // Music
  'Fender',
  'Gibson',
  'Taylor',
  'Martin'
];

// Combined list for filtering
const VERO_BRANDS = [
  ...VERO_TIER1_BRANDS,
  ...VERO_TIER2_BRANDS,
  ...VERO_TIER3_BRANDS
];
```

---

## eBay Banned Items

### Categories That Are ALWAYS Blocked
These items cannot be listed on eBay under any circumstances:

```typescript
const BANNED_ITEMS = {
  // Medical/Drug Related
  medical: [
    'syringes',
    'needles',
    'hypodermic',
    'drug paraphernalia',
    'bongs',
    'pipes',
    'rolling papers',
    'prescription medication',
    'controlled substances',
    'steroids',
    'human growth hormone',
    'HGH'
  ],
  
  // Weapons
  weapons: [
    'firearms',
    'guns',
    'rifles',
    'pistols',
    'ammunition',
    'ammo',
    'bullets',
    'explosives',
    'grenades',
    'bombs',
    'fireworks',
    'stun guns',
    'tasers',
    'brass knuckles',
    'switchblade',
    'butterfly knife',
    'balisong',
    'throwing stars',
    'nunchucks',
    'blackjack',
    'slingshot',
    'crossbow'
  ],
  
  // Dangerous Items
  dangerous: [
    'poison',
    'toxic',
    'hazardous materials',
    'asbestos',
    'radioactive',
    'mercury',
    'cyanide'
  ],
  
  // Fraud/Counterfeit
  fraud: [
    'counterfeit',
    'fake',
    'replica',
    'knockoff',
    'bootleg',
    'pirated',
    'stolen',
    'clone'
  ],
  
  // Recalled Items
  recalled: [
    'recalled',
    'banned by FDA',
    'banned by CPSC',
    'safety recall'
  ],
  
  // Adult Content
  adult: [
    'adult content',
    'pornography',
    'explicit',
    'xxx',
    'sex toy',         // Note: Some adult items ARE allowed on eBay
    'escort services'
  ],
  
  // Living Things
  living: [
    'live animals',
    'human remains',
    'body parts',
    'organs'
  ],
  
  // Services/Intangibles
  services: [
    'gift cards',      // Gift card dropshipping is banned
    'digital downloads',
    'software keys',
    'license codes'
  ],
  
  // Government Items
  government: [
    'police badges',
    'government ID',
    'passport',
    'driver license',
    'social security',
    'military insignia'
  ],
  
  // Tobacco/Alcohol
  regulated: [
    'cigarettes',
    'tobacco',
    'vape',
    'e-cigarette',
    'alcohol',
    'wine',
    'beer',
    'liquor'
  ]
};

// Flatten for easy checking
const ALL_BANNED_KEYWORDS = Object.values(BANNED_ITEMS).flat();
```

### Banned Items Detection

```typescript
interface BannedItemResult {
  isBanned: boolean;
  category: string | null;
  matchedKeyword: string | null;
  reason: string;
}

function checkBannedItems(product: AmazonProduct): BannedItemResult {
  const contentToCheck = `${product.title} ${product.description} ${product.category}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(BANNED_ITEMS)) {
    for (const keyword of keywords) {
      if (contentToCheck.includes(keyword.toLowerCase())) {
        return {
          isBanned: true,
          category,
          matchedKeyword: keyword,
          reason: `eBay banned item (${category}): contains "${keyword}"`
        };
      }
    }
  }
  
  return {
    isBanned: false,
    category: null,
    matchedKeyword: null,
    reason: 'No banned items detected'
  };
}
```

---

## Seven Risk Filters - Complete Configuration

### Filter Configuration Structure

```typescript
interface FilterConfig {
  filters: ScanFilter[];
  globalSettings: {
    logBlockedProducts: boolean;
    notifyOnBlock: boolean;
    strictMode: boolean; // If true, FLAG = BLOCK
  };
}

interface ScanFilter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  canDisable: boolean;
  threshold?: number;
  thresholdUnit?: string;
  action: 'BLOCK' | 'FLAG';
  keywords?: string[];
  categories?: string[];
  priority: number; // Lower = checked first
}
```

### Complete Filter Definitions

```typescript
const COMPLIANCE_FILTERS: ScanFilter[] = [
  // ============================================
  // FILTER 1: HIGH RETURN RATE
  // ============================================
  {
    id: 'high_return_rate',
    name: 'High Return Rate',
    description: 'Block products with high return rate based on review analysis',
    enabled: true,       // ON by default
    canDisable: true,    // Can be turned off
    threshold: 15,       // Block if >15%
    thresholdUnit: 'percent',
    action: 'BLOCK',
    priority: 1,
    keywords: [
      'returned', 'return', 'sent back', 'refund', 'money back',
      'defective', 'broken', 'damaged', 'not as described',
      'wrong item', 'wrong size', 'wrong color', 'doesnt work',
      "doesn't work", 'stopped working', 'died', 'dead on arrival',
      'DOA', 'disappointing', 'waste of money'
    ]
  },
  
  // ============================================
  // FILTER 2: LOW REVIEWS (Opportunity Detection)
  // ============================================
  {
    id: 'low_reviews',
    name: 'Low Reviews',
    description: 'Flag products with <50 reviews (opportunity, not problem)',
    enabled: false,      // OFF by default
    canDisable: true,
    threshold: 50,       // Flag if <50 reviews
    thresholdUnit: 'count',
    action: 'FLAG',      // FLAG, not BLOCK
    priority: 7          // Low priority - check last
  },
  
  // ============================================
  // FILTER 3: FRAGILE/LIQUID ITEMS
  // ============================================
  {
    id: 'fragile_liquid',
    name: 'Fragile/Liquid Items',
    description: 'Block items that are likely to break or leak in shipping',
    enabled: true,       // ON by default
    canDisable: true,
    action: 'BLOCK',
    priority: 2,
    keywords: [
      // Fragile materials
      'glass', 'ceramic', 'porcelain', 'crystal', 'mirror',
      'china', 'delicate', 'breakable', 'fragile',
      
      // Liquids
      'liquid', 'gel', 'oil', 'lotion', 'cream', 'spray',
      'perfume', 'cologne', 'serum', 'toner', 'cleanser',
      'shampoo', 'conditioner', 'body wash', 'soap',
      'nail polish', 'paint', 'ink', 'dye',
      
      // Containers that leak
      'bottle', 'jar', 'candle', 'diffuser'
    ],
    categories: [
      'Beauty', 'Fragrance', 'Skin Care', 'Hair Care',
      'Glassware', 'Dinnerware', 'Vases', 'Candles'
    ]
  },
  
  // ============================================
  // FILTER 4: ELECTRONICS (Flag Only)
  // ============================================
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Flag electronics for extra verification (high return risk)',
    enabled: true,       // ON by default
    canDisable: true,
    action: 'FLAG',      // FLAG, not BLOCK
    priority: 6,
    categories: [
      'Electronics', 'Computers', 'Cell Phones & Accessories',
      'Camera & Photo', 'TV & Video', 'Audio',
      'Video Games & Consoles', 'Wearable Technology',
      'Smart Home', 'Car Electronics', 'GPS'
    ],
    keywords: [
      'electronic', 'battery', 'charger', 'adapter',
      'cable', 'cord', 'wireless', 'bluetooth',
      'USB', 'HDMI', 'power supply', 'led', 'LCD'
    ]
  },
  
  // ============================================
  // FILTER 5: FREQUENT DAMAGE REPORTS
  // ============================================
  {
    id: 'frequent_damage',
    name: 'Frequent Damage Reports',
    description: 'Block products with >10% damage complaints in reviews',
    enabled: true,       // ON by default
    canDisable: true,
    threshold: 10,       // Block if >10%
    thresholdUnit: 'percent',
    action: 'BLOCK',
    priority: 3,
    keywords: [
      'damaged', 'broken', 'cracked', 'dented', 'scratched',
      'missing parts', 'arrived broken', 'poor packaging',
      'bent', 'crushed', 'smashed', 'shattered',
      'torn', 'ripped', 'hole', 'leaked',
      'opened box', 'tampered', 'used'
    ]
  },
  
  // ============================================
  // FILTER 6: VERO BRANDS (Cannot Disable)
  // ============================================
  {
    id: 'vero_brands',
    name: 'VERO Protected Brands',
    description: 'Block trademarked brand items. CANNOT BE DISABLED.',
    enabled: true,       // ALWAYS ON
    canDisable: false,   // CANNOT BE DISABLED
    action: 'BLOCK',
    priority: 0          // Highest priority - check first
    // Brand list defined separately in VERO_BRANDS constant
  },
  
  // ============================================
  // FILTER 7: BANNED ITEMS (Cannot Disable)
  // ============================================
  {
    id: 'banned_items',
    name: 'eBay Banned Items',
    description: 'Block items prohibited on eBay. CANNOT BE DISABLED.',
    enabled: true,       // ALWAYS ON
    canDisable: false,   // CANNOT BE DISABLED
    action: 'BLOCK',
    priority: 0          // Highest priority - check first
    // Banned items list defined separately in BANNED_ITEMS constant
  }
];
```

### Additional Filters (Not in Core 7)

```typescript
// SHIPPING RISK FILTER
const SHIPPING_RISK_FILTER: ScanFilter = {
  id: 'shipping_risk',
  name: 'Oversized/Overweight',
  description: 'Flag items that may have high shipping costs',
  enabled: true,
  canDisable: true,
  action: 'FLAG',
  priority: 5,
  keywords: [
    'oversized', 'oversize', 'overweight', 'heavy duty',
    'furniture', 'mattress', 'appliance', 'large',
    'bulky', 'freight', 'pallet'
  ],
  categories: [
    'Furniture', 'Major Appliances', 'Exercise Equipment',
    'Outdoor Furniture', 'Mattresses'
  ],
  // Weight/dimension thresholds
  thresholds: {
    maxWeight: 50,      // lbs - above this flags
    maxLength: 48,      // inches
    maxGirth: 105       // length + 2*(width + height)
  }
};
```

---

## Filter Toggle States Summary

| Filter ID | Name | Default State | Can Disable | Action | Threshold |
|-----------|------|---------------|-------------|--------|-----------|
| high_return_rate | High Return Rate | ON | YES | BLOCK | >15% |
| low_reviews | Low Reviews | OFF | YES | FLAG | <50 reviews |
| fragile_liquid | Fragile/Liquid | ON | YES | BLOCK | Keyword match |
| electronics | Electronics | ON | YES | FLAG | Category match |
| frequent_damage | Frequent Damage | ON | YES | BLOCK | >10% |
| vero_brands | VERO Brands | ON | **NO** | BLOCK | Brand match |
| banned_items | Banned Items | ON | **NO** | BLOCK | Keyword match |
| shipping_risk | Oversized/Heavy | ON | YES | FLAG | Weight/size |

---

## Blocked Product Handling

### What Happens When a Product is Blocked

1. **Product is NOT added to research queue**
2. **Logged to `filtered_out.csv`** with full details
3. **Discord notification sent** to #vero-blocked or #research-updates
4. **Counter incremented** for daily blocked count

### filtered_out.csv Format

```csv
asin,title,price,filter_id,filter_name,reason,blocked_date,product_url,brand,category
B07XYZ1234,Nike Air Max 90 Sneakers,129.99,vero_brands,VERO Protected Brands,VERO protected brand: Nike,2024-01-15T09:10:00Z,https://amazon.com/dp/B07XYZ1234,Nike,Shoes
B08ABC5678,Glass Wine Decanter Set,45.99,fragile_liquid,Fragile/Liquid Items,Product contains keyword: glass,2024-01-15T09:12:00Z,https://amazon.com/dp/B08ABC5678,Generic,Kitchen
B09DEF9012,Generic USB Cable 10-Pack,8.99,high_return_rate,High Return Rate,Return rate: 23.4%,2024-01-15T09:15:00Z,https://amazon.com/dp/B09DEF9012,Unknown,Electronics
```

### Logging Implementation

```typescript
interface FilteredOutEntry {
  asin: string;
  title: string;
  price: number;
  filterId: string;
  filterName: string;
  reason: string;
  blockedDate: string;
  productUrl: string;
  brand: string;
  category: string;
}

async function logToFilteredOut(result: FilteredProduct): Promise<void> {
  const entry: FilteredOutEntry = {
    asin: result.product.asin,
    title: result.product.title,
    price: result.product.price,
    filterId: Object.keys(result.filterResults).find(
      id => !result.filterResults[id].passed
    ) || 'unknown',
    filterName: result.blockReasons[0] || 'Unknown filter',
    reason: result.blockReasons.join('; '),
    blockedDate: new Date().toISOString(),
    productUrl: result.product.productUrl,
    brand: result.product.brand,
    category: result.product.category
  };
  
  // Append to CSV
  const csvLine = Object.values(entry)
    .map(v => `"${String(v).replace(/"/g, '""')}"`)
    .join(',');
  
  await appendToFile('filtered_out.csv', csvLine + '\n');
  
  // Send Discord notification
  await sendDiscordNotification('vero-blocked', {
    title: `[FILTER] Product Blocked`,
    description: `ASIN: ${entry.asin}`,
    fields: [
      { name: 'Title', value: entry.title },
      { name: 'Filter', value: entry.filterName },
      { name: 'Reason', value: entry.reason }
    ],
    color: 0xFF0000 // Red
  });
}
```

---

## Edge Cases and Exceptions

### 1. Accessories ARE Allowed
Even for VERO brands, accessories and compatible items are generally allowed:

```typescript
// BLOCKED: Actual Nike product
"Nike Air Max 90 Running Shoes" → BLOCK

// ALLOWED: Accessory for Nike product
"Replacement Insoles for Nike Shoes" → ALLOW
"Shoe Laces Compatible with Nike Air Max" → ALLOW
"Cleaning Kit for Nike Sneakers" → ALLOW
```

**Detection logic:**
- Check for compatibility keywords BEFORE blocking
- If title contains "for", "compatible with", "fits", etc. → ALLOW
- Still log as FLAG for human review

### 2. Electronics: Flag, Don't Block
Electronics have high return rates but are often profitable. We FLAG them for extra verification rather than blocking:

```typescript
// FLAGGED: Electronics (needs verification)
"Sony WH-1000XM5 Headphones" → FLAG (VERO brand also triggers)
"Anker USB-C Charger" → FLAG (electronics category)
"Generic Bluetooth Speaker" → FLAG (electronics category)

// Processing: Flagged items require:
// 1. Manual review OR
// 2. Verified dropshipper already selling same item
// 3. Product DNA match >95%
```

### 3. Low Reviews: Opportunity, Not Risk
Products with few reviews might be:
- New products (early mover advantage)
- Niche products (less competition)
- Hidden gems

**We FLAG these as OPPORTUNITIES, not risks:**

```typescript
// FLAGGED as opportunity
"Unique Handmade Craft Item" (23 reviews) → FLAG (opportunity)
"New Product Launch 2024" (8 reviews) → FLAG (opportunity)

// These PASS the filter, just get flagged for attention
```

### 4. Partial Keyword Matches
Be careful with substring matching:

```typescript
// FALSE POSITIVE - "glass" in "sunglasses"
"Ray-Ban Sunglasses" 
// Should NOT be blocked for "glass" keyword
// Solution: Use word boundaries or exact match for short keywords

// FALSE POSITIVE - "oil" in "foil"
"Aluminum Foil 200ft Roll"
// Should NOT be blocked for "oil" keyword

function containsKeyword(text: string, keyword: string): boolean {
  // Use word boundary matching for short keywords
  if (keyword.length < 5) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(text);
  }
  return text.toLowerCase().includes(keyword.toLowerCase());
}
```

### 5. Category Overlap
Some products belong to multiple categories. Handle gracefully:

```typescript
// Product: "Apple Watch Charging Stand"
// Categories: Electronics, Cell Phone Accessories, Smart Home

// This should be:
// - BLOCKED for VERO (Apple) if selling actual Apple product
// - ALLOWED if it's a third-party charging stand "for Apple Watch"
// - FLAGGED for electronics category

function processMultipleFilters(product: AmazonProduct): FilteredProduct {
  // Priority order:
  // 1. VERO check (with accessory exception)
  // 2. Banned items check
  // 3. Other filters
  
  // VERO accessory exception takes precedence
  if (isVEROBrand(product) && isCompatibleAccessory(product)) {
    // Skip VERO block, continue with other filters
  }
}
```

---

## Compliance Configuration TypeScript

### Complete Configuration Structure

```typescript
// config/compliance-config.ts

export interface ComplianceConfig {
  version: string;
  lastUpdated: string;
  
  filters: {
    [filterId: string]: FilterSettings;
  };
  
  veroBrands: {
    tier1: string[];  // Always block
    tier2: string[];  // High risk
    tier3: string[];  // Moderate risk
  };
  
  bannedItems: {
    [category: string]: string[];
  };
  
  compatibilityKeywords: string[];
  
  settings: {
    logBlockedProducts: boolean;
    notifyOnBlock: boolean;
    strictMode: boolean;
    allowAccessories: boolean;
  };
}

export interface FilterSettings {
  enabled: boolean;
  threshold?: number;
  action: 'BLOCK' | 'FLAG';
  keywords?: string[];
  categories?: string[];
}

// Default configuration
export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  version: '1.0.0',
  lastUpdated: '2024-01-15',
  
  filters: {
    high_return_rate: {
      enabled: true,
      threshold: 15,
      action: 'BLOCK'
    },
    low_reviews: {
      enabled: false,
      threshold: 50,
      action: 'FLAG'
    },
    fragile_liquid: {
      enabled: true,
      action: 'BLOCK',
      keywords: FRAGILE_KEYWORDS
    },
    electronics: {
      enabled: true,
      action: 'FLAG',
      categories: ELECTRONICS_CATEGORIES
    },
    frequent_damage: {
      enabled: true,
      threshold: 10,
      action: 'BLOCK'
    },
    vero_brands: {
      enabled: true,  // Cannot be changed
      action: 'BLOCK'
    },
    banned_items: {
      enabled: true,  // Cannot be changed
      action: 'BLOCK'
    }
  },
  
  veroBrands: {
    tier1: VERO_TIER1_BRANDS,
    tier2: VERO_TIER2_BRANDS,
    tier3: VERO_TIER3_BRANDS
  },
  
  bannedItems: BANNED_ITEMS,
  
  compatibilityKeywords: COMPATIBILITY_KEYWORDS,
  
  settings: {
    logBlockedProducts: true,
    notifyOnBlock: true,
    strictMode: false,
    allowAccessories: true
  }
};

// Runtime enforcement - prevent disabling critical filters
export function enforceConfig(config: ComplianceConfig): ComplianceConfig {
  // VERO and Banned Items cannot be disabled
  config.filters.vero_brands.enabled = true;
  config.filters.banned_items.enabled = true;
  
  // Enforce BLOCK action for critical filters
  config.filters.vero_brands.action = 'BLOCK';
  config.filters.banned_items.action = 'BLOCK';
  
  return config;
}
```

### Loading and Saving Configuration

```typescript
// services/compliance-service.ts

export class ComplianceService {
  private config: ComplianceConfig;
  
  constructor() {
    this.config = this.loadConfig();
  }
  
  private loadConfig(): ComplianceConfig {
    try {
      const saved = localStorage.getItem('compliance_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return enforceConfig(parsed);
      }
    } catch (e) {
      console.error('Failed to load compliance config:', e);
    }
    return DEFAULT_COMPLIANCE_CONFIG;
  }
  
  public saveConfig(config: ComplianceConfig): void {
    const enforced = enforceConfig(config);
    localStorage.setItem('compliance_config', JSON.stringify(enforced));
    this.config = enforced;
  }
  
  public getFilter(filterId: string): FilterSettings | undefined {
    return this.config.filters[filterId];
  }
  
  public isFilterEnabled(filterId: string): boolean {
    const filter = this.getFilter(filterId);
    return filter?.enabled ?? false;
  }
  
  public canDisableFilter(filterId: string): boolean {
    // VERO and Banned Items cannot be disabled
    return !['vero_brands', 'banned_items'].includes(filterId);
  }
  
  public toggleFilter(filterId: string, enabled: boolean): boolean {
    if (!this.canDisableFilter(filterId)) {
      console.warn(`Cannot disable filter: ${filterId}`);
      return false;
    }
    
    if (this.config.filters[filterId]) {
      this.config.filters[filterId].enabled = enabled;
      this.saveConfig(this.config);
      return true;
    }
    return false;
  }
}
```

---

## Quick Reference Card

### What Gets BLOCKED (Never List)
- ❌ Nike, Adidas, Apple, Samsung products (unless accessory)
- ❌ Disney, Marvel, Lego products
- ❌ Luxury brands (Louis Vuitton, Gucci, Rolex)
- ❌ Glass, liquid, fragile items
- ❌ Products with >15% return rate
- ❌ Products with >10% damage complaints
- ❌ Weapons, drugs, counterfeit, recalled items

### What Gets FLAGGED (Review Required)
- ⚠️ Electronics (high return risk)
- ⚠️ Low review products (opportunity)
- ⚠️ Oversized/heavy items (shipping cost)

### What Gets ALLOWED
- ✅ Generic/unbranded products
- ✅ Compatible accessories ("Case for iPhone")
- ✅ Third-party alternatives
- ✅ Books, home goods, kitchenware (non-branded)

---

## Discord Alerts for Compliance

### VERO Block Alert
```
🚫 [VERO] BLOCKED: Nike Air Max 90
━━━━━━━━━━━━━━━━━━━━━━━━
ASIN: B07XYZ1234
Brand: Nike (Tier 1)
Title: Nike Air Max 90 Running Shoes
Price: $129.99
━━━━━━━━━━━━━━━━━━━━━━━━
Action: Logged to filtered_out.csv
Reason: VERO protected brand
```

### Filter Block Alert
```
🛑 [FILTER] BLOCKED: Glass Wine Decanter
━━━━━━━━━━━━━━━━━━━━━━━━
ASIN: B08ABC5678
Filter: Fragile/Liquid Items
Matched: "glass"
Price: $45.99
━━━━━━━━━━━━━━━━━━━━━━━━
Action: Logged to filtered_out.csv
Reason: High breakage risk in shipping
```

### Daily Compliance Summary
```
📊 [COMPLIANCE] Daily Summary
━━━━━━━━━━━━━━━━━━━━━━━━
Date: 2024-01-15
Products Scanned: 500
Products Passed: 423
Products Blocked: 77

Blocked by Filter:
• VERO Brands: 34
• Fragile/Liquid: 18
• High Return: 15
• Banned Items: 7
• Frequent Damage: 3

Top Blocked Brands:
1. Nike (12)
2. Apple (8)
3. Disney (6)
━━━━━━━━━━━━━━━━━━━━━━━━
Filter Efficiency: 84.6%
```

---

*Last Updated: 2024*
*Version: 1.0*
*VERO Brand List Version: 2024.01*
