import { useState, useEffect } from 'react';
import { storage, type Settings as SettingsType } from '../services/storage';
import { validateApiKey } from '../services/ai';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>({
    markupPercent: 30,
    priceChangeThreshold: 5,
    defaultSupplier: 'amazon',
    dailySyncTime: '06:00',
    debugMode: false
  });
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const stored = await storage.getSettings();
    setSettings(stored);
    const key = await storage.getApiKey();
    if (key) setApiKey(key);
  }

  async function handleSave() {
    setSaving(true);
    await storage.saveSettings(settings);
    if (apiKey.trim()) {
      await storage.saveApiKey(apiKey);
    }
    await storage.addActivity('Settings saved', 'success');
    setSaving(false);
  }

  async function handleTestConnection() {
    if (!apiKey.trim()) {
      setTestResult('error');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    const isValid = await validateApiKey(apiKey);
    setTestResult(isValid ? 'success' : 'error');
    
    if (isValid) {
      await storage.addActivity('API key validated successfully', 'success');
    } else {
      await storage.addActivity('API key validation failed', 'error');
    }
    
    setTesting(false);
  }

  async function handleClearData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await storage.clear();
      await storage.addActivity('All data cleared', 'warning');
      window.location.reload();
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure Syndrax Sync preferences</p>
      </div>

      <div className="card">
        <div className="form-group">
          <label>Markup Percentage: {settings.markupPercent}%</label>
          <input
            type="range"
            className="slider"
            min="10"
            max="100"
            value={settings.markupPercent}
            onChange={e => setSettings({ ...settings, markupPercent: Number(e.target.value) })}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
            <span>10%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="form-group">
          <label>Price Change Threshold (%)</label>
          <input
            type="number"
            className="input"
            value={settings.priceChangeThreshold}
            onChange={e => setSettings({ ...settings, priceChangeThreshold: Number(e.target.value) })}
            min="1"
            max="50"
          />
        </div>

        <div className="form-group">
          <label>Default Supplier</label>
          <select
            className="input"
            value={settings.defaultSupplier}
            onChange={e => setSettings({ ...settings, defaultSupplier: e.target.value as 'amazon' | 'aliexpress' })}
          >
            <option value="amazon">Amazon</option>
            <option value="aliexpress">AliExpress</option>
          </select>
        </div>

        <div className="form-group">
          <label>Daily Sync Time</label>
          <input
            type="time"
            className="input"
            value={settings.dailySyncTime}
            onChange={e => setSettings({ ...settings, dailySyncTime: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 12, color: 'var(--white)' }}>AI Integration</h3>
        
        <div className="form-group">
          <label>Anthropic API Key</label>
          <input
            type="password"
            className="input"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-outline" 
            onClick={handleTestConnection}
            disabled={testing || !apiKey.trim()}
          >
            {testing ? 'Testing...' : '🔌 Test Connection'}
          </button>
          {testResult === 'success' && (
            <span className="badge badge-success" style={{ alignSelf: 'center' }}>✓ Valid</span>
          )}
          {testResult === 'error' && (
            <span className="badge badge-error" style={{ alignSelf: 'center' }}>✗ Invalid</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button 
          className="btn btn-gradient" 
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <button 
          className="btn btn-danger" 
          onClick={handleClearData}
          style={{ width: '100%' }}
        >
          🗑️ Clear All Data
        </button>
      </div>
    </div>
  );
}
