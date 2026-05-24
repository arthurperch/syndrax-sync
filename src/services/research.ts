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
 * Uses Chrome DevTools Protocol to open amazon.com/s?k=query and scrape top 10 results
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
        setTimeout(resolve, 1500); // Extra delay for content to render
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Scrape Amazon search results page
 */
async function scrapeSearchResults(tabId: number): Promise<AmazonProduct[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[Research] Scrape timeout');
      resolve([]);
    }, 10000);

    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const products: any[] = [];
          
          // Find all product containers on the search results page
          const productElements = document.querySelectorAll('[data-component-type="s-search-result"]');
          
          console.log(`[Amazon Scraper] Found ${productElements.length} product elements`);
          
          // Scrape top 10 results
          productElements.forEach((element, index) => {
            if (index >= 10) return; // Limit to top 10
            
            try {
              // Extract ASIN from data attribute
              const asin = element.getAttribute('data-asin');
              if (!asin) return;
              
              // Extract title
              const titleEl = element.querySelector('h2 a span');
              const title = titleEl?.textContent?.trim() || '';
              if (!title) return;
              
              // Extract price
              let price = 0;
              const priceEl = element.querySelector('.a-price-whole');
              if (priceEl) {
                const priceText = priceEl.textContent?.replace(/[^0-9.]/g, '') || '0';
                price = parseFloat(priceText);
              }
              
              // Extract rating
              let rating = 0;
              const ratingEl = element.querySelector('.a-icon-star-small span');
              if (ratingEl) {
                const ratingText = ratingEl.textContent?.split(' ')[0] || '0';
                rating = parseFloat(ratingText);
              }
              
              // Extract review count
              let reviewCount = 0;
              const reviewEl = element.querySelector('[aria-label*="rating"]');
              if (reviewEl) {
                const reviewText = reviewEl.getAttribute('aria-label') || '';
                const match = reviewText.match(/(\d+)\s*rating/i);
                if (match) {
                  reviewCount = parseInt(match[1]);
                }
              }
              
              // Extract image URL
              let imageUrl = '';
              const imgEl = element.querySelector('img');
              if (imgEl) {
                imageUrl = imgEl.src || imgEl.getAttribute('data-src') || '';
              }
              
              // Extract product URL
              const linkEl = element.querySelector('h2 a');
              const productUrl = linkEl?.getAttribute('href') || '';
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
          });
          
          // Send results back to background script
          chrome.runtime.sendMessage({
            type: 'RESEARCH_RESULTS',
            payload: { products }
          });
        } catch (err) {
          console.error('[Amazon Scraper] Fatal error:', err);
          chrome.runtime.sendMessage({
            type: 'RESEARCH_RESULTS',
            payload: { products: [] }
          });
        }
      }
    }).catch(err => {
      console.error('[Research] Script injection error:', err);
      resolve([]);
    });

    // Listen for results from content script
    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === 'RESEARCH_RESULTS') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(messageListener);
        resolve(message.payload.products || []);
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
  });
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
 */
async function scrapeProductDetails(tabId: number, asin: string): Promise<Partial<AmazonProduct> | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[Research] Product details scrape timeout');
      resolve(null);
    }, 10000);

    chrome.scripting.executeScript({
      target: { tabId },
      func: (asn: string) => {
        try {
          const details: any = { asin: asn };
          
          // Brand
          const brandEl = document.querySelector('[data-feature-name="by_line_text"]');
          if (brandEl) {
            details.brand = brandEl.textContent?.trim() || '';
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
          const descEl = document.querySelector('[data-feature-name="featurebullets"]');
          if (descEl) {
            details.description = descEl.textContent?.trim() || '';
          }
          
          chrome.runtime.sendMessage({
            type: 'PRODUCT_DETAILS',
            payload: { details }
          });
        } catch (err) {
          console.error('[Amazon Scraper] Error scraping product details:', err);
          chrome.runtime.sendMessage({
            type: 'PRODUCT_DETAILS',
            payload: { details: null }
          });
        }
      },
      args: [asin]
    }).catch(err => {
      console.error('[Research] Script injection error:', err);
      resolve(null);
    });

    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === 'PRODUCT_DETAILS') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(messageListener);
        resolve(message.payload.details);
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
  });
}
