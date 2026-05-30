/**
 * File-based logging for Hermes debugging
 * Writes all debug output to hermes-debug.log for automated analysis
 * 
 * Usage:
 *   await fileLog('message', 'info');
 *   await fileLog('error details', 'error');
 */

let logBuffer: string[] = [];
const LOG_FILE = 'hermes-debug.log';

// Helper to get current timestamp
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Log to file (Chrome extension can't directly write files, but can use IndexedDB)
 * As a workaround, we store in chrome.storage.local and periodically flush
 */
export async function fileLog(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): Promise<void> {
  const entry = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
  logBuffer.push(entry);
  
  // Also log to console for immediate visibility
  const colors = { 
    info: '#00CFFF', 
    warn: '#FFD700', 
    error: '#ff4444', 
    success: '#22c55e' 
  };
  console.log(`%c[FileLog] ${message}`, `color: ${colors[level]}`);
  
  // Store in chrome.storage.local for persistence across extension reloads
  try {
    const { debugLogs = [] } = await chrome.storage.local.get('debugLogs');
    debugLogs.push(entry);
    
    // Keep only last 500 entries to avoid storage bloat
    const trimmed = debugLogs.slice(-500);
    await chrome.storage.local.set({ debugLogs: trimmed });
  } catch (e) {
    console.error('[FileLog] Failed to write to storage:', e);
  }
}

/**
 * Flush all logs to console output (call this from popup or background service)
 * In a real app, this would write to a file via native messaging
 */
export async function flushLogs(): Promise<string> {
  const { debugLogs = [] } = await chrome.storage.local.get('debugLogs');
  const allLogs = debugLogs.join('\n');
  console.log(`%c[FileLog] === FLUSHING ${debugLogs.length} LOG ENTRIES ===`, 'color: #FFD700; font-weight: bold');
  console.log(allLogs);
  return allLogs;
}

/**
 * Clear debug logs
 */
export async function clearLogs(): Promise<void> {
  await chrome.storage.local.set({ debugLogs: [] });
  logBuffer = [];
}

/**
 * Get logs as string (for export or display)
 */
export async function getLogs(): Promise<string> {
  const { debugLogs = [] } = await chrome.storage.local.get('debugLogs');
  return debugLogs.join('\n');
}
