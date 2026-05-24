# CURRENT_STATE.md
# Reflects ACTUAL build state — updated May 2026
# This file is the source of truth for current build

---

## WHAT IS ACTUALLY BUILT AND WORKING

### Session A — Bug Fixes (COMPLETE)
- Critical bug fixes across background-service.ts, content scripts, and UI
- Finance scan trigger fixed, Vue reactivity fixed in aliexpress-fulfillment.ts
- Discord webhook channels fixed (29 channels)

### Session B — Address Parser + VERO Compliance (COMPLETE)
- address-parser.ts: 195 countries, German swap, Canadian provinces, Chinese provinces
- compliance.ts: 3,205 VERO brands + 233 restricted words
- CHECK_VERO message handler in background-service.ts

### Session C — Sniper Overlay (COMPLETE)
- sniper-overlay.ts: Amazon product page floating panel
  - Title generation (LOCAL qwen2.5 + CLOUD claude)
  - SEO scoring, price calculator, VERO compliance check
  - Buttons: Research, Scan, Title Builder, Description Builder

### Session D — Advanced Title Builder (COMPLETE)
- src/pages/TitleBuilder.tsx: full title builder UI
  - Keyword insertion, character counter, SEO score
  - LOCAL/CLOUD AI generation with prefill from sniper overlay
  - Wired into App.tsx pipeline + OPEN_TITLE_BUILDER message handler

### Session E — Bulk Lister (COMPLETE)
- bulklister.html: standalone Chrome extension full-page entry
- src/bulklister-main.tsx: React root mount for bulklister page
- src/pages/BulkLister.tsx: full-page two-column bulk listing UI
  - Left column: ASIN/URL textarea, parse button, account age, markup slider,
    VERO toggle, daily limit progress bar, Queue All button
  - Right column: queue cards with status badges, price rows, VERO results,
    action buttons (List on eBay, Build Description, Recheck, Remove)
  - Business logic: parseASINs(), enforceMarkup(), checkVERO(), queueItem(),
    listItem(), daily counter reset (bulk_listed_today / bulk_listed_date)
  - Markup schedule: Week 1-2: 40%, 3-4: 60%, 5-6: 70%, 7-8: 80%, 9-10: 90%, 11+: 100%
  - Daily cap: 100 listings/day enforced with warning
  - Queue persisted to chrome.storage.local key "bulk_queue"

### Session F — Description Builder (COMPLETE)
- src/components/DescriptionBuilder.tsx: reusable description template builder
  - 6 template styles: Professional, Casual, Bullet-Heavy, Story, Minimal, Technical
  - AI generation via LOCAL (Ollama) or CLOUD (Claude) with fallback
  - Live HTML preview with copy/insert actions
  - mode="panel" for inline use in BulkLister queue cards
  - mode="page" for standalone popup view
- Wired into BulkLister queue cards: "Build Description" accordion per item
- Wired into sniper-overlay.ts: "📝 Description" button in action row
- Wired into App.tsx: "Description Builder" pipeline row

### Session G — Listing Optimizer (COMPLETE)
- src/content/listing-optimizer.ts: End & Sell Similar automation
  - Scans active eBay listings for underperformers
  - Auto-end + relist with optimized titles and pricing
  - Wired into App.tsx pipeline

### Session H — Customer Message Tool (COMPLETE)
- src/content/customer-message-tool.ts: buyer name + ETA message automation
  - Extracts buyer name and order details from eBay message threads
  - Generates personalized response templates
  - Wired into App.tsx pipeline

### Session I — Agent Editor (COMPLETE)
- Dashboard sidebar agent editor (dashboard.html)
  - Edit Hermes agent rules and personality inline
  - Save/reload agent config without restarting
  - Wired into DashboardPage.tsx

### Session J — Amazon Auto-Order + eBay Active Listings (COMPLETE)
- amazon-fulfillment.ts: 9-step checkout automation
- ebay-sync-controller.ts: price sync, inline editing
- background-service.ts: CREATE_EBAY_LISTING full eBay API integration
  - FETCH_AMAZON_PRODUCT: scrapes Amazon product page (title/price/brand/image)
  - CREATE_EBAY_LISTING: full API call with title, price, description, images
  - OPEN_DESCRIPTION_BUILDER: stores desc_prefill, opens bulklister.html
  - OPEN_TITLE_BUILDER: stores titlebuilder_prefill

### Session K — Google Lens + Vendor Toggles (COMPLETE)
- sniper-overlay.ts: Google Lens button in action row
  - Opens Google Lens with current product image URL
  - Shows toast if no image available
- src/pages/Settings.tsx: Advanced card with 4 vendor toggle switches
  - AliExpress, Walmart, Home Depot, Temu enable/disable toggles
- src/services/storage.ts: 4 vendor fields in Settings interface with defaults
- manifest.config.ts: walmart.com, homedepot.com, temu.com in host_permissions

### Session L — Order Intelligence (COMPLETE)
- analyzeOrder() decision engine: smart fulfillment routing
  - Evaluates order value, weight, destination, seller metrics
  - Returns fulfillment recommendation with confidence score
- Intelligence banners in OrderFulfillment UI
  - Color-coded recommendation cards (green/yellow/red)
  - Expandable reasoning panel

### Session M — TrackCaptain Order Tracking (COMPLETE)
- claimTrackingNumber(): auto-claim tracking from carrier APIs
- Settings card: TrackCaptain API key + auto-claim toggle
- Tracking badge on order cards: live status with last-updated timestamp
- Wired into background-service.ts message routing

### Session N — Dashboard Node Selector V2 (COMPLETE)
- DashboardPage.tsx: clickable node grid
  - Click any node to select it (highlighted border)
  - NodeDetailPanel slides in with full metrics
- NodeDetailPanel: GPU %, VRAM, CPU, RAM, uptime, model assignments
  - Action buttons: Restart, SSH, Assign Model, Remove
  - Live stats polling every 30s

### Session O — Account Tier Enforcer (COMPLETE)
- src/services/account-tier.ts: EbayAccount interface + getTierLimits()
  - 5 tiers: New (5/day), Starter (10/day), Growing (25/day), Established (50/day), Power (100/day)
  - Tier determined by feedback score + account age
- src/pages/AccountManager.tsx: full account management UI
  - Account cards with tier badge, daily limit progress, feedback score
  - Add/Edit/Remove modals
  - Wired into App.tsx pipeline (Phase 6 / blue)

### Session O.5 — eBay Warmup Agent (COMPLETE)
- src/services/warmup-agent.ts: WarmupSchedule interface + warmup logic
  - getWarmupLimits(day): 6 tiers from day 1 (2 listings) to day 90+ (50 listings)
  - isActionSafe(schedule, action): checks nextActionAt timing + daily limits
  - recordAction(schedule, action): increments counter, updates timestamps
  - advanceDay(schedule): increments day, resets counters, updates phase
- src/pages/WarmupAgent.tsx: warmup schedule management UI
  - Schedule cards: account ID + phase badge, day progress bar, activity grid
  - Action buttons: Log Listing, Log Search, Log View, Advance Day, Remove
  - Add modal: dropdown of EbayAccounts + starting day with live limit preview
  - Wired into App.tsx pipeline (Phase 7 / cyan)

### Session P — Seller Scanner + TF-IDF Keyword Snowball (COMPLETE)
- src/services/tfidf.ts: pure TF-IDF implementation
  - KeywordScore: { term, tf, idf, tfidf, count }
  - SnowballResult: { seed, keywords (top 20), titles, generatedAt }
  - STOPWORDS Set: 43 words including eBay-specific terms
  - computeTFIDF(titles): per-doc TF maps, IDF = log(N/(1+df)), top 30
  - generateSnowball(seed, titles): wraps computeTFIDF, returns top 20
- src/content/competitor-research.ts: sends scanned titles to popup
- src/pages/CompetitorResearch.tsx: snowball panel UI
  - ❄️ Snowball button (violet outline) next to 🔍 Scan
  - 2-col keyword grid: cyan top 5 / violet 6-10 / slate 11-20
  - TF-IDF score bar, click-to-copy, Search eBay Sold + Copy All buttons
  - Green toast on copy

### Extension Core (COMPLETE)
- App.tsx: full popup UI with pipeline navigation (Sessions A-P wired in)
- DashboardPage.tsx: cluster operations dashboard
  - Node Cluster: 9-node grid with live stats + SVG hardware icons
  - Node Manager: full CRUD (Add/Edit/Replace/Remove modals)
  - Models tab: GPU rack SVG, cost tracker, model assignments
- background-service.ts: message routing, finance scan, Amazon scraping
- human.ts: behavior simulation, rate limits
- retry.ts: exponential backoff for all API calls
- discord-logger.ts: 29 webhook channels

### Build System (COMPLETE)
- vite.config.ts: 3 build entries (popup, dashboard-main, bulklister-main)
- closeBundle plugins generate dist/dashboard.html and dist/bulklister.html
- manifest.config.ts: all host_permissions including walmart/homedepot/temu
- dashboard.css: #bulklister-root added to full-width selector

### Hermes Agent C:\hermes-workspace\hermes\
- hermes_agent.py: main loop, HERMES_CYCLE counter, hermes_post()
- hermes_config.json: personality + agent_rules sections added
- modules/cluster_monitor.py: 9 nodes, GPU stats, auto-discovery
- modules/code_analyzer.py: AGENT_RULES, should_create_task(), hermes_log()
- modules/extension_tester.py: CDP testing + mock routes
- modules/page_snapshot.py: DOM capture + selector scanning
- modules/auto_fixer.py: 3-tier autonomous fix loop
- modules/cost_tracker.py: token/cost logging per model

---

## IN PROGRESS

- Nothing — Sessions A-P complete

---

## BUILD QUEUE (in priority order)

- R: Image pipeline (product image processing + optimization)
- S: Pricing strategy dashboard (dynamic repricing rules + analytics)
- T: 90-day inventory lifecycle (age tracking, markdown triggers, clearance)
- U: Test suite (unit + integration tests for core services)
- V: Bug panel (in-extension bug reporting + log viewer)
- W: Hermes tests (automated extension testing via Hermes agent)

---

## KEY PATHS

Extension:    C:\hermes-workspace\syndrax-sync\
Hermes:       C:\hermes-workspace\hermes\
Salvage:      C:\hermes-workspace\salvage\
Mock eBay:    C:\hermes-workspace\mock-ebay\
Snapshots:    C:\hermes-workspace\page-snapshots\
Cost log:     C:\hermes-workspace\cost_log.json
Cluster:      C:\hermes-workspace\cluster_status.json

---

## SPRINT STATUS (actual)

- Sprint 0: DONE
- Sprint 1: DONE
- Sprint 2: DONE (all 6 critical bugs fixed)
- Sprint 3: DONE (finance trigger fixed)
- Sprint 4: DONE (stability, retry logic, address parser)
- Sprint 5: DONE (Sniper, Title Builder, Bulk Lister, Description Builder, Listing Optimizer, Customer Message Tool)
- Sprint 6: DONE (Amazon auto-order, eBay active listings, full CREATE_EBAY_LISTING API)
- Sprint 7: DONE (Order Intelligence, TrackCaptain, Dashboard V2, Account Tier, Warmup Agent, Keyword Snowball)
- Sprint 8: PENDING (R-W sessions)
