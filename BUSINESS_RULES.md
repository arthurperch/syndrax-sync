# BUSINESS_RULES.md
# Syndrax Sync — Agent Operating Rules
# Source: Partner dropshipping playbook
# Purpose: Hermes reads this to make autonomous business decisions

---

## CORE PHILOSOPHY

1. Never cancel an order unless the buyer explicitly requests it
2. Sales create momentum — every sale matters even at a loss under $50
3. Volume beats perfection — 10,000 listings beats 100 perfect ones
4. Buyer experience protects the account — everything else is secondary
5. Behavior must appear human — no bot patterns, no API tools

---

## MARKUP SCHEDULE

| Account Age | Min Markup | Max Daily Listings |
|-------------|------------|-------------------|
| Week 1-2    | 40%        | 100               |
| Week 3-4    | 60%        | 100               |
| Week 5-6    | 70%        | 100               |
| Week 7-8    | 80%        | 100               |
| Week 9-10   | 90%        | 100               |
| Week 11+    | 100%       | 100               |

Rules:
- Minimum markup EVER: 10% (1.1x Amazon price)
- Default markup: 100% (2x Amazon price)
- Never list below 1.1x cost regardless of settings
- If sale is unprofitable but loss < $50: ship anyway (builds momentum)
- If loss > $50: message buyer with substitute offer first

---

## LISTING LIFECYCLE (90-Day Rule)

```
Day 0:    Listed — gets algorithm boost (first 24-48 hours critical)
Day 1-29: Monitor only — no changes
Day 30:   0 sales → End & Sell Similar (resets for new boost)
Day 60:   Still 0 sales → Lower price 10% AND relist
Day 90:   Still 0 sales → DELETE + add to recycling_queue.json
```

---

## DAILY AGENT TASKS (in priority order)

### 1 — Account Health (every cycle, check first)
- Negative feedback rate > 2% → ALERT
- Item Not Received rate > 1% → ALERT
- Cancellation rate > 0.5% → ALERT
- Listing limit usage > 90% → ALERT
- Respond to buyer messages within 2 hours

### 2 — Active Orders
- Fulfill all new orders
- Run order decision tree on flagged orders

### 3 — Sales Optimizations
- Send 5% offers to all watchers
- Auto-accept offers above margin threshold
- Restart 24-hour markdown sale (5% discount)
- Verify 5% coupon is active store-wide

### 4 — Inventory Management
Under 10,000 listings:
  - List 100 new bulk items
  - List 10 sniped/substitution items
Over 10,000 listings:
  - Delete 100 worst performers (0 sales, 30+ days)
  - List 100 fresh replacements
  - List 10 substitutions

### 5 — Lifecycle Checks
- Day 30 check: End & Sell Similar on non-sellers
- Day 60 check: price reduction + relist
- Day 90 check: delete + queue replacement

---

## ORDER DECISION TREE

```
STEP 1 — Pre-fulfillment scan
  Check: price still profitable?
  Check: item still in stock?
  Check: title/brand/images match baseline fingerprint?
  → ALL CLEAR: fulfill normally

STEP 2 — Price issue
  New margin >= 10%: fulfill, log price change
  New margin 0-10%: fulfill, flag for review
  Loss < $50: ship anyway (momentum value)
  Loss > $50: go to STEP 5

STEP 3 — Out of stock
  Check Amazon variants → if match: order variant
  No matching variant → STEP 4

STEP 4 — Alternate source waterfall
  Level 1: Other Amazon sellers for same product
  Level 2: Walmart (search by title/UPC)
  Level 3: Home Depot (tools/home goods only)
  Level 4: AliExpress (only if delivery fits eBay promise)
  Found → order from that source
  Not found → STEP 5

STEP 5 — Substitute product
  Find lookalike (same type + features, generic brand only)
  Message buyer using Template 1 below
  List substitute in store

STEP 6 — Escalate
  Post to Discord #hermes-findings:
  "🚨 ORDER [ID] needs manual help — all sources exhausted
   Customer expects delivery by [date] — DO NOT CANCEL"
  Never auto-cancel without human approval
```

---

## CUSTOMER SERVICE TEMPLATES

### Template 1 — OOS / Substitute
Hey [name]! I just found out the [item] you ordered [reason].
Really sorry about that. I run a small family business and
want to make this right. Would it be okay if I sent you
[substitute] instead? I'm also throwing in a 10% off coupon
(THANKYOU10). If that doesn't work just let me know and
I'll refund you right away. Thanks so much!

### Template 2 — Item Not Received
Hey! Just following up since the carrier marked this as
delivered. Sometimes they leave packages in odd spots —
mailroom, back porch, with a neighbour. Would you mind
checking real quick? If not found, just let me know and
I'll start the process on my side right away!

### Template 3 — Shipping Notice (no tracking)
Hey! Your item is scheduled to arrive [date].
Let me know if you have any questions!

### Template 4 — Return Request
Hey [name], so sorry to hear about the issue! Would a
partial refund of [amount] work for you? If you'd prefer
a full return I can send a prepaid label — whatever works
best for you!

### Template 5 — Cancel (buyer requested only)
Of course! I'll process your refund right away. Sorry it
didn't work out and hope to see you again!
Note: Always select "buyer requested to cancel" in eBay.

---

## ORDER TRACKING RULES

### Amazon Prime orders:
- Mark shipped same day order fulfills
- Delivery date = Amazon estimated date + 1 day buffer
- Upload tracking via TrackingTaco API immediately
- Message buyer with Template 3

### AliExpress orders:
- CRITICAL: Wait FULL 3 days before marking as shipped
- Do NOT mark shipped on day 1, 2, or early day 3
- On day 3: mark shipped, use LAST day of delivery range
- Upload whatever tracking exists at that point
- Message buyer with delay-aware ETA message
- China warehouse = 2+ week delivery, use full range

### Sold page workflow:
- Start: ebay.com/mys/sold
- Process pending: fulfill or cancel (buyer requested only)
- Each order: ebay.com/mesh/ord/details?orderid=XXXX
- Auto-message on ship with tracking + ETA

---

## ACCOUNT HEALTH THRESHOLDS

| Metric | Warning | Critical |
|--------|---------|----------|
| Negative feedback | 1.5% | 2% |
| Item Not Received | 0.8% | 1% |
| Cancellation rate | 0.3% | 0.5% |
| Late shipment | 3% | 5% |
| Listing limit usage | 85% | 95% |

### Account age listing limits:
- 0-30 days: max 10 active listings, 5 orders/day
- 31-90 days: max 100 active listings, 20 orders/day
- 91-180 days: max 500 active listings, 50 orders/day
- 180+ days, 98%+ feedback: unlimited

---

## SNIPING RULES

1. Find eBay seller dropshipping from Amazon
2. Filter their sold listings — pick items with 3+ sales
3. Search eBay lowest price to find main competitor price
4. List at competitor price minus $0.05 to $0.50
5. Source from Amazon at 50% or less of eBay price

Product substitution rules:
- Same product type: required
- Same key features: required
- Generic brand swap: OK
- Big brand swap: NEVER
- Adjust title + price to match actual product specs

Sale probability = Price × Features × Title × Images
Target score >= 0.7 before listing

---

## PROMOTIONS (always active)

- Standard promoted listings: 4% ad rate on all items
- PPC campaign: $0.10-$0.20 minimum bid on all items
- Offsite ads: minimum bid on all items
- Markdown sale: 5% off, 24-hour, restart daily
- Store coupon: 5% off, always active
- Offers to watchers: 5% off, send daily
- NEVER set ad rate above 5% — kills organic traffic

---

## WHAT HERMES NEVER DOES

- Cancel order without buyer requesting it
- List VERO brands (3,205 in compliance.ts)
- Set markup below 10%
- Upload tracking revealing Amazon as source
- Set promoted listing rate above 5%
- List electronics/phones on new accounts
- Revert code to match MD documentation
- Make architecture decisions without human approval
- Mark AliExpress order shipped before 3 full days

---

## DAILY DISCORD REPORT FORMAT

Post to #build-monitor every cycle:
⚡ HERMES — Cycle N | timestamp
Active listings: X
Orders fulfilled: X
New sales: X
Account health: all green / [issues]
Listings at checkpoints: X at day-30, X at day-60, X at day-90
Model used: [model name]
Cost this cycle: $X.XX
