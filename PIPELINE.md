# SYNDRAX SYNC - TECHNICAL PIPELINE IMPLEMENTATION

## Pipeline Overview

The Syndrax Sync research pipeline is a 7-phase system that takes an Amazon product from discovery to active eBay listing with ongoing management. Each phase is modular, with clear inputs, outputs, and TypeScript interfaces.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYNDRAX SYNC PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │  Phase 1 │──►│ Phase 1B │──►│  Phase 2 │──►│  Phase 3 │──►│  Phase 4 │   │
│  │ Discovery│   │  Filters │   │  Reverse │   │  Verify  │   │   DNA    │   │
│  │          │   │          │   │  Search  │   │  Seller  │   │  Match   │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│                                                                     │       │
│                                                                     ▼       │
│  ┌──────────┐   ┌──────────┐                              ┌──────────┐     │
│  │  Phase 7 │◄──│  Phase 6 │◄─────────────────────────────│  Phase 5 │     │
│  │  Ongoing │   │   Bulk   │                              │   SEO    │     │
│  │ Manage   │   │  Lister  │                              │  Intel   │     │
│  └──────────┘   └──────────┘                              └──────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Amazon Product Discovery

### Purpose
Find products on Amazon worth researching for eBay listing.

### User Interface
**Floating Icon Overlay on Amazon Search Results**

When browsing Amazon search results, a small floating icon appears next to each product. Clicking the icon adds the product to the research queue.

```typescript
// Injected on: amazon.com/s?*
// Location: Floating button top-right of each product card
// Icon: + symbol or magnifying glass
// Action: Click to add to research queue
```

### Implementation Details

**Content Script Injection:**
```typescript
// content/amazon-discovery-overlay.ts

interface AmazonSearchProduct {
  asin: string;
  title: string;
  price: number;
  priceString: string;
  imageUrl: string;
  reviewCount: number;
  rating: number;
  isPrime: boolean;
  sellerName: string;
  productUrl: string;
  position: number; // Position in search results
}

function injectFloatingIcons(): void {
  const productCards = document.querySelectorAll('[data-asin]');
  
  productCards.forEach((card, index) => {
    const asin = card.getAttribute('data-asin');
    if (!asin || asin === '') return;
    
    const button = createFloatingButton(asin, index);
    card.appendChild(button);
  });
}

function createFloatingButton(asin: string, index: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'syndrax-discovery-btn';
  button.innerHTML = '+';
  button.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
    z-index: 9999;
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  `;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await addToResearchQueue(asin);
    button.innerHTML = '✓';
    button.style.background = '#2196F3';
  });
  
  return button;
}

async function addToResearchQueue(asin: string): Promise<void> {
  const product = scrapeProductData(asin);
  
  chrome.runtime.sendMessage({
    type: 'ADD_TO_RESEARCH_QUEUE',
    payload: product
  });
}

function scrapeProductData(asin: string): AmazonSearchProduct {
  const card = document.querySelector(`[data-asin="${asin}"]`);
  
  return {
    asin,
    title: card?.querySelector('h2')?.textContent?.trim() || '',
    price: parseFloat(card?.querySelector('.a-price-whole')?.textContent || '0'),
    priceString: card?.querySelector('.a-price')?.textContent || '',
    imageUrl: card?.querySelector('img')?.src || '',
    reviewCount: parseInt(card?.querySelector('.a-size-small .a-link-normal')?.textContent?.replace(/[,\.]/g, '') || '0'),
    rating: parseFloat(card?.querySelector('.a-icon-star-small')?.textContent?.split(' ')[0] || '0'),
    isPrime: !!card?.querySelector('.s-prime'),
    sellerName: 'Amazon', // Simplified
    productUrl: `https://amazon.com/dp/${asin}`,
    position: 0
  };
}
```

### Data Flow
```
User browses Amazon → Sees floating icons → Clicks + button
→ Product data scraped → Sent to background service
→ Added to research_queue.csv → Discord notification sent
```

### Discord Report Format
```
[PHASE 1] [ADDED] Product added to research queue
- ASIN: B08N5WRWNW
- Title: Apple AirPods Pro (2nd Generation)
- Price: $249.00
- Reviews: 156,234
- Prime: YES
```

---

## Phase 1B: Seven Risk Filters

### Purpose
Filter out risky products BEFORE wasting time on research.

### Filter Configuration

```typescript
// config/scan-filters.ts

interface ScanFilter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  canDisable: boolean;  // false for VERO and Banned Items
  threshold?: number;
  action: 'BLOCK' | 'FLAG';
}

const DEFAULT_FILTERS: ScanFilter[] = [
  {
    id: 'high_return_rate',
    name: 'High Return Rate',
    description: 'Block products with >15% return rate',
    enabled: true,
    canDisable: true,
    threshold: 15,
    action: 'BLOCK'
  },
  {
    id: 'low_reviews',
    name: 'Low Reviews',
    description: 'Flag products with <50 reviews (opportunity, not block)',
    enabled: false,
    canDisable: true,
    threshold: 50,
    action: 'FLAG'
  },
  {
    id: 'fragile_liquid',
    name: 'Fragile/Liquid Items',
    description: 'Block glass, liquid, or easily damaged items',
    enabled: true,
    canDisable: true,
    action: 'BLOCK'
  },
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Flag electronics for extra verification (high return risk)',
    enabled: true,
    canDisable: true,
    action: 'FLAG'
  },
  {
    id: 'frequent_damage',
    name: 'Frequent Damage Reports',
    description: 'Block products with >10% damage complaints in reviews',
    enabled: true,
    canDisable: true,
    threshold: 10,
    action: 'BLOCK'
  },
  {
    id: 'vero_brands',
    name: 'VERO Protected Brands',
    description: 'Block trademarked brand items (NEVER disable)',
    enabled: true,
    canDisable: false,
    action: 'BLOCK'
  },
  {
    id: 'banned_items',
    name: 'eBay Banned Items',
    description: 'Block items prohibited on eBay (NEVER disable)',
    enabled: true,
    canDisable: false,
    action: 'BLOCK'
  }
];
```

### Filter Details

#### 1. High Return Rate Filter (ON by default)
```typescript
interface ReturnRateCheck {
  source: 'reviews' | 'seller_data';
  returnMentions: number;
  totalReviews: number;
  estimatedReturnRate: number;
}

function checkReturnRate(product: AmazonProduct): FilterResult {
  // Scan reviews for return-related keywords
  const returnKeywords = [
    'returned', 'return', 'sent back', 'refund',
    'defective', 'broken', 'damaged', 'not as described'
  ];
  
  const returnMentions = product.reviews.filter(r => 
    returnKeywords.some(kw => r.text.toLowerCase().includes(kw))
  ).length;
  
  const returnRate = (returnMentions / product.reviews.length) * 100;
  
  if (returnRate > 15) {
    return { 
      passed: false, 
      reason: `High return rate: ${returnRate.toFixed(1)}%`,
      action: 'BLOCK'
    };
  }
  
  return { passed: true };
}
```

#### 2. Low Reviews Filter (OFF by default)
```typescript
// This is OPPORTUNITY detection, not blocking
// Low reviews = less competition = potential goldmine

function checkLowReviews(product: AmazonProduct): FilterResult {
  if (product.reviewCount < 50) {
    return {
      passed: true,  // Still passes!
      flagged: true,
      reason: `Low reviews: ${product.reviewCount} (opportunity flag)`,
      action: 'FLAG'
    };
  }
  
  return { passed: true };
}
```

#### 3. Fragile/Liquid Filter (ON by default)
```typescript
const FRAGILE_KEYWORDS = [
  'glass', 'ceramic', 'porcelain', 'crystal', 'mirror',
  'liquid', 'gel', 'oil', 'lotion', 'cream', 'spray',
  'fragile', 'delicate', 'breakable'
];

function checkFragileLiquid(product: AmazonProduct): FilterResult {
  const titleLower = product.title.toLowerCase();
  const descLower = product.description.toLowerCase();
  
  const hasFragileKeyword = FRAGILE_KEYWORDS.some(kw => 
    titleLower.includes(kw) || descLower.includes(kw)
  );
  
  if (hasFragileKeyword) {
    return {
      passed: false,
      reason: 'Product contains fragile/liquid keywords',
      action: 'BLOCK'
    };
  }
  
  return { passed: true };
}
```

#### 4. Electronics Filter (ON by default, FLAG only)
```typescript
const ELECTRONICS_CATEGORIES = [
  'Electronics', 'Computers', 'Cell Phones', 'Camera',
  'TV', 'Audio', 'Video Games', 'Wearable Technology'
];

function checkElectronics(product: AmazonProduct): FilterResult {
  const isElectronics = ELECTRONICS_CATEGORIES.some(cat => 
    product.category.includes(cat)
  );
  
  if (isElectronics) {
    return {
      passed: true,  // Still passes, but flagged
      flagged: true,
      reason: 'Electronics category - verify carefully',
      action: 'FLAG'
    };
  }
  
  return { passed: true };
}
```

#### 5. Frequent Damage Filter (ON by default)
```typescript
const DAMAGE_KEYWORDS = [
  'damaged', 'broken', 'cracked', 'dented', 'scratched',
  'missing parts', 'arrived broken', 'poor packaging'
];

function checkFrequentDamage(product: AmazonProduct): FilterResult {
  const damageReviews = product.reviews.filter(r =>
    r.rating <= 2 && DAMAGE_KEYWORDS.some(kw => 
      r.text.toLowerCase().includes(kw)
    )
  ).length;
  
  const damageRate = (damageReviews / product.reviews.length) * 100;
  
  if (damageRate > 10) {
    return {
      passed: false,
      reason: `Frequent damage reports: ${damageRate.toFixed(1)}%`,
      action: 'BLOCK'
    };
  }
  
  return { passed: true };
}
```

#### 6. VERO Brands Filter (ALWAYS ON - Cannot Disable)
```typescript
// See COMPLIANCE.md for full brand list
const VERO_BRANDS = [
  'Nike', 'Adidas', 'Apple', 'Samsung', 'Sony', 'Microsoft',
  'PlayStation', 'Xbox', 'Nintendo', 'Disney', 'Marvel',
  'Louis Vuitton', 'Gucci', 'Rolex', 'Lego', 'Chanel',
  'Prada', 'Hermès', 'Burberry', 'Tiffany', 'Cartier'
  // ... full list in COMPLIANCE.md
];

function checkVEROBrand(product: AmazonProduct): FilterResult {
  const titleLower = product.title.toLowerCase();
  const brandLower = product.brand.toLowerCase();
  
  const matchedBrand = VERO_BRANDS.find(brand =>
    titleLower.includes(brand.toLowerCase()) ||
    brandLower.includes(brand.toLowerCase())
  );
  
  if (matchedBrand) {
    // Check if it's an accessory (allowed)
    if (isCompatibleAccessory(product)) {
      return {
        passed: true,
        flagged: true,
        reason: `Compatible accessory for ${matchedBrand} - allowed`,
        action: 'FLAG'
      };
    }
    
    return {
      passed: false,
      reason: `VERO protected brand: ${matchedBrand}`,
      action: 'BLOCK'
    };
  }
  
  return { passed: true };
}

function isCompatibleAccessory(product: AmazonProduct): boolean {
  const accessoryKeywords = [
    'for', 'compatible with', 'fits', 'replacement for',
    'works with', 'designed for', 'case for', 'cover for',
    'charger for', 'cable for', 'accessory for'
  ];
  
  return accessoryKeywords.some(kw => 
    product.title.toLowerCase().includes(kw)
  );
}
```

#### 7. Banned Items Filter (ALWAYS ON - Cannot Disable)
```typescript
// See COMPLIANCE.md for full banned items list
const BANNED_CATEGORIES = [
  'syringes', 'needles', 'drug paraphernalia',
  'firearms', 'ammunition', 'explosives',
  'stun guns', 'brass knuckles', 'switchblade',
  'counterfeit', 'recalled', 'adult content'
];

function checkBannedItems(product: AmazonProduct): FilterResult {
  const contentToCheck = `${product.title} ${product.description}`.toLowerCase();
  
  const matchedBanned = BANNED_CATEGORIES.find(banned =>
    contentToCheck.includes(banned)
  );
  
  if (matchedBanned) {
    return {
      passed: false,
      reason: `eBay banned item: ${matchedBanned}`,
      action: 'BLOCK'
    };
  }
  
  return { passed: true };
}
```

### Filter Result Handling

```typescript
interface FilterResult {
  passed: boolean;
  flagged?: boolean;
  reason?: string;
  action?: 'BLOCK' | 'FLAG';
}

interface FilteredProduct {
  product: AmazonProduct;
  filterResults: {
    [filterId: string]: FilterResult;
  };
  overallPassed: boolean;
  flags: string[];
  blockReasons: string[];
}

async function runAllFilters(product: AmazonProduct): Promise<FilteredProduct> {
  const results: FilteredProduct = {
    product,
    filterResults: {},
    overallPassed: true,
    flags: [],
    blockReasons: []
  };
  
  // Run each filter
  for (const filter of enabledFilters) {
    const result = await runFilter(filter.id, product);
    results.filterResults[filter.id] = result;
    
    if (!result.passed) {
      results.overallPassed = false;
      results.blockReasons.push(result.reason || filter.name);
    }
    
    if (result.flagged) {
      results.flags.push(result.reason || filter.name);
    }
  }
  
  // Log blocked products
  if (!results.overallPassed) {
    await logToFilteredOut(results);
  }
  
  return results;
}
```

---

## Phase 2: eBay Reverse Image Search

### Purpose
Find existing eBay dropshippers selling the same Amazon product.

### User Interface
**Floating Icons on eBay Search Results**

After uploading an Amazon product image to eBay image search, floating icons appear above each search result:

1. **Scan Store** button - Scans the seller's entire store
2. **Add Username** button - Adds seller to dropshippers.csv

```typescript
// content/ebay-reverse-search-overlay.ts

interface EbaySearchResult {
  itemId: string;
  title: string;
  price: number;
  sellerName: string;
  sellerFeedback: number;
  sellerFeedbackPercent: number;
  imageUrl: string;
  itemUrl: string;
  soldCount: number;
}

function injectEbayOverlayIcons(): void {
  const searchResults = document.querySelectorAll('.s-item__wrapper');
  
  searchResults.forEach((result) => {
    const overlay = createOverlayContainer(result);
    result.style.position = 'relative';
    result.appendChild(overlay);
  });
}

function createOverlayContainer(resultElement: Element): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'syndrax-ebay-overlay';
  container.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 4px;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
  `;
  
  // Scan Store button
  const scanBtn = document.createElement('button');
  scanBtn.innerHTML = '🔍 Scan Store';
  scanBtn.style.cssText = `
    padding: 4px 8px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  scanBtn.addEventListener('click', () => handleScanStore(resultElement));
  
  // Add Username button
  const addBtn = document.createElement('button');
  addBtn.innerHTML = '+ Add Username';
  addBtn.style.cssText = `
    padding: 4px 8px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  addBtn.addEventListener('click', () => handleAddUsername(resultElement));
  
  container.appendChild(scanBtn);
  container.appendChild(addBtn);
  
  return container;
}

async function handleScanStore(resultElement: Element): Promise<void> {
  const sellerName = extractSellerName(resultElement);
  
  chrome.runtime.sendMessage({
    type: 'SCAN_SELLER_STORE',
    payload: { sellerName }
  });
  
  // Visual feedback
  showNotification(`Scanning ${sellerName}'s store...`);
}

async function handleAddUsername(resultElement: Element): Promise<void> {
  const seller = extractSellerData(resultElement);
  
  chrome.runtime.sendMessage({
    type: 'ADD_DROPSHIPPER',
    payload: seller
  });
  
  showNotification(`Added ${seller.username} to dropshippers list`);
}

function extractSellerData(resultElement: Element): DropshipperSeller {
  return {
    username: resultElement.querySelector('.s-item__seller-info-text')?.textContent?.trim() || '',
    feedbackPercent: parseFloat(resultElement.querySelector('.s-item__seller-info')?.textContent || '0'),
    productsCount: 0, // Will be populated during store scan
    amazonMatchRate: 0, // Will be calculated during verification
    addedDate: new Date().toISOString(),
    verified: false,
    accountAge: 0
  };
}
```

### Discord Report Format
```
[PHASE 2] [SCAN] Store scan initiated
- Seller: dropship_deals_2024
- Products in store: 1,847
- Estimated scan time: ~15 minutes

[PHASE 2] [ADDED] Dropshipper added to tracking
- Username: dropship_deals_2024
- Feedback: 98.7%
- Status: Pending verification
```

---

## Phase 3: Dropshipper Verification (Seller Gates)

### Purpose
Verify that discovered eBay sellers are legitimate dropshippers worth following.

### Verification Gates

```typescript
interface SellerVerificationGates {
  minUnitsSold: number;      // Minimum products sold
  minAccountAge: number;     // Days since account creation
  minFeedbackPercent: number; // Minimum positive feedback %
  minAmazonMatchRate: number; // % of products sourced from Amazon
}

const DEFAULT_GATES: SellerVerificationGates = {
  minUnitsSold: 50,
  minAccountAge: 30,
  minFeedbackPercent: 95,
  minAmazonMatchRate: 70
};
```

### Verification Process

```typescript
interface SellerVerificationResult {
  seller: DropshipperSeller;
  gates: {
    unitsSold: { passed: boolean; value: number; required: number };
    accountAge: { passed: boolean; value: number; required: number };
    feedbackPercent: { passed: boolean; value: number; required: number };
    amazonMatchRate: { passed: boolean; value: number; required: number };
  };
  overallPassed: boolean;
  confidenceScore: number; // 0-100
}

async function verifySeller(seller: DropshipperSeller): Promise<SellerVerificationResult> {
  // Scrape seller profile page
  const profile = await scrapeSellerProfile(seller.username);
  
  // Sample seller's products and check Amazon matches
  const products = await sampleSellerProducts(seller.username, 20);
  const amazonMatches = await checkAmazonMatches(products);
  const matchRate = (amazonMatches / products.length) * 100;
  
  const result: SellerVerificationResult = {
    seller,
    gates: {
      unitsSold: {
        passed: profile.totalSold >= DEFAULT_GATES.minUnitsSold,
        value: profile.totalSold,
        required: DEFAULT_GATES.minUnitsSold
      },
      accountAge: {
        passed: profile.accountAgeDays >= DEFAULT_GATES.minAccountAge,
        value: profile.accountAgeDays,
        required: DEFAULT_GATES.minAccountAge
      },
      feedbackPercent: {
        passed: profile.feedbackPercent >= DEFAULT_GATES.minFeedbackPercent,
        value: profile.feedbackPercent,
        required: DEFAULT_GATES.minFeedbackPercent
      },
      amazonMatchRate: {
        passed: matchRate >= DEFAULT_GATES.minAmazonMatchRate,
        value: matchRate,
        required: DEFAULT_GATES.minAmazonMatchRate
      }
    },
    overallPassed: false,
    confidenceScore: 0
  };
  
  // Check if all gates passed
  result.overallPassed = Object.values(result.gates).every(g => g.passed);
  
  // Calculate confidence score
  result.confidenceScore = calculateConfidenceScore(result);
  
  return result;
}

function calculateConfidenceScore(result: SellerVerificationResult): number {
  let score = 0;
  const gates = result.gates;
  
  // Units sold (25 points max)
  score += Math.min(25, (gates.unitsSold.value / 200) * 25);
  
  // Account age (25 points max)
  score += Math.min(25, (gates.accountAge.value / 365) * 25);
  
  // Feedback (25 points max)
  score += (gates.feedbackPercent.value / 100) * 25;
  
  // Amazon match rate (25 points max)
  score += (gates.amazonMatchRate.value / 100) * 25;
  
  return Math.round(score);
}
```

### Discord Report Format
```
[PHASE 3] [VERIFIED] Seller passed all gates
- Username: dropship_deals_2024
- Units Sold: 523 ✓ (min: 50)
- Account Age: 187 days ✓ (min: 30)
- Feedback: 98.7% ✓ (min: 95%)
- Amazon Match: 84% ✓ (min: 70%)
- Confidence Score: 87/100

[PHASE 3] [REJECTED] Seller failed verification
- Username: new_seller_123
- Units Sold: 12 ✗ (min: 50)
- Account Age: 14 days ✗ (min: 30)
- Feedback: 100% ✓ (min: 95%)
- Amazon Match: 90% ✓ (min: 70%)
- Reason: New account, low sales volume
```

---

## Phase 4: Product DNA Matching (Claude Vision AI)

### Purpose
Verify that the Amazon product EXACTLY matches the eBay listing using AI vision analysis.

### Why This Matters
- eBay sellers often use stock photos that don't match actual product
- Color, size, version differences cause returns
- AI can detect subtle differences humans miss

### Product DNA Extraction

```typescript
interface ProductDNA {
  brand: string | null;
  modelNumber: string | null;
  materials: string[];
  colors: string[];
  dimensions: string | null;
  specifications: { [key: string]: string };
  visualFeatures: string[];
  packagingDetails: string[];
  conditionIndicators: string[];
  confidence: number;
}

interface ProductMatch {
  amazonProduct: AmazonProduct;
  ebayListing: EbayListing;
  amazonDNA: ProductDNA;
  ebayDNA: ProductDNA;
  matchScore: number;
  matchTier: 'EXACT' | 'VARIANT' | 'SIMILAR' | 'NO_MATCH';
  differences: string[];
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
}
```

### Claude Vision API Integration

```typescript
async function extractProductDNA(imageUrl: string, context: string): Promise<ProductDNA> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          },
          {
            type: 'text',
            text: `Extract product DNA from this image. Context: ${context}
            
            Identify and return JSON with:
            - brand: visible brand name or null
            - modelNumber: visible model/SKU or null
            - materials: list of identifiable materials
            - colors: list of colors present
            - dimensions: estimated size if visible
            - specifications: any visible specs (capacity, watts, etc)
            - visualFeatures: unique visual identifiers
            - packagingDetails: if packaging visible
            - conditionIndicators: new/used/damaged indicators
            - confidence: 0-100 how confident in extraction
            
            Return ONLY valid JSON, no markdown.`
          }
        ]
      }]
    })
  });
  
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function compareProductDNA(
  amazonDNA: ProductDNA, 
  ebayDNA: ProductDNA
): Promise<ProductMatch> {
  const differences: string[] = [];
  let score = 100;
  
  // Brand comparison (critical)
  if (amazonDNA.brand !== ebayDNA.brand) {
    if (amazonDNA.brand && ebayDNA.brand) {
      score -= 50;
      differences.push(`Brand mismatch: ${amazonDNA.brand} vs ${ebayDNA.brand}`);
    }
  }
  
  // Model number comparison (critical)
  if (amazonDNA.modelNumber !== ebayDNA.modelNumber) {
    if (amazonDNA.modelNumber && ebayDNA.modelNumber) {
      score -= 30;
      differences.push(`Model mismatch: ${amazonDNA.modelNumber} vs ${ebayDNA.modelNumber}`);
    }
  }
  
  // Color comparison (important)
  const colorMatch = amazonDNA.colors.some(c => 
    ebayDNA.colors.includes(c)
  );
  if (!colorMatch && amazonDNA.colors.length > 0 && ebayDNA.colors.length > 0) {
    score -= 15;
    differences.push(`Color mismatch: ${amazonDNA.colors.join(',')} vs ${ebayDNA.colors.join(',')}`);
  }
  
  // Materials comparison
  const materialMatch = amazonDNA.materials.some(m => 
    ebayDNA.materials.includes(m)
  );
  if (!materialMatch && amazonDNA.materials.length > 0 && ebayDNA.materials.length > 0) {
    score -= 10;
    differences.push(`Material mismatch`);
  }
  
  // Determine tier
  let matchTier: ProductMatch['matchTier'];
  let recommendation: ProductMatch['recommendation'];
  
  if (score >= 95) {
    matchTier = 'EXACT';
    recommendation = 'APPROVE';
  } else if (score >= 80) {
    matchTier = 'VARIANT';
    recommendation = 'REVIEW';
  } else if (score >= 60) {
    matchTier = 'SIMILAR';
    recommendation = 'REVIEW';
  } else {
    matchTier = 'NO_MATCH';
    recommendation = 'REJECT';
  }
  
  return {
    amazonProduct: {} as AmazonProduct, // Populated by caller
    ebayListing: {} as EbayListing,     // Populated by caller
    amazonDNA,
    ebayDNA,
    matchScore: score,
    matchTier,
    differences,
    recommendation
  };
}
```

### Match Tiers

| Score | Tier | Description | Action |
|-------|------|-------------|--------|
| 95-100% | EXACT | Same brand, model, color, specs | Auto-approve |
| 80-94% | VARIANT | Same product, different color/size | Flag for review |
| 60-79% | SIMILAR | Same category, different product | Manual review |
| <60% | NO_MATCH | Different products | Reject |

### Discord Report Format
```
[PHASE 4] [MATCH] Product DNA comparison complete
- Amazon: Apple AirPods Pro 2nd Gen (White)
- eBay: Apple AirPods Pro 2 Wireless Earbuds
- Match Score: 97%
- Tier: EXACT MATCH ✓
- Recommendation: AUTO-APPROVE

[PHASE 4] [REVIEW] Variant detected
- Amazon: Samsung Galaxy Buds2 Pro (Graphite)
- eBay: Samsung Galaxy Buds 2 Pro (White)
- Match Score: 85%
- Tier: VARIANT
- Differences: Color mismatch (Graphite vs White)
- Recommendation: MANUAL REVIEW REQUIRED
```

---

## Phase 5: SEO Intelligence

### Purpose
Generate optimized eBay listing titles that rank in search.

### Process Flow

```typescript
interface SEOAnalysis {
  targetProduct: AmazonProduct;
  competitors: EbayListing[];
  extractedKeywords: string[];
  keywordFrequency: { [keyword: string]: number };
  titlePatterns: string[];
  generatedTitle: string;
  generatedDescription: string;
}

async function analyzeSEO(product: AmazonProduct): Promise<SEOAnalysis> {
  // Step 1: Find top 10 competitor listings
  const competitors = await searchEbayForProduct(product, 10);
  
  // Step 2: Extract keywords from competitor titles
  const allKeywords: string[] = [];
  competitors.forEach(listing => {
    const words = listing.title.split(' ').filter(w => w.length > 2);
    allKeywords.push(...words);
  });
  
  // Step 3: Calculate keyword frequency
  const frequency: { [key: string]: number } = {};
  allKeywords.forEach(kw => {
    const lower = kw.toLowerCase();
    frequency[lower] = (frequency[lower] || 0) + 1;
  });
  
  // Step 4: Identify title patterns
  const patterns = identifyTitlePatterns(competitors);
  
  // Step 5: Generate new title (remix, not copy)
  const generatedTitle = await generateOptimizedTitle(product, frequency, patterns);
  
  // Step 6: Generate description
  const generatedDescription = await generateDescription(product, frequency);
  
  return {
    targetProduct: product,
    competitors,
    extractedKeywords: Object.keys(frequency),
    keywordFrequency: frequency,
    titlePatterns: patterns,
    generatedTitle,
    generatedDescription
  };
}

function identifyTitlePatterns(listings: EbayListing[]): string[] {
  const patterns: string[] = [];
  
  // Common patterns
  const hasNew = listings.filter(l => l.title.includes('NEW')).length;
  const hasFree = listings.filter(l => l.title.includes('FREE')).length;
  const hasSealed = listings.filter(l => l.title.includes('SEALED')).length;
  
  if (hasNew / listings.length > 0.5) patterns.push('Include NEW');
  if (hasFree / listings.length > 0.3) patterns.push('Include FREE SHIPPING');
  if (hasSealed / listings.length > 0.3) patterns.push('Include SEALED/BOX');
  
  return patterns;
}

async function generateOptimizedTitle(
  product: AmazonProduct,
  keywords: { [key: string]: number },
  patterns: string[]
): Promise<string> {
  // Rules:
  // 1. Under 80 characters
  // 2. Front-load important keywords
  // 3. Include brand and model
  // 4. Do NOT copy competitor titles directly
  // 5. Include "NEW" if applicable
  
  const topKeywords = Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);
  
  // Build title components
  const components = [
    product.brand,
    product.model || '',
    ...topKeywords.filter(kw => 
      !product.brand?.toLowerCase().includes(kw) &&
      !product.model?.toLowerCase().includes(kw)
    ).slice(0, 3),
    'NEW'
  ].filter(Boolean);
  
  let title = components.join(' ');
  
  // Truncate to 80 chars
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }
  
  return title;
}
```

### Title Generation Rules

1. **Maximum 80 characters** - eBay truncates longer titles
2. **Front-load keywords** - Most important words first
3. **Include brand** - Always if not VERO
4. **Include model** - For searchability
5. **Add "NEW"** - If product is new
6. **Never copy** - Remix keywords, don't copy competitor titles
7. **No keyword stuffing** - Natural reading

### Discord Report Format
```
[PHASE 5] [SEO] Title optimized
- Product: Apple AirPods Pro 2nd Generation
- Original Amazon Title: Apple AirPods Pro (2nd Generation) Wireless Earbuds...
- Top Keywords: airpods, pro, wireless, earbuds, apple, magsafe, new
- Generated Title: Apple AirPods Pro 2nd Gen MagSafe Wireless Earbuds NEW
- Length: 54 chars ✓
```

---

## Phase 6: Bulk Listing (BulkLister)

### Purpose
Create eBay listings at scale with rate limiting and error handling.

### Batch Processing System

```typescript
interface BulkListingJob {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  products: ResearchResult[];
  batchSize: number;
  currentBatch: number;
  totalBatches: number;
  successCount: number;
  failureCount: number;
  startedAt: string;
  completedAt: string | null;
  errors: { productId: string; error: string }[];
}

interface ListingParams {
  title: string;
  description: string;
  price: number;
  quantity: number;
  images: string[];
  category: string;
  condition: 'NEW' | 'USED';
  shippingFree: boolean;
}
```

### BulkLister Implementation

```typescript
class BulkLister {
  private batchSize = 3;
  private delayBetweenListings = 2000; // 2 seconds
  private maxDailyListings = 100;
  
  async processBatch(products: ResearchResult[]): Promise<BulkListingJob> {
    const job: BulkListingJob = {
      id: generateId(),
      status: 'IN_PROGRESS',
      products,
      batchSize: this.batchSize,
      currentBatch: 0,
      totalBatches: Math.ceil(products.length / this.batchSize),
      successCount: 0,
      failureCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      errors: []
    };
    
    // Process in batches
    for (let i = 0; i < products.length; i += this.batchSize) {
      job.currentBatch++;
      const batch = products.slice(i, i + this.batchSize);
      
      await this.processSingleBatch(batch, job);
      
      // Rate limiting - pause between batches
      if (i + this.batchSize < products.length) {
        await this.delay(this.delayBetweenListings * this.batchSize);
      }
    }
    
    job.status = 'COMPLETED';
    job.completedAt = new Date().toISOString();
    
    return job;
  }
  
  private async processSingleBatch(
    batch: ResearchResult[], 
    job: BulkListingJob
  ): Promise<void> {
    for (const product of batch) {
      try {
        // Step 1: Scrape full Amazon product data
        const amazonData = await this.scrapeAmazonProduct(product.asin);
        
        // Step 2: Generate optimized listing
        const listing = await this.generateListing(amazonData);
        
        // Step 3: Download and optimize images
        const images = await this.processImages(amazonData.images);
        
        // Step 4: Create eBay listing
        const ebayId = await this.createEbayListing({
          ...listing,
          images
        });
        
        // Step 5: Log success
        await this.logListingCreated(product, ebayId);
        job.successCount++;
        
        // Rate limit between items
        await this.delay(this.delayBetweenListings);
        
      } catch (error) {
        job.failureCount++;
        job.errors.push({
          productId: product.asin,
          error: error.message
        });
        
        // Log failure to Discord
        await this.reportError(product, error);
      }
    }
  }
  
  private async generateListing(amazonData: AmazonProduct): Promise<ListingParams> {
    // Get optimized title and description from SEO phase
    const seo = await analyzeSEO(amazonData);
    
    // Calculate price (default: 2x Amazon price)
    const settings = await getSettings();
    const markup = settings.markup || 2;
    const price = amazonData.price * markup;
    
    return {
      title: seo.generatedTitle,
      description: seo.generatedDescription,
      price,
      quantity: 1,
      images: [],
      category: amazonData.category,
      condition: 'NEW',
      shippingFree: true
    };
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Discord Report Format
```
[PHASE 6] [BATCH] Listing batch started
- Job ID: BLK-20240115-001
- Products: 15
- Batch Size: 3
- Total Batches: 5
- ETA: ~10 minutes

[PHASE 6] [CREATED] Listing published
- eBay ID: 123456789012
- Title: Apple AirPods Pro 2nd Gen MagSafe Earbuds NEW
- Price: $498.00
- Amazon Source: $249.00
- Margin: 50% gross, 34% net

[PHASE 6] [COMPLETE] Batch job finished
- Job ID: BLK-20240115-001
- Success: 14/15
- Failed: 1
- Duration: 8 minutes
- Errors: B08N5WRWNW - Rate limit exceeded
```

---

## Phase 7: Ongoing Management

### Purpose
Maintain listings and handle operations after publishing.

### Automated Tasks

```typescript
interface OngoingManagementTasks {
  priceMonitoring: {
    frequency: 'HOURLY';
    action: 'Check Amazon price, adjust eBay if needed';
  };
  stockMonitoring: {
    frequency: 'DAILY';
    action: 'Check Amazon availability, pause if OOS';
  };
  orderFulfillment: {
    frequency: 'ON_ORDER';
    action: 'Auto-purchase from Amazon with customer address';
  };
  trackingUpdates: {
    frequency: 'ON_SHIP';
    action: 'Update eBay with Amazon tracking number';
  };
  financeReconciliation: {
    frequency: 'DAILY';
    action: 'Match orders, calculate profit, update reports';
  };
}
```

### Price Monitoring

```typescript
async function monitorPrices(): Promise<void> {
  const activeListings = await getActiveListings();
  
  for (const listing of activeListings) {
    const currentAmazonPrice = await scrapeAmazonPrice(listing.amazonAsin);
    
    if (currentAmazonPrice !== listing.amazonPrice) {
      const newEbayPrice = currentAmazonPrice * listing.markup;
      
      // Check if still profitable
      const netMargin = calculateNetMargin(currentAmazonPrice, newEbayPrice);
      
      if (netMargin < 10) {
        // Below minimum threshold - pause listing
        await pauseListing(listing.ebayId);
        await reportMarginAlert(listing, netMargin);
      } else {
        // Update price
        await updateEbayPrice(listing.ebayId, newEbayPrice);
        await reportPriceUpdate(listing, newEbayPrice);
      }
    }
  }
}
```

### Stock Monitoring

```typescript
async function monitorStock(): Promise<void> {
  const activeListings = await getActiveListings();
  
  for (const listing of activeListings) {
    const isInStock = await checkAmazonStock(listing.amazonAsin);
    
    if (!isInStock && listing.status === 'ACTIVE') {
      await pauseListing(listing.ebayId);
      await reportStockAlert(listing, 'OUT_OF_STOCK');
    } else if (isInStock && listing.status === 'PAUSED') {
      await reactivateListing(listing.ebayId);
      await reportStockAlert(listing, 'BACK_IN_STOCK');
    }
  }
}
```

### Order Fulfillment

```typescript
async function fulfillOrder(order: EbayOrder): Promise<void> {
  // Get Amazon product link
  const listing = await getListing(order.ebayItemId);
  
  // Open Amazon product page
  await navigateToAmazon(listing.amazonUrl);
  
  // Add to cart
  await addToCart();
  
  // Go to checkout
  await goToCheckout();
  
  // Enter customer shipping address
  await enterShippingAddress({
    name: order.buyerName,
    street: order.shippingAddress.street,
    city: order.shippingAddress.city,
    state: order.shippingAddress.state,
    zip: order.shippingAddress.zip
  });
  
  // Complete purchase
  await completePurchase();
  
  // Get Amazon order ID
  const amazonOrderId = await extractAmazonOrderId();
  
  // Log order
  await logOrderFulfilled(order, amazonOrderId);
  
  // Report to Discord
  await reportOrderFulfilled(order, amazonOrderId);
}
```

### Finance Reconciliation

```typescript
async function reconcileFinances(): Promise<DailyReconciliation> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get all orders from today
  const orders = await getOrdersForDate(today);
  
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalFees = 0;
  let totalProfit = 0;
  
  for (const order of orders) {
    const revenue = order.salePrice;
    const amazonCost = order.amazonCost;
    const ebayFee = revenue * 0.129;
    const paymentFee = revenue * 0.03;
    const profit = revenue - amazonCost - ebayFee - paymentFee;
    
    totalRevenue += revenue;
    totalCosts += amazonCost;
    totalFees += (ebayFee + paymentFee);
    totalProfit += profit;
  }
  
  const reconciliation: DailyReconciliation = {
    date: today,
    ordersCount: orders.length,
    totalRevenue,
    totalCosts,
    totalFees,
    totalProfit,
    marginPercent: (totalProfit / totalRevenue) * 100
  };
  
  await saveReconciliation(reconciliation);
  await reportDailySummary(reconciliation);
  
  return reconciliation;
}
```

### Discord Report Format
```
[PHASE 7] [PRICE] Price updated
- eBay ID: 123456789012
- Amazon Price: $249.00 → $229.00 ↓
- eBay Price: $498.00 → $458.00 ↓
- New Margin: 36% net

[PHASE 7] [STOCK] Out of stock alert
- eBay ID: 123456789012
- Product: Apple AirPods Pro 2nd Gen
- Amazon Status: OUT OF STOCK
- Action: Listing PAUSED

[PHASE 7] [ORDER] Order fulfilled
- eBay Order: 12-34567-89012
- Amazon Order: 111-2345678-9012345
- Buyer: John D.
- Ship To: Los Angeles, CA
- Revenue: $498.00
- Cost: $249.00
- Profit: $170.73

[PHASE 7] [FINANCE] Daily reconciliation
- Date: 2024-01-15
- Orders: 23
- Revenue: $11,454.00
- Costs: $5,727.00
- Fees: $1,833.64
- Profit: $3,893.36
- Margin: 34% net
```

---

## TypeScript Interfaces (Complete)

```typescript
// ==========================================
// CORE INTERFACES
// ==========================================

interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  priceString: string;
  originalPrice?: number;
  imageUrl: string;
  images: string[];
  reviewCount: number;
  rating: number;
  isPrime: boolean;
  sellerName: string;
  productUrl: string;
  brand: string;
  model?: string;
  category: string;
  description: string;
  bulletPoints: string[];
  specifications: { [key: string]: string };
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED';
  reviews?: ProductReview[];
}

interface EbayListing {
  itemId: string;
  title: string;
  price: number;
  shippingCost: number;
  sellerName: string;
  sellerFeedback: number;
  sellerFeedbackPercent: number;
  imageUrl: string;
  images: string[];
  itemUrl: string;
  soldCount: number;
  watchCount: number;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  category: string;
  description: string;
  listingDate: string;
  endDate?: string;
}

interface DropshipperSeller {
  username: string;
  feedbackPercent: number;
  productsCount: number;
  amazonMatchRate: number;
  addedDate: string;
  verified: boolean;
  verifiedDate?: string;
  accountAge: number;
  totalSold: number;
  confidenceScore: number;
  products?: EbayListing[];
}

interface ProductDNA {
  brand: string | null;
  modelNumber: string | null;
  materials: string[];
  colors: string[];
  dimensions: string | null;
  specifications: { [key: string]: string };
  visualFeatures: string[];
  packagingDetails: string[];
  conditionIndicators: string[];
  confidence: number;
}

interface ProductMatch {
  amazonProduct: AmazonProduct;
  ebayListing: EbayListing;
  amazonDNA: ProductDNA;
  ebayDNA: ProductDNA;
  matchScore: number;
  matchTier: 'EXACT' | 'VARIANT' | 'SIMILAR' | 'NO_MATCH';
  differences: string[];
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
  matchedAt: string;
}

interface ResearchResult {
  id: string;
  asin: string;
  amazonProduct: AmazonProduct;
  filterResults: FilteredProduct;
  matchedEbayListings: EbayListing[];
  verifiedSellers: DropshipperSeller[];
  productMatches: ProductMatch[];
  seoAnalysis: SEOAnalysis;
  status: 'PENDING' | 'FILTERED_OUT' | 'MATCHED' | 'READY_TO_LIST' | 'LISTED';
  createdAt: string;
  updatedAt: string;
}

interface BulkListingJob {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  products: ResearchResult[];
  batchSize: number;
  currentBatch: number;
  totalBatches: number;
  successCount: number;
  failureCount: number;
  startedAt: string;
  completedAt: string | null;
  pausedAt?: string;
  errors: { productId: string; error: string }[];
  createdListings: string[]; // eBay item IDs
}

interface ScanFilter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  canDisable: boolean;
  threshold?: number;
  action: 'BLOCK' | 'FLAG';
}

// ==========================================
// SUPPORTING INTERFACES
// ==========================================

interface FilterResult {
  passed: boolean;
  flagged?: boolean;
  reason?: string;
  action?: 'BLOCK' | 'FLAG';
}

interface FilteredProduct {
  product: AmazonProduct;
  filterResults: { [filterId: string]: FilterResult };
  overallPassed: boolean;
  flags: string[];
  blockReasons: string[];
}

interface SEOAnalysis {
  targetProduct: AmazonProduct;
  competitors: EbayListing[];
  extractedKeywords: string[];
  keywordFrequency: { [keyword: string]: number };
  titlePatterns: string[];
  generatedTitle: string;
  generatedDescription: string;
}

interface ProductReview {
  rating: number;
  title: string;
  text: string;
  date: string;
  verified: boolean;
}

interface DailyReconciliation {
  date: string;
  ordersCount: number;
  totalRevenue: number;
  totalCosts: number;
  totalFees: number;
  totalProfit: number;
  marginPercent: number;
}

interface EbayOrder {
  orderId: string;
  ebayItemId: string;
  buyerName: string;
  buyerEmail: string;
  salePrice: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  orderDate: string;
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
}
```

---

## CSV File Formats

### dropshippers.csv
```csv
username,feedback_percent,products_count,amazon_match_rate,added_date,verified,verified_date,account_age,total_sold,confidence_score
dropship_deals_2024,98.7,1847,84,2024-01-10T08:00:00Z,true,2024-01-10T08:30:00Z,187,523,87
best_prices_shop,97.2,2341,78,2024-01-11T14:00:00Z,true,2024-01-11T14:45:00Z,423,1205,92
new_seller_123,100,45,90,2024-01-12T10:00:00Z,false,,,14,12,35
```

### research_queue.csv
```csv
asin,title,price,image_url,review_count,rating,is_prime,product_url,added_date,status
B08N5WRWNW,Apple AirPods Pro (2nd Generation),249.00,https://m.media-amazon.com/images/...,156234,4.7,true,https://amazon.com/dp/B08N5WRWNW,2024-01-15T09:00:00Z,PENDING
B09V3KXJPB,Samsung Galaxy Buds2 Pro,229.99,https://m.media-amazon.com/images/...,23456,4.5,true,https://amazon.com/dp/B09V3KXJPB,2024-01-15T09:05:00Z,PENDING
```

### filtered_out.csv
```csv
asin,title,price,filter_id,filter_name,reason,blocked_date
B07XYZ1234,Nike Air Max 90 Sneakers,129.99,vero_brands,VERO Protected Brands,VERO protected brand: Nike,2024-01-15T09:10:00Z
B08ABC5678,Glass Wine Decanter Set,45.99,fragile_liquid,Fragile/Liquid Items,Product contains fragile/liquid keywords,2024-01-15T09:12:00Z
B09DEF9012,Generic USB Cable 10-Pack,8.99,high_return_rate,High Return Rate,High return rate: 23.4%,2024-01-15T09:15:00Z
```

### listings_created.csv
```csv
ebay_id,asin,title,amazon_price,ebay_price,markup,category,created_date,status,views,clicks,sales,last_updated
123456789012,B08N5WRWNW,Apple AirPods Pro 2nd Gen MagSafe Earbuds NEW,249.00,498.00,2.0,Cell Phones & Accessories,2024-01-15T10:00:00Z,ACTIVE,156,23,2,2024-01-15T18:00:00Z
123456789013,B09V3KXJPB,Samsung Galaxy Buds2 Pro Wireless Earbuds NEW,229.99,459.98,2.0,Cell Phones & Accessories,2024-01-15T10:02:00Z,ACTIVE,89,12,1,2024-01-15T18:00:00Z
```

---

## Discord Report Format Reference

### Standard Format
```
[PHASE] [STATUS] Message Title
- Key: Value
- Key: Value
- Key: Value
```

### Phase Identifiers
| Phase | Prefix |
|-------|--------|
| Amazon Discovery | [PHASE 1] |
| Risk Filters | [PHASE 1B] |
| eBay Reverse Search | [PHASE 2] |
| Seller Verification | [PHASE 3] |
| Product DNA | [PHASE 4] |
| SEO Intelligence | [PHASE 5] |
| Bulk Listing | [PHASE 6] |
| Ongoing Management | [PHASE 7] |

### Status Identifiers
| Status | Meaning |
|--------|---------|
| [ADDED] | New item added to queue |
| [BLOCKED] | Item blocked by filter |
| [FLAGGED] | Item flagged for review |
| [SCAN] | Scan started |
| [VERIFIED] | Seller verified |
| [REJECTED] | Seller rejected |
| [MATCH] | Product matched |
| [REVIEW] | Needs manual review |
| [SEO] | Title optimized |
| [BATCH] | Batch operation |
| [CREATED] | Listing created |
| [COMPLETE] | Job completed |
| [PRICE] | Price updated |
| [STOCK] | Stock status changed |
| [ORDER] | Order fulfilled |
| [FINANCE] | Finance report |
| [ERROR] | Error occurred |
| [ALERT] | Alert requiring attention |

---

*Last Updated: 2024*
*Version: 1.0*
