const WEBHOOKS = {
  // Existing channels
  logs:           'https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m',
  errors:         'https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-',
  priceUpdates:   'https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY',
  outOfStock:     'https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS',
  // New channels
  variantAlerts:  'https://discord.com/api/webhooks/1504718905489231972/fEr_SUxMKUON5IMhqW9LSAf8LlF0OkCxMbS5M168S0oPb5a8RIHQrJyOj6wdHaC0vrPI',
  fingerprintLog: 'https://discord.com/api/webhooks/1504719051027386508/xH26ae_MBs7GyDVgQfWwaYzjIIJNKpvI032Wkq9yCbUq92kfwG8E69VG_nxNilMLJSyy',
  dailySummary:   'https://discord.com/api/webhooks/1504719193684054180/I_BkYjc3oT--dSExLekK8HCUTE63GbASpzlbDCJ_NVgNCkOGZlttjEAgF3tIEKJAQeHb'
};

type WebhookChannel = keyof typeof WEBHOOKS;

const webhookNames: Record<WebhookChannel, string> = {
  logs:           'Syndrax Sync',
  errors:         'Syndrax Alert System',
  priceUpdates:   'Syndrax PriceBot',
  outOfStock:     'Syndrax StockBot',
  variantAlerts:  'Syndrax VariantBot',
  fingerprintLog: 'Syndrax Fingerprint',
  dailySummary:   'Syndrax Daily Report'
};

// Get human-readable time
function getTimeString(): string {
  const now = new Date();
  return now.toLocaleString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles'
  });
}

async function sendWebhook(channel: WebhookChannel, embed: object, username?: string) {
  try {
    await fetch(WEBHOOKS[channel], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username || webhookNames[channel],
        avatar_url: 'https://syndrax.io/assets/images/logo.png',
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error(`Discord webhook failed [${channel}]:`, err);
  }
}

// Helper to increment daily stat and optionally store item data
export async function incrementStat(
  key: string,
  itemData?: {
    title?: string;
    listingId?: string;
    asin?: string;
    oldPrice?: number;
    newPrice?: number;
    direction?: string;
    variantLabel?: string;
  }
): Promise<void> {
  const result = await chrome.storage.local.get('syndrax_daily_stats');
  const stats = result.syndrax_daily_stats || {};
  stats[key] = (stats[key] || 0) + 1;

  if (key === 'outOfStock' && itemData) {
    stats.qtyZeroed = (stats.qtyZeroed || 0) + 1;
    stats.outOfStockItems = [
      ...(stats.outOfStockItems || []),
      { title: itemData.title, listingId: itemData.listingId, asin: itemData.asin, variantLabel: itemData.variantLabel }
    ].slice(-50);
  }

  if (key === 'priceUpdates' && itemData) {
    if (itemData.direction === 'up') stats.priceIncreased = (stats.priceIncreased || 0) + 1;
    if (itemData.direction === 'down') stats.priceDecreased = (stats.priceDecreased || 0) + 1;
    stats.priceChangeItems = [
      ...(stats.priceChangeItems || []),
      { title: itemData.title, listingId: itemData.listingId, oldPrice: itemData.oldPrice, newPrice: itemData.newPrice, direction: itemData.direction }
    ].slice(-50);
  }

  await chrome.storage.local.set({ syndrax_daily_stats: stats });
}

// Ping test all webhooks to verify connections
export async function pingAllWebhooks(): Promise<{ channel: string; success: boolean; error?: string }[]> {
  const results: { channel: string; success: boolean; error?: string }[] = [];
  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' });
  
  const channels = Object.keys(WEBHOOKS) as WebhookChannel[];
  
  for (const channel of channels) {
    try {
      const response = await fetch(WEBHOOKS[channel], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: webhookNames[channel],
          avatar_url: 'https://syndrax.io/assets/images/logo.png',
          embeds: [{
            title: `✅ Webhook Connection Test — #${channel}`,
            description: `This channel is connected and receiving messages from Syndrax Sync.`,
            color: 0x00FF88,
            fields: [
              { name: '🕐 Time', value: timestamp, inline: true },
              { name: '📡 Channel', value: `#${channel}`, inline: true },
              { name: '🤖 Bot', value: webhookNames[channel], inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Syndrax Sync — Connection Test' }
          }]
        })
      });
      
      if (response.ok) {
        results.push({ channel, success: true });
        console.log(`[Discord] ✅ Ping successful: #${channel}`);
      } else {
        results.push({ channel, success: false, error: `HTTP ${response.status}` });
        console.error(`[Discord] ❌ Ping failed: #${channel} — HTTP ${response.status}`);
      }
    } catch (err) {
      results.push({ channel, success: false, error: String(err) });
      console.error(`[Discord] ❌ Ping failed: #${channel}:`, err);
    }
    
    // Small delay between webhooks to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Send summary to logs channel
  const successCount = results.filter(r => r.success).length;
  const failedChannels = results.filter(r => !r.success);
  
  if (failedChannels.length > 0) {
    await sendWebhook('logs', {
      title: `⚠️ Webhook Test — ${successCount}/${channels.length} Connected`,
      description: `Some webhooks failed to connect. Check the URLs below.`,
      color: 0xFF8C00,
      fields: [
        { name: '✅ Connected', value: results.filter(r => r.success).map(r => `#${r.channel}`).join(', ') || 'None', inline: false },
        { name: '❌ Failed', value: failedChannels.map(r => `#${r.channel}: ${r.error}`).join('\n'), inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Syndrax Sync — Connection Test' }
    });
  }
  
  return results;
}

// Send daily summary to the daily summary webhook
export async function sendDailySummaryWebhook(): Promise<void> {
  const result = await chrome.storage.local.get('syndrax_daily_stats');
  const stats = result.syndrax_daily_stats || {};
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  await sendWebhook('dailySummary', {
    title: `📊 Daily Summary — ${today}`,
    description: 'Your complete Syndrax Sync activity report for today',
    color: 0x7A5CFF,
    fields: [
      {
        name: '📦 Inventory Activity',
        value: [
          `Total Scanned: **${stats.totalScanned || 0}**`,
          `Syncs Run: **${stats.syncsRun || 0}**`,
          `Pages Processed: **${stats.pagesProcessed || 0}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '💰 Price Activity',
        value: [
          `Updated: **${stats.priceUpdates || 0}**`,
          `Increased: **${stats.priceIncreased || 0}**`,
          `Decreased: **${stats.priceDecreased || 0}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '🚫 Stock Activity',
        value: [
          `Out of Stock: **${stats.outOfStock || 0}**`,
          `Back in Stock: **${stats.backInStock || 0}**`,
          `Qty Set to 0: **${stats.qtyZeroed || 0}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '🔍 Variant Activity',
        value: [
          `Variants Found: **${stats.variantsDetected || 0}**`,
          `Mismatches: **${stats.variantMismatches || 0}**`,
          `Child ASINs Stored: **${stats.childAsinsStored || 0}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '🔬 Fingerprint Activity',
        value: [
          `Baselines Captured: **${stats.baselinesCapture || 0}**`,
          `Changes Flagged: **${stats.fingerprintFlags || 0}**`,
          `Auto Delisted: **${stats.fingerprintDelists || 0}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '🚨 Error Activity',
        value: [
          `Scrape Errors: **${stats.scrapeErrors || 0}**`,
          `ASIN Removed: **${stats.asinRemoved || 0}**`,
          `ASIN Hijacked: **${stats.asinHijacked || 0}**`,
          `No ASIN Found: **${stats.noAsin || 0}**`,
          `CAPTCHA Hit: **${stats.captchaHits || 0}**`
        ].join('\n'),
        inline: true
      },
      // Top out of stock items
      ...(stats.outOfStockItems?.length > 0 ? [{
        name: `🚫 Items Out of Stock Today (${stats.outOfStockItems.length})`,
        value: stats.outOfStockItems
          .slice(0, 8)
          .map((i: { title: string; listingId: string; asin: string }) => `• \`${i.asin}\` — ${i.title.substring(0, 35)}\n  [eBay](https://www.ebay.com/itm/${i.listingId})`)
          .join('\n'),
        inline: false
      }] : [{
        name: '🚫 Out of Stock Today',
        value: '✅ No items went out of stock today',
        inline: false
      }]),
      // Top price changes
      ...(stats.priceChangeItems?.length > 0 ? [{
        name: `💰 Price Changes Today (${stats.priceChangeItems.length})`,
        value: stats.priceChangeItems
          .slice(0, 8)
          .map((i: { direction: string; title: string; oldPrice?: number; newPrice?: number }) => `• ${i.direction === 'up' ? '📈' : '📉'} ${i.title.substring(0, 30)} — $${i.oldPrice?.toFixed(2)} → $${i.newPrice?.toFixed(2)}`)
          .join('\n'),
        inline: false
      }] : [{
        name: '💰 Price Changes Today',
        value: '✅ No price changes today',
        inline: false
      }]),
      // Critical alerts
      ...(stats.asinRemoved > 0 || stats.asinHijacked > 0 || stats.fingerprintDelists > 0 ? [{
        name: '🚨 Critical Events Today — Review Required',
        value: [
          stats.asinRemoved > 0 ? `💀 ${stats.asinRemoved} product(s) removed from Amazon` : '',
          stats.asinHijacked > 0 ? `🔄 ${stats.asinHijacked} ASIN hijack(s) detected` : '',
          stats.fingerprintDelists > 0 ? `🚨 ${stats.fingerprintDelists} listing(s) auto-delisted` : ''
        ].filter(Boolean).join('\n'),
        inline: false
      }] : [])
    ],
    timestamp: new Date().toISOString(),
    footer: { text: `Syndrax Sync Daily Report | ${today}` }
  });

  // Reset daily stats after sending report
  await chrome.storage.local.set({
    syndrax_daily_stats: {
      totalScanned: 0,
      syncsRun: 0,
      pagesProcessed: 0,
      priceUpdates: 0,
      priceIncreased: 0,
      priceDecreased: 0,
      outOfStock: 0,
      backInStock: 0,
      qtyZeroed: 0,
      variantsDetected: 0,
      variantMismatches: 0,
      childAsinsStored: 0,
      baselinesCapture: 0,
      fingerprintFlags: 0,
      fingerprintDelists: 0,
      scrapeErrors: 0,
      asinRemoved: 0,
      asinHijacked: 0,
      noAsin: 0,
      captchaHits: 0,
      outOfStockItems: [],
      priceChangeItems: []
    }
  });
}

export const discord = {

  syncStarted: (totalItems: number) => sendWebhook('logs', {
    title: '⚡ SYNC STARTED',
    description: [
      `🕐 **Time:** ${getTimeString()}`,
      `📦 **Listings to Check:** ${totalItems}`,
      ``,
      `Starting price & stock check on eBay Active Listings...`,
      ``,
      `> Amazon tabs will open in background`,
      `> Each item checked against live Amazon data`,
      `> Price updates applied with 2x markup rule`
    ].join('\n'),
    color: 0x00CFFF,
    timestamp: new Date().toISOString(),
    footer: { text: '🔄 Checking prices on Amazon...' }
  }),

  syncComplete: (stats: {
    checked: number;
    updated: number;
    outOfStock: number;
    flagged: number;
    errors: number;
    duration: string;
  }) => {
    const healthScore = stats.errors === 0 ? '✅ Healthy' : stats.errors < 3 ? '⚠️ Minor Issues' : '❌ Issues Found';
    const successRate = stats.checked > 0 ? ((stats.checked - stats.errors) / stats.checked * 100).toFixed(1) : '100';
    
    return sendWebhook('logs', {
      title: '✅ SYNC COMPLETE',
      description: [
        `🕐 **Finished:** ${getTimeString()}`,
        `⏱️ **Duration:** ${stats.duration}`,
        `📊 **Success Rate:** ${successRate}%`,
        `🏥 **Health:** ${healthScore}`,
        ``,
        `**📋 Summary:**`
      ].join('\n'),
      color: stats.errors === 0 ? 0x00FF88 : 0xFFD700,
      fields: [
        { name: '📦 Checked', value: `**${stats.checked}**\nitems scanned`, inline: true },
        { name: '💰 Updated', value: `**${stats.updated}**\nprices changed`, inline: true },
        { name: '🔴 Out of Stock', value: `**${stats.outOfStock}**\nset to qty 0`, inline: true },
        { name: '⚠️ Flagged', value: `**${stats.flagged}**\nneeds review`, inline: true },
        { name: '❌ Errors', value: `**${stats.errors}**\nfailed items`, inline: true },
        { name: '✅ All Good', value: `**${stats.checked - stats.updated - stats.outOfStock - stats.flagged - stats.errors}**\nno changes`, inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: '✨ Next sync will skip already-scanned items today' }
    });
  },

  priceUpdated: (item: {
    title: string;
    listingId: string;
    oldPrice: number;
    newPrice: number;
    amazonPrice: number;
    direction: 'up' | 'down';
  }) => {
    const changeAmount = Math.abs(item.newPrice - item.oldPrice).toFixed(2);
    const changePercent = ((Math.abs(item.newPrice - item.oldPrice) / item.oldPrice) * 100).toFixed(1);
    const profit = (item.newPrice - item.amazonPrice).toFixed(2);
    const margin = ((item.newPrice - item.amazonPrice) / item.newPrice * 100).toFixed(1);
    
    return sendWebhook('priceUpdates', {
      title: item.direction === 'up' ? '📈 PRICE INCREASED' : '📉 PRICE DECREASED',
      description: [
        `**${item.title.substring(0, 80)}**`,
        ``,
        item.direction === 'up' 
          ? `🔺 Price went UP by $${changeAmount} (${changePercent}%)` 
          : `🔻 Price went DOWN by $${changeAmount} (${changePercent}%)`,
        ``,
        `**💵 Profit per Sale:** $${profit}`,
        `**📊 Margin:** ${margin}%`
      ].join('\n'),
      color: item.direction === 'up' ? 0xFFD700 : 0x00FF88,
      fields: [
        { name: '📦 Amazon Cost', value: `$${item.amazonPrice.toFixed(2)}`, inline: true },
        { name: '🏷️ Was', value: `~~$${item.oldPrice.toFixed(2)}~~`, inline: true },
        { name: '✅ Now', value: `**$${item.newPrice.toFixed(2)}**`, inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `Listing ID: ${item.listingId}` }
    });
  },

  outOfStock: (item: {
    title: string;
    listingId: string;
    amazonUrl: string;
    amazonPrice: number;
    // Variant fields (optional)
    selectedVariantLabel?: string;
    variantLabel?: string;
    currentChildAsin?: string;
    asin?: string;
    allVariants?: Array<{ available: boolean; label: string; asin: string }>;
  }) => sendWebhook('outOfStock', {
    title: '🚫 OUT OF STOCK — Set to Qty 0',
    description: [
      `**${item.title.substring(0, 80)}**`,
      ``,
      `⚠️ **Amazon source is out of stock!**`,
      `✅ eBay listing quantity set to 0 to prevent sales`,
      ``,
      `> When Amazon restocks, next sync will set qty back to 1`
    ].join('\n'),
    color: 0xFF3D3D,
    fields: [
      { name: '💰 Last Price', value: item.amazonPrice > 0 ? `$${item.amazonPrice.toFixed(2)}` : 'N/A', inline: true },
      { name: '🔗 eBay', value: `[View Listing](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: '🔗 Amazon', value: `[Check Source](${item.amazonUrl})`, inline: true },
      // Variant-specific fields
      { name: '📐 Exact Variant Checked', value: item.selectedVariantLabel || item.variantLabel || 'Single variant product', inline: true },
      { name: '🔑 Child ASIN', value: item.currentChildAsin || item.asin || 'N/A', inline: true },
      { name: '🔗 Exact URL', value: `[View Exact Variant](https://www.amazon.com/dp/${item.currentChildAsin || item.asin}?th=1&psc=1)`, inline: true },
      // All variants status (if available)
      ...(item.allVariants && item.allVariants.length > 0 ? [{
        name: '📊 All Variants Available',
        value: item.allVariants
          .slice(0, 8)
          .map(v => `${v.available ? '✅' : '❌'} ${v.label} (${v.asin})`)
          .join('\n') || 'Could not detect variants',
        inline: false
      }] : [])
    ],
    timestamp: new Date().toISOString(),
    footer: { text: '⏳ Will auto-restock when Amazon has inventory' }
  }),

  restocked: (item: {
    title: string;
    listingId: string;
    amazonPrice: number;
    ebayPrice: number;
  }) => sendWebhook('logs', {
    title: '💚 RESTOCKED — Back in Stock!',
    description: [
      `**${item.title.substring(0, 80)}**`,
      ``,
      `✅ **Amazon is back in stock!**`,
      `✅ eBay listing quantity set to 1`,
      ``,
      `This item was previously out of stock and is now available again.`
    ].join('\n'),
    color: 0x00FF88,
    fields: [
      { name: '📦 Amazon Price', value: `$${item.amazonPrice.toFixed(2)}`, inline: true },
      { name: '🏷️ eBay Price', value: `$${item.ebayPrice.toFixed(2)}`, inline: true },
      { name: '💵 Profit', value: `$${(item.ebayPrice - item.amazonPrice).toFixed(2)}`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: `Listing ID: ${item.listingId}` }
  }),

  wrongItem: (item: {
    title: string;
    listingId: string;
    amazonTitle: string;
    similarity: number;
    asin: string;
  }) => sendWebhook('errors', {
    title: '⚠️ WRONG ITEM — Manual Review Needed',
    description: [
      `The eBay listing doesn't seem to match the Amazon product.`,
      ``,
      `**📦 eBay Title:**`,
      `> ${item.title.substring(0, 100)}`,
      ``,
      `**🔗 Amazon Title:**`,
      `> ${item.amazonTitle.substring(0, 100)}`,
      ``,
      `⚠️ **Match Score:** Only ${(item.similarity * 100).toFixed(0)}% similar`
    ].join('\n'),
    color: 0xFF8C00,
    fields: [
      { name: '🔖 ASIN', value: item.asin, inline: true },
      { name: '🔗 eBay', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: '🔗 Amazon', value: `[View](https://amazon.com/dp/${item.asin})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: '👆 Please verify the correct Amazon ASIN is in the SKU' }
  }),

  error: (item: {
    title: string;
    listingId: string;
    error: string;
    asin: string;
  }) => sendWebhook('errors', {
    title: '🔴 SYNC ERROR',
    description: [
      `**${item.title.substring(0, 80)}**`,
      ``,
      `❌ **Error:** ${item.error.substring(0, 200)}`,
      ``,
      `This item could not be processed. May need manual check.`
    ].join('\n'),
    color: 0xFF0000,
    fields: [
      { name: '🔖 ASIN', value: item.asin || 'Unknown', inline: true },
      { name: '📋 Listing ID', value: item.listingId, inline: true },
      { name: '🔗 eBay', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: '🔧 Check Amazon page manually' }
  }),

  progress: (checked: number, total: number, updated: number, outOfStock: number, pageNum: number) => {
    // Only send every 25 items or on page change
    if (checked % 25 !== 0 && checked !== total) return;
    
    const percentComplete = Math.round(checked / total * 100);
    const eta = checked > 0 ? Math.round((total - checked) * 3 / 60) : 0; // ~3 sec per item
    
    return sendWebhook('logs', {
      title: `🔄 SYNC PROGRESS — ${percentComplete}%`,
      description: [
        `📄 **Page ${pageNum}** | Checked **${checked}** of **${total}** items`,
        ``,
        `${'█'.repeat(Math.floor(percentComplete / 5))}${'░'.repeat(20 - Math.floor(percentComplete / 5))} ${percentComplete}%`,
        ``,
        eta > 0 ? `⏳ Est. ${eta} min remaining` : `🏁 Almost done!`
      ].join('\n'),
      color: 0x7A5CFF,
      fields: [
        { name: '💰 Updated', value: String(updated), inline: true },
        { name: '🔴 OOS', value: String(outOfStock), inline: true },
        { name: '✅ OK', value: String(checked - updated - outOfStock), inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `Page ${pageNum} | ${getTimeString()}` }
    });
  },

  pageComplete: (pageNum: number, stats: {
    pageChecked: number;
    pageUpdated: number;
    pageOOS: number;
    totalChecked: number;
    totalPages: number;
  }) => sendWebhook('logs', {
    title: `📄 PAGE ${pageNum} COMPLETE`,
    description: [
      `Finished scanning page ${pageNum}`,
      ``,
      `**This Page:**`,
      `• Checked: ${stats.pageChecked} items`,
      `• Updated: ${stats.pageUpdated} prices`,
      `• Out of Stock: ${stats.pageOOS}`,
      ``,
      `**Total Progress:** ${stats.totalChecked} items across ${pageNum} pages`
    ].join('\n'),
    color: 0x7A5CFF,
    timestamp: new Date().toISOString(),
    footer: { text: `Moving to page ${pageNum + 1}...` }
  }),

  dryRunComplete: (results: {
    wouldUpdate: number;
    wouldMarkOutOfStock: number;
    wouldFlag: number;
    wouldError: number;
    total: number;
  }) => sendWebhook('logs', {
    title: '🧪 DRY RUN COMPLETE — No Changes Made',
    description: [
      `This was a test run. **No actual changes** were made to your listings.`,
      ``,
      `**📋 What a LIVE sync would do:**`
    ].join('\n'),
    color: 0x7A5CFF,
    fields: [
      { name: '💰 Update Prices', value: `${results.wouldUpdate} items`, inline: true },
      { name: '🔴 Mark OOS', value: `${results.wouldMarkOutOfStock} items`, inline: true },
      { name: '⚠️ Flag Wrong', value: `${results.wouldFlag} items`, inline: true },
      { name: '❌ Errors', value: `${results.wouldError} items`, inline: true },
      { name: '📦 Total Scanned', value: `${results.total} items`, inline: true },
      { name: '✅ No Changes', value: `${results.total - results.wouldUpdate - results.wouldMarkOutOfStock - results.wouldFlag - results.wouldError}`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: '🔄 Run a live sync to apply these changes' }
  }),

  noAsin: (item: { title: string; listingId: string; rawSku: string }) =>
    sendWebhook('errors', {
      title: '⚪ NO ASIN FOUND — Skipped',
      description: [
        `**${item.title.substring(0, 80)}**`,
        ``,
        `⚠️ Could not find a valid Amazon ASIN in the SKU field.`,
        ``,
        `**Raw SKU Value:** \`${item.rawSku || 'Empty'}\``,
        ``,
        `> To fix: Edit listing and set SKU to base64-encoded ASIN`,
        `> Example: B08XYZ1234 → encode to QjA4WFlaWjEyMzQ=`
      ].join('\n'),
      color: 0x444444,
      fields: [
        { name: '📋 Listing ID', value: item.listingId, inline: true },
        { name: '🔗 Edit Listing', value: `[Open](https://www.ebay.com/itm/${item.listingId})`, inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: '💡 Set SKU = base64(ASIN) to enable auto-sync' }
    }),

  dailyReset: () => sendWebhook('logs', {
    title: '🌅 NEW DAY — Memory Reset',
    description: [
      `**${getTimeString()}**`,
      ``,
      `📆 Starting fresh for today!`,
      `• Daily scan memory cleared`,
      `• All items will be re-checked`,
      `• Stats reset to zero`,
      ``,
      `> Yesterday's scans are archived`
    ].join('\n'),
    color: 0xFFD700,
    timestamp: new Date().toISOString(),
    footer: { text: '🔄 Run sync to check all listings' }
  }),

  // ─────────────────────────────────────────────
  // ALL NEW WEBHOOK EVENTS
  // ─────────────────────────────────────────────

  // VARIANT EVENTS
  variantDetected: (item: {
    listingId: string;
    asin: string;
    title: string;
    parentAsin: string;
    childAsin: string;
    variantLabel: string;
    allVariants: { label: string; asin: string; available: boolean }[];
  }) => sendWebhook('logs', {
    title: '🔀 Variant Detected — Child ASIN Found',
    description: `**${item.title.substring(0, 60)}**\nParent ASIN was stored — found correct child ASIN for this variant`,
    color: 0x00CFFF,
    fields: [
      { name: 'Parent ASIN', value: item.parentAsin, inline: true },
      { name: 'Child ASIN Found', value: item.childAsin, inline: true },
      { name: 'Variant Selected', value: item.variantLabel || 'Unknown', inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Variant', value: `[View Exact Variant](https://www.amazon.com/dp/${item.childAsin}?th=1&psc=1)`, inline: true },
      {
        name: `📊 All Variants (${item.allVariants.length})`,
        value: item.allVariants
          .slice(0, 8)
          .map(v => `${v.available ? '✅' : '❌'} ${v.label} — \`${v.asin}\``)
          .join('\n') || 'No variants found',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Variant Detection' }
  }),

  variantOutOfStock: (item: {
    listingId: string;
    asin: string;
    childAsin: string;
    title: string;
    variantLabel: string;
    availableVariants: { label: string; asin: string }[];
  }) => sendWebhook('outOfStock', {
    title: '🚫 Variant Out of Stock — eBay Set to 0',
    description: `**${item.title.substring(0, 60)}**\nYour specific variant is unavailable on Amazon`,
    color: 0xFF3D3D,
    fields: [
      { name: '❌ Your Variant', value: item.variantLabel || 'Unknown size/color', inline: true },
      { name: 'Child ASIN', value: item.childAsin, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Source', value: `[View](https://www.amazon.com/dp/${item.childAsin}?th=1&psc=1)`, inline: true },
      {
        name: '✅ Other Variants Still Available',
        value: item.availableVariants.length > 0
          ? item.availableVariants.slice(0, 6).map(v => `• ${v.label}`).join('\n')
          : 'No other variants available',
        inline: false
      },
      {
        name: '⚡ Action Taken',
        value: 'eBay quantity set to 0. Only your specific variant was affected.',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Variant Stock Check' }
  }),

  variantMismatch: (item: {
    listingId: string;
    asin: string;
    title: string;
    ebayTitle: string;
    variantFound: string;
    confidence: number;
    allVariants: { label: string; asin: string; available: boolean }[];
  }) => sendWebhook('errors', {
    title: '⚠️ Variant Match Uncertain — Manual Review',
    description: `Could not confidently match eBay listing to a specific Amazon variant`,
    color: 0xFF8C00,
    fields: [
      { name: 'eBay Title', value: item.ebayTitle.substring(0, 100), inline: false },
      { name: 'Best Variant Match', value: item.variantFound || 'None found', inline: true },
      { name: 'Match Confidence', value: `${item.confidence}%`, inline: true },
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Page', value: `[View](https://www.amazon.com/dp/${item.asin}?th=1&psc=1)`, inline: true },
      {
        name: '📊 Available Variants',
        value: item.allVariants
          .slice(0, 8)
          .map(v => `${v.available ? '✅' : '❌'} ${v.label}`)
          .join('\n') || 'No variants found',
        inline: false
      },
      {
        name: '⚡ Action Taken',
        value: 'No changes made. Please manually verify which variant matches your eBay listing and update the custom label.',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Variant Detection' }
  }),

  // FINGERPRINT EVENTS
  fingerprintBaseline: (item: {
    listingId: string;
    asin: string;
    title: string;
    brand: string;
    dimensions: string;
    weight: string;
    reviewCount: number;
    starRating: number;
    category: string;
    variantLabel: string;
  }) => sendWebhook('logs', {
    title: '📸 Baseline Fingerprint Captured',
    description: `**${item.title.substring(0, 60)}**\nFirst scan — product fingerprint saved for future comparison`,
    color: 0x00CFFF,
    fields: [
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'Brand', value: item.brand || 'Unknown', inline: true },
      { name: 'Variant', value: item.variantLabel || 'Single variant', inline: true },
      { name: 'Dimensions', value: item.dimensions || 'Not found', inline: true },
      { name: 'Weight', value: item.weight || 'Not found', inline: true },
      { name: 'Reviews', value: item.reviewCount.toLocaleString(), inline: true },
      { name: 'Rating', value: `${item.starRating} ⭐`, inline: true },
      { name: 'Category', value: item.category || 'Unknown', inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Fingerprint System' }
  }),

  fingerprintClean: (item: {
    listingId: string;
    asin: string;
    title: string;
    checkedSignals: number;
  }) => sendWebhook('logs', {
    title: '✅ Fingerprint Check — Clean',
    description: `${item.checkedSignals} signals checked — no product changes detected`,
    color: 0x00FF88,
    fields: [
      { name: 'Item', value: item.title.substring(0, 60), inline: true },
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'eBay', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Fingerprint System' }
  }),

  // PRICE EVENTS  
  priceUpdateSuccess: (item: {
    listingId: string;
    asin: string;
    title: string;
    oldEbayPrice: number;
    newEbayPrice: number;
    amazonPrice: number;
    markupPercent: number;
    direction: 'up' | 'down';
    variantLabel?: string;
    childAsin?: string;
  }) => sendWebhook('priceUpdates', {
    title: item.direction === 'up' ? '📈 Price Updated — Amazon Increased' : '📉 Price Updated — Amazon Decreased',
    description: `**${item.title.substring(0, 60)}**`,
    color: item.direction === 'up' ? 0xFFD700 : 0x00FF88,
    fields: [
      { name: 'Old eBay Price', value: `$${item.oldEbayPrice.toFixed(2)}`, inline: true },
      { name: 'New eBay Price', value: `$${item.newEbayPrice.toFixed(2)}`, inline: true },
      { name: 'Amazon Price', value: `$${item.amazonPrice.toFixed(2)}`, inline: true },
      { name: 'Markup Applied', value: `${item.markupPercent}%`, inline: true },
      { name: 'Variant', value: item.variantLabel || 'Single variant', inline: true },
      { name: 'Child ASIN', value: item.childAsin || item.asin, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Source', value: `[View](https://www.amazon.com/dp/${item.childAsin || item.asin}?th=1&psc=1)`, inline: true },
      {
        name: '✅ Action Taken',
        value: `eBay price updated from $${item.oldEbayPrice.toFixed(2)} to $${item.newEbayPrice.toFixed(2)} automatically`,
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Price Sync' }
  }),

  priceUpdateFailed: (item: {
    listingId: string;
    asin: string;
    title: string;
    targetPrice: number;
    error: string;
  }) => sendWebhook('errors', {
    title: '❌ Price Update Failed',
    description: `**${item.title.substring(0, 60)}**\neBay inline edit failed — manual update required`,
    color: 0xFF0000,
    fields: [
      { name: 'Target Price', value: `$${item.targetPrice.toFixed(2)}`, inline: true },
      { name: 'Error', value: item.error.substring(0, 200), inline: false },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Action Required', value: 'Manually update this listing price', inline: false }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Price Sync' }
  }),

  // STOCK EVENTS
  stockSetToZero: (item: {
    listingId: string;
    asin: string;
    childAsin?: string;
    title: string;
    variantLabel?: string;
    amazonStockText: string;
    reason: 'out_of_stock' | 'fingerprint_delist' | 'variant_unavailable';
  }) => sendWebhook('outOfStock', {
    title: '🚫 Stock Set to 0 — eBay Listing Paused',
    description: `**${item.title.substring(0, 60)}**`,
    color: 0xFF3D3D,
    fields: [
      { name: 'Reason', value: {
        out_of_stock: '❌ Amazon shows out of stock',
        fingerprint_delist: '🚨 Product fingerprint changed — possible different item',
        variant_unavailable: '❌ Your specific variant is unavailable'
      }[item.reason], inline: false },
      { name: 'Amazon Status', value: item.amazonStockText || 'Out of Stock', inline: true },
      { name: 'Variant', value: item.variantLabel || 'Single variant', inline: true },
      { name: 'ASIN', value: item.childAsin || item.asin, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Source', value: `[View](https://www.amazon.com/dp/${item.childAsin || item.asin}?th=1&psc=1)`, inline: true },
      { name: '⚡ Action Taken', value: 'eBay quantity set to 0. Listing stays active but cannot receive orders.', inline: false }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Stock Monitor' }
  }),

  stockRestored: (item: {
    listingId: string;
    asin: string;
    title: string;
    variantLabel?: string;
    restoredQuantity: number;
  }) => sendWebhook('logs', {
    title: '✅ Back In Stock — eBay Restored',
    description: `**${item.title.substring(0, 60)}**\nPreviously out of stock item is now available on Amazon`,
    color: 0x00FF88,
    fields: [
      { name: 'Variant', value: item.variantLabel || 'Single variant', inline: true },
      { name: 'Quantity Restored', value: item.restoredQuantity.toString(), inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Stock Monitor' }
  }),

  // SCAN EVENTS
  scanPageStarted: (page: number, itemsOnPage: number) =>
    sendWebhook('logs', {
      title: `📄 Scanning Page ${page}`,
      description: `Found ${itemsOnPage} listings on page ${page}`,
      color: 0x00CFFF,
      timestamp: new Date().toISOString(),
      footer: { text: 'Syndrax Sync — Inventory Scan' }
    }),

  inventoryScanComplete: (stats: {
    totalFound: number;
    withAsin: number;
    withoutAsin: number;
    newItems: number;
    updatedItems: number;
    pagesScanned: number;
  }) => sendWebhook('logs', {
    title: '📦 Inventory Scan Complete',
    description: `Finished scanning all eBay active listings`,
    color: 0x00FF88,
    fields: [
      { name: '📦 Total Found', value: stats.totalFound.toString(), inline: true },
      { name: '✅ With ASIN', value: stats.withAsin.toString(), inline: true },
      { name: '⚠️ No ASIN', value: stats.withoutAsin.toString(), inline: true },
      { name: '🆕 New Items', value: stats.newItems.toString(), inline: true },
      { name: '🔄 Updated', value: stats.updatedItems.toString(), inline: true },
      { name: '📄 Pages', value: stats.pagesScanned.toString(), inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Inventory Scan' }
  }),

  itemNoAsin: (item: {
    listingId: string;
    title: string;
    rawSku: string;
  }) => sendWebhook('errors', {
    title: '⚪ No ASIN — Item Skipped',
    description: `**${item.title.substring(0, 60)}**\nCustom label does not contain a valid Amazon ASIN`,
    color: 0x444444,
    fields: [
      { name: 'Raw SKU', value: item.rawSku || 'Empty', inline: true },
      { name: 'Listing ID', value: item.listingId, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Action Required', value: 'Update the custom label field with the correct Amazon ASIN', inline: false }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Inventory Scan' }
  }),

  // ERROR EVENTS
  scrapeError: (item: {
    listingId: string;
    asin: string;
    title: string;
    url: string;
    error: string;
    attempt: number;
  }) => sendWebhook('errors', {
    title: '🔴 Amazon Scrape Error',
    description: `Failed to scrape Amazon product page`,
    color: 0xFF0000,
    fields: [
      { name: 'Item', value: item.title.substring(0, 60), inline: false },
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'Attempt', value: `#${item.attempt}`, inline: true },
      { name: 'Error', value: item.error.substring(0, 200), inline: false },
      { name: 'URL', value: `[View](${item.url})`, inline: true },
      { name: 'eBay', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Error Monitor' }
  }),

  captchaDetected: (item: {
    listingId: string;
    asin: string;
    title: string;
  }) => sendWebhook('errors', {
    title: '🤖 CAPTCHA Detected — Sync Paused',
    description: `Amazon CAPTCHA encountered. Sync has been paused automatically.`,
    color: 0xFF8C00,
    fields: [
      { name: 'Item When Detected', value: item.title.substring(0, 60), inline: false },
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'Amazon', value: `[View](https://www.amazon.com/dp/${item.asin}?th=1&psc=1)`, inline: true },
      { name: 'Action Required', value: 'Open the Amazon tab, solve the CAPTCHA, then restart sync', inline: false }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — CAPTCHA Alert' }
  }),

  ebaySessionExpired: () => sendWebhook('errors', {
    title: '🔐 eBay Session Expired',
    description: 'eBay login session has expired. Cannot update listings.',
    color: 0xFF8C00,
    fields: [
      { name: 'Action Required', value: 'Go to ebay.com and log in again, then restart sync', inline: false }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Session Monitor' }
  }),

  // DAILY SUMMARY
  dailySummary: (stats: {
    date: string;
    totalScanned: number;
    priceUpdates: number;
    outOfStock: number;
    backInStock: number;
    fingerprintFlags: number;
    fingerprintDelists: number;
    variantsDetected: number;
    errors: number;
    topOutOfStock: { title: string; asin: string }[];
    topPriceChanges: { title: string; oldPrice: number; newPrice: number }[];
  }) => sendWebhook('logs', {
    title: `📊 Daily Summary — ${stats.date}`,
    description: 'Your Syndrax Sync daily report',
    color: 0x7A5CFF,
    fields: [
      { name: '📦 Total Scanned', value: stats.totalScanned.toString(), inline: true },
      { name: '💰 Price Updates', value: stats.priceUpdates.toString(), inline: true },
      { name: '🚫 Out of Stock', value: stats.outOfStock.toString(), inline: true },
      { name: '✅ Back in Stock', value: stats.backInStock.toString(), inline: true },
      { name: '⚠️ Fingerprint Flags', value: stats.fingerprintFlags.toString(), inline: true },
      { name: '🚨 Auto Delisted', value: stats.fingerprintDelists.toString(), inline: true },
      { name: '🔀 Variants Found', value: stats.variantsDetected.toString(), inline: true },
      { name: '❌ Errors', value: stats.errors.toString(), inline: true },
      ...(stats.topOutOfStock.length > 0 ? [{
        name: '🚫 Top Out of Stock',
        value: stats.topOutOfStock.slice(0, 5).map(i => `• ${i.title.substring(0, 40)}`).join('\n'),
        inline: false
      }] : []),
      ...(stats.topPriceChanges.length > 0 ? [{
        name: '💰 Top Price Changes',
        value: stats.topPriceChanges.slice(0, 5)
          .map(i => `• ${i.title.substring(0, 30)} $${i.oldPrice.toFixed(2)} → $${i.newPrice.toFixed(2)}`)
          .join('\n'),
        inline: false
      }] : [])
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Daily Report' }
  })
};
