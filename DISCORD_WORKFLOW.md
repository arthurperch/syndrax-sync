# SYNDRAX SYNC - DISCORD WORKFLOW

## Overview

Discord serves as the central communication hub for the Syndrax Sync system. All agents (Hermes, Cline), automated systems, and human operators communicate through structured channels with webhooks.

**Server Name:** Syndrax Logs

---

## Server Structure

### Complete Channel Layout

```
📁 SYNDRAX LOGS
│
├── 📂 INFORMATION
│   ├── #welcome
│   ├── #agent-status
│   └── #changelog
│
├── 📂 CRITICAL ALERTS
│   ├── #build-failures
│   ├── #vero-blocked
│   ├── #margin-alerts
│   └── #account-alerts
│
├── 📂 PIPELINE ACTIVITY
│   ├── #research-updates
│   ├── #listing-created
│   ├── #price-updates
│   └── #stock-alerts
│
├── 📂 FINANCE AND PERFORMANCE
│   ├── #daily-summary
│   ├── #order-fulfilled
│   ├── #finance-reconciliation
│   └── #performance-scores
│
├── 📂 DEVELOPMENT
│   ├── #cline-updates
│   ├── #hermes-tasks
│   ├── #hermes-findings
│   └── #build-monitor
│
├── 📂 DEBUG
│   ├── #debug-research
│   ├── #debug-matching
│   ├── #debug-listing
│   └── #debug-fulfillment
│
├── 📂 STRATEGY AND INTELLIGENCE
│   ├── #competitor-analysis
│   ├── #seo-reports
│   ├── #inventory-health
│   └── #warmup-tracker
│
└── 📂 OPERATOR COMMANDS
    ├── #hermes-commands
    └── #cline-commands
```

---

## Category Details

### 📂 INFORMATION
General information and status channels.

| Channel | Purpose | Who Posts | Frequency |
|---------|---------|-----------|-----------|
| #welcome | Server welcome message, quick links | Admin | Manual |
| #agent-status | Current status of Hermes/Cline agents | Agents | Real-time |
| #changelog | Version updates, feature releases | Admin/Cline | On release |

#### #agent-status Message Format
```
🤖 HERMES STATUS UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━
Status: 🟢 ACTIVE / 🟡 IDLE / 🔴 ERROR
Current Task: [task description]
Model: claude-haiku-4-5
Uptime: 4h 32m
Last Activity: 2 minutes ago
━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 📂 CRITICAL ALERTS
High-priority alerts requiring immediate attention.

| Channel | Purpose | Triggers | Priority |
|---------|---------|----------|----------|
| #build-failures | Build compilation errors | npm run build fails | 🔴 CRITICAL |
| #vero-blocked | VERO brand detected | Product blocked by VERO filter | 🟠 HIGH |
| #margin-alerts | Profit margin below threshold | Margin <10% detected | 🟠 HIGH |
| #account-alerts | eBay account issues | Suspension risk, policy warning | 🔴 CRITICAL |

#### #build-failures Message Format
```
❌ BUILD FAILED
━━━━━━━━━━━━━━━━━━━━━━━━
Time: 2024-01-15 10:30:00 UTC
Branch: main
Commit: a1b2c3d

Error:
```
TS2307: Cannot find module '@/services/ebay'
```

File: src/background-service.ts
Line: 23

━━━━━━━━━━━━━━━━━━━━━━━━
Action Required: Fix import path
@hermes-agent @cline-agent
```

#### #vero-blocked Message Format
```
🚫 VERO BLOCK
━━━━━━━━━━━━━━━━━━━━━━━━
ASIN: B07XYZ1234
Title: Nike Air Max 90 Running Shoes
Brand: Nike (Tier 1)
Price: $129.99
━━━━━━━━━━━━━━━━━━━━━━━━
Reason: VERO protected brand
Action: Logged to filtered_out.csv
```

#### #margin-alerts Message Format
```
⚠️ LOW MARGIN ALERT
━━━━━━━━━━━━━━━━━━━━━━━━
eBay ID: 123456789012
Title: Wireless Bluetooth Earbuds
Amazon Price: $45.00 (increased from $35.00)
eBay Price: $69.99
Current Margin: 8.2% (below 10% threshold)
━━━━━━━━━━━━━━━━━━━━━━━━
Action: Listing PAUSED
Options: 
1. Increase eBay price
2. End listing
3. Monitor for price drop
```

---

### 📂 PIPELINE ACTIVITY
Activity throughout the research pipeline.

| Channel | Purpose | Events |
|---------|---------|--------|
| #research-updates | Product research progress | Product added, filtered, matched |
| #listing-created | New eBay listings | Each listing creation |
| #price-updates | Price changes | Amazon or eBay price updated |
| #stock-alerts | Stock status changes | Out of stock, back in stock |

#### #research-updates Message Format
```
🔍 [PHASE 1] PRODUCT ADDED
━━━━━━━━━━━━━━━━━━━━━━━━
ASIN: B08N5WRWNW
Title: Apple AirPods Pro 2nd Gen
Price: $249.00
Reviews: 156,234
Prime: ✅ YES
━━━━━━━━━━━━━━━━━━━━━━━━
Status: Added to research queue
Queue Position: #47
```

#### #listing-created Message Format
```
✅ [PHASE 6] LISTING CREATED
━━━━━━━━━━━━━━━━━━━━━━━━
eBay ID: 123456789012
Title: Apple AirPods Pro 2nd Gen MagSafe NEW
Category: Cell Phones & Accessories
━━━━━━━━━━━━━━━━━━━━━━━━
Amazon Source: $249.00
eBay Price: $498.00
Markup: 2.0x
Gross Margin: 50%
Net Margin: 34%
━━━━━━━━━━━━━━━━━━━━━━━━
Link: https://ebay.com/itm/123456789012
```

---

### 📂 FINANCE AND PERFORMANCE
Financial tracking and performance metrics.

| Channel | Purpose | Frequency |
|---------|---------|-----------|
| #daily-summary | End of day summary | Daily |
| #order-fulfilled | Each order fulfillment | Per order |
| #finance-reconciliation | Revenue/expense matching | Daily |
| #performance-scores | Product/seller scores | Daily |

#### #daily-summary Message Format
```
📊 DAILY SUMMARY - 2024-01-15
━━━━━━━━━━━━━━━━━━━━━━━━

📦 ORDERS
• Orders Received: 23
• Orders Fulfilled: 21
• Pending: 2

💰 REVENUE
• Gross Revenue: $11,454.00
• Amazon Costs: $5,727.00
• eBay Fees: $1,477.57
• Payment Fees: $343.62
• Net Profit: $3,905.81
• Net Margin: 34.1%

📋 LISTINGS
• Active Listings: 1,847
• Created Today: 45
• Ended Today: 12
• Paused Today: 8

🔍 RESEARCH
• Products Scanned: 500
• Products Passed: 423
• Products Blocked: 77
• Sellers Verified: 3

⚠️ ALERTS
• VERO Blocks: 34
• Low Margin Pauses: 5
• Out of Stock: 8

━━━━━━━━━━━━━━━━━━━━━━━━
Next scan in: 8 hours
```

#### #order-fulfilled Message Format
```
📦 ORDER FULFILLED
━━━━━━━━━━━━━━━━━━━━━━━━
eBay Order: 12-34567-89012
Buyer: John D. (Los Angeles, CA)
Item: Apple AirPods Pro 2nd Gen
━━━━━━━━━━━━━━━━━━━━━━━━
eBay Revenue: $498.00
Amazon Cost: $249.00
eBay Fee: $64.24
Payment Fee: $14.94
Net Profit: $169.82 (34.1%)
━━━━━━━━━━━━━━━━━━━━━━━━
Amazon Order: 111-2345678-9012345
Tracking: Coming soon
```

---

### 📂 DEVELOPMENT
Development updates and agent coordination.

| Channel | Purpose | Who Uses |
|---------|---------|----------|
| #cline-updates | Cline code commits and changes | Cline |
| #hermes-tasks | Task assignments for Hermes | Hermes/Operator |
| #hermes-findings | Bug discoveries, research notes | Hermes |
| #build-monitor | Build status tracking | Automated |

#### #cline-updates Message Format
```
💻 CODE COMMIT
━━━━━━━━━━━━━━━━━━━━━━━━
Commit: a1b2c3d4
Branch: main
Author: Cline Agent
━━━━━━━━━━━━━━━━━━━━━━━━
Message: [HERMES-TASK] Fix UTC timezone bug in ebay-sync-controller.ts

Files Changed:
• src/services/ebay-sync-controller.ts (+2, -2)

Summary:
Changed toLocaleDateString() to toISOString().split('T')[0]
for consistent UTC date handling.
━━━━━━━━━━━━━━━━━━━━━━━━
Build Status: ✅ PASSED
Verification: Pending @hermes-agent
```

#### #hermes-tasks Message Format
```
📋 NEW TASK ASSIGNED
━━━━━━━━━━━━━━━━━━━━━━━━
Task ID: TASK-002
Priority: 🟠 HIGH
Assigned: Cline
━━━━━━━━━━━━━━━━━━━━━━━━
Title: Fix unbounded session arrays
File: src/background-service.ts

Description:
Session arrays grow without limit causing memory issues.
Add cleanup logic to prevent unbounded growth.

See HERMES_TASKS.md for full details.
━━━━━━━━━━━━━━━━━━━━━━━━
@cline-agent please implement
```

---

### 📂 DEBUG
Debug mode output and verbose logging.

| Channel | Purpose | Debug Mode |
|---------|---------|------------|
| #debug-research | Product research debug output | Research phase |
| #debug-matching | Product DNA matching debug | Matching phase |
| #debug-listing | Listing creation debug | Listing phase |
| #debug-fulfillment | Order fulfillment debug | Fulfillment phase |

#### Debug Message Format
```
🔧 DEBUG: Research Phase
━━━━━━━━━━━━━━━━━━━━━━━━
Timestamp: 2024-01-15T10:30:15.123Z
Product: 47/500
ASIN: B08N5WRWNW
━━━━━━━━━━━━━━━━━━━━━━━━
Step: Filter check
Filter: VERO Brands
Result: PASSED (no brand match)
Duration: 12ms
━━━━━━━━━━━━━━━━━━━━━━━━
Next: Checking fragile_liquid filter
```

---

### 📂 STRATEGY AND INTELLIGENCE
Strategic insights and competitive analysis.

| Channel | Purpose | Frequency |
|---------|---------|-----------|
| #competitor-analysis | Competitor pricing/strategy intel | Weekly |
| #seo-reports | Keyword performance, title analysis | Daily |
| #inventory-health | Inventory age, performance scores | Daily |
| #warmup-tracker | Account warmup progress | Daily |

#### #competitor-analysis Message Format
```
🎯 COMPETITOR ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━
Category: Wireless Earbuds
Date: 2024-01-15
━━━━━━━━━━━━━━━━━━━━━━━━
Top Sellers:
1. dropship_deals_2024 (2,341 sales)
2. best_prices_shop (1,892 sales)
3. techzone_outlet (1,456 sales)

Average Pricing:
• AirPods Pro 2: $459 avg (our price: $498)
• Galaxy Buds2: $189 avg (our price: $199)
• Sony WH-1000XM5: $329 avg (our price: $349)

Recommendations:
• Lower AirPods Pro price to $469
• Galaxy Buds pricing is competitive
• Sony headphones can go higher
━━━━━━━━━━━━━━━━━━━━━━━━
```

#### #warmup-tracker Message Format
```
🌡️ WARMUP PROGRESS
━━━━━━━━━━━━━━━━━━━━━━━━
Account: syndrax_store
Age: 12 days
Week: 2 of warmup
━━━━━━━━━━━━━━━━━━━━━━━━
Today's Activity:
• Listings Created: 5/5 ✅
• Product Type: Books (warmup safe)
• Price Level: HIGH (no sales intended)

Warmup Stats:
• Total Listings: 45
• Total Sales: 0 (expected)
• Trust Score: 25/100

Progress Bar:
[████████░░░░░░░░░░░░] 40%

━━━━━━━━━━━━━━━━━━━━━━━━
Next Phase: Week 3 (25 listings/day)
Days Remaining: 2
```

---

### 📂 OPERATOR COMMANDS
Human operator commands to agents.

| Channel | Purpose | Who Listens |
|---------|---------|-------------|
| #hermes-commands | Commands for Hermes agent | Hermes |
| #cline-commands | Commands for Cline agent | Cline |

#### Command Format
```
@hermes-agent [COMMAND] [PARAMETERS]

Examples:
@hermes-agent status
@hermes-agent scan https://ebay.com/usr/sellername
@hermes-agent build
@hermes-agent debug on
@hermes-agent verify a1b2c3d
@hermes-agent pause
@hermes-agent resume
@hermes-agent idle
```

---

## Webhook System

### Webhook Configuration

```typescript
// discord_webhooks.json
{
  "webhooks": {
    // CRITICAL ALERTS
    "build-failures": "https://discord.com/api/webhooks/xxx/yyy",
    "vero-blocked": "https://discord.com/api/webhooks/xxx/yyy",
    "margin-alerts": "https://discord.com/api/webhooks/xxx/yyy",
    "account-alerts": "https://discord.com/api/webhooks/xxx/yyy",
    
    // PIPELINE ACTIVITY
    "research-updates": "https://discord.com/api/webhooks/xxx/yyy",
    "listing-created": "https://discord.com/api/webhooks/xxx/yyy",
    "price-updates": "https://discord.com/api/webhooks/xxx/yyy",
    "stock-alerts": "https://discord.com/api/webhooks/xxx/yyy",
    
    // FINANCE
    "daily-summary": "https://discord.com/api/webhooks/xxx/yyy",
    "order-fulfilled": "https://discord.com/api/webhooks/xxx/yyy",
    "finance-reconciliation": "https://discord.com/api/webhooks/xxx/yyy",
    
    // DEVELOPMENT
    "cline-updates": "https://discord.com/api/webhooks/xxx/yyy",
    "hermes-tasks": "https://discord.com/api/webhooks/xxx/yyy",
    "hermes-findings": "https://discord.com/api/webhooks/xxx/yyy",
    "build-monitor": "https://discord.com/api/webhooks/xxx/yyy",
    
    // DEBUG
    "debug-research": "https://discord.com/api/webhooks/xxx/yyy",
    "debug-matching": "https://discord.com/api/webhooks/xxx/yyy",
    "debug-listing": "https://discord.com/api/webhooks/xxx/yyy",
    
    // STRATEGY
    "inventory-health": "https://discord.com/api/webhooks/xxx/yyy",
    "warmup-tracker": "https://discord.com/api/webhooks/xxx/yyy"
  }
}
```

### Standardized Webhook Message Format

```typescript
interface DiscordWebhookMessage {
  // Required fields
  agentName: 'HERMES' | 'CLINE' | 'SYSTEM';
  channel: string;           // Target channel name
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  timestamp: string;         // ISO 8601 format
  
  // Message content
  title: string;
  description: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  
  // Optional
  color?: number;            // Hex color for embed
  footer?: string;
  mentions?: string[];       // User/role IDs to ping
}

// Color codes by priority
const PRIORITY_COLORS = {
  CRITICAL: 0xFF0000,  // Red
  HIGH: 0xFF8C00,      // Dark Orange
  MEDIUM: 0xFFD700,    // Gold
  LOW: 0x00CED1,       // Dark Turquoise
  INFO: 0x808080       // Gray
};
```

### Webhook Sending Implementation

```typescript
// services/discord-webhook.ts

import webhookConfig from '../../discord_webhooks.json';

interface SendOptions {
  channel: string;
  title: string;
  description: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  mentions?: string[];
}

export async function sendToDiscord(options: SendOptions): Promise<void> {
  const webhookUrl = webhookConfig.webhooks[options.channel];
  
  if (!webhookUrl) {
    console.error(`No webhook configured for channel: ${options.channel}`);
    return;
  }
  
  const embed = {
    title: options.title,
    description: options.description,
    color: PRIORITY_COLORS[options.priority || 'INFO'],
    fields: options.fields || [],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Syndrax Sync'
    }
  };
  
  const body: any = {
    embeds: [embed]
  };
  
  // Add mentions
  if (options.mentions && options.mentions.length > 0) {
    body.content = options.mentions.map(m => `<@${m}>`).join(' ');
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      console.error('Discord webhook failed:', response.status);
    }
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}

// Convenience functions
export const sendBuildFailure = (error: string, file: string) => 
  sendToDiscord({
    channel: 'build-failures',
    title: '❌ BUILD FAILED',
    description: error,
    priority: 'CRITICAL',
    fields: [{ name: 'File', value: file }]
  });

export const sendVEROBlock = (asin: string, brand: string, title: string) =>
  sendToDiscord({
    channel: 'vero-blocked',
    title: '🚫 VERO BLOCK',
    description: `Blocked: ${title}`,
    priority: 'HIGH',
    fields: [
      { name: 'ASIN', value: asin, inline: true },
      { name: 'Brand', value: brand, inline: true }
    ]
  });

export const sendListingCreated = (ebayId: string, title: string, price: number) =>
  sendToDiscord({
    channel: 'listing-created',
    title: '✅ LISTING CREATED',
    description: title,
    priority: 'INFO',
    fields: [
      { name: 'eBay ID', value: ebayId, inline: true },
      { name: 'Price', value: `$${price.toFixed(2)}`, inline: true }
    ]
  });
```

---

## Webhook Channel Mapping

### Which Events Go To Which Channels

| Event Type | Channel | Priority |
|------------|---------|----------|
| Build fails | #build-failures | CRITICAL |
| Build passes | #build-monitor | INFO |
| VERO brand blocked | #vero-blocked | HIGH |
| Banned item blocked | #vero-blocked | HIGH |
| Margin below threshold | #margin-alerts | HIGH |
| Account warning | #account-alerts | CRITICAL |
| Product added to queue | #research-updates | INFO |
| Product filtered out | #research-updates | LOW |
| Product matched | #research-updates | INFO |
| Seller verified | #research-updates | INFO |
| Listing created | #listing-created | INFO |
| Listing paused | #stock-alerts | MEDIUM |
| Listing ended | #stock-alerts | LOW |
| Price increased | #price-updates | INFO |
| Price decreased | #price-updates | INFO |
| Out of stock | #stock-alerts | MEDIUM |
| Back in stock | #stock-alerts | INFO |
| Order received | #order-fulfilled | INFO |
| Order fulfilled | #order-fulfilled | INFO |
| Daily summary | #daily-summary | INFO |
| Cline commit | #cline-updates | INFO |
| Hermes task created | #hermes-tasks | MEDIUM |
| Hermes finding | #hermes-findings | MEDIUM |
| Debug output | #debug-* | LOW |

---

## Cline Structured Prompt Format

### Git Commit Message Format

When Cline commits code, use this format for Hermes to parse:

```
[HERMES-TASK] <action> <context>

<detailed description>

Files:
- path/to/file1.ts
- path/to/file2.ts

Verification:
- <step 1>
- <step 2>
```

### Example Commit
```
[HERMES-TASK] Fix UTC timezone bug in ebay-sync-controller.ts

Changed toLocaleDateString() to toISOString().split('T')[0] for consistent
UTC date handling across all timezones.

Files:
- src/services/ebay-sync-controller.ts

Verification:
- npm run build should pass
- Dates in scannedToday should be YYYY-MM-DD format
- No duplicate scans should occur at midnight
```

### Discord Notification from Commit

```
@hermes-agent [TASK] [ACTION] [CONTEXT] [EXPECTED] [FINDINGS]

Example:
@hermes-agent [TASK-001] [IMPLEMENTED] [UTC timezone fix] [Build passes, dates are UTC] [Please verify]
```

---

## Bidirectional Communication Flow

### Cline → Hermes Flow

```
1. Cline makes code change
2. Cline commits with [HERMES-TASK] prefix
3. GitHub webhook triggers on push
4. Discord receives commit notification in #cline-updates
5. Hermes reads #cline-updates
6. Hermes pulls latest code
7. Hermes runs build
8. Hermes verifies fix works
9. Hermes updates #hermes-tasks with result
10. Hermes marks task complete in HERMES_TASKS.md
```

### Hermes → Cline Flow

```
1. Hermes discovers bug during operation
2. Hermes documents in FINDINGS.md
3. Hermes creates task in HERMES_TASKS.md
4. Hermes posts to #hermes-tasks with @cline-agent mention
5. Cline reads #hermes-tasks
6. Cline opens HERMES_TASKS.md
7. Cline implements fix
8. (Flow continues as Cline → Hermes)
```

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMUNICATION FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   HERMES                  DISCORD                   CLINE   │
│   (VPS)                   (HUB)                   (LOCAL)   │
│     │                       │                         │     │
│     │──[Bug Found]──────────┼─────────────────────────│     │
│     │                       │                         │     │
│     │──[FINDINGS.md]────────│                         │     │
│     │──[HERMES_TASKS.md]────│                         │     │
│     │                       │                         │     │
│     │───────────────────►[#hermes-tasks]──────────────│     │
│     │                       │                         │     │
│     │                       │◄──[Cline reads]─────────│     │
│     │                       │                         │     │
│     │                       │                    [Implements]│
│     │                       │                         │     │
│     │                       │◄──[Git commit]──────────│     │
│     │                       │                         │     │
│     │◄──[#cline-updates]────│                         │     │
│     │                       │                         │     │
│  [Pull]                     │                         │     │
│  [Build]                    │                         │     │
│  [Verify]                   │                         │     │
│     │                       │                         │     │
│     │───────────────────►[#hermes-tasks]──────────────│     │
│     │   [TASK COMPLETE]     │                         │     │
│     │                       │                         │     │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Creating Webhooks

1. Go to Discord Server Settings
2. Click "Integrations" → "Webhooks"
3. Click "New Webhook"
4. Name it (e.g., "build-failures")
5. Select target channel
6. Copy webhook URL
7. Add to `discord_webhooks.json`

### Webhook URL Format
```
https://discord.com/api/webhooks/{webhook.id}/{webhook.token}
```

### Testing Webhooks

```bash
# Test with curl
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message", "embeds": [{"title": "Test", "description": "This is a test"}]}' \
  "YOUR_WEBHOOK_URL"
```

---

## Rate Limits

### Discord Rate Limits
- **30 messages per minute** per webhook
- **10 messages per 10 seconds** per channel
- Best practice: batch non-critical messages

### Handling Rate Limits

```typescript
const messageQueue: QueuedMessage[] = [];
let isProcessing = false;

async function queueMessage(options: SendOptions): Promise<void> {
  messageQueue.push({
    options,
    timestamp: Date.now()
  });
  
  if (!isProcessing) {
    processQueue();
  }
}

async function processQueue(): Promise<void> {
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    
    try {
      await sendToDiscord(message.options);
    } catch (error) {
      if (error.message.includes('rate limit')) {
        // Wait and retry
        await sleep(5000);
        messageQueue.unshift(message);
      }
    }
    
    // Throttle: max 2 messages per second
    await sleep(500);
  }
  
  isProcessing = false;
}
```

---

## Best Practices

### Message Guidelines

1. **Be Concise** - Use structured formats, not paragraphs
2. **Use Embeds** - More readable than plain text
3. **Include Context** - Link to files, commits, or docs
4. **Appropriate Priority** - Don't overuse CRITICAL
5. **Batch Debug Output** - Don't spam debug channels

### Channel Usage

1. **#build-failures** - Only actual build errors
2. **#vero-blocked** - VERO and banned item blocks only
3. **#daily-summary** - One message per day
4. **#debug-*** - Only when debug mode is ON

### Mention Guidelines

| Situation | Who to Mention |
|-----------|----------------|
| Build failure | @hermes-agent @cline-agent |
| VERO block | None (automated logging) |
| Account alert | @operator |
| Task assignment | Target agent |
| Task complete | Opposite agent |

---

*Last Updated: 2024*
*Version: 1.0*
*Server: Syndrax Logs*
