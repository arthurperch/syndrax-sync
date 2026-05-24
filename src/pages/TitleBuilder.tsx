/**
 * TitleBuilder.tsx — Advanced eBay Title Builder
 * 5 modes: Competitor Steal, Amazon Extract, Local Model, Cloud Model, Clone & Remix
 * SEO scoring, history, Sniper integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Copy, Zap, Plus, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'A' | 'B' | 'C' | 'D' | 'E';

interface ScoreDetail {
  label: string;
  pts: number;
  max: number;
  pass: boolean;
}

interface ScoreResult {
  score: number;
  details: ScoreDetail[];
}

interface HistoryItem {
  title: string;
  score: number;
  mode: Mode;
  timestamp: number;
}

interface CompetitorResult {
  ok: boolean;
  titles?: string[];
  keywords?: { word: string; count: number }[];
  suggestedTitle?: string;
  error?: string;
}

interface GenerateResult {
  title: string;
  model?: string;
  source: 'LOCAL' | 'CLOUD' | 'ERROR';
  error?: string;
}

// ─── Chrome helper ────────────────────────────────────────────────────────────

async function sendMsg<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch { return null; }
}

// ─── SEO Score ────────────────────────────────────────────────────────────────

function calculateSEOScore(title: string, brand?: string): ScoreResult {
  let score = 0;
  const details: ScoreDetail[] = [];
  const words = title.trim().split(/\s+/);
  const len = title.length;

  // Length score
  if (len >= 72 && len <= 80) {
    score += 25;
    details.push({ label: 'Length (72-80 chars)', pts: 25, max: 25, pass: true });
  } else if (len >= 60 && len < 72) {
    score += 15;
    details.push({ label: 'Length (60-71 chars)', pts: 15, max: 25, pass: true });
  } else {
    details.push({ label: `Length (${len} chars — target 72-80)`, pts: 0, max: 25, pass: false });
  }

  // Filler words
  const fillerWords = ['new','the','a','an','for','with','and','its','this','our','your','best','great','top','high','quality'];
  const foundFillers = fillerWords.filter(fw => words.some(w => w.toLowerCase() === fw));
  const fillerPts = Math.max(0, 20 - (foundFillers.length * 4));
  score += fillerPts;
  details.push({
    label: foundFillers.length === 0 ? 'No filler words' : `Filler words: ${foundFillers.join(', ')}`,
    pts: fillerPts, max: 20,
    pass: foundFillers.length === 0
  });

  // Brand in first 3 words
  if (brand && brand.trim()) {
    const first3 = words.slice(0, 3).join(' ').toLowerCase();
    const brandInFirst3 = first3.includes(brand.toLowerCase().split(' ')[0]);
    score += brandInFirst3 ? 20 : 0;
    details.push({ label: 'Brand in first 3 words', pts: brandInFirst3 ? 20 : 0, max: 20, pass: brandInFirst3 });
  } else {
    details.push({ label: 'Brand in first 3 words', pts: 0, max: 20, pass: false });
  }

  // Numbers/model info
  const hasNumber = /\d/.test(title);
  score += hasNumber ? 15 : 0;
  details.push({ label: hasNumber ? 'Contains model/number' : 'No model/number found', pts: hasNumber ? 15 : 0, max: 15, pass: hasNumber });

  // No repeated words
  const wordCounts: Record<string, number> = {};
  words.forEach(w => { const wl = w.toLowerCase(); wordCounts[wl] = (wordCounts[wl] || 0) + 1; });
  const repeated = Object.entries(wordCounts).filter(([, c]) => c > 1).map(([w]) => w);
  const repeatPts = Math.max(0, 20 - (repeated.length * 5));
  score += repeatPts;
  details.push({
    label: repeated.length === 0 ? 'No repeated words' : `Repeated: ${repeated.join(', ')}`,
    pts: repeatPts, max: 20,
    pass: repeated.length === 0
  });

  return { score: Math.min(100, score), details };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-400';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function modeColor(mode: Mode): string {
  const map: Record<Mode, string> = {
    A: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
    B: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
    C: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
    D: 'border-blue-400/40 bg-blue-400/10 text-blue-300',
    E: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300',
  };
  return map[mode];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TitleBuilder({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('A');
  const [inputText, setInputText] = useState('');
  const [brand, setBrand] = useState('');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder:7b');
  const [cloudModel, setCloudModel] = useState('claude-haiku-4-5');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copyLabel, setCopyLabel] = useState('📋 Copy Title');
  const [sniperLabel, setSniperLabel] = useState('⚡ List with Sniper');
  const [queueLabel, setQueueLabel] = useState('+ Add to Queue');
  const [competitorKeywords, setCompetitorKeywords] = useState<{ word: string; count: number }[]>([]);
  const [competitorTitles, setCompetitorTitles] = useState<string[]>([]);
  const [modelBadge, setModelBadge] = useState('');

  // SEO score (live)
  const seoResult = calculateSEOScore(generatedTitle, brand);

  // On mount: read prefill from storage
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('titlebuilder_prefill', (result) => {
        if (result.titlebuilder_prefill) {
          const { title, brand: b } = result.titlebuilder_prefill as { title?: string; brand?: string };
          if (title) setInputText(title);
          if (b) setBrand(b);
          chrome.storage.local.remove('titlebuilder_prefill');
        }
      });
    }
  }, []);

  // ─── Generate handlers ──────────────────────────────────────────────────────

  const buildPrompt = useCallback((text: string): string => {
    return `Generate an optimized eBay listing title under 80 characters.
Product info: ${text}
Brand: ${brand || 'unknown'}

Rules:
- No filler words (new, the, a, an, for, with, and, its, this, our, your, best, great, top, high, quality)
- Put brand and product type in first 3 words
- Include top 3 searchable keywords
- Must be under 80 characters
- Return ONLY the title, nothing else, no quotes`;
  }, [brand]);

  const addToHistory = useCallback((title: string, m: Mode) => {
    if (!title.trim()) return;
    const { score } = calculateSEOScore(title, brand);
    setHistory(prev => [{ title, score, mode: m, timestamp: Date.now() }, ...prev].slice(0, 10));
  }, [brand]);

  const handleModeA = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setCompetitorKeywords([]);
    setCompetitorTitles([]);
    const result = await sendMsg<CompetitorResult>('TITLE_BUILDER_COMPETITOR_STEAL', { keyword: inputText });
    setLoading(false);
    if (result?.ok && result.titles) {
      setCompetitorTitles(result.titles);
      setCompetitorKeywords(result.keywords || []);
      if (result.suggestedTitle) {
        setGeneratedTitle(result.suggestedTitle);
        addToHistory(result.suggestedTitle, 'A');
        setModelBadge('COMPETITOR');
      }
    }
  };

  const handleModeB = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    const prompt = buildPrompt(`Amazon ASIN/URL: ${inputText}`);
    const result = await sendMsg<GenerateResult>('TITLE_BUILDER_GENERATE', { prompt, useLocal: false, model: 'claude-haiku-4-5-20251001' });
    setLoading(false);
    if (result?.title) {
      setGeneratedTitle(result.title);
      addToHistory(result.title, 'B');
      setModelBadge(result.source || 'CLOUD');
    }
  };

  const handleModeC = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    const prompt = buildPrompt(inputText);
    const result = await sendMsg<GenerateResult>('TITLE_BUILDER_GENERATE', { prompt, useLocal: true, model: ollamaModel });
    setLoading(false);
    if (result?.title) {
      setGeneratedTitle(result.title);
      addToHistory(result.title, 'C');
      setModelBadge(result.source === 'LOCAL' ? `LOCAL ${ollamaModel}` : `CLOUD fallback`);
    }
  };

  const handleModeD = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    const prompt = buildPrompt(inputText);
    const result = await sendMsg<GenerateResult>('TITLE_BUILDER_GENERATE', { prompt, useLocal: false, model: cloudModel });
    setLoading(false);
    if (result?.title) {
      setGeneratedTitle(result.title);
      addToHistory(result.title, 'D');
      setModelBadge(`CLOUD ${cloudModel}`);
    }
  };

  const handleModeE = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    const result = await sendMsg<GenerateResult>('TITLE_BUILDER_REMIX', { competitorTitle: inputText, brand });
    setLoading(false);
    if (result?.title) {
      setGeneratedTitle(result.title);
      addToHistory(result.title, 'E');
      setModelBadge('REMIX');
    }
  };

  const handleGenerate = () => {
    if (mode === 'A') handleModeA();
    else if (mode === 'B') handleModeB();
    else if (mode === 'C') handleModeC();
    else if (mode === 'D') handleModeD();
    else if (mode === 'E') handleModeE();
  };

  // ─── Action handlers ────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!generatedTitle) return;
    navigator.clipboard.writeText(generatedTitle);
    setCopyLabel('✅ Copied!');
    setTimeout(() => setCopyLabel('📋 Copy Title'), 2000);
  };

  const handleSniperList = () => {
    if (!generatedTitle) return;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ sniper_pending_title: generatedTitle });
    }
    setSniperLabel('✅ Ready for Sniper');
    setTimeout(() => setSniperLabel('⚡ List with Sniper'), 2000);
  };

  const handleAddToQueue = () => {
    if (!generatedTitle) return;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('bulk_queue', (r) => {
        const queue: string[] = r.bulk_queue || [];
        queue.push(generatedTitle);
        chrome.storage.local.set({ bulk_queue: queue });
      });
    }
    setQueueLabel('✅ Added!');
    setTimeout(() => setQueueLabel('+ Add to Queue'), 2000);
  };

  // ─── Char counter color ─────────────────────────────────────────────────────

  const charLen = generatedTitle.length;
  const charColor = charLen <= 72 ? 'text-emerald-400' : charLen <= 80 ? 'text-cyan-400' : 'text-red-400';

  // ─── Mode definitions ───────────────────────────────────────────────────────

  const modes: { id: Mode; icon: string; label: string; sub: string }[] = [
    { id: 'A', icon: '🎯', label: 'Competitor Steal', sub: 'Extract keywords from top sellers' },
    { id: 'B', icon: '📦', label: 'Amazon Extract', sub: 'Pull features from Amazon listing' },
    { id: 'C', icon: '🖥', label: 'Local Model', sub: 'Free — uses Ollama on your GPU' },
    { id: 'D', icon: '☁', label: 'Cloud Model', sub: 'Claude/DeepSeek — higher quality' },
    { id: 'E', icon: '🔀', label: 'Clone & Remix', sub: 'Remix a competitor title' },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-[#02050f]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 shrink-0">
        <button
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-sm font-semibold tracking-wide text-slate-100">Title Builder</h2>
        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">Tools</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL */}
        <div className="w-[280px] shrink-0 border-r border-white/[0.07] flex flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">

          {/* Mode selector */}
          <div className="p-3 space-y-1.5">
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600 px-1 mb-2">Mode</p>
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                  mode === m.id
                    ? 'border-cyan-400/50 bg-cyan-950/30 text-slate-100'
                    : 'border-slate-800 bg-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{m.icon}</span>
                  <div>
                    <p className="text-[12px] font-medium leading-4">{m.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.sub}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.07] mx-3" />

          {/* Input area */}
          <div className="p-3 space-y-3">

            {/* Brand field (all modes) */}
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Brand (optional)</label>
              <input
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. Sony, Anker..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
              />
            </div>

            {/* Mode A */}
            {mode === 'A' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 block">eBay Search URL or Keyword</label>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
                  placeholder="paste eBay URL or type keyword"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
                >
                  {loading ? '⏳ Analyzing...' : '🎯 Analyze Top Sellers'}
                </button>
                {competitorKeywords.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Top Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {competitorKeywords.slice(0, 10).map(k => (
                        <button
                          key={k.word}
                          onClick={() => setGeneratedTitle(prev => prev ? `${prev} ${k.word}` : k.word)}
                          className="rounded border border-violet-400/20 bg-violet-400/5 px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-400/15"
                        >
                          {k.word} <span className="text-slate-600">×{k.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode B */}
            {mode === 'B' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 block">Amazon ASIN or URL</label>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
                  placeholder="B08N5WRWNW or amazon.com/dp/..."
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
                >
                  {loading ? '⏳ Extracting...' : '📦 Extract from Amazon'}
                </button>
              </div>
            )}

            {/* Mode C */}
            {mode === 'C' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 block">Product Info</label>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  rows={4}
                  placeholder="Paste title, features, or ASIN"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-emerald-400/40 resize-none"
                />
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Ollama Model</label>
                  <select
                    value={ollamaModel}
                    onChange={e => setOllamaModel(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-400/40"
                  >
                    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                    <option value="llama3.1:8b">llama3.1:8b</option>
                    <option value="deepseek-coder:6.7b">deepseek-coder:6.7b</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
                >
                  {loading ? '⏳ Generating...' : '🖥 Generate Free'}
                </button>
              </div>
            )}

            {/* Mode D */}
            {mode === 'D' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 block">Product Info</label>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  rows={4}
                  placeholder="Paste title, features, or ASIN"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-blue-400/40 resize-none"
                />
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">AI Model</label>
                  <select
                    value={cloudModel}
                    onChange={e => setCloudModel(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-400/40"
                  >
                    <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                    <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
                    <option value="deepseek/deepseek-v3">deepseek/deepseek-v3</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full rounded-lg border border-blue-400/40 bg-blue-400/10 px-3 py-2 text-xs font-medium text-blue-200 transition hover:bg-blue-400/20 disabled:opacity-40"
                >
                  {loading ? '⏳ Generating...' : '☁ Generate'}
                </button>
              </div>
            )}

            {/* Mode E */}
            {mode === 'E' && (
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 block">Competitor Title to Remix</label>
                <input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
                  placeholder="paste their eBay title here"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-fuchsia-400/40"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !inputText.trim()}
                  className="w-full rounded-lg border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-2 text-xs font-medium text-fuchsia-200 transition hover:bg-fuchsia-400/20 disabled:opacity-40"
                >
                  {loading ? '⏳ Remixing...' : '🔀 Remix Title'}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(34,211,238,0.3)_transparent]">

            {/* Generated title output */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Generated Title</p>
                {modelBadge && (
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">{modelBadge}</span>
                )}
              </div>
              <textarea
                value={generatedTitle}
                onChange={e => setGeneratedTitle(e.target.value)}
                placeholder="Generated title will appear here..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-400/40 resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[11px] font-medium ${charColor}`}>{charLen} / 80 characters</span>
                {charLen > 80 && <span className="text-[10px] text-red-400">⚠ Over limit by {charLen - 80}</span>}
              </div>
            </div>

            {/* SEO Score */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">SEO Score</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${scoreBg(seoResult.score)}`}
                      style={{ width: `${seoResult.score}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold ${scoreColor(seoResult.score)}`}>{seoResult.score}/100</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {seoResult.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {d.pass
                        ? <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                        : <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                      }
                      <span className={`truncate ${d.pass ? 'text-slate-300' : 'text-slate-500'}`}>{d.label}</span>
                    </div>
                    <span className={`shrink-0 ml-2 font-medium ${d.pass ? 'text-emerald-400' : 'text-slate-600'}`}>
                      +{d.pts}/{d.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                disabled={!generatedTitle}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                {copyLabel}
              </button>
              <button
                onClick={handleSniperList}
                disabled={!generatedTitle}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
              >
                <Zap className="h-3.5 w-3.5" />
                {sniperLabel}
              </button>
              <button
                onClick={handleAddToQueue}
                disabled={!generatedTitle}
                className="flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                {queueLabel}
              </button>
            </div>

            {/* Competitor titles (Mode A) */}
            {mode === 'A' && competitorTitles.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Top Competitor Titles</p>
                <div className="space-y-1.5">
                  {competitorTitles.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setGeneratedTitle(t)}
                      className="w-full text-left rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200 hover:border-white/[0.12] transition"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">History</p>
                <div className="space-y-1.5">
                  {history.map((item, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-[11px] text-slate-300 leading-5 flex-1 min-w-0 truncate">{item.title}</p>
                        <button
                          onClick={() => setGeneratedTitle(item.title)}
                          className="shrink-0 text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          Use This
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold ${scoreColor(item.score)}`}>{item.score}/100</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${modeColor(item.mode)}`}>Mode {item.mode}</span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
