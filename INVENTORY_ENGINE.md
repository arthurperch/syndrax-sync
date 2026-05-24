# SYNDRAX SYNC - INVENTORY ENGINE

## Overview

The Inventory Engine is a future feature (Phase 3+) that implements a 90-day product lifecycle system with performance scoring, automated relisting, and recycling of underperforming products.

---

## 90-Day Product Lifecycle

### Lifecycle Phases

```
┌─────────────────────────────────────────────────────────────┐
│                   90-DAY PRODUCT LIFECYCLE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DAY 0-30: INITIAL PERIOD                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Track views and clicks                             │   │
│  │ • Monitor conversion rate                            │   │
│  │ • Gather baseline data                               │   │
│  │ • No changes unless critical issue                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  DAY 30: FIRST CHECKPOINT                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Evaluate performance score                         │   │
│  │ • Auto-relist with ONE change:                       │   │
│  │   - Title variation OR                               │   │
│  │   - Price adjustment OR                              │   │
│  │   - Category change                                  │   │
│  │ • Track which variation was made                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  DAY 30-60: VARIATION PERIOD                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Monitor variation performance                      │   │
│  │ • Compare to baseline                                │   │
│  │ • Track improvement/decline                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  DAY 60: SECOND CHECKPOINT                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IF views < 10 total:                                 │   │
│  │   → PULL listing (not working)                       │   │
│  │   → Add to recycling queue                           │   │
│  │ ELSE:                                                │   │
│  │   → Continue monitoring                              │   │
│  │   → Try another variation                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  DAY 60-90: FINAL PERIOD                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Last chance for product                            │   │
│  │ • Aggressive price reduction if needed               │   │
│  │ • Final performance evaluation                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  DAY 90: FINAL DECISION                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IF selling well:                                     │   │
│  │   → Keep active, continue monitoring                 │   │
│  │ ELSE:                                                │   │
│  │   → End listing                                      │   │
│  │   → Add to recycling queue                           │   │
│  │   → Find replacement product                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Lifecycle Configuration

```typescript
interface LifecycleConfig {
  // Checkpoints
  firstCheckpoint: 30;     // Days
  secondCheckpoint: 60;    // Days
  finalCheckpoint: 90;     // Days
  
  // Thresholds
  minViewsAt60Days: 10;    // Pull if below this
  minSalesAt90Days: 1;     // Pull if below this
  
  // Actions
  variations: ['title', 'price', 'category', 'images'];
  maxVariationsPerProduct: 3;
  
  // Recycling
  recycleAfterDays: 90;
  replacementSearchAuto: true;
}
```

---

## Product Performance Score

### Score Calculation

```typescript
interface ProductPerformanceScore {
  // Components (each 0-100)
  salesVelocity: number;      // 40% weight
  viewToClickRatio: number;   // 25% weight
  productReviews: number;     // 20% weight
  competitorCount: number;    // 15% weight
  
  // Calculated
  totalScore: number;         // 0-100
  tier: 'POOR' | 'BELOW_AVG' | 'AVERAGE' | 'GOOD' | 'EXCELLENT';
}

function calculatePerformanceScore(product: ProductMetrics): ProductPerformanceScore {
  // Sales Velocity (40% weight)
  // Normalize: 10 sales/month = 100 score
  const salesVelocity = Math.min(100, (product.salesPerMonth / 10) * 100);
  
  // View to Click Ratio (25% weight)
  // Normalize: 5% CTR = 100 score
  const ctr = product.totalClicks / product.totalViews * 100;
  const viewToClickRatio = Math.min(100, (ctr / 5) * 100);
  
  // Product Reviews (20% weight)
  // Amazon product review score
  const productReviews = Math.min(100, (product.amazonRating / 5) * 100);
  
  // Competitor Count (15% weight)
  // Fewer competitors = better (inverse)
  // 0 competitors = 100, 20+ competitors = 0
  const competitorCount = Math.max(0, 100 - (product.competitorCount * 5));
  
  // Calculate weighted total
  const totalScore = 
    salesVelocity * 0.40 +
    viewToClickRatio * 0.25 +
    productReviews * 0.20 +
    competitorCount * 0.15;
  
  // Determine tier
  let tier: ProductPerformanceScore['tier'];
  if (totalScore < 20) tier = 'POOR';
  else if (totalScore < 40) tier = 'BELOW_AVG';
  else if (totalScore < 60) tier = 'AVERAGE';
  else if (totalScore < 80) tier = 'GOOD';
  else tier = 'EXCELLENT';
  
  return {
    salesVelocity,
    viewToClickRatio,
    productReviews,
    competitorCount,
    totalScore,
    tier
  };
}
```

### Score Thresholds

| Score | Tier | Action |
|-------|------|--------|
| 0-19 | POOR | Flag for removal |
| 20-39 | BELOW_AVG | Price reduction, variation test |
| 40-59 | AVERAGE | Continue monitoring |
| 60-79 | GOOD | Consider premium pricing |
| 80-100 | EXCELLENT | Scale similar products |

---

## Tracking Metrics Per Product

### Complete Product Tracking Schema

```typescript
interface ProductTracking {
  // Identification
  productId: string;           // Internal ID
  amazonAsin: string;          // Amazon source
  ebayListingId: string;       // eBay listing ID
  
  // Dates
  dateCreated: Date;           // When listing was created
  dateFirstSale: Date | null;  // First sale date
  dateLastSale: Date | null;   // Most recent sale
  currentAge: number;          // Days since created
  
  // Views & Clicks
  dailyViews: number[];        // Array of daily view counts
  dailyClicks: number[];       // Array of daily click counts
  totalViews: number;          // Sum of all views
  totalClicks: number;         // Sum of all clicks
  ctr: number;                 // Click-through rate %
  
  // Sales
  totalSales: number;          // Total units sold
  salesThisMonth: number;      // Sales in last 30 days
  salesVelocity: number;       // Sales per week
  
  // Pricing
  originalPrice: number;       // Initial listing price
  currentPrice: number;        // Current price
  priceHistory: PriceChange[]; // All price changes
  
  // Variations
  titleVariations: TitleVariation[];
  currentTitle: string;
  categoryHistory: string[];
  currentCategory: string;
  
  // Performance
  engagementScore: number;     // Calculated score
  performanceTier: string;     // POOR to EXCELLENT
  
  // Status
  status: 'ACTIVE' | 'PAUSED' | 'ENDED' | 'RECYCLED';
  pauseReason?: string;
  recycledDate?: Date;
}

interface PriceChange {
  date: Date;
  oldPrice: number;
  newPrice: number;
  reason: string;
}

interface TitleVariation {
  date: Date;
  oldTitle: string;
  newTitle: string;
  viewsBefore: number;
  viewsAfter: number;
  improvement: number;  // Percentage
}
```

### Tracking Database Schema

```sql
CREATE TABLE product_tracking (
  id VARCHAR(36) PRIMARY KEY,
  amazon_asin VARCHAR(20) NOT NULL,
  ebay_listing_id VARCHAR(20),
  
  -- Dates
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_first_sale TIMESTAMP,
  date_last_sale TIMESTAMP,
  
  -- Metrics
  total_views INT DEFAULT 0,
  total_clicks INT DEFAULT 0,
  total_sales INT DEFAULT 0,
  
  -- Pricing
  original_price DECIMAL(10,2),
  current_price DECIMAL(10,2),
  
  -- Titles
  current_title VARCHAR(80),
  
  -- Status
  status ENUM('ACTIVE', 'PAUSED', 'ENDED', 'RECYCLED') DEFAULT 'ACTIVE',
  engagement_score DECIMAL(5,2),
  performance_tier VARCHAR(20),
  
  -- Timestamps
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE daily_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  views INT DEFAULT 0,
  clicks INT DEFAULT 0,
  sales INT DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES product_tracking(id)
);

CREATE TABLE price_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  reason VARCHAR(100),
  FOREIGN KEY (product_id) REFERENCES product_tracking(id)
);

CREATE TABLE title_variations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_title VARCHAR(80),
  new_title VARCHAR(80),
  views_before INT,
  views_after INT,
  FOREIGN KEY (product_id) REFERENCES product_tracking(id)
);
```

---

## Recycling Loop

### Recycling Process

```typescript
interface RecyclingQueue {
  products: RecycledProduct[];
  processedToday: number;
  maxDailyProcessing: number;
}

interface RecycledProduct {
  productId: string;
  originalAsin: string;
  recycledDate: Date;
  reason: string;
  status: 'PENDING' | 'REPLACEMENT_FOUND' | 'NO_REPLACEMENT' | 'RELISTED';
  replacementAsin?: string;
}

async function recycleProduct(product: ProductTracking): Promise<void> {
  // Step 1: End the eBay listing
  await endEbayListing(product.ebayListingId);
  
  // Step 2: Update status
  await updateProductStatus(product.productId, 'RECYCLED', {
    reason: determineRecycleReason(product),
    recycledDate: new Date()
  });
  
  // Step 3: Add to recycling queue
  await addToRecyclingQueue({
    productId: product.productId,
    originalAsin: product.amazonAsin,
    recycledDate: new Date(),
    reason: determineRecycleReason(product),
    status: 'PENDING'
  });
  
  // Step 4: Trigger replacement search
  await findReplacementProduct(product.amazonAsin);
  
  // Step 5: Log to Discord
  await sendToDiscord('inventory-health', {
    title: '♻️ Product Recycled',
    fields: [
      { name: 'Product', value: product.ebayListingId },
      { name: 'Age', value: `${product.currentAge} days` },
      { name: 'Reason', value: determineRecycleReason(product) },
      { name: 'Total Views', value: product.totalViews.toString() },
      { name: 'Total Sales', value: product.totalSales.toString() }
    ]
  });
}

function determineRecycleReason(product: ProductTracking): string {
  if (product.totalViews < 10 && product.currentAge >= 60) {
    return 'Very low visibility (<10 views in 60 days)';
  }
  if (product.totalSales === 0 && product.currentAge >= 90) {
    return 'No sales in 90 days';
  }
  if (product.engagementScore < 20) {
    return 'Poor engagement score';
  }
  return 'Underperforming product';
}
```

### Replacement Product Search

```typescript
interface ReplacementSearch {
  originalAsin: string;
  searchCriteria: {
    sameCategory: boolean;
    similarPrice: boolean;
    higherRating: boolean;
    moreSales: boolean;
  };
  candidates: ReplacementCandidate[];
  selectedReplacement?: string;
}

async function findReplacementProduct(originalAsin: string): Promise<string | null> {
  // Get original product data
  const original = await getAmazonProduct(originalAsin);
  
  // Search for similar products
  const searchQuery = buildReplacementQuery(original);
  const candidates = await searchAmazonProducts(searchQuery);
  
  // Filter candidates
  const validCandidates = candidates.filter(candidate => {
    // Must be in same category
    if (candidate.category !== original.category) return false;
    
    // Must have higher rating
    if (candidate.rating < original.rating) return false;
    
    // Must have more reviews (social proof)
    if (candidate.reviewCount < original.reviewCount) return false;
    
    // Price must be similar (within 20%)
    const priceDiff = Math.abs(candidate.price - original.price) / original.price;
    if (priceDiff > 0.2) return false;
    
    // Must pass compliance filters
    if (!passesComplianceFilters(candidate)) return false;
    
    return true;
  });
  
  if (validCandidates.length === 0) {
    return null;
  }
  
  // Select best candidate
  const bestCandidate = validCandidates.sort((a, b) => {
    // Sort by review count (higher is better)
    return b.reviewCount - a.reviewCount;
  })[0];
  
  // Add to research queue
  await addToResearchQueue(bestCandidate.asin);
  
  return bestCandidate.asin;
}
```

---

## eBay Ads & Campaign Integration

### Promoted Listings Toggle

```typescript
interface PromotedListingConfig {
  enabled: boolean;
  defaultAdRate: number;        // Percentage (1-20%)
  budgetDaily: number;          // Max daily spend
  budgetMonthly: number;        // Max monthly spend
  
  // Auto-rules
  autoPromote: {
    enabled: boolean;
    minEngagementScore: number; // Only promote good products
    maxProducts: number;        // Limit promoted products
  };
  
  // Pause rules
  autoPause: {
    enabled: boolean;
    maxCostPerSale: number;     // Pause if CPS exceeds this
    minROI: number;             // Pause if ROI below this
  };
}

const DEFAULT_PROMOTED_CONFIG: PromotedListingConfig = {
  enabled: false,  // Off by default
  defaultAdRate: 5,
  budgetDaily: 10,
  budgetMonthly: 200,
  autoPromote: {
    enabled: false,
    minEngagementScore: 60,
    maxProducts: 50
  },
  autoPause: {
    enabled: true,
    maxCostPerSale: 5.00,
    minROI: 2.0
  }
};
```

### Promoted Listing Management

```typescript
interface PromotedListing {
  ebayListingId: string;
  adRate: number;            // % of sale price
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  
  // Performance
  impressions: number;
  clicks: number;
  sales: number;
  adSpend: number;
  revenue: number;
  
  // Calculated
  ctr: number;               // Click-through rate
  conversionRate: number;    // Sales / Clicks
  acos: number;              // Ad cost of sale
  roi: number;               // Return on investment
}

async function evaluatePromotedListings(): Promise<void> {
  const promotedListings = await getActivePromotedListings();
  
  for (const listing of promotedListings) {
    // Calculate ROI
    const roi = listing.revenue / listing.adSpend;
    const costPerSale = listing.sales > 0 
      ? listing.adSpend / listing.sales 
      : Infinity;
    
    // Check auto-pause rules
    const config = await getPromotedConfig();
    
    if (config.autoPause.enabled) {
      if (costPerSale > config.autoPause.maxCostPerSale) {
        await pausePromotion(listing.ebayListingId, 
          `Cost per sale ($${costPerSale.toFixed(2)}) exceeds threshold`);
      }
      
      if (roi < config.autoPause.minROI && listing.sales >= 3) {
        await pausePromotion(listing.ebayListingId,
          `ROI (${roi.toFixed(2)}x) below threshold`);
      }
    }
  }
}
```

### ROI Calculation

```typescript
function calculatePromotedROI(listing: PromotedListing): number {
  if (listing.adSpend === 0) return 0;
  
  // Net profit from promoted sales
  const netProfit = listing.revenue * 0.34;  // Assume 34% net margin
  
  // ROI = (Profit - Ad Spend) / Ad Spend
  const roi = (netProfit - listing.adSpend) / listing.adSpend;
  
  return roi;
}

function shouldPromote(product: ProductTracking): boolean {
  // Only promote products with good engagement
  if (product.engagementScore < 60) return false;
  
  // Don't promote brand new listings
  if (product.currentAge < 7) return false;
  
  // Don't promote if already selling well
  if (product.salesVelocity > 3) return false;  // 3+ sales/week
  
  // Don't promote if low margin
  const margin = calculateCurrentMargin(product);
  if (margin < 20) return false;
  
  return true;
}
```

---

## Listing Limit Enforcement

### Account Age Tiers

```typescript
interface ListingLimits {
  accountAgeDays: number;
  maxActiveListings: number;
  maxNewListingsPerDay: number;
  restrictedCategories: string[];
}

const LISTING_LIMITS: ListingLimits[] = [
  {
    accountAgeDays: 0,     // Day 0-13
    maxActiveListings: 50,
    maxNewListingsPerDay: 5,
    restrictedCategories: ['Electronics', 'Jewelry']
  },
  {
    accountAgeDays: 14,    // Day 14-29
    maxActiveListings: 200,
    maxNewListingsPerDay: 25,
    restrictedCategories: ['Electronics']
  },
  {
    accountAgeDays: 30,    // Day 30-59
    maxActiveListings: 500,
    maxNewListingsPerDay: 50,
    restrictedCategories: []
  },
  {
    accountAgeDays: 60,    // Day 60-89
    maxActiveListings: 1000,
    maxNewListingsPerDay: 75,
    restrictedCategories: []
  },
  {
    accountAgeDays: 90,    // Day 90+
    maxActiveListings: 10000,
    maxNewListingsPerDay: 100,
    restrictedCategories: []
  }
];

function getListingLimits(accountAgeDays: number): ListingLimits {
  // Find the highest tier the account qualifies for
  return LISTING_LIMITS
    .filter(tier => accountAgeDays >= tier.accountAgeDays)
    .sort((a, b) => b.accountAgeDays - a.accountAgeDays)[0];
}

async function canCreateListing(category: string): Promise<{ allowed: boolean; reason?: string }> {
  const account = await getAccountInfo();
  const limits = getListingLimits(account.ageDays);
  
  // Check active listings limit
  const activeCount = await getActiveListingCount();
  if (activeCount >= limits.maxActiveListings) {
    return { 
      allowed: false, 
      reason: `Active listing limit reached (${limits.maxActiveListings})` 
    };
  }
  
  // Check daily limit
  const todayCount = await getTodayListingCount();
  if (todayCount >= limits.maxNewListingsPerDay) {
    return { 
      allowed: false, 
      reason: `Daily listing limit reached (${limits.maxNewListingsPerDay})` 
    };
  }
  
  // Check category restrictions
  if (limits.restrictedCategories.includes(category)) {
    return { 
      allowed: false, 
      reason: `Category "${category}" restricted for account age` 
    };
  }
  
  return { allowed: true };
}
```

---

## Inventory Health Dashboard

### Dashboard Display

```
📦 INVENTORY HEALTH - 2024-01-15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERVIEW
├── Active Listings: 1,847
├── Paused Listings: 124
├── Avg Age: 34 days
└── Avg Engagement: 58/100

PERFORMANCE DISTRIBUTION
┌──────────────────────────────────────┐
│ EXCELLENT (80-100): ████ 185 (10%)   │
│ GOOD (60-79):       ████████ 462 (25%)│
│ AVERAGE (40-59):    ██████████ 647 (35%)│
│ BELOW AVG (20-39):  ██████ 370 (20%) │
│ POOR (0-19):        ████ 183 (10%)   │
└──────────────────────────────────────┘

LIFECYCLE STATUS
├── 0-30 days:  623 listings
├── 31-60 days: 512 listings
├── 61-90 days: 432 listings
└── 90+ days:   280 listings

ACTIONS NEEDED
├── Ready for Day 30 Relist: 45
├── Ready for Day 60 Review: 32
├── Candidates for Recycling: 18
└── Pending Replacements: 7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[View Full Report] [Process Actions] [Settings]
```

### Health Score Calculation

```typescript
interface InventoryHealth {
  totalListings: number;
  healthScore: number;  // 0-100
  distribution: {
    excellent: number;
    good: number;
    average: number;
    belowAvg: number;
    poor: number;
  };
  alerts: HealthAlert[];
}

function calculateInventoryHealth(products: ProductTracking[]): InventoryHealth {
  // Count products in each tier
  const distribution = {
    excellent: 0,
    good: 0,
    average: 0,
    belowAvg: 0,
    poor: 0
  };
  
  products.forEach(p => {
    if (p.engagementScore >= 80) distribution.excellent++;
    else if (p.engagementScore >= 60) distribution.good++;
    else if (p.engagementScore >= 40) distribution.average++;
    else if (p.engagementScore >= 20) distribution.belowAvg++;
    else distribution.poor++;
  });
  
  // Calculate health score
  // Weighted by tier quality
  const healthScore = (
    distribution.excellent * 1.0 +
    distribution.good * 0.8 +
    distribution.average * 0.5 +
    distribution.belowAvg * 0.2 +
    distribution.poor * 0
  ) / products.length * 100;
  
  // Generate alerts
  const alerts: HealthAlert[] = [];
  
  if (distribution.poor > products.length * 0.15) {
    alerts.push({
      type: 'WARNING',
      message: `${distribution.poor} products (${Math.round(distribution.poor/products.length*100)}%) have poor performance`
    });
  }
  
  const aged = products.filter(p => p.currentAge > 90 && p.totalSales === 0);
  if (aged.length > 0) {
    alerts.push({
      type: 'ACTION',
      message: `${aged.length} products over 90 days with no sales - consider recycling`
    });
  }
  
  return {
    totalListings: products.length,
    healthScore,
    distribution,
    alerts
  };
}
```

---

## Auto-Relist System

### Day 30 Auto-Relist

```typescript
interface RelistVariation {
  type: 'title' | 'price' | 'category' | 'images';
  original: string;
  new: string;
  reason: string;
}

async function processDay30Relist(product: ProductTracking): Promise<void> {
  // Determine which variation to try
  const variation = selectVariation(product);
  
  // Apply variation
  switch (variation.type) {
    case 'title':
      await updateListingTitle(product.ebayListingId, variation.new);
      break;
    case 'price':
      await updateListingPrice(product.ebayListingId, parseFloat(variation.new));
      break;
    case 'category':
      await updateListingCategory(product.ebayListingId, variation.new);
      break;
  }
  
  // Log variation
  await logVariation(product.productId, variation);
  
  // Report to Discord
  await sendToDiscord('inventory-health', {
    title: '🔄 Day 30 Relist',
    fields: [
      { name: 'Product', value: product.ebayListingId },
      { name: 'Variation', value: variation.type },
      { name: 'Original', value: variation.original },
      { name: 'New', value: variation.new },
      { name: 'Reason', value: variation.reason }
    ]
  });
}

function selectVariation(product: ProductTracking): RelistVariation {
  // If low CTR, try better title
  if (product.ctr < 2) {
    const newTitle = generateOptimizedTitle(product);
    return {
      type: 'title',
      original: product.currentTitle,
      new: newTitle,
      reason: 'Low CTR - trying SEO-optimized title'
    };
  }
  
  // If views but no sales, try lower price
  if (product.totalViews > 50 && product.totalSales === 0) {
    const newPrice = product.currentPrice * 0.9;  // 10% reduction
    return {
      type: 'price',
      original: product.currentPrice.toString(),
      new: newPrice.toFixed(2),
      reason: 'Views but no conversion - reducing price 10%'
    };
  }
  
  // Default: try different category
  const newCategory = suggestBetterCategory(product);
  return {
    type: 'category',
    original: product.currentCategory,
    new: newCategory,
    reason: 'Testing alternate category for better visibility'
  };
}
```

---

## Implementation TypeScript Interfaces

```typescript
// Complete interfaces for Inventory Engine

export interface InventoryEngineConfig {
  lifecycle: LifecycleConfig;
  scoring: ScoringConfig;
  recycling: RecyclingConfig;
  promotion: PromotedListingConfig;
  limits: ListingLimitsConfig;
}

export interface LifecycleConfig {
  checkpoints: number[];
  minViewsThresholds: { [day: number]: number };
  maxAgeWithoutSales: number;
  variationStrategy: 'sequential' | 'random' | 'smart';
}

export interface ScoringConfig {
  weights: {
    salesVelocity: number;
    viewToClick: number;
    reviews: number;
    competition: number;
  };
  refreshInterval: number;  // Hours
}

export interface RecyclingConfig {
  enabled: boolean;
  autoReplace: boolean;
  maxDailyRecycles: number;
  preserveHistory: boolean;
}

export interface ListingLimitsConfig {
  respectEbayLimits: boolean;
  customLimits: ListingLimits[];
  warningThreshold: number;  // % of limit before warning
}
```

---

*Last Updated: 2024*
*Version: 1.0*
*Feature Phase: 3+*
