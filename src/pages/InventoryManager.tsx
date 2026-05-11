import { useState, useEffect } from 'react';
import { storage, type InventoryItem } from '../services/storage';
import type { SyncSession, SyncAction } from '../services/sync-engine';

interface SyncProgress {
  checked: number;
  total: number;
  lastAction: SyncAction | null;
  lastItem: string;
}

export default function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'no_source' | 'with_asin'>('all');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ checked: 0, total: 0, lastAction: null, lastItem: '' });
  const [syncSession, setSyncSession] = useState<SyncSession | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Listen for sync progress and completion
    const handler = (msg: { type: string; payload?: Record<string, unknown> }) => {
      if (msg.type === 'SCAN_COMPLETE') {
        loadData();
      }
      if (msg.type === 'SYNC_STARTED' && msg.payload) {
        setSyncing(true);
        setSyncProgress({ checked: 0, total: msg.payload.totalItems as number, lastAction: null, lastItem: '' });
      }
      if (msg.type === 'SYNC_PROGRESS' && msg.payload) {
        setSyncProgress({
          checked: msg.payload.checked as number,
          total: msg.payload.total as number,
          lastAction: msg.payload.lastAction as SyncAction,
          lastItem: msg.payload.lastItem as string
        });
      }
      if (msg.type === 'SYNC_COMPLETE' && msg.payload) {
        setSyncing(false);
        setSyncSession(msg.payload.session as SyncSession);
        loadData();
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function loadData() {
    setLoading(true);
    
    const [inventoryObj, autoSync, lastScanTime, lastSession] = await Promise.all([
      storage.get<Record<string, InventoryItem>>('syndrax_inventory'),
      storage.get<boolean>('syndrax_auto_sync'),
      storage.get<string>('syndrax_last_scan'),
      storage.get<SyncSession[]>('syndrax_sync_logs').then(logs => logs?.[0] || null)
    ]);
    
    const inventory = inventoryObj ? Object.values(inventoryObj) : [];
    setItems(inventory);
    setAutoSyncEnabled(autoSync !== false);
    setLastScan(lastScanTime || null);
    if (lastSession) setSyncSession(lastSession);
    
    setLoading(false);
  }

  async function handleRunSync() {
    setSyncing(true);
    setSyncProgress({ checked: 0, total: items.filter(i => i.sourceUrl).length, lastAction: null, lastItem: '' });
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RUN_FULL_SYNC', payload: {}, timestamp: Date.now() });
      if (response?.session) {
        setSyncSession(response.session);
        await loadData();
      }
    } catch {
      await storage.addActivity('Sync failed', 'error');
    }
    
    setSyncing(false);
  }

  async function handleToggleAutoSync() {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    await storage.set('syndrax_auto_sync', newValue);
    await storage.addActivity(`Auto sync ${newValue ? 'enabled' : 'disabled'}`, 'success');
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                          item.asin?.toLowerCase().includes(search.toLowerCase()) ||
                          item.customLabel?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'all': return true;
      case 'no_source': return !item.sourceUrl;
      case 'with_asin': return !!item.asin;
      case 'out_of_stock': return item.stockLevel === 'out_of_stock';
      case 'in_stock': return item.stockLevel === 'in_stock';
      default: return true;
    }
  });

  const noSourceCount = items.filter(i => !i.sourceUrl).length;
  const withSourceCount = items.filter(i => !!i.sourceUrl).length;
  const outOfStockCount = items.filter(i => i.stockLevel === 'out_of_stock').length;

  function getRowClass(item: InventoryItem) {
    if (!syncSession) return '';
    const result = syncSession.results.find(r => r.listingId === item.listingId);
    if (!result) return '';
    switch (result.action) {
      case 'OUT_OF_STOCK': return 'row-out-of-stock';
      case 'PRICE_INCREASED': return 'row-price-up';
      case 'PRICE_DECREASED': return 'row-price-down';
      case 'WRONG_ITEM': return 'row-flagged';
      case 'SOURCE_NOT_FOUND': return 'row-flagged';
      case 'ERROR': return 'row-error';
      default: return '';
    }
  }

  function getStatusBadge(item: InventoryItem) {
    if (!item.sourceUrl) return <span className="badge badge-warning">⚠ No Source</span>;
    switch (item.stockLevel) {
      case 'in_stock': return <span className="badge badge-success">In Stock</span>;
      case 'low_stock': return <span className="badge badge-warning">Low Stock</span>;
      case 'out_of_stock': return <span className="badge badge-error">Out of Stock</span>;
      default: return <span className="badge badge-success">In Stock</span>;
    }
  }

  function getProfitMargin(item: InventoryItem) {
    if (!item.supplierPrice || item.supplierPrice === 0) return null;
    const profit = item.ebayPrice - item.supplierPrice;
    const profitPct = (profit / item.ebayPrice) * 100;
    const color = profitPct >= 40 ? 'var(--success)' : profitPct >= 20 ? 'var(--warning)' : 'var(--error)';
    return <span style={{ color, fontWeight: 600 }}>{profitPct.toFixed(0)}%</span>;
  }

  function formatTimeAgo(timestamp: string | number | undefined) {
    if (!timestamp) return 'Never';
    const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function truncate(str: string, len: number) {
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function getActionColor(action: SyncAction | null): string {
    if (!action) return 'var(--muted)';
    switch (action) {
      case 'NO_CHANGE': return 'var(--success)';
      case 'PRICE_INCREASED': return 'var(--warning)';
      case 'PRICE_DECREASED': return 'var(--blue)';
      case 'OUT_OF_STOCK': return 'var(--error)';
      case 'WRONG_ITEM': return 'var(--warning)';
      case 'SOURCE_NOT_FOUND': return 'var(--warning)';
      case 'ERROR': return 'var(--error)';
      default: return 'var(--muted)';
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Inventory Manager</h2>
        <p>Automated price and stock sync</p>
      </div>

      {/* Sync Progress Bar */}
      {syncing && (
        <div className="card sync-progress-card" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--white)' }}>
                ⏳ Syncing... {syncProgress.checked} of {syncProgress.total}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {Math.round((syncProgress.checked / syncProgress.total) * 100) || 0}%
              </span>
            </div>
            <div className="sync-progress-bar">
              <div 
                className="sync-progress-fill"
                style={{ width: `${(syncProgress.checked / syncProgress.total) * 100}%` }}
              />
            </div>
          </div>
          {syncProgress.lastItem && (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Last: <span style={{ color: getActionColor(syncProgress.lastAction) }}>
                {syncProgress.lastAction}
              </span> — {syncProgress.lastItem}
            </div>
          )}
        </div>
      )}

      {/* Sync Results Summary */}
      {syncSession && !syncing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Last Sync: {formatTimeAgo(syncSession.completedAt)}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            <div className="sync-stat sync-stat-success">
              <div className="sync-stat-num">{syncSession.noChange}</div>
              <div className="sync-stat-label">No Change</div>
            </div>
            <div className="sync-stat sync-stat-warning">
              <div className="sync-stat-num">{syncSession.priceUpdated}</div>
              <div className="sync-stat-label">Updated</div>
            </div>
            <div className="sync-stat sync-stat-error">
              <div className="sync-stat-num">{syncSession.outOfStock}</div>
              <div className="sync-stat-label">OOS</div>
            </div>
            <div className="sync-stat sync-stat-orange">
              <div className="sync-stat-num">{syncSession.flagged}</div>
              <div className="sync-stat-label">Flagged</div>
            </div>
            <div className="sync-stat sync-stat-red">
              <div className="sync-stat-num">{syncSession.errors}</div>
              <div className="sync-stat-label">Errors</div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Controls */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <div>
              <span style={{ color: 'var(--muted)' }}>Total: </span>
              <span className="gradient-text">{items.length}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>With Source: </span>
              <span style={{ color: 'var(--success)' }}>{withSourceCount}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>No Source: </span>
              <span style={{ color: noSourceCount ? 'var(--warning)' : 'var(--muted)' }}>
                {noSourceCount}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>OOS: </span>
              <span style={{ color: outOfStockCount ? 'var(--error)' : 'var(--muted)' }}>
                {outOfStockCount}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
              <input 
                type="checkbox" 
                checked={autoSyncEnabled}
                onChange={handleToggleAutoSync}
                style={{ accentColor: 'var(--blue)' }}
              />
              <span style={{ color: 'var(--gray)' }}>Daily Auto</span>
            </label>
            <button 
              className="btn btn-gradient" 
              onClick={handleRunSync} 
              disabled={syncing || withSourceCount === 0}
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              {syncing ? `⏳ ${syncProgress.checked}/${syncProgress.total}` : '⟳ Run Full Sync'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          className="input"
          placeholder="Search by title, ASIN, or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select 
          className="input" 
          style={{ width: 150 }}
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">All ({items.length})</option>
          <option value="with_asin">With Source ({withSourceCount})</option>
          <option value="no_source">No Source ({noSourceCount})</option>
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock ({outOfStockCount})</option>
        </select>
      </div>

      {/* Inventory Table */}
      {filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--muted)' }}>No inventory items</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Click "Scan Inventory" on Dashboard to scan your eBay listings
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Title</th>
                <th>eBay $</th>
                <th>Amazon $</th>
                <th>Margin</th>
                <th>ASIN</th>
                <th>Status</th>
                <th>Checked</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.listingId} className={getRowClass(item)}>
                  <td>
                    {item.imageUrl && (
                      <img 
                        src={item.imageUrl} 
                        alt="" 
                        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                  </td>
                  <td style={{ maxWidth: 140 }} title={item.title}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(item.title, 30)}
                    </div>
                  </td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                    ${item.ebayPrice.toFixed(2)}
                  </td>
                  <td style={{ color: item.supplierPrice ? 'var(--gray)' : 'var(--muted)' }}>
                    {item.supplierPrice ? `$${item.supplierPrice.toFixed(2)}` : '—'}
                  </td>
                  <td>{getProfitMargin(item) || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 9 }}>
                    {item.asin ? (
                      <a 
                        href={item.sourceUrl || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--blue)', textDecoration: 'none' }}
                      >
                        {item.asin}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td>{getStatusBadge(item)}</td>
                  <td style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {formatTimeAgo(item.lastScanned)}
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
