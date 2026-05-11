import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface DebugConsoleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function DebugConsole({ isOpen, onToggle }: DebugConsoleProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for debug messages from background and content scripts
    const handler = (msg: { type: string; payload?: Record<string, unknown> }) => {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      let logType: LogEntry['type'] = 'info';
      let logMessage = '';

      switch (msg.type) {
        case 'SYNC_STARTED':
          logType = 'info';
          logMessage = `[SYNC] Starting sync of ${msg.payload?.totalItems} items...`;
          break;
        case 'SYNC_PROGRESS':
          logType = 'info';
          logMessage = `[SYNC] ${msg.payload?.checked}/${msg.payload?.total} - ${msg.payload?.lastAction}: ${msg.payload?.lastItem}`;
          break;
        case 'SYNC_COMPLETE':
          logType = 'success';
          const session = msg.payload?.session as Record<string, unknown>;
          logMessage = `[SYNC] Complete! Checked: ${session?.checked}, Updated: ${session?.priceUpdated}, OOS: ${session?.outOfStock}`;
          break;
        case 'SCAN_PROGRESS':
          logType = 'info';
          logMessage = `[SCAN] Page ${msg.payload?.page} - ${msg.payload?.itemsFound} items found`;
          break;
        case 'SCAN_COMPLETE':
          logType = 'success';
          logMessage = `[SCAN] Complete! ${msg.payload?.totalItems} total listings`;
          break;
        case 'AMAZON_PRICE_RESULT':
          const data = msg.payload?.data as Record<string, unknown>;
          logType = data?.inStock ? 'success' : 'warning';
          logMessage = `[AMAZON] ASIN: ${data?.asin} | Price: $${data?.currentPrice} | Stock: ${data?.inStock ? 'Yes' : 'OUT OF STOCK'}`;
          break;
        case 'DEBUG_LOG':
          logType = (msg.payload?.level as LogEntry['type']) || 'info';
          logMessage = msg.payload?.message as string || '';
          break;
        default:
          return; // Don't log unknown messages
      }

      if (logMessage) {
        setLogs(prev => [...prev.slice(-200), { // Keep last 200 logs
          id: crypto.randomUUID(),
          time: timestamp,
          type: logType,
          message: logMessage
        }]);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    setLogs(prev => [...prev.slice(-200), {
      id: crypto.randomUUID(),
      time: timestamp,
      type,
      message
    }]);
  };

  const clearLogs = () => setLogs([]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'error': return 'var(--error)';
      default: return 'var(--gray)';
    }
  };

  // Test function to run sync on first 3 items
  const handleTestSync = async () => {
    addLog('info', '[TEST] Starting test sync of first 3 items...');
    
    try {
      // Get inventory
      const result = await chrome.storage.local.get('syndrax_inventory');
      const inventoryObj = result.syndrax_inventory || {};
      const items = Object.values(inventoryObj).filter((item: unknown) => 
        (item as { sourceUrl?: string }).sourceUrl
      ).slice(0, 3);

      addLog('info', `[TEST] Found ${items.length} items with source URLs`);

      if (items.length === 0) {
        addLog('warning', '[TEST] No items with source URLs found. Scan inventory first.');
        return;
      }

      // Open tabs for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as { sourceUrl: string; title: string; asin?: string };
        addLog('info', `[TEST] Opening tab ${i + 1}: ${item.asin || 'N/A'} - ${item.title.substring(0, 40)}...`);
        
        const tab = await chrome.tabs.create({
          url: item.sourceUrl,
          active: i === 0 // Make first tab active
        });

        addLog('success', `[TEST] Tab ${i + 1} opened: ID ${tab.id}`);
      }

      addLog('success', '[TEST] All tabs opened! Check Amazon pages for prices.');
      
    } catch (error) {
      addLog('error', `[TEST] Error: ${(error as Error).message}`);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'var(--gradient)',
          color: '#0a0f1e',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          zIndex: 9999
        }}
      >
        🔧 Debug
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '220px',
      background: '#0a0f1e',
      borderTop: '1px solid var(--blue)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 10px',
        background: 'rgba(0,207,255,0.08)',
        borderBottom: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)' }}>
          🔧 Debug Console
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            onClick={handleTestSync}
            style={{
              background: 'var(--success)',
              color: 'white',
              border: 'none',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer'
            }}
          >
            ▶ Test 3 Items
          </button>
          <button 
            onClick={clearLogs}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--gray)',
              border: 'none',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            fontSize: 10,
            color: 'var(--gray)',
            cursor: 'pointer'
          }}>
            <input 
              type="checkbox" 
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button 
            onClick={onToggle}
            style={{
              background: 'transparent',
              color: 'var(--gray)',
              border: 'none',
              padding: '3px 8px',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            ⌄
          </button>
        </div>
      </div>

      {/* Logs */}
      <div 
        ref={logContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '6px 10px',
          fontSize: 10,
          lineHeight: 1.6
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: 10 }}>
            No logs yet. Click "Test 3 Items" to start testing.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--muted)', minWidth: 60 }}>{log.time}</span>
              <span style={{ color: getLogColor(log.type) }}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
