# LISTING STRATEGY — Syndrax Sync

## Overview

Syndrax Sync supports four distinct listing types — Rival-List, Opti-List, Chat-List, and SEO-List — each tuned to a different selling context and buyer psychology. Rather than applying a one-size-fits-all approach, the engine selects or receives a listing type per ASIN and forwards it verbatim to the background listing handler, which applies the appropriate generation pipeline. This separation of concerns means the bulk engine remains stateless with respect to listing strategy, while the background service owns all type-specific logic. The Hermes agent layer applies auto-selection rules at runtime based on competitor density, product category, and competition score — ensuring each listing is generated with the strategy most likely to convert in its specific market context.

## Listing Types

### 1. Rival-List ⚔️

- **Purpose:** Competitor intelligence mode. Scrapes competitor eBay listings for the same ASIN. Pulls their title, description, keywords, and bullet points. Prices 3–8% below the lowest competitor. Uses their SEO structure as a template.
- **When to use:** When entering a saturated niche with many existing sellers.
- **Hermes agent action:** Auto-select when competitor count > 5 for a category.
- **Key fields:** `competitor_url`, `price_undercut_pct`, `scraped_title`, `scraped_bullets`
- **Engine ID:** `'rival'`

### 2. Opti-List ✨ (RECOMMENDED)

- **Purpose:** Full optimization pipeline. Uses Amazon data combined with AI to generate an SEO title (80 characters or fewer), bullet-point description, and keyword set. Markup is sourced from per-ASIN Opti-List storage.
- **When to use:** Default for all new products.
- **Hermes agent action:** Default selection.
- **Key fields:** `ebay.title`, `ebay.description`, `ebay.keywords`, `pricing.markupPct`
- **Engine ID:** `'opti'`

### 3. Chat-List 💬

- **Purpose:** AI-written conversational description that reads naturally to buyers. Better suited to lifestyle, home, and clothing products. Title remains SEO-optimized while the description adopts a human, relatable tone.
- **When to use:** Clothing, home decor, gifts.
- **Hermes agent action:** Select when product category matches lifestyle keywords.
- **Key fields:** `ebay.description` (chat format)
- **Engine ID:** `'chat'`

### 4. SEO-List 🔍

- **Purpose:** Maximum keyword density. Title is packed with search terms. Description is structured to align with the eBay Cassini algorithm. Trades readability for the highest possible search visibility.
- **When to use:** Electronics, tools, high-competition categories.
- **Hermes agent action:** Select when `category_competition_score` > 8/10.
- **Key fields:** `ebay.keywords` (expanded set), `title` (keyword-stuffed, 80 characters or fewer)
- **Engine ID:** `'seo'`

## VERO Compliance Gate

All listing types must pass the VERO check before being queued. The check runs as Step 2 of the bulk engine pipeline, before any listing is submitted to eBay. The background handler evaluates `{ title, brand }` against the full 3,205-brand VERO list plus a curated high-risk brand set (Apple, Samsung, Nike, Louis Vuitton, Disney). Compatible accessories are exempt via `isCompatibleAccessory` keyword matching.

Items flagged by VERO are:
- Status set to `BLOCKED`
- Shown with orange **⚠️ VERO** badge in the Opti-List UI
- Never sent to eBay
- Error code: `VERO_HIGH_RISK_BRAND` or `VERO_BRAND_BLOCKED`

If the VERO check message itself fails (network or service error), the engine fails open — the job is not blocked and a non-fatal error is logged.

## Account Age Warmup Schedule

| Week  | Max Daily Listings | Min Markup | Recommended Type         |
|-------|--------------------|------------|--------------------------|
| 1–2   | 5                  | 40%        | Opti-List only           |
| 3–4   | 10                 | 60%        | Opti-List + Chat-List    |
| 5–6   | 20                 | 70%        | All types                |
| 7–8   | 35                 | 80%        | All types                |
| 9–10  | 50                 | 90%        | All types + Rival-List   |
| 11+   | 100                | 100%       | Full automation          |

## Hermes Agent Auto-Selection Rules

```python
if competitor_count > 5:
    use Rival-List
elif category in ['clothing', 'home', 'gifts']:
    use Chat-List
elif category in ['electronics', 'tools', 'automotive']:
    use SEO-List
else:
    use Opti-List  # default
```

## Description Builder Pipeline

Each listing type feeds into the Description Builder in the same sequence, with type-specific AI generation applied at step 2:

1. Fetch Amazon data (title, price, images, description)
2. Run AI for type-specific generation (model: claude-haiku-4-5 for cost, sonnet-4-6 for quality)
3. Apply VERO filter → block if flagged
4. Store in `OptiListItem.ebay{}`
5. Hermes can override any field before listing

## Session Roadmap

| Session | Name | Status |
|---------|------|--------|
| Q | Opti-List storage + auto-fetch pipeline | 🔄 IN PROGRESS |
| R | Image pipeline (download + dataUrl per variant) | ⏳ PENDING |
| S | Pricing strategy dashboard (Rival-List price tracking) | ⏳ PENDING |
| T | 90-day inventory lifecycle | ⏳ PENDING |
| U | Test suite | ⏳ PENDING |
| V | Bug panel | ⏳ PENDING |
| W | Hermes automation tests | ⏳ PENDING |

---
*Last updated: May 2026 — Session Q*
