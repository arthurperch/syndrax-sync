# SYNDRAX SYNC - COMPLETE BUSINESS VISION

## Executive Summary

Syndrax Sync is a Chrome extension that automates eBay dropshipping from Amazon. The system discovers profitable products on Amazon, verifies them against compliance rules, finds matching eBay dropshippers to model after, matches product DNA using AI vision, optimizes SEO, bulk lists products, and manages ongoing operations including price monitoring, stock alerts, order fulfillment, and financial reconciliation.

**Target: 100 listings/day with 15%+ net margin and zero VERO violations.**

---

## Core Business Model

### Revenue Flow
```
Customer buys on eBay ($30)
→ You buy from Amazon ($15)
→ Amazon ships directly to customer
→ You keep the difference minus fees
→ Net profit per sale: $2-5 (15-25% margin)
```

### Why This Works
1. **Amazon has everything** - Unlimited product catalog with Prime shipping
2. **eBay has buyers** - Different audience, different search behavior
3. **Price arbitrage exists** - Same product, different platforms, different prices
4. **Automation scales** - One person can manage 10,000+ listings with software

---

## 7-Phase Pipeline Architecture

### Phase 1: Amazon Product Discovery
**Purpose:** Find products worth listing on eBay

**Implementation:**
- Floating icon overlay appears on Amazon search results pages
- Click icon to add product to research queue
- Captures: ASIN, title, price, images, reviews, Prime eligibility, seller info
- Products stored in `research_queue.csv` for processing

**Entry Criteria:**
- Product has Prime shipping (required)
- Price range $10-$100 (sweet spot for dropshipping)
- In-stock with reliable seller
- Not already in our listings

### Phase 1B: Compliance Filters (7 Risk Filters)
**Purpose:** Block or flag risky products before wasting time on them

| Filter | Default State | Threshold | Action |
|--------|---------------|-----------|--------|
| High Return Rate | ON | >15% | BLOCK |
| Low Reviews | OFF | <50 reviews | FLAG only |
| Fragile/Liquid | ON | Detection keywords | BLOCK |
| Electronics | ON | Category detection | FLAG only |
| Frequent Damage | ON | >10% damage reports | BLOCK |
| VERO Brands | ALWAYS ON | Brand list match | BLOCK |
| Banned Items | ALWAYS ON | Category/keyword match | BLOCK |

**Blocked products:** Logged to `filtered_out.csv` with reason and timestamp

### Phase 2: eBay Reverse Search
**Purpose:** Find existing eBay dropshippers selling the same Amazon products

**Implementation:**
- Upload Amazon product image to eBay image search
- Floating icons appear above each search result:
  - **Scan Store** button - Scans entire seller's store for dropshipped products
  - **Add Username** button - Adds seller to dropshippers.csv for tracking
- Identifies sellers who are already successfully dropshipping

### Phase 3: Dropshipper Verification (Seller Gates)
**Purpose:** Only follow proven, successful dropshippers

**Verification Criteria (ALL must pass):**
| Gate | Requirement | Why |
|------|-------------|-----|
| Units Sold | Minimum threshold | Proves demand exists |
| Account Age | 30+ days | Not a flash-in-pan |
| Feedback Score | 95%+ positive | Quality seller |
| Amazon Match Rate | 70%+ of their products | Confirms they dropship |

**Output:** Verified sellers added to `dropshippers.csv` with confidence score

### Phase 4: Product DNA Matching (Claude Vision AI)
**Purpose:** Verify Amazon product exactly matches eBay listing using AI

**How It Works:**
1. Extract "Product DNA" from both images:
   - Brand name
   - Model number
   - Materials
   - Specifications
   - Visual features
2. Compare DNA profiles (not raw pixels)
3. Generate confidence score

**Match Tiers:**
| Score | Classification | Action |
|-------|----------------|--------|
| 95-100% | EXACT MATCH | Auto-approve for listing |
| 80-94% | VARIANT | Flag for review (color/size differs) |
| 60-79% | SIMILAR | Manual review required |
| <60% | NO MATCH | Reject, do not list |

### Phase 5: SEO Intelligence
**Purpose:** Create optimized titles that rank on eBay search

**Process:**
1. Analyze top 10 competitor listings for the product
2. Extract winning keywords and patterns
3. Identify title structure that ranks
4. Generate new title that:
   - Uses proven keywords
   - Does NOT copy competitor titles directly
   - Stays under 80 characters
   - Front-loads important keywords
   - Includes brand, model, key features

**Example Title Generation:**
```
Competitor Analysis:
- "Apple AirPods Pro 2nd Gen Wireless Earbuds with MagSafe Case"
- "Apple AirPods Pro 2 Noise Cancelling Bluetooth Earbuds NEW"
- "Genuine Apple AirPods Pro Gen 2 USB-C Wireless Earphones"

Generated Title (remixed, not copied):
"Apple AirPods Pro 2nd Generation MagSafe USB-C Wireless Earbuds NEW"
```

### Phase 6: Bulk Listing (BulkLister)
**Purpose:** Create eBay listings at scale

**Batch Processing:**
- Process 3 items at a time (rate limiting protection)
- Scrape full Amazon product data
- Generate optimized title + description
- Calculate price (default: 2x Amazon price)
- Download and optimize images
- Upload to eBay via API or automation

**Rate Limits:**
- Respect eBay API limits
- 2-second delay between listings
- Max 100 listings per day per account

**Output:** Created listings logged to `listings_created.csv`

### Phase 7: Ongoing Management
**Purpose:** Maintain listings and handle orders

**Automated Tasks:**
| Task | Frequency | Action |
|------|-----------|--------|
| Price Monitoring | Hourly | Check Amazon price changes, adjust eBay price |
| Stock Monitoring | Daily | Check Amazon availability, pause listing if OOS |
| Order Fulfillment | On order | Auto-purchase from Amazon with customer address |
| Tracking Updates | On ship | Update eBay with Amazon tracking number |
| Finance Reconciliation | Daily | Match orders, calculate profit, update reports |

---

## Agent Architecture

### Multi-Agent System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNDRAX SYNC SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐      ┌─────────────────────────┐   │
│  │     HERMES AGENT    │      │      CLINE AGENT        │   │
│  │   (VPS - Vultr)     │◄────►│   (Local - Windows)     │   │
│  │                     │      │                         │   │
│  │ • Task execution    │      │ • Code implementation   │   │
│  │ • Browser automation│      │ • Bug fixes             │   │
│  │ • Monitoring        │      │ • Feature development   │   │
│  │ • Discord reporting │      │ • Build verification    │   │
│  └─────────────────────┘      └─────────────────────────┘   │
│           │                              │                  │
│           └──────────┬───────────────────┘                  │
│                      ▼                                      │
│           ┌─────────────────────┐                           │
│           │   DISCORD SERVER    │                           │
│           │   (Syndrax Logs)    │                           │
│           │                     │                           │
│           │ • Webhooks          │                           │
│           │ • Task coordination │                           │
│           │ • Status reports    │                           │
│           └─────────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Hermes Agent (VPS Worker)
**Location:** Vultr VPS ($6/month)
**OS:** Ubuntu 22.04
**IP:** 45.77.213.149
**Role:** Task executor, browser automation, monitoring

**Model Hierarchy:**
| Model | Provider | Use Case | Cost |
|-------|----------|----------|------|
| llama3.1:8b-instruct | Ollama Local | Simple tasks, quick responses | Free |
| qwen2.5-coder:7b | Ollama Local | Code analysis, simple fixes | Free |
| claude-haiku-4-5 | OpenRouter | Agent tasks, decision making | $0.25/1M input |
| claude-sonnet-4-6 | OpenRouter | Complex reasoning, >10 tool calls | $3/1M input |

**Model Switching Rules:**
- Start with haiku for all tasks
- Switch to sonnet if: >10 tool calls OR >5 files simultaneously
- Always revert to haiku after complex task completes
- Log model usage to HERMES_LOG.md

### Cline Agent (Local Developer)
**Location:** Local Windows machine
**Role:** Code implementation, bug fixes, feature development

**Model Hierarchy:**
| Model | Provider | Use Case |
|-------|----------|----------|
| qwen2.5-coder:7b | Ollama Local | Code implementation |
| claude-sonnet-4-6 | Anthropic | Hard problems, architecture |

**Build Rules:**
- Run `npm run build` after EVERY code change
- Report build pass/fail to Discord
- Never commit broken builds
- 3 consecutive clean builds = send completion message

---

## Technology Stack

### Frontend (Chrome Extension)
```typescript
const techStack = {
  framework: "React 18",
  language: "TypeScript 5.x",
  bundler: "Vite 5.x",
  manifest: "Chrome MV3",
  styling: "CSS Modules / Tailwind",
  state: "React Context + localStorage"
};
```

### Backend Services
```typescript
const services = {
  ai: {
    vision: "Claude Vision API (claude-haiku-4-5)",
    reasoning: "Claude claude-sonnet-4-6 for complex tasks",
    local: "Ollama (llama3.1, qwen2.5-coder)"
  },
  notifications: "Discord Webhooks",
  browser: "Chrome DevTools Protocol (CDP)",
  hosting: "Vultr VPS Ubuntu 22.04"
};
```

### APIs Used
| Service | Purpose | Cost |
|---------|---------|------|
| eBay Browse API | Search listings | Free |
| eBay Sell API | Create listings | Free |
| Amazon Product API | Get product data | Free (scraping) |
| OpenRouter | Claude models | Pay per token |
| Discord | Webhooks | Free |
| Replicate | Image generation | $0.01-0.03/image |

---

## Success Metrics

### Primary KPIs
| Metric | Target | Why |
|--------|--------|-----|
| Listings/Day | 100 | Scale to profitability |
| Net Margin | 15%+ | Cover all costs + profit |
| VERO Violations | 0 | Account protection |
| Sell-Through Rate | 5%+ | Inventory efficiency |

### Secondary KPIs
| Metric | Target |
|--------|--------|
| Product Match Accuracy | 95%+ |
| Compliance Filter Catch Rate | 99%+ |
| Order Fulfillment Time | <4 hours |
| Price Update Latency | <1 hour |

---

## Account Warmup System

### The Problem
New eBay accounts that list 100 items immediately get flagged and suspended. eBay's algorithm watches for unusual activity.

### The Solution: Gradual Warmup

**Phase 1: Trust Building (Weeks 1-2)**
```
Strategy: List 5 books per day
Price: HIGH (intentionally above market)
Goal: NO SALES - just building listing history
Products: Used books from Amazon Warehouse
Why: Books are low-risk, never VERO, establish account legitimacy
```

**Phase 2: Scaling (Week 3+)**
```
Week 3: 25 listings/day
Week 4: 50 listings/day
Week 5: 75 listings/day
Week 6+: 100 listings/day
```

### Trust Score Calculation
```typescript
interface TrustScore {
  accountAge: number;       // Days since account creation
  feedbackPercent: number;  // 0-100%
  salesVelocity: number;    // Sales per week
  returnRate: number;       // Returns / Total sales
  cancellationRate: number; // Cancellations / Total orders
  
  // Calculated: 0-100 score
  totalScore: number;
}

// Tier Thresholds
const tiers = {
  warmup: { maxListings: 5, minScore: 0 },
  cautious: { maxListings: 25, minScore: 20 },
  normal: { maxListings: 50, minScore: 40 },
  trusted: { maxListings: 75, minScore: 60 },
  power: { maxListings: 100, minScore: 80 }
};
```

---

## Full Cost Model

### Revenue Calculation Example

**Scenario: $30 eBay sale price, $15 Amazon cost**

```
GROSS REVENUE
eBay Sale Price:                    $30.00

COSTS (subtracted from gross)
Amazon Product Cost:                $15.00
eBay Final Value Fee (12.9%):       $3.87
Payment Processing Fee (3%):        $0.90
Shipping (included in price):       $0.00
State Sales Tax (varies):           $0.00*

TOTAL COSTS:                        $19.77

NET PROFIT:                         $10.23
NET MARGIN:                         34.1%
```

*State sales tax collected from buyer, remitted separately

### Fee Breakdown

| Fee Type | Rate | Applied To |
|----------|------|------------|
| eBay Final Value Fee | 12.9% | Total sale price |
| eBay Payment Processing | 3% | Total sale price (Managed Payments) |
| Amazon Prime | $0 | Included in subscription |
| Shipping to Customer | $0 | Free with Prime |

### Margin Requirements by Strategy

| Strategy | Min Margin | Target Margin | Pricing |
|----------|------------|---------------|---------|
| Volume Mode | 10% | 10-15% | -15% below competitors |
| Balanced Mode | 20% | 20-25% | -5% below competitors |
| Premium Mode | 30% | 30-35% | +5-15% above competitors |

### Break-Even Analysis
```
Minimum viable margin: 15.9% (eBay 12.9% + Processing 3%)
This means: Amazon price must be < 84.1% of eBay price
Example: If eBay price is $30, Amazon must be < $25.23

For 15% net profit:
Amazon price must be < 69.1% of eBay price
Example: If eBay price is $30, Amazon must be < $20.73
```

### Default Pricing Formula
```typescript
const calculateListingPrice = (amazonPrice: number): number => {
  // Default: 2x Amazon price
  // Guarantees ~50% gross margin, ~34% net margin
  return amazonPrice * 2;
};

// With markup override from Settings
const calculateWithMarkup = (amazonPrice: number, markup: number): number => {
  return amazonPrice * markup; // e.g., 1.5x, 2x, 2.5x
};
```

---

## Data Storage Architecture

### CSV Files

| File | Purpose | Key Fields |
|------|---------|------------|
| `dropshippers.csv` | Verified eBay sellers | username, feedback%, products_count, amazon_match_rate |
| `research_queue.csv` | Products to research | asin, title, price, source_url, added_date |
| `filtered_out.csv` | Blocked products | asin, title, filter_reason, blocked_date |
| `listings_created.csv` | Active listings | ebay_id, asin, title, price, created_date, status |
| `orders.csv` | Order history | order_id, ebay_id, amazon_order, profit, date |

### Local Storage (Chrome Extension)
```typescript
interface StorageSchema {
  settings: {
    markup: number;
    autoFulfill: boolean;
    filters: FilterConfig;
    webhooks: WebhookConfig;
  };
  session: {
    currentScan: ScanSession;
    researchQueue: AmazonProduct[];
  };
  history: {
    scans: ScanHistory[];
    listings: ListingHistory[];
  };
}
```

---

## Risk Mitigation

### Account Protection
1. **Warmup period enforced** - Cannot list 100 items day 1
2. **VERO filter always on** - Zero tolerance for brand violations
3. **Rate limiting built-in** - Never trigger eBay's velocity flags
4. **Multiple accounts strategy** - Don't put all eggs in one basket

### Financial Protection
1. **Minimum margin enforcement** - Never list below threshold
2. **Price monitoring hourly** - Catch Amazon price increases fast
3. **Stock monitoring daily** - Don't sell unavailable items
4. **Daily reconciliation** - Catch discrepancies immediately

### Technical Protection
1. **Build verification** - Never deploy broken code
2. **Debug mode** - Test at 50% speed with delays
3. **Discord alerts** - Real-time visibility into issues
4. **Logging everywhere** - Full audit trail

---

## Future Roadmap

### Phase 1: MVP (Current)
- ✅ Basic extension structure
- ✅ eBay order extraction
- ✅ Finance tracking
- 🔄 Bug fixes (Sprint 2-4)

### Phase 2: Research Tools
- Amazon product discovery overlay
- eBay seller scanning
- Product DNA matching

### Phase 3: Automation
- BulkLister implementation
- Auto-fulfillment
- Price/stock monitoring

### Phase 4: Intelligence
- Strategy dashboard
- Dynamic pricing
- Performance analytics

### Phase 5: Scale
- Multi-account management
- Inventory optimization
- AI image generation

---

## Contact & Resources

**Discord Server:** Syndrax Logs
**GitHub:** (private repository)
**Documentation:** This file + PIPELINE.md, COMPLIANCE.md, etc.

---

*Last Updated: 2024*
*Version: 1.0*
*Author: Syndrax Sync Team*
