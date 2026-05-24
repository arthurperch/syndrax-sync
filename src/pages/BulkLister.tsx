/**
 * BulkLister.tsx — Syndrax Sync Bulk Lister Full Page
 * Session E — standalone Chrome extension page (bulklister.html)
 * Dark neon theme, two-column layout, full business logic
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UploadCloud, Trash2, CheckCircle, XCircle, AlertTriangle,
  Loader, ShieldCheck, ShieldOff, RefreshCw, X, Plus,
  ChevronRight, Zap, BarChart3, PenTool, ChevronDown,
} from 'lucide-react';
import DescriptionBuilder from '../components/DescriptionBuilder';
import type { DescProductData } from '../components/DescriptionBuilder';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'PENDING' | 'CHECKING' | 'CLEAR' | 'BLOCKED' | 'LISTED' | 'ERROR';

interface VeroResult {
  blocked: boolean;
  reason: string;
}

interface QueueItem {
  asin: string;
  status: ItemStatus;
  title?: string;
  price?: number;
  brand?: string;
  image?: string;
  ebayPrice?: number;
  veroResult?: VeroResult;
  error?: string;
  description?: string;
}

interface AmazonProductResult {
  title?: string;
  price?: number;
  brand?: string;
  image?: string;
  error?: string;
}

interface VeroCheckResult {
  blocked: boolean;
  reason: string;
}

interface ListResult {
  success: boolean;
  error?: string;
}

// ─── Business Logic ───────────────────────────────────────────────────────────

/**
 * Extracts valid 10-char ASINs from pasted text.
 * Handles: bare ASINs, amazon.com/dp/ASIN, amazon.com/gp/product/ASIN
 */
function parseASINs(text: string): string[] {
  const found = new Set<string>();

  // Match amazon URL patterns first
  const urlPattern = /amazon\.com\/(?:dp|gp\/product)\/([A-Z0-9]{10})/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    found.add(match[1].toUpperCase());
  }

  // Match bare ASINs (10 chars, alphanumeric, typically starts with B0 or is all digits)
  const asinPattern = /\b([A-Z0-9]{10})\b/g;
  const urlStripped = text.replace(/https?:\/\/[^\s]*/g, ''); // avoid re-matching URL fragments
  while ((match = asinPattern.exec(urlStripped)) !== null) {
    const candidate = match[1].toUpperCase();
    // Valid ASIN: starts with B or is all digits, 10 chars
    if (/^[A-Z0-9]{10}$/.test(candidate)) {
      found.add(candidate);
    }
  }

  return Array.from(found);
}

/**
 * Enforces markup based on account age schedule from BUSINESS_RULES.
 * User can go above the schedule minimum but never below it.
 * Hard floor: 10%.
 */
function enforceMarkup(accountAgeWeeks: number, requestedMarkup: number): number {
  const scheduleMin =
    accountAgeWeeks <= 2  ? 40 :
    accountAgeWeeks <= 4  ? 60 :
    accountAgeWeeks <= 6  ? 70 :
    accountAgeWeeks <= 8  ? 80 :
    accountAgeWeeks <= 10 ? 90 : 100;

  const hardFloor = 10;
  const effectiveMin = Math.max(scheduleMin, hardFloor);
  return Math.max(effectiveMin, requestedMarkup);
}

/**
 * Returns the schedule minimum markup for a given account age.
 */
function getScheduleMin(accountAgeWeeks: number): number {
  if (accountAgeWeeks <= 2)  return 40;
  if (accountAgeWeeks <= 4)  return 60;
  if (accountAgeWeeks <= 6)  return 70;
  if (accountAgeWeeks <= 8)  return 80;
  if (accountAgeWeeks <= 10) return 90;
  return 100;
}

/**
 * Calculates eBay price from Amazon price + markup %.
 * markup=100 means 2x (100% above cost).
 */
function calcEbayPrice(amazonPrice: number, markupPct: number): number {
  return amazonPrice * (1 + markupPct / 100);
}

// ─── Chrome helpers ───────────────────────────────────────────────────────────

async function sendMsg<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch { return null; }
}

async function storageGet<T>(key: string): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    const r = await chrome.storage.local.get(key);
    return (r[key] ?? null) as T | null;
  } catch { return null; }
}

async function storageSet(key: string, value: unknown): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    await chrome.storage.local.set({ [key]: value });
  } catch { /* noop */ }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SyndraxLogoMark() {
  return (
    <svg viewBox="0 0 120 120" className="h-7 w-7" aria-hidden="true">
      <defs>
        <linearGradient id="bl-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="48%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#bl-grad)" strokeWidth="7" strokeLinecap="round">
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(0 60 60)" />
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(60 60 60)" />
        <ellipse cx="60" cy="60" rx="49" ry="18" transform="rotate(120 60 60)" />
      </g>
      <circle cx="60" cy="60" r="10" fill="url(#bl-grad)" />
    </svg>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    PENDING:  { label: 'PENDING',  cls: 'border-slate-500/40 bg-slate-500/10 text-slate-400' },
    CHECKING: { label: 'CHECKING', cls: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
    CLEAR:    { label: 'CLEAR',    cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
    BLOCKED:  { label: 'BLOCKED',  cls: 'border-red-400/40 bg-red-400/10 text-red-300' },
    LISTED:   { label: 'LISTED',   cls: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300' },
    ERROR:    { label: 'ERROR',    cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest ${cls}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === 'CHECKING') return <Loader className="h-3.5 w-3.5 text-cyan-400 animate-spin shrink-0" />;
  if (status === 'CLEAR')    return <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === 'BLOCKED')  return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (status === 'LISTED')   return <CheckCircle className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />;
  if (status === 'ERROR')    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <div className="h-3.5 w-3.5 rounded-full border border-slate-600 shrink-0" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkLister() {
  // Input state
  const [rawInput, setRawInput] = useState('');
  const [parsedASINs, setParsedASINs] = useState<string[]>([]);
  const [parseMsg, setParseMsg] = useState('');

  // Settings
  const [accountAgeWeeks, setAccountAgeWeeks] = useState(1);
  const [markup, setMarkup] = useState(100);
  const [veroEnabled, setVeroEnabled] = useState(true);

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [expandedDesc, setExpandedDesc] = useState<string | null>(null);

  // Daily counter
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyWarning, setDailyWarning] = useState('');

  const DAILY_LIMIT = 100;

  // Derived
  const scheduleMin = getScheduleMin(accountAgeWeeks);
  const effectiveMarkup = enforceMarkup(accountAgeWeeks, markup);
  const previewEbayPrice = calcEbayPrice(20, effectiveMarkup);

  // Summary counts
  const listed  = queue.filter(i => i.status === 'LISTED').length;
  const blocked = queue.filter(i => i.status === 'BLOCKED').length;
  const errors  = queue.filter(i => i.status === 'ERROR').length;
  const estProfit = queue
    .filter(i => i.status === 'LISTED' && i.price && i.ebayPrice)
    .reduce((sum, i) => sum + ((i.ebayPrice ?? 0) - (i.price ?? 0)), 0);

  // ─── On mount: daily counter reset + load queue ──────────────────────────

  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0];
      const storedDate = await storageGet<string>('bulk_listed_date');
      if (storedDate !== today) {
        await storageSet('bulk_listed_today', 0);
        await storageSet('bulk_listed_date', today);
        setDailyCount(0);
      } else {
        const count = await storageGet<number>('bulk_listed_today');
        setDailyCount(count ?? 0);
      }

      // Load persisted queue
      const savedQueue = await storageGet<QueueItem[]>('bulk_queue');
      if (savedQueue && savedQueue.length > 0) {
        // Reset any mid-flight statuses from previous session
        const restored = savedQueue.map(item =>
          item.status === 'CHECKING' ? { ...item, status: 'PENDING' as ItemStatus } : item
        );
        setQueue(restored);
      }
    };
    init();
  }, []);

  // ─── Persist queue on change ─────────────────────────────────────────────

  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => {
    storageSet('bulk_queue', queue);
  }, [queue]);

  // ─── Markup enforcement: clamp slider when account age changes ───────────

  useEffect(() => {
    const min = getScheduleMin(accountAgeWeeks);
    if (markup < min) {
      setMarkup(min);
    }
  }, [accountAgeWeeks]);

  // ─── Parse ASINs ─────────────────────────────────────────────────────────

  const handleParse = useCallback(() => {
    if (!rawInput.trim()) {
      setParseMsg('Paste Amazon URLs or ASINs above');
      setParsedASINs([]);
      return;
    }
    const asins = parseASINs(rawInput);
    setParsedASINs(asins);
    if (asins.length === 0) {
      setParseMsg('No valid ASINs found — paste Amazon URLs or bare ASINs');
    } else {
      setParseMsg(`Found ${asins.length} ASIN${asins.length !== 1 ? 's' : ''}`);
    }
  }, [rawInput]);

  // ─── VERO check ──────────────────────────────────────────────────────────

  const checkVERO = useCallback(async (title: string, brand: string): Promise<VeroCheckResult> => {
    if (!veroEnabled) return { blocked: false, reason: '' };
    const result = await sendMsg<VeroCheckResult>('CHECK_VERO', { title, brand });
    return result ?? { blocked: false, reason: '' };
  }, [veroEnabled]);

  // ─── Queue single item ───────────────────────────────────────────────────

  const queueItem = useCallback(async (asin: string) => {
    // Set to CHECKING
    setQueue(prev => prev.map(item =>
      item.asin === asin ? { ...item, status: 'CHECKING' } : item
    ));

    // Fetch Amazon product data
    const productData = await sendMsg<AmazonProductResult>('FETCH_AMAZON_PRODUCT', { asin });

    if (!productData || productData.error) {
      setQueue(prev => prev.map(item =>
        item.asin === asin
          ? { ...item, status: 'ERROR', error: productData?.error ?? 'Failed to fetch product' }
          : item
      ));
      return;
    }

    const { title = '', price = 0, brand = '', image = '' } = productData;
    const ebayPrice = calcEbayPrice(price, effectiveMarkup);

    // VERO check
    const veroResult = await checkVERO(title, brand);

    const newStatus: ItemStatus = veroResult.blocked ? 'BLOCKED' : 'CLEAR';

    setQueue(prev => prev.map(item =>
      item.asin === asin
        ? { ...item, status: newStatus, title, price, brand, image, ebayPrice, veroResult }
        : item
    ));
  }, [effectiveMarkup, checkVERO]);

  // ─── List single item ────────────────────────────────────────────────────

  const listItem = useCallback(async (asin: string, ebayPrice: number, title: string): Promise<boolean> => {
    // Check daily cap
    const currentCount = await storageGet<number>('bulk_listed_today') ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      setDailyWarning(`Daily limit of ${DAILY_LIMIT} listings reached. Try again tomorrow.`);
      return false;
    }

    const result = await sendMsg<ListResult>('CREATE_EBAY_LISTING', { asin, ebayPrice, title });

    if (result?.success) {
      const newCount = currentCount + 1;
      await storageSet('bulk_listed_today', newCount);
      setDailyCount(newCount);

      setQueue(prev => prev.map(item =>
        item.asin === asin ? { ...item, status: 'LISTED' } : item
      ));

      if (newCount >= DAILY_LIMIT) {
        setDailyWarning(`Daily limit of ${DAILY_LIMIT} listings reached.`);
      }
      return true;
    } else {
      setQueue(prev => prev.map(item =>
        item.asin === asin ? { ...item, status: 'ERROR', error: result?.error ?? 'Listing failed' } : item
      ));
      return false;
    }
  }, []);

  // ─── Queue All ───────────────────────────────────────────────────────────

  const handleQueueAll = useCallback(async () => {
    if (parsedASINs.length === 0) {
      setParseMsg('Parse ASINs first');
      return;
    }

    // Add new ASINs to queue (skip duplicates already in queue)
    const existingAsins = new Set(queue.map(i => i.asin));
    const newItems: QueueItem[] = parsedASINs
      .filter(asin => !existingAsins.has(asin))
      .map(asin => ({ asin, status: 'PENDING' as ItemStatus }));

    if (newItems.length === 0) {
      setParseMsg('All ASINs already in queue');
      return;
    }

    setQueue(prev => [...prev, ...newItems]);
    setParseMsg(`Added ${newItems.length} item${newItems.length !== 1 ? 's' : ''} to queue`);

    // Auto-check each new item
    for (const item of newItems) {
      await queueItem(item.asin);
    }
  }, [parsedASINs, queue, queueItem]);

  // ─── List All CLEAR items ────────────────────────────────────────────────

  const handleListAll = useCallback(async () => {
    const clearItems = queue.filter(i => i.status === 'CLEAR' && i.ebayPrice && i.title);
    if (clearItems.length === 0) return;

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: clearItems.length });
    setDailyWarning('');

    for (let i = 0; i < clearItems.length; i++) {
      const item = clearItems[i];
      const ok = await listItem(item.asin, item.ebayPrice!, item.title!);
      setBatchProgress({ done: i + 1, total: clearItems.length });
      if (!ok && dailyCount >= DAILY_LIMIT) break;
    }

    setBatchRunning(false);
  }, [queue, listItem, dailyCount]);

  // ─── Remove item ─────────────────────────────────────────────────────────

  const removeItem = useCallback((asin: string) => {
    setQueue(prev => prev.filter(i => i.asin !== asin));
  }, []);

  // ─── Clear all ───────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setQueue([]);
    storageSet('bulk_queue', []);
  }, []);

  // ─── Recheck item ────────────────────────────────────────────────────────

  const recheckItem = useCallback(async (asin: string) => {
    setQueue(prev => prev.map(item =>
      item.asin === asin ? { ...item, status: 'PENDING' } : item
    ));
    await queueItem(asin);
  }, [queueItem]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-screen min-h-screen bg-[#02050f] text-white font-sans">
      {/* Background layers */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(217,70,239,0.10),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(37,99,235,0.10),transparent_35%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Top shimmer */}
      <div className="fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent z-10" />

      <div className="relative min-h-screen grid grid-cols-[420px_1fr]">

        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN — Input & Controls
        ═══════════════════════════════════════════════════════ */}
        <aside className="border-r border-white/[0.07] flex flex-col min-h-screen">

          {/* Header */}
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-3 mb-1">
              <SyndraxLogoMark />
              <div>
                <h1 className="text-lg font-semibold tracking-wide bg-gradient-to-r from-cyan-300 via-blue-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Bulk Lister
                </h1>
                <p className="text-[10px] text-slate-500 tracking-[0.1em]">Phase 6 — eBay listing engine</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                <span className="text-[10px] text-emerald-300 font-medium">Live</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">

            {/* ASIN / URL Input */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 block">
                Amazon URLs or ASINs
              </label>
              <textarea
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                rows={7}
                placeholder={`Paste one per line:\nhttps://amazon.com/dp/B08N5WRWNW\nB07XJ8C8F5\nhttps://amazon.com/gp/product/B09G9FPHY6`}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40 resize-none font-mono leading-relaxed [scrollbar-width:thin]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleParse}
                  className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Parse ASINs
                </button>
                {parseMsg && (
                  <span className={`text-[11px] ${parsedASINs.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {parseMsg}
                  </span>
                )}
              </div>
              {parsedASINs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto [scrollbar-width:thin]">
                  {parsedASINs.map(asin => (
                    <span key={asin} className="rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                      {asin}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Account Settings */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Account Settings</p>

              {/* Account Age */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400">Account Age</label>
                  <span className="text-xs font-semibold text-cyan-300">
                    Week {accountAgeWeeks}
                    <span className="text-slate-500 font-normal ml-1">
                      (min {scheduleMin}% markup)
                    </span>
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={accountAgeWeeks}
                  onChange={e => setAccountAgeWeeks(Math.max(1, Math.min(52, Number(e.target.value))))}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
                />
              </div>

              {/* Markup Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400">Markup %</label>
                  <span className="text-xs font-semibold text-fuchsia-300">{effectiveMarkup}%</span>
                </div>
                <input
                  type="range"
                  min={scheduleMin}
                  max={300}
                  step={5}
                  value={markup}
                  onChange={e => setMarkup(Number(e.target.value))}
                  className="w-full accent-fuchsia-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Min {scheduleMin}%</span>
                  <span>300%</span>
                </div>
              </div>

              {/* Price Preview */}
              <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/5 px-3 py-2">
                <p className="text-[10px] text-slate-500 mb-0.5">Preview: $20.00 Amazon item</p>
                <p className="text-sm font-semibold text-fuchsia-300">
                  → ${previewEbayPrice.toFixed(2)} on eBay
                  <span className="text-[10px] text-slate-500 font-normal ml-2">
                    (+${(previewEbayPrice - 20).toFixed(2)} profit)
                  </span>
                </p>
              </div>
            </div>

            {/* Compliance Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
              <div className="flex items-center gap-2">
                {veroEnabled
                  ? <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  : <ShieldOff className="h-4 w-4 text-slate-500" />
                }
                <div>
                  <p className="text-xs font-medium text-slate-200">VERO Check</p>
                  <p className="text-[10px] text-slate-500">3,205 protected brands</p>
                </div>
              </div>
              <button
                onClick={() => setVeroEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${veroEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${veroEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Daily Limit */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-300">Daily Listings</p>
                <span className={`text-xs font-semibold ${dailyCount >= DAILY_LIMIT ? 'text-red-400' : dailyCount >= 80 ? 'text-amber-400' : 'text-cyan-300'}`}>
                  {dailyCount} / {DAILY_LIMIT}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    dailyCount >= DAILY_LIMIT ? 'bg-red-400' :
                    dailyCount >= 80 ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, (dailyCount / DAILY_LIMIT) * 100)}%` }}
                />
              </div>
              {dailyWarning && (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {dailyWarning}
                </p>
              )}
            </div>

            {/* Queue All Button */}
            <button
              onClick={handleQueueAll}
              disabled={parsedASINs.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 px-4 py-3 text-sm font-semibold text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Queue All ({parsedASINs.length} ASINs)
            </button>

          </div>
        </aside>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN — Queue & Results
        ═══════════════════════════════════════════════════════ */}
        <main className="flex flex-col min-h-screen">

          {/* Queue Header */}
          <div className="border-b border-white/[0.07] px-6 py-4 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-fuchsia-400" />
              <h2 className="text-base font-semibold text-slate-100">Listing Queue</h2>
              {queue.length > 0 && (
                <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-300">
                  {queue.length}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* List All CLEAR button */}
              {queue.some(i => i.status === 'CLEAR') && (
                <button
                  onClick={handleListAll}
                  disabled={batchRunning || dailyCount >= DAILY_LIMIT}
                  className="flex items-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-40"
                >
                  {batchRunning
                    ? <Loader className="h-3.5 w-3.5 animate-spin" />
                    : <Zap className="h-3.5 w-3.5" />
                  }
                  {batchRunning ? `Listing ${batchProgress.done}/${batchProgress.total}…` : 'List All Clear'}
                </button>
              )}

              {queue.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-red-300 hover:border-red-400/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar (batch running) */}
          {batchRunning && (
            <div className="px-6 py-2 border-b border-white/[0.07]">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Listing batch…</span>
                <span>{batchProgress.done} of {batchProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-fuchsia-400 transition-all duration-300"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgba(217,70,239,0.3)_transparent]">

            {queue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5">
                  <UploadCloud className="h-8 w-8 text-fuchsia-400/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-400">Queue is empty</p>
                  <p className="text-[11px] text-slate-600 mt-1">Paste ASINs on the left and click Queue All</p>
                </div>
              </div>
            )}

            {queue.map(item => (
              <div
                key={item.asin}
                className={`rounded-xl border bg-white/[0.025] p-4 transition-all ${
                  item.status === 'BLOCKED' ? 'border-red-400/20' :
                  item.status === 'LISTED'  ? 'border-fuchsia-400/20' :
                  item.status === 'CLEAR'   ? 'border-emerald-400/20' :
                  item.status === 'ERROR'   ? 'border-amber-400/20' :
                  'border-white/[0.07]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5">
                    <StatusIcon status={item.status} />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* ASIN + status badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-200">{item.asin}</span>
                      <StatusBadge status={item.status} />
                      {item.brand && (
                        <span className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">
                          {item.brand}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    {item.title && (
                      <p className="text-[11px] text-slate-300 leading-5 line-clamp-2">{item.title}</p>
                    )}

                    {/* Price row */}
                    {item.price !== undefined && item.price > 0 && (
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-slate-500">Amazon: <span className="text-slate-300">${item.price.toFixed(2)}</span></span>
                        {item.ebayPrice !== undefined && (
                          <>
                            <ChevronRight className="h-3 w-3 text-slate-600" />
                            <span className="text-slate-500">eBay: <span className="text-fuchsia-300 font-semibold">${item.ebayPrice.toFixed(2)}</span></span>
                            <span className="text-emerald-400 text-[10px]">
                              +${(item.ebayPrice - item.price).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* VERO result */}
                    {item.veroResult && (
                      <div className={`flex items-center gap-1.5 text-[10px] ${item.veroResult.blocked ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.veroResult.blocked
                          ? <><XCircle className="h-3 w-3 shrink-0" /> VERO BLOCKED — {item.veroResult.reason}</>
                          : <><CheckCircle className="h-3 w-3 shrink-0" /> Compliance clear</>
                        }
                      </div>
                    )}

                    {/* Error */}
                    {item.error && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {item.error}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {item.status === 'CLEAR' && item.ebayPrice && item.title && (
                        <button
                          onClick={() => listItem(item.asin, item.ebayPrice!, item.title!)}
                          disabled={dailyCount >= DAILY_LIMIT}
                          className="flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-400/10 px-2.5 py-1.5 text-[11px] font-medium text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-40"
                        >
                          <UploadCloud className="h-3 w-3" />
                          List on eBay
                        </button>
                      )}
                      {(item.status === 'CLEAR' || item.status === 'LISTED') && (
                        <button
                          onClick={() => setExpandedDesc(expandedDesc === item.asin ? null : item.asin)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                            item.description
                              ? 'border-violet-400/40 bg-violet-400/10 text-violet-200'
                              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-violet-300 hover:border-violet-400/30'
                          }`}
                        >
                          <PenTool className="h-3 w-3" />
                          {item.description ? 'Description ✓' : 'Build Description'}
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedDesc === item.asin ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {(item.status === 'ERROR' || item.status === 'BLOCKED') && (
                        <button
                          onClick={() => recheckItem(item.asin)}
                          className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-400/10"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Recheck
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.asin)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:text-red-300 hover:border-red-400/20 ml-auto"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Product image */}
                  {item.image && (
                    <div className="shrink-0 h-14 w-14 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                      <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
                    </div>
                  )}
                </div>

                {/* Description Builder accordion */}
                {expandedDesc === item.asin && (
                  <div className="mt-3 border-t border-violet-400/20 pt-3">
                    <DescriptionBuilder
                      mode="panel"
                      productData={item.title ? {
                        title: item.title,
                        brand: item.brand ?? '',
                        bullets: [],
                        price: item.price ?? 0,
                        asin: item.asin,
                      } as DescProductData : undefined}
                      onInsert={(html) => {
                        setQueue(prev => prev.map(q =>
                          q.asin === item.asin ? { ...q, description: html } : q
                        ));
                        setExpandedDesc(null);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Row */}
          {queue.length > 0 && (
            <div className="border-t border-white/[0.07] px-6 py-3 flex items-center gap-6 text-[11px]">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-500">Summary:</span>
              </div>
              <span className="text-fuchsia-300 font-medium">{listed} listed</span>
              <span className="text-red-400">{blocked} blocked</span>
              <span className="text-amber-400">{errors} errors</span>
              <span className="text-slate-500">{queue.filter(i => i.status === 'PENDING').length} pending</span>
              {estProfit > 0 && (
                <span className="ml-auto text-emerald-400 font-semibold">
                  Est. profit: ${estProfit.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
