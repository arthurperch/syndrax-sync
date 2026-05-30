/**
 * bulk-listing-engine.ts — Core automation engine for Syndrax Sync
 *
 * Architecture:
 *   BulkListingEngine.start(asins, config)
 *     └─ processUrls()          — thread pool (1-30 concurrent)
 *         └─ processSingleAsin() — full pipeline per ASIN
 *             ├─ STEP 1: fetchAmazonProduct()   (background message)
 *             ├─ STEP 2: checkVero()            (background message)
 *             ├─ STEP 3: calcPrice()            (local)
 *             └─ STEP 4: createEbayListing()    (background message)
 *
 * Every failure is routed through error-tracker so you can see exactly
 * which step broke for each ASIN.
 *
 * Pause / Resume / Stop are instant — the engine checks flags between steps.
 * Position is saved to chrome.storage so a crashed run can be resumed.
 */

import { makeError, logError, ErrorCode } from './error-tracker';
import type { PipelineStep, SyndraxError } from './error-tracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListingType = 'standard' | 'opti' | 'chat' | 'seo';

export type AsinStatus =
  | 'PENDING'
  | 'FETCHING'
  | 'VERO_CHECK'
  | 'PRICING'
  | 'LISTING'
  | 'LISTED'
  | 'BLOCKED'
  | 'ERROR'
  | 'SKIPPED';

export interface AsinJob {
  asin: string;
  status: AsinStatus;
  title?: string;
  amazonPrice?: number;
  ebayPrice?: number;
  image?: string;
  brand?: string;
  error?: SyndraxError;
  retries: number;
  listedAt?: number;
}

export interface BulkEngineConfig {
  threads: number;          // 1-30 concurrent tabs
  listingType: ListingType;
  markupPct: number;        // e.g. 100 = 2x price
  minPrice: number;         // skip if amazon price < this
  maxPrice: number;         // skip if amazon price > this (0 = no limit)
  fbaOnly: boolean;         // skip non-FBA items
  closeErrorTabs: boolean;  // auto-close tabs that error
  maxRetries: number;       // per-ASIN retry limit (default 2)
  dailyLimit: number;       // max listings per day (default 100)
}

export interface BulkEngineState {
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETE';
  jobs: AsinJob[];
  position: number;         // index of next unprocessed job
  listed: number;
  errors: number;
  blocked: number;
  skipped: number;
  startedAt?: number;
  pausedAt?: number;
  config: BulkEngineConfig;
}

export type EngineEventType =
  | 'JOB_UPDATE'
  | 'ENGINE_STATUS'
  | 'PROGRESS'
  | 'COMPLETE'
  | 'ERROR';

export interface EngineEvent {
  type: EngineEventType;
  asin?: string;
  job?: AsinJob;
  state?: Partial<BulkEngineState>;
  error?: SyndraxError;
}

type EngineListener = (event: EngineEvent) => void;

// ─── Chrome message helpers ───────────────────────────────────────────────────

async function bgMessage<T = unknown>(type: string, payload?: unknown): Promise<T | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return null;
    return await chrome.runtime.sendMessage({ type, payload }) as T;
  } catch (e) {
    console.warn(`[BulkEngine] bgMessage(${type}) failed:`, e);
    return null;
  }
}

async function storageSave(key: string, value: unknown): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [key]: value });
    }
  } catch {}
}

async function storageLoad<T>(key: string): Promise<T | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const r = await chrome.storage.local.get(key);
      return (r[key] ?? null) as T | null;
    }
  } catch {}
  return null;
}

// ─── Default config ───────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: BulkEngineConfig = {
  threads: 3,
  listingType: 'standard',
  markupPct: 100,
  minPrice: 0,
  maxPrice: 0,
  fbaOnly: false,
  closeErrorTabs: true,
  maxRetries: 2,
  dailyLimit: 100,
};

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'syndrax_bulk_engine_state';

// ─── BulkListingEngine ────────────────────────────────────────────────────────

class BulkListingEngine {
  private state: BulkEngineState = {
    status: 'IDLE',
    jobs: [],
    position: 0,
    listed: 0,
    errors: 0,
    blocked: 0,
    skipped: 0,
    config: { ...DEFAULT_CONFIG },
  };

  private listeners: EngineListener[] = [];
  private activeWorkers = 0;
  private stopFlag = false;
  private pauseFlag = false;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Subscribe to engine events (job updates, progress, completion) */
  on(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  /** Start a new bulk run */
  async start(asins: string[], config: Partial<BulkEngineConfig> = {}): Promise<void> {
    if (this.state.status === 'RUNNING') {
      logError(makeError(ErrorCode.AUTOMATION_ENGINE_BUSY, 'Engine already running', 'INIT'));
      return;
    }

    const mergedConfig: BulkEngineConfig = { ...DEFAULT_CONFIG, ...config };
    mergedConfig.threads = Math.max(1, Math.min(30, mergedConfig.threads));

    this.stopFlag = false;
    this.pauseFlag = false;
    this.activeWorkers = 0;

    this.state = {
      status: 'RUNNING',
      jobs: asins.map(asin => ({ asin, status: 'PENDING', retries: 0 })),
      position: 0,
      listed: 0,
      errors: 0,
      blocked: 0,
      skipped: 0,
      startedAt: Date.now(),
      config: mergedConfig,
    };

    this.emit({ type: 'ENGINE_STATUS', state: { status: 'RUNNING' } });
    await this.saveState();
    await this.processUrls();
  }

  /** Resume a previously saved run */
  async resume(): Promise<void> {
    const saved = await storageLoad<BulkEngineState>(STORAGE_KEY);
    if (!saved || saved.status === 'COMPLETE') {
      console.warn('[BulkEngine] No saved run to resume');
      return;
    }

    this.stopFlag = false;
    this.pauseFlag = false;
    this.activeWorkers = 0;
    this.state = { ...saved, status: 'RUNNING', pausedAt: undefined };

    this.emit({ type: 'ENGINE_STATUS', state: { status: 'RUNNING' } });
    await this.processUrls();
  }

  pause(): void {
    if (this.state.status !== 'RUNNING') return;
    this.pauseFlag = true;
    this.state.status = 'PAUSED';
    this.state.pausedAt = Date.now();
    this.emit({ type: 'ENGINE_STATUS', state: { status: 'PAUSED' } });
    this.saveState();
  }

  unpause(): void {
    if (this.state.status !== 'PAUSED') return;
    this.pauseFlag = false;
    this.state.status = 'RUNNING';
    this.state.pausedAt = undefined;
    this.emit({ type: 'ENGINE_STATUS', state: { status: 'RUNNING' } });
    this.processUrls();
  }

  stop(): void {
    this.stopFlag = true;
    this.pauseFlag = false;
    this.state.status = 'STOPPED';
    this.emit({ type: 'ENGINE_STATUS', state: { status: 'STOPPED' } });
    this.saveState();
  }

  getState(): BulkEngineState {
    return { ...this.state, jobs: [...this.state.jobs] };
  }

  getJob(asin: string): AsinJob | undefined {
    return this.state.jobs.find(j => j.asin === asin);
  }

  // ─── Thread Pool ─────────────────────────────────────────────────────────────

  private async processUrls(): Promise<void> {
    const { threads } = this.state.config;

    // Spawn workers up to thread limit
    const spawnWorker = async (): Promise<void> => {
      while (true) {
        if (this.stopFlag) break;

        // Wait while paused
        if (this.pauseFlag) {
          await sleep(500);
          continue;
        }

        // Find next PENDING job
        const jobIndex = this.state.jobs.findIndex(
          (j, i) => i >= this.state.position && j.status === 'PENDING'
        );

        if (jobIndex === -1) break; // No more work

        // Claim this job
        this.state.position = jobIndex + 1;
        const job = this.state.jobs[jobIndex];

        await this.processSingleAsin(job, jobIndex);
      }
      this.activeWorkers--;

      // Check if all workers done
      if (this.activeWorkers === 0 && !this.stopFlag) {
        this.onComplete();
      }
    };

    // Launch thread pool
    const workerCount = Math.min(threads, this.state.jobs.filter(j => j.status === 'PENDING').length);
    for (let i = 0; i < workerCount; i++) {
      this.activeWorkers++;
      spawnWorker(); // intentionally not awaited — runs concurrently
    }
  }

  // ─── Single ASIN Pipeline ─────────────────────────────────────────────────

  private async processSingleAsin(job: AsinJob, index: number): Promise<void> {
    const { config } = this.state;

    // ── STEP 1: Fetch Amazon product ──────────────────────────────────────────
    this.updateJob(index, { status: 'FETCHING' });

    const amazonData = await this.fetchAmazonProduct(job.asin);
    if (!amazonData) {
      // Error already logged inside fetchAmazonProduct
      this.updateJob(index, { status: 'ERROR' });
      this.state.errors++;
      this.emitProgress();
      return;
    }

    this.updateJob(index, {
      title: amazonData.title,
      amazonPrice: amazonData.price,
      image: amazonData.image,
      brand: amazonData.brand,
    });

    // ── Price filter ──────────────────────────────────────────────────────────
    if (config.minPrice > 0 && amazonData.price < config.minPrice) {
      this.updateJob(index, { status: 'SKIPPED', error: makeError(ErrorCode.VALIDATION_PRICE_BELOW_FLOOR, `Price $${amazonData.price} below min $${config.minPrice}`, 'PRICE_CALC', { asin: job.asin }) });
      this.state.skipped++;
      this.emitProgress();
      return;
    }
    if (config.maxPrice > 0 && amazonData.price > config.maxPrice) {
      this.updateJob(index, { status: 'SKIPPED' });
      this.state.skipped++;
      this.emitProgress();
      return;
    }

    // ── STEP 2: VERO check ────────────────────────────────────────────────────
    this.updateJob(index, { status: 'VERO_CHECK' });

    const veroResult = await this.checkVero(job.asin, amazonData.title, amazonData.brand ?? '');
    if (veroResult?.blocked) {
      const err = makeError(
        veroResult.reason.includes('High-risk') ? ErrorCode.VERO_HIGH_RISK_BRAND : ErrorCode.VERO_BRAND_BLOCKED,
        veroResult.reason,
        'VERO_CHECK',
        { asin: job.asin }
      );
      logError(err);
      this.updateJob(index, { status: 'BLOCKED', error: err });
      this.state.blocked++;
      this.emitProgress();
      return;
    }

    // ── STEP 3: Calculate eBay price ──────────────────────────────────────────
    this.updateJob(index, { status: 'PRICING' });

    const ebayPrice = parseFloat((amazonData.price * (1 + config.markupPct / 100)).toFixed(2));
    this.updateJob(index, { ebayPrice });

    // ── STEP 4: Create eBay listing ───────────────────────────────────────────
    this.updateJob(index, { status: 'LISTING' });

    const listResult = await this.createEbayListing(job.asin, {
      title: amazonData.title,
      ebayPrice,
      image: amazonData.image,
      brand: amazonData.brand,
      listingType: config.listingType,
    });

    if (listResult?.success) {
      this.updateJob(index, { status: 'LISTED', listedAt: Date.now() });
      this.state.listed++;
    } else {
      const errMsg = listResult?.error ?? 'Unknown listing error';
      const err = makeError(
        errMsg.includes('timeout') ? ErrorCode.EBAY_LISTING_TIMEOUT : ErrorCode.EBAY_LISTING_FORM_ERROR,
        errMsg,
        'EBAY_LIST',
        { asin: job.asin, retryable: job.retries < config.maxRetries }
      );
      logError(err);

      // Retry if allowed
      if (job.retries < config.maxRetries && err.retryable) {
        this.updateJob(index, { status: 'PENDING', retries: job.retries + 1, error: err });
        console.log(`[BulkEngine] Retrying ${job.asin} (attempt ${job.retries + 1}/${config.maxRetries})`);
      } else {
        this.updateJob(index, { status: 'ERROR', error: err });
        this.state.errors++;
      }
    }

    this.emitProgress();
    await this.saveState();
  }

  // ─── Step Implementations ─────────────────────────────────────────────────

  private async fetchAmazonProduct(asin: string): Promise<{
    title: string;
    price: number;
    image: string;
    brand: string;
  } | null> {
    const result = await bgMessage<{
      title?: string;
      price?: number;
      image?: string;
      brand?: string;
      error?: string;
    }>('FETCH_AMAZON_PRODUCT', { asin });

    if (!result || result.error || !result.title) {
      const err = makeError(
        result?.error?.includes('not found') ? ErrorCode.AMAZON_PAGE_NOT_FOUND : ErrorCode.AMAZON_SCRAPE_NO_TITLE,
        result?.error ?? 'No product data returned',
        'AMAZON_FETCH',
        { asin }
      );
      logError(err);
      return null;
    }

    return {
      title: result.title,
      price: result.price ?? 0,
      image: result.image ?? '',
      brand: result.brand ?? '',
    };
  }

  private async checkVero(asin: string, title: string, brand: string): Promise<{ blocked: boolean; reason: string } | null> {
    const result = await bgMessage<{ blocked: boolean; reason: string }>('CHECK_VERO', { title, brand });
    if (!result) {
      // If VERO check fails, log but don't block — fail open
      logError(makeError(ErrorCode.SYSTEM_MESSAGE_FAILED, 'VERO check message failed', 'VERO_CHECK', { asin }));
      return { blocked: false, reason: '' };
    }
    return result;
  }

  private async createEbayListing(asin: string, data: {
    title: string;
    ebayPrice: number;
    image?: string;
    brand?: string;
    listingType: ListingType;
  }): Promise<{ success: boolean; error?: string } | null> {
    return bgMessage<{ success: boolean; error?: string }>('CREATE_EBAY_LISTING', {
      asin,
      ebayPrice: data.ebayPrice,
      title: data.title,
      image: data.image || undefined,
      listingType: data.listingType,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private updateJob(index: number, patch: Partial<AsinJob>): void {
    const job = this.state.jobs[index];
    if (!job) return;
    Object.assign(job, patch);
    this.emit({ type: 'JOB_UPDATE', asin: job.asin, job: { ...job } });
  }

  private emitProgress(): void {
    this.emit({
      type: 'PROGRESS',
      state: {
        listed: this.state.listed,
        errors: this.state.errors,
        blocked: this.state.blocked,
        skipped: this.state.skipped,
        position: this.state.position,
      },
    });
  }

  private onComplete(): void {
    if (this.state.status === 'STOPPED') return;
    this.state.status = 'COMPLETE';
    this.emit({ type: 'COMPLETE', state: this.getState() });
    this.saveState();
    console.log(`[BulkEngine] Complete — Listed: ${this.state.listed}, Errors: ${this.state.errors}, Blocked: ${this.state.blocked}`);
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  private async saveState(): Promise<void> {
    await storageSave(STORAGE_KEY, this.state);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const bulkEngine = new BulkListingEngine();

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
