/**
 * Amazon/eBay Finance Reconciliation Page
 * 
 * Scan eBay sold orders, collect payout details, match Amazon purchases,
 * and export profit/tax records.
 * 
 * SAFETY: READ-ONLY - Does NOT place orders or click destructive buttons
 */

import { useState, useEffect } from 'react';
import type { 
  ScanRun, 
  ScanProgress, 
  ScanPeriod, 
  EbaySoldOrder,
  OrderStatus 
} from '../features/finance-reconciliation/types';
import { formatMoney } from '../features/finance-reconciliation/parsers/moneyParser';

// ==================== COMPONENT ====================

export default function FinanceReconciliation() {
  // State
  const [scanRun, setScanRun] = useState<ScanRun | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'results' | 'verification' | 'errors'>('results');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load existing run from storage on mount
  useEffect(() => {
    loadExistingRun();
  }, []);
  
  async function loadExistingRun() {
    try {
      const result = await chrome.storage.local.get(['financeReconciliationRun']);
      if (result.financeReconciliationRun) {
        setScanRun(result.financeReconciliationRun);
      }
    } catch (err) {
      console.error('Failed to load existing run:', err);
    }
  }
  
  // ==================== SCAN HANDLERS ====================
  
  async function startScan(period: ScanPeriod) {
    console.log(`🔍 Starting scan for period: ${period}`);
    
    const newRun: ScanRun = {
      id: crypto.randomUUID(),
      config: {
        period,
        maxConcurrentTabs: 5,
        delayBetweenRequests: 1500,
      },
      progress: {
        currentPhase: 'scanning_ebay_list',
        pagesScanned: 0,
        ebayOrdersFound: 0,
        paymentPagesScanned: 0,
        amazonMatchesFound: 0,
        needsVerificationCount: 0,
        incompleteCount: 0,
        errorsCount: 0,
      },
      orders: [],
      startedAt: Date.now(),
      errors: [],
    };
    
    setScanRun(newRun);
    setIsScanning(true);
    setIsPaused(false);
    
    // Save to storage
    await chrome.storage.local.set({ financeReconciliationRun: newRun });
    
    // Build the start URL based on period
    let startUrl = '';
    switch (period) {
      case 'CURRENT_YEAR':
        startUrl = 'https://www.ebay.com/mys/sold/rf/filter=ALL&limit=25&period=CURRENT_YEAR';
        break;
      case 'LAST_YEAR':
        startUrl = 'https://www.ebay.com/mys/sold/rf/filter=ALL&limit=25&period=LAST_YEAR';
        break;
      case 'CUSTOM':
        // TODO: Add custom date range UI
        const now = Date.now();
        const yearAgo = now - (365 * 24 * 60 * 60 * 1000);
        startUrl = `https://www.ebay.com/mys/sold/rf/sort=MOST_RECENTLY_SOLD&filter=ALL&limit=25&period=CUSTOM&startDate=${yearAgo}&endDate=${now}`;
        break;
    }
    
    // Send message to background to start scan
    chrome.runtime.sendMessage({
      type: 'START_FINANCE_SCAN',
      payload: { runId: newRun.id, startUrl, config: newRun.config }
    });
  }
  
  function pauseScan() {
    setIsPaused(true);
    chrome.runtime.sendMessage({ type: 'PAUSE_FINANCE_SCAN' });
  }
  
  function resumeScan() {
    setIsPaused(false);
    chrome.runtime.sendMessage({ type: 'RESUME_FINANCE_SCAN' });
  }
  
  function stopScan() {
    setIsScanning(false);
    setIsPaused(false);
    chrome.runtime.sendMessage({ type: 'STOP_FINANCE_SCAN' });
  }
  
  async function clearRunData() {
    if (confirm('Are you sure you want to clear all scan data? This cannot be undone.')) {
      setScanRun(null);
      setIsScanning(false);
      setIsPaused(false);
      await chrome.storage.local.remove(['financeReconciliationRun']);
    }
  }
  
  // ==================== EXPORT HANDLERS ====================
  
  function exportCSV() {
    if (!scanRun || scanRun.orders.length === 0) {
      alert('No data to export');
      return;
    }
    
    const headers = [
      'eBay Order ID', 'eBay Item ID', 'SKU', 'eBay Title', 'Sold Date',
      'Funds Status', 'Buyer Subtotal', 'Buyer Shipping', 'Buyer Sales Tax',
      'Buyer Discount', 'Buyer Order Total', 'Transaction Fees', 'Order Earnings',
      'Amazon Order ID', 'Amazon Title', 'Amazon Total', 'Match Confidence',
      'Verified', 'Estimated Net Profit', 'Status', 'Notes'
    ];
    
    const rows = scanRun.orders.map(order => [
      order.orderId || '',
      order.itemId || '',
      order.sku || '',
      order.ebayTitle || '',
      order.soldDate || '',
      order.payment?.fundsStatus || '',
      order.payment?.buyerSubtotal?.toFixed(2) || '',
      order.payment?.buyerShipping?.toFixed(2) || '',
      order.payment?.buyerSalesTax?.toFixed(2) || '',
      order.payment?.buyerDiscount?.toFixed(2) || '',
      order.payment?.buyerOrderTotal?.toFixed(2) || '',
      order.payment?.transactionFees?.toFixed(2) || '',
      order.payment?.orderEarnings?.toFixed(2) || '',
      order.amazonMatch?.amazonOrderId || '',
      order.amazonMatch?.amazonTitle || '',
      order.amazonMatch?.amazonOrderTotal?.toFixed(2) || '',
      order.amazonMatch?.confidenceScore?.toString() || '',
      order.amazonMatch?.verified ? 'Yes' : 'No',
      order.calculated?.estimatedNetProfit?.toFixed(2) || '',
      order.status,
      (order.notes || []).join('; ')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    downloadFile(csvContent, `finance-reconciliation-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  }
  
  function exportJSON() {
    if (!scanRun) {
      alert('No data to export');
      return;
    }
    
    const jsonContent = JSON.stringify(scanRun, null, 2);
    downloadFile(jsonContent, `finance-reconciliation-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  }
  
  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // ==================== FILTERED DATA ====================
  
  const filteredOrders = scanRun?.orders.filter(order => {
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.orderId?.toLowerCase().includes(query) ||
        order.itemId?.toLowerCase().includes(query) ||
        order.ebayTitle?.toLowerCase().includes(query) ||
        order.sku?.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];
  
  // ==================== RENDER ====================
  
  return (
    <div className="finance-reconciliation-page" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          💼 Amazon/eBay Finance Reconciliation
        </h1>
        <p style={{ color: '#888', fontSize: '14px' }}>
          Scan eBay sold orders, collect payout details, match Amazon purchases, and export profit/tax records.
        </p>
      </div>
      
      {/* Scan Controls */}
      <div style={{ 
        background: 'rgba(255,255,255,0.05)', 
        borderRadius: '12px', 
        padding: '20px',
        marginBottom: '20px' 
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#888' }}>
          SCAN CONTROLS
        </h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button 
            onClick={() => startScan('CURRENT_YEAR')}
            disabled={isScanning}
            style={{
              padding: '10px 16px',
              background: isScanning ? '#333' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            📅 Scan Current Year
          </button>
          
          <button 
            onClick={() => startScan('LAST_YEAR')}
            disabled={isScanning}
            style={{
              padding: '10px 16px',
              background: isScanning ? '#333' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            📆 Scan Last Year
          </button>
          
          <button 
            onClick={() => startScan('CUSTOM')}
            disabled={isScanning}
            style={{
              padding: '10px 16px',
              background: isScanning ? '#333' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            📊 Scan Custom Range
          </button>
        </div>
        
        {isScanning && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            {isPaused ? (
              <button 
                onClick={resumeScan}
                style={{
                  padding: '8px 14px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ▶️ Resume Scan
              </button>
            ) : (
              <button 
                onClick={pauseScan}
                style={{
                  padding: '8px 14px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ⏸️ Pause Scan
              </button>
            )}
            
            <button 
              onClick={stopScan}
              style={{
                padding: '8px 14px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ⏹️ Stop Scan
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={exportCSV}
            disabled={!scanRun || scanRun.orders.length === 0}
            style={{
              padding: '8px 14px',
              background: scanRun?.orders.length ? '#10b981' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: scanRun?.orders.length ? 'pointer' : 'not-allowed',
              fontWeight: '500'
            }}
          >
            📥 Export CSV
          </button>
          
          <button 
            onClick={exportJSON}
            disabled={!scanRun}
            style={{
              padding: '8px 14px',
              background: scanRun ? '#6366f1' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: scanRun ? 'pointer' : 'not-allowed',
              fontWeight: '500'
            }}
          >
            📥 Export JSON
          </button>
          
          <button 
            onClick={clearRunData}
            disabled={isScanning}
            style={{
              padding: '8px 14px',
              background: '#333',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            🗑️ Clear Local Data
          </button>
        </div>
      </div>
      
      {/* Status Panel */}
      {scanRun && (
        <div style={{ 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '12px', 
          padding: '20px',
          marginBottom: '20px' 
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#888' }}>
            SCAN STATUS
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
            <StatusCard label="Phase" value={scanRun.progress.currentPhase} />
            <StatusCard label="Pages Scanned" value={scanRun.progress.pagesScanned} />
            <StatusCard label="eBay Orders" value={scanRun.progress.ebayOrdersFound} />
            <StatusCard label="Payment Pages" value={scanRun.progress.paymentPagesScanned} />
            <StatusCard label="Amazon Matches" value={scanRun.progress.amazonMatchesFound} color="#22c55e" />
            <StatusCard label="Needs Verification" value={scanRun.progress.needsVerificationCount} color="#f59e0b" />
            <StatusCard label="Incomplete" value={scanRun.progress.incompleteCount} color="#888" />
            <StatusCard label="Errors" value={scanRun.progress.errorsCount} color="#ef4444" />
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <TabButton active={selectedTab === 'results'} onClick={() => setSelectedTab('results')}>
          📋 Results ({filteredOrders.length})
        </TabButton>
        <TabButton active={selectedTab === 'verification'} onClick={() => setSelectedTab('verification')}>
          ⚠️ Needs Verification ({scanRun?.progress.needsVerificationCount || 0})
        </TabButton>
        <TabButton active={selectedTab === 'errors'} onClick={() => setSelectedTab('errors')}>
          ❌ Errors ({scanRun?.errors.length || 0})
        </TabButton>
      </div>
      
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search by order ID, item ID, title, or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px'
          }}
        />
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as OrderStatus | 'all')}
          style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="ebay_found">eBay Found</option>
          <option value="payment_scanned">Payment Scanned</option>
          <option value="amazon_matched">Amazon Matched</option>
          <option value="needs_verification">Needs Verification</option>
          <option value="incomplete">Incomplete</option>
          <option value="error">Error</option>
        </select>
      </div>
      
      {/* Results Table */}
      {selectedTab === 'results' && (
        <div style={{ 
          background: 'rgba(255,255,255,0.02)', 
          borderRadius: '12px', 
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={thStyle}>eBay Order</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>eBay Earnings</th>
                  <th style={thStyle}>Amazon Cost</th>
                  <th style={thStyle}>Net Profit</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                      {scanRun ? 'No orders match your filters' : 'Start a scan to see results'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: '500' }}>{order.orderId || '--'}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{order.itemId}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {order.ebayTitle || '--'}
                        </div>
                      </td>
                      <td style={tdStyle}>{order.sku || '--'}</td>
                      <td style={{ ...tdStyle, color: '#22c55e' }}>
                        {formatMoney(order.payment?.orderEarnings)}
                      </td>
                      <td style={{ ...tdStyle, color: '#ef4444' }}>
                        {formatMoney(order.amazonMatch?.amazonOrderTotal)}
                      </td>
                      <td style={tdStyle}>
                        <ProfitCell profit={order.calculated?.estimatedNetProfit} />
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={order.status} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {order.paymentDetailsUrl && (
                            <a href={order.paymentDetailsUrl} target="_blank" rel="noopener" title="View eBay Payment">
                              🔗
                            </a>
                          )}
                          {order.amazonMatch?.amazonOrderUrl && (
                            <a href={order.amazonMatch.amazonOrderUrl} target="_blank" rel="noopener" title="View Amazon Order">
                              📦
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Verification Tab */}
      {selectedTab === 'verification' && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          Verification queue coming soon...
        </div>
      )}
      
      {/* Errors Tab */}
      {selectedTab === 'errors' && (
        <div style={{ padding: '20px' }}>
          {scanRun?.errors.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No errors recorded
            </div>
          ) : (
            scanRun?.errors.map(error => (
              <div key={error.id} style={{ 
                background: 'rgba(239,68,68,0.1)', 
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px'
              }}>
                <div style={{ fontWeight: '500', color: '#ef4444' }}>{error.message}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  Phase: {error.phase} | Order: {error.orderId || '--'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ==================== HELPER COMPONENTS ====================

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '12px',
  textTransform: 'uppercase',
  color: '#888'
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
};

function StatusCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.03)', 
      borderRadius: '8px', 
      padding: '12px' 
    }}>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '600', color: color || 'white' }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: active ? 'white' : '#888',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '13px'
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const colors: Record<OrderStatus, { bg: string; text: string }> = {
    'ebay_found': { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
    'payment_scanned': { bg: 'rgba(34,197,94,0.2)', text: '#22c55e' },
    'amazon_search_pending': { bg: 'rgba(139,92,246,0.2)', text: '#8b5cf6' },
    'amazon_matched': { bg: 'rgba(34,197,94,0.2)', text: '#22c55e' },
    'possible_match': { bg: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
    'needs_verification': { bg: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
    'incomplete': { bg: 'rgba(107,114,128,0.2)', text: '#6b7280' },
    'error': { bg: 'rgba(239,68,68,0.2)', text: '#ef4444' },
    'skipped_refund_or_cancel': { bg: 'rgba(107,114,128,0.2)', text: '#6b7280' },
    'duplicate_possible': { bg: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
  };
  
  const { bg, text } = colors[status] || colors['incomplete'];
  
  return (
    <span style={{
      padding: '4px 8px',
      borderRadius: '4px',
      background: bg,
      color: text,
      fontSize: '11px',
      fontWeight: '500'
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ProfitCell({ profit }: { profit: number | null | undefined }) {
  if (profit === null || profit === undefined) {
    return <span style={{ color: '#666' }}>--</span>;
  }
  
  const color = profit >= 0 ? '#22c55e' : '#ef4444';
  const prefix = profit >= 0 ? '+' : '';
  
  return (
    <span style={{ color, fontWeight: '600' }}>
      {prefix}${profit.toFixed(2)}
    </span>
  );
}
