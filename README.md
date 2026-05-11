# Syndrax Sync

**Multi-channel eCommerce automation by Syndrax LLC**

A Chrome extension for dropshipping automation between eBay, Amazon, and AliExpress.

## Features

- **Order Extraction**: Extract buyer info and order details from eBay order pages
- **Auto Fulfillment**: Automatically fill shipping addresses on Amazon/AliExpress
- **Inventory Scanning**: Scan eBay active listings for inventory management
- **SEO Generation**: AI-powered eBay listing optimization using Claude claude-sonnet-4-20250514
- **Competitor Research**: Analyze sold listings for profit opportunities
- **Price & Stock Sync**: Automatic daily sync with Amazon/AliExpress prices, out-of-stock detection, margin protection

## Installation

1. Run `npm install`
2. Run `npm run build`
3. Open Chrome → Extensions → Enable Developer Mode
4. Click "Load unpacked" → Select the `dist` folder
5. Click the Syndrax Sync icon in Chrome toolbar

## Configuration

1. Go to Settings page in the extension
2. Add your Anthropic API key for AI SEO features
3. Configure markup percentage and default supplier

## Development

```bash
npm run dev    # Start dev server with hot reload
npm run build  # Build for production
```

## Tech Stack

- React 18 + TypeScript
- Vite + @crxjs/vite-plugin
- Chrome Manifest V3
- Anthropic Claude API

## Architecture

### Popup UI (420x580px)
- Dashboard with stats and activity log
- Order Fulfillment queue
- Inventory Manager
- SEO Generator
- Competitor Research
- Settings

### Background Service Worker
- Message routing between popup and content scripts
- Chrome.storage management
- Alarm scheduling for daily sync

### Content Scripts
- `ebay-order-extractor.ts` - Extract orders from eBay
- `amazon-fulfillment.ts` - Auto-fill Amazon checkout
- `aliexpress-fulfillment.ts` - Auto-fill AliExpress checkout
- `ebay-inventory-scanner.ts` - Scan eBay active listings
- `ebay-listing-creator.ts` - Auto-fill eBay listing form
- `amazon-scraper.ts` - Scrape Amazon product data
- `competitor-research.ts` - Analyze eBay sold listings

## License

Proprietary - Syndrax LLC
