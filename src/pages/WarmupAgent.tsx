/**
 * WarmupAgent.tsx — eBay Account Warmup Scheduler Page
 * Schedule cards with daily action logging, day progression, and add modal.
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, Trash2, ChevronLeft, Clock, CheckCircle } from 'lucide-react';
import {
  WarmupSchedule,
  getWarmupLimits,
  isActionSafe,
  recordAction,
  advanceDay,
  getWarmupSchedules,
  saveWarmupSchedule,
  deleteWarmupSchedule,
} from '../services/warmup-agent';
import { getAccounts } from '../services/account-tier';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function phaseBadgeClass(phase: WarmupSchedule['phase']) {
  if (phase === 'phase1') return 'border-blue-400/40 bg-blue-400/10 text-blue-300';
  if (phase === 'phase2') return 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300';
  return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
}

function phaseLabel(phase: WarmupSchedule['phase']) {
  if (phase === 'phase1') return 'Phase 1';
  if (phase === 'phase2') return 'Phase 2';
  return 'Phase 3';
}

function minutesUntilReady(nextActionAt: string): number {
  const diff = new Date(nextActionAt).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 60000) : 0;
}

function activityBarColor(made: number, allowed: number) {
  if (allowed === 0) return 'bg-slate-600';
  const pct = made / allowed;
  if (pct < 0.5) return 'bg-emerald-400';
  if (pct < 0.8) return 'bg-amber-400';
  return 'bg-red-400';
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE CARD
// ═══════════════════════════════════════════════════════════════

function ScheduleCard({
  schedule,
  onUpdate,
  onDelete,
}: {
  schedule: WarmupSchedule;
  onUpdate: (s: WarmupSchedule) => void;
  onDelete: () => void;
}) {
  const waitMin = minutesUntilReady(schedule.nextActionAt);
  const isReady = waitMin === 0;
  const dayPct = Math.min(100, Math.round((schedule.day / 90) * 100));

  function handleAction(action: 'list' | 'search' | 'view') {
    const { safe, reason } = isActionSafe(schedule, action);
    if (!safe) {
      alert(reason);
      return;
    }
    onUpdate(recordAction(schedule, action));
  }

  function handleAdvanceDay() {
    onUpdate(advanceDay(schedule));
  }

  const recentNotes = schedule.notes.slice(0, 3);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-100 font-mono">{schedule.accountId}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${phaseBadgeClass(schedule.phase)}`}>
            {phaseLabel(schedule.phase)}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg border border-red-400/20 bg-red-400/5 text-red-500 hover:text-red-300 hover:bg-red-400/10 transition flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Day progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Warmup Progress</span>
          <span className="text-[11px] font-semibold text-slate-200">Day {schedule.day} / 90</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${dayPct}%` }}
          />
        </div>
        <div className="mt-1 text-[9px] text-slate-600">{dayPct}% complete</div>
      </div>

      {/* Today's activity */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-2">Today's Activity</div>
        <div className="grid grid-cols-3 gap-2">
          {/* Listings */}
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Listings</div>
            <div className="text-[11px] font-semibold text-slate-200">
              {schedule.listingsMadeToday}<span className="text-slate-600">/{schedule.listingsAllowedToday}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${activityBarColor(schedule.listingsMadeToday, schedule.listingsAllowedToday)}`}
                style={{ width: schedule.listingsAllowedToday > 0 ? `${Math.min(100, (schedule.listingsMadeToday / schedule.listingsAllowedToday) * 100)}%` : '0%' }}
              />
            </div>
          </div>
          {/* Searches */}
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Searches</div>
            <div className="text-[11px] font-semibold text-slate-200">
              {schedule.searchesMadeToday}<span className="text-slate-600">/{schedule.searchesAllowedToday}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${activityBarColor(schedule.searchesMadeToday, schedule.searchesAllowedToday)}`}
                style={{ width: schedule.searchesAllowedToday > 0 ? `${Math.min(100, (schedule.searchesMadeToday / schedule.searchesAllowedToday) * 100)}%` : '0%' }}
              />
            </div>
          </div>
          {/* Views */}
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Views</div>
            <div className="text-[11px] font-semibold text-slate-200">
              {schedule.viewsMadeToday}<span className="text-slate-600">/{schedule.viewsAllowedToday}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${activityBarColor(schedule.viewsMadeToday, schedule.viewsAllowedToday)}`}
                style={{ width: schedule.viewsAllowedToday > 0 ? `${Math.min(100, (schedule.viewsMadeToday / schedule.viewsAllowedToday) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Next action status */}
      <div className="flex items-center gap-2">
        {isReady ? (
          <>
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-[11px] font-medium text-emerald-400">Ready</span>
          </>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] font-medium text-amber-400">Wait {waitMin}min</span>
          </>
        )}
        <span className="text-[9px] text-slate-600 ml-auto">
          Last: {schedule.lastActionAt ? new Date(schedule.lastActionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      </div>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div className="rounded-lg border border-white/[0.05] bg-slate-900/60 p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-1.5">Recent Activity</div>
          {recentNotes.map((note, i) => (
            <div key={i} className="text-[9px] font-mono text-slate-500 leading-relaxed truncate">{note}</div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction('list')}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-2 py-2 text-[10px] font-medium text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-40"
          disabled={!isReady || schedule.listingsMadeToday >= schedule.listingsAllowedToday}
        >
          📝 Log Listing
        </button>
        <button
          onClick={() => handleAction('search')}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl border border-blue-400/30 bg-blue-400/10 px-2 py-2 text-[10px] font-medium text-blue-300 hover:bg-blue-400/20 transition disabled:opacity-40"
          disabled={!isReady || schedule.searchesMadeToday >= schedule.searchesAllowedToday}
        >
          🔍 Log Search
        </button>
        <button
          onClick={() => handleAction('view')}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-400/10 px-2 py-2 text-[10px] font-medium text-violet-300 hover:bg-violet-400/20 transition disabled:opacity-40"
          disabled={!isReady || schedule.viewsMadeToday >= schedule.viewsAllowedToday}
        >
          👁 Log View
        </button>
      </div>

      {/* Advance day + remove row */}
      <div className="flex gap-2">
        <button
          onClick={handleAdvanceDay}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-medium text-emerald-300 hover:bg-emerald-400/20 transition"
        >
          ⏭ Advance Day
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADD MODAL
// ═══════════════════════════════════════════════════════════════

function AddModal({
  onClose,
  onAdd,
  existingIds,
}: {
  onClose: () => void;
  onAdd: (s: WarmupSchedule) => void;
  existingIds: string[];
}) {
  const [accountId, setAccountId] = useState('');
  const [startDay, setStartDay] = useState(1);
  const [knownAccounts, setKnownAccounts] = useState<string[]>([]);

  useEffect(() => {
    getAccounts().then(accounts => {
      setKnownAccounts(accounts.map(a => a.id));
    });
  }, []);

  function handleCreate() {
    const id = accountId.trim();
    if (!id) return;
    if (existingIds.includes(id)) {
      alert('A warmup schedule for this account already exists.');
      return;
    }
    const day = Math.max(1, startDay);
    const limits = getWarmupLimits(day);
    let phase: WarmupSchedule['phase'];
    if (day <= 30) phase = 'phase1';
    else if (day <= 60) phase = 'phase2';
    else phase = 'phase3';

    const now = new Date().toISOString();
    const schedule: WarmupSchedule = {
      accountId: id,
      day,
      phase,
      listingsAllowedToday: limits.listings,
      listingsMadeToday: 0,
      searchesAllowedToday: limits.searches,
      searchesMadeToday: 0,
      viewsAllowedToday: limits.views,
      viewsMadeToday: 0,
      lastActionAt: now,
      nextActionAt: now,
      notes: [`[${now}] Warmup schedule created — starting day ${day}`],
    };
    onAdd(schedule);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-80 rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100">Add Account to Warmup</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition text-lg leading-none"
          >×</button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Account ID */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Account ID</label>
            {knownAccounts.length > 0 ? (
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400/50"
              >
                <option value="">— select account —</option>
                {knownAccounts.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                placeholder="e.g. acc_abc123"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400/50 placeholder:text-slate-600"
              />
            )}
          </div>

          {/* Starting day */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Starting Day</label>
            <input
              type="number"
              value={startDay}
              onChange={e => setStartDay(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={90}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400/50"
            />
            <div className="mt-1 text-[9px] text-slate-600">
              Day {startDay} limits: {getWarmupLimits(startDay).listings} listings / {getWarmupLimits(startDay).searches} searches / {getWarmupLimits(startDay).views} views
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!accountId.trim()}
            className="flex-1 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 transition disabled:opacity-40"
          >
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export function WarmupAgent({ onBack }: { onBack: () => void }) {
  const [schedules, setSchedules] = useState<WarmupSchedule[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getWarmupSchedules().then(setSchedules);
  }, []);

  async function handleUpdate(updated: WarmupSchedule) {
    await saveWarmupSchedule(updated);
    setSchedules(prev => prev.map(s => s.accountId === updated.accountId ? updated : s));
  }

  async function handleDelete(accountId: string) {
    if (!confirm(`Remove warmup schedule for "${accountId}"?`)) return;
    await deleteWarmupSchedule(accountId);
    setSchedules(prev => prev.filter(s => s.accountId !== accountId));
  }

  async function handleAdd(schedule: WarmupSchedule) {
    await saveWarmupSchedule(schedule);
    setSchedules(prev => [...prev, schedule]);
    setShowModal(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TrendingUp className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">Warmup Agent</h2>
          {schedules.length > 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-medium text-emerald-300">
              {schedules.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-400/20 transition flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 [scrollbar-color:rgba(52,211,153,0.4)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06]">
              <TrendingUp className="h-6 w-6 text-emerald-400/60" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">No warmup schedules yet</p>
              <p className="text-[11px] text-slate-600 mt-1">Add an eBay account to start safe warmup tracking</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Account to Warmup
            </button>
          </div>
        ) : (
          schedules.map(schedule => (
            <ScheduleCard
              key={schedule.accountId}
              schedule={schedule}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(schedule.accountId)}
            />
          ))
        )}
        <div className="h-4" />
      </div>

      {/* Add Modal */}
      {showModal && (
        <AddModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
          existingIds={schedules.map(s => s.accountId)}
        />
      )}
    </div>
  );
}

export default WarmupAgent;
