# CURRENT_STATE.md
# Reflects ACTUAL build state — updated May 2026
# MDs like CONTEXT.md and BUILD_PLAN.md are outdated
# This file is the source of truth for current build

---

## WHAT IS ACTUALLY BUILT AND WORKING

### Extension src/
- App.tsx: full popup UI with pipeline navigation
- DashboardPage.tsx: cluster operations dashboard
  - Node Cluster: 9-node grid with live stats + SVG hardware icons
  - Node Manager: full CRUD (Add/Edit/Replace/Remove modals)
  - Models tab: GPU rack SVG, cost tracker, model assignments
  - Pipelines/Alerts/Jobs tabs: placeholders
- background-service.ts: message routing, finance scan, Amazon scraping
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

- Session C-2: Admin panel (password-locked settings)
- Session C-3: Sniper overlay (Amazon product page)

---

## BUILD QUEUE (in priority order)

- C-2: Admin panel in dashboard
- C-3: Sniper overlay content script
- D: Advanced Title Builder (5 modes + SEO scoring)
- E: Bulk Lister (bulklister.html full page)
- F: Description Template Builder
- G: Listing Optimizer (End & Sell Similar automation)
- H: Customer Message Tool (buyer name + ETA)
- I: Agent Editor in dashboard
- J: Amazon auto-order + eBay active listings from salvage
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
- Sprint 5: IN PROGRESS (Sniper, Title Builder next)
- Sprint 6-8: PENDING
