/**
 * DescriptionBuilder.tsx — Syndrax Sync Shared Component
 * Session F — reusable HTML description template builder
 * Used in: popup pipeline, BulkLister accordion, Sniper prefill
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, CheckCircle, Save, Trash2, ChevronLeft,
  FileText, Zap, Eye, PenTool, Package, Heart,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DescProductData {
  title: string;
  brand: string;
  bullets: string[];
  price: number;
  asin: string;
}

export interface DescriptionBuilderProps {
  productData?: DescProductData;
  onInsert?: (html: string) => void;
  onBack?: () => void;
  mode: 'popup' | 'panel';
}

type TemplateKey = 'CLEAN_MINIMAL' | 'FEATURE_FOCUS' | 'LIFESTYLE_COPY' | 'BUNDLE_VALUE' | 'CUSTOM';

interface SavedTemplate {
  id: string;
  name: string;
  templateKey: TemplateKey;
  customBody: string;
  createdAt: number;
}

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATE_META: Record<TemplateKey, { label: string; icon: React.ElementType; desc: string }> = {
  CLEAN_MINIMAL:  { label: 'Clean Minimal',  icon: FileText,  desc: 'Simple, fast, generic items' },
  FEATURE_FOCUS:  { label: 'Feature Focus',  icon: Zap,       desc: 'Electronics, tools, specs' },
  LIFESTYLE_COPY: { label: 'Lifestyle Copy', icon: Heart,     desc: 'Home goods, gifts, lifestyle' },
  BUNDLE_VALUE:   { label: 'Bundle Value',   icon: Package,   desc: 'Multi-piece, accessories' },
  CUSTOM:         { label: 'Custom',         icon: PenTool,   desc: 'Your own HTML template' },
};

const TEMPLATE_KEYS: TemplateKey[] = ['CLEAN_MINIMAL', 'FEATURE_FOCUS', 'LIFESTYLE_COPY', 'BUNDLE_VALUE', 'CUSTOM'];

function buildBulletList(bullets: string[]): string {
  if (!bullets.length) return '';
  return bullets.slice(0, 5).map(b => `  <li>${escHtml(b)}</li>`).join('\n');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateFromTemplate(key: TemplateKey, data: DescProductData, customBody: string): string {
  const { title, brand, bullets, price } = data;
  const priceStr = price > 0 ? `$${price.toFixed(2)}` : '';
  const bulletHtml = buildBulletList(bullets);
  const brandLine = brand ? `<p style="color:#555;font-size:13px;margin:0 0 12px;">Brand: <strong>${escHtml(brand)}</strong></p>` : '';

  switch (key) {
    case 'CLEAN_MINIMAL':
      return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.6;">
  <h2 style="font-size:18px;margin:0 0 8px;">${escHtml(title)}</h2>
  ${brandLine}
  <ul style="padding-left:20px;margin:0 0 16px;">
${bulletHtml || '  <li>High quality product</li>\n  <li>Fast shipping from US warehouse</li>\n  <li>Satisfaction guaranteed</li>'}
  </ul>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:12px;margin:0;">
    📦 Ships within 1–2 business days. Questions? Message us anytime.
  </p>
</div>`;

    case 'FEATURE_FOCUS':
      return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.6;">
  <h2 style="font-size:18px;margin:0 0 8px;">${escHtml(title)}</h2>
  ${brandLine}
  <h3 style="font-size:14px;color:#333;margin:16px 0 8px;border-bottom:2px solid #0064d2;padding-bottom:4px;">✦ Key Features</h3>
  <ul style="padding-left:0;list-style:none;margin:0 0 16px;">
${bullets.slice(0, 5).map(b => `    <li style="padding:4px 0;">✓ ${escHtml(b)}</li>`).join('\n') || '    <li style="padding:4px 0;">✓ Premium quality construction</li>\n    <li style="padding:4px 0;">✓ Easy to use and install</li>\n    <li style="padding:4px 0;">✓ Compatible with most models</li>'}
  </ul>
  <h3 style="font-size:14px;color:#333;margin:16px 0 8px;border-bottom:2px solid #0064d2;padding-bottom:4px;">📋 Specifications</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
    <tr style="background:#f5f5f5;"><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Brand</td><td style="padding:6px 10px;border:1px solid #ddd;">${escHtml(brand || 'See listing')}</td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Condition</td><td style="padding:6px 10px;border:1px solid #ddd;">New</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:6px 10px;border:1px solid #ddd;font-weight:bold;">Ships From</td><td style="padding:6px 10px;border:1px solid #ddd;">United States</td></tr>
  </table>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:12px;margin:0;">
    📦 Fast US shipping. 30-day returns. Message us with any questions.
  </p>
</div>`;

    case 'LIFESTYLE_COPY':
      return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.7;">
  <p style="font-size:16px;font-weight:bold;color:#0064d2;margin:0 0 12px;">
    ${escHtml(title || 'Elevate your everyday.')}
  </p>
  ${brandLine}
  <p style="font-size:14px;margin:0 0 16px;color:#444;">
    Whether you're upgrading your space or finding the perfect gift, this is the piece that makes the difference.
  </p>
  <ul style="padding-left:20px;margin:0 0 16px;color:#333;">
${bulletHtml || '  <li>Thoughtfully designed for everyday use</li>\n  <li>Premium materials that last</li>\n  <li>Makes a great gift for any occasion</li>'}
  </ul>
  <p style="font-size:13px;color:#777;font-style:italic;margin:0 0 16px;">
    ⭐ Loved by thousands of happy customers.
  </p>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:12px;margin:0;">
    📦 Ships fast from the US. 30-day hassle-free returns.
  </p>
</div>`;

    case 'BUNDLE_VALUE':
      return `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.6;">
  <h2 style="font-size:18px;margin:0 0 8px;">${escHtml(title)}</h2>
  ${brandLine}
  <h3 style="font-size:14px;color:#333;margin:16px 0 8px;border-bottom:2px solid #0064d2;padding-bottom:4px;">📦 What's in the Box</h3>
  <ul style="padding-left:20px;margin:0 0 16px;">
${bulletHtml || '  <li>1x Main unit</li>\n  <li>1x User manual</li>\n  <li>All necessary accessories included</li>'}
  </ul>
  <h3 style="font-size:14px;color:#333;margin:16px 0 8px;border-bottom:2px solid #0064d2;padding-bottom:4px;">🔧 Compatibility</h3>
  <p style="font-size:13px;color:#444;margin:0 0 16px;">
    Compatible with most standard models. Please check product dimensions before purchasing.
  </p>
  <h3 style="font-size:14px;color:#333;margin:16px 0 8px;border-bottom:2px solid #0064d2;padding-bottom:4px;">🛡️ Warranty & Returns</h3>
  <p style="font-size:13px;color:#444;margin:0 0 16px;">
    30-day return policy. Manufacturer warranty included. We stand behind every item we sell.
  </p>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:12px;margin:0;">
    📦 Ships within 1–2 business days from the US.
  </p>
</div>`;

    case 'CUSTOM': {
      // Replace variables in custom template
      const bulletText = bullets.slice(0, 5).map(b => `• ${b}`).join('\n');
      return customBody
        .replace(/\{\{title\}\}/g, escHtml(title))
        .replace(/\{\{brand\}\}/g, escHtml(brand))
        .replace(/\{\{price\}\}/g, priceStr)
        .replace(/\{\{bullets\}\}/g, bulletText);
    }

    default:
      return '';
  }
}

const DEFAULT_CUSTOM_TEMPLATE = `<div style="font-family:Arial,sans-serif;max-width:680px;color:#222;line-height:1.6;">
  <h2>{{title}}</h2>
  <p>Brand: {{brand}}</p>
  <p>{{bullets}}</p>
  <p>Price: {{price}}</p>
  <p>Ships fast from the US. Questions? Message us!</p>
</div>`;

// ─── Chrome helpers ───────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DescriptionBuilder({
  productData: propProductData,
  onInsert,
  onBack,
  mode,
}: DescriptionBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('CLEAN_MINIMAL');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [customBody, setCustomBody] = useState(DEFAULT_CUSTOM_TEMPLATE);
  const [copied, setCopied] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [productData, setProductData] = useState<DescProductData | undefined>(propProductData);
  const [prefillLoaded, setPrefillLoaded] = useState(false);

  const charCount = generatedHtml.length;
  const CHAR_WARN = 4000;
  const CHAR_MAX = 500000;

  // ─── On mount: check desc_prefill + load saved templates ──────────────────

  useEffect(() => {
    const init = async () => {
      // Check for prefill from Sniper
      if (!propProductData) {
        const prefill = await storageGet<DescProductData>('desc_prefill');
        if (prefill) {
          setProductData(prefill);
          await storageSet('desc_prefill', null);
          setPrefillLoaded(true);
        }
      }

      // Load saved templates
      const saved = await storageGet<SavedTemplate[]>('desc_templates');
      if (saved && Array.isArray(saved)) {
        setSavedTemplates(saved);
      }
    };
    init();
  }, [propProductData]);

  // ─── Sync prop changes ────────────────────────────────────────────────────

  useEffect(() => {
    if (propProductData) {
      setProductData(propProductData);
    }
  }, [propProductData]);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const data: DescProductData = productData ?? {
      title: 'Sample Product Title',
      brand: 'Brand Name',
      bullets: [
        'High quality materials for lasting durability',
        'Easy to use and set up right out of the box',
        'Compatible with most standard configurations',
        'Backed by our satisfaction guarantee',
      ],
      price: 0,
      asin: '',
    };
    const html = generateFromTemplate(selectedTemplate, data, customBody);
    setGeneratedHtml(html);
  }, [selectedTemplate, productData, customBody]);

  // Auto-generate when template changes (if we already have output)
  useEffect(() => {
    if (generatedHtml) {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  // ─── Copy HTML ────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!generatedHtml) return;
    try {
      await navigator.clipboard.writeText(generatedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }, [generatedHtml]);

  // ─── Save template ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!saveNameInput.trim()) return;
    if (savedTemplates.length >= 10) return;

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: saveNameInput.trim(),
      templateKey: selectedTemplate,
      customBody: selectedTemplate === 'CUSTOM' ? customBody : '',
      createdAt: Date.now(),
    };

    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    await storageSet('desc_templates', updated);
    setSaveNameInput('');
    setShowSaveInput(false);
  }, [saveNameInput, savedTemplates, selectedTemplate, customBody]);

  // ─── Delete saved template ────────────────────────────────────────────────

  const handleDeleteSaved = useCallback(async (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    await storageSet('desc_templates', updated);
  }, [savedTemplates]);

  // ─── Load saved template ──────────────────────────────────────────────────

  const handleLoadSaved = useCallback((t: SavedTemplate) => {
    setSelectedTemplate(t.templateKey);
    if (t.templateKey === 'CUSTOM' && t.customBody) {
      setCustomBody(t.customBody);
    }
  }, []);

  // ─── Use this description ─────────────────────────────────────────────────

  const handleInsert = useCallback(() => {
    if (generatedHtml && onInsert) {
      onInsert(generatedHtml);
    }
  }, [generatedHtml, onInsert]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const isPopup = mode === 'popup';

  return (
    <div className={`flex flex-col bg-[#02050f] text-white ${isPopup ? 'h-full' : 'max-h-[520px]'}`}>

      {/* Header — popup only */}
      {isPopup && (
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-violet-300/40 hover:text-violet-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-1">
            <PenTool className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">Description Builder</h2>
            {prefillLoaded && (
              <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-300 tracking-widest">
                PREFILLED
              </span>
            )}
          </div>
          <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-medium text-violet-300 tracking-wide">
            Phase 5B
          </span>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.3)_transparent] ${isPopup ? 'px-4 py-3' : 'px-3 py-3'} space-y-4`}>

        {/* Product context banner */}
        {productData && (
          <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2.5">
            <p className="text-[10px] text-violet-400 uppercase tracking-[0.15em] mb-1">Product Context</p>
            <p className="text-xs text-slate-200 line-clamp-1 font-medium">{productData.title}</p>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
              {productData.brand && <span>Brand: {productData.brand}</span>}
              {productData.price > 0 && <span>Amazon: ${productData.price.toFixed(2)}</span>}
              {productData.bullets.length > 0 && <span>{productData.bullets.length} bullets</span>}
            </div>
          </div>
        )}

        {/* Saved templates */}
        {savedTemplates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">My Templates</p>
            {savedTemplates.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                <button
                  onClick={() => handleLoadSaved(t)}
                  className="flex-1 text-left text-xs text-slate-300 hover:text-violet-300 transition truncate"
                >
                  {t.name}
                  <span className="ml-2 text-[10px] text-slate-600">{TEMPLATE_META[t.templateKey].label}</span>
                </button>
                <button
                  onClick={() => handleDeleteSaved(t.id)}
                  className="shrink-0 text-slate-600 hover:text-red-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Template selector */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Template Style</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_KEYS.map(key => {
              const meta = TEMPLATE_META[key];
              const Icon = meta.icon;
              const active = selectedTemplate === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedTemplate(key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? 'border-violet-400/50 bg-violet-400/15 text-violet-200'
                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:border-white/20'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">{TEMPLATE_META[selectedTemplate].desc}</p>
        </div>

        {/* Custom template textarea */}
        {selectedTemplate === 'CUSTOM' && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Custom HTML Template
              <span className="ml-2 normal-case text-slate-600">Variables: {'{{title}}'} {'{{brand}}'} {'{{price}}'} {'{{bullets}}'}</span>
            </p>
            <textarea
              value={customBody}
              onChange={e => setCustomBody(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40 resize-none font-mono leading-relaxed [scrollbar-width:thin]"
            />
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/20"
        >
          <Zap className="h-4 w-4" />
          Generate Description
        </button>

        {/* Preview pane */}
        {generatedHtml && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Preview</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium ${
                  charCount > CHAR_WARN ? 'text-amber-400' : 'text-slate-600'
                }`}>
                  {charCount.toLocaleString()} chars
                  {charCount > CHAR_WARN && ' ⚠ buyers stop reading at ~4,000'}
                </span>
              </div>
            </div>

            {/* White-bg preview simulating eBay listing */}
            <div
              className="rounded-xl border border-white/10 bg-white overflow-auto max-h-48 p-3 [scrollbar-width:thin]"
              dangerouslySetInnerHTML={{ __html: generatedHtml }}
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                  copied
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
                }`}
              >
                {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy HTML'}
              </button>

              {onInsert && (
                <button
                  onClick={handleInsert}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-[11px] font-medium text-violet-200 transition hover:bg-violet-400/20"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Use This Description
                </button>
              )}

              {/* Save template */}
              {savedTemplates.length < 10 && (
                <>
                  {showSaveInput ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        value={saveNameInput}
                        onChange={e => setSaveNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        placeholder="Template name…"
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40"
                      />
                      <button
                        onClick={handleSave}
                        disabled={!saveNameInput.trim()}
                        className="flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-400/10 px-2 py-1.5 text-[11px] text-violet-300 disabled:opacity-40"
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setSaveNameInput(''); }}
                        className="text-slate-600 hover:text-slate-400 text-[11px] px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveInput(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save Template
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
