import { useState, useEffect } from 'react';
import { storage, type Order } from '../services/storage';

export default function OrderFulfillment() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    
    const listener = (message: { type: string }) => {
      if (message.type === 'ORDER_EXTRACTED') {
        loadOrders();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function loadOrders() {
    const allOrders = await storage.getOrders();
    setOrders(allOrders.sort((a, b) => b.createdAt - a.createdAt));
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
        orders.map(order => (
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
            <div className="order-actions">
              <button 
                className="btn btn-sm btn-gradient" 
                onClick={() => handleFulfillAmazon(order)}
                disabled={loading || order.status === 'complete'}
              >
                Amazon
              </button>
              <button 
                className="btn btn-sm btn-outline" 
                onClick={() => handleFulfillAliExpress(order)}
                disabled={loading || order.status === 'complete'}
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
        ))
      )}
    </div>
  );
}
