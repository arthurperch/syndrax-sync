# HERMES ↔ CLINE BRIDGE

## Overview

This document describes the communication protocol between Hermes (VPS agent) and Cline (local developer agent). The bridge enables asynchronous task delegation, code verification, and collaborative debugging.

---

## Communication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   HERMES ↔ CLINE BRIDGE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                      ┌─────────────┐     │
│   │   HERMES    │                      │    CLINE    │     │
│   │   (VPS)     │                      │   (LOCAL)   │     │
│   └──────┬──────┘                      └──────┬──────┘     │
│          │                                    │             │
│          │    ┌────────────────────┐          │             │
│          │    │  HERMES_TASKS.md   │          │             │
│          ├───►│  (Task Assignment) │◄─────────┤             │
│          │    └────────────────────┘          │             │
│          │                                    │             │
│          │    ┌────────────────────┐          │             │
│          │    │    FINDINGS.md     │          │             │
│          ├───►│  (Bug Documentation)│         │             │
│          │    └────────────────────┘          │             │
│          │                                    │             │
│          │    ┌────────────────────┐          │             │
│          │    │   HERMES_LOG.md    │          │             │
│          ├───►│  (Activity Log)    │          │             │
│          │    └────────────────────┘          │             │
│          │                                    │             │
│          │    ┌────────────────────┐          │             │
│          │    │      Discord       │          │             │
│          │◄───┤  (#hermes-tasks)   │◄─────────┤             │
│          │    │  (#cline-updates)  │          │             │
│          │    └────────────────────┘          │             │
│          │                                    │             │
│          │    ┌────────────────────┐          │             │
│          │    │   Git Repository   │          │             │
│          │◄───┤  (Commits/Pushes)  │◄─────────┤             │
│          │    └────────────────────┘          │             │
│          │                                    │             │
└─────────────────────────────────────────────────────────────┘
```

---

## HERMES_TASKS.md Format

### Purpose
HERMES_TASKS.md is the primary task delegation file. Hermes writes tasks here for Cline to implement. Cline reads this file to understand what needs to be done.

### File Location
```
C:\hermes-workspace\syndrax-sync\HERMES_TASKS.md
```

### Complete File Structure

```markdown
# HERMES_TASKS.md

## Active Tasks

[Active tasks listed here - highest priority first]

---

## In Progress

[Tasks currently being worked on]

---

## Completed Tasks

[Completed tasks with resolution notes]

---

## Blocked Tasks

[Tasks that cannot proceed - need input]

---

## Cancelled Tasks

[Tasks that are no longer needed]
```

### Task Entry Format

```markdown
### TASK-XXX [PRIORITY] Task Title
**Status:** PENDING | IN_PROGRESS | REVIEW | COMPLETED | BLOCKED | CANCELLED
**Assigned:** Cline | Hermes
**Created:** YYYY-MM-DD HH:MM:SS
**Updated:** YYYY-MM-DD HH:MM:SS

**File:** path/to/file.ts
**Line:** XXX-YYY (if applicable)

**Issue Description:**
Clear description of the problem. What's broken? What behavior is observed?
Include any error messages verbatim.

**Current Code:**
```typescript
// Paste the problematic code here
const today = new Date().toLocaleDateString();
this.scannedToday.add(today);
```

**Needed Fix:**
```typescript
// Paste the corrected code here
const today = new Date().toISOString().split('T')[0];
this.scannedToday.add(today);
```

**Reason:**
Explain WHY this fix is needed. What does the change accomplish?
This helps Cline understand the intent, not just the mechanics.

**Verification Steps:**
1. Step to verify the fix works
2. Another verification step
3. Final check

**Notes:** (optional)
Any additional context, related issues, or warnings.

---
```

### Priority Levels

| Priority | Badge | Meaning | Response Time |
|----------|-------|---------|---------------|
| CRITICAL | 🔴 | Production down, account risk | Immediate |
| HIGH | 🟠 | Blocking other work | Within 1 hour |
| MEDIUM | 🟡 | Important but not urgent | Within 4 hours |
| LOW | 🟢 | Nice to have, cleanup | When time permits |

### Status Values

| Status | Meaning | Who Updates |
|--------|---------|-------------|
| PENDING | Task created, awaiting pickup | Hermes creates |
| IN_PROGRESS | Cline is actively working | Cline updates |
| REVIEW | Fix implemented, needs verification | Cline updates |
| COMPLETED | Verified and closed | Hermes updates |
| BLOCKED | Cannot proceed, needs input | Either agent |
| CANCELLED | No longer needed | Either agent |

---

## Complete Task Example

```markdown
### TASK-001 [HIGH] Fix UTC Timezone Bug in Daily Scan
**Status:** PENDING
**Assigned:** Cline
**Created:** 2024-01-15 10:30:00
**Updated:** 2024-01-15 10:30:00

**File:** src/services/ebay-sync-controller.ts
**Line:** 145

**Issue Description:**
The daily scan memory uses local time instead of UTC. This causes:
1. Duplicate scans when timezone changes (e.g., at daylight saving time)
2. Scans missed around midnight local time
3. Inconsistent date keys when accessing from different timezones

Error observed: Same listings scanned twice on 2024-01-14 during DST transition.

**Current Code:**
```typescript
private scannedToday: Set<string> = new Set();

public async scanDaily(): Promise<void> {
  const today = new Date().toLocaleDateString();  // PROBLEM LINE
  
  if (this.scannedToday.has(today)) {
    console.log('Already scanned today');
    return;
  }
  
  this.scannedToday.add(today);
  // ... scan logic
}
```

**Needed Fix:**
```typescript
private scannedToday: Set<string> = new Set();

public async scanDaily(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];  // FIXED: Always UTC
  
  if (this.scannedToday.has(today)) {
    console.log('Already scanned today');
    return;
  }
  
  this.scannedToday.add(today);
  // ... scan logic
}
```

**Reason:**
`toLocaleDateString()` returns locale-specific strings that vary by:
- System locale ("1/15/2024" vs "15/1/2024" vs "2024/1/15")
- System timezone (changes at local midnight)

`toISOString().split('T')[0]` always returns:
- Standard "YYYY-MM-DD" format
- UTC timezone (changes at UTC midnight)

This ensures consistent date keys regardless of where/when code runs.

**Verification Steps:**
1. Run `npm run build` - must pass
2. Add console.log to verify date format is "YYYY-MM-DD"
3. Manually test by setting system clock near midnight
4. Verify scannedToday set contains properly formatted dates

**Notes:**
Related issue in `finance-tracker.ts` line 89 uses same pattern - should be fixed too.
See FINDINGS.md entry #1 for full analysis.

---
```

---

## Workflow Loop

### Standard Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. HERMES FINDS BUG                                        │
│     │                                                       │
│     ▼                                                       │
│  2. HERMES DOCUMENTS IN FINDINGS.md                         │
│     │                                                       │
│     ▼                                                       │
│  3. HERMES CREATES TASK IN HERMES_TASKS.md                  │
│     │                                                       │
│     ▼                                                       │
│  4. HERMES POSTS TO DISCORD #hermes-tasks                   │
│     │                                                       │
│     ▼                                                       │
│  5. CLINE READS #hermes-tasks / HERMES_TASKS.md             │
│     │                                                       │
│     ▼                                                       │
│  6. CLINE IMPLEMENTS FIX                                    │
│     │                                                       │
│     ▼                                                       │
│  7. CLINE COMMITS WITH [HERMES-TASK] PREFIX                 │
│     │                                                       │
│     ▼                                                       │
│  8. GITHUB WEBHOOK → DISCORD #cline-updates                 │
│     │                                                       │
│     ▼                                                       │
│  9. HERMES SEES COMMIT NOTIFICATION                         │
│     │                                                       │
│     ▼                                                       │
│  10. HERMES PULLS LATEST CODE                               │
│     │                                                       │
│     ▼                                                       │
│  11. HERMES RUNS BUILD (npm run build)                      │
│     │                                                       │
│     ├──[FAIL]──► REPORT ERROR → BACK TO STEP 5              │
│     │                                                       │
│     ▼ [PASS]                                                │
│  12. HERMES VERIFIES FIX WORKS                              │
│     │                                                       │
│     ├──[FAIL]──► CREATE NEW TASK → BACK TO STEP 3           │
│     │                                                       │
│     ▼ [PASS]                                                │
│  13. HERMES MARKS TASK COMPLETED                            │
│     │                                                       │
│     ▼                                                       │
│  14. HERMES LOGS TO HERMES_LOG.md                           │
│     │                                                       │
│     ▼                                                       │
│  15. HERMES PICKS NEXT TASK                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step Details

#### Step 1-4: Hermes Finds and Reports Bug

```typescript
// Hermes automation
async function reportBug(bug: BugReport): Promise<void> {
  // 1. Document in FINDINGS.md
  await appendToFile('FINDINGS.md', formatFinding(bug));
  
  // 2. Create task in HERMES_TASKS.md
  const task = createTask(bug);
  await appendToFile('HERMES_TASKS.md', formatTask(task));
  
  // 3. Post to Discord
  await sendToDiscord('hermes-tasks', {
    title: `📋 NEW TASK: ${task.title}`,
    description: task.description,
    fields: [
      { name: 'Priority', value: task.priority },
      { name: 'File', value: task.file },
      { name: 'Assigned', value: 'Cline' }
    ],
    mentions: ['@cline-agent']
  });
}
```

#### Step 5-7: Cline Implements Fix

```typescript
// Cline reads task
// 1. Open HERMES_TASKS.md
// 2. Find PENDING tasks
// 3. Understand the issue
// 4. Implement fix
// 5. Commit with proper format
```

**Commit Message Format:**
```
[HERMES-TASK] <task-id> <brief description>

<detailed explanation>

Files:
- path/to/changed/file.ts

Verification:
- npm run build passes
- <specific test>
```

#### Step 8-11: Hermes Verifies

```typescript
// Hermes verification
async function verifyFix(taskId: string): Promise<boolean> {
  // 1. Pull latest code
  await exec('git pull origin main');
  
  // 2. Run build
  const buildResult = await exec('npm run build');
  
  if (!buildResult.success) {
    await reportBuildFailure(buildResult.error);
    return false;
  }
  
  // 3. Run specific verification steps from task
  const task = await getTask(taskId);
  for (const step of task.verificationSteps) {
    const passed = await runVerificationStep(step);
    if (!passed) {
      await reportVerificationFailure(taskId, step);
      return false;
    }
  }
  
  return true;
}
```

#### Step 12-15: Close Task

```typescript
async function closeTask(taskId: string): Promise<void> {
  // 1. Update HERMES_TASKS.md
  await updateTaskStatus(taskId, 'COMPLETED');
  
  // 2. Log to HERMES_LOG.md
  await logTaskCompletion(taskId);
  
  // 3. Post to Discord
  await sendToDiscord('hermes-tasks', {
    title: `✅ TASK COMPLETED: ${taskId}`,
    color: 0x00FF00
  });
  
  // 4. Check for more tasks
  const nextTask = await getNextPendingTask();
  if (nextTask) {
    await notifyCline(nextTask);
  }
}
```

---

## Commit Message Format

### Required Format for Hermes-Related Commits

```
[HERMES-TASK] TASK-XXX Brief description

Detailed explanation of what was changed and why.

Files:
- src/path/to/file1.ts
- src/path/to/file2.ts

Verification:
- npm run build passes
- Specific behavior verified
```

### Examples

**Good Commit:**
```
[HERMES-TASK] TASK-001 Fix UTC timezone bug in ebay-sync-controller

Changed toLocaleDateString() to toISOString().split('T')[0] for consistent
UTC date handling. This fixes duplicate scans at timezone boundaries.

Files:
- src/services/ebay-sync-controller.ts

Verification:
- npm run build passes
- Dates in scannedToday use YYYY-MM-DD format
```

**Bad Commit (Don't do this):**
```
fixed timezone bug
```

### Why This Format?

1. **[HERMES-TASK]** prefix signals Hermes should verify
2. **TASK-XXX** links to HERMES_TASKS.md entry
3. **Files** list tells Hermes what to check
4. **Verification** tells Hermes how to confirm fix

---

## GitHub Issues Integration (Future)

### Planned Feature
Link HERMES_TASKS.md to GitHub Issues for better tracking.

### Proposed Format

```markdown
### TASK-001 [HIGH] Fix UTC Timezone Bug
**GitHub Issue:** #123
**Status:** IN_PROGRESS
...
```

### Automation Flow (Future)
```
1. Hermes creates GitHub Issue
2. Issue ID added to HERMES_TASKS.md
3. Cline references issue in commit: "Fixes #123"
4. GitHub auto-closes issue on merge
5. Hermes updates HERMES_TASKS.md to COMPLETED
```

---

## FINDINGS.md Format

### Purpose
FINDINGS.md documents all bugs, issues, and discoveries during Hermes operation. Each finding may or may not become a task.

### File Structure

```markdown
# FINDINGS.md

## Session: YYYY-MM-DD

### Finding #N - HH:MM:SS
**Type:** Bug | Performance | UI | Configuration | Security
**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Location:** path/to/file.ts:LINE
**Description:** What was found
**Evidence:** How it was detected
**Recommended Fix:** Suggested solution
**Task Created:** TASK-XXX (if applicable)
```

### Finding Example

```markdown
### Finding #1 - 10:32:15
**Type:** Bug
**Severity:** HIGH
**Location:** src/services/ebay-sync-controller.ts:145

**Description:**
UTC timezone not being applied to daily scan memory. The code uses 
toLocaleDateString() which returns locale-specific strings.

**Evidence:**
- Observed duplicate scans on 2024-01-14 during timezone transition
- Console log showed "1/14/2024" format instead of "2024-01-14"
- Same listing processed twice within 2 hours

**Recommended Fix:**
Replace `toLocaleDateString()` with `toISOString().split('T')[0]`

**Task Created:** TASK-001
```

---

## HERMES_LOG.md Format

### Purpose
HERMES_LOG.md tracks all Hermes agent activity including model usage, costs, and outcomes.

### Entry Format

```markdown
### YYYY-MM-DD HH:MM:SS
- **Task:** Brief task description
- **Model:** claude-haiku-4-5 | claude-sonnet-4-6 | llama3.1:8b | qwen2.5-coder:7b
- **Tokens:** XXXX input / YYYY output
- **Cost:** $X.XXXX
- **Duration:** XX seconds
- **Outcome:** SUCCESS | FAILURE | PARTIAL
- **Notes:** Additional context
```

### Log Example

```markdown
# HERMES_LOG.md

## 2024-01-15

### 10:30:00
- **Task:** Analyze ebay-sync-controller.ts for UTC bug
- **Model:** claude-haiku-4-5
- **Tokens:** 2,500 input / 800 output
- **Cost:** $0.0008
- **Duration:** 45 seconds
- **Outcome:** SUCCESS
- **Notes:** Bug found at line 145, task TASK-001 created

### 10:45:00
- **Task:** Verify fix for TASK-001
- **Model:** llama3.1:8b-instruct (local)
- **Tokens:** N/A (local)
- **Cost:** $0.00
- **Duration:** 12 seconds
- **Outcome:** SUCCESS
- **Notes:** Fix verified, build passes, task marked complete

### 11:00:00
- **Task:** Analyze memory usage in background-service.ts
- **Model:** claude-sonnet-4-6 (escalated)
- **Tokens:** 5,000 input / 1,500 output
- **Cost:** $0.0195
- **Duration:** 90 seconds
- **Outcome:** SUCCESS
- **Notes:** Found unbounded array growth, TASK-002 created
```

---

## Error Handling

### When Cline's Fix Doesn't Work

```
1. Hermes runs build → FAILS
2. Hermes posts to Discord:
   - Build error details
   - File and line number
   - Original task reference
3. Hermes updates HERMES_TASKS.md:
   - Task status: IN_PROGRESS (not failed)
   - Add notes about what went wrong
4. Cline receives notification
5. Cline fixes and re-commits
6. Loop continues
```

### When Verification Fails

```
1. Build passes but functionality broken
2. Hermes documents in FINDINGS.md:
   - What was tested
   - What failed
   - Expected vs actual behavior
3. Hermes creates follow-up task OR updates existing task
4. Posts to Discord with details
5. Cline investigates and fixes
```

### When Task is Blocked

```
1. Hermes or Cline encounters blocker:
   - Missing information
   - Dependency on external system
   - Design decision needed
2. Update task status to BLOCKED
3. Add blocker reason to task notes
4. Post to Discord requesting help
5. Wait for operator input
6. Once resolved, continue
```

---

## Best Practices

### For Hermes

1. **One Task at a Time**
   - Don't create 10 tasks at once
   - Create one, wait for fix, verify, then next

2. **Be Specific**
   - Include exact file paths and line numbers
   - Paste actual code snippets
   - Include error messages verbatim

3. **Provide Context**
   - Explain WHY the bug matters
   - Link to related findings
   - Note any dependencies

4. **Verify Thoroughly**
   - Don't just check if build passes
   - Run the actual functionality
   - Test edge cases from task description

### For Cline

1. **Read Full Task**
   - Don't just look at code snippets
   - Understand the reason behind the fix
   - Check the verification steps

2. **Commit Properly**
   - Use [HERMES-TASK] prefix
   - List all changed files
   - Include verification steps

3. **Test Before Committing**
   - Run `npm run build` locally
   - Verify the fix works
   - Don't commit broken code

4. **Update Task Status**
   - Mark as IN_PROGRESS when starting
   - Mark as REVIEW when done
   - Add notes if needed

### Communication

1. **Use Proper Channels**
   - #hermes-tasks for task updates
   - #cline-updates for commits
   - #hermes-findings for discoveries

2. **Be Responsive**
   - Check Discord regularly
   - Acknowledge task receipt
   - Report blockers immediately

3. **Document Everything**
   - All findings in FINDINGS.md
   - All tasks in HERMES_TASKS.md
   - All activity in HERMES_LOG.md

---

## Quick Reference

### File Locations

| File | Purpose | Who Writes | Who Reads |
|------|---------|------------|-----------|
| HERMES_TASKS.md | Task assignments | Hermes | Cline |
| FINDINGS.md | Bug documentation | Hermes | Both |
| HERMES_LOG.md | Activity log | Hermes | Both |

### Task Lifecycle

```
PENDING → IN_PROGRESS → REVIEW → COMPLETED
              ↓
           BLOCKED
              ↓
          (resolve)
              ↓
         IN_PROGRESS
```

### Key Commands

```bash
# Cline: After implementing fix
git add .
git commit -m "[HERMES-TASK] TASK-XXX description"
git push origin main

# Hermes: Verify fix
git pull origin main
npm run build
```

### Discord Mentions

| Situation | Mention |
|-----------|---------|
| New task created | @cline-agent |
| Fix needs verification | @hermes-agent |
| Task blocked | @operator |
| Urgent issue | @everyone |

---

*Last Updated: 2024*
*Version: 1.0*
*Bridge Protocol: v1.0*
