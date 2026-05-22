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
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Add retry logic to all fetch() and API calls in src/. Wrap with retry function: 3 attempts, 1000ms delay between retries, console.error on each failure.
**Files:** src/
**Expected Output:** All API calls have retry logic. Commit [HERMES-TASK-004] and push.
**Results:**

---

## TASK-005
**Status:** PENDING
**Priority:** HIGH
**Assigned:** Cline
**Type:** BUG_FIX
**Description:** Fix markup settings. Find pricing/markup logic in src/. Set default markup to 2.0 (2x). Add minimum markup enforcement of 1.1 (10%). Prevent any markup below 1.1 from being saved.
**Files:** src/
**Expected Output:** Default markup 2x, minimum 1.1x enforced. Commit [HERMES-TASK-005] and push.
**Results:**
