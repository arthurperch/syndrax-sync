// TASK-006: ResearchTool - Amazon Product Search and Scraping
import { retryAsync } from './retry';

export interface AmazonProduct {
  asin: string;
  title: string;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  productUrl: string;
  brand?: string;
  category?: string;
  description?: string;
}

/**
 * Search Amazon for products matching a query
 * Uses Chrome scripting API to open amazon.com/s?k=query and scrape top 10 results
 * @param query - Search query (e.g., "phone case")
 * @returns Array of top 10 AmazonProduct results
 */
export async function searchAmazon(query: string): Promise<AmazonProduct[]> {
  return retryAsync(async () => {
    console.log(`[Research] Searching Amazon for: "${query}"`);
    
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    
    // Open search results page in a new tab
    const tab = await chrome.tabs.create({ url: searchUrl, active: false });
    
    if (!tab.id) {
      throw new Error('Failed to create tab for Amazon search');
    }
    
    try {
      // Wait for page to load
      await waitForTabLoad(tab.id, 15000);
      
      // Scrape the search results
      const products = await scrapeSearchResults(tab.id);
      
      console.log(`[Research] Found ${products.length} products for query: "${query}"`);
      return products;
    } finally {
      // Close the tab
      try {
        await chrome.tabs.remove(tab.id);
      } catch (err) {
        console.error('[Research] Error closing tab:', err);
      }
    }
  });
}

/**
 * Wait for a tab to fully load
 */
function waitForTabLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    
    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000); // Extra delay for dynamic content to render
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Scrape Amazon search results page
 * Uses executeScript return value (MV3-safe) instead of sendMessage
 */
async function scrapeSearchResults(tabId: number): Promise<AmazonProduct[]> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const products: any[] = [];

          // Try multiple selectors for Amazon search result containers
          // Amazon frequently changes their DOM structure
          const SELECTORS = [
            '[data-component-type="s-search-result"]',
            '[data-asin]:not([data-asin=""])',
            '.s-result-item[data-asin]',
            '.sg-col-inner .s-widget-container',
          ];

          let productElements: NodeListOf<Element> | Element[] | null = null;

          for (const sel of SELECTORS) {
            const found = document.querySelectorAll(sel);
            // Filter to only elements that have a non-empty data-asin
            const withAsin = Array.from(found).filter(el => {
              const asin = el.getAttribute('data-asin');
              return asin && asin.trim().length > 0;
            });
            if (withAsin.length > 0) {
              console.log(`[Amazon Scraper] Selector "${sel}" matched ${withAsin.length} elements with ASINs`);
              productElements = withAsin;
              break;
            } else {
              console.log(`[Amazon Scraper] Selector "${sel}" matched ${found.length} elements (0 with ASIN)`);
            }
          }

          if (!productElements || productElements.length === 0) {
            // Debug: log body snippet to help diagnose
            console.warn('[Amazon Scraper] No product elements found. Body snippet:', document.body.innerHTML.slice(0, 500));
            return [];
          }

          // Scrape top 10 results
          const elements = Array.from(productElements).slice(0, 10);

          for (let index = 0; index < elements.length; index++) {
            const element = elements[index];
            try {
              // Extract ASIN from data attribute
              const asin = element.getAttribute('data-asin');
              if (!asin || !asin.trim()) continue;

              // Extract title — try multiple selectors
              let title = '';
              const titleSelectors = [
                'h2 a span',
                'h2 span',
                '[data-cy="title-recipe"] span',
                '.a-size-medium.a-color-base.a-text-normal',
                '.a-size-base-plus.a-color-base.a-text-normal',
                '.a-size-mini span',
              ];
              for (const ts of titleSelectors) {
                const el = element.querySelector(ts);
                if (el?.textContent?.trim()) {
                  title = el.textContent.trim();
                  break;
                }
              }
              if (!title) continue;

              // Extract price
              let price = 0;
              const priceWhole = element.querySelector('.a-price-whole');
              const priceFraction = element.querySelector('.a-price-fraction');
              if (priceWhole) {
                const whole = priceWhole.textContent?.replace(/[^0-9]/g, '') || '0';
                const fraction = priceFraction?.textContent?.replace(/[^0-9]/g, '') || '00';
                price = parseFloat(`${whole}.${fraction}`);
              }

              // Extract rating
              let rating = 0;
              const ratingSelectors = [
                '.a-icon-star-small span',
                '.a-icon-star span',
                'i[class*="a-star"] span',
              ];
              for (const rs of ratingSelectors) {
                const el = element.querySelector(rs);
                if (el?.textContent) {
                  const val = parseFloat(el.textContent.split(' ')[0]);
                  if (!isNaN(val)) { rating = val; break; }
                }
              }

              // Extract review count — look for standalone number near the star rating
              // Amazon renders count as: <span class="a-size-base s-underline-text">1,234</span>
              // The aria-label "4.5 out of 5 stars" must NOT be used for the count (wrong number)
              let reviewCount = 0;
              const countSelectors = [
                'span.a-size-base.s-underline-text',
                'span.a-size-base.s-underline-link-text',
                '[aria-label*="ratings"] span',
                'span.a-size-base[aria-hidden="false"]',
              ];
              for (const cs of countSelectors) {
                const countEl = element.querySelector(cs);
                const rawText = countEl?.textContent?.replace(/,/g, '').trim() || '';
                const parsed = parseInt(rawText);
                if (!isNaN(parsed) && parsed > 0) { reviewCount = parsed; break; }
              }
              // Fallback: scan aria-label for "N ratings" (not "5 stars")
              if (reviewCount === 0) {
                const ratingLinkEl = element.querySelector('[aria-label*="ratings"]');
                const ratingLabelMatch = ratingLinkEl?.getAttribute('aria-label')?.match(/([\d,]+)\s+rating/i);
                if (ratingLabelMatch) reviewCount = parseInt(ratingLabelMatch[1].replace(/,/g, ''));
              }

              // Extract image URL
              let imageUrl = '';
              const imgEl = element.querySelector('img.s-image') ||
                            element.querySelector('img[data-image-latency]') ||
                            element.querySelector('img');
              if (imgEl) {
                imageUrl = (imgEl as HTMLImageElement).src ||
                           imgEl.getAttribute('data-src') || '';
              }

              // Extract product URL
              const linkEl = element.querySelector('h2 a') ||
                             element.querySelector('a.a-link-normal[href*="/dp/"]');
              const productUrl = linkEl?.getAttribute('href') || `/dp/${asin}`;
              const fullUrl = productUrl.startsWith('http')
                ? productUrl
                : `https://www.amazon.com${productUrl}`;

              products.push({
                asin,
                title,
                price,
                rating,
                reviewCount,
                imageUrl,
                productUrl: fullUrl
              });

              console.log(`[Amazon Scraper] Product ${index + 1}: ${title} - $${price}`);
            } catch (err) {
              console.error(`[Amazon Scraper] Error scraping product ${index}:`, err);
            }
          }

          return products;
        } catch (err) {
          console.error('[Amazon Scraper] Fatal error:', err);
          return [];
        }
      }
    });

    if (results && results[0] && results[0].result) {
      return results[0].result as AmazonProduct[];
    }
    console.warn('[Research] executeScript returned no result');
    return [];
  } catch (err) {
    console.error('[Research] Script injection error:', err);
    return [];
  }
}

/**
 * Get product details from Amazon product page
 */
export async function getProductDetails(asin: string): Promise<Partial<AmazonProduct> | null> {
  return retryAsync(async () => {
    const productUrl = `https://www.amazon.com/dp/${asin}`;
    
    const tab = await chrome.tabs.create({ url: productUrl, active: false });
    
    if (!tab.id) {
      throw new Error('Failed to create tab for product details');
    }
    
    try {
      await waitForTabLoad(tab.id, 15000);
      
      const details = await scrapeProductDetails(tab.id, asin);
      return details;
    } finally {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (err) {
        console.error('[Research] Error closing tab:', err);
      }
    }
  });
}

/**
 * Scrape detailed product information
 * Uses executeScript return value (MV3-safe)
 */
async function scrapeProductDetails(tabId: number, asin: string): Promise<Partial<AmazonProduct> | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (asn: string) => {
        try {
          const details: any = { asin: asn };
          
          // Brand
          const brandSelectors = [
            '[data-feature-name="by_line_text"]',
            '#bylineInfo',
            '.po-brand .po-break-word',
          ];
          for (const bs of brandSelectors) {
            const el = document.querySelector(bs);
            if (el?.textContent?.trim()) {
              details.brand = el.textContent.trim();
              break;
            }
          }
          
          // Category
          const categoryEl = document.querySelector('.a-breadcrumb');
          if (categoryEl) {
            const items = categoryEl.querySelectorAll('.a-list-item');
            if (items.length > 0) {
              details.category = items[items.length - 1].textContent?.trim() || '';
            }
          }
          
          // Description
          const descSelectors = [
            '[data-feature-name="featurebullets"]',
            '#feature-bullets',
            '#productDescription',
          ];
          for (const ds of descSelectors) {
            const el = document.querySelector(ds);
            if (el?.textContent?.trim()) {
              details.description = el.textContent.trim().slice(0, 500);
              break;
            }
          }
          
          return details;
        } catch (err) {
          console.error('[Amazon Scraper] Error scraping product details:', err);
          return null;
        }
      },
      args: [asin]
    });

    if (results && results[0] && results[0].result) {
      return results[0].result as Partial<AmazonProduct>;
    }
    return null;
  } catch (err) {
    console.error('[Research] Script injection error:', err);
    return null;
  }
}
