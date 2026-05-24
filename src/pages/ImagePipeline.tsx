/**
 * ImagePipeline.tsx — Image fetch, resize, optimize and preview UI
 * Session R: Process and preview product images before listing
 */

import React, { useState } from 'react';
import { ChevronLeft, Loader, Copy, CheckCircle, Image } from 'lucide-react';
import {
  processProductImages,
  getEbayImageUrls,
  type ImageResult,
  type ImagePipelineResult,
} from '../services/image-pipeline';

// ─── Chrome helper ────────────────────────────────────────────────────────────

async function sendMsg<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
      <button
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">Image Pipeline</h2>
        <p className="text-[10px] text-slate-500 mt-0.5">Process and preview product images before listing</p>
      </div>
      <span className="rounded-lg border border-violet-400/50 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-violet-100">
        Phase 8
      </span>
    </div>
  );
}

/** Quality badge colour */
function qualityBorderClass(quality: ImageResult['quality']): string {
  switch (quality) {
    case 'good':      return 'border-emerald-400';
    case 'low_res':   return 'border-amber-400';
    case 'too_large': return 'border-amber-400';
    case 'failed':    return 'border-red-500';
  }
}

function qualityLabel(quality: ImageResult['quality']): string {
  switch (quality) {
    case 'good':      return 'Good';
    case 'low_res':   return 'Low Res';
    case 'too_large': return 'Too Large';
    case 'failed':    return 'Failed';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function ImagePipeline({ onBack }: Props) {
  const [asin, setAsin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImagePipelineResult | null>(null);
  const [primaryOverride, setPrimaryOverride] = useState<ImageResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primary = primaryOverride ?? result?.primary ?? null;

  // ── Fetch & process ──────────────────────────────────────────────────────────

  const handleFetch = async () => {
    const trimmed = asin.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPrimaryOverride(null);

    try {
      // Ask background for the Amazon product data (imageUrl + additional images)
      const product = await sendMsg<{
        imageUrl?: string;
        images?: string[];
        additionalImages?: string[];
      }>('FETCH_AMAZON_PRODUCT', { asin: trimmed });

      // Collect image URLs from the product response
      const imageUrls: string[] = [];

      if (product?.images && Array.isArray(product.images)) {
        imageUrls.push(...product.images);
      } else if (product?.additionalImages && Array.isArray(product.additionalImages)) {
        imageUrls.push(...product.additionalImages);
      }

      if (product?.imageUrl) {
        // Ensure primary image is first and not duplicated
        if (!imageUrls.includes(product.imageUrl)) {
          imageUrls.unshift(product.imageUrl);
        }
      }

      // Fallback: construct standard Amazon image URL from ASIN
      if (imageUrls.length === 0) {
        imageUrls.push(
          `https://images-na.ssl-images-amazon.com/images/P/${trimmed}.01._SCLZZZZZZZ_.jpg`
        );
      }

      const pipelineResult = await processProductImages(trimmed, imageUrls);
      setResult(pipelineResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Copy URLs ────────────────────────────────────────────────────────────────

  const handleCopyUrls = async () => {
    if (!result) return;
    const urls = getEbayImageUrls(result);
    await navigator.clipboard.writeText(urls.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Use for Listing ──────────────────────────────────────────────────────────

  const handleUseListing = async () => {
    if (!result) return;
    const storageKey = `pipeline_images_${result.asin}`;
    const payload = { ...result, primary };
    await chrome.storage.local.set({ [storageKey]: payload });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const goodCount   = result?.images.filter(i => i.quality === 'good').length ?? 0;
  const lowResCount = result?.images.filter(i => i.quality === 'low_res').length ?? 0;
  const failedCount = result?.images.filter(i => i.quality === 'failed').length ?? 0;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      <SectionHeader onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.3)_transparent]">

        {/* ── Input Row ── */}
        <div className="flex gap-2">
          <input
            value={asin}
            onChange={e => setAsin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && asin.trim() && handleFetch()}
            placeholder="Enter ASIN (e.g. B08N5WRWNW)"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:border-violet-400/40 transition"
          />
          <button
            onClick={handleFetch}
            disabled={loading || !asin.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
          >
            {loading ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Image className="h-3.5 w-3.5" />
            )}
            {loading ? 'Processing…' : 'Fetch Images'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {/* ── Results Panel ── */}
        {result && (
          <div className="space-y-3">

            {/* Primary image preview */}
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-violet-400 mb-2">Primary Image</p>
              <div className="flex justify-center">
                {primary && primary.dataUrl ? (
                  <div className="relative">
                    <img
                      src={primary.dataUrl}
                      alt="Primary product"
                      style={{ width: 200, height: 200, objectFit: 'contain', background: '#0d1117' }}
                      className="rounded-lg border border-white/10"
                    />
                    <span className={`absolute bottom-1 right-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${
                      primary.quality === 'good'
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                        : 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                    }`}>
                      {qualityLabel(primary.quality)}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{ width: 200, height: 200, background: '#0d1117' }}
                    className="rounded-lg border border-white/10 flex items-center justify-center"
                  >
                    <p className="text-[11px] text-slate-600">No primary image</p>
                  </div>
                )}
              </div>
            </div>

            {/* Image strip */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-2">All Images — click to set primary</p>
              <div className="flex flex-wrap gap-2">
                {result.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => img.quality !== 'failed' && setPrimaryOverride(img)}
                    title={img.reason}
                    className={`relative rounded-lg border-2 overflow-hidden transition ${qualityBorderClass(img.quality)} ${
                      primary === img ? 'ring-2 ring-violet-400/60' : 'opacity-80 hover:opacity-100'
                    } ${img.quality === 'failed' ? 'cursor-default' : 'cursor-pointer'}`}
                    style={{ width: 60, height: 60, background: '#0d1117', flexShrink: 0 }}
                  >
                    {img.dataUrl ? (
                      <img
                        src={img.dataUrl}
                        alt={`Image ${idx + 1}`}
                        style={{ width: 60, height: 60, objectFit: 'contain' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-600 text-[10px]">–</span>
                      </div>
                    )}
                    {img.quality === 'failed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                        <span className="text-red-300 text-base font-bold">✗</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
              <p className="text-[11px] text-slate-400">
                <span className="text-emerald-400 font-medium">{goodCount} good</span>
                {' • '}
                <span className="text-amber-400 font-medium">{lowResCount} low res</span>
                {' • '}
                <span className="text-red-400 font-medium">{failedCount} failed</span>
                {primary && (
                  <>
                    {' • '}
                    <span className="text-slate-300">
                      Primary: {primary.width}×{primary.height} ({primary.sizeKb}kb)
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCopyUrls}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08]"
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied!' : `📋 Copy Image URLs (${goodCount})`}
              </button>

              <button
                onClick={handleUseListing}
                disabled={!primary}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
              >
                {saved ? (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                ) : null}
                {saved ? 'Saved!' : '✅ Use for Listing'}
              </button>
            </div>

          </div>
        )}

        {/* ── Empty State ── */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/40 bg-violet-400/10 shadow-lg shadow-violet-500/20">
              <Image className="h-8 w-8 text-violet-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-300">Image Pipeline</p>
              <p className="text-[11px] text-slate-500 mt-1">Enter an ASIN to fetch and process product images</p>
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader className="h-8 w-8 text-violet-400 animate-spin" />
            <p className="text-[11px] text-slate-500">Fetching and processing images…</p>
          </div>
        )}

      </div>
    </div>
  );
}
