/**
 * InventoryLifecycle.tsx — 90-Day Inventory Lifecycle Manager
 * Age tracking, markdown triggers, snooze controls, clearance automation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Clock, Play, CheckCircle, AlertTriangle,
  XCircle, Eye, EyeOff, ArrowRight, RefreshCw,
} from 'lucide-react';
import {
  runLifecycleScan,
  getLifecycleOverrides,
  setLifecycleOverride,
  clearOverride,
  applyLifecyclePriceUpdate,
  getRecommendedPrice,
  LifecycleItem,
  LifecycleStage,
} from '../services/inventory-lifecycle';
import { storage } from '../services/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageFilter = 'all' | LifecycleStage['stage'];

interface ScanSummary {
  fresh: number;
  active: number;
  aging: number;
  stale: number;
  clearance: number;
  dead: number;
  totalActionNeeded: number;
  estimatedRevenueLoss: number;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<
  LifecycleStage['stage'],
  { label: string; color: string; bg: string; border: string; pill: string }
> = {
  fresh:     { label: 'Fresh',     color: 'text-slate-300',  bg: 'bg-slate-400/10',  border: 'border-slate-400/30',  pill: 'border-slate-400/40 bg-slate-400/10 text-slate-300' },
  active:    { label: 'Active',    color: 'text-emerald-300', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', pill: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
  aging:     { label: 'Aging',     color: 'text-amber-300',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30',  pill: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  stale:     { label: 'Stale',     color: 'text-orange-300', bg: 'bg-orange-400/10', border: 'border-orange-400/30', pill: 'border-orange-400/40 bg-orange-400/10 text-orange-300' },
  clearance: { label: 'Clearance', color: 'text-red-300',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    pill: 'border-red-400/40 bg-red-400/10 text-red-300' },
  dead:      { label: 'Dead',      color: 'text-slate-500',  bg: 'bg-slate-700/20',  border: 'border-slate-600/30',  pill: 'border-slate-600/40 bg-slate-700/20 text-slate-500' },
};

const URGENCY_COLOR: Record<LifecycleStage['urgency'], string> = {
  none:     'text-slate-500',
  low:      'text-blue-300',
  medium:   'text-amber-300',
  high:     'text-orange-400',
  critical: 'text-red-400',
};

const ACTION_CONFIG: Record<
  LifecycleStage['recommendedAction'],
  { label: string; color: string }
> = {
  hold:        { label: 'Hold',       color: 'border-slate-400/30 bg-slate-400/10 text-slate-400' },
  markdown_5:  { label: '-5%',        color: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  markdown_10: { label: '-10%',       color: 'border-orange-400/40 bg-orange-400/10 text-orange-300' },
  markdown_20: { label: '-20%',       color: 'border-red-400/40 bg-red-400/10 text-red-300' },
  end_listing: { label: 'End',        color: 'border-red-500/50 bg-red-500/15 text-red-200' },
  relist:      { label: 'Relist',     color: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StagePill({
  stage,
  count,
  active,
  onClick,
}: {
  stage: LifecycleStage['stage'];
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl border px-2 py-1.5 text-center transition ${
        active
          ? `${cfg.border} ${cfg.bg} ${cfg.color} shadow-sm`
          : 'border-white/[0.06] bg-white/[0.02] text-slate-600 hover:border-white/10 hover:text-slate-400'
      }`}
    >
      <span className="text-sm font-semibold leading-none">{count}</span>
      <span className="mt-0.5 text-[9px] tracking-wide">{cfg.label}</span>
    </button>
  );
}

function ActionBadge({ action }: { action: LifecycleStage['recommendedAction'] }) {
  const cfg = ACTION_CONFIG[action];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: LifecycleStage['stage'] }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium tracking-wide ${cfg.pill}`}>
      {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function InventoryLifecycle({ onBack }: Props) {
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<LifecycleItem[]>([]);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [hasScanned, setHasScanned] = useState(false);

  // Load existing overrides on mount
  useEffect(() => {
    getLifecycleOverrides().then(overrides => {
      const now = new Date();
      const active = new Set<string>();
      overrides.forEach((override, id) => {
        if (new Date(override.snoozedUntil) > now) {
          active.add(id);
        }
      });
      setSnoozedIds(active);
    });
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const inventory = await storage.getInventory();
      const result = runLifecycleScan(inventory);
      setItems(result.items);
      setSummary(result.summary);
      setHasScanned(true);
    } catch (err) {
      console.error('[InventoryLifecycle] Scan failed:', err);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSnooze = useCallback(async (listingId: string) => {
    const snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await setLifecycleOverride(listingId, { snoozedUntil });
    setSnoozedIds(prev => new Set([...prev, listingId]));
  }, []);

  const handleUnsnooze = useCallback(async (listingId: string) => {
    await clearOverride(listingId);
    setSnoozedIds(prev => {
      const next = new Set(prev);
      next.delete(listingId);
      return next;
    });
  }, []);

  const handleApply = useCallback(async (item: LifecycleItem) => {
    const newPrice = getRecommendedPrice(
      item.currentPrice,
      item.stage.recommendedAction,
      item.supplierPrice
    );
    await applyLifecyclePriceUpdate(item.listingId, newPrice);
    setAppliedIds(prev => new Set([...prev, item.listingId]));
  }, []);

  // Filter items
  const filteredItems = items.filter(item => {
    const isSnoozed = snoozedIds.has(item.listingId);
    if (isSnoozed && !showSnoozed) return false;
    if (stageFilter !== 'all' && item.stage.stage !== stageFilter) return false;
    return true;
  });

  const stages: LifecycleStage['stage'][] = ['fresh', 'active', 'aging', 'stale', 'clearance', 'dead'];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">Inventory Lifecycle</h2>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
        >
          {scanning ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {scanning ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.3)_transparent]">

        {/* Empty state */}
        {!hasScanned && !scanning && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-lg shadow-amber-500/20">
              <Clock className="h-8 w-8 text-amber-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-200">90-Day Lifecycle Engine</p>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-5">
                Run a scan to analyze your inventory lifecycle
              </p>
            </div>
          </div>
        )}

        {/* Scanning state */}
        {scanning && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-xs text-slate-400">Analyzing inventory age…</p>
          </div>
        )}

        {/* Results */}
        {hasScanned && !scanning && summary && (
          <div className="space-y-3 p-4">

            {/* Summary bar */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Stage Breakdown</p>
                <div className="flex items-center gap-2">
                  {summary.totalActionNeeded > 0 && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
                      {summary.totalActionNeeded} need action
                    </span>
                  )}
                  {summary.estimatedRevenueLoss > 0 && (
                    <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[9px] text-red-400">
                      −${summary.estimatedRevenueLoss.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {stages.map(s => (
                  <StagePill
                    key={s}
                    stage={s}
                    count={summary[s]}
                    active={stageFilter === s}
                    onClick={() => setStageFilter(stageFilter === s ? 'all' : s)}
                  />
                ))}
              </div>
              {stageFilter !== 'all' && (
                <button
                  onClick={() => setStageFilter('all')}
                  className="mt-2 text-[10px] text-slate-600 hover:text-slate-400 transition"
                >
                  ← Show all stages
                </button>
              )}
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-slate-600">
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                {stageFilter !== 'all' ? ` · ${STAGE_CONFIG[stageFilter].label}` : ''}
              </p>
              <button
                onClick={() => setShowSnoozed(v => !v)}
                className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition"
              >
                {showSnoozed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {showSnoozed ? 'Hide Snoozed' : 'Show Snoozed'}
              </button>
            </div>

            {/* Items table */}
            <div className="space-y-2">
              {filteredItems.length === 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-8 text-center">
                  <p className="text-[11px] text-slate-600">No items in this stage</p>
                </div>
              )}

              {filteredItems.map(item => {
                const isSnoozed = snoozedIds.has(item.listingId);
                const isApplied = appliedIds.has(item.listingId);
                const recommendedPrice = getRecommendedPrice(
                  item.currentPrice,
                  item.stage.recommendedAction,
                  item.supplierPrice
                );
                const priceDelta = item.currentPrice - recommendedPrice;
                const canApply = item.stage.recommendedAction !== 'hold' &&
                  item.stage.recommendedAction !== 'end_listing' &&
                  item.stage.recommendedAction !== 'relist' &&
                  !isApplied;

                return (
                  <div
                    key={item.listingId}
                    className={`rounded-xl border bg-white/[0.025] p-3 transition ${
                      isSnoozed
                        ? 'border-white/[0.04] opacity-50'
                        : item.stage.urgency === 'critical'
                        ? 'border-red-400/20'
                        : item.stage.urgency === 'high'
                        ? 'border-orange-400/15'
                        : 'border-white/[0.07]'
                    }`}
                  >
                    {/* Row 1: Title + Stage + Age */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-slate-200 leading-5" title={item.title}>
                          {item.title.length > 35 ? item.title.slice(0, 35) + '…' : item.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <StageBadge stage={item.stage.stage} />
                          <span className={`text-[10px] font-semibold ${URGENCY_COLOR[item.stage.urgency]}`}>
                            {item.ageDays}d
                          </span>
                          {item.stage.nextStageAt < 999 && (
                            <span className="text-[9px] text-slate-600">
                              → next in {item.stage.nextStageAt - item.ageDays}d
                            </span>
                          )}
                        </div>
                      </div>
                      <ActionBadge action={item.stage.recommendedAction} />
                    </div>

                    {/* Row 2: Price + Profit */}
                    <div className="flex items-center gap-3 mb-2.5">
                      {/* Price arrow */}
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[11px] text-slate-300 font-medium">
                          ${item.currentPrice.toFixed(2)}
                        </span>
                        {item.stage.recommendedAction !== 'hold' && recommendedPrice > 0 && (
                          <>
                            <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
                            <span className={`text-[11px] font-semibold ${
                              priceDelta > 0 ? 'text-red-300' : 'text-slate-300'
                            }`}>
                              ${recommendedPrice.toFixed(2)}
                            </span>
                            {priceDelta > 0 && (
                              <span className="text-[9px] text-red-400">
                                −${priceDelta.toFixed(2)}
                              </span>
                            )}
                          </>
                        )}
                        {item.stage.recommendedAction === 'end_listing' && (
                          <>
                            <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
                            <span className="text-[11px] text-red-400 font-semibold">End</span>
                          </>
                        )}
                      </div>

                      {/* Profit */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-600">Now</span>
                          <span className={`text-[10px] font-medium ${
                            item.profitAtCurrentPrice > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            ${item.profitAtCurrentPrice.toFixed(2)}
                          </span>
                          {item.stage.recommendedAction !== 'hold' && (
                            <>
                              <span className="text-[9px] text-slate-600">→</span>
                              <span className={`text-[10px] font-medium ${
                                item.profitAtRecommendedPrice > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                ${item.profitAtRecommendedPrice.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Action buttons */}
                    <div className="flex items-center gap-2">
                      {canApply && (
                        <button
                          onClick={() => handleApply(item)}
                          className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Apply
                        </button>
                      )}
                      {isApplied && (
                        <span className="flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
                          <CheckCircle className="h-3 w-3" />
                          Applied
                        </span>
                      )}
                      {item.stage.recommendedAction === 'end_listing' && (
                        <span className="flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[10px] text-red-300">
                          <XCircle className="h-3 w-3" />
                          End Listing
                        </span>
                      )}
                      {item.stage.recommendedAction === 'relist' && (
                        <span className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-300">
                          <RefreshCw className="h-3 w-3" />
                          Relist
                        </span>
                      )}

                      <div className="flex-1" />

                      {isSnoozed ? (
                        <button
                          onClick={() => handleUnsnooze(item.listingId)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-500 transition hover:text-slate-300"
                        >
                          <Eye className="h-3 w-3" />
                          Unsnooze
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSnooze(item.listingId)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-500 transition hover:text-slate-300"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Snooze 7d
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom padding */}
            <div className="h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
