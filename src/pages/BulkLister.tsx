/**
 * BulkLister.tsx — Syndrax Sync Bulk Lister
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud, Trash2, CheckCircle, XCircle, AlertTriangle,
  Loader, RefreshCw, X,
  ChevronRight, Zap, BarChart3, Play, Pause, Square,
  Settings, TrendingUp, List, ChevronDown, Download, ExternalLink,
} from 'lucide-react';
import {
  bulkEngine,
  type AsinJob,
  type AsinStatus,
  type BulkEngineConfig,
  type BulkEngineState,
  type ListingType,
  type EngineEvent,
} from '../services/bulk-listing-engine';
import { getErrorSummary } from '../services/error-tracker';
import { downloadBulkUploadTemplate, type BulkUploadRow } from '../services/excel-generator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  asin: string;
  sourceUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseASINs(text: string): ParsedEntry[] {
  const found = new Map<string, string>();

  const urlPattern = /amazon\.com\/(?:dp|gp\/product)\/([A-Z0-9]{10})/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    const asin = match[1].toUpperCase();
    if (!found.has(asin)) found.set(asin, match[0]);
  }

  const urlStripped = text.replace(/https?:\/\/[^\s]*/g, '');
  const asinPattern = /\b([A-Z0-9]{10})\b/g;
  while ((match = asinPattern.exec(urlStripped)) !== null) {
    const candidate = match[1].toUpperCase();
    if (/^[A-Z0-9]{10}$/.test(candidate) && !found.has(candidate)) {
      found.set(candidate, '');
    }
  }

  return Array.from(found.entries()).map(([asin, url]) => ({ asin, sourceUrl: url || undefined }));
}

function enforceMarkup(accountAgeWeeks: number, requested: number): number {
  const scheduleMin =
    accountAgeWeeks <= 2  ? 40 :
    accountAgeWeeks <= 4  ? 60 :
    accountAgeWeeks <= 6  ? 70 :
    accountAgeWeeks <= 8  ? 80 :
    accountAgeWeeks <= 10 ? 90 : 100;
  return Math.max(Math.max(scheduleMin, 10), requested);
}

function getScheduleMin(weeks: number): number {
  if (weeks <= 2)  return 40;
  if (weeks <= 4)  return 60;
  if (weeks <= 6)  return 70;
  if (weeks <= 8)  return 80;
  if (weeks <= 10) return 90;
  return 100;
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
  } catch {}
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<AsinStatus, { label: string; cls: string }> = {
  PENDING:    { label: 'PENDING',    cls: 'border-slate-500/40 bg-slate-500/10 text-slate-400' },
  FETCHING:   { label: 'FETCHING',   cls: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
  VERO_CHECK: { label: 'VERO',       cls: 'border-blue-400/40 bg-blue-400/10 text-blue-300' },
  PRICING:    { label: 'PRICING',    cls: 'border-indigo-400/40 bg-indigo-400/10 text-indigo-300' },
  LISTING:    { label: 'LISTING',    cls: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },
  LISTED:     { label: 'LISTED',     cls: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300' },
  BLOCKED:    { label: 'BLOCKED',    cls: 'border-red-400/40 bg-red-400/10 text-red-300' },
  ERROR:      { label: 'ERROR',      cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  SKIPPED:    { label: 'SKIPPED',    cls: 'border-slate-400/40 bg-slate-400/10 text-slate-400' },
};

function StatusBadge({ status }: { status: AsinStatus }) {
  const { label, cls } = STATUS_MAP[status] ?? STATUS_MAP.PENDING;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-widest ${cls}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: AsinStatus }) {
  if (status === 'FETCHING' || status === 'VERO_CHECK' || status === 'PRICING' || status === 'LISTING')
    return <Loader className="h-3.5 w-3.5 text-cyan-400 animate-spin shrink-0" />;
  if (status === 'LISTED')   return <CheckCircle className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />;
  if (status === 'BLOCKED')  return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (status === 'ERROR')    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  if (status === 'SKIPPED')  return <X className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  return <div className="h-3.5 w-3.5 rounded-full border border-slate-600 shrink-0" />;
}

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

// ─── Listing type button ──────────────────────────────────────────────────────

const LISTING_TYPES: { id: ListingType; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard',  desc: 'Fast, basic listing' },
  { id: 'opti',     label: 'Opti-List', desc: 'Optimized title + bullets' },
  { id: 'chat',     label: 'Chat-List', desc: 'AI-written description' },
  { id: 'seo',      label: 'SEO-List',  desc: 'SEO-optimized full listing' },
];

// ─── Listing mode ─────────────────────────────────────────────────────────────

type ListingMode = 'prelist' | 'bulk-upload';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkLister() {
  // ── Input ──────────────────────────────────────────────────────────────────
  const [rawInput, setRawInput]     = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [parseMsg, setParseMsg]     = useState('');

  // ── Settings ───────────────────────────────────────────────────────────────
  const [accountAgeWeeks, setAccountAgeWeeks] = useState(1);
  const [markup, setMarkup]         = useState(100);
  const [threads, setThreads]       = useState(3);
  const [listingType, setListingType] = useState<ListingType>('standard');
  const [minPrice, setMinPrice]     = useState(0);
  const [maxPrice, setMaxPrice]     = useState(0);
  const [fbaOnly, setFbaOnly]       = useState(false);
  const [closeErrors, setCloseErrors] = useState(true);
  const [maxRetries, setMaxRetries] = useState(2);
  const [showSettings, setShowSettings] = useState(false);

  // ── Engine state (mirrored from bulkEngine) ────────────────────────────────
  const [engineStatus, setEngineStatus] = useState<BulkEngineState['status']>('IDLE');
  const [jobs, setJobs]             = useState<AsinJob[]>([]);
  const [progress, setProgress]     = useState({ listed: 0, errors: 0, blocked: 0, skipped: 0, position: 0 });

  // ── Daily limit ────────────────────────────────────────────────────────────
  const [dailyCount, setDailyCount] = useState(0);
  const DAILY_LIMIT = 100;

  // ── Error summary ──────────────────────────────────────────────────────────
  const [errorSummary, setErrorSummary] = useState<Record<string, number>>({});
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);

  // ── Listing mode ───────────────────────────────────────────────────────────
  const [listingMode, setListingMode] = useState<ListingMode>('bulk-upload');

  // ── Description builder ────────────────────────────────────────────────────
  const [descBuilderAsin, setDescBuilderAsin] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const scheduleMin    = getScheduleMin(accountAgeWeeks);
  const effectiveMarkup = enforceMarkup(accountAgeWeeks, markup);
  const totalJobs      = jobs.length;
  const listedCount    = jobs.filter(j => j.status === 'LISTED').length;
  const errorCount     = jobs.filter(j => j.status === 'ERROR').length;
  const blockedCount   = jobs.filter(j => j.status === 'BLOCKED').length;
  const pendingCount   = jobs.filter(j => j.status === 'PENDING').length;
  const progressPct    = totalJobs > 0 ? Math.round((listedCount / totalJobs) * 100) : 0;
  const isRunning      = engineStatus === 'RUNNING';
  const isPaused       = engineStatus === 'PAUSED';
  const isActive       = isRunning || isPaused;

  // ─── Subscribe to engine events ───────────────────────────────────────────

  useEffect(() => {
    const unsub = bulkEngine.on((event: EngineEvent) => {
      if (event.type === 'ENGINE_STATUS' && event.state?.status) {
        setEngineStatus(event.state.status);
      }
      if (event.type === 'JOB_UPDATE' && event.job) {
        setJobs(prev => {
          const idx = prev.findIndex(j => j.asin === event.job!.asin);
          if (idx === -1) return [...prev, event.job!];
          const next = [...prev];
          next[idx] = event.job!;
          return next;
        });
      }
      if (event.type === 'PROGRESS' && event.state) {
        setProgress(p => ({ ...p, ...event.state }));
        setErrorSummary(getErrorSummary());
      }
      if (event.type === 'COMPLETE') {
        setEngineStatus('COMPLETE');
        setErrorSummary(getErrorSummary());
        // Update daily count
        storageGet<number>('bulk_listed_today').then(c => setDailyCount(c ?? 0));
      }
    });
    return unsub;
  }, []);

  // ─── On mount: load daily counter + restore engine state ─────────────────

  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0];
      const storedDate = await storageGet<string>('bulk_listed_date');
      if (storedDate !== today) {
        await storageSet('bulk_listed_today', 0);
        await storageSet('bulk_listed_date', today);
        setDailyCount(0);
      } else {
        const count = await storageGet<number>('bulk_listed_today') ?? 0;
        setDailyCount(count);
      }

      // Restore engine state if paused/stopped mid-run
      const saved = bulkEngine.getState();
      if (saved.status === 'PAUSED' || saved.status === 'STOPPED') {
        setEngineStatus(saved.status);
        setJobs(saved.jobs);
        setProgress({
          listed: saved.listed,
          errors: saved.errors,
          blocked: saved.blocked,
          skipped: saved.skipped,
          position: saved.position,
        });
      }
    };
    init();
  }, []);

  // ─── Markup enforcement ───────────────────────────────────────────────────

  useEffect(() => {
    const min = getScheduleMin(accountAgeWeeks);
    if (markup < min) setMarkup(min);
  }, [accountAgeWeeks]);

  // ─── Parse ────────────────────────────────────────────────────────────────

  const handleParse = useCallback(() => {
    if (!rawInput.trim()) {
      setParseMsg('Paste Amazon URLs or ASINs above');
      setParsedEntries([]);
      return;
    }
    const entries = parseASINs(rawInput);
    setParsedEntries(entries);
    setParseMsg(
      entries.length === 0
        ? 'No valid ASINs found — paste Amazon URLs or bare ASINs'
        : `Found ${entries.length} ASIN${entries.length !== 1 ? 's' : ''}`
    );
  }, [rawInput]);

  // ─── Start bulk run ───────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (parsedEntries.length === 0) {
      setParseMsg('Parse ASINs first');
      return;
    }
    if (dailyCount >= DAILY_LIMIT) {
      setParseMsg(`Daily limit of ${DAILY_LIMIT} reached`);
      return;
    }

    const config: Partial<BulkEngineConfig> = {
      threads,
      listingType,
      markupPct: effectiveMarkup,
      minPrice,
      maxPrice,
      fbaOnly,
      closeErrorTabs: closeErrors,
      maxRetries,
      dailyLimit: DAILY_LIMIT - dailyCount,
    };

    const asins = parsedEntries.map(e => e.asin);
    setJobs(asins.map(asin => ({ asin, status: 'PENDING', retries: 0 })));
    setProgress({ listed: 0, errors: 0, blocked: 0, skipped: 0, position: 0 });
    setEngineStatus('RUNNING');

    await bulkEngine.start(asins, config);
  }, [parsedEntries, threads, listingType, effectiveMarkup, minPrice, maxPrice, fbaOnly, closeErrors, maxRetries, dailyCount]);

  // ─── Pause / Resume / Stop ────────────────────────────────────────────────

  const handlePause = useCallback(() => {
    bulkEngine.pause();
  }, []);

  const handleResume = useCallback(() => {
    bulkEngine.unpause();
  }, []);

  const handleStop = useCallback(() => {
    bulkEngine.stop();
  }, []);

  const handleResumeFromStorage = useCallback(async () => {
    await bulkEngine.resume();
  }, []);

  // ─── Clear queue ──────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    if (isActive) return;
    setJobs([]);
    setParsedEntries([]);
    setRawInput('');
    setParseMsg('');
    setProgress({ listed: 0, errors: 0, blocked: 0, skipped: 0, position: 0 });
    setEngineStatus('IDLE');
  }, [isActive]);

  // ─── Remove single job ────────────────────────────────────────────────────

  const handleRemoveJob = useCallback((asin: string) => {
    if (isActive) return;
    setJobs(prev => prev.filter(j => j.asin !== asin));
    setParsedEntries(prev => prev.filter(e => e.asin !== asin));
  }, [isActive]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-slate-800/60 bg-[#0a0d14]/95 backdrop-blur px-6 py-3 flex items-center gap-3">
        <SyndraxLogoMark />
        <div>
          <h1 className="text-sm font-bold tracking-wide text-white">Syndrax Bulk Lister</h1>
          <p className="text-[10px] text-slate-500">Amazon → eBay automation engine</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Daily counter */}
          <div className="text-right">
            <div className="text-[10px] text-slate-500">Daily</div>
            <div className={`text-xs font-bold ${dailyCount >= DAILY_LIMIT ? 'text-red-400' : 'text-emerald-400'}`}>
              {dailyCount}/{DAILY_LIMIT}
            </div>
          </div>
          {/* Engine status pill */}
          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold tracking-widest border ${
            isRunning  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' :
            isPaused   ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' :
            engineStatus === 'COMPLETE' ? 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300' :
            engineStatus === 'STOPPED'  ? 'border-red-400/40 bg-red-400/10 text-red-300' :
            'border-slate-600/40 bg-slate-600/10 text-slate-400'
          }`}>
            {engineStatus}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Input card */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <UploadCloud className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Paste Amazon Links / ASINs</h2>
            </div>
            <textarea
              className="w-full h-28 rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-cyan-500/50 font-mono"
              placeholder="https://www.amazon.com/dp/B08N5WRWNW&#10;B09G9FPHY6&#10;https://amazon.com/gp/product/B07XJ8C8F5"
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              disabled={isActive}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleParse}
                disabled={isActive}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                Parse ASINs
              </button>
              {parseMsg && (
                <span className={`text-xs ${parsedEntries.length > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {parseMsg}
                </span>
              )}
              {parsedEntries.length > 0 && !isActive && (
                <span className="ml-auto text-[10px] text-slate-500">
                  {parsedEntries.length} ready to queue
                </span>
              )}
            </div>
          </div>

          {/* Progress bar (visible when running) */}
          {isActive && totalJobs > 0 && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  Progress — {progress.position}/{totalJobs}
                </span>
                <span className="text-xs text-slate-400">{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-[10px]">
                <span className="text-fuchsia-400">✓ {listedCount} listed</span>
                <span className="text-red-400">✗ {blockedCount} blocked</span>
                <span className="text-amber-400">⚠ {errorCount} errors</span>
                <span className="text-slate-500">↷ {progress.skipped} skipped</span>
              </div>
            </div>
          )}

          {/* Job queue table */}
          {jobs.length > 0 && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-white">Queue</span>
                  <span className="text-[10px] text-slate-500 ml-1">{jobs.length} items</span>
                </div>
                {!isActive && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear all
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-800/40 max-h-[480px] overflow-y-auto">
                {jobs.map(job => (
                  <div key={job.asin} className="px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">{job.asin}</span>
                          <StatusBadge status={job.status} />
                          {job.retries > 0 && (
                            <span className="text-[9px] text-amber-400">retry {job.retries}</span>
                          )}
                        </div>
                        {job.title && (
                          <p className="text-xs text-slate-300 truncate mt-0.5">{job.title}</p>
                        )}
                        {job.error && (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            [{job.error.code}] {job.error.message}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {job.amazonPrice !== undefined && job.amazonPrice > 0 && (
                          <div className="text-[10px] text-slate-500">${job.amazonPrice.toFixed(2)}</div>
                        )}
                        {job.ebayPrice !== undefined && job.ebayPrice > 0 && (
                          <div className="text-xs font-semibold text-emerald-400">${job.ebayPrice.toFixed(2)}</div>
                        )}
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => handleRemoveJob(job.asin)}
                          className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error summary (shown after run) */}
          {Object.keys(errorSummary).length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-300">Failure Point Summary</h3>
              </div>
              <div className="space-y-1">
                {Object.entries(errorSummary).map(([code, count]) => (
                  <div key={code} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-amber-400">{code}</span>
                    <span className="text-slate-400">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4">

          {/* Control panel */}
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-fuchsia-400" />
              <h2 className="text-sm font-semibold text-white">Automation Controls</h2>
            </div>

            {/* Listing Mode Toggle */}
            <div className="mb-4">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">Listing Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setListingMode('bulk-upload')}
                  disabled={isActive}
                  className={`rounded-lg border px-2 py-2.5 text-left transition-colors disabled:opacity-40 ${
                    listingMode === 'bulk-upload'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Download className="h-3 w-3" />
                    <span className="text-xs font-semibold">Bulk Upload</span>
                  </div>
                  <div className="text-[9px] text-slate-500">Excel → eBay (1,000/file)</div>
                </button>
                <button
                  onClick={() => setListingMode('prelist')}
                  disabled={isActive}
                  className={`rounded-lg border px-2 py-2.5 text-left transition-colors disabled:opacity-40 ${
                    listingMode === 'prelist'
                      ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                      : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <ExternalLink className="h-3 w-3" />
                    <span className="text-xs font-semibold">Auto-Fill</span>
                  </div>
                  <div className="text-[9px] text-slate-500">Prelist form (1 at a time)</div>
                </button>
              </div>
              {listingMode === 'bulk-upload' && (
                <p className="text-[9px] text-emerald-500/70 mt-1.5">
                  ✓ Recommended — uses eBay's official bulk upload
                </p>
              )}
            </div>

            {/* Listing type (prelist mode only) */}
            {listingMode === 'prelist' && (
            <div className="mb-4">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 block">Listing Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {LISTING_TYPES.map(lt => (
                  <button
                    key={lt.id}
                    onClick={() => setListingType(lt.id)}
                    disabled={isActive}
                    className={`rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-40 ${
                      listingType === lt.id
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                        : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold">{lt.label}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{lt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Threads */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Threads</label>
                <span className="text-xs font-bold text-cyan-400">{threads}</span>
              </div>
              <input
                type="range" min={1} max={30} step={1}
                value={threads}
                onChange={e => setThreads(Number(e.target.value))}
                disabled={isActive}
                className="w-full accent-cyan-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                <span>1 (safe)</span><span>15</span><span>30 (max)</span>
              </div>
            </div>

            {/* Markup */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Markup</label>
                <span className="text-xs font-bold text-emerald-400">{effectiveMarkup}%</span>
              </div>
              <input
                type="range" min={scheduleMin} max={300} step={5}
                value={markup}
                onChange={e => setMarkup(Number(e.target.value))}
                disabled={isActive}
                className="w-full accent-emerald-500 disabled:opacity-40"
              />
              <div className="text-[9px] text-slate-600 mt-0.5">
                Schedule min: {scheduleMin}% (acct age {accountAgeWeeks}w)
              </div>
            </div>

            {/* Account age */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest">Account Age</label>
                <span className="text-xs font-bold text-slate-300">{accountAgeWeeks}w</span>
              </div>
              <input
                type="range" min={1} max={52} step={1}
                value={accountAgeWeeks}
                onChange={e => setAccountAgeWeeks(Number(e.target.value))}
                disabled={isActive}
                className="w-full accent-blue-500 disabled:opacity-40"
              />
            </div>

            {/* Advanced settings toggle */}
            <button
              onClick={() => setShowSettings(s => !s)}
              className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors mb-3"
            >
              <Settings className="h-3 w-3" />
              Advanced settings
              <ChevronDown className={`h-3 w-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
            </button>

            {showSettings && (
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                {/* Price range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-1">Min Amazon Price ($)</label>
                    <input
                      type="number" min={0} step={1}
                      value={minPrice}
                      onChange={e => setMinPrice(Number(e.target.value))}
                      disabled={isActive}
                      className="w-full rounded bg-slate-700/50 border border-slate-600/40 px-2 py-1 text-xs text-slate-200 focus:outline-none disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-1">Max Amazon Price ($)</label>
                    <input
                      type="number" min={0} step={1}
                      value={maxPrice}
                      onChange={e => setMaxPrice(Number(e.target.value))}
                      disabled={isActive}
                      className="w-full rounded bg-slate-700/50 border border-slate-600/40 px-2 py-1 text-xs text-slate-200 focus:outline-none disabled:opacity-40"
                    />
                  </div>
                </div>
                {/* Max retries */}
                <div>
                  <label className="text-[9px] text-slate-500 block mb-1">Max Retries per ASIN</label>
                  <input
                    type="number" min={0} max={5} step={1}
                    value={maxRetries}
                    onChange={e => setMaxRetries(Number(e.target.value))}
                    disabled={isActive}
                    className="w-full rounded bg-slate-700/50 border border-slate-600/40 px-2 py-1 text-xs text-slate-200 focus:outline-none disabled:opacity-40"
                  />
                </div>
                {/* Toggles */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={fbaOnly}
                    onChange={e => setFbaOnly(e.target.checked)}
                    disabled={isActive}
                    className="accent-cyan-500"
                  />
                  <span className="text-xs text-slate-400">FBA Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={closeErrors}
                    onChange={e => setCloseErrors(e.target.checked)}
                    disabled={isActive}
                    className="accent-cyan-500"
                  />
                  <span className="text-xs text-slate-400">Auto-close error tabs</span>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              {/* Bulk Upload mode: Download Excel button */}
              {listingMode === 'bulk-upload' && !isActive && (
                <>
                  <button
                    onClick={() => {
                      if (parsedEntries.length === 0) { setParseMsg('Parse ASINs first'); return; }
                      const rows: BulkUploadRow[] = parsedEntries.map(e => ({ asin: e.asin }));
                      downloadBulkUploadTemplate(rows);
                    }}
                    disabled={parsedEntries.length === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    <Download className="h-4 w-4" />
                    Download Excel ({parsedEntries.length} ASINs)
                  </button>
                  <a
                    href="https://www.ebay.com/sh/reports/uploads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700/50 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open eBay Bulk Upload Page
                  </a>
                </>
              )}

              {/* Prelist mode: Start button */}
              {listingMode === 'prelist' && !isActive && engineStatus !== 'RUNNING' && (
                <button
                  onClick={handleStart}
                  disabled={parsedEntries.length === 0 || dailyCount >= DAILY_LIMIT}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Play className="h-4 w-4" />
                  Start Bulk Run ({parsedEntries.length} ASINs)
                </button>
              )}

              {/* Pause / Resume */}
              {isRunning && (
                <button
                  onClick={handlePause}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </button>
              )}

              {/* Stop */}
              {isActive && (
                <button
                  onClick={handleStop}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              )}

              {/* Resume from storage */}
              {(engineStatus === 'STOPPED' || engineStatus === 'PAUSED') && !isActive && (
                <button
                  onClick={handleResumeFromStorage}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-2.5 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Resume Saved Run
                </button>
              )}

              {/* Clear */}
              {!isActive && jobs.length > 0 && (
                <button
                  onClick={handleClear}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/50 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Queue
                </button>
              )}
            </div>
          </div>

          {/* Stats card */}
          {(isActive || engineStatus === 'COMPLETE' || jobs.length > 0) && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-white">Run Stats</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Listed',   value: listedCount,   cls: 'text-fuchsia-400' },
                  { label: 'Pending',  value: pendingCount,  cls: 'text-slate-400' },
                  { label: 'Blocked',  value: blockedCount,  cls: 'text-red-400' },
                  { label: 'Errors',   value: errorCount,    cls: 'text-amber-400' },
                  { label: 'Skipped',  value: progress.skipped, cls: 'text-slate-500' },
                  { label: 'Total',    value: totalJobs,     cls: 'text-white' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-slate-800/40 px-3 py-2">
                    <div className={`text-lg font-bold ${s.cls}`}>{s.value}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Position tracker */}
          {isActive && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Position</h3>
              </div>
              <div className="text-2xl font-bold text-cyan-400">
                {progress.position}
                <span className="text-sm text-slate-500 font-normal"> / {totalJobs}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {threads} thread{threads !== 1 ? 's' : ''} · {listingType} mode
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
