import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CalendarClock,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Grid2X2,
  HardDrive,
  Layers3,
  ListFilter,
  MonitorCog,
  MoreVertical,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Square,
  StopCircle,
  TerminalSquare,
  Wifi,
  Zap,
} from "lucide-react";

type NodeStatus = "active" | "standby" | "offline";
type LoadLevel = "Low" | "Medium" | "High" | "Very High" | "Offline";

type NodeData = {
  name: string;
  ip: string;
  os: string;
  role: string;
  roleDetail: string;
  status: NodeStatus;
  uptime: string;
  tasks: number;
  load: LoadLevel;
  cpu: number;
  ram: number;
  disk: number;
  agentPhase: string;
  alerts: number;
  inStock: number;
  trend: number[];
};

type MetricCard = {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: "cyan" | "green" | "red" | "blue" | "violet" | "fuchsia";
};

const nodes: NodeData[] = [
  {
    name: "root162",
    ip: "192.168.1.162",
    os: "Windows 11",
    role: "Primary Worker",
    roleDetail: "ACTIVE - has agent running",
    status: "active",
    uptime: "14d 6h 22m",
    tasks: 3,
    load: "Medium",
    cpu: 34,
    ram: 61,
    disk: 42,
    agentPhase: "Phase 1 — Research",
    alerts: 2,
    inStock: 482,
    trend: [18, 20, 19, 24, 23, 27, 31, 29, 34, 36, 40, 44],
  },
  {
    name: "root163",
    ip: "192.168.1.163",
    os: "Windows 11",
    role: "Sync Engine",
    roleDetail: "Standby",
    status: "standby",
    uptime: "21d 3h 11m",
    tasks: 0,
    load: "Low",
    cpu: 17,
    ram: 38,
    disk: 29,
    agentPhase: "No Agent",
    alerts: 0,
    inStock: 214,
    trend: [10, 12, 11, 14, 15, 15, 17, 19, 18, 21, 22, 24],
  },
  {
    name: "root164",
    ip: "192.168.1.164",
    os: "Windows 11",
    role: "CDP / Chrome",
    roleDetail: "Standby",
    status: "standby",
    uptime: "8d 12h 9m",
    tasks: 0,
    load: "Low",
    cpu: 22,
    ram: 46,
    disk: 35,
    agentPhase: "No Agent",
    alerts: 0,
    inStock: 168,
    trend: [8, 8, 9, 11, 10, 12, 13, 14, 15, 17, 16, 18],
  },
  {
    name: "root165",
    ip: "192.168.1.165",
    os: "Windows 11",
    role: "AI / Ollama",
    roleDetail: "Standby",
    status: "standby",
    uptime: "13d 7h 33m",
    tasks: 0,
    load: "High",
    cpu: 84,
    ram: 82,
    disk: 61,
    agentPhase: "No Agent",
    alerts: 0,
    inStock: 336,
    trend: [14, 16, 17, 18, 22, 20, 24, 26, 25, 29, 33, 31],
  },
  {
    name: "root166",
    ip: "192.168.1.166",
    os: "Windows 11",
    role: "VPS / Hermes",
    roleDetail: "Standby",
    status: "standby",
    uptime: "16d 8h 18m",
    tasks: 0,
    load: "Low",
    cpu: 12,
    ram: 31,
    disk: 29,
    agentPhase: "No Agent",
    alerts: 0,
    inStock: 126,
    trend: [7, 9, 9, 10, 11, 10, 12, 13, 14, 14, 15, 16],
  },
  {
    name: "root167",
    ip: "192.168.1.167",
    os: "Windows 11",
    role: "Standby",
    roleDetail: "Offline",
    status: "offline",
    uptime: "Last seen 2h 14m ago",
    tasks: 0,
    load: "Offline",
    cpu: 0,
    ram: 0,
    disk: 0,
    agentPhase: "No Agent",
    alerts: 0,
    inStock: 0,
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

const sidebarItems = [
  { label: "Overview", icon: Grid2X2 },
  { label: "Nodes", icon: Server },
  { label: "Pipelines", icon: Layers3 },
  { label: "Jobs", icon: TerminalSquare },
  { label: "Alerts", icon: AlertTriangle },
  { label: "Metrics", icon: Activity },
  { label: "Logs", icon: FileText },
  { label: "Settings", icon: Settings },
];

const tabs = ["Node Cluster", "Pipelines", "Alerts", "Jobs"];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusLabel(status: NodeStatus) {
  if (status === "active") return "Online / Agent Active";
  if (status === "standby") return "Standby";
  return "Offline";
}

function statusTone(status: NodeStatus) {
  if (status === "active") return "border-cyan-300/60 bg-cyan-400/10 text-cyan-100 shadow-cyan-500/20";
  if (status === "standby") return "border-violet-400/35 bg-violet-400/8 text-violet-100 shadow-violet-500/10";
  return "border-red-400/30 bg-red-500/8 text-red-200 shadow-red-500/10";
}

function metricTone(tone: MetricCard["tone"]) {
  const tones = {
    cyan: "border-cyan-400/25 bg-cyan-400/8 text-cyan-200",
    green: "border-emerald-400/25 bg-emerald-400/8 text-emerald-200",
    red: "border-red-400/25 bg-red-400/8 text-red-200",
    blue: "border-blue-400/25 bg-blue-400/8 text-blue-200",
    violet: "border-violet-400/25 bg-violet-400/8 text-violet-200",
    fuchsia: "border-fuchsia-400/25 bg-fuchsia-400/8 text-fuchsia-200",
  };
  return tones[tone];
}

function LogoMark() {
  return (
    <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-slate-950/80 shadow-2xl shadow-cyan-500/20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.45),transparent_38%),radial-gradient(circle_at_75%_75%,rgba(217,70,239,0.42),transparent_40%)]" />
      <svg viewBox="0 0 120 120" className="relative h-10 w-10 overflow-visible drop-shadow-[0_0_16px_rgba(34,211,238,0.9)]" aria-hidden="true">
        <defs>
          <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="52%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#logoGradient)" strokeWidth="7" strokeLinecap="round">
          <ellipse cx="60" cy="60" rx="49" ry="18" />
          <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(60 60 60)" />
          <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(120 60 60)" />
        </g>
        <circle cx="60" cy="60" r="10" fill="url(#logoGradient)" />
      </svg>
    </div>
  );
}

function RackServerIcon({ status }: { status: NodeStatus }) {
  const ledColor = status === "offline" ? "#64748b" : status === "active" ? "#22c55e" : "#8b5cf6";
  const strokeColor = status === "offline" ? "#64748b" : status === "active" ? "#22d3ee" : "#a78bfa";

  return (
    <svg viewBox="0 0 180 120" className="h-20 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`rack-${status}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e879f9" stopOpacity={status === "offline" ? "0.2" : "0.65"} />
        </linearGradient>
      </defs>
      <rect x="16" y="22" width="148" height="28" rx="7" fill="#07101d" stroke={`url(#rack-${status})`} strokeWidth="2" />
      <rect x="16" y="62" width="148" height="28" rx="7" fill="#07101d" stroke={`url(#rack-${status})`} strokeWidth="2" opacity="0.75" />
      <circle cx="35" cy="36" r="4" fill={ledColor}>
        {status === "active" && <animate attributeName="opacity" values="0.35;1;0.35" dur="1.2s" repeatCount="indefinite" />}
      </circle>
      <circle cx="35" cy="76" r="4" fill={ledColor} opacity="0.75" />
      <rect x="52" y="32" width="62" height="4" rx="2" fill={strokeColor} opacity="0.55" />
      <rect x="52" y="72" width="72" height="4" rx="2" fill={strokeColor} opacity="0.38" />
      <rect x="126" y="31" width="19" height="10" rx="2" fill="#111827" stroke={strokeColor} strokeOpacity="0.5" />
      <rect x="126" y="71" width="19" height="10" rx="2" fill="#111827" stroke={strokeColor} strokeOpacity="0.35" />
      <path d="M26 102H154" stroke={strokeColor} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Sparkline({ points, tone = "cyan" }: { points: number[]; tone?: "cyan" | "green" | "red" | "violet" }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const d = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 120;
      const y = 36 - ((value - min) / range) * 30;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke = tone === "red" ? "#fb7185" : tone === "green" ? "#34d399" : tone === "violet" ? "#a78bfa" : "#22d3ee";

  return (
    <svg viewBox="0 0 120 40" className="h-10 w-32 overflow-visible" aria-hidden="true">
      <path d="M0 36H120" stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${d} L 120 40 L 0 40 Z`} fill={stroke} opacity="0.08" />
    </svg>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const high = value > 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className={high ? "text-red-300" : "text-slate-300"}>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={cn("h-full rounded-full", high ? "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.55)]" : "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.45)]")}
        />
      </div>
    </div>
  );
}

function MetricCard({ card, index }: { card: MetricCard; index: number }) {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: index * 0.035, duration: 0.35 }}
      className={cn("rounded-2xl border p-4 shadow-xl shadow-black/20 backdrop-blur-xl", metricTone(card.tone))}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 opacity-80" />
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      </div>
      <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">{card.value}</p>
      <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
    </motion.div>
  );
}

function NodeCard({ node, index }: { node: NodeData; index: number }) {
  const isActive = node.status === "active";
  const isOffline = node.status === "offline";
  const warning = node.cpu > 80 || node.ram > 80 || node.disk > 80;
  const trendTone = isOffline ? "red" : warning ? "red" : isActive ? "cyan" : "violet";

  return (
    <motion.article
      initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ delay: 0.12 + index * 0.055, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-[22px] border bg-slate-950/82 p-4 shadow-2xl backdrop-blur-xl transition duration-300",
        isActive && "border-cyan-300/60 shadow-cyan-500/20 ring-1 ring-cyan-300/20",
        node.status === "standby" && "border-violet-400/25 shadow-violet-500/8",
        isOffline && "border-red-400/25 opacity-60 shadow-red-500/8"
      )}
    >
      {isActive && <div className="absolute inset-0 animate-pulse bg-cyan-400/[0.025]" />}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", isActive ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.95)] animate-pulse" : node.status === "standby" ? "bg-violet-400" : "bg-slate-500")} />
              <h3 className="truncate text-lg font-semibold tracking-wide text-slate-100">{node.name}</h3>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">{node.ip}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", statusTone(node.status))}>{statusLabel(node.status)}</span>
            <MoreVertical className="h-4 w-4 text-slate-600" />
          </div>
        </div>

        <RackServerIcon status={node.status} />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300">{node.os}</span>
          <span className="rounded-lg border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200">{node.role}</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{node.roleDetail}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/10 py-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Uptime</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{node.uptime}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Tasks</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{node.tasks}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Load</p>
            <p className={cn("mt-1 text-xs font-medium", warning ? "text-red-300" : isOffline ? "text-slate-500" : "text-emerald-300")}>{node.load}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ProgressBar label="CPU" value={node.cpu} />
          <ProgressBar label="RAM" value={node.ram} />
          <ProgressBar label="DISK" value={node.disk} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Agent Status</p>
              <p className={cn("mt-1 text-xs font-medium", isActive ? "text-cyan-200" : "text-slate-500")}>{node.agentPhase}</p>
            </div>
            {isActive ? <Wifi className="h-4 w-4 text-emerald-300" /> : <CircleDot className="h-4 w-4 text-slate-600" />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Alerts</p>
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", node.alerts > 0 ? "text-red-300" : "text-slate-600")} />
              <span className={cn("text-sm font-semibold", node.alerts > 0 ? "text-red-300" : "text-slate-400")}>{node.alerts}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">In Stock</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{node.inStock.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Monthly Trend</p>
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 flex justify-center">
            <Sparkline points={node.trend} tone={trendTone} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("Node Cluster");
  const totalInStock = nodes.reduce((sum, node) => sum + node.inStock, 0);
  const onlineCount = nodes.filter((node) => node.status !== "offline").length;
  const offlineCount = nodes.filter((node) => node.status === "offline").length;
  const activeTasks = nodes.reduce((sum, node) => sum + node.tasks, 0);
  const alerts = nodes.reduce((sum, node) => sum + node.alerts, 0);
  const avg = (key: "cpu" | "ram" | "disk") => Math.round(nodes.reduce((sum, node) => sum + node[key], 0) / nodes.length);

  const metrics: MetricCard[] = [
    { label: "Total Nodes", value: `${nodes.length}`, sub: "All registered nodes", icon: Server, tone: "cyan" },
    { label: "Online", value: `${onlineCount}`, sub: `${Math.round((onlineCount / nodes.length) * 100)}% of cluster`, icon: ShieldCheck, tone: "green" },
    { label: "Offline", value: `${offlineCount}`, sub: `${Math.round((offlineCount / nodes.length) * 100)}% needs check`, icon: AlertTriangle, tone: "red" },
    { label: "CPU Avg", value: `${avg("cpu")}%`, sub: "Across all nodes", icon: Cpu, tone: "blue" },
    { label: "RAM Avg", value: `${avg("ram")}%`, sub: "Memory pressure", icon: Gauge, tone: "violet" },
    { label: "Disk Avg", value: `${avg("disk")}%`, sub: "Storage usage", icon: HardDrive, tone: "fuchsia" },
    { label: "Tasks Running", value: `${activeTasks}`, sub: "Current workloads", icon: Boxes, tone: "violet" },
    { label: "Alerts", value: `${alerts}`, sub: "Requires attention", icon: Bell, tone: "red" },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050f] font-sans text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(217,70,239,0.12),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(37,99,235,0.10),transparent_35%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:38px_38px]" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-[96px] shrink-0 border-r border-white/10 bg-slate-950/82 backdrop-blur-xl lg:block">
          <div className="flex h-24 items-center justify-center border-b border-white/10">
            <LogoMark />
          </div>
          <nav className="space-y-1 p-3">
            {sidebarItems.map((item, index) => {
              const Icon = item.icon;
              const active = index === 0;
              return (
                <button
                  key={item.label}
                  className={cn(
                    "group flex w-full flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-[11px] transition",
                    active ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-200 shadow-lg shadow-cyan-500/10" : "border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur-xl xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <LogoMark />
                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-blue-200 to-fuchsia-200 bg-clip-text text-2xl font-semibold tracking-wide text-transparent">Syndrax Sync</h1>
                  <p className="mt-1 text-sm tracking-[0.16em] text-slate-400">Cluster Operations Monitor</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Cluster Health</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Healthy</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Nodes</p>
                  <p className="mt-1 text-sm"><span className="text-emerald-300">{onlineCount} Online</span> <span className="text-slate-600">/</span> <span className="text-red-300">{offlineCount} Offline</span></p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Live Status</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-cyan-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Live</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Version</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">v2.5.0</p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 xl:px-8">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
              {metrics.map((card, index) => (
                <MetricCard key={card.label} card={card} index={index} />
              ))}
            </section>

            <section className="mt-5 rounded-3xl border border-cyan-300/18 bg-slate-950/72 p-4 shadow-2xl shadow-cyan-500/5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Inventory Summary</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                    {totalInStock.toLocaleString()} <span className="text-base font-normal text-slate-500">total in stock across all nodes</span>
                  </h2>
                </div>
                <Sparkline points={[50, 55, 58, 63, 61, 67, 72, 76, 82, 88, 91, 96]} tone="cyan" />
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm transition",
                        activeTab === tab ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {tab}
                      {tab === "Alerts" && <span className="ml-2 rounded-full bg-red-400 px-1.5 py-0.5 text-[10px] text-slate-950">{alerts}</span>}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-500">
                    <Search className="h-4 w-4" />
                    <span>Search nodes...</span>
                  </div>
                  <button className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-slate-400">
                    <ListFilter className="h-4 w-4" /> All Status
                  </button>
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-3 text-sm text-emerald-300">
                    Auto Refresh <span className="h-5 w-9 rounded-full bg-emerald-400/80 p-0.5"><span className="block h-4 w-4 translate-x-4 rounded-full bg-white" /></span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {nodes.map((node, index) => (
                <NodeCard key={node.name} node={node} index={index} />
              ))}
            </section>

            <section className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1.25fr]">
              <button className="flex items-center gap-3 rounded-2xl border border-cyan-400/35 bg-cyan-400/12 p-4 text-left text-cyan-100 shadow-xl shadow-cyan-500/10 transition hover:bg-cyan-400/18">
                <Play className="h-6 w-6" />
                <span><strong className="block">Run Full Sync</strong><span className="text-xs text-slate-400">Start cluster-wide sync</span></span>
              </button>
              <button className="flex items-center gap-3 rounded-2xl border border-violet-400/35 bg-violet-400/12 p-4 text-left text-violet-100 shadow-xl shadow-violet-500/10 transition hover:bg-violet-400/18">
                <Search className="h-6 w-6" />
                <span><strong className="block">Scan eBay</strong><span className="text-xs text-slate-400">Scan marketplace data</span></span>
              </button>
              <button className="flex items-center gap-3 rounded-2xl border border-fuchsia-400/35 bg-fuchsia-400/12 p-4 text-left text-fuchsia-100 shadow-xl shadow-fuchsia-500/10 transition hover:bg-fuchsia-400/18">
                <Download className="h-6 w-6" />
                <span><strong className="block">Export Finance</strong><span className="text-xs text-slate-400">Export financial reports</span></span>
              </button>
              <button className="flex items-center gap-3 rounded-2xl border border-red-400/35 bg-red-400/12 p-4 text-left text-red-100 shadow-xl shadow-red-500/10 transition hover:bg-red-400/18">
                <StopCircle className="h-6 w-6" />
                <span><strong className="block">Stop All</strong><span className="text-xs text-slate-400">Halt all running tasks</span></span>
              </button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-slate-300">
                <CalendarClock className="h-6 w-6 text-cyan-300" />
                <span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Next Maintenance</span><strong className="block">May 28, 2025 02:00 AM</strong><span className="text-xs text-slate-500">Scheduled maintenance window</span></span>
              </div>
            </section>
          </div>

          <footer className="border-t border-white/10 bg-slate-950/82 px-5 py-3 backdrop-blur-xl xl:px-8">
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 md:grid-cols-5">
              <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-cyan-300" /> Sync Engine <span className="text-emerald-300">Up to date</span></div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-blue-300" /> API Status <span className="text-emerald-300">Operational</span></div>
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-violet-300" /> Database <span className="text-emerald-300">Healthy</span></div>
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" /> Uptime <span className="text-slate-300">14d 6h 22m 45s</span></div>
              <div className="flex items-center gap-2 md:justify-end"><ExternalLink className="h-4 w-4 text-cyan-300" /> Release Notes <span className="text-slate-500">View changelog</span></div>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
