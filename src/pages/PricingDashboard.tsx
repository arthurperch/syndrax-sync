/**
 * Pricing Strategy Dashboard
 * Two-column layout: Rules Editor (left) + Analysis Results (right)
 * Dynamic pricing rules engine with condition/action matching.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, ChevronUp, ChevronDown,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Download, RefreshCw, ToggleLeft, ToggleRight, Loader,
} from 'lucide-react';
import {
  PricingRule, PricingCondition, PricingAction,
  PricingAnalysisSummary, ConditionField, ActionType,
  loadRules, saveRules, createRule, analyzePricing,
  validateRule, formatActionSummary, formatConditionSummary,
} from '../services/pricing-strategy';
import { storage } from '../services/storage';
import type { InventoryItem } from '../services/storage';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'supplier_price', label: 'Supplier Price ($)' },
  { value: 'margin',         label: 'Current Margin (%)' },
  { value: 'category',       label: 'Title Contains' },
  { value: 'age_days',       label: 'Listing Age (days)' },
  { value: 'stock_level',    label: 'Stock Level' },
];

const ACTION_TYPES: { value: ActionType; label: string; hint: string }[] = [
  { value: 'markup',               label: 'Markup (×)',         hint: 'e.g. 1.5 = 50% over cost' },
  { value: 'margin',               label: 'Target Margin (%)',  hint: 'e.g. 0.30 = 30% margin' },
  { value: 'fixed_price',          label: 'Fixed Price ($)',    hint: 'e.g. 29.99' },
  { value: 'percentage_reduction', label: 'Price Reduction (%)', hint: 'e.g. 0.10 = 10% off' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, onBack, badge }: { title: string; onBack: () => void; badge?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 shrink-0">
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-amber-300/40 hover:text-amber-200"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 className="flex-1 text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
      {badge && (
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule, index, total,
  onEdit, onDelete, onToggle, onMoveUp, onMoveDown,
}: {
  rule: PricingRule;
  index: number;
  total: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${
      rule.enabled
        ? 'border-amber-400/25 bg-amber-400/[0.04]'
        : 'border-white/[0.06] bg-white/[0.02] opacity-60'
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        {/* Priority badge */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-[9px] font-bold text-amber-300">
          {rule.priority}
        </span>
        {/* Name */}
        <p className="flex-1 min-w-0 truncate text-[12px] font-semibold text-slate-200">{rule.name}</p>
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`shrink-0 transition ${rule.enabled ? 'text-amber-400' : 'text-slate-600'}`}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled
            ? <ToggleRight className="h-4 w-4" />
            : <ToggleLeft className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Condition + Action summary */}
      <p className="text-[10px] text-slate-500 mb-0.5">
        <span className="text-slate-600">IF </span>
        <span className="text-slate-400">{formatConditionSummary(rule.conditions)}</span>
      </p>
      <p className="text-[10px] text-slate-500 mb-2">
        <span className="text-slate-600">THEN </span>
        <span className="text-amber-300/80">{formatActionSummary(rule.action)}</span>
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 transition hover:border-amber-400/30 hover:text-amber-300"
        >
          <Edit3 className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 transition hover:border-red-400/30 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <div className="ml-auto flex gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-500 transition hover:text-slate-300 disabled:opacity-30"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-500 transition hover:text-slate-300 disabled:opacity-30"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Condition Builder Row ────────────────────────────────────────────────────

function ConditionRow({
  condition, index, onChange, onRemove,
}: {
  condition: PricingCondition;
  index: number;
  onChange: (c: PricingCondition) => void;
  onRemove: () => void;
}) {
  const inputCls = "rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-amber-400/40 w-full";

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={condition.field}
          onChange={e => onChange({ field: e.target.value as ConditionField })}
          className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-amber-400/40"
        >
          {CONDITION_FIELDS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-500 hover:text-red-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Field-specific inputs */}
      {(condition.field === 'supplier_price' || condition.field === 'margin' || condition.field === 'age_days') && (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <p className="text-[9px] text-slate-600 mb-0.5">Min</p>
            <input
              type="number"
              placeholder="–"
              value={condition.min ?? ''}
              onChange={e => onChange({ ...condition, min: e.target.value ? Number(e.target.value) : undefined })}
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-[9px] text-slate-600 mb-0.5">Max</p>
            <input
              type="number"
              placeholder="–"
              value={condition.max ?? ''}
              onChange={e => onChange({ ...condition, max: e.target.value ? Number(e.target.value) : undefined })}
              className={inputCls}
            />
          </div>
        </div>
      )}

      {condition.field === 'category' && (
        <input
          type="text"
          placeholder="e.g. laptop, phone, cable…"
          value={condition.value ?? ''}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          className={inputCls}
        />
      )}

      {condition.field === 'stock_level' && (
        <select
          value={condition.stockLevel ?? 'in_stock'}
          onChange={e => onChange({ ...condition, stockLevel: e.target.value as 'in_stock' | 'low_stock' | 'out_of_stock' })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-amber-400/40"
        >
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      )}
    </div>
  );
}

// ─── Rule Editor Modal ────────────────────────────────────────────────────────

function RuleEditorModal({
  rule, onSave, onCancel,
}: {
  rule: PricingRule;
  onSave: (r: PricingRule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PricingRule>({ ...rule, conditions: [...rule.conditions] });
  const [errors, setErrors] = useState<string[]>([]);

  const updateAction = (updates: Partial<PricingAction>) => {
    setDraft(d => ({ ...d, action: { ...d.action, ...updates } }));
  };

  const addCondition = () => {
    setDraft(d => ({
      ...d,
      conditions: [...d.conditions, { field: 'supplier_price' as ConditionField }],
    }));
  };

  const updateCondition = (index: number, c: PricingCondition) => {
    setDraft(d => {
      const conditions = [...d.conditions];
      conditions[index] = c;
      return { ...d, conditions };
    });
  };

  const removeCondition = (index: number) => {
    setDraft(d => ({
      ...d,
      conditions: d.conditions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    const errs = validateRule(draft);
    if (errs.length > 0) {
      setErrors(errs.map(e => e.message));
      return;
    }
    onSave({ ...draft, updatedAt: Date.now() });
  };

  const actionInfo = ACTION_TYPES.find(a => a.value === draft.action.type);

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-slate-950/90 backdrop-blur-sm overflow-y-auto py-4">
      <div className="w-full max-w-[380px] mx-4 rounded-2xl border border-amber-400/25 bg-slate-900 shadow-2xl shadow-amber-500/10">
        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <h3 className="flex-1 text-sm font-semibold text-slate-100">
            {rule.id === draft.id && rule.name === 'New Rule' ? 'New Rule' : `Edit: ${rule.name}`}
          </h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          {/* Name + Priority */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <p className="text-[10px] text-slate-500 mb-1">Rule Name</p>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. High Margin Markup"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-amber-400/40"
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Priority</p>
              <input
                type="number"
                min={1}
                max={99}
                value={draft.priority}
                onChange={e => setDraft(d => ({ ...d, priority: Number(e.target.value) || 1 }))}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-400/40"
              />
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
            <p className="text-xs text-slate-400">Rule Enabled</p>
            <button
              onClick={() => setDraft(d => ({ ...d, enabled: !d.enabled }))}
              className={`transition ${draft.enabled ? 'text-amber-400' : 'text-slate-600'}`}
            >
              {draft.enabled
                ? <ToggleRight className="h-5 w-5" />
                : <ToggleLeft className="h-5 w-5" />
              }
            </button>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Conditions (AND)</p>
              <button
                onClick={addCondition}
                className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-400/20 transition"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {draft.conditions.length === 0 && (
              <p className="text-[11px] text-slate-600 text-center py-2 rounded-xl border border-dashed border-white/10">
                No conditions — matches all items
              </p>
            )}
            <div className="space-y-2">
              {draft.conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  condition={c}
                  index={i}
                  onChange={updated => updateCondition(i, updated)}
                  onRemove={() => removeCondition(i)}
                />
              ))}
            </div>
          </div>

          {/* Action */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-2">Action</p>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
              <select
                value={draft.action.type}
                onChange={e => updateAction({ type: e.target.value as ActionType, value: draft.action.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-400/40"
              >
                {ACTION_TYPES.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div>
                <input
                  type="number"
                  step="0.01"
                  value={draft.action.value}
                  onChange={e => updateAction({ value: Number(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-400/40"
                />
                {actionInfo && (
                  <p className="text-[10px] text-slate-600 mt-1">{actionInfo.hint}</p>
                )}
              </div>
              {/* Live preview */}
              <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-2 py-1.5">
                <p className="text-[10px] text-amber-300/70">
                  → {formatActionSummary(draft.action)}
                </p>
              </div>
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20"
            >
              <Save className="h-3.5 w-3.5" /> Save Rule
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Result Row ──────────────────────────────────────────────────────

function AnalysisRow({ result }: { result: import('../services/pricing-strategy').PricingAnalysisResult }) {
  const { item, originalPrice, calculatedPrice, changePercent, appliedRule, currentMargin, projectedMargin } = result;
  const isIncrease = changePercent > 0.01;
  const isDecrease = changePercent < -0.01;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 space-y-1.5">
      {/* Title */}
      <p className="text-[11px] text-slate-300 truncate leading-4">{item.title || 'Untitled'}</p>

      {/* Price row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-500">
          ${originalPrice.toFixed(2)}
        </span>
        <span className="text-[10px] text-slate-600">→</span>
        <span className={`text-[11px] font-semibold ${
          isIncrease ? 'text-emerald-400' : isDecrease ? 'text-red-400' : 'text-slate-400'
        }`}>
          ${calculatedPrice.toFixed(2)}
        </span>
        {(isIncrease || isDecrease) && (
          <span className={`flex items-center gap-0.5 text-[10px] ${isIncrease ? 'text-emerald-400' : 'text-red-400'}`}>
            {isIncrease ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
        {!isIncrease && !isDecrease && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
            <Minus className="h-3 w-3" /> No change
          </span>
        )}
      </div>

      {/* Margin + Rule */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-600">
          Margin: <span className="text-slate-400">{currentMargin.toFixed(1)}%</span>
          {appliedRule && projectedMargin !== currentMargin && (
            <> → <span className={projectedMargin > currentMargin ? 'text-emerald-400' : 'text-amber-400'}>
              {projectedMargin.toFixed(1)}%
            </span></>
          )}
        </span>
        {appliedRule ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-300 truncate max-w-[120px]">
            {appliedRule.name}
          </span>
        ) : (
          <span className="text-[9px] text-slate-600">No rule</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PricingDashboard({ onBack }: Props) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<PricingAnalysisSummary | null>(null);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [sortBy, setSortBy] = useState<'change' | 'margin' | 'price'>('change');

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [loadedRules, loadedInventory] = await Promise.all([
        loadRules(),
        storage.getInventory(),
      ]);
      setRules(loadedRules);
      setInventory(loadedInventory);
      setLoading(false);
    }
    load();
  }, []);

  // ── Re-analyze whenever rules or inventory change ──────────────────────────

  useEffect(() => {
    if (inventory.length > 0) {
      const result = analyzePricing(inventory, rules);
      setSummary(result);
    } else {
      setSummary(null);
    }
  }, [rules, inventory]);

  // ── Rule operations ────────────────────────────────────────────────────────

  const handleSaveRules = useCallback(async (newRules: PricingRule[]) => {
    setSaving(true);
    await saveRules(newRules);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleAddRule = () => {
    const maxPriority = rules.length > 0 ? Math.max(...rules.map(r => r.priority)) : 0;
    const newRule = createRule({ priority: maxPriority + 10 });
    setEditingRule(newRule);
  };

  const handleSaveRule = async (rule: PricingRule) => {
    const isNew = !rules.find(r => r.id === rule.id);
    const newRules = isNew
      ? [...rules, rule]
      : rules.map(r => r.id === rule.id ? rule : r);
    setRules(newRules);
    setEditingRule(null);
    await handleSaveRules(newRules);
  };

  const handleDeleteRule = async (id: string) => {
    const newRules = rules.filter(r => r.id !== id);
    setRules(newRules);
    await handleSaveRules(newRules);
  };

  const handleToggleRule = async (id: string) => {
    const newRules = rules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r
    );
    setRules(newRules);
    await handleSaveRules(newRules);
  };

  const handleMoveRule = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    // Swap priorities
    const newRules = rules.map(r => {
      if (r.id === sorted[index].id) return { ...r, priority: sorted[swapIndex].priority };
      if (r.id === sorted[swapIndex].id) return { ...r, priority: sorted[index].priority };
      return r;
    });
    setRules(newRules);
    await handleSaveRules(newRules);
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!summary) return;
    const rows = [
      ['Title', 'ASIN', 'Supplier Price', 'Current eBay Price', 'Calculated Price', 'Change %', 'Current Margin %', 'Projected Margin %', 'Applied Rule'],
      ...summary.results.map(r => [
        `"${(r.item.title || '').replace(/"/g, '""')}"`,
        r.item.asin || '',
        r.item.supplierPrice?.toFixed(2) || '0',
        r.originalPrice.toFixed(2),
        r.calculatedPrice.toFixed(2),
        r.changePercent.toFixed(2),
        r.currentMargin.toFixed(2),
        r.projectedMargin.toFixed(2),
        r.appliedRule ? `"${r.appliedRule.name}"` : '',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtered + sorted results ──────────────────────────────────────────────

  const filteredResults = (summary?.results || [])
    .filter(r => {
      if (analysisFilter === 'matched') return r.appliedRule !== null;
      if (analysisFilter === 'unmatched') return r.appliedRule === null;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'change') return Math.abs(b.changePercent) - Math.abs(a.changePercent);
      if (sortBy === 'margin') return b.currentMargin - a.currentMargin;
      if (sortBy === 'price') return b.originalPrice - a.originalPrice;
      return 0;
    });

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <SectionHeader title="Pricing Strategy" onBack={onBack} badge="Phase 9" />
        <div className="flex flex-1 items-center justify-center gap-3">
          <Loader className="h-5 w-5 animate-spin text-amber-400" />
          <p className="text-sm text-slate-500">Loading rules & inventory…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col relative">
      <SectionHeader title="Pricing Strategy" onBack={onBack} badge="Phase 9" />

      {/* Rule editor modal */}
      {editingRule && (
        <RuleEditorModal
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
        />
      )}

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Column: Rules Editor ── */}
        <div className="flex w-[195px] shrink-0 flex-col border-r border-white/[0.07]">
          {/* Column header */}
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2 shrink-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Rules</p>
            <div className="flex items-center gap-1.5">
              {saving && <Loader className="h-3 w-3 animate-spin text-amber-400" />}
              {saved && !saving && <CheckCircle className="h-3 w-3 text-emerald-400" />}
              <span className="text-[10px] text-slate-600">{rules.length}</span>
            </div>
          </div>

          {/* Rules list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.2)_transparent]">
            {rules.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <div className="h-10 w-10 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-400/50" />
                </div>
                <p className="text-[11px] text-slate-600">No rules yet</p>
                <p className="text-[10px] text-slate-700">Add a rule to start</p>
              </div>
            )}
            {sortedRules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={index}
                total={sortedRules.length}
                onEdit={() => setEditingRule(rule)}
                onDelete={() => handleDeleteRule(rule.id)}
                onToggle={() => handleToggleRule(rule.id)}
                onMoveUp={() => handleMoveRule(index, 'up')}
                onMoveDown={() => handleMoveRule(index, 'down')}
              />
            ))}
          </div>

          {/* Add rule button */}
          <div className="border-t border-white/[0.07] p-2 shrink-0">
            <button
              onClick={handleAddRule}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 py-2 text-[11px] font-medium text-amber-300 transition hover:bg-amber-400/20"
            >
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </button>
          </div>
        </div>

        {/* ── Right Column: Analysis Results ── */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Column header */}
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2 shrink-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Analysis</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={exportCSV}
                disabled={!summary || summary.totalItems === 0}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-500 transition hover:text-slate-300 disabled:opacity-30"
                title="Export CSV"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                onClick={() => storage.getInventory().then(inv => setInventory(inv))}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-500 transition hover:text-slate-300"
                title="Refresh inventory"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          {summary && summary.totalItems > 0 && (
            <div className="grid grid-cols-3 gap-1.5 px-2 py-2 shrink-0 border-b border-white/[0.07]">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5 text-center">
                <p className="text-[12px] font-semibold text-slate-200">{summary.totalItems}</p>
                <p className="text-[9px] text-slate-600">Items</p>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-1.5 text-center">
                <p className="text-[12px] font-semibold text-amber-300">{summary.itemsWithRules}</p>
                <p className="text-[9px] text-slate-600">Matched</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-1.5 text-center">
                <p className="text-[12px] font-semibold text-slate-400">{summary.avgProjectedMargin.toFixed(1)}%</p>
                <p className="text-[9px] text-slate-600">Avg Margin</p>
              </div>
            </div>
          )}

          {/* Filter + Sort controls */}
          {summary && summary.totalItems > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0 border-b border-white/[0.07]">
              {(['all', 'matched', 'unmatched'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setAnalysisFilter(f)}
                  className={`rounded-lg border px-2 py-0.5 text-[9px] font-medium tracking-wide transition capitalize ${
                    analysisFilter === f
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                      : 'border-white/10 bg-white/[0.02] text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {f}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[9px] text-slate-700">Sort:</span>
                {(['change', 'margin', 'price'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`rounded-lg border px-1.5 py-0.5 text-[9px] transition capitalize ${
                      sortBy === s
                        ? 'border-slate-500/40 bg-slate-500/10 text-slate-300'
                        : 'border-white/10 text-slate-700 hover:text-slate-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.2)_transparent]">
            {/* Empty: no inventory */}
            {(!summary || summary.totalItems === 0) && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-12 w-12 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-amber-400/30" />
                </div>
                <div>
                  <p className="text-[12px] text-slate-500">No inventory loaded</p>
                  <p className="text-[10px] text-slate-700 mt-1">Scan eBay listings first</p>
                </div>
              </div>
            )}

            {/* Results */}
            {filteredResults.slice(0, 50).map((result, i) => (
              <AnalysisRow key={result.item.listingId || i} result={result} />
            ))}

            {filteredResults.length > 50 && (
              <p className="text-center text-[10px] text-slate-600 py-2">
                Showing 50 of {filteredResults.length} items
              </p>
            )}

            {/* No results after filter */}
            {summary && summary.totalItems > 0 && filteredResults.length === 0 && (
              <p className="text-center text-[11px] text-slate-600 py-6">
                No items match this filter
              </p>
            )}
          </div>

          {/* Price change summary footer */}
          {summary && summary.totalItems > 0 && (
            <div className="border-t border-white/[0.07] px-3 py-2 shrink-0 flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <TrendingUp className="h-3 w-3" /> {summary.totalPriceIncrease} up
              </span>
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <TrendingDown className="h-3 w-3" /> {summary.totalPriceDecrease} down
              </span>
              <span className="text-[10px] text-slate-600 ml-auto">
                {summary.itemsNoRule} unmatched
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
