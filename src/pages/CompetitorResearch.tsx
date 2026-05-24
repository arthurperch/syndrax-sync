import { useState, useEffect } from 'react';
import { storage, type CompetitorProduct } from '../services/storage';
import { generateSnowball, type SnowballResult } from '../services/tfidf';

export default function CompetitorResearch() {
  const [keyword, setKeyword] = useState('');
  const [competitors, setCompetitors] = useState<CompetitorProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'profit' | 'price'>('profit');
  const [snowball, setSnowball] = useState<SnowballResult | null>(null);
  const [snowballLoading, setSnowballLoading] = useState(false);
  const [scannedTitles, setScannedTitles] = useState<string[]>([]);
  const [copiedToast, setCopiedToast] = useState('');

  useEffect(() => {
    loadCompetitors();

    const listener = (message: { type: string; payload?: CompetitorProduct[]; titles?: string[] }) => {
      if (message.type === 'COMPETITORS_SCANNED' && message.payload) {
        setCompetitors(message.payload);
        storage.saveCompetitors(message.payload);
        if (message.titles && message.titles.length > 0) {
          setScannedTitles(message.titles);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function loadCompetitors() {
    const items = await storage.getCompetitors();
    setCompetitors(items);
    // Seed titles from existing competitor data
    if (items.length > 0) {
      setScannedTitles(items.map(i => i.title));
    }
  }

  async function handleScan() {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_sop=12&LH_Complete=1&LH_Sold=1`;
      await chrome.tabs.create({ url: searchUrl });
      await storage.addActivity(`Scanning competitors for: ${keyword}`, 'success');
    } catch {
      await storage.addActivity('Failed to start competitor scan', 'error');
    }
    setLoading(false);
  }

  async function handleAddToQueue(product: CompetitorProduct) {
    await storage.addActivity(`Added "${product.title.substring(0, 30)}..." to queue`, 'success');
  }

  function handleSnowball() {
    const titles = scannedTitles.length > 0
      ? scannedTitles
      : sortedCompetitors.map(c => c.title);
    if (titles.length === 0) return;
    setSnowballLoading(true);
    const result = generateSnowball(keyword || 'search', titles);
    setSnowball(result);
    setSnowballLoading(false);
  }

  function showToast(msg: string) {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(''), 2000);
  }

  function handleKeywordClick(kw: string) {
    const combined = `${snowball?.seed || keyword} ${kw}`.trim();
    navigator.clipboard.writeText(combined).then(() => showToast('Copied!'));
  }

  function handleCopyAll() {
    if (!snowball) return;
    const all = snowball.keywords.map(k => k.term).join(', ');
    navigator.clipboard.writeText(all).then(() => showToast('All keywords copied!'));
  }

  function handleSearchEbay() {
    if (!snowball || snowball.keywords.length === 0) return;
    const topKw = snowball.keywords[0].term;
    const query = encodeURIComponent(`${snowball.seed} ${topKw}`);
    window.open(`https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13`, '_blank');
  }

  const sortedCompetitors = [...competitors].sort((a, b) => {
    if (sortBy === 'profit') return b.profitPercent - a.profitPercent;
    return b.soldPrice - a.soldPrice;
  });

  const maxTfidf = snowball && snowball.keywords.length > 0 ? snowball.keywords[0].tfidf : 1;

  function kwColor(idx: number) {
    if (idx < 5) return { text: 'var(--cyan, #22d3ee)', border: 'rgba(34,211,238,0.3)', bg: 'rgba(34,211,238,0.06)' };
    if (idx < 10) return { text: '#a78bfa', border: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.06)' };
    return { text: '#94a3b8', border: 'rgba(148,163,184,0.2)', bg: 'rgba(148,163,184,0.04)' };
  }

  return (
    <div>
      <div className="page-header">
        <h2>Competitor Research</h2>
        <p>Analyze sold listings for profit opportunities</p>
      </div>

      {/* Search + action row */}
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
        <button
          className="btn btn-outline"
          onClick={handleSnowball}
          disabled={snowballLoading || sortedCompetitors.length === 0}
          style={{ borderColor: '#7c3aed', color: '#a78bfa', whiteSpace: 'nowrap' }}
        >
          {snowballLoading ? '⏳' : '❄️'} Snowball
        </button>
      </div>

      {/* Sort row */}
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

      {/* Competitors table */}
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

      {/* ❄️ Snowball Panel */}
      {snowball && (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          {/* Panel header */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', margin: 0 }}>
                ❄️ Keyword Snowball — <span style={{ color: '#22d3ee' }}>{snowball.seed}</span>
              </h3>
              <button
                onClick={() => setSnowball(null)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
              >×</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
              {snowball.keywords.length} keywords extracted from {snowball.titles.length} listings
            </p>
          </div>

          {/* Keyword grid — 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {snowball.keywords.map((kw, idx) => {
              const c = kwColor(idx);
              const barWidth = maxTfidf > 0 ? Math.max(4, (kw.tfidf / maxTfidf) * 100) : 4;
              return (
                <button
                  key={kw.term}
                  onClick={() => handleKeywordClick(kw.term)}
                  title={`Click to copy "${snowball.seed} ${kw.term}"`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.bg,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{kw.term}</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)', flexShrink: 0 }}>×{kw.count}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, background: c.text, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm btn-outline"
              onClick={handleSearchEbay}
              style={{ borderColor: '#22d3ee', color: '#22d3ee' }}
            >
              🔍 Search eBay Sold
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={handleCopyAll}
              style={{ borderColor: '#a78bfa', color: '#a78bfa' }}
            >
              📋 Copy All
            </button>
          </div>
        </div>
      )}

      {/* Copied toast */}
      {copiedToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#065f46',
          color: '#6ee7b7',
          padding: '8px 20px',
          borderRadius: 8,
          fontSize: 13,
          zIndex: 9999999,
          border: '1px solid rgba(110,231,183,0.3)',
          pointerEvents: 'none',
        }}>
          ✅ {copiedToast}
        </div>
      )}
    </div>
  );
}
