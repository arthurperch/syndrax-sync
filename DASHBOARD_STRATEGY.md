# SYNDRAX SYNC - PRICING STRATEGY DASHBOARD

## Overview

The Strategy Dashboard is a future feature (Phase 4+) that provides intelligent pricing control, account warmup tracking, and cost analysis. This document details the complete design and implementation plan.

---

## 5-Option Pricing Strategy Menu

### Strategy Overview

| Mode | Description | Target Margin | Pricing vs Competitors | Best For |
|------|-------------|---------------|------------------------|----------|
| Volume Mode | Aggressive undercut | 10-15% | -10 to -15% below | New accounts, building reputation |
| Balanced Mode | Recommended default | 20-25% | -5% below | Established accounts, steady profit |
| Premium SEO-First | Win on search, not price | 30-35% | +5 to +15% above | High-trust accounts, niche products |
| Dynamic Pricing | AI-adjusted daily | Min threshold | Auto-adjusted | Large inventory, active management |
| Test & Compare | A/B testing | Varies | Multiple strategies | Optimization, data gathering |

---

## Strategy 1: Volume Mode

### Purpose
Build reputation fast by being the lowest-priced seller. Accept lower margins to gain sales volume and positive feedback.

### Configuration

```typescript
interface VolumeModeConfig {
  strategy: 'volume';
  
  // Pricing
  targetMargin: {
    min: 10,        // 10% net margin minimum
    max: 15,        // 15% net margin target
  };
  competitorOffset: -15;  // 15% below lowest competitor
  
  // Limits
  absoluteMinMargin: 8;   // Never go below 8% net
  maxDailyListings: 100;
  
  // When to use
  recommendedFor: [
    'New accounts (< 30 days)',
    'Building initial feedback',
    'Clearing inventory',
    'Highly competitive products'
  ];
}
```

### Pricing Calculation

```typescript
function calculateVolumePrice(
  amazonCost: number,
  lowestCompetitorPrice: number
): PriceResult {
  // Target: 15% below competitor
  const competitorBasedPrice = lowestCompetitorPrice * 0.85;
  
  // Calculate margin at this price
  const fees = calculateFees(competitorBasedPrice);
  const netProfit = competitorBasedPrice - amazonCost - fees;
  const margin = (netProfit / competitorBasedPrice) * 100;
  
  // Check minimum margin
  if (margin < 8) {
    // Can't go this low - calculate minimum viable price
    const minPrice = calculateMinPrice(amazonCost, 8);
    return {
      price: minPrice,
      margin: 8,
      strategy: 'volume',
      note: 'At minimum margin threshold'
    };
  }
  
  return {
    price: competitorBasedPrice,
    margin,
    strategy: 'volume',
    note: `${(15)}% below competitor`
  };
}
```

### When Volume Mode Activates
- Account age < 30 days
- Feedback score < 50 reviews
- User manually selects
- "Build Reputation" goal selected

---

## Strategy 2: Balanced Mode (Recommended)

### Purpose
The recommended default mode. Balances profitability with competitive pricing for steady, sustainable growth.

### Configuration

```typescript
interface BalancedModeConfig {
  strategy: 'balanced';
  
  // Pricing
  targetMargin: {
    min: 20,        // 20% net margin minimum
    max: 25,        // 25% net margin target
  };
  competitorOffset: -5;   // 5% below average competitor
  
  // Limits
  absoluteMinMargin: 15;  // Never go below 15% net
  maxDailyListings: 75;
  
  // When to use
  recommendedFor: [
    'Established accounts (30+ days)',
    'Accounts with 50+ feedback',
    'Standard operation',
    'Most product categories'
  ];
}
```

### Pricing Calculation

```typescript
function calculateBalancedPrice(
  amazonCost: number,
  avgCompetitorPrice: number
): PriceResult {
  // Target: 5% below average competitor
  const competitorBasedPrice = avgCompetitorPrice * 0.95;
  
  // Also calculate markup-based price
  const markupBasedPrice = amazonCost * 2.0;  // Default 2x markup
  
  // Use the higher of the two (more profit)
  const selectedPrice = Math.max(competitorBasedPrice, markupBasedPrice);
  
  // Calculate margin
  const fees = calculateFees(selectedPrice);
  const netProfit = selectedPrice - amazonCost - fees;
  const margin = (netProfit / selectedPrice) * 100;
  
  // Enforce minimum
  if (margin < 15) {
    const minPrice = calculateMinPrice(amazonCost, 15);
    return {
      price: minPrice,
      margin: 15,
      strategy: 'balanced',
      note: 'At minimum margin threshold'
    };
  }
  
  return {
    price: selectedPrice,
    margin,
    strategy: 'balanced',
    note: competitorBasedPrice > markupBasedPrice 
      ? 'Competitor-based pricing' 
      : 'Markup-based pricing'
  };
}
```

---

## Strategy 3: Premium SEO-First Mode

### Purpose
Win on search rankings and listing quality, not price. Price above competitors and rely on superior SEO, images, and descriptions to convert sales.

### Configuration

```typescript
interface PremiumModeConfig {
  strategy: 'premium';
  
  // Pricing
  targetMargin: {
    min: 30,        // 30% net margin minimum
    max: 35,        // 35% net margin target
  };
  competitorOffset: +10;  // 10% ABOVE average competitor
  
  // Requirements
  requirements: {
    minAccountAge: 60,      // 60+ days
    minFeedbackScore: 98,   // 98%+ positive
    minFeedbackCount: 100,  // 100+ reviews
    optimizedImages: true,  // AI-enhanced images required
    optimizedSEO: true      // Full SEO optimization required
  };
  
  // Limits
  absoluteMinMargin: 25;
  maxDailyListings: 50;   // Quality over quantity
  
  // When to use
  recommendedFor: [
    'High-trust accounts',
    'Niche/specialty products',
    'Products with few competitors',
    'High-quality listings only'
  ];
}
```

### Pricing Calculation

```typescript
function calculatePremiumPrice(
  amazonCost: number,
  avgCompetitorPrice: number
): PriceResult {
  // Target: 10% ABOVE average competitor
  const competitorBasedPrice = avgCompetitorPrice * 1.10;
  
  // Ensure minimum 30% margin
  const minMarginPrice = calculateMinPrice(amazonCost, 30);
  
  // Use higher of the two
  const selectedPrice = Math.max(competitorBasedPrice, minMarginPrice);
  
  // Calculate actual margin
  const fees = calculateFees(selectedPrice);
  const netProfit = selectedPrice - amazonCost - fees;
  const margin = (netProfit / selectedPrice) * 100;
  
  return {
    price: selectedPrice,
    margin,
    strategy: 'premium',
    note: `Premium pricing: +${Math.round((selectedPrice/avgCompetitorPrice - 1) * 100)}% above avg`
  };
}
```

### Premium Requirements Check

```typescript
function canUsePremiumMode(account: AccountInfo): boolean {
  return (
    account.age >= 60 &&
    account.feedbackPercent >= 98 &&
    account.feedbackCount >= 100
  );
}
```

---

## Strategy 4: Dynamic Pricing

### Purpose
AI-adjusted pricing that changes daily based on competitor movements, demand signals, and inventory levels. Maintains minimum threshold while maximizing profit.

### Configuration

```typescript
interface DynamicPricingConfig {
  strategy: 'dynamic';
  
  // Thresholds
  minimumMargin: 15;       // Never go below 15%
  targetMargin: 25;        // Try to achieve 25%
  
  // Adjustment rules
  adjustments: {
    frequency: 'HOURLY',   // How often to check
    maxDailyChange: 10,    // Max 10% change per day
    
    // Increase price when:
    increaseWhen: {
      competitorsPriceHigher: true,
      lowInventory: true,
      highDemand: true
    };
    
    // Decrease price when:
    decreaseWhen: {
      competitorsPriceLower: true,
      noSalesIn48Hours: true,
      highInventory: true
    };
  };
  
  // Alerts
  alerts: {
    marginBelowThreshold: true,
    priceWarTriggered: true,
    competitorGone: true
  };
}
```

### Dynamic Pricing Algorithm

```typescript
interface PriceAdjustment {
  productId: string;
  currentPrice: number;
  newPrice: number;
  reason: string;
  marginAfter: number;
}

async function calculateDynamicPrice(
  product: Product,
  competitors: CompetitorPrice[],
  salesHistory: SaleRecord[]
): Promise<PriceAdjustment> {
  const currentPrice = product.ebayPrice;
  const amazonCost = product.amazonCost;
  
  // Get competitor landscape
  const lowestCompetitor = Math.min(...competitors.map(c => c.price));
  const avgCompetitor = average(competitors.map(c => c.price));
  
  // Calculate demand signals
  const recentSales = salesHistory.filter(s => 
    s.date > Date.now() - 7 * 24 * 60 * 60 * 1000
  );
  const salesVelocity = recentSales.length;
  
  let adjustment = 0;
  let reason = '';
  
  // Rule 1: If we're way above competitors, consider lowering
  if (currentPrice > avgCompetitor * 1.2) {
    adjustment = -5;  // Lower by 5%
    reason = 'Price significantly above competition';
  }
  
  // Rule 2: If no sales in 48 hours, lower price
  else if (recentSales.length === 0) {
    adjustment = -3;  // Lower by 3%
    reason = 'No recent sales';
  }
  
  // Rule 3: If selling well, try raising price
  else if (salesVelocity > 5) {
    adjustment = +2;  // Raise by 2%
    reason = 'High sales velocity';
  }
  
  // Rule 4: If competitors disappeared, raise price
  else if (competitors.length < 3) {
    adjustment = +5;
    reason = 'Few competitors';
  }
  
  // Calculate new price
  const newPrice = currentPrice * (1 + adjustment / 100);
  
  // Check margin
  const newMargin = calculateMargin(amazonCost, newPrice);
  
  // Enforce minimum
  if (newMargin < 15) {
    return {
      productId: product.id,
      currentPrice,
      newPrice: calculateMinPrice(amazonCost, 15),
      reason: 'At minimum margin threshold',
      marginAfter: 15
    };
  }
  
  return {
    productId: product.id,
    currentPrice,
    newPrice,
    reason,
    marginAfter: newMargin
  };
}
```

### Dynamic Pricing Alerts

```
⚠️ DYNAMIC PRICING ALERT
━━━━━━━━━━━━━━━━━━━━━━━━
Product: Apple AirPods Pro 2nd Gen
eBay ID: 123456789012
━━━━━━━━━━━━━━━━━━━━━━━━
Alert: Margin dropped below threshold!
Current Margin: 12%
Minimum Threshold: 15%
━━━━━━━━━━━━━━━━━━━━━━━━
Cause: Amazon price increased from $249 to $279
━━━━━━━━━━━━━━━━━━━━━━━━
Options:
1. Raise eBay price to $558 (15% margin)
2. Pause listing until Amazon price drops
3. Accept lower margin temporarily
```

---

## Strategy 5: Test & Compare Mode

### Purpose
Run A/B tests by listing the same product under different strategies. Track performance and scale the winner.

### Configuration

```typescript
interface TestModeConfig {
  strategy: 'test';
  
  // Test setup
  testStrategies: string[];  // ['volume', 'balanced', 'premium']
  duration: number;          // Days to run test
  productsPerStrategy: number;
  
  // Metrics to track
  metrics: [
    'sales_count',
    'revenue',
    'profit',
    'views',
    'conversion_rate'
  ];
  
  // Winner criteria
  winnerBy: 'profit' | 'sales' | 'roi';
  minDataPoints: 10;  // Minimum sales before declaring winner
}
```

### Test & Compare Workflow

```
1. SELECT PRODUCTS
   - Choose 9 identical products (3 per strategy)
   - Or 3 products to list with 3 different prices
   
2. ASSIGN STRATEGIES
   - Product A: Volume Mode (-15% below competitor)
   - Product B: Balanced Mode (-5% below competitor)
   - Product C: Premium Mode (+10% above competitor)
   
3. RUN TEST
   - Duration: 7-14 days
   - Track all metrics daily
   - No manual intervention
   
4. ANALYZE RESULTS
   - Compare sales, revenue, profit
   - Calculate ROI per strategy
   - Statistical significance check
   
5. DECLARE WINNER
   - Strategy with highest profit wins
   - Or highest ROI if tie
   
6. SCALE WINNER
   - Apply winning strategy to all products
   - Or apply to category
```

### Test Results Display

```
📊 TEST RESULTS - Wireless Earbuds Category
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 14 days
Products Tested: 9 (3 per strategy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Strategy    | Sales | Revenue | Profit | ROI
------------|-------|---------|--------|------
Volume      |   23  | $6,900  | $1,035 |  15%
Balanced    |   18  | $6,300  | $1,575 |  25%
Premium     |   12  | $5,400  | $1,890 |  35%  ★

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 WINNER: Premium Mode
   Reason: Highest profit despite fewer sales
   
Recommendation: Apply Premium pricing to 
                all Wireless Earbuds listings.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Apply Winner] [Run Another Test] [View Details]
```

---

## Account Warmup Dashboard

### Warmup Schedule

| Week | Daily Listings | Product Type | Price Strategy | Goal |
|------|----------------|--------------|----------------|------|
| 1-2 | 5 | Books only | HIGH (no sales) | Build history |
| 3 | 25 | Low-risk items | Balanced | First sales |
| 4 | 50 | Standard items | Balanced | Growth |
| 5 | 75 | All categories | Balanced | Scale |
| 6+ | 100 | All categories | Any | Full operation |

### Warmup Configuration

```typescript
interface WarmupConfig {
  enabled: boolean;
  accountCreatedDate: Date;
  currentWeek: number;
  
  schedule: {
    week1_2: {
      maxListings: 5,
      productTypes: ['books'],
      priceMultiplier: 3.0,  // 3x Amazon = intentionally high
      expectSales: false
    },
    week3: {
      maxListings: 25,
      productTypes: ['books', 'home', 'kitchen'],
      strategy: 'balanced'
    },
    week4: {
      maxListings: 50,
      productTypes: 'all',
      strategy: 'balanced'
    },
    week5: {
      maxListings: 75,
      productTypes: 'all',
      strategy: 'any'
    },
    week6plus: {
      maxListings: 100,
      productTypes: 'all',
      strategy: 'any'
    }
  };
}
```

### Warmup UI Component

```tsx
function WarmupTracker() {
  const { account, schedule, progress } = useWarmup();
  
  return (
    <div className="warmup-tracker">
      <h2>🌡️ Account Warmup</h2>
      
      <div className="account-info">
        <span>Account Age: {account.age} days</span>
        <span>Feedback: {account.feedbackCount} ({account.feedbackPercent}%)</span>
        <span>Trust Score: {account.trustScore}/100</span>
      </div>
      
      <div className="current-week">
        <h3>Week {schedule.currentWeek}</h3>
        <p>Max Listings: {schedule.maxListings}/day</p>
        <p>Product Types: {schedule.productTypes.join(', ')}</p>
      </div>
      
      <div className="today-progress">
        <h3>Today's Progress</h3>
        <ProgressBar 
          current={progress.listingsToday}
          max={schedule.maxListings}
        />
        <span>{progress.listingsToday}/{schedule.maxListings} listings</span>
      </div>
      
      <div className="warmup-timeline">
        {WARMUP_WEEKS.map(week => (
          <TimelineItem 
            key={week.number}
            week={week}
            isCurrent={week.number === schedule.currentWeek}
            isCompleted={week.number < schedule.currentWeek}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## eBay Trust Score Calculation

### Trust Score Components

```typescript
interface TrustScore {
  // Input metrics (0-100 normalized)
  accountAge: number;        // Days since creation
  feedbackPercent: number;   // Positive feedback %
  feedbackCount: number;     // Total feedback count
  salesVelocity: number;     // Sales per week
  returnRate: number;        // Returns / Total sales
  cancellationRate: number;  // Cancellations / Total orders
  defectRate: number;        // Defects / Total orders
  
  // Calculated score
  totalScore: number;        // 0-100
  tier: 'WARMUP' | 'CAUTIOUS' | 'NORMAL' | 'TRUSTED' | 'POWER';
}

function calculateTrustScore(metrics: AccountMetrics): TrustScore {
  // Normalize each component to 0-100
  const scores = {
    accountAge: Math.min(100, (metrics.accountAge / 365) * 100),
    feedbackPercent: metrics.feedbackPercent,
    feedbackCount: Math.min(100, (metrics.feedbackCount / 500) * 100),
    salesVelocity: Math.min(100, (metrics.weeklySales / 50) * 100),
    returnRate: Math.max(0, 100 - metrics.returnRate * 10),
    cancellationRate: Math.max(0, 100 - metrics.cancellationRate * 20),
    defectRate: Math.max(0, 100 - metrics.defectRate * 25)
  };
  
  // Weighted average
  const weights = {
    accountAge: 0.15,
    feedbackPercent: 0.25,
    feedbackCount: 0.15,
    salesVelocity: 0.15,
    returnRate: 0.10,
    cancellationRate: 0.10,
    defectRate: 0.10
  };
  
  const totalScore = Object.keys(scores).reduce((sum, key) => {
    return sum + scores[key] * weights[key];
  }, 0);
  
  // Determine tier
  let tier: TrustScore['tier'];
  if (totalScore < 20) tier = 'WARMUP';
  else if (totalScore < 40) tier = 'CAUTIOUS';
  else if (totalScore < 60) tier = 'NORMAL';
  else if (totalScore < 80) tier = 'TRUSTED';
  else tier = 'POWER';
  
  return { ...scores, totalScore, tier };
}
```

### Tier Permissions

| Tier | Score | Max Listings/Day | Strategies Available |
|------|-------|------------------|----------------------|
| WARMUP | 0-19 | 5 | Volume only |
| CAUTIOUS | 20-39 | 25 | Volume, Balanced |
| NORMAL | 40-59 | 50 | Volume, Balanced |
| TRUSTED | 60-79 | 75 | All strategies |
| POWER | 80-100 | 100 | All strategies |

---

## Cost Analysis Engine

### Fee Calculation

```typescript
interface CostBreakdown {
  // Inputs
  amazonCost: number;
  ebayPrice: number;
  
  // Fees
  ebayFinalValue: number;     // 12.9% of sale price
  paymentProcessing: number;  // 3% of sale price
  promotedListing?: number;   // If promoted (variable)
  
  // Totals
  totalFees: number;
  totalCost: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

function calculateCosts(amazonCost: number, ebayPrice: number): CostBreakdown {
  // Fee rates
  const EBAY_FEE_RATE = 0.129;      // 12.9%
  const PAYMENT_FEE_RATE = 0.03;    // 3%
  
  // Calculate fees
  const ebayFinalValue = ebayPrice * EBAY_FEE_RATE;
  const paymentProcessing = ebayPrice * PAYMENT_FEE_RATE;
  const totalFees = ebayFinalValue + paymentProcessing;
  
  // Calculate profit
  const totalCost = amazonCost + totalFees;
  const netProfit = ebayPrice - totalCost;
  
  // Calculate margins
  const grossMargin = ((ebayPrice - amazonCost) / ebayPrice) * 100;
  const netMargin = (netProfit / ebayPrice) * 100;
  
  return {
    amazonCost,
    ebayPrice,
    ebayFinalValue,
    paymentProcessing,
    totalFees,
    totalCost,
    netProfit,
    grossMargin,
    netMargin
  };
}
```

### Cost Analysis Display

```
💰 COST ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amazon Cost:            $249.00
eBay Listing Price:     $498.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FEES:
├── eBay Final Value (12.9%):   $64.24
├── Payment Processing (3%):    $14.94
├── Shipping (free):            $0.00
└── Total Fees:                 $79.18

PROFIT:
├── Gross Profit:               $249.00
├── After Fees:                 $169.82
├── Gross Margin:               50.0%
└── Net Margin:                 34.1%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ This product is PROFITABLE
   Break-even price: $295.26 (18% markup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## BulkLister Default: 2x Amazon Price

### Default Pricing Rule

```typescript
const DEFAULT_MARKUP = 2.0;  // Always default to 2x

function getListingPrice(amazonCost: number): number {
  // Step 1: Apply default markup
  let price = amazonCost * DEFAULT_MARKUP;
  
  // Step 2: Check strategy override
  const strategy = getActiveStrategy();
  
  if (strategy !== 'default') {
    price = calculateStrategyPrice(amazonCost, strategy);
  }
  
  // Step 3: Round to clean price
  price = roundToCleanPrice(price);
  
  return price;
}

function roundToCleanPrice(price: number): number {
  // Round to .99 endings
  if (price < 20) {
    return Math.ceil(price) - 0.01;  // $19.99
  } else if (price < 100) {
    return Math.round(price / 5) * 5 - 0.01;  // $24.99, $29.99
  } else {
    return Math.round(price / 10) * 10 - 0.01;  // $99.99, $199.99
  }
}
```

### Strategy Dashboard Overrides

```typescript
// When competitive sniping mode is active
interface CompetitiveSniperMode {
  enabled: boolean;
  targetBelowCompetitor: number;  // Percentage below lowest competitor
  minMargin: number;              // Minimum acceptable margin
  maxProducts: number;            // Max products to apply this to
  duration: number;               // Hours to maintain this pricing
}

async function applyCompetitiveSniper(config: CompetitiveSniperMode): Promise<void> {
  // Override default 2x pricing
  const products = await getActiveListings();
  
  for (const product of products.slice(0, config.maxProducts)) {
    const competitors = await getCompetitorPrices(product.id);
    const lowestPrice = Math.min(...competitors.map(c => c.price));
    
    const sniperPrice = lowestPrice * (1 - config.targetBelowCompetitor / 100);
    const margin = calculateMargin(product.amazonCost, sniperPrice);
    
    if (margin >= config.minMargin) {
      await updatePrice(product.id, sniperPrice);
      await logPriceChange(product, sniperPrice, 'competitive_sniper');
    }
  }
  
  // Schedule revert
  setTimeout(() => {
    revertToDefaultPricing();
  }, config.duration * 60 * 60 * 1000);
}
```

---

## Dashboard UI Design

### Main Strategy Dashboard Page

```tsx
function StrategyDashboard() {
  return (
    <div className="strategy-dashboard">
      <header>
        <h1>📊 Pricing Strategy</h1>
        <AccountTrustBadge />
      </header>
      
      <section className="strategy-selector">
        <h2>Active Strategy</h2>
        <StrategyCards 
          strategies={STRATEGIES}
          selected={activeStrategy}
          onSelect={setStrategy}
        />
      </section>
      
      <section className="warmup-section">
        <WarmupTracker />
      </section>
      
      <section className="cost-analyzer">
        <h2>Cost Calculator</h2>
        <CostCalculator />
      </section>
      
      <section className="performance">
        <h2>Strategy Performance</h2>
        <PerformanceChart data={performanceData} />
      </section>
      
      <section className="quick-actions">
        <h2>Quick Actions</h2>
        <button onClick={() => applyToAll(activeStrategy)}>
          Apply Strategy to All Listings
        </button>
        <button onClick={startABTest}>
          Start A/B Test
        </button>
        <button onClick={analyzeCompetitors}>
          Analyze Competitors
        </button>
      </section>
    </div>
  );
}
```

---

*Last Updated: 2024*
*Version: 1.0*
*Feature Phase: 4+*
