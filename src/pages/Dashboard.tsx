import { useState, useEffect } from 'react';
import { storage, type ActivityItem, type Order, type InventoryItem } from '../services/storage';
import type { SyncSession, SyncAction } from '../services/sync-engine';

interface SyncProgress {
  checked: number;
  total: number;
  lastAction: SyncAction | null;
  lastItem: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeListings: 0,
    pendingOrders: 0,
    withSource: 0,
    outOfStock: 0
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [scanStatus, setScanStatus] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ checked: 0, total: 0, lastAction: null, lastItem: '' });
  const [lastSession, setLastSession] = useState<SyncSession | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Listen for messages
    const messageHandler = (msg: { type: string; payload?: Record<string, unknown> }) => {
      if (msg.type === 'SCAN_PROGRESS' && msg.payload) {
        setScanStatus(`Scanning page ${msg.payload.page}... ${msg.payload.itemsFound} items found`);
      }
      if (msg.type === 'SCAN_COMPLETE' && msg.payload) {
        setScanStatus(`✓ Complete — ${msg.payload.totalItems} listings saved`);
        setScanLoading(false);
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
        setLastSession(msg.payload.session as SyncSession);
        loadData();
      }
    };
    
    chrome.runtime.onMessage.addListener(messageHandler);
    return () => chrome.runtime.onMessage.removeListener(messageHandler);
  }, []);

  async function loadData() {
    const [orders, activityLog, lastScanTime, syncLogs] = await Promise.all([
      storage.getOrders(),
      storage.getActivityLog(),
      storage.get<string>('syndrax_last_scan'),
      storage.get<SyncSession[]>('syndrax_sync_logs')
    ]);

    const inventoryObj = await storage.get<Record<string, InventoryItem>>('syndrax_inventory') || {};
    const inventory = Object.values(inventoryObj);

    setStats({
      activeListings: inventory.length,
      pendingOrders: orders.filter((o: Order) => o.status === 'pending').length,
      withSource: inventory.filter(i => i.sourceUrl).length,
      outOfStock: inventory.filter(i => i.stockLevel === 'out_of_stock').length
    });
    setActivities(activityLog.slice(0, 8));
    setLastScan(lastScanTime || null);
    if (syncLogs?.[0]) setLastSession(syncLogs[0]);
  }

  async function handleScanInventory() {
    try {
      setScanStatus('Opening eBay active listings...');
      setScanLoading(true);

      const tab = await chrome.tabs.create({
        url: 'https://www.ebay.com/sh/lst/active',
        active: true
      });

      setScanStatus('Waiting for page to load...');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Page load timeout')), 30000);
        
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            resolve();
          }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
      });

      await new Promise(resolve => setTimeout(resolve, 2500));
      setScanStatus('Scanning listings...');

      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'START_SCAN', payload: {}, timestamp: Date.now() });
        } catch {
          setScanStatus('Click "Scan All Listings" on the eBay page');
        }
      }
    } catch (error) {
      setScanStatus(`Error: ${(error as Error).message}`);
      setScanLoading(false);
    }
  }

  async function handleRunSync() {
    setSyncing(true);
    setSyncProgress({ checked: 0, total: stats.withSource, lastAction: null, lastItem: '' });
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RUN_FULL_SYNC', payload: {}, timestamp: Date.now() });
      if (response?.session) {
        setLastSession(response.session);
        await loadData();
      }
    } catch {
      await storage.addActivity('Sync failed', 'error');
    }
    
    setSyncing(false);
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatTimeAgo(timestamp: number | string): string {
    const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getActionColor(action: SyncAction | null): string {
    if (!action) return 'var(--muted)';
    switch (action) {
      case 'NO_CHANGE': return 'var(--success)';
      case 'PRICE_INCREASED': return 'var(--warning)';
      case 'PRICE_DECREASED': return 'var(--blue)';
      case 'OUT_OF_STOCK': return 'var(--error)';
      default: return 'var(--muted)';
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Syndrax Sync — Automated Price Protection</p>
      </div>

      {/* Main Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num">{stats.activeListings}</div>
          <div className="stat-label">Listings</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.withSource}</div>
          <div className="stat-label">With ASIN</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: stats.outOfStock ? 'var(--error)' : undefined }}>
            {stats.outOfStock}
          </div>
          <div className="stat-label">Out of Stock</div>
        </div>
      </div>

      {/* Sync Progress Bar */}
      {syncing && (
        <div className="card sync-progress-card" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--white)' }}>
                ⏳ Running Full Sync... {syncProgress.checked} of {syncProgress.total}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {syncProgress.total > 0 ? Math.round((syncProgress.checked / syncProgress.total) * 100) : 0}%
              </span>
            </div>
            <div className="sync-progress-bar">
              <div 
                className="sync-progress-fill"
                style={{ width: `${syncProgress.total > 0 ? (syncProgress.checked / syncProgress.total) * 100 : 0}%` }}
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

      {/* Scan Status */}
      {(scanStatus || scanLoading) && !syncing && (
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {scanLoading && <span>⏳</span>}
            <span style={{ color: scanStatus.startsWith('✓') ? 'var(--success)' : 'var(--white)', fontSize: 12 }}>
              {scanStatus}
            </span>
          </div>
        </div>
      )}

      {/* Last Sync Summary */}
      {lastSession && !syncing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Last Sync: {formatTimeAgo(lastSession.completedAt)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {lastSession.checked} items checked
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <div className="sync-stat sync-stat-success">
              <div className="sync-stat-num">{lastSession.noChange}</div>
              <div className="sync-stat-label">OK</div>
            </div>
            <div className="sync-stat sync-stat-warning">
              <div className="sync-stat-num">{lastSession.priceUpdated}</div>
              <div className="sync-stat-label">Updated</div>
            </div>
            <div className="sync-stat sync-stat-error">
              <div className="sync-stat-num">{lastSession.outOfStock}</div>
              <div className="sync-stat-label">OOS</div>
            </div>
            <div className="sync-stat sync-stat-orange">
              <div className="sync-stat-num">{lastSession.flagged + lastSession.errors}</div>
              <div className="sync-stat-label">Issues</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons" style={{ marginBottom: 14 }}>
        <button 
          className="btn btn-gradient" 
          onClick={handleRunSync} 
          disabled={syncing || stats.withSource === 0}
          style={{ flex: 1 }}
        >
          {syncing ? `⏳ Syncing ${syncProgress.checked}/${syncProgress.total}` : '⟳ Run Full Sync'}
        </button>
        <button 
          className="btn btn-outline" 
          onClick={handleScanInventory} 
          disabled={scanLoading || syncing}
        >
          📊 Scan
        </button>
      </div>

      {/* Activity Log */}
      <div className="card">
        <h3 style={{ fontSize: 12, marginBottom: 10, color: 'var(--gray)' }}>Recent Activity</h3>
        <div className="activity-log">
          {activities.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 11, padding: 10 }}>
              No recent activity
            </div>
          ) : (
            activities.map(item => (
              <div key={item.id} className="activity-item">
                <span className="activity-time">{formatTime(item.timestamp)}</span>
                <span className={`activity-status ${item.status}`}></span>
                <span>{item.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
