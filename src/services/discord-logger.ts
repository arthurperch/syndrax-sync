const WEBHOOKS = {
  logs: 'https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m',
  errors: 'https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-',
  priceUpdates: 'https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY',
  outOfStock: 'https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS'
};

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
    title: '⚡ Sync Started',
    description: `Beginning price and stock check for **${totalItems}** eBay listings`,
    color: 0x00CFFF,
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  syncComplete: (stats: {
    checked: number;
    updated: number;
    outOfStock: number;
    flagged: number;
    errors: number;
    duration: string;
  }) => sendWebhook('logs', {
    title: '✅ Sync Complete',
    description: 'Finished checking all listings',
    color: 0x00FF88,
    fields: [
      { name: '📦 Total Checked', value: String(stats.checked), inline: true },
      { name: '💰 Prices Updated', value: String(stats.updated), inline: true },
      { name: '❌ Out of Stock', value: String(stats.outOfStock), inline: true },
      { name: '⚠️ Flagged', value: String(stats.flagged), inline: true },
      { name: '🔴 Errors', value: String(stats.errors), inline: true },
      { name: '⏱️ Duration', value: stats.duration, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  priceUpdated: (item: {
    title: string;
    listingId: string;
    oldPrice: number;
    newPrice: number;
    amazonPrice: number;
    direction: 'up' | 'down';
  }) => sendWebhook('priceUpdates', {
    title: item.direction === 'up' ? '📈 Price Increased' : '📉 Price Decreased',
    description: `**${item.title.substring(0, 60)}**`,
    color: item.direction === 'up' ? 0xFFD700 : 0x00FF88,
    fields: [
      { name: 'Old eBay Price', value: `$${item.oldPrice.toFixed(2)}`, inline: true },
      { name: 'New eBay Price', value: `$${item.newPrice.toFixed(2)}`, inline: true },
      { name: 'Amazon Price', value: `$${item.amazonPrice.toFixed(2)}`, inline: true },
      { name: 'eBay Listing', value: `[View Listing](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  outOfStock: (item: {
    title: string;
    listingId: string;
    amazonUrl: string;
    amazonPrice: number;
  }) => sendWebhook('outOfStock', {
    title: '🚫 Out of Stock — eBay Set to 0',
    description: `**${item.title.substring(0, 60)}**`,
    color: 0xFF3D3D,
    fields: [
      { name: 'eBay Listing', value: `[View on eBay](https://www.ebay.com/itm/${item.listingId})`, inline: true },
      { name: 'Amazon Source', value: `[View on Amazon](${item.amazonUrl})`, inline: true },
      { name: 'Last Amazon Price', value: `$${item.amazonPrice.toFixed(2)}`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  wrongItem: (item: {
    title: string;
    listingId: string;
    amazonTitle: string;
    similarity: number;
    asin: string;
  }) => sendWebhook('errors', {
    title: '⚠️ Wrong Item — Manual Review Needed',
    description: 'Title mismatch between eBay and Amazon',
    color: 0xFF8C00,
    fields: [
      { name: 'eBay Title', value: item.title.substring(0, 100), inline: false },
      { name: 'Amazon Title', value: item.amazonTitle.substring(0, 100), inline: false },
      { name: 'Similarity Score', value: `${(item.similarity * 100).toFixed(0)}%`, inline: true },
      { name: 'ASIN', value: item.asin, inline: true },
      { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  error: (item: {
    title: string;
    listingId: string;
    error: string;
    asin: string;
  }) => sendWebhook('errors', {
    title: '🔴 Sync Error',
    description: `Failed to process: **${item.title.substring(0, 60)}**`,
    color: 0xFF0000,
    fields: [
      { name: 'Error', value: item.error.substring(0, 200), inline: false },
      { name: 'ASIN', value: item.asin || 'Unknown', inline: true },
      { name: 'Listing ID', value: item.listingId, inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync' }
  }),

  progress: (checked: number, total: number, updated: number, outOfStock: number) => {
    if (checked % 10 === 0 || checked === total) {
      return sendWebhook('logs', {
        title: '🔄 Sync Progress',
        description: `Checked **${checked}** of **${total}** items`,
        color: 0x7A5CFF,
        fields: [
          { name: '💰 Updated', value: String(updated), inline: true },
          { name: '❌ Out of Stock', value: String(outOfStock), inline: true },
          { name: '📊 Progress', value: `${Math.round(checked / total * 100)}%`, inline: true }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Syndrax Sync' }
      });
    }
  },

  dryRunComplete: (results: {
    wouldUpdate: number;
    wouldMarkOutOfStock: number;
    wouldFlag: number;
    wouldError: number;
    total: number;
  }) => sendWebhook('logs', {
    title: '🧪 Dry Run Complete — No Changes Made',
    description: 'Here is what a live sync would have done:',
    color: 0x7A5CFF,
    fields: [
      { name: '💰 Would Update Price', value: String(results.wouldUpdate), inline: true },
      { name: '❌ Would Mark Out of Stock', value: String(results.wouldMarkOutOfStock), inline: true },
      { name: '⚠️ Would Flag as Wrong Item', value: String(results.wouldFlag), inline: true },
      { name: '🔴 Would Error', value: String(results.wouldError), inline: true },
      { name: '📦 Total Checked', value: String(results.total), inline: true }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Syndrax Sync — Dry Run Mode' }
  }),

  noAsin: (item: { title: string; listingId: string; rawSku: string }) =>
    sendWebhook('errors', {
      title: '⚪ No ASIN Found — Skipped',
      description: `**${item.title.substring(0, 60)}**`,
      color: 0x444444,
      fields: [
        { name: 'Raw SKU', value: item.rawSku || 'Empty', inline: true },
        { name: 'Listing ID', value: item.listingId, inline: true },
        { name: 'eBay Listing', value: `[View](https://www.ebay.com/itm/${item.listingId})`, inline: true }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Syndrax Sync' }
    })
};
