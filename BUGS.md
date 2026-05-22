# SYNDRAX SYNC — Full Codebase Bug Report

Generated from complete audit of `/c/hermes-workspace/syndrax-sync/src/`

---

## 1. PROJECT ARCHITECTURE

A Manifest V3 Chrome extension built with React 18 + TypeScript + Vite + CRXJS. Automates dropshipping by syncing eBay listings to Amazon/AliExpress suppliers — auto-pricing, stock monitoring, order fulfillment, finance reconciliation, and Discord logging.

**Tech Stack:** React 18, TypeScript 5.x, Vite 6.x, CRXJS Vite Plugin, Claude AI (Sonnet 4)

**File count:** 30+ source files across 5 logical modules.

---

## 2. APP SHELL (4 files)

### `src/main.tsx` — Entry point
- Creates a React root and renders `<App />`
- Sets up the popup container at 420x580px

### `src/App.tsx` — Main popup container (~895 chars)
- Manages state for: `currentTab`, `sidebarOpen`, `debugOpen`
- Loads sidebar sections from storage on mount
- Renders: `<Sidebar>`, `<DebugConsole>`, and tab content area
- Tab switching renders Dashboard, OrderFulfillment, InventoryManager, SEOGenerator, CompetitorResearch, FinanceReconciliation, Settings
- **BUG:** No error boundary wrapping the popup content — a single crash in any page kills the entire extension UI

### `src/components/Sidebar.tsx` — Left navigation panel
- Renders 7 sidebar sections with icons/emojis (SHOCK, STAR, BOX, ROBOT, MAGNIFYING GLASS, BRIEFCASE, WRENCH)
- Each section has an open/close toggle with a chevron
- **TODO:** The `handleClick` function uses `any` type for the section object

### `src/components/DebugConsole.tsx` — Debug panel (~11KB)
- Logs messages with timestamps, levels (info/success/error), and filters
- Has a "Copy Log" button
- **BUG:** `handleCopyLog` — copies `logMessages` state but never actually clears on new messages, leading to unbounded memory growth
- **BUG:** The `useEffect` that registers `chrome.runtime.onMessage` listeners for `DEBUG_LOG` never cleans up the listener on unmount

---

## 3. SERVICES LAYER (6 files)

### `src/services/storage.ts` — Chrome storage abstraction (7.3KB)
- CRUD wrapper around `chrome.storage.local`
- Manages: inventory, orders, activities, settings, competitors
- Type-safe getters/setters with generic type parameters

### `src/services/messaging.ts` — Message type definitions
- Generic `Message<T>` type with `type` and optional `payload`
- Used across content scripts and background

### `src/services/ai.ts` — Claude AI integration (~3.8KB)
- `generateSEODescription()`: Sends product info to Claude Sonnet 4 API
- `generateSEOTitle()`: Generates eBay-optimized titles
- **BUG:** No error handling for rate limits or API quota exhaustion — a single 429 will propagate as a generic error to the UI
- **BUG:** API key is read from a hardcoded path `src/config/secrets.config.ts` which is an example file (`secrets.config.example.ts`) — the actual config does not exist, meaning AI features will not work out of the box

### `src/services/sync-engine.ts` — Core sync logic (~18KB)
- `syncInventory()`: Iterates inventory items, opens Amazon tabs, scrapes prices/stock, updates eBay prices
- Manages concurrency with a pool of up to 5 tabs
- **BUG:** Race condition in `syncInventory()` — if two syncs start simultaneously, they both create `chrome.tabs` without checking if a sync is already running (no mutex/flag check at the top level)
- **BUG:** The `scrapeAmazonPage()` function uses `chrome.tabs.executeScript` which is deprecated in MV3 — should use `chrome.scripting.executeScript`
- **BUG:** No retry logic for failed scrapes — a single network error on one item aborts the entire batch
- **BUG:** Price markup is hardcoded as `MARKUP = 2` (100% markup) with no way to adjust per-item or per-category
- **BUG:** `processDecision()` function — the title similarity check is commented out ("DISABLED - trust ASIN") but if ASIN decoding fails, `SOURCE_NOT_FOUND` is returned even though the page might be valid

### `src/services/fingerprint.ts` — Product change detection (~10KB)
- MD5 hash of product title + images for change detection
- Detects: title changes, image swaps, variant switches
- **TODO:** `// TODO: Implement image comparison using perceptual hashing`
- **BUG:** The `SCORES` constant defines thresholds but they are not exported — the `checkFingerprint` function's scoring logic is opaque and hard to tune

### `src/services/discord-logger.ts` — Discord webhook integration (~24KB)
- Sends rich embeds to 7 different webhook channels: logs, errors, priceUpdates, outOfStock, variantAlerts, fingerprintLog, dailySummary
- `startFinanceScan()` / `pauseFinanceScan()` / `resumeFinanceScan()` / `stopFinanceScan()` — these call functions that do not exist in the background service
- **BUG:** `sendDailySummaryWebhook()` — the `buildDailySummary()` function in background-service.ts is called but uses `chrome.storage.local.get` which is async but the Discord logger calls it without `await` in some paths
- **BUG:** Webhook username is hardcoded to an object `{ logs: 'Syndrax Sync', errors: 'Syndrax Alert System', ... }` — the actual Discord webhook `username` field expects a string, not an object. This will cause Discord API to reject the request silently.

---

## 4. POPUP PAGES (7 files)

### `src/pages/Dashboard.tsx` — Main dashboard (14KB)
- Shows sync stats, quick actions, recent activity feed
- Sync controls: Start Sync, Pause, Resume, Stop
- **BUG:** `startSync()` — creates a tab for the eBay inventory page but does not verify the tab loaded before proceeding
- **BUG:** `getSyncStats()` — reads from `chrome.storage.local.get('syndrax_inventory')` but the sync-engine stores inventory with key `syndrax_inventory` as a Record, not an array — type mismatch causes `.filter()` to fail at runtime
- **BUG:** Activity feed uses `Array.map(idx => ...)` with array index as key — should use unique IDs

### `src/pages/OrderFulfillment.tsx` — Manual fulfillment page (~7.4KB)
- Pending orders list with "Fulfill" button
- **BUG:** `handleFulfill()` — opens Amazon search but does not handle the case where the item is already on Amazon's site (wrong URL pattern for `/gp/product/`)
- **BUG:** No check for whether `pendingOrders` is loaded before rendering — `useEffect` fetches but component renders immediately with empty array

### `src/pages/InventoryManager.tsx` — Inventory management (~19KB)
- Full inventory table with search, filters, price adjustment
- Manual "Add ASIN" for items missing SKU decoding
- **BUG:** Price adjustment modal — the `handleApplyPrice()` function calls `chrome.tabs.query` but the returned tabs array might be empty, causing `tabs[0].id` to be `undefined` when passed to `chrome.tabs.sendMessage`
- **BUG:** `handleAddAsin()` — saves to storage but does not notify running sync to re-decode the SKU
- **BUG:** Pagination is client-side only — loads ALL items into memory, which will crash on 10,000+ listings
- **TODO:** "TODO: Implement bulk price adjustment" — the bulk adjust button exists but only adjusts a single item

### `src/pages/SEOGenerator.tsx` — AI SEO tool (~7.4KB)
- Sends product info to Claude for title/description generation
- **BUG:** No loading state management — clicking "Generate" twice sends duplicate API requests
- **BUG:** The generated content is never saved back to the listing — it is just displayed

### `src/pages/CompetitorResearch.tsx` — Competitor analysis (~5KB)
- Scans eBay sold listings for profit opportunities
- **BUG:** `handleScan()` — opens an eBay search tab but stores no results. The `COMPETITORS_SCANNED` listener expects data from a content script, but no content script is injected into the search results page
- **BUG:** `CompetitorProduct[]` state is populated from storage on mount but the `loadCompetitors()` function is called in `useEffect` with empty dependency array — it never re-fetches if storage is updated externally

### `src/pages/FinanceReconciliation.tsx` — Finance scanner (~24KB)
- Scans eBay sold orders, matches with Amazon purchases, calculates profit
- 3 tabs: Results, Needs Verification (placeholder), Errors
- **TODO:** `// TODO: Add custom date range UI` — the CUSTOM period just defaults to 1 year
- **BUG:** Verification tab shows "Verification queue coming soon..." — completely unimplemented
- **BUG:** `exportCSV()` — does not handle special characters in titles properly; a comma in a product title will break CSV parsing
- **BUG:** `startScan()` — sends `START_FINANCE_SCAN` message but the background service's `startFinanceScan()` function opens a tab but never actually waits for or injects the content script before trying to communicate with it
- **BUG:** No progress tracking for Amazon matching phase — after eBay scanning, the flow stops

### `src/pages/Settings.tsx` — Settings page (~7KB)
- API keys, webhook URLs, supplier defaults
- **BUG:** Settings are saved but not reloaded — changes only take effect after extension restart

---

## 5. BACKGROUND SERVICE (1 file — 1100 lines, ~43KB)

### `src/background-service.ts` — The central hub
- Message router: Handles 20+ message types from content scripts
- Alarms: `dailySync`, `activityCheck`, `dailySummary`
- Earnings batch scanner: Opens payment pages in batches, extracts eBay order earnings
- Amazon scraper: Variant-aware scraping with re-routing to correct child ASIN
- Finance reconciliation scanner: Multi-page eBay sold order extraction

**Bugs in background-service.ts:**
- **BUG (Critical):** `processEarningsBatch()` — creates tabs with `chrome.tabs.create` but stores `tab.id` in `activeTabs` map. However, `tab.id` can be `undefined` for some tab creations (especially if restricted by Chrome), causing `activeTabs.set(undefined, orderId)` which corrupts the map
- **BUG:** `waitForTabLoad()` — uses a 1500ms delay after `status === 'complete'` which is a magic number. Some SPA pages (Amazon) do not fully render after DOMContentLoaded
- **BUG:** `scrapeAmazonTab()` — injects TWO scripts via `chrome.scripting.executeScript` in sequence. The first sets `__syndraxEbayTitle` on `window`, the second reads it. But between the two injections, if the page navigates or the context is disposed, the second injection fails silently (`catch(() => resolve(null))`)
- **BUG:** `checkAmazonBatch()` — processes items sequentially but does not implement any rate limiting between items beyond the tab load wait. Amazon has aggressive bot detection
- **BUG:** `processDecision()` — `MARKUP = 2` and `THRESHOLD = 5` are magic constants with no configuration
- **BUG:** `calcSimilarity()` — word set intersection is a very weak similarity metric. Two titles with the same filler words but different products will get a high score
- **BUG:** `startFinanceScan()` — creates a tab with the eBay sold URL but never calls `handleFinanceScanPageReady()` to actually start the extraction. The tab just sits open
- **BUG:** `pauseFinanceScan()` / `resumeFinanceScan()` — toggle `isPaused` flag but do not actually pause any ongoing operations (no AbortController, no cancellation)

---

## 6. CONTENT SCRIPTS (9 files)

### `src/content/ebay-order-extractor.ts` — eBay order details (239 lines)
Injects on: `ebay.com/ord/*`, `ebay.com/sh/ord/*`
- Floating panel with: Extract Order, Auto Fulfill, Copy Address, Update Tracking buttons
- Scrapes buyer info, shipping address, item details, price, quantity

**Bugs:**
- **BUG:** `scrapeOrderData()` — address parsing is fragile. Uses newline splitting which breaks if eBay changes their HTML format to use spaces or other delimiters
- **BUG:** `autoFulfill()` — opens Amazon/AliExpress search but the `pendingFulfillment` data stored includes buyer address which is PII stored in plain text in Chrome storage
- **BUG:** `updateTracking()` — only focuses the tracking input but does not actually enter the tracking number. No input field for it

### `src/content/ebay-inventory-scanner.ts` — eBay active listings (336 lines)
Injects on: `ebay.com/sh/lst/active`
- Multi-page inventory scanner that clicks "Next Page" and accumulates listings
- Decodes base64 SKUs to ASINs

**Bugs:**
- **BUG:** `scanAllPages()` — calls `nextBtn.click()` but never waits for the page to actually load before scanning the next page. The `sleep(3000)` is a magic number that will fail on slow connections or pages with many items
- **BUG:** No error handling if the next page button changes its selector — the entire scan crashes with no recovery
- **BUG:** `saveInventory()` — uses callback-style `chrome.storage.local.get` inside an async function that returns a Promise. This creates a closure that may resolve before the callback fires if Chrome's storage is slow

### `src/content/ebay-listing-creator.ts` — Auto-fill listing form (132 lines)
Injects on: `ebay.com/*sell*`
- Fills title, description, price, quantity from `pendingListing` in storage

**Bugs:**
- **BUG:** `fillRichTextEditor()` — directly sets `innerHTML` on the Quill editor which can break the editor's internal state. Should use Quill's API (`editor.clipboard.convert()`)
- **BUG:** No validation that all required fields were filled — `filled > 0` is a very weak success check
- **BUG:** The `SELECTORS` object has hardcoded selectors that will break if eBay redesigns their selling flow

### `src/content/competitor-research.ts` — Competitor scanning (192 lines)
Injects on: eBay sold listings pages (`LH_Complete=1`, `LH_Sold=1`)
- Scrapes sold listings, calculates profit margins, shows overlay results

**Bugs:**
- **BUG:** `estimatedCost = soldPrice * 0.5` — this is a hardcoded 50% estimate with no basis in reality. Actual costs vary wildly
- **BUG:** The profit calculation `estimatedProfit = soldPrice - estimatedCost - (soldPrice * 0.13)` assumes 13% fees which is only approximately true for eBay (varies by category, final value fee, payment processing)
- **BUG:** `scanCompetitorListings()` — selects `.s-item, .srp-results li[data-viewport]` but on sold listings pages, the DOM structure is different. Many items will be missed
- **BUG:** The results overlay only shows top 10 items with `.slice(0, 10)` — no pagination or "load more"

### `src/content/amazon-scraper.ts` — Amazon product scraper (137 lines)
Injects on: `amazon.com/dp/*`
- Scrapes product title, price, images, description, stock status
- Floating "Add to Syndrax" button

**Bugs:**
- **BUG:** `getStock()` — `!stockEl?.textContent?.toLowerCase().includes('out of stock')` returns true for in-stock but does not handle "Only X left in stock" vs "Currently unavailable"
- **BUG:** Image scraper uses `._[^.]+_` regex to get hi-res images — Amazon's image URL patterns change frequently and this regex will break
- **BUG:** No variant detection — only scrapes the top-level product page

### `src/content/aliexpress-fulfillment.ts` — AliExpress address auto-fill (160 lines)
Injects on: `aliexpress.com/order/*`, `aliexpress.com/checkout/*`
- Fills shipping address from `pendingFulfillment`

**Bugs:**
- **BUG:** `fillInput()` — dispatches `input` and `change` events but does not handle Vue/React frameworks that use `Object.defineProperty` for reactivity. AliExpress uses Vue.js, so setting `.value` will not trigger updates
- **BUG:** `checkLoginRequired()` — only checks 3 selectors which is insufficient for AliExpress's complex login flows
- **BUG:** Only handles checkout pages, not the "Buy It Now" flow on product pages

### `src/content/amazon-fulfillment.ts` — Amazon order automation (1014 lines)
Injects on: Amazon product/checkout pages
- 9-step automation: Buy Now → Change Address → Fill Form → STOP
- Profit tracking overlay, debug status panel, element highlighting
- Retry mechanism (5 attempts)

**Bugs:**
- **BUG (Critical):** `selectAmazonStateDropdown()` — the state dropdown selector `a.a-dropdown-link[data-value*='\"${searchAbbrev}\"']` uses a data-value attribute that contains escaped quotes. This selector is extremely fragile and will break on any Amazon A/B test or layout change
- **BUG:** `fillAndVerifyField()` — for select elements, it sets `selectedIndex` but the verification at line 599-601 reads `options[selectedIndex].text` which may not reflect the actual displayed value if the select uses custom rendering
- **BUG:** `runAutomation()` — step 1 only runs on product pages, but if the user is already on checkout (step 2+), it skips the product page validation. If `savedState.currentStep` is 2 but the user navigated back to the product page, the automation continues from step 2 on the wrong page
- **BUG:** `startWithRetry()` — `initAttempts` is a global that increments forever across the extension's lifetime. If the extension stays open for days, this counter could theoretically overflow (unlikely but technically unbounded)
- **TODO:** Profit calculation — `ebayEarnings` is extracted from the eBay page but `extractEbayOrderEarnings()` from `ebay-mesh-order-overlay.ts` is not available in this content script (it is a different content script)

### `src/content/ebay-mesh-order-overlay.ts` — eBay Mesh Order tools (934 lines)
Injects on: `ebay.com/mesh/ord/details*`
- Auto Order, Copy Address, ETA, Feedback, Quick Actions buttons
- Settings modal for gift options, quantity increase
- Full order data extraction (shipping, line items, earnings)

**Bugs:**
- **BUG:** `extractShippingAddress()` — parses address from tooltip buttons by index (div 0 = name, div 1 = street, etc.). If eBay adds/removes a div, all subsequent fields will be wrong
- **BUG:** `decodeSkuToAsin()` — uses `atob()` which throws on non-base64 input. The try/catch handles it but the decoded result is returned as-is if it does not match the ASIN pattern, giving false positives
- **BUG:** `handleAutoOrder()` — stores `ebayEarnings` in `pendingOrder` but this is read by `amazon-fulfillment.ts` which has its own profit tracking that will not have this data
- **BUG:** `createSettingsModal()` — stores settings on every `change` event which fires on every keystroke. Should debounce
- **BUG:** `createOverlayForItem()` — the MutationObserver checks for `.ecomflow-utility-buttons` but does not handle the case where a card is removed and re-added (the check would pass but the card needs a fresh overlay)

### `src/content/ebay-mesh-order-styles.ts` — CSS styles for mesh overlay (475 lines)
- All CSS as a template literal constant, injected as a `<style>` tag
- No bugs here, just styles

### `src/content/ebay-mesh-order-types.ts` — TypeScript interfaces (156 lines)
- Type definitions for the mesh overlay: `ShippingAddress`, `LineItem`, `OrderData`, `AutoOrderSettings`, `OverlayState`, `EBAY_MESH_SELECTORS`
- No bugs, just types

### `src/content/ebay-sync-controller.ts` — Main sync controller (2289 lines)
Injects on: `ebay.com/sh/lst/active`
- The largest file at 86KB. Controls the entire sync process.
- Daily scan memory (tracks what has been processed, resets daily)
- Session tracking for Discord reports (out-of-stock items, price updates, flagged items)
- Webhook pinging, sync started/completion reports

**Bugs in sync-controller.ts:**
- **BUG (Memory):** `currentSession` accumulates up to 10 items in `outOfStockItems`, `priceUpdatedItems`, `flaggedItems`, `errorItems`, `noAsinItems` arrays but the interface says `.slice(0, 10)` in the report. The actual arrays have no cap during collection — they grow unbounded during long syncs
- **BUG:** `pingAllWebhooks()` — sets `webhooksPinged = true` at module scope. If the extension popup closes and reopens, the flag persists, so webhooks are never re-pinged for a new sync session
- **BUG:** `sendSyncCompletionReport()` — constructs Discord embeds with template literals that can contain unescaped markdown. A product title with `**` or backticks will corrupt the embed formatting
- **BUG:** The `SyncSession` interface has `completedAt: ''` initially but is set to ISO string at completion. If the sync crashes, `completedAt` stays as empty string and the duration calculation divides by zero (or NaN)
- **BUG:** `loadDailyScanMemory()` / `saveDailyScanMemory()` — the `dailyScanMemory` key is only read/written at sync start. If the extension crashes mid-sync, the day's progress is lost. There is no incremental save during the sync
- **BUG:** `getTodayString()` — uses `new Date().toISOString().split('T')[0]` which is UTC. If a sync starts at 11 PM EST on Monday and the user is in EST, the "today" check at 1 AM Tuesday will still show Monday's memory, causing duplicate processing

---

## 7. FEATURES & CONFIG (4 files)

### `src/features/finance-reconciliation/types.ts` — Finance types (239 lines)
- Well-structured type definitions for the finance scanner
- `OrderStatus`, `EbaySoldOrder`, `EbayPaymentDetails`, `AmazonOrderMatch`, `ProfitCalculation`, `ScanRun`, `ScanProgress`
- No bugs, good TypeScript hygiene

### `src/features/finance-reconciliation/parsers/moneyParser.ts` — Money parsing (140 lines)
- `parseMoney()`, `formatMoney()`, `extractAllMoneyValues()`, `findMoneyNearLabel()`, `isReasonableAmount()`
- **BUG:** `parseMoney()` — the negative detection `trimmed.includes('-$')` will not catch all cases. A string like `"- $1.07"` (with space) would be treated as positive

### `src/config/secrets.config.example.ts` — Example API config (1385 chars)
- **Critical:** This is a `.example.ts` file — the actual `secrets.config.ts` does NOT exist
- Contains placeholder keys for: Claude API, Discord webhooks, Amazon, eBay
- **BUG:** The app imports from `../config/secrets.config` (without `.example`) which means it will fail to build or run

### `src/config/webhooks.config.example.ts` — Example webhooks (1843 chars)
- Same pattern — placeholder URLs
- 7 webhook channels defined

### `src/PopupRoot.css` — Popup styling (~13KB)
- CSS custom properties for dark theme
- 420x580px popup layout
- Component-level styles for all popup pages
- No bugs, just styling

### `src/vite-env.d.ts` — Vite type declarations
- Standard `/// <reference types="vite/client" />`
- No issues

---

## SUMMARY OF CRITICAL ISSUES

### Bugs That Will Cause Runtime Failures:
1. **Missing config file** — `secrets.config.ts` does not exist, only `secrets.config.example.ts`. AI features will crash on import.
2. **Finance scanner never starts** — `startFinanceScan()` creates a tab but never calls the extraction handler.
3. **Async/callback mismatch** — `saveInventory()` in inventory-scanner.ts mixes callback and Promise styles, causing undefined behavior.
4. **Deprecated API** — `sync-engine.ts` uses `chrome.tabs.executeScript` (MV2) instead of `chrome.scripting.executeScript` (MV3).
5. **Discord webhook username is an object** — the code passes `{ logs: '...', errors: '...' }` instead of a string to Discord's API.
6. **`tab.id` can be undefined** — in `processEarningsBatch()`, storing `undefined` as a map key corrupts the active tabs tracking.

### Bugs That Will Cause Silent Data Loss:
7. **No sync retry** — one failed item crashes the entire batch in sync-engine.ts.
8. **Memory leak in DebugConsole** — log messages accumulate indefinitely.
9. **Unbounded session tracking** — `currentSession` arrays in sync-controller grow without limit.

### Incomplete Features:
10. **Finance verification tab** — shows "coming soon..." placeholder.
11. **Custom date range** — TODO comment, falls back to 1 year.
12. **Bulk price adjustment** — TODO, only single-item works.
13. **Tracking number input** — UI button exists but no input field to enter the number.
14. **Image comparison** — TODO: "implement perceptual hashing".

### Security Concerns:
15. **PII in plain text** — buyer addresses stored in `chrome.storage.local` with no encryption.
16. **API keys in example files** — the `.example.ts` pattern means developers might accidentally commit real keys if they rename the file.
