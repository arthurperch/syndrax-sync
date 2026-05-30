import { useState, useEffect } from 'react';

interface AgentStatus {
  debugServer: { running: boolean; pid?: number; uptime?: number };
  hermesAgent: { running: boolean; pid?: number; uptime?: number };
  lastCheck: number;
}

export default function Agents() {
  const [status, setStatus] = useState<AgentStatus>({
    debugServer: { running: false },
    hermesAgent: { running: false },
    lastCheck: 0,
  });

  const [loadingDebugServer, setLoadingDebugServer] = useState(false);
  const [loadingHermesAgent, setLoadingHermesAgent] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_AGENT_STATUS',
        timestamp: Date.now(),
      });
      setStatus(response);
      setError(null);
    } catch (err) {
      setError(`Status check failed: ${(err as Error).message}`);
    }
  }

  async function executeCommand(command: string, label: string) {
    try {
      setError(null);
      
      if (command.includes('debug-server')) {
        setLoadingDebugServer(true);
      } else {
        setLoadingHermesAgent(true);
      }

      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_AGENT_COMMAND',
        command,
        timestamp: Date.now(),
      });

      if (response.success) {
        setLastAction(`✅ ${label} successful`);
        setTimeout(() => checkStatus(), 1500);
      } else {
        setError(`Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Command failed: ${(err as Error).message}`);
    } finally {
      setLoadingDebugServer(false);
      setLoadingHermesAgent(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Agents</h2>
        <p>Hermes Agent & Debug Server Control</p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12, padding: 10, borderLeft: '4px solid var(--error)' }}>
          <div style={{ color: 'var(--error)', fontSize: 12 }}>⚠️ {error}</div>
        </div>
      )}

      {lastAction && (
        <div className="card" style={{ marginBottom: 12, padding: 10, borderLeft: '4px solid var(--success)' }}>
          <div style={{ color: 'var(--success)', fontSize: 12 }}>{lastAction}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Debug Server</span>
              <span style={{ fontSize: 11, color: status.debugServer.running ? 'var(--success)' : 'var(--error)' }}>
                {status.debugServer.running ? '🟢 Running' : '🔴 Stopped'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>localhost:3000</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              className="btn btn-gradient"
              onClick={() => executeCommand('start-debug-server', 'Debug Server started')}
              disabled={status.debugServer.running || loadingDebugServer}
              style={{ fontSize: 11, padding: '8px 6px' }}
            >
              {loadingDebugServer ? '⏳' : '▶'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => executeCommand('stop-debug-server', 'Debug Server stopped')}
              disabled={!status.debugServer.running || loadingDebugServer}
              style={{ fontSize: 11, padding: '8px 6px' }}
            >
              {loadingDebugServer ? '⏳' : '⏹'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Hermes Agent</span>
              <span style={{ fontSize: 11, color: status.hermesAgent.running ? 'var(--success)' : 'var(--error)' }}>
                {status.hermesAgent.running ? '🟢 Running' : '🔴 Stopped'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>root162 — 50.190.39.162</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              className="btn btn-gradient"
              onClick={() => executeCommand('start-hermes-agent', 'Hermes Agent started')}
              disabled={status.hermesAgent.running || loadingHermesAgent}
              style={{ fontSize: 11, padding: '8px 6px' }}
            >
              {loadingHermesAgent ? '⏳' : '▶'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => executeCommand('stop-hermes-agent', 'Hermes Agent stopped')}
              disabled={!status.hermesAgent.running || loadingHermesAgent}
              style={{ fontSize: 11, padding: '8px 6px' }}
            >
              {loadingHermesAgent ? '⏳' : '⏹'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <h3 style={{ fontSize: 11, marginBottom: 8, color: 'var(--gray)' }}>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            className="btn btn-outline"
            onClick={() => executeCommand('restart-hermes-agent', 'Hermes Agent restarted')}
            disabled={loadingHermesAgent}
            style={{ fontSize: 11, padding: '8px 6px' }}
          >
            🔄 Restart
          </button>
          <button
            className="btn btn-outline"
            onClick={() => executeCommand('view-logs', 'Opening logs')}
            style={{ fontSize: 11, padding: '8px 6px' }}
          >
            📋 Logs
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 12, marginTop: 12 }}>
        <h3 style={{ fontSize: 11, marginBottom: 8, color: 'var(--gray)' }}>Status</h3>
        <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div>Last Check: {new Date(status.lastCheck).toLocaleTimeString()}</div>
          <div style={{ marginTop: 4 }}>
            Debug Server: {status.debugServer.running ? `Running` : 'Stopped'}
          </div>
          <div>
            Hermes Agent: {status.hermesAgent.running ? `Running` : 'Stopped'}
          </div>
        </div>
      </div>
    </div>
  );
}
