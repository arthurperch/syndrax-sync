# CURRENT_STATE.md
# Reflects ACTUAL build state — updated May 2026
# MDs like CONTEXT.md and BUILD_PLAN.md are outdated
# This file is the source of truth for current build

---

## WHAT IS ACTUALLY BUILT AND WORKING

### Extension src/
- App.tsx: full popup UI with pipeline navigation
  - "Bulk Lister" pipeline row opens bulklister.html in new tab (chrome.tabs.create)
  - "Description Builder" pipeline row opens DescriptionBuilder in-popup view
- DashboardPage.tsx: cluster operations dashboard
  - Node Cluster: 9-node grid with live stats + SVG hardware icons
  - Node Manager: full CRUD (Add/Edit/Replace/Remove modals)
  - Models tab: GPU rack SVG, cost tracker, model assignments
  - Pipelines/Alerts/Jobs tabs: placeholders
- background-service.ts: message routing, finance scan, Amazon scraping
  - FETCH_AMAZON_PRODUCT: scrapes Amazon product page (title/price/brand/image)
  - CHECK_VERO: checks 3,205 VERO brands against title+brand
  - CREATE_EBAY_LISTING: stub (full API Session J)
  - OPEN_DESCRIPTION_BUILDER: stores desc_prefill, opens bulklister.html
  - OPEN_TITLE_BUILDER: stores titlebuilder_prefill
- compliance.ts: 3,205 VERO brands + 233 restricted words
- address-parser.ts: 195 countries, German swap, Canadian provinces, Chinese provinces
- human.ts: behavior simulation, rate limits
- retry.ts: exponential backoff for all API calls
- lister.ts: listing builder with markup enforcement
- research.ts: Amazon search scraper
- fingerprint.ts: ASIN hijack detection
- discord-logger.ts: 29 webhook channels (all fixed)
- amazon-fulfillment.ts: 9-step checkout automation
- ebay-sync-controller.ts: price sync, inline editing
- ebay-mesh-order-overlay.ts: order overlay UI
- finance-ebay-scanner.ts: sold order extraction (trigger fixed)
- aliexpress-fulfillment.ts: Vue reactivity fixed
- sniper-overlay.ts: Amazon product page overlay
  - Title generation (LOCAL qwen2.5 + CLOUD claude)
  - SEO scoring, price calculator, VERO compliance check
  - Buttons: Research, Scan, Title Builder, Description Builder (NEW)

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

### Build System (FIXED)
- vite.config.ts: 3 build entries (popup, dashboard-main, bulklister-main)
- closeBundle plugins generate dist/dashboard.html and dist/bulklister.html
  - Only injects dashboard-*.css (NOT index-*.css which has popup 420px constraints)
- manifest.config.ts: bulklister.html in web_accessible_resources
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

### Salvage C:\hermes-workspace\salvage\
- 305 files from old eBayLister organized and ready
- libraries/address_parser.js: already ported
- vero/: already merged into compliance.ts
- content/amazon_auto_order/: ready to port (Session J)
- content/ebay_active_listings/: ready to port (Session J)
- ui_tools/: reference for new feature builds
- prompts/: SEO prompts ready to integrate

---

## IN PROGRESS

- Nothing — Sessions E and F complete

---

## BUILD QUEUE (in priority order)

- G: Listing Optimizer (End & Sell Similar automation)
- H: Customer Message Tool (buyer name + ETA)
- I: Agent Editor in dashboard
- J: Amazon auto-order + eBay active listings from salvage (CREATE_EBAY_LISTING full API)
- K: Google Lens + vendor toggle mode
- L: Order Intelligence (smart fulfillment decision tree)
- M: Order tracking automation (TrackingTaco integration)
- N: Dashboard node selector V2 (click to select node)
- O: Account tier enforcer
- P: Seller scanner + keyword snowball research mode
- Q: MD update (CONTEXT.md + BUILD_PLAN.md stale)

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
- Sprint 3: PARTIAL (finance trigger fixed, CSV pending)
- Sprint 4: PARTIAL (some stability done)
- Sprint 5: DONE (Sniper overlay, Title Builder, Bulk Lister, Description Builder)
- Sprint 6-8: PENDING
