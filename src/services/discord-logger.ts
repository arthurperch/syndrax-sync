const WEBHOOKS = {
  logs: 'https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m',
  errors: 'https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-',
  priceUpdates: 'https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY',
  outOfStock: 'https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS'
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

async function sendWebhook(channel: keyof typeof WEBHOOKS, embed: object) {
  try {
    await fetch(WEBHOOKS[channel], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Syndrax Sync',
        avatar_url: 'https://syndrax.io/assets/images/logo.png',
        embeds: [embed]
      })
    });
  } catch (err) {
    console.error('Discord webhook failed:', err);
  }
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
      { name: '🔗 Amazon', value: `[Check Source](${item.amazonUrl})`, inline: true }
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
  })
};
