/**
 * account-tier.test.ts — Unit tests for getTierLimits() and assessRisk()
 */

import { describe, it, expect } from 'vitest';
import { getTierLimits, assessRisk } from './account-tier';
import type { EbayAccount } from './account-tier';

// ─── Helper ────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<EbayAccount> = {}): EbayAccount {
  return {
    id: 'acc-001',
    username: 'testuser',
    nodeId: 'root162',
    platform: 'ebay',
    tier: 'new',
    mode: 'ACTIVE',
    age_days: 120,
    feedback_score: 100,
    feedback_positive_pct: 99,
    kyc_verified: true,
    daily_listing_limit: 50,
    listings_today: 0,
    violations: [],
    risk_level: 'low',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── getTierLimits ──────────────────────────────────────────────────────────

describe('getTierLimits', () => {
  it('SUSPENDED → dailyLimit=0, canList=false', () => {
    const result = getTierLimits(makeAccount({ mode: 'SUSPENDED' }));
    expect(result.dailyLimit).toBe(0);
    expect(result.canList).toBe(false);
    expect(result.reason).toMatch(/suspended/i);
  });

  it('RESTRICTED → dailyLimit=0, canList=false', () => {
    const result = getTierLimits(makeAccount({ mode: 'RESTRICTED' }));
    expect(result.dailyLimit).toBe(0);
    expect(result.canList).toBe(false);
    expect(result.reason).toMatch(/restricted/i);
  });

  it('WARMUP age_days=10 → dailyLimit=5, canList=true', () => {
    const result = getTierLimits(makeAccount({ mode: 'WARMUP', age_days: 10, listings_today: 0 }));
    expect(result.dailyLimit).toBe(5);
    expect(result.canList).toBe(true);
  });

  it('WARMUP age_days=45 → dailyLimit=15, canList=true', () => {
    const result = getTierLimits(makeAccount({ mode: 'WARMUP', age_days: 45, listings_today: 0 }));
    expect(result.dailyLimit).toBe(15);
    expect(result.canList).toBe(true);
  });

  it('WARMUP age_days=75 → dailyLimit=30, canList=true', () => {
    const result = getTierLimits(makeAccount({ mode: 'WARMUP', age_days: 75, listings_today: 0 }));
    expect(result.dailyLimit).toBe(30);
    expect(result.canList).toBe(true);
  });

  it('ACTIVE tier=new → dailyLimit=50', () => {
    const result = getTierLimits(makeAccount({ mode: 'ACTIVE', tier: 'new', listings_today: 0 }));
    expect(result.dailyLimit).toBe(50);
    expect(result.canList).toBe(true);
  });

  it('ACTIVE tier=established → dailyLimit=150', () => {
    const result = getTierLimits(makeAccount({ mode: 'ACTIVE', tier: 'established', listings_today: 0 }));
    expect(result.dailyLimit).toBe(150);
    expect(result.canList).toBe(true);
  });

  it('ACTIVE tier=top_rated → dailyLimit=500', () => {
    const result = getTierLimits(makeAccount({ mode: 'ACTIVE', tier: 'top_rated', listings_today: 0 }));
    expect(result.dailyLimit).toBe(500);
    expect(result.canList).toBe(true);
  });

  it('listings_today >= dailyLimit → canList=false', () => {
    const result = getTierLimits(makeAccount({ mode: 'ACTIVE', tier: 'new', listings_today: 50 }));
    expect(result.canList).toBe(false);
    expect(result.reason).toMatch(/daily limit reached/i);
  });

  it('WARMUP listings_today >= dailyLimit → canList=false', () => {
    const result = getTierLimits(makeAccount({ mode: 'WARMUP', age_days: 10, listings_today: 5 }));
    expect(result.canList).toBe(false);
    expect(result.reason).toMatch(/daily limit reached/i);
  });
});

// ─── assessRisk ─────────────────────────────────────────────────────────────

describe('assessRisk', () => {
  it('violations.length > 0 → high', () => {
    const result = assessRisk(makeAccount({ violations: ['MC011'], age_days: 200, feedback_positive_pct: 99 }));
    expect(result).toBe('high');
  });

  it('feedback_positive_pct < 95 → high', () => {
    const result = assessRisk(makeAccount({ feedback_positive_pct: 90, violations: [], age_days: 200 }));
    expect(result).toBe('high');
  });

  it('mode=RESTRICTED → high', () => {
    const result = assessRisk(makeAccount({ mode: 'RESTRICTED', violations: [], feedback_positive_pct: 99 }));
    expect(result).toBe('high');
  });

  it('mode=SUSPENDED → high', () => {
    const result = assessRisk(makeAccount({ mode: 'SUSPENDED', violations: [], feedback_positive_pct: 99 }));
    expect(result).toBe('high');
  });

  it('age_days < 90 → at least medium', () => {
    const result = assessRisk(makeAccount({ age_days: 45, violations: [], feedback_positive_pct: 99, feedback_score: 100 }));
    expect(['medium', 'high']).toContain(result);
  });

  it('feedback_score < 50 → at least medium', () => {
    const result = assessRisk(makeAccount({ feedback_score: 20, age_days: 200, violations: [], feedback_positive_pct: 99 }));
    expect(['medium', 'high']).toContain(result);
  });

  it('listings_today > dailyLimit * 0.8 → at least medium', () => {
    // tier=new → dailyLimit=50; 41 > 50*0.8=40
    const result = assessRisk(makeAccount({
      mode: 'ACTIVE',
      tier: 'new',
      listings_today: 41,
      age_days: 200,
      violations: [],
      feedback_positive_pct: 99,
      feedback_score: 100,
    }));
    expect(['medium', 'high']).toContain(result);
  });

  it('clean account with age > 90 → low', () => {
    const result = assessRisk(makeAccount({
      mode: 'ACTIVE',
      tier: 'new',
      age_days: 200,
      feedback_score: 100,
      feedback_positive_pct: 99,
      violations: [],
      listings_today: 0,
    }));
    expect(result).toBe('low');
  });
});
