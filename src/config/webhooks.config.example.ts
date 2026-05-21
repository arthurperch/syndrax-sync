// Copy this file to webhooks.config.ts and fill in your Discord webhook URLs
// DO NOT commit webhooks.config.ts to git!

export const WEBHOOKS = {
  logs:           'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  errors:         'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  priceUpdates:   'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  outOfStock:     'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  variantAlerts:  'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  fingerprintLog: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
  dailySummary:   'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN'
} as const;

export type WebhookChannel = keyof typeof WEBHOOKS;

/*
 * HOW TO GET YOUR DISCORD WEBHOOK URLs:
 * 1. Open Discord and go to your server
 * 2. Right-click on the channel → Edit Channel
 * 3. Go to Integrations → Webhooks
 * 4. Click "New Webhook" or copy an existing one
 * 5. Copy the Webhook URL and paste it above
 * 
 * Recommended channel setup:
 * - #syndrax-logs       → logs webhook
 * - #syndrax-errors     → errors webhook  
 * - #syndrax-prices     → priceUpdates webhook
 * - #syndrax-stock      → outOfStock webhook
 * - #syndrax-variants   → variantAlerts webhook
 * - #syndrax-fingerprint → fingerprintLog webhook
 * - #syndrax-daily      → dailySummary webhook
 */
