/**
 * BugPanel.tsx — Bug reporting and log viewer UI
 * Session V: Dev Tools
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Bug, AlertTriangle, Info, CheckCircle,
  ChevronDown, ChevronUp, Trash2, Plus, X, Send,
} from 'lucide-react';
import {
  getBugReports, markResolved, clearAllResolved, clearAll, logBug,
  type BugReport,
} from '../services/bug-logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Level badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: BugReport['level'] }) {
  const cfg = {
    error: { emoji: '🔴', label: 'Error',   cls: 'border-red-400/40 bg-red-400/10 text-red-300' },
    warn:  { emoji: '🟡', label: 'Warning', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
    info:  { emoji: '🔵', label: 'Info',    cls: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ─── Add Bug Modal ────────────────────────────────────────────────────────────

interface AddBugModalProps {
  onClose: () => void;
  onSubmit: () => void;
}

function AddBugModal({ onClose, onSubmit }: AddBugModalProps) {
  const [level, setLevel] = useState<BugReport['level']>('error');
  const [feature, setFeature] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feature.trim() || !message.trim()) return;
    setSubmitting(true);
    await logBug({ level, feature: feature.trim(), message: message.trim() });
    setSubmitting(false);
    onSubmit();
  };

  const levelOptions: { value: BugReport['level']; label: string; emoji: string }[] = [
    { value: 'error', label: 'Error',   emoji: '🔴' },
    { value: 'warn',  label: 'Warning', emoji: '🟡' },
    { value: 'info',  label: 'Info',    emoji: '🔵' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[360px] rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/60 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Bug className="h-4 w-4 text-fuchsia-400" />
            Report a Bug
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-500 hover:text-slate-300 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Level selector */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Level</p>
          <div className="flex gap-2">
            {levelOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setLevel(opt.value)}
                className={`flex-1 rounded-xl border py-2 text-[11px] font-medium transition ${
                  level === opt.value
                    ? opt.value === 'error'
                      ? 'border-red-400/50 bg-red-400/15 text-red-200'
                      : opt.value === 'warn'
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                      : 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature input */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Feature</p>
          <input
            value={feature}
            onChange={e => setFeature(e.target.value)}
            placeholder="e.g. Sniper Overlay, Order Fulfillment…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-fuchsia-400/40"
          />
        </div>

        {/* Message textarea */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Message</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe the bug in detail…"
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-fuchsia-400/40 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!feature.trim() || !message.trim() || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? 'Submitting…' : 'Submit Bug Report'}
        </button>
      </div>
    </div>
  );
}

// ─── Bug Card ─────────────────────────────────────────────────────────────────

interface BugCardProps {
  report: BugReport;
  onResolve: (id: string) => void;
}

function BugCard({ report, onResolve }: BugCardProps) {
  const [stackOpen, setStackOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const hasStack = !!report.stack;
  const hasContext = !!report.context && Object.keys(report.context).length > 0;

  return (
    <div className={`rounded-xl border bg-white/[0.025] p-3 space-y-2 transition-opacity ${
      report.resolved
        ? 'border-white/[0.04] opacity-50'
        : 'border-white/[0.08]'
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-2 flex-wrap">
        <LevelBadge level={report.level} />
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
          {report.feature}
        </span>
        <span className="ml-auto text-[10px] text-slate-600 shrink-0">{timeAgo(report.timestamp)}</span>
      </div>

      {/* Message */}
      <p className="text-[12px] font-semibold text-slate-200 leading-5">{report.message}</p>

      {/* Stack trace */}
      {hasStack && (
        <div>
          <button
            onClick={() => setStackOpen(v => !v)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            {stackOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Stack trace
          </button>
          {stackOpen && (
            <pre className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/30 p-2 text-[9px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-4">
              {report.stack}
            </pre>
          )}
        </div>
      )}

      {/* Context data */}
      {hasContext && (
        <div>
          <button
            onClick={() => setContextOpen(v => !v)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Context data
          </button>
          {contextOpen && (
            <div className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/30 p-2 space-y-0.5">
              {Object.entries(report.context!).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[10px]">
                  <span className="text-slate-500 shrink-0">{k}:</span>
                  <span className="text-slate-300 font-mono break-all">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[9px] text-slate-700 font-mono">{report.id.slice(0, 8)}…</span>
        {report.resolved ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-400">
            <CheckCircle className="h-3 w-3" /> Resolved
          </span>
        ) : (
          <button
            onClick={() => onResolve(report.id)}
            className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-400/20 transition"
          >
            <CheckCircle className="h-3 w-3" /> Resolve
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main BugPanel ────────────────────────────────────────────────────────────

interface BugPanelProps {
  onBack: () => void;
}

export default function BugPanel({ onBack }: BugPanelProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | BugReport['level']>('all');
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getBugReports();
    setReports(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (id: string) => {
    await markResolved(id);
    await load();
  };

  const handleClearResolved = async () => {
    await clearAllResolved();
    await load();
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3000);
      return;
    }
    await clearAll();
    setConfirmClearAll(false);
    await load();
  };

  const handleModalSubmit = async () => {
    setShowModal(false);
    await load();
  };

  // Derived data
  const uniqueFeatures = Array.from(new Set(reports.map(r => r.feature))).sort();
  const unresolvedErrors = reports.filter(r => r.level === 'error' && !r.resolved).length;

  const filtered = reports.filter(r => {
    const matchLevel = levelFilter === 'all' || r.level === levelFilter;
    const matchFeature = featureFilter === 'all' || r.feature === featureFilter;
    return matchLevel && matchFeature;
  });

  const levelTabs: { key: 'all' | BugReport['level']; label: string; icon: React.ElementType }[] = [
    { key: 'all',   label: 'All',      icon: Bug },
    { key: 'error', label: 'Errors',   icon: AlertTriangle },
    { key: 'warn',  label: 'Warnings', icon: AlertTriangle },
    { key: 'info',  label: 'Info',     icon: Info },
  ];

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="flex-1 text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
            Bug Panel
            {unresolvedErrors > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px]">
                {unresolvedErrors}
              </span>
            )}
          </h2>
          <span className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[9px] font-medium text-fuchsia-300">
            Dev Tools
          </span>
        </div>

        {/* Controls */}
        <div className="border-b border-white/[0.06] px-4 py-2.5 space-y-2">
          {/* Level filter tabs */}
          <div className="flex gap-1">
            {levelTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setLevelFilter(tab.key)}
                className={`flex-1 rounded-lg border py-1.5 text-[10px] font-medium tracking-wide transition ${
                  levelFilter === tab.key
                    ? tab.key === 'error'
                      ? 'border-red-400/50 bg-red-400/15 text-red-200'
                      : tab.key === 'warn'
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                      : tab.key === 'info'
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                      : 'border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Feature filter + action buttons */}
          <div className="flex items-center gap-1.5">
            <select
              value={featureFilter}
              onChange={e => setFeatureFilter(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-fuchsia-400/40 appearance-none cursor-pointer"
            >
              <option value="all">All Features</option>
              {uniqueFeatures.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <button
              onClick={handleClearResolved}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] text-slate-400 hover:text-slate-200 transition whitespace-nowrap"
            >
              <CheckCircle className="h-3 w-3" />
              Clear Resolved
            </button>

            <button
              onClick={handleClearAll}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition whitespace-nowrap ${
                confirmClearAll
                  ? 'border-red-400/60 bg-red-400/20 text-red-200 animate-pulse'
                  : 'border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20'
              }`}
            >
              <Trash2 className="h-3 w-3" />
              {confirmClearAll ? 'Confirm?' : 'Clear All'}
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2 py-1.5 text-[10px] font-medium text-cyan-300 hover:bg-cyan-400/20 transition whitespace-nowrap"
            >
              <Plus className="h-3 w-3" />
              Report Bug
            </button>
          </div>
        </div>

        {/* Bug list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgba(217,70,239,0.3)_transparent]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-fuchsia-400/30 border-t-fuchsia-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <span className="text-4xl">🎉</span>
              <p className="text-sm font-medium text-slate-300">No bugs logged</p>
              <p className="text-[11px] text-slate-600">that's a good sign!</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-slate-600 px-0.5">
                {filtered.length} report{filtered.length !== 1 ? 's' : ''}
                {levelFilter !== 'all' || featureFilter !== 'all' ? ' (filtered)' : ''}
              </p>
              {filtered.map(report => (
                <BugCard key={report.id} report={report} onResolve={handleResolve} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <AddBugModal
          onClose={() => setShowModal(false)}
          onSubmit={handleModalSubmit}
        />
      )}
    </>
  );
}
