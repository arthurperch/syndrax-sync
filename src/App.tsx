/**
 * Syndrax Sync — New Popup Frontend
 * Dark neon theme. Pipeline-first navigation.
 * Drop this in as src/App.tsx (remove existing App.tsx content)
 * Requires: framer-motion, lucide-react (already in package.json)
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShieldCheck, ScanSearch, UserCheck, Fingerprint,
  FileText, UploadCloud, BarChart3, DollarSign, Settings,
  MoreVertical, Zap, RefreshCw, ExternalLink, ChevronLeft,
  ChevronRight, Play, Pause, Square, Download, Copy,
  CheckCircle, AlertTriangle, XCircle, Loader, Plus,
  ArrowUpDown, Filter, Eye, PenTool, MessageSquare, Users,
} from "lucide-react";
import TitleBuilder from './pages/TitleBuilder';
import DescriptionBuilder from './components/DescriptionBuilder';
import { AccountManager } from './pages/AccountManager';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tone = "cyan" | "blue" | "violet" | "pink";
type View = "menu" | string;

interface SyncStats {
  totalListings: number;
  withAsin: number;
  outOfStock: number;
  lastSync: string;
  syncActive: boolean;
}

interface Order {
  id: string;
  buyerName: string;
  address: string;
  item: string;
  ebayTotal: number;
  status: string;
}

interface InventoryItem {
  listingId: string;
  title: string;
  asin: string;
  ebayPrice: number;
  amazonPrice: number;
  margin: number;
  inStock: boolean;
  imageUrl?: string;
}

interface ActivityItem {
  message: string;
  status: "success" | "error" | "info";
  time: string;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const tone: Record<Tone, {
  num: string; text: string; border: string; bg: string;
  chip: string; glow: string; activeGlow: string; dot: string;
}> = {
  cyan: {
    num: "text-cyan-300", text: "text-cyan-200",
    border: "border-cyan-400/40", bg: "bg-cyan-400/10",
    chip: "border-cyan-400/50 bg-cyan-400/10 text-cyan-100",
    glow: "shadow-cyan-500/20",
    activeGlow: "shadow-[0_0_28px_rgba(34,211,238,0.16)]",
    dot: "bg-cyan-400",
  },
  blue: {
    num: "text-blue-300", text: "text-blue-200",
    border: "border-blue-400/40", bg: "bg-blue-400/10",
    chip: "border-blue-400/50 bg-blue-400/10 text-blue-100",
    glow: "shadow-blue-500/20",
    activeGlow: "shadow-[0_0_28px_rgba(96,165,250,0.16)]",
    dot: "bg-blue-400",
  },
  violet: {
    num: "text-violet-300", text: "text-violet-200",
    border: "border-violet-400/40", bg: "bg-violet-400/10",
    chip: "border-violet-400/50 bg-violet-400/10 text-violet-100",
    glow: "shadow-violet-500/20",
    activeGlow: "shadow-[0_0_28px_rgba(167,139,250,0.16)]",
    dot: "bg-violet-400",
  },
  pink: {
    num: "text-fuchsia-300", text: "text-fuchsia-200",
    border: "border-fuchsia-400/40", bg: "bg-fuchsia-400/10",
    chip: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100",
    glow: "shadow-fuchsia-500/20",
    activeGlow: "shadow-[0_0_28px_rgba(217,70,239,0.16)]",
    dot: "bg-fuchsia-400",
  },
};

// ─── Chrome helpers ───────────────────────────────────────────────────────────

async function msg<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch { return null; }
}

async function store<T>(key: string): Promise<T | null> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage) return null;
    const r = await chrome.storage.local.get(key);
    return r[key] ?? null;
  } catch { return null; }
}

// ─── Pipeline menu data ───────────────────────────────────────────────────────

const pipeline = [
  { id: "01", key: "research",     title: "Research",          phase: "Phase 1",   icon: Search,       t: "cyan"   as Tone, desc: "Amazon product discovery • research queue • discovered products" },
  { id: "02", key: "compliance",   title: "Compliance Check",  phase: "Phase 1B",  icon: ShieldCheck,  t: "cyan"   as Tone, desc: "7 risk filters • VERO brands • banned items • fragile detection" },
  { id: "03", key: "reverse",      title: "Reverse Search",    phase: "Phase 2",   icon: ScanSearch,   t: "violet" as Tone, desc: "eBay reverse image search • existing dropshippers" },
  { id: "04", key: "seller",       title: "Seller Verification", phase: "Phase 3", icon: UserCheck,    t: "pink"   as Tone, desc: "Account age • feedback % • units sold • Amazon match rate" },
  { id: "05", key: "dna",          title: "DNA Match",         phase: "Phase 4",   icon: Fingerprint,  t: "blue"   as Tone, desc: "AI vision matching • brand • model • color • materials" },
  { id: "06", key: "seo",          title: "SEO Generator",     phase: "Phase 5",   icon: FileText,     t: "violet" as Tone, desc: "Keyword analysis • competitor titles • optimized listing copy" },
  { id: "06.5", key: "description", title: "Description Builder", phase: "Phase 5B", icon: PenTool,    t: "violet" as Tone, desc: "HTML description templates • 5 styles • variable substitution" },
  { id: "07", key: "lister",       title: "Bulk Lister",       phase: "Phase 6",   icon: UploadCloud,  t: "pink"   as Tone, desc: "eBay listings in bulk • pricing • markup • margin calculations" },
  { id: "07.5", key: "optimizer",  title: "Listing Optimizer", phase: "Phase 6B",  icon: RefreshCw,    t: "cyan"   as Tone, desc: "90-day lifecycle · End & Sell Similar · price reduction · delete queue" },
  { id: "08.5", key: "messages",   title: "Message Tool",      phase: "Phase 7B",  icon: MessageSquare, t: "blue"  as Tone, desc: "5 buyer templates · OOS · shipping · returns · one-click copy" },
  { id: "08", key: "accounts",     title: "Account Manager",   phase: "Phase 7",   icon: Users,        t: "cyan"   as Tone, desc: "eBay account tiers • warmup mode • daily limits • risk tracking" },
  { id: "08.1", key: "dashboard",  title: "Dashboard",         phase: "Phase 7",   icon: BarChart3,    t: "pink"   as Tone, desc: "Active listings • price changes • stock status • alerts" },
  { id: "09", key: "finance",      title: "Finance",           phase: "Business",  icon: DollarSign,   t: "pink"   as Tone, desc: "Earnings tracking • reconciliation • profit analysis" },
  { id: "10", key: "settings",     title: "Settings",          phase: "Config",    icon: Settings,     t: "violet" as Tone, desc: "Filter toggles • API keys • Discord webhooks" },
];

// ─── Shared sub-components ───────────────────────────────────────────────────

function SyndraxLogo() {
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-slate-950/80 shadow-2xl shadow-cyan-500/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.45),transparent_38%),radial-gradient(circle_at_75%_75%,rgba(217,70,239,0.42),transparent_40%)]" />
      <div className="absolute inset-1 rounded-xl border border-white/10" />
      <svg viewBox="0 0 120 120" className="relative h-11 w-11 overflow-visible drop-shadow-[0_0_16px_rgba(34,211,238,0.9)]" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="48%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
          <filter id="gf" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g fill="none" stroke="url(#lg)" strokeWidth="7" strokeLinecap="round" filter="url(#gf)">
          <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(0 60 60)" />
          <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(60 60 60)" />
          <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(120 60 60)" />
        </g>
        <circle cx="60" cy="60" r="10" fill="url(#lg)" filter="url(#gf)" />
      </svg>
    </div>
  );
}

function CircuitLines() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 opacity-50">
      <div className="absolute right-7 top-6 h-px w-48 bg-cyan-500/30" />
      <div className="absolute right-20 top-6 h-5 w-px bg-cyan-500/30" />
      <div className="absolute right-12 top-14 h-px w-36 bg-blue-500/30" />
      <div className="absolute right-12 top-14 h-8 w-px bg-blue-500/30" />
      <div className="absolute right-52 top-5 h-2 w-2 rounded-full border border-cyan-400/50" />
      <div className="absolute right-40 top-13 h-2 w-2 rounded-full border border-blue-400/50" />
    </div>
  );
}

function LiveDot({ color = "emerald" }: { color?: string }) {
  return <span className={`h-2 w-2 rounded-full bg-${color}-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]`} />;
}

function StatusBadge({ status, label }: { status: "success" | "error" | "info" | "warn"; label: string }) {
  const styles = {
    success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    error:   "border-red-400/40 bg-red-400/10 text-red-300",
    info:    "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    warn:    "border-amber-400/40 bg-amber-400/10 text-amber-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${styles[status]}`}>
      {label}
    </span>
  );
}

function SectionHeader({ title, onBack, badge }: { title: string; onBack: () => void; badge?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h2 className="flex-1 text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
      {badge && <StatusBadge status="info" label={badge} />}
    </div>
  );
}

function ActionBtn({
  onClick, disabled, loading, icon: Icon, label, variant = "default", tone: t = "cyan",
}: {
  onClick?: () => void; disabled?: boolean; loading?: boolean;
  icon?: React.ElementType; label: string;
  variant?: "default" | "danger" | "ghost"; tone?: Tone;
}) {
  const base = "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium tracking-wide transition disabled:opacity-40";
  const variants = {
    default: `border-${t === "cyan" ? "cyan" : t === "pink" ? "fuchsia" : t === "violet" ? "violet" : "blue"}-400/40 bg-${t === "cyan" ? "cyan" : t === "pink" ? "fuchsia" : t === "violet" ? "violet" : "blue"}-400/10 text-${t === "cyan" ? "cyan" : t === "pink" ? "fuchsia" : t === "violet" ? "violet" : "blue"}-200 hover:bg-${t === "cyan" ? "cyan" : t === "pink" ? "fuchsia" : t === "violet" ? "violet" : "blue"}-400/20`,
    danger: "border-red-400/40 bg-red-400/10 text-red-200 hover:bg-red-400/20",
    ghost: "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
  };
  const BtnIcon = loading ? Loader : Icon;
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]}`}>
      {BtnIcon && <BtnIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
      {label}
    </button>
  );
}

// ─── Detail Views ─────────────────────────────────────────────────────────────

function DashboardView({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<SyncStats>({ totalListings: 0, withAsin: 0, outOfStock: 0, lastSync: "–", syncActive: false });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    store<SyncStats>("syndrax_stats").then(s => s && setStats(s));
    store<ActivityItem[]>("syndrax_activity").then(a => a && setActivity(a.slice(-6).reverse()));
  }, []);

  const startSync = async () => {
    setSyncing(true);
    await msg("RUN_FULL_SYNC");
  };

  const stopSync = async () => {
    setSyncing(false);
    await msg("STOP_SYNC");
  };

  const statCards = [
    { label: "Total Listings",  value: stats.totalListings, t: "cyan"   as Tone },
    { label: "With ASIN",       value: stats.withAsin,      t: "blue"   as Tone },
    { label: "Out of Stock",    value: stats.outOfStock,    t: "pink"   as Tone },
  ];

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />;
    if (s === "error")   return <XCircle className="h-3 w-3 text-red-400 shrink-0" />;
    return <Zap className="h-3 w-3 text-cyan-400 shrink-0" />;
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Dashboard" onBack={onBack} badge="Phase 7" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {statCards.map(c => (
            <div key={c.label} className={`rounded-xl border ${tone[c.t].border} ${tone[c.t].bg} p-3 text-center`}>
              <p className={`text-lg font-semibold ${tone[c.t].text}`}>{c.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Sync controls */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-300">Price Sync Engine</p>
            <StatusBadge status={syncing ? "info" : "success"} label={syncing ? "Running..." : "Idle"} />
          </div>
          <p className="text-[10px] text-slate-500 mb-3">Last sync: {stats.lastSync || "Never"}</p>
          <div className="flex gap-2">
            {!syncing ? (
              <ActionBtn onClick={startSync} icon={Play} label="Run Full Sync" tone="cyan" />
            ) : (
              <ActionBtn onClick={stopSync} icon={Square} label="Stop Sync" variant="danger" />
            )}
            <ActionBtn onClick={() => msg("SCAN_INVENTORY")} icon={Search} label="Scan eBay" variant="ghost" />
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2 px-1">Activity Log</p>
          <div className="space-y-1.5">
            {activity.length === 0 && (
              <p className="text-center text-[11px] text-slate-600 py-4">No recent activity</p>
            )}
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                {statusIcon(a.status)}
                <p className="flex-1 text-[11px] text-slate-400 leading-5">{a.message}</p>
                <span className="text-[10px] text-slate-600 shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "asin" | "noasin" | "oos">("all");

  useEffect(() => {
    store<Record<string, InventoryItem>>("syndrax_inventory").then(inv => {
      if (inv) setItems(Object.values(inv));
    });
  }, []);

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    const matchQ = !q || it.title?.toLowerCase().includes(q) || it.asin?.toLowerCase().includes(q);
    const matchF =
      filter === "all" ? true :
      filter === "asin" ? !!it.asin :
      filter === "noasin" ? !it.asin :
      filter === "oos" ? !it.inStock : true;
    return matchQ && matchF;
  });

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "asin", label: "With ASIN" },
    { key: "noasin", label: "No ASIN" }, { key: "oos", label: "OOS" },
  ];

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Inventory Manager" onBack={onBack} badge="Phase 1" />
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        <div className="px-4 pt-3 space-y-3">
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, ASIN, SKU…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
          />
          {/* Filters */}
          <div className="flex gap-1.5">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium tracking-wide transition ${
                  filter === f.key
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Count */}
          <p className="text-[10px] text-slate-600">{filtered.length} items</p>
        </div>
        {/* Table */}
        <div className="px-4 pb-4 space-y-1.5 mt-2">
          {filtered.length === 0 && (
            <p className="text-center text-[11px] text-slate-600 py-8">No items found</p>
          )}
          {filtered.slice(0, 30).map(item => (
            <div key={item.listingId} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 truncate leading-5">{item.title || "Untitled"}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{item.asin || <span className="text-amber-500">No ASIN</span>}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-fuchsia-300">${item.ebayPrice?.toFixed(2) || "–"}</p>
                <StatusBadge status={item.inStock ? "success" : "error"} label={item.inStock ? "In Stock" : "OOS"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersView({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    store<Order[]>("syndrax_orders").then(o => o && setOrders(o));
  }, []);

  const fulfill = async (orderId: string, via: "amazon" | "aliexpress") => {
    await msg("FULFILL_ORDER", { orderId, via });
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Order Fulfillment" onBack={onBack} badge="Phase 6" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-10 w-10 text-emerald-400/40" />
            <p className="text-[11px] text-slate-600">No pending orders</p>
          </div>
        )}
        {orders.map(order => (
          <div key={order.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-slate-200">{order.buyerName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{order.address}</p>
              </div>
              <p className="text-sm font-semibold text-fuchsia-300 shrink-0">${order.ebayTotal?.toFixed(2)}</p>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">{order.item}</p>
            <div className="flex gap-2 pt-1">
              <ActionBtn onClick={() => fulfill(order.id, "amazon")} icon={UploadCloud} label="Via Amazon" tone="cyan" />
              <ActionBtn onClick={() => fulfill(order.id, "aliexpress")} icon={UploadCloud} label="AliExpress" variant="ghost" />
              <button
                onClick={() => navigator.clipboard.writeText(order.address)}
                className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-300"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SEOView({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title?: string; description?: string; keywords?: string[] } | null>(null);

  const generate = async () => {
    setLoading(true);
    const r = await msg<{ title: string; description: string; keywords: string[] }>("GENERATE_SEO", { url });
    setLoading(false);
    if (r) setResult(r);
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="SEO Generator" onBack={onBack} badge="Phase 5" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">Amazon product URL or ASIN</p>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://amazon.com/dp/B0… or ASIN"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40"
          />
          <ActionBtn onClick={generate} loading={loading} disabled={!url} icon={Zap} label="Generate with Claude AI" tone="violet" />
        </div>

        {result && (
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-violet-400">eBay Title</p>
                <button onClick={() => navigator.clipboard.writeText(result.title || "")} className="text-[10px] text-slate-600 hover:text-slate-300 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="text-xs text-slate-200 leading-5">{result.title}</p>
            </div>
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-violet-400">Description</p>
                <button onClick={() => navigator.clipboard.writeText(result.description || "")} className="text-[10px] text-slate-600 hover:text-slate-300 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-5 line-clamp-4">{result.description}</p>
            </div>
            {result.keywords && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-violet-400 mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.slice(0, 12).map(k => (
                    <span key={k} className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 text-[10px] text-violet-300">{k}</span>
                  ))}
                </div>
              </div>
            )}
            <ActionBtn icon={ExternalLink} label="Create eBay Listing" tone="violet" onClick={() => msg("OPEN_EBAY_SELL", { title: result.title, description: result.description })} />
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitorView({ onBack }: { onBack: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<{ title: string; price: number; profit: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const scan = async () => {
    setLoading(true);
    await msg("SCAN_COMPETITORS", { keyword });
    const r = await store<typeof results>("syndrax_competitors");
    setLoading(false);
    if (r) setResults(r.slice(0, 20));
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Competitor Research" onBack={onBack} badge="Phase 2" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && keyword && scan()}
            placeholder="Search eBay sold listings…"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40"
          />
          <ActionBtn onClick={scan} loading={loading} disabled={!keyword} icon={Search} label="Scan" tone="violet" />
        </div>
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 truncate">{r.title}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Sold for ${r.price?.toFixed(2)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${r.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.profit > 0 ? "+" : ""}{r.profit?.toFixed(0)}%
                </p>
                <p className="text-[10px] text-slate-600">Est. margin</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinanceView({ onBack }: { onBack: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [period, setPeriod] = useState<"year" | "last_year">("year");

  const startScan = async () => {
    setScanning(true);
    await msg("START_FINANCE_SCAN", { period });
  };

  const stopScan = async () => {
    setScanning(false);
    await msg("STOP_FINANCE_SCAN");
  };

  const exportData = async () => {
    await msg("EXPORT_FINANCE_CSV");
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Finance Reconciliation" onBack={onBack} badge="Business" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
          <p className="text-xs font-medium text-slate-300">Scan Period</p>
          <div className="flex gap-2">
            {[{ key: "year", label: "Current Year" }, { key: "last_year", label: "Last Year" }].map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key as typeof period)}
                className={`flex-1 rounded-xl border py-2 text-xs font-medium transition ${
                  period === p.key
                    ? "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200"
                    : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {!scanning ? (
              <ActionBtn onClick={startScan} icon={Play} label="Start Scan" tone="pink" />
            ) : (
              <ActionBtn onClick={stopScan} icon={Square} label="Stop" variant="danger" />
            )}
            <ActionBtn onClick={exportData} icon={Download} label="Export CSV" variant="ghost" />
          </div>
        </div>

        {/* Summary placeholders */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "eBay Earnings", value: "–", t: "cyan" as Tone },
            { label: "Amazon Costs", value: "–", t: "blue" as Tone },
            { label: "Net Profit", value: "–", t: "pink" as Tone },
            { label: "Orders Matched", value: "–", t: "violet" as Tone },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border ${tone[c.t].border} ${tone[c.t].bg} p-3`}>
              <p className={`text-sm font-semibold ${tone[c.t].text}`}>{c.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ onBack }: { onBack: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [markup, setMarkup] = useState(100);
  const [threshold, setThreshold] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    store<string>("syndrax_api_key").then(k => k && setApiKey(k));
    store<{ markupPercent: number; changeThreshold: number }>("syndrax_settings").then(s => {
      if (s) { setMarkup(s.markupPercent || 100); setThreshold(s.changeThreshold || 5); }
    });
  }, []);

  const save = async () => {
    await msg("SET_STORAGE", { key: "syndrax_api_key", value: apiKey });
    await msg("SET_STORAGE", { key: "syndrax_settings", value: { markupPercent: markup, changeThreshold: threshold } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKey = async () => {
    await msg("VALIDATE_API_KEY", { apiKey });
  };

  return (
    <div className="flex h-full flex-col">
      <SectionHeader title="Settings" onBack={onBack} badge="Config" />
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">
        {/* API Key */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Anthropic API Key</p>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40"
          />
          <div className="flex gap-2">
            <ActionBtn onClick={testKey} icon={CheckCircle} label="Test Key" tone="violet" />
          </div>
        </div>

        {/* Markup */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Price Markup</p>
            <p className="text-xs font-semibold text-cyan-300">{markup}%</p>
          </div>
          <input
            type="range" min={10} max={200} step={5} value={markup}
            onChange={e => setMarkup(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>10%</span><span>200%</span>
          </div>
        </div>

        {/* Change threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Change Threshold</p>
            <p className="text-xs font-semibold text-blue-300">{threshold}%</p>
          </div>
          <input
            type="range" min={1} max={20} step={1} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-blue-400"
          />
        </div>

        {/* Save */}
        <ActionBtn
          onClick={save}
          icon={saved ? CheckCircle : Settings}
          label={saved ? "Saved!" : "Save Settings"}
          tone={saved ? "cyan" : "violet"}
        />

        {/* Danger zone */}
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 space-y-2">
          <p className="text-[10px] text-red-400 font-medium">Danger Zone</p>
          <ActionBtn
            onClick={() => msg("CLEAR_ALL_DATA")}
            icon={XCircle}
            label="Clear All Data"
            variant="danger"
          />
        </div>
      </div>
    </div>
  );
}

function PlaceholderView({ title, phase, icon: Icon, t, onBack }: {
  title: string; phase: string; icon: React.ElementType; t: Tone; onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <SectionHeader title={title} onBack={onBack} badge={phase} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className={`grid h-16 w-16 place-items-center rounded-2xl border ${tone[t].border} ${tone[t].bg} shadow-lg ${tone[t].glow}`}>
          <Icon className={`h-8 w-8 ${tone[t].text}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-[11px] text-slate-500 mt-1">Coming in {phase}</p>
        </div>
        <StatusBadge status="warn" label="In Development" />
      </div>
    </div>
  );
}

// ─── Pipeline Menu ────────────────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.988, filter: "blur(6px)" },
  show: (i: number) => ({
    opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
    transition: { delay: i * 0.035, duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  }),
};

function PipelineRow({ item, index, onClick }: {
  item: typeof pipeline[0]; index: number; onClick: () => void;
}) {
  const tc = tone[item.t];
  return (
    <motion.button
      custom={index} variants={rowVariants} initial="hidden" animate="show"
      whileHover={{ y: -1, scale: 1.006 }} whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3 text-left transition-all duration-200 hover:border-white/[0.15] hover:bg-white/[0.06]`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center gap-3">
        <div className={`w-7 shrink-0 text-center text-[11px] font-semibold tracking-widest ${tc.num}`}>{item.id}</div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${tc.border} ${tc.bg} shadow-lg ${tc.glow}`}>
          <item.icon className={`h-5 w-5 ${tc.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[13px] font-semibold tracking-wide text-slate-100">{item.title}</h2>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.desc}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-lg border px-1.5 py-0.5 text-[9px] font-medium tracking-wide ${tc.chip}`}>{item.phase}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600 opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Sniper Card ──────────────────────────────────────────────────────────────

function SniperCard() {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("sniper_enabled", (r) => {
        setEnabled(r.sniper_enabled !== false);
      });
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ sniper_enabled: next });
    }
  }, [enabled]);

  return (
    <motion.div
      custom={11} variants={rowVariants} initial="hidden" animate="show"
      className="relative w-full overflow-hidden rounded-[16px] border border-cyan-400/20 bg-cyan-400/[0.04] p-3"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 shadow-lg shadow-cyan-500/20">
          <span className="text-lg">⚡</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold tracking-wide text-slate-100">Sniper</h2>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${enabled ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-slate-600"}`} />
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Amazon → eBay fast-list overlay</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-cyan-500" : "bg-slate-700"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("menu");

  const viewMap: Record<string, React.FC<{ onBack: () => void }>> = {
    dashboard:    DashboardView,
    inventory:    InventoryView,
    seo:          SEOView,
    finance:      FinanceView,
    reverse:      CompetitorView,
    titlebuilder: TitleBuilder,
    description:  ({ onBack }) => <DescriptionBuilder mode="popup" onBack={onBack} />,
    accounts:     ({ onBack }) => <AccountManager onBack={onBack} />,
  };

  const renderDetail = () => {
    const Comp = viewMap[view];
    if (Comp) return <Comp onBack={() => setView("menu")} />;
    const item = pipeline.find(p => p.key === view);
    if (!item) return null;
    return (
      <PlaceholderView
        title={item.title} phase={item.phase}
        icon={item.icon} t={item.t}
        onBack={() => setView("menu")}
      />
    );
  };

  return (
    <main className="relative w-[420px] h-[680px] overflow-hidden bg-[#02050f] font-sans text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.15),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.13),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(37,99,235,0.13),transparent_35%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.016)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:38px_38px]" />

      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.978 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full w-full overflow-hidden rounded-[26px] border border-cyan-300/[0.18] bg-slate-950/92 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_80px_rgba(0,0,0,0.75),0_0_45px_rgba(34,211,238,0.09)] backdrop-blur-xl"
      >

        {/* Top shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
        {/* Glow blobs */}
        <div className="absolute -left-16 top-8 h-36 w-36 rounded-full bg-cyan-500/[0.08] blur-3xl pointer-events-none" />
        <div className="absolute -right-16 top-20 h-40 w-40 rounded-full bg-fuchsia-500/[0.08] blur-3xl pointer-events-none" />
        <CircuitLines />

        {/* Header */}
        <header className="relative border-b border-white/[0.08] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <SyndraxLogo />


              <div className="min-w-0">
                <h1 className="truncate bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-[28px] font-light tracking-[0.07em] text-transparent">
                  Syndrax Sync
                </h1>
                <p className="mt-0.5 text-[11px] tracking-[0.1em] text-slate-400">Research to listing workflow</p>
              </div>
            </div>
<div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                ⬡ Full View
              </button>
              <button className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-200">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
              Live
            </div>
            {view !== "menu" && (
              <button
                onClick={() => setView("menu")}
                className="text-[10px] text-slate-500 hover:text-cyan-300 transition flex items-center gap-1"
              >
                <ChevronLeft className="h-3 w-3" /> Pipeline
              </button>
            )}
            <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-slate-500">
              {pipeline.find(p => p.key === view)?.phase || "Menu"}
            </div>
          </div>
        </header>

        {/* Content */}
        <section className="relative h-[562px] overflow-hidden">
          <AnimatePresence mode="wait">
            {view === "menu" ? (
              <motion.div
                key="menu"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="h-full overflow-y-auto px-4 py-3 [scrollbar-color:rgba(34,211,238,0.4)_rgba(255,255,255,0.05)] [scrollbar-width:thin]"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[9px] uppercase tracking-[0.26em] text-slate-600">Pipeline — {pipeline.length} Modules</p>
                </div>
                <div className="space-y-2">
                  {pipeline.map((item, index) => (
                    <PipelineRow
                      key={item.key}
                      item={item}
                      index={index}
                      onClick={() => {
                        if (item.key === 'lister') {
                          chrome.tabs.create({ url: chrome.runtime.getURL('bulklister.html') });
                        } else if (item.key === 'optimizer') {
                          chrome.tabs.create({ url: 'https://www.ebay.com/sh/lst/active' });
                        } else if (item.key === 'messages') {
                          chrome.tabs.create({ url: 'https://www.ebay.com/mys/sold' });
                        } else {
                          setView(item.key);
                        }
                      }}
                    />
                  ))}
                  <SniperCard />
                </div>
                <div className="h-8" />
              </motion.div>
            ) : (
              <motion.div
                key={view}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                {renderDetail()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fade bottom */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
        </section>

        {/* Footer */}
        <footer className="absolute bottom-0 left-0 right-0 grid grid-cols-3 border-t border-white/[0.07] bg-slate-950/98 text-[10px]">
          <div className="flex items-center gap-2 border-r border-white/[0.07] px-3 py-2.5">
            <RefreshCw className="h-3.5 w-3.5 text-cyan-300" />
            <div>
              <p className="text-slate-500">Sync Engine</p>
              <p className="text-emerald-300">Up to date</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-r border-white/[0.07] px-3 py-2.5">
            <Zap className="h-3.5 w-3.5 text-blue-300" />
            <div>
              <p className="text-slate-500">API Status</p>
              <p className="text-emerald-300">Systems go</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div>
              <p className="text-slate-500">v2.5.0</p>
              <p className="text-cyan-300">Changelog</p>
            </div>
            <ExternalLink className="h-3 w-3 text-cyan-500" />
          </div>
        </footer>
      </motion.section>
    </main>
  );
}