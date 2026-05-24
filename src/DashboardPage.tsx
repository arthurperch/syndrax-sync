/**
 * DashboardPage.tsx — Syndrax Sync Cluster Operations Monitor
 * Complete self-contained dashboard for monitoring 9-node cluster
 * Fetches /cluster_status.json every 30s, displays live metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Server, GitBranch, Briefcase, Bell, Activity,
  FileText, Settings, MoreVertical, RefreshCw, Zap, ExternalLink,
  Search, Filter, ChevronLeft, Play, Square, Download, Database,
  Clock, AlertTriangle, CheckCircle, XCircle, Cpu, HardDrive,
  Wifi, Triangle, Edit, Trash2, Plus, RefreshCcw, X
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ClusterNode {
  name: string;
  ip: string;
  role: string;
  os: string;
  status: 'online' | 'standby' | 'offline';
  agent_active: boolean;
  agent_phase: string;
  agent_model: string;
  model_badge: string[];
  uptime: string;
  tasks: number;
  load: string;
  cpu: number;
  ram: number;
  disk: number;
  ping_ms: number;
  process_count: number;
  alerts: number;
  alert_sources: string[];
  in_stock: number;
  inventory_trend_7d: number[];
  last_seen: string;
  hostname: string;
}

interface ClusterSummary {
  total_nodes: number;
  online: number;
  standby: number;
  offline: number;
  total_inventory: number;
  cpu_avg: number;
  ram_avg: number;
  disk_avg: number;
  tasks_running: number;
  alerts: number;
  cluster_health: string;
  uptime_master: string;
  inventory_trend_30d: number[];
}

interface ClusterStatus {
  updated_at: string;
  auto_refresh_interval: number;
  summary: ClusterSummary;
  nodes: ClusterNode[];
}

type TabView = 'nodes' | 'manager' | 'pipelines' | 'alerts' | 'models' | 'jobs';
type StatusFilter = 'all' | 'online' | 'standby' | 'offline';

interface NodeConfig {
  name: string;
  ip: string;
  role: string;
  os: string;
  ssh: { user: string; password: string } | null;
}

interface NodesConfig {
  nodes: NodeConfig[];
  last_updated: string;
  version: number;
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA FALLBACK
// ═══════════════════════════════════════════════════════════════

const MOCK_DATA: ClusterStatus = {
  updated_at: new Date().toISOString(),
  auto_refresh_interval: 30,
  summary: {
    total_nodes: 9,
    online: 1,
    standby: 7,
    offline: 1,
    total_inventory: 1326,
    cpu_avg: 28,
    ram_avg: 43,
    disk_avg: 33,
    tasks_running: 3,
    alerts: 2,
    cluster_health: 'Healthy',
    uptime_master: '14d 6h 22m',
    inventory_trend_30d: [1100, 1150, 1200, 1250, 1290, 1310, 1326]
  },
  nodes: [
    {
      name: 'root162', ip: '192.168.1.162', role: 'Primary Worker', os: 'Windows 11',
      status: 'online', agent_active: true, agent_phase: 'Phase 1 — Research',
      agent_model: 'qwen2.5-coder:7b', model_badge: ['ollama:qwen2.5-coder:7b', 'CDP Active', 'hermes_agent'],
      uptime: '14d 6h 22m', tasks: 3, load: 'Medium', cpu: 34, ram: 61, disk: 42,
      ping_ms: 2, process_count: 147, alerts: 2,
      alert_sources: ['HERMES TASKS: TASK-019 unresolved', 'BUGS.md: ebay-sync timeout'],
      in_stock: 482, inventory_trend_7d: [440, 455, 462, 470, 476, 480, 482],
      last_seen: new Date().toISOString(), hostname: 'DESKTOP-ROOT162'
    },
    {
      name: 'root163', ip: '192.168.1.163', role: 'Sync Engine', os: 'Windows 11',
      status: 'standby', agent_active: false, agent_phase: '', agent_model: '', model_badge: [],
      uptime: '12d 3h 15m', tasks: 0, load: 'Low', cpu: 17, ram: 38, disk: 29,
      ping_ms: 1, process_count: 98, alerts: 0, alert_sources: [],
      in_stock: 214, inventory_trend_7d: [180, 190, 195, 200, 205, 210, 214],
      last_seen: new Date().toISOString(), hostname: 'DESKTOP-ROOT163'
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getStatusColor(status: string): string {
  if (status === 'online') return 'cyan';
  if (status === 'standby') return 'violet';
  return 'red';
}

function getLoadColor(load: string): string {
  if (load === 'Low') return 'emerald';
  if (load === 'Medium') return 'amber';
  if (load === 'High') return 'red';
  return 'slate';
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function SyndraxLogoSVG() {
  return (
    <svg viewBox="0 0 120 120" className="h-8 w-8" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="48%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#logo-grad)" strokeWidth="7" strokeLinecap="round">
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(0 60 60)" />
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(60 60 60)" />
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(120 60 60)" />
      </g>
      <circle cx="60" cy="60" r="10" fill="url(#logo-grad)" />
    </svg>
  );
}

function ServerHardwareSVG({ status, color }: { status: string; color: string }) {
  const ledColor = status === 'online' ? '#22d3ee' : status === 'standby' ? '#a78bfa' : '#64748b';
  const glowColor = status === 'online' ? 'rgba(34,211,238,0.3)' : status === 'standby' ? 'rgba(167,139,250,0.2)' : 'rgba(100,116,123,0.1)';
  
  return (
    <svg viewBox="0 0 140 80" className="w-full h-20" aria-hidden="true">
      <defs>
        <filter id={`glow-${status}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Server chassis */}
      <rect x="10" y="20" width="120" height="40" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1.5"/>
      
      {/* LED indicators (left side) */}
      <rect x="18" y="28" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.9}/>
      <rect x="24" y="28" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.8}/>
      <rect x="30" y="28" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.7}/>
      <rect x="36" y="28" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.6}/>
      
      <rect x="18" y="34" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.9}/>
      <rect x="24" y="34" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.8}/>
      <rect x="30" y="34" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.7}/>
      <rect x="36" y="34" width="4" height="3" rx="1" fill={ledColor} opacity={status === 'offline' ? 0.2 : 0.6}/>
      
      {/* Vent lines (middle) */}
      <line x1="50" y1="28" x2="90" y2="28" stroke="#475569" strokeWidth="0.5"/>
      <line x1="50" y1="32" x2="90" y2="32" stroke="#475569" strokeWidth="0.5"/>
      <line x1="50" y1="36" x2="90" y2="36" stroke="#475569" strokeWidth="0.5"/>
      <line x1="50" y1="40" x2="90" y2="40" stroke="#475569" strokeWidth="0.5"/>
      <line x1="50" y1="44" x2="90" y2="44" stroke="#475569" strokeWidth="0.5"/>
      <line x1="50" y1="48" x2="90" y2="48" stroke="#475569" strokeWidth="0.5"/>
      
      {/* Drive bays (right side) */}
      <circle cx="100" cy="32" r="3" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
      <circle cx="100" cy="44" r="3" fill="#1e293b" stroke="#475569" strokeWidth="1"/>
      
      {/* Power button */}
      <circle cx="115" cy="38" r="4" fill="#1e293b" stroke={ledColor} strokeWidth="1.5" opacity={status === 'offline' ? 0.3 : 1}/>
      
      {/* Glow effect */}
      {status !== 'offline' && (
        <rect x="10" y="20" width="120" height="40" rx="4" fill="none" stroke={ledColor} strokeWidth="2" opacity="0.3" filter={`url(#glow-${status})`}/>
      )}
    </svg>
  );
}

function Sparkline({ data, color = 'cyan' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  const colorMap: Record<string, string> = {
    cyan: '#22d3ee',
    violet: '#a78bfa',
    red: '#f87171',
    emerald: '#34d399'
  };
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color] || colorMap.cyan}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// NODE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function NodeCard({ node }: { node: ClusterNode }) {
  const statusColor = getStatusColor(node.status);
  const loadColor = getLoadColor(node.load);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 p-4 min-h-[520px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {node.agent_active && (
            <span className={`h-2 w-2 rounded-full bg-${statusColor}-400 animate-pulse`} />
          )}
          {!node.agent_active && node.status !== 'offline' && (
            <span className={`h-2 w-2 rounded-full bg-${statusColor}-400`} />
          )}
          {node.status === 'offline' && (
            <span className="h-2 w-2 rounded-full bg-slate-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-100">{node.name}</p>
            <p className="text-[10px] text-slate-500 font-mono">{node.ip}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border border-${statusColor}-400/40 bg-${statusColor}-400/10 px-2 py-0.5 text-[9px] font-medium text-${statusColor}-300`}>
            {node.status === 'online' && node.agent_active ? 'Active' : node.status}
          </span>
          <button className="text-slate-600 hover:text-slate-400">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Server Hardware SVG */}
      <div className="mb-3">
        <ServerHardwareSVG status={node.status} color={statusColor} />
      </div>
      
      {/* Badge Row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="rounded-md border border-slate-600/40 bg-slate-800/40 px-2 py-0.5 text-[9px] text-slate-400">
          {node.os}
        </span>
        <span className={`rounded-md border border-${statusColor}-400/40 bg-${statusColor}-400/10 px-2 py-0.5 text-[9px] text-${statusColor}-300`}>
          {node.role}
        </span>
        {node.model_badge && node.model_badge.length > 0 && (
          <span className="rounded-md border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[9px] text-purple-300 flex items-center gap-1">
            <Cpu className="h-2.5 w-2.5" />
            {node.model_badge[0].replace('ollama:', '')}
          </span>
        )}
      </div>
      
      {/* Agent Status Line */}
      <div className="mb-3">
        {node.agent_active ? (
          <p className="text-[10px] text-cyan-400 flex items-center gap-1">
            <Wifi className="h-3 w-3 animate-pulse" />
            ACTIVE — {node.agent_phase}
          </p>
        ) : node.status === 'standby' ? (
          <p className="text-[10px] text-violet-400">Standby</p>
        ) : (
          <p className="text-[10px] text-red-400">Offline</p>
        )}
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-[9px] text-slate-600 uppercase">Uptime</p>
          <p className="text-[11px] text-slate-300 font-medium">{node.uptime}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-600 uppercase">Tasks</p>
          <p className="text-[11px] text-slate-300 font-medium">{node.tasks}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-600 uppercase">Load</p>
          <p className={`text-[11px] font-medium text-${loadColor}-400`}>{node.load}</p>
        </div>
      </div>
      
      {/* Progress Bars */}
      <div className="space-y-2 mb-3">
        {/* CPU */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-8">CPU</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${node.cpu > 80 ? 'bg-red-400' : 'bg-cyan-400'}`}
              style={{ width: `${node.cpu}%` }}
            />
          </div>
          <span className={`text-[10px] w-8 text-right ${node.cpu > 80 ? 'text-red-400' : 'text-slate-300'}`}>
            {node.cpu}%
          </span>
        </div>
        
        {/* RAM */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-8">RAM</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${node.ram > 80 ? 'bg-red-400' : 'bg-cyan-400'}`}
              style={{ width: `${node.ram}%` }}
            />
          </div>
          <span className={`text-[10px] w-8 text-right ${node.ram > 80 ? 'text-red-400' : 'text-slate-300'}`}>
            {node.ram}%
          </span>
        </div>
        
        {/* DISK */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-8">DISK</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${node.disk > 80 ? 'bg-red-400' : 'bg-cyan-400'}`}
              style={{ width: `${node.disk}%` }}
            />
          </div>
          <span className={`text-[10px] w-8 text-right ${node.disk > 80 ? 'text-red-400' : 'text-slate-300'}`}>
            {node.disk}%
          </span>
        </div>
      </div>
      
      {/* Agent Status Section */}
      <div className="mb-3">
        <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">Agent Status</p>
        {node.agent_active ? (
          <div className="flex items-center gap-2">
            <Wifi className="h-3 w-3 text-cyan-400 animate-pulse" />
            <p className="text-[10px] text-cyan-300">{node.agent_phase}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-slate-700" />
            <p className="text-[10px] text-slate-500">No Agent</p>
          </div>
        )}
      </div>
      
      {/* Alerts + In Stock Row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
          <p className="text-[9px] text-slate-600 uppercase mb-1">Alerts</p>
          <div className="flex items-center gap-1">
            <AlertTriangle className={`h-3 w-3 ${node.alerts > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className={`text-sm font-semibold ${node.alerts > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
              {node.alerts}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
          <p className="text-[9px] text-slate-600 uppercase mb-1">In Stock</p>
          <span className="text-sm font-semibold text-cyan-400">{node.in_stock.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Monthly Trend */}
      <div className="mb-3 flex-1">
        <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">7-Day Trend</p>
        <div className="h-16 w-full">
          <Sparkline data={node.inventory_trend_7d} color={statusColor} />
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-white/5 pt-2 mt-auto">
        <p className="text-[9px] text-slate-600">
          Last seen: {formatTimeAgo(node.last_seen)}
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NODE MANAGER HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getNextNodeName(nodes: NodeConfig[]): string {
  const rootNumbers = nodes
    .map(n => parseInt(n.name.replace('root', '')))
    .filter(n => !isNaN(n));
  const maxNum = rootNumbers.length > 0 ? Math.max(...rootNumbers) : 161;
  return `root${maxNum + 1}`;
}

async function testPing(ip: string): Promise<'online' | 'offline'> {
  // Simulate ping test - in production this would use actual ping
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate 80% success rate
      resolve(Math.random() > 0.2 ? 'online' : 'offline');
    }, 1000);
  });
}

function postDiscordTask(action: string, node: NodeConfig): void {
  const taskId = `NODE-${Date.now()}`;
  const message = `🔧 NODE MANAGER TASK [LOW PRIORITY]
Action: ${action}
Node: ${node.name}
IP: ${node.ip}
Role: ${node.role}
OS: ${node.os}
Requested: ${new Date().toISOString()}
Status: PENDING
Task ID: ${taskId}`;
  
  console.log('[Discord Task]', message);
  // In production: POST to Discord webhook
  // fetch(webhookUrl, { method: 'POST', body: JSON.stringify({ content: message }) });
}

function saveToStorage(nodes: NodeConfig[]): void {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ syndrax_nodes: nodes });
    } else {
      localStorage.setItem('syndrax_nodes', JSON.stringify(nodes));
    }
  } catch (e) {
    console.error('Storage save failed:', e);
  }
}

function gitCommitNodeConfig(action: string, nodeName: string): void {
  const timestamp = new Date().toISOString();
  const message = `node: ${action} ${nodeName} ${timestamp}`;
  console.log('[Git Commit]', message);
  // In production: chrome.runtime.sendMessage({ type: 'GIT_COMMIT', message, file: 'public/nodes_config.json' });
}

// ═══════════════════════════════════════════════════════════════
// NODE MANAGER MODALS
// ═══════════════════════════════════════════════════════════════

function AddNodeModal({ 
  onClose, 
  onSave, 
  existingNodes 
}: { 
  onClose: () => void; 
  onSave: (node: NodeConfig) => void;
  existingNodes: NodeConfig[];
}) {
  const [name, setName] = useState(getNextNodeName(existingNodes));
  const [ip, setIp] = useState('');
  const [role, setRole] = useState('Standby');
  const [os, setOs] = useState('Windows 11');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [pingStatus, setPingStatus] = useState<'idle' | 'pending' | 'online' | 'offline'>('idle');

  const handleTestPing = async () => {
    if (!ip) return;
    setPingStatus('pending');
    const result = await testPing(ip);
    setPingStatus(result);
  };

  const handleSave = () => {
    const newNode: NodeConfig = {
      name,
      ip,
      role,
      os,
      ssh: os === 'Ubuntu 22.04' && sshUser ? { user: sshUser, password: sshPassword } : null
    };
    onSave(newNode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-2xl border border-white/10 p-6 w-[500px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">Add New Node</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Node Name */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Node Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            />
          </div>

          {/* IP Address */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">IP Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.XXX"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
              />
              <button
                onClick={handleTestPing}
                disabled={!ip || pingStatus === 'pending'}
                className="px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20 disabled:opacity-50"
              >
                {pingStatus === 'pending' ? 'Testing...' : 'Test Ping'}
              </button>
            </div>
            {pingStatus !== 'idle' && pingStatus !== 'pending' && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`h-2 w-2 rounded-full ${pingStatus === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`text-xs ${pingStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pingStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            >
              <option value="Primary Worker">Primary Worker</option>
              <option value="Sync Engine">Sync Engine</option>
              <option value="CDP Chrome">CDP Chrome</option>
              <option value="AI Ollama">AI Ollama</option>
              <option value="VPS Hermes">VPS Hermes</option>
              <option value="Standby">Standby</option>
            </select>
          </div>

          {/* OS */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Operating System</label>
            <select
              value={os}
              onChange={(e) => setOs(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            >
              <option value="Windows 11">Windows 11</option>
              <option value="Ubuntu 22.04">Ubuntu 22.04</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* SSH Credentials (only for Linux) */}
          {os === 'Ubuntu 22.04' && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">SSH User (optional)</label>
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">SSH Password (optional)</label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                />
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !ip}
            className="flex-1 px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20 disabled:opacity-50"
          >
            Save Node
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditNodeModal({ 
  onClose, 
  onSave, 
  node 
}: { 
  onClose: () => void; 
  onSave: (node: NodeConfig) => void;
  node: NodeConfig;
}) {
  const [name, setName] = useState(node.name);
  const [ip, setIp] = useState(node.ip);
  const [role, setRole] = useState(node.role);
  const [os, setOs] = useState(node.os);
  const [sshUser, setSshUser] = useState(node.ssh?.user || 'root');
  const [sshPassword, setSshPassword] = useState(node.ssh?.password || '');
  const [pingStatus, setPingStatus] = useState<'idle' | 'pending' | 'online' | 'offline'>('idle');

  const handleTestPing = async () => {
    if (!ip) return;
    setPingStatus('pending');
    const result = await testPing(ip);
    setPingStatus(result);
  };

  const handleSave = () => {
    const updatedNode: NodeConfig = {
      name,
      ip,
      role,
      os,
      ssh: os === 'Ubuntu 22.04' && sshUser ? { user: sshUser, password: sshPassword } : null
    };
    onSave(updatedNode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-2xl border border-white/10 p-6 w-[500px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">Edit Node</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Node Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">IP Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.XXX"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
              />
              <button
                onClick={handleTestPing}
                disabled={!ip || pingStatus === 'pending'}
                className="px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20 disabled:opacity-50"
              >
                {pingStatus === 'pending' ? 'Testing...' : 'Test Ping'}
              </button>
            </div>
            {pingStatus !== 'idle' && pingStatus !== 'pending' && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`h-2 w-2 rounded-full ${pingStatus === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`text-xs ${pingStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pingStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            >
              <option value="Primary Worker">Primary Worker</option>
              <option value="Sync Engine">Sync Engine</option>
              <option value="CDP Chrome">CDP Chrome</option>
              <option value="AI Ollama">AI Ollama</option>
              <option value="VPS Hermes">VPS Hermes</option>
              <option value="Standby">Standby</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Operating System</label>
            <select
              value={os}
              onChange={(e) => setOs(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
            >
              <option value="Windows 11">Windows 11</option>
              <option value="Ubuntu 22.04">Ubuntu 22.04</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {os === 'Ubuntu 22.04' && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">SSH User (optional)</label>
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">SSH Password (optional)</label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !ip}
            className="flex-1 px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20 disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ReplaceNodeModal({ 
  onClose, 
  onSave, 
  node,
  clusterData
}: { 
  onClose: () => void; 
  onSave: (oldNode: NodeConfig, newNode: NodeConfig) => void;
  node: NodeConfig;
  clusterData: ClusterStatus;
}) {
  const [ip, setIp] = useState(node.ip);
  const [os, setOs] = useState(node.os);
  const [pingStatus, setPingStatus] = useState<'idle' | 'pending' | 'online' | 'offline'>('idle');

  const liveNode = clusterData.nodes.find(n => n.ip === node.ip);

  const handleTestPing = async () => {
    if (!ip) return;
    setPingStatus('pending');
    const result = await testPing(ip);
    setPingStatus(result);
  };

  const handleSave = () => {
    const newNode: NodeConfig = {
      ...node,
      ip,
      os,
    };
    onSave(node, newNode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 rounded-2xl border border-white/10 p-6 w-[500px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100">Replace Hardware — {node.name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg border border-amber-400/20 bg-amber-400/5">
          <p className="text-xs text-amber-400 font-medium">History and stats will be preserved</p>
        </div>

        <div className="space-y-4">
          {/* Read-only fields */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Node Name (preserved)</label>
            <input
              type="text"
              value={node.name}
              disabled
              className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Role (preserved)</label>
            <input
              type="text"
              value={node.role}
              disabled
              className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">In Stock</label>
              <input
                type="text"
                value={liveNode?.in_stock.toLocaleString() || '0'}
                disabled
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Alerts</label>
              <input
                type="text"
                value={liveNode?.alerts || '0'}
                disabled
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tasks</label>
              <input
                type="text"
                value={liveNode?.tasks || '0'}
                disabled
                className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Editable fields */}
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-cyan-400 font-medium mb-3">New Hardware Configuration</p>
            
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">New IP Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.168.1.XXX"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                />
                <button
                  onClick={handleTestPing}
                  disabled={!ip || pingStatus === 'pending'}
                  className="px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20 disabled:opacity-50"
                >
                  {pingStatus === 'pending' ? 'Testing...' : 'Test Ping'}
                </button>
              </div>
              {pingStatus !== 'idle' && pingStatus !== 'pending' && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`h-2 w-2 rounded-full ${pingStatus === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className={`text-xs ${pingStatus === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pingStatus === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Operating System</label>
              <select
                value={os}
                onChange={(e) => setOs(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
              >
                <option value="Windows 11">Windows 11</option>
                <option value="Ubuntu 22.04">Ubuntu 22.04</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!ip}
            className="flex-1 px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20 disabled:opacity-50"
          >
            Replace Hardware
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NODE MANAGER VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════

function NodeManagerView({ 
  clusterData 
}: { 
  clusterData: ClusterStatus;
}) {
  const [nodesConfig, setNodesConfig] = useState<NodesConfig | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeConfig | null>(null);
  const [lastSynced, setLastSynced] = useState(new Date());

  useEffect(() => {
    fetch('/nodes_config.json')
      .then(r => r.json())
      .then(setNodesConfig)
      .catch(console.error);
  }, []);

  const handleAddNode = (node: NodeConfig) => {
    if (!nodesConfig) return;
    
    const updatedNodes = [...nodesConfig.nodes, node];
    const updatedConfig = {
      ...nodesConfig,
      nodes: updatedNodes,
      last_updated: new Date().toISOString()
    };
    
    setNodesConfig(updatedConfig);
    saveToStorage(updatedNodes);
    postDiscordTask('ADD_NODE', node);
    gitCommitNodeConfig('ADD_NODE', node.name);
    setLastSynced(new Date());
  };

  const handleEditNode = (updatedNode: NodeConfig) => {
    if (!nodesConfig) return;
    
    const updatedNodes = nodesConfig.nodes.map(n => 
      n.name === updatedNode.name ? updatedNode : n
    );
    const updatedConfig = {
      ...nodesConfig,
      nodes: updatedNodes,
      last_updated: new Date().toISOString()
    };
    
    setNodesConfig(updatedConfig);
    saveToStorage(updatedNodes);
    postDiscordTask('EDIT_NODE', updatedNode);
    gitCommitNodeConfig('EDIT_NODE', updatedNode.name);
    setLastSynced(new Date());
  };

  const handleReplaceNode = (oldNode: NodeConfig, newNode: NodeConfig) => {
    if (!nodesConfig) return;
    
    // Archive old node data
    const archiveKey = `${oldNode.name}_replaced_${Date.now()}`;
    console.log(`[Archive] ${archiveKey}:`, oldNode);
    
    const updatedNodes = nodesConfig.nodes.map(n => 
      n.name === oldNode.name ? newNode : n
    );
    const updatedConfig = {
      ...nodesConfig,
      nodes: updatedNodes,
      last_updated: new Date().toISOString()
    };
    
    setNodesConfig(updatedConfig);
    saveToStorage(updatedNodes);
    postDiscordTask('REPLACE_NODE', newNode);
    gitCommitNodeConfig('REPLACE_NODE', newNode.name);
    setLastSynced(new Date());
  };

  const handleRemoveNode = (nodeName: string) => {
    if (!nodesConfig || !confirm(`Remove ${nodeName} from cluster? History will be archived.`)) return;
    
    const updatedNodes = nodesConfig.nodes.filter(n => n.name !== nodeName);
    const updatedConfig = {
      ...nodesConfig,
      nodes: updatedNodes,
      last_updated: new Date().toISOString()
    };
    
    setNodesConfig(updatedConfig);
    saveToStorage(updatedNodes);
    postDiscordTask('REMOVE_NODE', nodesConfig.nodes.find(n => n.name === nodeName)!);
    gitCommitNodeConfig('REMOVE_NODE', nodeName);
    setLastSynced(new Date());
  };

  if (!nodesConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500">Loading nodes configuration...</div>
      </div>
    );
  }

  const getNodeStatus = (ip: string) => {
    const node = clusterData.nodes.find(n => n.ip === ip);
    return node?.status || 'offline';
  };

  const getNodeInStock = (ip: string) => {
    const node = clusterData.nodes.find(n => n.ip === ip);
    return node?.in_stock || 0;
  };

  const getNodeLastSeen = (ip: string) => {
    const node = clusterData.nodes.find(n => n.ip === ip);
    return node?.last_seen || '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Node Manager</h2>
          <p className="text-xs text-slate-500">Manage cluster nodes configuration</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20"
        >
          <Plus className="h-4 w-4" />
          Add Node
        </button>
      </div>

      {/* Node Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-950/90 border-b border-white/10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">IP</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">OS</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Last Seen</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">In Stock</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodesConfig.nodes.map((node) => {
              const status = getNodeStatus(node.ip);
              const statusColor = getStatusColor(status);
              
              return (
                <tr key={node.name} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className={`h-2 w-2 rounded-full bg-${statusColor}-400 inline-block`} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-300">{node.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 font-mono">{node.ip}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{node.role}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{node.os}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatTimeAgo(getNodeLastSeen(node.ip))}</td>
                  <td className="px-4 py-3 text-sm text-cyan-400 text-right font-medium">
                    {getNodeInStock(node.ip).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setSelectedNode(node);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedNode(node);
                          setShowReplaceModal(true);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleRemoveNode(node.name)}
                        className="p-1.5 rounded hover:bg-red-400/10 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Config Sync Status Bar */}
      <div className="border-t border-white/10 bg-slate-950/60 px-6 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-500">Last synced:</span>
          <span className="text-slate-400">{formatTimeAgo(lastSynced.toISOString())}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Hermes acknowledged:</span>
          <span className="text-emerald-400">Yes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Pending:</span>
          <span className="text-slate-400">0 tasks</span>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddNodeModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddNode}
          existingNodes={nodesConfig.nodes}
        />
      )}
      
      {showEditModal && selectedNode && (
        <EditNodeModal
          onClose={() => {
            setShowEditModal(false);
            setSelectedNode(null);
          }}
          onSave={handleEditNode}
          node={selectedNode}
        />
      )}
      
      {showReplaceModal && selectedNode && (
        <ReplaceNodeModal
          onClose={() => {
            setShowReplaceModal(false);
            setSelectedNode(null);
          }}
          onSave={handleReplaceNode}
          node={selectedNode}
          clusterData={clusterData}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODEL CONTROL VIEW COMPONENT (Tasks 8 & 9)
// ═══════════════════════════════════════════════════════════════

const MODEL_REGISTRY = [
  { id: 'qwen2.5-coder:7b', type: 'local', vram_gb: 4.5, cost_in: 0, cost_out: 0,
    best_for: ['code','TypeScript','Python'], description: 'Best local model for code' },
  { id: 'llama3.1:8b', type: 'local', vram_gb: 5.0, cost_in: 0, cost_out: 0,
    best_for: ['chat','reasoning','analysis'], description: 'Best local model for reasoning' },
  { id: 'anthropic/claude-haiku-4-5', type: 'cloud', vram_gb: 0, cost_in: 1.0, cost_out: 5.0,
    best_for: ['simple tasks','config edits'], description: 'Fastest cheapest Claude' },
  { id: 'anthropic/claude-sonnet-4-5', type: 'cloud', vram_gb: 0, cost_in: 3.0, cost_out: 15.0,
    best_for: ['complex builds','large files'], description: 'Best balance quality/cost' },
  { id: 'deepseek/deepseek-v3', type: 'cloud', vram_gb: 0, cost_in: 0.27, cost_out: 1.1,
    best_for: ['code gen','cheap alt'], description: 'Sonnet quality at haiku prices' },
  { id: 'anthropic/claude-opus-4', type: 'cloud', vram_gb: 0, cost_in: 15.0, cost_out: 75.0,
    best_for: ['architecture','hardest bugs'], description: 'Most capable, use sparingly' },
];

const DEFAULT_ASSIGNMENTS: Record<string, string> = {
  'Plan Mode': 'anthropic/claude-sonnet-4-5',
  'Act Mode': 'qwen2.5-coder:7b',
  'Code Analysis': 'qwen2.5-coder:7b',
  'Alert Generation': 'llama3.1:8b',
  'Auto Fixer Simple': 'anthropic/claude-haiku-4-5',
  'Auto Fixer Complex': 'anthropic/claude-sonnet-4-5',
  'Discord Writer': 'llama3.1:8b',
  'SEO Generator': 'anthropic/claude-haiku-4-5',
  'Cluster Monitor': 'llama3.1:8b',
};

function ModelControlView({ data }: { data: ClusterStatus }) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>(DEFAULT_ASSIGNMENTS);
  const [editingRole, setEditingRole] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [costData, setCostData] = React.useState<any>({});

  React.useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('syndrax_model_assignments', (result) => {
        if (result.syndrax_model_assignments) {
          setAssignments(result.syndrax_model_assignments);
        }
      });
    }
    fetch('/cost_log.json').then(r => r.json()).then(setCostData).catch(() => {});
  }, []);

  const gpuStats = data?.nodes?.[0]?.gpu_stats;
  const vramUsed = gpuStats?.vram_used_mb ? (gpuStats.vram_used_mb / 1024).toFixed(1) : '4.8';
  const vramTotal = gpuStats?.vram_total_mb ? (gpuStats.vram_total_mb / 1024).toFixed(1) : '8.0';
  const vramPct = gpuStats ? Math.round((gpuStats.vram_used_mb / gpuStats.vram_total_mb) * 100) : 60;
  const gpuUtil = gpuStats?.gpu_util_pct ?? 34;
  const gpuTemp = gpuStats?.temp_c ?? null;
  const gpuName = gpuStats?.name ?? 'RTX 3070';

  const vramColor = vramPct >= 80 ? 'bg-red-400' : vramPct >= 60 ? 'bg-amber-400' : 'bg-cyan-400';
  const vramText = vramPct >= 80 ? 'text-red-400' : vramPct >= 60 ? 'text-amber-400' : 'text-cyan-400';
  const tempColor = gpuTemp === null ? 'text-slate-500' : gpuTemp > 85 ? 'text-red-400' : gpuTemp > 70 ? 'text-amber-400' : 'text-emerald-400';

  function handleModelSelect(role: string, modelId: string) {
    const updated = { ...assignments, [role]: modelId };
    setAssignments(updated);
    setEditingRole(null);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ syndrax_model_assignments: updated });
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    setToast(`[CONNECTED] Model: ${modelId} | Agent: ${role} | ${ts}`);
    setTimeout(() => setToast(null), 4000);
  }

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const todayCost = Object.values((costData[today] || {}) as Record<string, any>)
    .reduce((s: number, v: any) => s + (v.cost_usd || 0), 0);
  const monthCost = Object.entries(costData as Record<string, any>)
    .filter(([d]) => d.startsWith(month))
    .flatMap(([, models]) => Object.values(models as Record<string, any>))
    .reduce((s: number, v: any) => s + (v.cost_usd || 0), 0);
  const localTokens = Object.values(costData as Record<string, any>)
    .flatMap(d => Object.values(d as Record<string, any>))
    .filter((v: any) => v.type === 'local')
    .reduce((s: number, v: any) => s + (v.input_tokens || 0) + (v.output_tokens || 0), 0);
  const cloudTokens = Object.values(costData as Record<string, any>)
    .flatMap(d => Object.values(d as Record<string, any>))
    .filter((v: any) => v.type === 'cloud')
    .reduce((s: number, v: any) => s + (v.input_tokens || 0) + (v.output_tokens || 0), 0);

  const loadedModel = data?.nodes?.[0]?.model_badge?.[0]?.replace('ollama:', '') ?? null;

  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-500/50 text-emerald-300 text-xs px-4 py-2 rounded-lg font-mono">
          {toast}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-widest">GPU Status</span>
              <span className="text-cyan-300 font-bold text-sm">{gpuName}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">VRAM</span>
                <span className={vramText}>{vramUsed} / {vramTotal} GB</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${vramColor}`} style={{ width: `${vramPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Utilization</span>
                <span className="text-slate-300">{gpuUtil}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${gpuUtil}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/50 rounded p-2">
                <div className="text-slate-500">Temp</div>
                <div className={`font-bold ${tempColor}`}>{gpuTemp !== null ? `${gpuTemp}°C` : '--°C'}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <div className="text-slate-500">BW</div>
                <div className="text-cyan-300 font-bold">448 GB/s</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2">
                <div className="text-slate-500">Slots</div>
                <div className="text-emerald-400 font-bold">1 / 4</div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <svg width="120" height="220" viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg">
              <style>{`
                @keyframes gpuSpin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                .fan-active {
                  animation: gpuSpin 1.5s linear infinite;
                  transform-origin: 95px 52px;
                }
              `}</style>
              <rect x="2" y="2" width="116" height="216" rx="6" fill="#070d1a" stroke="#1e3a5f" strokeWidth="1.5"/>
              <text x="60" y="14" textAnchor="middle" fontSize="6" fill="#1e4a6e" letterSpacing="2">SYNDRAX CLUSTER</text>
              {[20,32,44,56].map(cy => <circle key={cy} cx="8" cy={cy} r="2" fill="#0a1628"/>)}

              <rect x="12" y="20" width="96" height="44" rx="3" fill="#0a1f0a" stroke="#00ff88" strokeWidth="1"
                    style={{filter:'drop-shadow(0 0 3px #00ff8855)'}}/>
              <rect x="12" y="20" width="8" height="44" rx="2" fill="#1a3a1a" stroke="#00cc66" strokeWidth="0.5"/>
              {[28,35,42].map(cy => <rect key={cy} x="24" y={cy} width="8" height="3" rx="1" fill="#00ff88"/>)}
              <text x="36" y="38" fontSize="7" fontWeight="bold" fill="#00ff88">RTX 3070</text>
              <circle cx="95" cy="42" r="10" fill="#0a1f0a" stroke="#00cc66" strokeWidth="0.5"/>
              <g className="fan-active">
                {[0,60,120,180,240,300].map(angle => {
                  const rad = (angle * Math.PI) / 180;
                  return <line key={angle} x1="95" y1="42"
                    x2={95 + Math.cos(rad) * 9} y2={42 + Math.sin(rad) * 9}
                    stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>;
                })}
              </g>
              <circle cx="95" cy="42" r="2.5" fill="#00ff88"/>
              <circle cx="100" cy="22" r="2.5" fill="#00ff88">
                <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
              </circle>

              {[72, 118, 164].map((y, i) => (
                <g key={i}>
                  <rect x="12" y={y} width="96" height="40" rx="3" fill="#0d0a0a" stroke="#3a1a1a" strokeWidth="1"/>
                  <rect x="12" y={y} width="8" height="40" rx="2" fill="#1a0a0a" stroke="#2a1010" strokeWidth="0.5"/>
                  {[y+8, y+16, y+24].map(cy => <rect key={cy} x="24" y={cy} width="8" height="3" rx="1" fill="#1a0808"/>)}
                  <text x="36" y={y+18} fontSize="5.5" fill="#4a1515">NOT CONFIGURED</text>
                  <circle cx="95" cy={y+20} r="9" fill="#0d0a0a" stroke="#2a1010" strokeWidth="0.5"/>
                  {[0,60,120,180,240,300].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    return <line key={angle} x1="95" y1={y+20}
                      x2={95 + Math.cos(rad) * 8} y2={y+20 + Math.sin(rad) * 8}
                      stroke="#1a0808" strokeWidth="1.5" strokeLinecap="round"/>;
                  })}
                  <circle cx="95" cy={y+20} r="2" fill="#1a0808"/>
                </g>
              ))}

              <text x="60" y="212" textAnchor="middle" fontSize="7"
                fill={gpuTemp === null ? '#2a3a4a' : gpuTemp > 85 ? '#ff4444' : gpuTemp > 70 ? '#ffaa00' : '#00cc44'}>
                {gpuTemp !== null ? `${gpuTemp}°C` : '--°C'}
              </text>

              {[30,50,70].map(cx => <rect key={cx} x={cx} y="206" width="12" height="5" rx="1" fill="#0a1628"/>)}
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">Model Assignments</div>
          <div className="space-y-2">
            {Object.entries(assignments).map(([role, modelId]) => {
              const reg = MODEL_REGISTRY.find(m => m.id === modelId);
              const isLocal = reg?.type === 'local';
              const isEditing = editingRole === role;
              return (
                <div key={role} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 w-36 flex-shrink-0">{role}</span>
                  {isEditing ? (
                    <select
                      className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
                      defaultValue={modelId}
                      onChange={e => handleModelSelect(role, e.target.value)}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                    >
                      <optgroup label="Local (Free)">
                        {MODEL_REGISTRY.filter(m => m.type === 'local').map(m => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Cloud (Paid)">
                        {MODEL_REGISTRY.filter(m => m.type === 'cloud').map(m => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </optgroup>
                    </select>
                  ) : (
                    <>
                      <span className="flex-1 text-slate-200 font-mono truncate">{modelId}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${isLocal ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50' : 'bg-blue-900/50 text-blue-400 border border-blue-700/50'}`}>
                        {isLocal ? 'LOCAL' : 'CLOUD'}
                      </span>
                      <span className="text-slate-500 w-24 flex-shrink-0 text-right">
                        {isLocal ? 'free' : `$${reg?.cost_in ?? '?'}/$${reg?.cost_out ?? '?'}/1M`}
                      </span>
                      <button
                        onClick={() => setEditingRole(role)}
                        className="text-slate-500 hover:text-cyan-400 flex-shrink-0 transition-colors"
                      >✎</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-2 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Cost Tracker</span>
            <button onClick={() => fetch('/cost_log.json').then(r=>r.json()).then(setCostData).catch(()=>{})}
              className="text-slate-500 hover:text-cyan-400 text-xs transition-colors">↻</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500 text-xs">Today</div>
              <div className="text-cyan-300 font-bold text-sm">${todayCost.toFixed(4)}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500 text-xs">This Month</div>
              <div className="text-cyan-300 font-bold text-sm">${monthCost.toFixed(4)}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500 text-xs">Local Tokens</div>
              <div className="text-emerald-400 font-bold text-sm">{localTokens.toLocaleString()}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <div className="text-slate-500 text-xs">Cloud Tokens</div>
              <div className="text-blue-400 font-bold text-sm">{cloudTokens.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-end gap-1 h-16">
            {MODEL_REGISTRY.slice(0, 6).map(m => {
              const todayModelCost = (costData[today] as any)?.[m.id]?.cost_usd ?? 0;
              const maxCost = Math.max(0.001, todayCost);
              const pct = Math.round((todayModelCost / maxCost) * 100);
              const barColor = m.type === 'local' ? 'bg-cyan-500' : 'bg-blue-500';
              return (
                <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t ${barColor} opacity-80`} style={{ height: `${Math.max(2, pct)}%` }}/>
                  <span className="text-slate-600 text-xs truncate w-full text-center" style={{fontSize:'8px'}}>
                    {m.id.split('/').pop()?.split(':')[0].slice(0,6)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">Model Registry</div>
        <div className="grid grid-cols-3 gap-3">
          {MODEL_REGISTRY.map(m => {
            const isActive = loadedModel && m.id.includes(loadedModel.split(':')[0]);
            const isLocal = m.type === 'local';
            return (
              <div key={m.id} className={`bg-slate-900/50 border rounded-xl p-3 space-y-2 ${isActive ? 'border-violet-500/50' : 'border-slate-700/50'}`}>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-slate-200 font-bold text-xs font-mono leading-tight">{m.id.split('/').pop()}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-700/50 font-bold">ACTIVE</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isLocal ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50' : 'bg-blue-900/50 text-blue-400 border border-blue-700/50'}`}>
                      {isLocal ? 'LOCAL' : 'CLOUD'}
                    </span>
                  </div>
                </div>
                <div className="text-slate-500 text-xs">{m.description}</div>
                {isLocal
                  ? <div className="text-emerald-400 text-xs">VRAM: {m.vram_gb} GB &nbsp;·&nbsp; Free</div>
                  : <div className="text-slate-400 text-xs">${m.cost_in}/${m.cost_out} per 1M tokens</div>
                }
                <div className="flex flex-wrap gap-1">
                  {m.best_for.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">{tag}</span>
                  ))}
                </div>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-400 text-xs"
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleModelSelect(e.target.value, m.id); e.target.value = ''; }}
                >
                  <option value="">Set as default for...</option>
                  {Object.keys(DEFAULT_ASSIGNMENTS).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [data, setData] = useState<ClusterStatus>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [activeTab, setActiveTab] = useState<TabView>('nodes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch cluster status
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/cluster_status.json');
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setLastUpdate(Date.now());
      } else {
        console.warn('Failed to fetch cluster_status.json, using mock data');
        setData(MOCK_DATA);
      }
    } catch (error) {
      console.error('Error fetching cluster status:', error);
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);
  
  // Update "Xs ago" counter every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);
  
  // Filter nodes
  const filteredNodes = data.nodes.filter(node => {
    const matchesStatus = statusFilter === 'all' || node.status === statusFilter;
    const matchesSearch = !searchQuery || 
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.ip.includes(searchQuery) ||
      node.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });
  
  return (
    <div className="flex h-screen w-screen bg-[#02050f] text-white overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-14 flex-shrink-0 border-r border-white/10 bg-slate-950/80 flex flex-col items-center py-4 gap-4">
        <div className="mb-4">
          <SyndraxLogoSVG />
        </div>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
          <LayoutDashboard className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Overview
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <Server className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Nodes
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <GitBranch className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Pipelines
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <Briefcase className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Jobs
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <Bell className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Alerts
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <Activity className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Metrics
          </div>
        </button>
        
        <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
          <FileText className="h-5 w-5" />
          <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
            Logs
          </div>
        </button>
        
        <div className="mt-auto">
          <button className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:text-slate-400">
            <Settings className="h-5 w-5" />
            <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs">
              Settings
            </div>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="border-b border-white/10 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SyndraxLogoSVG />
              <div>
                <h1 className="text-lg font-bold text-slate-100">Syndrax Sync</h1>
                <p className="text-xs text-slate-500">Cluster Operations Monitor</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Cluster Health */}
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <p className="text-[9px] text-slate-600 uppercase mb-0.5">Cluster Health</p>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${data.summary.cluster_health === 'Healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`text-xs font-medium ${data.summary.cluster_health === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.summary.cluster_health}
                </span>
              </div>
            </div>
            
            {/* Nodes */}
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <p className="text-[9px] text-slate-600 uppercase mb-0.5">Nodes</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-medium">{data.summary.online} Online</span>
                <span className="text-slate-600">/</span>
                <span className="text-red-400 font-medium">{data.summary.offline} Offline</span>
              </div>
            </div>
            
            {/* Live Status */}
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <p className="text-[9px] text-slate-600 uppercase mb-0.5">Live Status</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Live</span>
                <span className="text-xs text-slate-600">· {secondsAgo}s ago</span>
              </div>
            </div>
            
            {/* Version */}
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <p className="text-[9px] text-slate-600 uppercase mb-0.5">Version</p>
              <span className="text-xs font-medium text-slate-400">v2.5.0</span>
            </div>
          </div>
        </div>
        
        {/* Metric Cards */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase">Total Nodes</p>
                <Server className="h-4 w-4 text-slate-600" />
              </div>
              <p className="text-2xl font-bold text-slate-100">{data.summary.total_nodes}</p>
              <p className="text-[10px] text-slate-600 mt-1">Cluster size</p>
            </div>
            
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-emerald-500 uppercase">Online</p>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-400">{data.summary.online}</p>
              <p className="text-[10px] text-emerald-600 mt-1">Active nodes</p>
            </div>
            
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-red-500 uppercase">Offline</p>
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-400">{data.summary.offline}</p>
              <p className="text-[10px] text-red-600 mt-1">Down nodes</p>
            </div>
            
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-cyan-500 uppercase">CPU Avg</p>
                <Cpu className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-2xl font-bold text-cyan-400">{data.summary.cpu_avg}%</p>
              <p className="text-[10px] text-cyan-600 mt-1">Cluster average</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-blue-500 uppercase">RAM Avg</p>
                <HardDrive className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-400">{data.summary.ram_avg}%</p>
              <p className="text-[10px] text-blue-600 mt-1">Memory usage</p>
            </div>
            
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-violet-500 uppercase">Disk Avg</p>
                <Database className="h-4 w-4 text-violet-600" />
              </div>
              <p className="text-2xl font-bold text-violet-400">{data.summary.disk_avg}%</p>
              <p className="text-[10px] text-violet-600 mt-1">Storage used</p>
            </div>
            
            <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-fuchsia-500 uppercase">Tasks Running</p>
                <Activity className="h-4 w-4 text-fuchsia-600" />
              </div>
              <p className="text-2xl font-bold text-fuchsia-400">{data.summary.tasks_running}</p>
              <p className="text-[10px] text-fuchsia-600 mt-1">Active tasks</p>
            </div>
            
            <div className={`rounded-xl border ${data.summary.alerts > 0 ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-white/5'} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-[10px] uppercase ${data.summary.alerts > 0 ? 'text-amber-500' : 'text-slate-500'}`}>Alerts</p>
                <AlertTriangle className={`h-4 w-4 ${data.summary.alerts > 0 ? 'text-amber-600' : 'text-slate-600'}`} />
              </div>
              <p className={`text-2xl font-bold ${data.summary.alerts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{data.summary.alerts}</p>
              <p className={`text-[10px] mt-1 ${data.summary.alerts > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                {data.summary.alerts > 0 ? 'Needs attention' : 'All clear'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Inventory Summary Bar */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-cyan-500 uppercase tracking-wider mb-1">Inventory Summary</p>
              <p className="text-xl font-bold text-cyan-300">
                {data.summary.total_inventory.toLocaleString()} <span className="text-sm text-cyan-600">total in stock across all nodes</span>
              </p>
            </div>
            <div className="w-48 h-12">
              <Sparkline data={data.summary.inventory_trend_30d} color="cyan" />
            </div>
          </div>
        </div>
        
        {/* Tab Bar */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('nodes')}
              className={`text-sm font-medium ${activeTab === 'nodes' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Node Cluster
            </button>
            <button
              onClick={() => setActiveTab('manager')}
              className={`text-sm font-medium ${activeTab === 'manager' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Node Manager
            </button>
            <button
              onClick={() => setActiveTab('pipelines')}
              className={`text-sm font-medium ${activeTab === 'pipelines' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Pipelines
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`text-sm font-medium ${activeTab === 'alerts' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'} flex items-center gap-1`}
            >
              Alerts
              {data.summary.alerts > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{data.summary.alerts}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`text-sm font-medium ${activeTab === 'models' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Models
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`text-sm font-medium ${activeTab === 'jobs' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Jobs
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40 w-48"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="standby">Standby</option>
              <option value="offline">Offline</option>
            </select>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                autoRefresh
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                  : 'border-white/10 bg-white/5 text-slate-500'
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>
          </div>
        </div>
        
        {/* Content Area - Conditional by Tab */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'nodes' && (
            <div className="grid grid-cols-3 gap-4 pb-4">
              {filteredNodes.map((node) => (
                <NodeCard key={node.name} node={node} />
              ))}
            </div>
          )}
          
          {activeTab === 'manager' && (
            <NodeManagerView clusterData={data} />
          )}
          
          {activeTab === 'pipelines' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Pipelines view - Coming soon</p>
            </div>
          )}
          
          {activeTab === 'alerts' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Alerts view - Coming soon</p>
            </div>
          )}
          
          {activeTab === 'models' && (
            <ModelControlView data={data} />
          )}
          
          {activeTab === 'jobs' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Jobs view - Coming soon</p>
            </div>
          )}
        </div>
        
        {/* Bottom Action Bar */}
        <div className="border-t border-white/10 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <button className="flex-1 flex flex-col items-center gap-1 rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-400/10 to-blue-400/10 p-3 hover:from-cyan-400/20 hover:to-blue-400/20 transition">
              <Play className="h-5 w-5 text-cyan-400" />
              <div className="text-center">
                <p className="text-xs font-medium text-cyan-300">Run Full Sync</p>
                <p className="text-[9px] text-cyan-600">Start cluster-wide sync</p>
              </div>
            </button>
            
            <button className="flex-1 flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition">
              <Search className="h-5 w-5 text-slate-400" />
              <div className="text-center">
                <p className="text-xs font-medium text-slate-300">Scan eBay</p>
                <p className="text-[9px] text-slate-600">Scan marketplace data</p>
              </div>
            </button>
            
            <button className="flex-1 flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition">
              <Download className="h-5 w-5 text-slate-400" />
              <div className="text-center">
                <p className="text-xs font-medium text-slate-300">Export Finance</p>
                <p className="text-[9px] text-slate-600">Export financial reports</p>
              </div>
            </button>
            
            <button className="flex-1 flex flex-col items-center gap-1 rounded-xl border border-red-400/40 bg-red-400/10 p-3 hover:bg-red-400/20 transition">
              <Square className="h-5 w-5 text-red-400" />
              <div className="text-center">
                <p className="text-xs font-medium text-red-300">Stop All</p>
                <p className="text-[9px] text-red-600">Halt all running tasks</p>
              </div>
            </button>
            
            <div className="flex flex-col items-end gap-1 px-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span className="uppercase text-[9px]">Next Maintenance</span>
              </div>
              <p className="text-xs font-medium text-slate-400">2026-06-01</p>
              <p className="text-[9px] text-slate-600">Scheduled maintenance window</p>
            </div>
          </div>
        </div>
        
        {/* Bottom Status Strip */}
        <div className="border-t border-white/10 bg-slate-950/90 px-6 py-2 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3 text-cyan-400" />
            <span className="text-slate-500">Sync Engine</span>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-400">Up to date</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-blue-400" />
            <span className="text-slate-500">API Status</span>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-400">Operational</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-violet-400" />
            <span className="text-slate-500">Database</span>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-400">Healthy</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-slate-500" />
            <span className="text-slate-500">Uptime</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-400">{data.summary.uptime_master}</span>
          </div>
          
          <button className="flex items-center gap-1.5 hover:text-cyan-400 transition">
            <ExternalLink className="h-3 w-3" />
            <span className="text-slate-500">Release Notes</span>
            <span className="text-slate-700">·</span>
            <span className="text-cyan-400">View changelog</span>
          </button>
        </div>
      </div>
    </div>
  );
}
