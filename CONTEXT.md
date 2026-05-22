# Syndrax Sync - Complete Codebase Documentation

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Tech Stack:** React 18 + TypeScript + Vite + Chrome Extension Manifest V3

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Services](#services)
5. [Content Scripts](#content-scripts)
6. [Pages (Popup UI)](#pages-popup-ui)
7. [Components](#components)
8. [Data Flow](#data-flow)
9. [APIs Used](#apis-used)
10. [Storage Schema](#storage-schema)
11. [Message Types](#message-types)
12. [What's Working](#whats-working)
13. [What's Broken/Incomplete](#whats-brokenincomplete)
14. [What Needs to Be Built](#what-needs-to-be-built)
15. [Security Concerns](#security-concerns)

---

## Project Overview

Syndrax Sync is a Chrome extension for **dropshipping automation** between eBay, Amazon, and AliExpress. It automates:

- **Inventory Scanning**: Scans eBay active listings, decodes SKU → ASIN
- **Price & Stock Sync**: Opens Amazon tabs, scrapes price/stock, updates eBay prices inline
- **Order Fulfillment**: Extracts eBay buyer addresses, auto-fills Amazon/AliExpress checkout
- **SEO Generation**: Uses Claude AI to generate optimized eBay titles/descriptions
- **Competitor Research**: Analyzes eBay sold listings for profit opportunities
- **Finance Reconciliation**: Matches eBay sold orders to Amazon purchases for profit tracking
- **Fingerprint Detection**: Detects ASIN hijacks, product changes, and variant mismatches
- **Discord Notifications**: Sends real-time webhooks for price updates, OOS, errors, daily summaries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION POPUP                       │
│  ┌─────────┬───────────┬───────────┬─────────┬─────────────┐   │
│  │Dashboard│ Orders    │ Inventory │ SEO AI  │ Finance     │   │
│  │         │Fulfillment│ Manager   │Generator│Reconcile    │   │
│  └─────────┴───────────┴───────────┴─────────┴─────────────┘   │
│              │                           │                      │
│              └───────────┬───────────────┘                      │
│                          ▼                                      │
│              ┌───────────────────────┐                         │
│              │   BACKGROUND SERVICE   │ ◄── Alarms (daily sync)│
│              │   (background-service) │                        │
│              └───────────────────────┘                         │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ chrome.runtime.sendMessage
                           ▼
   ┌───────────────────────────────────────────────────────────┐
   │                    CONTENT SCRIPTS                        │
   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
   │  │ eBay Pages  │ │Amazon Pages │ │  AliExpress Pages   │ │
   │  │ - extractor │ │ - scraper   │ │  - fulfillment      │ │
   │  │ - scanner   │ │ - price     │ │  - price checker    │ │
   │  │ - sync ctrl │ │ - fulfill   │ │                     │ │
   │  │ - listing   │ │             │ │                     │ │
   │  │ - finance   │ │             │ │                     │ │
   │  └─────────────┘ └─────────────┘ └─────────────────────┘ │
   └───────────────────────────────────────────────────────────┘
                           │
                           ▼
   ┌───────────────────────────────────────────────────────────┐
   │                    EXTERNAL APIS                          │
   │  ┌──────────────┐  ┌──────────────┐                      │
   │  │ Discord      │  │ Anthropic    │                      │
   │  │ Webhooks     │  │ Claude API   │                      │
   │  └──────────────┘  └──────────────┘                      │
   └───────────────────────────────────────────────────────────┘
```

---

## File Structure

```
syndrax-sync/
├── manifest.config.ts      # Chrome Extension Manifest V3 config
├── vite.config.ts          # Vite build config with @crxjs/vite-plugin
├── package.json            # Dependencies (React 18, TypeScript, Vite)
├── index.html              # Popup HTML entry point
│
├── public/
│   └── button1.mp3         # Audio feedback for automation clicks
│
├── src/
│   ├── main.tsx            # React entry point (HashRouter)
│   ├── App.tsx             # Main app with React Router
│   ├── PopupRoot.css       # Global styles (420x580px popup)
│   ├── vite-env.d.ts       # Vite type declarations
│   │
│   ├── background-service.ts    # Service Worker (1100 lines)
│   │
│   ├── config/
│   │   ├── webhooks.config.ts        # Discord webhook URLs (⚠️ SECRET)
│   │   ├── secrets.config.ts         # API secrets (gitignored)
│   │   ├── webhooks.config.example.ts # Template for webhooks
│   │   └── secrets.config.example.ts  # Template for secrets
│   │
│   ├── services/
│   │   ├── storage.ts           # Chrome storage wrapper
│   │   ├── messaging.ts         # Message type definitions
│   │   ├── ai.ts                # Anthropic Claude API
│   │   ├── fingerprint.ts       # ASIN hijack detection
│   │   ├── discord-logger.ts    # Discord webhook sender
│   │   └── sync-engine.ts       # Automated price sync
│   │
│   ├── content/
│   │   ├── ebay-order-extractor.ts     # eBay order pages
│   │   ├── ebay-inventory-scanner.ts   # eBay active listings
│   │   ├── ebay-sync-controller.ts     # Price/stock sync (2289 lines)
│   │   ├── ebay-listing-creator.ts     # Auto-fill new listings
│   │   ├── ebay-mesh-order-overlay.ts  # Order overlay UI
│   │   ├── amazon-fulfillment.ts       # Amazon checkout fill (1014 lines)
│   │   ├── amazon-price-checker.ts     # Amazon price scraper
│   │   ├── amazon-scraper.ts           # Amazon product scraper
│   │   ├── aliexpress-fulfillment.ts   # AliExpress checkout fill
│   │   ├── aliexpress-price-checker.ts # AliExpress price scraper
│   │   ├── competitor-research.ts      # eBay sold listings analyzer
│   │   ├── finance-ebay-scanner.ts     # eBay sold orders scanner
│   │   └── finance-ebay-payment.ts     # eBay payment details extractor
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── OrderFulfillment.tsx    # Order queue
│   │   ├── InventoryManager.tsx    # Inventory table
│   │   ├── SEOGenerator.tsx        # AI SEO tool
│   │   ├── CompetitorResearch.tsx  # Competitor analyzer
│   │   ├── FinanceReconciliation.tsx # Finance matching
│   │   └── Settings.tsx            # Configuration
│   │
│   ├── components/
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   └── DebugConsole.tsx        # Debug panel
│   │
│   └── features/
│       └── finance-reconciliation/
│           ├── types.ts            # Finance type definitions
│           └── parsers/
│               └── moneyParser.ts  # Currency parsing
```

---

## Services

### `storage.ts` - Chrome Storage Wrapper

**Purpose:** Abstracts `chrome.storage.local` with typed methods.

**Key Functions:**
- `get<T>(key)` / `set<T>(key, value)` - Generic storage operations
- `getOrders()` / `saveOrder(order)` - Order management
- `getInventory()` / `saveInventory(items)` - Inventory management
- `getSettings()` / `saveSettings(settings)` - App configuration
- `getApiKey()` / `saveApiKey(key)` - Anthropic API key
- `getActivityLog()` / `addActivity(msg, status)` - Activity logging
- `getCompetitors()` / `saveCompetitors(products)` - Competitor data
- `getLastSync()` / `updateLastSync()` - Sync timestamps

**Storage Keys:**
```typescript
const KEYS = {
  ORDERS: 'syndrax_orders',
  INVENTORY: 'syndrax_inventory',
  SETTINGS: 'syndrax_settings',
  COMPETITORS: 'syndrax_competitors',
  LAST_SYNC: 'syndrax_last_sync',
  API_KEY: 'syndrax_api_key',
  ACTIVITY_LOG: 'syndrax_activity',
  SYNC_LOG: 'syndrax_sync_log',
  AUTO_SYNC_ENABLED: 'syndrax_auto_sync'
};
```

---

### `messaging.ts` - Message Types

**Purpose:** Defines all message types for communication between popup, background, and content scripts.

**Message Types:**
```typescript
type MessageType =
  | 'EXTRACT_ORDER' | 'FULFILL_ORDER' | 'SCAN_INVENTORY' | 'START_SCAN'
  | 'CHECK_SUPPLIER' | 'UPDATE_LISTING' | 'GENERATE_SEO' | 'SCAN_COMPETITORS'
  | 'GET_STORAGE' | 'SET_STORAGE' | 'ADD_ACTIVITY'
  | 'ORDER_EXTRACTED' | 'FULFILLMENT_STATUS' | 'INVENTORY_SCANNED'
  | 'LISTING_CREATED' | 'PRODUCT_SCRAPED' | 'PRICE_CHECK_RESULT'
  | 'CHECK_PRICE' | 'RUN_PRICE_SYNC' | 'RUN_FULL_SYNC'
  | 'CHECK_SINGLE_PRICE' | 'GET_SYNC_STATS' | 'GET_LAST_SYNC_SESSION'
  | 'COMPETITORS_SCANNED' | 'PAGE_READY'
  | 'SCAN_PROGRESS' | 'SCAN_COMPLETE'
  | 'SYNC_STARTED' | 'SYNC_PROGRESS' | 'SYNC_COMPLETE'
  | 'AMAZON_PRICE_RESULT' | 'AMAZON_SCRAPE_RESULT' | 'CHECK_AMAZON_BATCH';
```

---

### `ai.ts` - Anthropic Claude API

**Purpose:** Generates optimized eBay listings using Claude claude-sonnet-4-20250514.

**Functions:**
- `getStoredApiKey()` - Gets API key from storage
- `generateEbayListing(productData)` - Returns `SEOResult` with title, description, price, keywords
- `validateApiKey(apiKey)` - Tests API connection

**API Endpoint:** `https://api.anthropic.com/v1/messages`

**Model:** `claude-sonnet-4-20250514`

---

### `fingerprint.ts` - ASIN Hijack Detection

**Purpose:** Detects product changes on Amazon by comparing fingerprints.

**Signals Tracked:**
```typescript
const SCORES = {
  ASIN_REDIRECT:          100,  // Product removed
  BRAND_CHANGED:           90,  // Different manufacturer
  DIMENSIONS_CHANGED:      85,  // Different size
  IMAGE_HASH_CHANGED:      80,  // New product photo
  WEIGHT_CHANGED:          80,  // Different weight
  KEYWORD_SIMILARITY_ZERO: 70,  // Description changed
  IMAGE_URL_CHANGED:       65,  // Photo updated
  CATEGORY_CHANGED:        60,  // Category changed
  REVIEWS_DROPPED_80PCT:   50,  // Hijack indicator
  VARIANT_CHANGED:         45,  // Size/color changed
  RATING_DROPPED_2PT:      30,  // Quality issues
  KEYWORD_SIMILARITY_LOW:  30,  // Minor changes
  IMAGE_COUNT_CHANGED:     25,  // Gallery changed
};
```

**Thresholds:**
- Score ≥ 80: **DELIST** (set eBay qty to 0)
- Score ≥ 50: **FLAG** (manual review needed)
- Score ≥ 30: **LOG** (monitor)
- Score < 30: **CLEAN** (no action)

**Main Function:**
- `checkFingerprint(item, amazonData)` → `{ action, score, signals, reasons }`

---

### `discord-logger.ts` - Discord Webhooks

**Purpose:** Sends real-time notifications to Discord channels.

**Webhook Channels:**
```typescript
const WEBHOOKS = {
  logs:           '...',  // General sync logs
  errors:         '...',  // Error alerts
  priceUpdates:   '...',  // Price changes
  outOfStock:     '...',  // OOS notifications
  variantAlerts:  '...',  // Variant detection
  fingerprintLog: '...',  // Fingerprint alerts
  dailySummary:   '...'   // Daily report
};
```

**Key Methods:**
- `discord.syncStarted(totalItems)` - Sync start notification
- `discord.syncComplete(stats)` - Summary with stats
- `discord.priceUpdated(item)` - Price change alert
- `discord.outOfStock(item)` - OOS with variant info
- `discord.variantDetected(item)` - Variant found
- `discord.fingerprintBaseline(item)` - First scan
- `discord.dailySummary(stats)` - Midnight report
- `pingAllWebhooks()` - Test all connections

---

### `sync-engine.ts` - Automated Price Sync

**Purpose:** Batch price/stock sync from eBay → Amazon → eBay.

**Constants:**
```typescript
const MARKUP_PERCENT = 100;     // 2x Amazon price
const CHANGE_THRESHOLD = 5;     // 5% minimum change
const SIMILARITY_THRESHOLD = 0.25; // Title match
const BATCH_SIZE = 3;           // Concurrent tabs
const BATCH_DELAY = 3000;       // 3s between batches
```

**Main Function:**
- `runFullSync()` → Opens Amazon tabs, scrapes prices, updates eBay

**Actions:**
- `NO_CHANGE` - Within threshold
- `PRICE_INCREASED` / `PRICE_DECREASED` - Updated price
- `OUT_OF_STOCK` - Set qty to 0
- `BACK_IN_STOCK` - Restore qty
- `WRONG_ITEM` - Title mismatch
- `SOURCE_NOT_FOUND` - No Amazon data
- `ERROR` - Processing failed

---

## Content Scripts

### `ebay-sync-controller.ts` (2289 lines) - **THE MAIN SYNC ENGINE**

**Injected on:** `ebay.com/sh/lst/*`, `ebay.com/mys/active*`

**Purpose:** Controls entire price sync from eBay page. Opens Amazon tabs in background, scrapes, updates prices inline.

**Key Features:**
- Floating control panel with Start/Stop/Pause buttons
- Daily scan memory (skip already-scanned items)
- Inline price/quantity editing via DOM manipulation
- Progress tracking with real-time log
- Discord webhook integration
- Variant detection and child ASIN storage

**Key Functions:**
- `scanCurrentPage()` - Extract listings from current page
- `runFullSync()` - Process all items on page
- `updatePriceInline(row, price)` - Click Edit button, fill price, submit
- `updateQuantityInline(row, qty)` - Click Edit button, fill quantity, submit
- `checkAmazonPriceAndStock(item)` - Open Amazon tab, scrape, close
- `sendSyncCompletionReport()` - Discord summary

**State Management:**
- `dailyScanMemory` - Tracks scanned items per day
- `currentSession` - Session statistics
- `stats` - Running totals

---

### `ebay-order-extractor.ts`

**Injected on:** `ebay.com/ord/*`, `ebay.com/sh/ord/*`

**Purpose:** Extracts buyer info from eBay order pages.

**Functions:**
- `scrapeOrderData()` - Returns buyer name, address, item details
- `extractOrder()` - Sends ORDER_EXTRACTED message
- `autoFulfill()` - Opens Amazon/AliExpress with search
- `copyAddress()` - Copies to clipboard

---

### `ebay-inventory-scanner.ts`

**Injected on:** `ebay.com/sh/lst/active*`

**Purpose:** Scans all eBay active listings.

**Functions:**
- `scanCurrentPage()` - Extract from table rows
- `scanAllPages()` - Paginate through all
- `decodeCustomLabel(sku)` - Base64 → ASIN
- `saveInventory(items)` - Merge with storage

**SKU Decoding:**
```
QjA4OVhWU1pNWQ== → atob() → B089XVSZMY (ASIN)
```

---

### `amazon-fulfillment.ts` (1014 lines)

**Injected on:** All Amazon pages

**Purpose:** Auto-fills Amazon checkout with eBay buyer address.

**Flow:**
1. Check for `pendingAmazonOrder` in storage
2. Click "Buy Now" button
3. Click "Change delivery address"
4. Click "Edit" on first address
5. Fill name, street, city, state, zip
6. **STOP** for manual review (safety)

**State Tracking:**
- Persists step progress across page navigations
- Retry mechanism (5 attempts)
- Profit overlay showing eBay earnings vs Amazon cost

**Amazon State Dropdown Handling:**
- Custom dropdown (not native `<select>`)
- Searches for state by abbreviation and full name

---

### `amazon-price-checker.ts` / `amazon-scraper.ts`

**Injected on:** Amazon product pages

**Purpose:** Scrapes price, stock, and product details.

**Scraped Data:**
```typescript
interface AmazonPriceData {
  asin: string;
  currentPrice: number;
  inStock: boolean;
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  title: string;
  brand: string;
  imageUrl: string;
  imageCount: number;
  category: string;
  dimensions: string;
  weight: string;
  reviewCount: number;
  starRating: number;
  bullets: string[];
  finalAsin: string;
}
```

**Variant Detection:**
- Detects size/color variants
- Extracts all variant ASINs with availability
- Finds best match based on eBay title keywords

---

### `aliexpress-fulfillment.ts`

**Injected on:** All AliExpress pages

**Purpose:** Auto-fills AliExpress checkout.

**Similar to Amazon fulfillment but with different selectors.**

---

### `competitor-research.ts`

**Injected on:** `ebay.com/sch/*` (sold listings)

**Purpose:** Analyzes sold listings for profit opportunities.

**Calculation:**
```typescript
estimatedCost = soldPrice * 0.5;
estimatedProfit = soldPrice - estimatedCost - (soldPrice * 0.13); // 13% eBay fees
profitPercent = (estimatedProfit / soldPrice) * 100;
```

---

### `finance-ebay-scanner.ts` / `finance-ebay-payment.ts`

**Injected on:** `ebay.com/mys/sold*`, `ebay.com/mesh/pmt/details*`

**Purpose:** Finance reconciliation - extracts sold orders and payment details.

**Extracted Payment Data:**
```typescript
interface EbayPaymentDetails {
  fundsStatus: 'Available' | 'Pending' | 'Hold';
  buyerSubtotal: number;
  buyerShipping: number;
  buyerSalesTax: number;
  buyerOrderTotal: number;
  transactionFees: number;
  orderEarnings: number; // NET after fees
}
```

---

## Pages (Popup UI)

### `Dashboard.tsx`

**Route:** `/dashboard`

**Features:**
- Stats cards: Listings, With ASIN, Out of Stock
- Sync progress bar during active sync
- Last sync summary
- Action buttons: Run Full Sync, Scan
- Activity log (recent 8 items)

---

### `OrderFulfillment.tsx`

**Route:** `/orders`

**Features:**
- Order cards from `syndrax_orders`
- Fulfill via Amazon or AliExpress
- Copy address button
- Mark complete button

---

### `InventoryManager.tsx`

**Route:** `/inventory`

**Features:**
- Sync controls with progress bar
- Sync results summary
- Filter by: All, With Source, No Source, In Stock, Out of Stock
- Search by title/ASIN/SKU
- Data table with images, prices, margin, status

---

### `SEOGenerator.tsx`

**Route:** `/seo`

**Features:**
- Product URL input
- AI generation via Claude
- Displays: title, description, price, keywords
- Copy buttons
- "Create Listing" opens eBay sell page

---

### `CompetitorResearch.tsx`

**Route:** `/competitors`

**Features:**
- Keyword search input
- Opens eBay sold listings search
- Displays results with profit %
- Sort by profit or price

---

### `FinanceReconciliation.tsx`

**Route:** `/finance`

**Features:**
- Scan controls: Current Year, Last Year, Custom
- Pause/Resume/Stop scan
- Export CSV/JSON
- Results table with eBay earnings, Amazon cost, net profit
- Status badges for each order

---

### `Settings.tsx`

**Route:** `/settings`

**Features:**
- Markup percentage slider (10-100%)
- Price change threshold
- Default supplier (Amazon/AliExpress)
- Daily sync time
- Anthropic API key input with test button
- Clear all data button

---

## Components

### `Sidebar.tsx`

Navigation with icons for each route:
- ⊞ Dashboard
- 📦 Orders
- 📊 Inventory
- ✨ SEO AI
- 🔍 Research
- 💼 Finance
- ⚙ Settings

### `DebugConsole.tsx`

Expandable debug panel at bottom of popup (not fully analyzed).

---

## Data Flow

### Price Sync Flow
```
1. User clicks "Run Full Sync" in popup
2. Dashboard.tsx sends GET_SYNC_STATS to background
3. Background returns inventory items with ASINs
4. User navigates to eBay listings page
5. ebay-sync-controller.ts activates
6. For each listing:
   a. Open Amazon tab (background)
   b. amazon-price-checker.ts scrapes price/stock
   c. Send AMAZON_SCRAPE_RESULT to background
   d. Background calls processDecision()
   e. If price changed: updatePriceInline() on eBay
   f. If OOS: updateQuantityInline(0) on eBay
   g. Discord webhook for each action
7. Send SYNC_COMPLETE to popup
8. Send sync completion report to Discord
```

### Order Fulfillment Flow
```
1. User on eBay order page
2. ebay-order-extractor.ts scrapes buyer address
3. User clicks "Fulfill → Amazon"
4. Save pendingAmazonOrder to storage
5. Open Amazon search URL
6. User navigates to product page
7. amazon-fulfillment.ts detects pendingAmazonOrder
8. Click Buy Now → Change Address → Edit
9. Fill all address fields
10. STOP for manual review
11. User clicks "Use this address" manually
```

---

## APIs Used

### 1. Anthropic Claude API
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Usage:** SEO title/description generation
- **Auth:** API key stored in `syndrax_api_key`

### 2. Discord Webhooks
- **7 separate channels** for different notification types
- **URLs stored** in `webhooks.config.ts` (⚠️ gitignored)

### 3. Chrome Extension APIs
- `chrome.storage.local` - Data persistence
- `chrome.tabs` - Open/close/update tabs
- `chrome.scripting` - Inject scripts
- `chrome.runtime.sendMessage` - Message passing
- `chrome.alarms` - Daily sync scheduling

---

## Storage Schema

```typescript
// Orders
syndrax_orders: Order[]

// Inventory (keyed by listingId)
syndrax_inventory: Record<string, InventoryItem>
syndrax_inventory_count: number
syndrax_last_scan: string (ISO date)

// Settings
syndrax_settings: Settings
syndrax_api_key: string
syndrax_auto_sync: boolean

// Activity
syndrax_activity: ActivityItem[]

// Sync
syndrax_sync_log: SyncSession[]
syndrax_last_sync: number (timestamp)
syndrax_daily_stats: object

// Competitors
syndrax_competitors: CompetitorProduct[]

// Finance
financeReconciliationRun: ScanRun
soldInventory: any[]

// Fingerprints
syndrax_fingerprints: Record<string, object>

// Daily Memory
dailyScanMemory: DailyScanMemory

// Sync State
syncState: SyncState

// Fulfillment
pendingFulfillment: object
pendingAmazonOrder: PendingAmazonOrder
autoOrderInProgress: boolean
pendingListing: object
```

---

## What's Working ✅

1. **eBay Inventory Scanning** - Extracts listings, decodes SKU → ASIN
2. **Amazon Price/Stock Scraping** - Gets price, title, availability
3. **Price Sync (ebay-sync-controller)** - Updates eBay prices inline
4. **Out of Stock Detection** - Sets eBay qty to 0
5. **Discord Notifications** - All webhook channels working
6. **Fingerprint Detection** - Captures baseline, detects changes
7. **Variant Detection** - Finds child ASINs for size/color variants
8. **Daily Scan Memory** - Skips already-scanned items
9. **Order Extraction** - Scrapes buyer info from eBay
10. **SEO Generation** - Claude API integration works
11. **Finance Scanning** - Extracts eBay sold orders and payments

---

## What's Broken/Incomplete ⚠️

### 1. ~~**sync-engine.ts vs ebay-sync-controller.ts Duplication**~~ ✅ FIXED (May 21, 2026)
- ~~Two separate sync implementations exist~~
- ~~`sync-engine.ts` tries to update via eBay edit pages (unreliable)~~
- ~~`ebay-sync-controller.ts` does inline editing (working)~~
- ~~The popup triggers `RUN_FULL_SYNC` which uses sync-engine.ts~~
- **FIX APPLIED:** Deleted sync-engine.ts, Dashboard now uses SyncSession types inline

### 2. **Amazon Fulfillment Safety Mode**
- Stops after filling address, requires manual click
- This is intentional for safety but may confuse users
- **FIX:** Add clearer UI instruction or optional auto-continue

### 3. **AliExpress Price Checker**
- File exists but not fully implemented
- **FIX:** Add price extraction selectors for AliExpress

### 4. **Finance Reconciliation Amazon Matching**
- eBay side works (scans sold orders, extracts payments)
- Amazon matching is not implemented (needs to scan Amazon order history)
- **FIX:** Add `finance-amazon-orders.ts` content script

### 5. **Webhook URLs Hardcoded**
- Discord URLs are in `webhooks.config.ts` with actual URLs
- Should be in `.gitignore` but file contains real secrets
- **FIX:** Move to environment variables or settings page

### 6. **eBay Session Expired Handling**
- No automatic detection of eBay logout
- Inline editing fails silently when logged out
- **FIX:** Add session check before sync

### 7. **Variant Re-routing Sometimes Fails**
- Complex variant products may not navigate correctly
- Child ASIN storage works but matching isn't always accurate
- **FIX:** Improve variant matching algorithm

### 8. **No Error Recovery**
- If a sync fails mid-way, no automatic retry
- Daily memory doesn't track failed items
- **FIX:** Add retry queue for failed items

### 9. **Settings Markup Not Used**
- Settings has markup slider but hardcoded 100% in sync
- **FIX:** Read from settings in sync engine

### 10. **No Multi-Account Support**
- Assumes single eBay/Amazon account
- **FIX:** Add account switcher or profile support

---

## What Needs to Be Built 🔨

### High Priority

1. **Unified Sync Trigger**
   - Remove duplicate sync-engine.ts
   - Dashboard button should navigate to eBay and trigger ebay-sync-controller

2. **Finance Amazon Matching**
   - Scan Amazon order history
   - Match by SKU/ASIN
   - Calculate actual profit

3. **Error Dashboard**
   - View failed items
   - One-click retry
   - Clear explanations

4. **Settings Integration**
   - Use markup % from settings
   - Use change threshold from settings
   - Use daily sync time for alarms

### Medium Priority

5. **Tracking Number Integration**
   - Extract from Amazon order confirmation
   - Auto-update eBay order

6. **Bulk Listing Creator**
   - Scrape Amazon product
   - Generate SEO title/description
   - Create eBay listing automatically

7. **Profit Dashboard**
   - Show total profit per day/week/month
   - Revenue vs costs chart
   - Top performing products

8. **Price History**
   - Track price changes over time
   - Show graphs per item

### Low Priority

9. **Multi-Account Support**
   - Profile selector
   - Separate inventories

10. **Webhook Customization**
    - User-configurable Discord URLs
    - Disable specific notification types

11. **AliExpress Full Support**
    - Price checking
    - Fulfillment
    - Listing sync

12. **Mobile-Friendly Popup**
    - Responsive design
    - Touch-friendly controls

---

## Security Concerns 🔒

1. **Discord Webhooks Exposed**
   - `webhooks.config.ts` contains real webhook URLs
   - Should be in `.gitignore` and loaded from user settings

2. **API Key Storage**
   - Anthropic key stored in plain text in chrome.storage
   - Consider encryption or secure vault

3. **No Rate Limiting**
   - Amazon scraping has no rate limits
   - Could trigger CAPTCHA or account suspension

4. **Permissions**
   - Host permissions for eBay, Amazon, AliExpress, Discord
   - No principle of least privilege

5. **Content Script Injection**
   - Injected on broad URL patterns
   - Could conflict with other extensions

---

## Development Commands

```bash
npm install    # Install dependencies
npm run dev    # Start dev server with hot reload
npm run build  # Build for production (dist folder)
```

Load in Chrome:
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select `dist` folder

---

## Key Files to Edit

| Feature | File(s) |
|---------|---------|
| Price Sync | `ebay-sync-controller.ts` |
| Amazon Scraping | `amazon-price-checker.ts` |
| Order Fulfillment | `amazon-fulfillment.ts` |
| Discord Notifications | `discord-logger.ts` |
| Storage | `storage.ts` |
| Settings | `pages/Settings.tsx` |
| Fingerprint Detection | `services/fingerprint.ts` |
| Finance | `finance-ebay-scanner.ts`, `FinanceReconciliation.tsx` |

---

## EcomFlow-1 Feature Comparison (Missing Features)

### Features syndrax-sync DOES NOT HAVE (from ecomflow-1)

#### 1. Amazon Product Overlay (`amazon-product-overlay.ts`)
**Location in ecomflow-1:** `src/content/amazon-product-overlay.ts` (361 lines)  
**Injected on:** All Amazon product pages (`/dp/`, `/gp/product/`)  
**Purpose:** Creates floating buttons on Amazon product pages

**Technical Implementation:**
```typescript
// Creates fixed overlay on Amazon product pages
function createOverlayButton() {
  const overlay = document.createElement('div');
  overlay.id = 'ecomflow-amazon-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    z-index: 99999;
    background: #1a1a2e;
    padding: 16px;
    border-radius: 12px;
  `;
  
  // "Find on eBay" button - opens eBay sold search
  const findButton = document.createElement('button');
  findButton.textContent = '🔍 Find on eBay';
  findButton.onclick = () => {
    const product = extractProductInfo();
    chrome.runtime.sendMessage({
      type: 'findOnEbayByImage',
      imageUrl: product.mainImage,
      productData: product
    });
  };
  
  // "Research Item" button - opens competitor research
  const researchButton = document.createElement('button');
  researchButton.textContent = '📊 Research Item';
  researchButton.onclick = () => {
    chrome.storage.local.set({ researchProduct: extractProductInfo() });
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html#/competitor-research') });
  };
}

function extractProductInfo() {
  return {
    asin: extractASIN(),
    title: document.querySelector('#productTitle')?.textContent?.trim(),
    price: extractPrice(),
    mainImage: document.querySelector('#landingImage')?.src,
    brand: document.querySelector('#bylineInfo')?.textContent,
    features: [...document.querySelectorAll('#feature-bullets li')].map(li => li.textContent)
  };
}
```

**To Add to syndrax-sync:** Create `src/content/amazon-product-overlay.ts`

---

#### 2. Bulk Lister Page (`BulkLister.tsx`)
**Location in ecomflow-1:** `src/pages/BulkLister.tsx` (394 lines)  
**Purpose:** Paste multiple Amazon URLs, bulk create eBay listings

**Technical Implementation:**
```typescript
// State management
const [links, setLinks] = useState(''); // Amazon URLs textarea
const [automationInProgress, setAutomationInProgress] = useState(false);

// Parse and process URLs
function handleOptiList() {
  const urls = links.split('\n').filter(url => url.includes('amazon.com'));
  
  // Store in chrome.storage for content scripts
  await chrome.storage.local.set({
    automationInProgress: true,
    automationType: 'opti',
    pendingUrls: urls
  });
  
  // Open Amazon tabs with delay
  for (let i = 0; i < urls.length; i++) {
    await delay(2000);
    chrome.tabs.create({ url: urls[i], active: false });
  }
}
```

**Data Flow:**
1. User pastes Amazon URLs in textarea
2. Click "Opti-List" → stores URLs in chrome.storage
3. Opens Amazon tabs with 2s delay each
4. amazon-scraper.ts content script auto-scrapes each product
5. Sends `amazonDataScraped` message to background
6. Background opens eBay, sends `startEbayListing` to ebay-automation.ts
7. ebay-automation.ts auto-fills listing form

**To Add to syndrax-sync:** Create `src/pages/BulkLister.tsx`

---

#### 3. Product Hunter Page (`ProductHunter.tsx`)
**Location in ecomflow-1:** `src/pages/ProductHunter.tsx` (252 lines)  
**Purpose:** Search and filter products for potential listing

**Note:** Mostly placeholder - buttons not implemented in ecomflow-1

---

#### 4. Competitor Research Scanner (`competitor-research.ts`)
**Location in ecomflow-1:** `src/content/competitor-research.ts` (1141 lines)  
**Injected on:** eBay seller pages (`/usr/*`, `/str/*`, `/sch/*/m.html*`)  
**Purpose:** Scans seller stores for sold items

**Technical Implementation:**
```typescript
// Detects if on seller page
function isSellerPage(): boolean {
  return window.location.href.includes('/usr/') || 
         window.location.href.includes('/str/') ||
         window.location.href.includes('/sch/') && window.location.href.includes('/m.html');
}

// Creates floating "Scan Store" button
function createSellerOverlay() {
  const overlay = document.createElement('div');
  overlay.innerHTML = `
    <button id="scanStoreBtn">🔍 Scan Store</button>
  `;
  
  document.getElementById('scanStoreBtn').onclick = () => {
    const username = extractUsername();
    // Redirect to sold items page
    window.location.href = `https://www.ebay.com/sch/i.html?_ssn=${username}&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=200`;
  };
}

// Scans sold items page
async function scanCurrentPage() {
  const items = document.querySelectorAll('.su-card-container__content, .s-item');
  const products = [];
  
  for (const item of items) {
    products.push({
      title: item.querySelector('.su-styled-text.primary')?.textContent,
      price: extractPrice(item.querySelector('.s-card__price')),
      soldDate: extractSoldDate(item),
      imageUrl: item.querySelector('img')?.src,
      link: item.querySelector('a')?.href
    });
  }
  
  // Send to background
  chrome.runtime.sendMessage({
    type: 'competitorScanResults',
    products,
    username: extractUsername()
  });
}
```

**To Add to syndrax-sync:** Already has `competitor-research.ts` but missing the overlay buttons

---

#### 5. eBay Sold Items Scanner with Overlays (`ebay-sold-items-scanner.ts`)
**Location in ecomflow-1:** `src/content/ebay-sold-items-scanner.ts` (480 lines)  
**Injected on:** eBay search results (sold items)  
**Purpose:** Adds action buttons to each sold item

**Technical Implementation:**
```typescript
// Injects overlay on each sold item
function createSoldItemOverlay(item: Element) {
  const overlay = document.createElement('div');
  overlay.className = 'ecomflow-item-overlay';
  overlay.innerHTML = `
    <button class="auto-purchase-btn">🛒 Auto-Purchase</button>
    <button class="find-amazon-btn">📦 Find Amazon</button>
    <button class="details-btn">🔍 Details</button>
  `;
  
  overlay.querySelector('.auto-purchase-btn').onclick = () => {
    const title = item.querySelector('.s-item__title')?.textContent;
    chrome.storage.local.set({ autoPurchaseItem: { title } });
    window.open(`https://www.amazon.com/s?k=${encodeURIComponent(title)}`);
  };
  
  overlay.querySelector('.find-amazon-btn').onclick = () => {
    const title = item.querySelector('.s-item__title')?.textContent;
    window.open(`https://www.amazon.com/s?k=${encodeURIComponent(title)}`);
  };
  
  item.appendChild(overlay);
}
```

**To Add to syndrax-sync:** Extend existing content scripts

---

#### 6. eBay Automation (Listing Form Fill) (`ebay-automation.ts`)
**Location in ecomflow-1:** `src/content/ebay-automation.ts` (1076 lines)  
**Injected on:** eBay sell pages (`/sl/sell`, `/sh/sell`)  
**Purpose:** Auto-fills new listing form from scraped Amazon data

**Technical Implementation:**
```typescript
// Listens for trigger from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'startEbayListing') {
    const { productData } = msg;
    autoFillListingForm(productData);
  }
});

async function autoFillListingForm(product) {
  // Step 1: Search for product
  const searchBox = document.querySelector('.se-search-box input');
  searchBox.value = product.searchTitle;
  searchBox.dispatchEvent(new Event('input', { bubbles: true }));
  
  await delay(2000);
  
  // Step 2: Click "Continue without match"
  const continueBtn = document.querySelector('button.prelist-radix__next-action');
  continueBtn?.click();
  
  await delay(2000);
  
  // Step 3: Select "New" condition
  const newCondition = document.querySelector('input[value="1000"]');
  newCondition?.click();
  
  await delay(1000);
  
  // Step 4: Fill title
  const titleInput = document.querySelector('input[name*="title"]');
  titleInput.value = product.title.substring(0, 80);
  
  // Step 5: Fill price (with markup)
  const priceInput = document.querySelector('input[name*="price"]');
  priceInput.value = (product.price * 2).toFixed(2); // 100% markup
  
  // Step 6: Fill description
  const descInput = document.querySelector('textarea[name*="description"]');
  descInput.value = product.features.join('\n');
}
```

**To Add to syndrax-sync:** Create or enhance `ebay-listing-creator.ts`

---

#### 7. Automation Commands (`automation-commands.ts`)
**Location in ecomflow-1:** `src/content/automation-commands.ts` (409 lines)  
**Purpose:** Generic DOM automation utilities

**Technical Implementation:**
```typescript
// Click with human-like delay
async function autoClick(selector: string, timeout = 5000): Promise<boolean> {
  const element = await waitForElement(selector, timeout);
  if (!element) return false;
  
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(100 + Math.random() * 200);
  element.click();
  return true;
}

// Type with human-like speed
async function autoType(selector: string, text: string, speed = 50): Promise<boolean> {
  const element = await waitForElement(selector, 5000);
  if (!element) return false;
  
  element.focus();
  for (const char of text) {
    element.value += char;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(speed + Math.random() * 30);
  }
  return true;
}

// Wait for element to appear
function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Scroll with smooth animation
async function autoScroll(direction: 'up' | 'down', distance = 500): Promise<void> {
  window.scrollBy({
    top: direction === 'down' ? distance : -distance,
    behavior: 'smooth'
  });
  await delay(500);
}
```

**To Add to syndrax-sync:** Create `src/content/automation-commands.ts`

---

### Architecture Comparison

| Component | syndrax-sync Location | ecomflow-1 Location | Difference |
|-----------|----------------------|---------------------|------------|
| Background Service | `src/background-service.ts` | `src/background-service.ts` | Similar structure |
| Message Types | `src/services/messaging.ts` | Inline in files | syndrax-sync better organized |
| Storage | `src/services/storage.ts` | `chrome.storage` direct | syndrax-sync has wrapper |
| Amazon Overlay | ❌ Missing | `src/content/amazon-product-overlay.ts` | Need to port |
| Bulk Lister | ❌ Missing | `src/pages/BulkLister.tsx` | Need to port |
| Competitor Scanner | `src/content/competitor-research.ts` | `src/content/competitor-research.ts` | Different features |
| eBay Form Fill | `src/content/ebay-listing-creator.ts` | `src/content/ebay-automation.ts` | Need to merge |
| Sold Item Overlays | ❌ Missing | `src/content/ebay-sold-items-scanner.ts` | Need to port |
| Auto Commands | ❌ Missing | `src/content/automation-commands.ts` | Need to port |
| Order Extractor | `src/content/ebay-order-extractor.ts` | `src/content/ebay-order-extractor.ts` | Similar |
| Price Sync | `src/content/ebay-sync-controller.ts` | ❌ Missing | syndrax-sync exclusive |
| Discord Webhooks | `src/services/discord-logger.ts` | ❌ Missing | syndrax-sync exclusive |
| Fingerprint | `src/services/fingerprint.ts` | ❌ Missing | syndrax-sync exclusive |
| AI SEO | `src/services/ai.ts` | ❌ Missing | syndrax-sync exclusive |

---

### Files to Port from ecomflow-1 to syndrax-sync

1. **`amazon-product-overlay.ts`** - Add overlay buttons on Amazon
2. **`automation-commands.ts`** - Generic automation utilities
3. **`ebay-sold-items-scanner.ts`** - Per-item action buttons
4. **`BulkLister.tsx`** - Bulk listing UI page

### Manifest Changes Needed

Add to `manifest.config.ts` content_scripts:
```typescript
{
  matches: ["https://www.ebay.com/usr/*", "https://www.ebay.com/str/*"],
  js: ["src/content/competitor-store-overlay.ts"],
  run_at: "document_end"
}
```
