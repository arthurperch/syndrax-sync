import { useState, useEffect } from 'react';
import { storage, type CompetitorProduct } from '../services/storage';

export default function CompetitorResearch() {
  const [keyword, setKeyword] = useState('');
  const [competitors, setCompetitors] = useState<CompetitorProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'profit' | 'price'>('profit');

  useEffect(() => {
    loadCompetitors();
    
    const listener = (message: { type: string; payload?: CompetitorProduct[] }) => {
      if (message.type === 'COMPETITORS_SCANNED' && message.payload) {
        setCompetitors(message.payload);
        storage.saveCompetitors(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function loadCompetitors() {
    const items = await storage.getCompetitors();
    setCompetitors(items);
  }

  async function handleScan() {
    if (!keyword.trim()) return;
    
    setLoading(true);
    try {
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_sop=12&LH_Complete=1&LH_Sold=1`;
      await chrome.tabs.create({ url: searchUrl });
      await storage.addActivity(`Scanning competitors for: ${keyword}`, 'success');
    } catch (error) {
      await storage.addActivity('Failed to start competitor scan', 'error');
    }
    setLoading(false);
  }

  async function handleAddToQueue(product: CompetitorProduct) {
    await storage.addActivity(`Added "${product.title.substring(0, 30)}..." to queue`, 'success');
  }

  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (sortBy === 'profit') return b.profitPercent - a.profitPercent;
    return b.soldPrice - a.soldPrice;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Competitor Research</h2>
        <p>Analyze sold listings for profit opportunities</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          className="input"
          placeholder="Enter keyword to research..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          style={{ flex: 1 }}
        />
        <button 
          className="btn btn-gradient" 
          onClick={handleScan}
          disabled={loading || !keyword.trim()}
        >
          🔍 Scan
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button 
          className={`btn btn-sm ${sortBy === 'profit' ? 'btn-gradient' : 'btn-outline'}`}
          onClick={() => setSortBy('profit')}
        >
          Sort by Profit
        </button>
        <button 
          className={`btn btn-sm ${sortBy === 'price' ? 'btn-gradient' : 'btn-outline'}`}
          onClick={() => setSortBy('price')}
        >
          Sort by Price
        </button>
      </div>

      {sortedCompetitors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--muted)' }}>No competitor data yet</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Enter a keyword and click Scan to research
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Sold $</th>
                <th>Est Cost</th>
                <th>Profit</th>
                <th>%</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedCompetitors.map((product, idx) => (
                <tr key={idx}>
                  <td style={{ maxWidth: 120 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.title}
                    </div>
                  </td>
                  <td>${product.soldPrice.toFixed(2)}</td>
                  <td>${product.estimatedCost.toFixed(2)}</td>
                  <td style={{ color: product.estimatedProfit > 0 ? 'var(--success)' : 'var(--error)' }}>
                    ${product.estimatedProfit.toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge ${product.profitPercent >= 30 ? 'badge-success' : product.profitPercent >= 15 ? 'badge-warning' : 'badge-error'}`}>
                      {product.profitPercent.toFixed(0)}%
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => handleAddToQueue(product)}
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
