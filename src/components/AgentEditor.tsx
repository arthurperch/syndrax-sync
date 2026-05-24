/**
 * AgentEditor.tsx — Session I
 * Agent roster + model config + agent rules + VRAM meter
 */

import React from 'react';
import { Lock, Star, Trash2, Edit, CheckCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface AgentConfig {
  id: string;
  name: string;
  role: 'plan' | 'act' | 'research' | 'fulfillment' | 'monitor';
  model: string;
  provider: 'anthropic' | 'openrouter' | 'ollama' | 'local';
  costPer1M: number;
  contextWindow: number;
  tier: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  isLocal: boolean;
  isActive: boolean;
  lastUsed?: string;
  totalTokensUsed: number;
  totalCostUsd: number;
}

interface AgentRules {
  codeIsTruth: boolean;
  neverRevertToMd: boolean;
  mdAutoUpdate: boolean;
  requireHumanApproval: boolean;
  maxAutoRetries: number;
  escalationWebhook: string;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: '1', name: 'Cline Plan', role: 'plan',
    model: 'claude-haiku-4-5', provider: 'anthropic',
    costPer1M: 0.80, contextWindow: 200000, tier: 3,
    tags: ['fast', 'cheap', 'planning'], isLocal: false,
    isActive: true, totalTokensUsed: 0, totalCostUsd: 0,
  },
  {
    id: '2', name: 'Cline Act', role: 'act',
    model: 'claude-sonnet-4-6', provider: 'anthropic',
    costPer1M: 3.00, contextWindow: 200000, tier: 5,
    tags: ['coding', 'reliable', 'best'], isLocal: false,
    isActive: true, totalTokensUsed: 0, totalCostUsd: 0,
  },
  {
    id: '3', name: 'Hermes Routine', role: 'monitor',
    model: 'qwen2.5-coder:7b', provider: 'ollama',
    costPer1M: 0, contextWindow: 32000, tier: 3,
    tags: ['local', 'free', 'coding'], isLocal: true,
    isActive: true, totalTokensUsed: 0, totalCostUsd: 0,
  },
  {
    id: '4', name: 'Hermes Research', role: 'research',
    model: 'llama3.1:8b-instruct', provider: 'ollama',
    costPer1M: 0, contextWindow: 128000, tier: 3,
    tags: ['local', 'free', 'reasoning'], isLocal: true,
    isActive: true, totalTokensUsed: 0, totalCostUsd: 0,
  },
  {
    id: '5', name: 'Hermes Escalation', role: 'act',
    model: 'claude-sonnet-4-6', provider: 'anthropic',
    costPer1M: 3.00, contextWindow: 200000, tier: 5,
    tags: ['escalation', 'complex', 'reliable'], isLocal: false,
    isActive: false, totalTokensUsed: 0, totalCostUsd: 0,
  },
];

const DEFAULT_RULES: AgentRules = {
  codeIsTruth: true,
  neverRevertToMd: true,
  mdAutoUpdate: true,
  requireHumanApproval: true,
  maxAutoRetries: 3,
  escalationWebhook: '',
};

// VRAM estimates for local models (GB)
const VRAM_MAP: Record<string, number> = {
  'llama3.1:8b': 5.5,
  'llama3.1:8b-instruct': 5.5,
  'qwen2.5-coder:7b': 4.5,
  'mistral:7b': 4.5,
  'phi3:mini': 2.2,
};

const RTX_3070_VRAM = 8;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function roleBadgeClass(role: AgentConfig['role']): string {
  switch (role) {
    case 'plan': return 'bg-blue-400/10 border-blue-400/40 text-blue-300';
    case 'act': return 'bg-cyan-400/10 border-cyan-400/40 text-cyan-300';
    case 'research': return 'bg-violet-400/10 border-violet-400/40 text-violet-300';
    case 'fulfillment': return 'bg-pink-400/10 border-pink-400/40 text-pink-300';
    case 'monitor': return 'bg-amber-400/10 border-amber-400/40 text-amber-300';
  }
}

function providerBadgeClass(provider: AgentConfig['provider']): string {
  switch (provider) {
    case 'anthropic': return 'bg-orange-400/10 border-orange-400/40 text-orange-300';
    case 'openrouter': return 'bg-purple-400/10 border-purple-400/40 text-purple-300';
    case 'ollama': return 'bg-emerald-400/10 border-emerald-400/40 text-emerald-300';
    case 'local': return 'bg-slate-400/10 border-slate-400/40 text-slate-300';
  }
}

function StarRating({ tier }: { tier: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= tier ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
        />
      ))}
    </div>
  );
}

function Toggle({ value, onChange, locked }: {
  value: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !locked && onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-cyan-500' : 'bg-slate-600'} ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function storageGet(key: string): Promise<unknown> {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(key, r => resolve(r[key]));
    } else {
      try { resolve(JSON.parse(localStorage.getItem(key) || 'null')); } catch { resolve(null); }
    }
  });
}

function storageSet(key: string, value: unknown): void {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ [key]: value });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// ═══════════════════════════════════════════════════════════════
// VRAM METER
// ═══════════════════════════════════════════════════════════════

function VramMeter({ agents }: { agents: AgentConfig[] }) {
  const usedGb = agents
    .filter(a => a.isLocal && a.isActive)
    .reduce((sum, a) => {
      const modelKey = Object.keys(VRAM_MAP).find(k => a.model.startsWith(k));
      return sum + (modelKey ? VRAM_MAP[modelKey] : 0);
    }, 0);

  const pct = Math.min(100, (usedGb / RTX_3070_VRAM) * 100);
  const exceeded = usedGb > RTX_3070_VRAM;
  const barColor = exceeded ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-cyan-400';
  const textColor = exceeded ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-cyan-400';

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-300">GPU Memory — RTX 3070 (8GB)</span>
        <span className={`text-xs font-bold ${textColor}`}>{usedGb.toFixed(1)} / {RTX_3070_VRAM} GB</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {exceeded && (
        <p className="text-xs text-red-400 mt-1.5 font-medium">⚠ Exceeds RTX 3070 VRAM</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {agents.filter(a => a.isLocal && a.isActive).map(a => {
          const modelKey = Object.keys(VRAM_MAP).find(k => a.model.startsWith(k));
          const gb = modelKey ? VRAM_MAP[modelKey] : 0;
          if (!gb) return null;
          return (
            <span key={a.id} className="text-[10px] text-slate-500">
              {a.name}: {gb}GB
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT EDITOR MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AgentEditor() {
  const [agents, setAgents] = React.useState<AgentConfig[]>([]);
  const [rules, setRules] = React.useState<AgentRules>(DEFAULT_RULES);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<'config' | 'rules'>('config');
  const [toast, setToast] = React.useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = React.useState('');
  const [editRole, setEditRole] = React.useState<AgentConfig['role']>('plan');
  const [editProvider, setEditProvider] = React.useState<AgentConfig['provider']>('anthropic');
  const [editModel, setEditModel] = React.useState('');
  const [editCost, setEditCost] = React.useState(0);
  const [editContext, setEditContext] = React.useState(0);
  const [editTier, setEditTier] = React.useState<1 | 2 | 3 | 4 | 5>(3);
  const [editTags, setEditTags] = React.useState('');
  const [editIsLocal, setEditIsLocal] = React.useState(false);
  const [editIsActive, setEditIsActive] = React.useState(true);

  // Load from storage on mount
  React.useEffect(() => {
    storageGet('agent_configs').then(val => {
      if (Array.isArray(val) && val.length > 0) {
        setAgents(val as AgentConfig[]);
      } else {
        setAgents(DEFAULT_AGENTS);
        storageSet('agent_configs', DEFAULT_AGENTS);
      }
    });
    storageGet('agent_rules').then(val => {
      if (val && typeof val === 'object') {
        setRules({ ...DEFAULT_RULES, ...(val as Partial<AgentRules>) });
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const selectedAgent = agents.find(a => a.id === selectedId) ?? null;

  // Populate edit form when selection changes
  React.useEffect(() => {
    if (selectedAgent) {
      setEditName(selectedAgent.name);
      setEditRole(selectedAgent.role);
      setEditProvider(selectedAgent.provider);
      setEditModel(selectedAgent.model);
      setEditCost(selectedAgent.costPer1M);
      setEditContext(selectedAgent.contextWindow);
      setEditTier(selectedAgent.tier);
      setEditTags(selectedAgent.tags.join(', '));
      setEditIsLocal(selectedAgent.isLocal);
      setEditIsActive(selectedAgent.isActive);
    }
  }, [selectedId]);

  function handleSaveAgent() {
    if (!selectedAgent) return;
    const updated: AgentConfig = {
      ...selectedAgent,
      name: editName,
      role: editRole,
      provider: editProvider,
      model: editModel,
      costPer1M: editCost,
      contextWindow: editContext,
      tier: editTier,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      isLocal: editIsLocal,
      isActive: editIsActive,
    };
    const newAgents = agents.map(a => a.id === updated.id ? updated : a);
    setAgents(newAgents);
    storageSet('agent_configs', newAgents);
    showToast('Agent saved');
  }

  function handleDeleteAgent(id: string) {
    if (!window.confirm('Remove this agent?')) return;
    const newAgents = agents.filter(a => a.id !== id);
    setAgents(newAgents);
    storageSet('agent_configs', newAgents);
    if (selectedId === id) setSelectedId(null);
    showToast('Agent removed');
  }

  function handleSetActive(id: string) {
    const target = agents.find(a => a.id === id);
    if (!target) return;
    const newAgents = agents.map(a => ({
      ...a,
      isActive: a.id === id ? true : (a.role === target.role ? false : a.isActive),
    }));
    setAgents(newAgents);
    storageSet('agent_configs', newAgents);
    showToast('Active agent updated');
  }

  function handleAddAgent() {
    const newAgent: AgentConfig = {
      id: Date.now().toString(),
      name: 'New Agent',
      role: 'plan',
      model: '',
      provider: 'anthropic',
      costPer1M: 0,
      contextWindow: 100000,
      tier: 3,
      tags: [],
      isLocal: false,
      isActive: false,
      totalTokensUsed: 0,
      totalCostUsd: 0,
    };
    const newAgents = [...agents, newAgent];
    setAgents(newAgents);
    storageSet('agent_configs', newAgents);
    setSelectedId(newAgent.id);
    setRightTab('config');
  }

  function handleSaveRules() {
    storageSet('agent_rules', rules);
    showToast('Rules saved');
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900/90 border border-emerald-500/50 text-emerald-300 text-xs px-4 py-2 rounded-lg font-mono">
          {toast}
        </div>
      )}

      {/* LEFT COLUMN — Agent Roster */}
      <div className="w-[380px] flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-100">Agent Roster</h2>
          <button
            onClick={handleAddAgent}
            className="px-3 py-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20"
          >
            + Add Agent
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`rounded-xl border p-3 cursor-pointer transition ${
                selectedId === agent.id
                  ? 'border-violet-400/50 bg-violet-400/5'
                  : 'border-white/10 bg-slate-900/60 hover:border-white/20'
              }`}
              onClick={() => { setSelectedId(agent.id); setRightTab('config'); }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${agent.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-sm font-bold text-slate-100 truncate">{agent.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase ${roleBadgeClass(agent.role)}`}>
                    {agent.role}
                  </span>
                </div>
              </div>

              {/* Provider + tier row */}
              <div className="flex items-center justify-between mb-2">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${providerBadgeClass(agent.provider)}`}>
                  {agent.provider}
                </span>
                <StarRating tier={agent.tier} />
              </div>

              {/* Model + cost */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">{agent.model}</span>
                <span className={`text-[10px] font-medium ${agent.isLocal ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {agent.isLocal ? 'FREE' : `$${agent.costPer1M.toFixed(2)}/1M`}
                </span>
              </div>

              {/* Tags */}
              {agent.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {agent.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="rounded bg-slate-800 border border-slate-700/50 px-1.5 py-0.5 text-[9px] text-slate-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => { setSelectedId(agent.id); setRightTab('config'); }}
                  className="flex-1 py-1 rounded border border-white/10 bg-white/5 text-slate-400 text-[10px] hover:bg-white/10 flex items-center justify-center gap-1"
                >
                  <Edit className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => handleSetActive(agent.id)}
                  className={`flex-1 py-1 rounded border text-[10px] flex items-center justify-center gap-1 ${
                    agent.isActive
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle className="h-3 w-3" />
                  {agent.isActive ? 'Active' : 'Set Active'}
                </button>
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="px-2 py-1 rounded border border-red-400/20 bg-red-400/5 text-red-400 text-[10px] hover:bg-red-400/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN — Edit Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sub-tabs */}
        <div className="flex gap-3 mb-4 border-b border-white/10 pb-3">
          <button
            onClick={() => setRightTab('config')}
            className={`text-sm font-medium pb-1 border-b-2 transition ${
              rightTab === 'config' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Model Config
          </button>
          <button
            onClick={() => setRightTab('rules')}
            className={`text-sm font-medium pb-1 border-b-2 transition ${
              rightTab === 'rules' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Agent Rules
          </button>
        </div>

        {/* MODEL CONFIG */}
        {rightTab === 'config' && (
          <div className="flex-1 overflow-y-auto">
            {!selectedAgent ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-slate-500 text-sm">Select an agent to edit</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as AgentConfig['role'])}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                    >
                      <option value="plan">plan</option>
                      <option value="act">act</option>
                      <option value="research">research</option>
                      <option value="fulfillment">fulfillment</option>
                      <option value="monitor">monitor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Provider</label>
                    <select
                      value={editProvider}
                      onChange={e => setEditProvider(e.target.value as AgentConfig['provider'])}
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                    >
                      <option value="anthropic">anthropic</option>
                      <option value="openrouter">openrouter</option>
                      <option value="ollama">ollama</option>
                      <option value="local">local</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={e => setEditModel(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Cost per 1M tokens ($)</label>
                    <input
                      type="number"
                      value={editCost}
                      onChange={e => setEditCost(Number(e.target.value))}
                      step="0.01"
                      min="0"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Context Window</label>
                    <input
                      type="number"
                      value={editContext}
                      onChange={e => setEditContext(Number(e.target.value))}
                      min="0"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Performance Tier: {editTier}</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editTier}
                    onChange={e => setEditTier(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    placeholder="fast, cheap, coding"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40"
                  />
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-300">Is Local</label>
                    <Toggle value={editIsLocal} onChange={setEditIsLocal} />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-300">Is Active</label>
                    <Toggle value={editIsActive} onChange={setEditIsActive} />
                  </div>
                </div>

                {/* Stats */}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Total Tokens</p>
                    <p className="text-sm font-bold text-slate-300">{selectedAgent.totalTokensUsed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Total Cost</p>
                    <p className="text-sm font-bold text-slate-300">${selectedAgent.totalCostUsd.toFixed(4)}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveAgent}
                    className="flex-1 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(selectedAgent.id)}
                    className="px-4 py-2 rounded-lg border border-red-400/30 bg-red-400/5 text-red-400 text-sm font-medium hover:bg-red-400/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AGENT RULES */}
        {rightTab === 'rules' && (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 max-w-lg">

              {/* Locked: Code is Truth */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-400">Code is Truth</p>
                      <p className="text-[10px] text-slate-600">Never revert code to match MD documentation</p>
                    </div>
                  </div>
                  <Toggle value={true} onChange={() => {}} locked={true} />
                </div>
              </div>

              {/* Locked: Never Revert to MD */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-400">Never Revert to MD</p>
                      <p className="text-[10px] text-slate-600">MD files are plans, not contracts</p>
                    </div>
                  </div>
                  <Toggle value={true} onChange={() => {}} locked={true} />
                </div>
              </div>

              {/* MD Auto-Update */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">MD Auto-Update</p>
                    <p className="text-[10px] text-slate-500">Automatically update MD status after completed tasks</p>
                  </div>
                  <Toggle value={rules.mdAutoUpdate} onChange={v => setRules(r => ({ ...r, mdAutoUpdate: v }))} />
                </div>
              </div>

              {/* Require Human Approval */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Require Human Approval</p>
                    <p className="text-[10px] text-slate-500">Architecture decisions require human confirmation</p>
                  </div>
                  <Toggle value={rules.requireHumanApproval} onChange={v => setRules(r => ({ ...r, requireHumanApproval: v }))} />
                </div>
              </div>

              {/* Max Auto-Retries */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Max Auto-Retries</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rules.maxAutoRetries}
                    onChange={e => setRules(r => ({ ...r, maxAutoRetries: Math.min(10, Math.max(1, Number(e.target.value))) }))}
                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-cyan-400/40 text-right"
                  />
                </div>
              </div>

              {/* Escalation Webhook */}
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Escalation Webhook</label>
                <input
                  type="text"
                  value={rules.escalationWebhook}
                  onChange={e => setRules(r => ({ ...r, escalationWebhook: e.target.value }))}
                  placeholder="Discord webhook URL for escalations"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/40 placeholder:text-slate-600"
                />
              </div>

              <button
                onClick={handleSaveRules}
                className="w-full py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-400 text-sm font-medium hover:bg-cyan-400/20"
              >
                Save Rules
              </button>
            </div>
          </div>
        )}

        {/* VRAM Meter */}
        <VramMeter agents={agents} />
      </div>
    </div>
  );
}
