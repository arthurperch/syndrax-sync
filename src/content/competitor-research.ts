interface CompetitorItem {
  title: string;
  soldPrice: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitPercent: number;
  seller: string;
  condition: string;
  url: string;
}

function scanCompetitorListings(): CompetitorItem[] {
  const items: CompetitorItem[] = [];
  
  const rows = document.querySelectorAll('.s-item, .srp-results li[data-viewport]');
  
  rows.forEach(row => {
    try {
      const titleEl = row.querySelector('.s-item__title, h3');
      const title = titleEl?.textContent?.trim() || '';
      
      if (title === 'Shop on eBay') return;
      
      const priceEl = row.querySelector('.s-item__price, .prc');
      const priceText = priceEl?.textContent || '0';
      const soldPrice = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      
      const sellerEl = row.querySelector('.s-item__seller-info, .si-inner');
      const seller = sellerEl?.textContent?.trim() || 'Unknown';
      
      const conditionEl = row.querySelector('.s-item__subtitle, .cndtn');
      const condition = conditionEl?.textContent?.trim() || 'Used';
      
      const linkEl = row.querySelector('a.s-item__link, a');
      const url = (linkEl as HTMLAnchorElement)?.href || '';
      
      const estimatedCost = soldPrice * 0.5;
      const estimatedProfit = soldPrice - estimatedCost - (soldPrice * 0.13);
      const profitPercent = (estimatedProfit / soldPrice) * 100;
      
      if (title && soldPrice > 0) {
        items.push({
          title,
          soldPrice,
          estimatedCost,
          estimatedProfit,
          profitPercent,
          seller,
          condition,
          url
        });
      }
    } catch (error) {
      console.error('Syndrax: Error parsing competitor row:', error);
    }
  });
  
  return items.sort((a, b) => b.profitPercent - a.profitPercent);
}

function createScanOverlay() {
  if (document.getElementById('syndrax-research-btn')) return;
  
  if (!window.location.href.includes('LH_Complete=1') && !window.location.href.includes('LH_Sold=1')) {
    return;
  }
  
  const button = document.createElement('button');
  button.id = 'syndrax-research-btn';
  button.innerHTML = '🔍 Analyze Competitors';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
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
  `;
  
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.innerHTML = '⏳ Analyzing...';
    
    const items = scanCompetitorListings();
    
    const titles = items.map(i => i.title);
    chrome.runtime.sendMessage({
      type: 'COMPETITORS_SCANNED',
      payload: items,
      titles,
      timestamp: Date.now()
    });
    
    showResultsOverlay(items);
    
    button.disabled = false;
    button.innerHTML = '🔍 Analyze Competitors';
  });
  
  document.body.appendChild(button);
}

function showResultsOverlay(items: CompetitorItem[]) {
  const existing = document.getElementById('syndrax-results');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'syndrax-results';
  overlay.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    z-index: 999998;
    background: #0a0f1e;
    border: 1px solid rgba(0,207,255,0.3);
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-family: Inter, -apple-system, sans-serif;
  `;
  
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `;
  header.innerHTML = `
    <span style="color: white; font-weight: 700; font-size: 14px;">
      Found ${items.length} Products
    </span>
    <button id="syndrax-close" style="background: none; border: none; color: #999; cursor: pointer; font-size: 18px;">✕</button>
  `;
  overlay.appendChild(header);
  
  items.slice(0, 10).forEach(item => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(0,207,255,0.1);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    `;
    
    const profitColor = item.profitPercent >= 30 ? '#22c55e' : item.profitPercent >= 15 ? '#f59e0b' : '#ef4444';
    
    card.innerHTML = `
      <div style="color: white; font-size: 11px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${item.title}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span style="color: #94a3b8;">Sold: $${item.soldPrice.toFixed(2)}</span>
        <span style="color: ${profitColor}; font-weight: 600;">${item.profitPercent.toFixed(0)}% profit</span>
      </div>
    `;
    overlay.appendChild(card);
  });
  
  document.body.appendChild(overlay);
  
  document.getElementById('syndrax-close')?.addEventListener('click', () => overlay.remove());
}

chrome.runtime.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'SCAN_COMPETITORS') {
    const items = scanCompetitorListings();
    sendResponse({ success: true, items });
    
    chrome.runtime.sendMessage({
      type: 'COMPETITORS_SCANNED',
      payload: items,
      timestamp: Date.now()
    });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createScanOverlay);
} else {
  setTimeout(createScanOverlay, 500);
}
