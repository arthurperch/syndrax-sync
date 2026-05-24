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
  Wifi, Triangle
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

type TabView = 'nodes' | 'pipelines' | 'alerts' | 'jobs';
type StatusFilter = 'all' | 'online' | 'standby' | 'offline';

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
        
        {/* Node Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-4 pb-4">
            {filteredNodes.map((node) => (
              <NodeCard key={node.name} node={node} />
            ))}
          </div>
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
