interface ScrapedProduct {
  title: string;
  price: number;
  asin: string;
  mainImage: string;
  images: string[];
  description: string;
  inStock: boolean;
  url: string;
}

function scrapeProductPage(): ScrapedProduct | null {
  try {
    const title = document.querySelector('#productTitle')?.textContent?.trim() || '';
    
    const priceEl = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole');
    const priceText = priceEl?.textContent || '0';
    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    
    const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch?.[1] || '';
    
    const mainImageEl = document.querySelector('#landingImage, #imgBlkFront') as HTMLImageElement;
    const mainImage = mainImageEl?.src || '';
    
    const images: string[] = [];
    document.querySelectorAll('#altImages img, .imageThumbnail img').forEach(img => {
      const src = (img as HTMLImageElement).src;
      if (src && !src.includes('transparent-pixel')) {
        const hiRes = src.replace(/\._[^.]+_\./, '.');
        images.push(hiRes);
      }
    });
    
    const descriptionEl = document.querySelector('#productDescription, #feature-bullets');
    const description = descriptionEl?.textContent?.trim() || '';
    
    const stockEl = document.querySelector('#availability, #outOfStock');
    const inStock = !stockEl?.textContent?.toLowerCase().includes('out of stock');
    
    if (!title) return null;
    
    return {
      title,
      price,
      asin,
      mainImage,
      images: images.slice(0, 10),
      description,
      inStock,
      url: window.location.href
    };
  } catch (error) {
    console.error('Syndrax: Error scraping Amazon product:', error);
    return null;
  }
}

function createAddButton() {
  if (document.getElementById('syndrax-add-btn')) return;
  if (!document.querySelector('#productTitle')) return;
  
  const button = document.createElement('button');
  button.id = 'syndrax-add-btn';
  button.innerHTML = '➕ Add to Syndrax';
  button.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: linear-gradient(90deg, #00CFFF, #7A5CFF);
    color: white;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,207,255,0.4);
    transition: all 0.2s;
  `;
  
  button.addEventListener('click', () => {
    const product = scrapeProductPage();
    if (product) {
      chrome.runtime.sendMessage({
        type: 'PRODUCT_SCRAPED',
        payload: product,
        timestamp: Date.now()
      });
      showNotification('Product added to Syndrax Sync!');
    } else {
      showNotification('Could not scrape product data', true);
    }
  });
  
  document.body.appendChild(button);
}

function showNotification(message: string, isError = false) {
  const existing = document.getElementById('syndrax-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'syndrax-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 9999999;
    background: ${isError ? '#ef4444' : '#22c55e'};
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

chrome.runtime.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'SCRAPE_PRODUCT') {
    const product = scrapeProductPage();
    sendResponse({ success: !!product, product });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createAddButton);
} else {
  setTimeout(createAddButton, 500);
}
