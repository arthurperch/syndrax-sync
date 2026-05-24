/**
 * AccountManager.tsx — eBay Account Tier Manager Page
 * Displays account cards with tier enforcement, risk indicators, and CRUD modal.
 */

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Edit, Trash2, ChevronLeft, AlertTriangle,
  CheckCircle, XCircle, Shield, TrendingUp
} from 'lucide-react';
import {
  EbayAccount,
  getTierLimits,
  assessRisk,
  getAccountStatus,
  getAccounts,
  saveAccount,
  deleteAccount,
} from '../services/account-tier';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const NODE_OPTIONS = [
  'root162', 'root163', 'root164', 'root165', 'root166',
  'root167', 'root168', 'root169', 'root170',
];

const EMPTY_ACCOUNT: Omit<EbayAccount, 'id' | 'created_at' | 'updated_at'> = {
  username: '',
  nodeId: 'root162',
  platform: 'ebay',
  tier: 'new',
  mode: 'WARMUP',
  age_days: 0,
  feedback_score: 0,
  feedback_positive_pct: 100,
  kyc_verified: false,
  daily_listing_limit: 5,
  listings_today: 0,
  violations: [],
  risk_level: 'low',
};

// ═══════════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════════

function statusColorClasses(color: 'green' | 'amber' | 'red' | 'blue') {
  const map = {
    green: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    red:   'border-red-400/40 bg-red-400/10 text-red-300',
    blue:  'border-blue-400/40 bg-blue-400/10 text-blue-300',
  };
  return map[color];
}

function riskDotColor(risk: 'low' | 'medium' | 'high') {
  if (risk === 'low') return 'bg-emerald-400';
  if (risk === 'medium') return 'bg-amber-400';
  return 'bg-red-400';
}

function progressBarColor(pct: number) {
  if (pct < 50) return 'bg-emerald-400';
  if (pct < 80) return 'bg-amber-400';
  return 'bg-red-400';
}

function platformBadge(platform: EbayAccount['platform']) {
  const map = {
    ebay:     'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
    walmart:  'border-blue-400/40 bg-blue-400/10 text-blue-300',
    poshmark: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300',
  };
  return map[platform];
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT CARD
// ═══════════════════════════════════════════════════════════════

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: EbayAccount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { dailyLimit, canList, reason } = getTierLimits(account);
  const risk = assessRisk(account);
  const status = getAccountStatus(account);
  const usedPct = dailyLimit > 0 ? Math.min(100, Math.round((account.listings_today / dailyLimit) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-100">{account.username || '(no username)'}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase ${platformBadge(account.platform)}`}>
            {account.platform}
          </span>
          <span className="rounded-full border border-slate-600/40 bg-slate-800/40 px-2 py-0.5 text-[9px] text-slate-400">
            {account.nodeId}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg border border-red-400/20 bg-red-400/5 text-red-500 hover:text-red-300 hover:bg-red-400/10 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Status + Risk row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColorClasses(status.color)}`}>
          {status.badge}
        </span>
        <span className="rounded-full border border-slate-600/40 bg-slate-800/40 px-2 py-0.5 text-[9px] text-slate-400 capitalize">
          {account.tier.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[9px] text-slate-500 uppercase">Risk</span>
          <span className={`h-2.5 w-2.5 rounded-full ${riskDotColor(risk)}`} />
          <span className={`text-[10px] font-medium capitalize ${risk === 'low' ? 'text-emerald-400' : risk === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>
            {risk}
          </span>
        </div>
      </div>

      {/* Tier enforcement bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-500">Daily listings</span>
          <span className={`text-[10px] font-medium ${canList ? 'text-slate-300' : 'text-red-400'}`}>
            {account.listings_today} / {dailyLimit > 0 ? dailyLimit : '—'} today
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressBarColor(usedPct)}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        {!canList && reason && (
          <p className="text-[9px] text-red-400 mt-1">{reason}</p>
        )}
      </div>

      {/* Violations */}
      {account.violations.length > 0 && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-[9px] text-red-400 font-medium uppercase">Violations</span>
          </div>
          {account.violations.map((v, i) => (
            <p key={i} className="text-[10px] text-red-300">• {v}</p>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-3">
          {/* KYC */}
          <div className="flex items-center gap-1">
            {account.kyc_verified ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            )}
            <span className={`text-[10px] font-medium ${account.kyc_verified ? 'text-emerald-400' : 'text-red-400'}`}>
              {account.kyc_verified ? '✓ KYC' : '✗ KYC'}
            </span>
          </div>
          {/* Feedback */}
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-slate-500" />
            <span className="text-[10px] text-slate-400">
              {account.feedback_score} ({account.feedback_positive_pct}%)
            </span>
          </div>
        </div>
        <span className="text-[9px] text-slate-600">{account.age_days}d old</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADD / EDIT MODAL
// ═══════════════════════════════════════════════════════════════

function AccountModal({
  account,
  onClose,
  onSave,
}: {
  account: EbayAccount | null;
  onClose: () => void;
  onSave: (a: EbayAccount) => void;
}) {
  const isEdit = !!account?.id;
  const [form, setForm] = useState<EbayAccount>(
    account ?? {
      ...EMPTY_ACCOUNT,
      id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
  const [violationsRaw, setViolationsRaw] = useState(
    account?.violations.join(', ') ?? ''
  );

  function set<K extends keyof EbayAccount>(key: K, value: EbayAccount[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const violations = violationsRaw
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    onSave({ ...form, violations });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl border border-white/10 p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-100">
            {isEdit ? 'Edit Account' : 'Add Account'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        <div className="space-y-3">
          {/* Username */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              placeholder="eBay username"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
            />
          </div>

          {/* Node + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Node</label>
              <select
                value={form.nodeId}
                onChange={e => set('nodeId', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              >
                {NODE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={e => set('platform', e.target.value as EbayAccount['platform'])}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              >
                <option value="ebay">eBay</option>
                <option value="walmart">Walmart</option>
                <option value="poshmark">Poshmark</option>
              </select>
            </div>
          </div>

          {/* Tier + Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Tier</label>
              <select
                value={form.tier}
                onChange={e => set('tier', e.target.value as EbayAccount['tier'])}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              >
                <option value="new">New</option>
                <option value="established">Established</option>
                <option value="top_rated">Top Rated</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Mode</label>
              <select
                value={form.mode}
                onChange={e => set('mode', e.target.value as EbayAccount['mode'])}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              >
                <option value="WARMUP">WARMUP</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="RESTRICTED">RESTRICTED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          {/* Age + Feedback Score */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Age (days)</label>
              <input
                type="number"
                min={0}
                value={form.age_days}
                onChange={e => set('age_days', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Feedback Score</label>
              <input
                type="number"
                min={0}
                value={form.feedback_score}
                onChange={e => set('feedback_score', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              />
            </div>
          </div>

          {/* Feedback % + Daily Limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Positive % (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.feedback_positive_pct}
                onChange={e => set('feedback_positive_pct', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-1">Daily Listing Limit</label>
              <input
                type="number"
                min={0}
                value={form.daily_listing_limit}
                onChange={e => set('daily_listing_limit', Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
              />
            </div>
          </div>

          {/* Listings Today */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Listings Today</label>
            <input
              type="number"
              min={0}
              value={form.listings_today}
              onChange={e => set('listings_today', Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
            />
          </div>

          {/* KYC */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-300">KYC Verified</label>
            <button
              type="button"
              onClick={() => set('kyc_verified', !form.kyc_verified)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.kyc_verified ? 'bg-cyan-500' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.kyc_verified ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-xs ${form.kyc_verified ? 'text-emerald-400' : 'text-slate-500'}`}>
              {form.kyc_verified ? '✓ Verified' : '✗ Not verified'}
            </span>
          </div>

          {/* Violations */}
          <div>
            <label className="block text-[10px] text-slate-400 uppercase mb-1">Violations (comma-separated)</label>
            <input
              type="text"
              value={violationsRaw}
              onChange={e => setViolationsRaw(e.target.value)}
              placeholder="MC011, VeRO warning"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-400/40"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-xs font-medium hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.username}
            className="flex-1 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20 disabled:opacity-40 transition"
          >
            {isEdit ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AccountManager({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<EbayAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EbayAccount | null>(null);

  useEffect(() => {
    getAccounts().then(setAccounts);
  }, []);

  async function handleSave(account: EbayAccount) {
    await saveAccount(account);
    const updated = await getAccounts();
    setAccounts(updated);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account?')) return;
    await deleteAccount(id);
    const updated = await getAccounts();
    setAccounts(updated);
  }

  function openAdd() {
    setEditingAccount(null);
    setShowModal(true);
  }

  function openEdit(account: EbayAccount) {
    setEditingAccount(account);
    setShowModal(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Users className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">Account Manager</h2>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] text-cyan-300">
            {accounts.length} accounts
          </span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Shield className="h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-500">No accounts yet</p>
            <p className="text-xs text-slate-600">Add your first eBay account to start tracking tiers and limits</p>
            <button
              onClick={openAdd}
              className="mt-2 flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-400/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={() => openEdit(account)}
                onDelete={() => handleDelete(account.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
