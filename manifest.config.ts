import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Syndrax Sync',
  version: '1.0.0',
  description: 'Multi-channel eCommerce automation by Syndrax LLC',
  
  permissions: [
    'storage',
    'tabs',
    'activeTab',
    'scripting',
    'alarms'
  ],
  
  host_permissions: [
    '*://*.ebay.com/*',
    '*://*.amazon.com/*',
    '*://*.aliexpress.com/*',
    'https://discord.com/*',
    '*://*.walmart.com/*',
    '*://*.homedepot.com/*',
    '*://*.temu.com/*'
  ],
  
action: {
    default_popup: 'index.html',
    default_title: 'Syndrax Sync',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  },

  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png'
  },
  
  background: {
    service_worker: 'src/background-service.ts',
    type: 'module'
  },
  
  content_scripts: [
    // eBay Mesh Order Details - Auto Order overlay + Customer Message Tool
    {
      matches: ['*://*.ebay.com/mesh/ord/details*'],
      js: ['src/content/ebay-mesh-order-overlay.ts', 'src/content/customer-message-tool.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.ebay.com/ord/*', '*://*.ebay.com/sh/ord/*'],
      js: ['src/content/ebay-order-extractor.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.amazon.com/dp/*', '*://*.amazon.com/gp/product/*'],
      js: ['src/content/amazon-price-checker.ts', 'src/content/amazon-scraper.ts', 'src/content/sniper-overlay.ts'],
      run_at: 'document_end'
    },
    {
      matches: [
        'https://www.amazon.co.uk/dp/*',
        'https://www.amazon.co.uk/gp/product/*',
        'https://www.amazon.de/dp/*',
        'https://www.amazon.de/gp/product/*',
        'https://www.amazon.ca/dp/*',
        'https://www.amazon.ca/gp/product/*'
      ],
      js: ['src/content/sniper-overlay.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.amazon.com/*'],
      js: ['src/content/amazon-fulfillment.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.aliexpress.com/item/*'],
      js: ['src/content/aliexpress-price-checker.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.aliexpress.com/*'],
      js: ['src/content/aliexpress-fulfillment.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.ebay.com/sh/lst/*', '*://*.ebay.com/sh/lst*', '*://*.ebay.com/mys/active*'],
      js: ['src/content/ebay-sync-controller.ts', 'src/content/listing-optimizer.ts', 'src/content/ebay-inventory-scanner.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.ebay.com/sl/prelist*', '*://*.ebay.com/sl/prelist/home*'],
      js: ['src/content/ebay-prelist.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.ebay.com/sl/sell*', '*://*.ebay.com/sell/list*', '*://*.ebay.com/sell/create*'],
      js: ['src/content/ebay-listing-creator.ts'],
      run_at: 'document_end'
    },
    {
      matches: ['*://*.ebay.com/sch/*'],
      js: ['src/content/competitor-research.ts'],
      run_at: 'document_end'
    },
    // Finance Reconciliation - eBay Sold Pages
    {
      matches: ['*://*.ebay.com/mys/sold*', '*://*.ebay.com/sh/ord/*sold*'],
      js: ['src/content/finance-ebay-scanner.ts'],
      run_at: 'document_end'
    },
    // Finance Reconciliation - eBay Payment Details Pages
    {
      matches: [
        '*://*.ebay.com/mes/transactiondetails*',
        '*://*.ebay.com/mesh/pmt/details*',
        '*://*.ebay.com/mesh/ord/details*',
        '*://*.ebay.com/payments/paymentSummary*'
      ],
      js: ['src/content/finance-ebay-payment.ts'],
      run_at: 'document_end'
    },
    // Finance Reconciliation - Amazon Order History
    {
      matches: ['*://*.amazon.com/gp/your-account/order-history*', '*://*.amazon.com/your-orders*', '*://*.amazon.com/gp/css/order-history*'],
      js: ['src/content/finance-amazon-orders.ts'],
      run_at: 'document_end'
    }
  ],
  
  web_accessible_resources: [
    {
      resources: ['button1.mp3', 'dashboard.html', 'bulklister.html'],
      matches: ['<all_urls>'],
    }
  ]
});
