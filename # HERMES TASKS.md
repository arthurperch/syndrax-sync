# HERMES TASKS
_Managed by Hermes Agent. Do not edit manually._

---

## TASK-001
**Status:** COMPLETE
**Priority:** HIGH
**Assigned:** Cline
**Type:** BRIDGE_TEST
**Description:** This is a bridge loop verification task. Find any `.ts` or `.tsx` file in the `src/` directory. Add a single comment line at the top: `// [HERMES-TASK-001] bridge test - UTC timestamp: <insert current UTC time>`. Save the file.
**Files:** src/ (pick any one .ts or .tsx file)
**Expected Output:** File modified, committed with message `[HERMES-TASK-001] test: verify Hermes-Cline bridge loop`
**Results:**

---

## TASK-002
**Status:** COMPLETE
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Fix UTC timezone bug. Search all .ts and .tsx files in src/ for new Date(), toLocaleDateString(), toLocaleTimeString(). Replace with UTC equivalents using toISOString() or explicit UTC formatting so all timestamps are stored and displayed in UTC.
**Files:** src/ (all .ts and .tsx files)
**Expected Output:** All timestamps normalized to UTC. Commit with [HERMES-TASK-002] then push to origin master.
**Results:**

---

## TASK-003
**Status:** COMPLETE
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Fix unbounded arrays. Search all src/ .ts and .tsx files for arrays that grow indefinitely with push() and no size cap. Add MAX_ARRAY_SIZE = 1000 limit, slice oldest entries when exceeded.
**Files:** src/
**Expected Output:** All unbounded arrays capped at 1000. Commit [HERMES-TASK-003] and push.
**Results:** Added MAX_ARRAY_SIZE = 1000 constant to discord-logger.ts. Capped outOfStockItems, priceChangeItems, and restockedItems arrays with .slice(-MAX_ARRAY_SIZE).

---

## TASK-004
**Status:** COMPLETE
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Add retry logic to all fetch() and API calls in src/. Wrap with retry function: 3 attempts, 1000ms delay between retries, console.error on each failure.
**Files:** src/
**Expected Output:** All API calls have retry logic. Commit [HERMES-TASK-004] and push.
**Results:** Created src/services/retry.ts with retryFetch() and retryAsync() functions. 3 attempts, 1000ms delay, console.error on failures. Added import to discord-logger.ts.

---

## TASK-005
**Status:** COMPLETE
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Fix markup settings. Find pricing/markup logic in src/. Set default markup to 2.0 (2x). Add minimum markup enforcement of 1.1 (10%). Prevent any markup below 1.1 from being saved.
**Files:** src/
**Expected Output:** Default markup 2x, minimum 1.1x enforced. Commit [HERMES-TASK-005] and push.
**Results:** Updated background-service.ts with DEFAULT_MARKUP=2.0, MIN_MARKUP=1.1, enforced with Math.max(). Updated storage.ts default markupPercent from 30 to 200 (2.0x).

---

## TASK-006
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** FEATURE
**Description:** Build ResearchTool. Create src/services/research.ts. Function searchAmazon(query: string) that uses CDP to open amazon.com/s?k=query, scrape top 10 results: ASIN, title, price, rating, review count, image URL. Return as AmazonProduct[]. Add error handling and retry logic using existing retryAsync().
**Files:** src/services/research.ts (new file)
**Expected Output:** Working Amazon search scraper. Commit [HERMES-TASK-006] and push.
**Results:**

---

## TASK-007
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** FEATURE
**Description:** Build ComplianceFilter. Create src/services/compliance.ts. Function checkCompliance(product: AmazonProduct) that runs all 7 risk filters from COMPLIANCE.md: VERO brand check, banned items check, price threshold check, margin check (minimum 15% net), review count minimum 10, rating minimum 3.5, title keyword blacklist. Return {passed: boolean, reasons: string[]}.
**Files:** src/services/compliance.ts (new file)
**Expected Output:** Working compliance filter. Commit [HERMES-TASK-007] and push.
**Results:**

---

## TASK-008
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** FEATURE
**Description:** Build EbayLister. Create src/services/lister.ts. Function createListing(product: AmazonProduct) that calculates eBay price using 2x markup, builds listing object with title, price, description, images. Apply markup from storage settings. Return EbayListing object ready for submission.
**Files:** src/services/lister.ts (new file)
**Expected Output:** Working listing builder. Commit [HERMES-TASK-008] and push.
**Results:**

---

## TASK-009
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** FEATURE
**Description:** Build DiscordReporter. Update src/services/discord-logger.ts to add reportResearchResult(product: AmazonProduct, listing: EbayListing, compliance: ComplianceResult) function. Posts formatted Discord message to webhook with: product title, Amazon price, eBay price, margin %, compliance status, ASIN, direct Amazon link.
**Files:** src/services/discord-logger.ts
**Expected Output:** Discord reporting for each researched product. Commit [HERMES-TASK-009] and push.
**Results:**

---

## TASK-010
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** FEATURE
**Description:** Wire everything together in src/background-service.ts. Add runResearchPipeline(query: string) function that: calls searchAmazon(), loops results, runs checkCompliance() on each, for passing products calls createListing(), calls reportResearchResult(). Add a setInterval to run pipeline every 4 hours with queries from a hardcoded seed list: ["phone case", "laptop stand", "cable organizer", "desk lamp", "phone holder"].
**Files:** src/background-service.ts
**Expected Output:** Full automated pipeline running every 4 hours. Commit [HERMES-TASK-010] and push.
**Results:**
