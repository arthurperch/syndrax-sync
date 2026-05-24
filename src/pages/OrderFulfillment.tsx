import { useState, useEffect } from 'react';
import { storage, type Order, type InventoryItem, type Settings, type OrderIntelligence } from '../services/storage';
import { analyzeOrder } from '../services/order-intelligence';

export default function OrderFulfillment() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [intelligenceMap, setIntelligenceMap] = useState<Map<string, OrderIntelligence>>(new Map());

  useEffect(() => {
    loadAll();

    const listener = (message: { type: string }) => {
      if (message.type === 'ORDER_EXTRACTED') {
        loadAll();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function loadAll() {
    const [allOrders, inventory, settings] = await Promise.all([
      storage.getOrders(),
      storage.getInventory(),
      storage.getSettings()
    ]);
    const sorted = allOrders.sort((a, b) => b.createdAt - a.createdAt);
    setOrders(sorted);

    const map = new Map<string, OrderIntelligence>();
    for (const order of sorted) {
      map.set(order.id, analyzeOrder(order, inventory, settings));
    }
    setIntelligenceMap(map);
  }

  async function loadOrders() {
    await loadAll();
  }

  async function handleFulfillAmazon(order: Order) {
    setLoading(true);
    try {
      order.status = 'in_progress';
      order.updatedAt = Date.now();
      await storage.saveOrder(order);

      const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(order.itemTitle)}`;
      await chrome.tabs.create({ url: amazonUrl });

      await chrome.storage.local.set({
        pendingFulfillment: {
          orderId: order.id,
          buyerName: order.buyerName,
          buyerAddress: order.buyerAddress,
          buyerCity: order.buyerCity,
          buyerState: order.buyerState,
          buyerZip: order.buyerZip,
          buyerCountry: order.buyerCountry
        }
      });

      await storage.addActivity(`Fulfilling order ${order.id} on Amazon`, 'success');
    } catch (error) {
      await storage.addActivity(`Failed to fulfill order ${order.id}`, 'error');
    }
    await loadOrders();
    setLoading(false);
  }

  async function handleFulfillAliExpress(order: Order) {
    setLoading(true);
    try {
      order.status = 'in_progress';
      order.sourcePlatform = 'aliexpress';
      order.updatedAt = Date.now();
      await storage.saveOrder(order);

      const aliUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(order.itemTitle)}`;
      await chrome.tabs.create({ url: aliUrl });

      await chrome.storage.local.set({
        pendingFulfillment: {
          orderId: order.id,
          buyerName: order.buyerName,
          buyerAddress: order.buyerAddress,
          buyerCity: order.buyerCity,
          buyerState: order.buyerState,
          buyerZip: order.buyerZip,
          buyerCountry: order.buyerCountry
        }
      });

      await storage.addActivity(`Fulfilling order ${order.id} on AliExpress`, 'success');
    } catch (error) {
      await storage.addActivity(`Failed to fulfill order ${order.id}`, 'error');
    }
    await loadOrders();
    setLoading(false);
  }

  async function handleMarkComplete(order: Order) {
    order.status = 'complete';
    order.updatedAt = Date.now();
    await storage.saveOrder(order);
    await storage.addActivity(`Order ${order.id} marked complete`, 'success');
    await loadOrders();
  }

  async function handleCopyAddress(order: Order) {
    const address = `${order.buyerName}\n${order.buyerAddress}\n${order.buyerCity}, ${order.buyerState} ${order.buyerZip}\n${order.buyerCountry}`;
    await navigator.clipboard.writeText(address);
    await storage.addActivity('Address copied to clipboard', 'success');
  }

  function getStatusBadge(status: Order['status']) {
    switch (status) {
      case 'pending': return <span className="badge badge-warning">Pending</span>;
      case 'in_progress': return <span className="badge badge-blue">In Progress</span>;
      case 'complete': return <span className="badge badge-success">Complete</span>;
      case 'failed': return <span className="badge badge-error">Failed</span>;
    }
  }

  function renderIntelligenceBanner(intel: OrderIntelligence) {
    let bg = '';
    let text = '';

    if (intel.route === 'amazon') {
      bg = 'rgba(6,78,59,0.4)';
      text = `⚡ AMAZON — ${intel.reason} • ${intel.margin.toFixed(1)}% margin • $${intel.profit.toFixed(2)} profit`;
    } else if (intel.route === 'aliexpress') {
      bg = 'rgba(30,58,138,0.4)';
      text = `🛒 ALIEXPRESS — ${intel.reason}`;
    } else {
      bg = 'rgba(127,29,29,0.4)';
      text = `⚠️ MANUAL REVIEW — ${intel.reason}`;
    }

    const flagColors: Record<string, string> = {
      LOW_MARGIN: '#fbbf24',
      OUT_OF_STOCK: '#f87171',
      UNKNOWN_ITEM: '#94a3b8',
      PRICE_MISMATCH: '#fb923c'
    };

    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{
          background: bg,
          border: `1px solid ${intel.route === 'amazon' ? 'rgba(52,211,153,0.3)' : intel.route === 'aliexpress' ? 'rgba(96,165,250,0.3)' : 'rgba(248,113,113,0.3)'}`,
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: intel.route === 'amazon' ? '#6ee7b7' : intel.route === 'aliexpress' ? '#93c5fd' : '#fca5a5',
          lineHeight: 1.4
        }}>
          {text}
        </div>
        {intel.riskFlags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {intel.riskFlags.map(flag => (
              <span key={flag} style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${flagColors[flag] || '#64748b'}`,
                color: flagColors[flag] || '#64748b',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}>
                ⚠ {flag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Order Fulfillment</h2>
        <p>Manage and fulfill your eBay orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>No orders yet</p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            Navigate to an eBay order page to extract order data
          </p>
        </div>
      ) : (
        orders.map(order => {
          const intel = intelligenceMap.get(order.id);
          return (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <span className="order-title">{order.itemTitle.substring(0, 40)}...</span>
                {getStatusBadge(order.status)}
              </div>
              <div className="order-details">
                <div>👤 {order.buyerName}</div>
                <div>💵 ${order.salePrice.toFixed(2)} × {order.quantity}</div>
                <div>📍 {order.buyerCity}, {order.buyerState}</div>
              </div>

              {intel && renderIntelligenceBanner(intel)}

              <div className="order-actions">
                <button
                  className="btn btn-sm btn-gradient"
                  onClick={() => handleFulfillAmazon(order)}
                  disabled={loading || order.status === 'complete'}
                  style={intel?.route === 'amazon' ? { border: '1px solid #06b6d4' } : undefined}
                >
                  Amazon
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handleFulfillAliExpress(order)}
                  disabled={loading || order.status === 'complete'}
                  style={intel?.route === 'aliexpress' ? { border: '1px solid #06b6d4' } : undefined}
                >
                  AliExpress
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handleCopyAddress(order)}
                >
                  📋 Copy
                </button>
                {order.status !== 'complete' && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleMarkComplete(order)}
                    disabled={loading}
                  >
                    ✓ Done
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
