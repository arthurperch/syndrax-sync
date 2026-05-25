/**
 * warmup-agent.test.ts — Unit tests for getWarmupLimits(), isActionSafe(), recordAction()
 */

import { describe, it, expect } from 'vitest';
import { getWarmupLimits, isActionSafe, recordAction } from './warmup-agent';
import type { WarmupSchedule } from './warmup-agent';

// ─── Helper ────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<WarmupSchedule> = {}): WarmupSchedule {
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
  return {
    accountId: 'acc-001',
    day: 1,
    phase: 'phase1',
    listingsAllowedToday: 2,
    listingsMadeToday: 0,
    searchesAllowedToday: 5,
    searchesMadeToday: 0,
    viewsAllowedToday: 10,
    viewsMadeToday: 0,
    lastActionAt: past,
    nextActionAt: past,   // in the past → timing gate open
    notes: [],
    ...overrides,
  };
}

// ─── getWarmupLimits ────────────────────────────────────────────────────────

describe('getWarmupLimits', () => {
  it('Day 1 → listings=2, minDelayMinutes=60', () => {
    const limits = getWarmupLimits(1);
    expect(limits.listings).toBe(2);
    expect(limits.minDelayMinutes).toBe(60);
  });

  it('Day 7 → listings=2, minDelayMinutes=60 (boundary)', () => {
    const limits = getWarmupLimits(7);
    expect(limits.listings).toBe(2);
    expect(limits.minDelayMinutes).toBe(60);
  });

  it('Day 10 → listings=3, minDelayMinutes=45', () => {
    const limits = getWarmupLimits(10);
    expect(limits.listings).toBe(3);
    expect(limits.minDelayMinutes).toBe(45);
  });

  it('Day 14 → listings=3, minDelayMinutes=45 (boundary)', () => {
    const limits = getWarmupLimits(14);
    expect(limits.listings).toBe(3);
    expect(limits.minDelayMinutes).toBe(45);
  });

  it('Day 20 → listings=5, minDelayMinutes=30', () => {
    const limits = getWarmupLimits(20);
    expect(limits.listings).toBe(5);
    expect(limits.minDelayMinutes).toBe(30);
  });

  it('Day 30 → listings=5, minDelayMinutes=30 (boundary)', () => {
    const limits = getWarmupLimits(30);
    expect(limits.listings).toBe(5);
    expect(limits.minDelayMinutes).toBe(30);
  });

  it('Day 45 → listings=10, minDelayMinutes=20', () => {
    const limits = getWarmupLimits(45);
    expect(limits.listings).toBe(10);
    expect(limits.minDelayMinutes).toBe(20);
  });

  it('Day 60 → listings=10, minDelayMinutes=20 (boundary)', () => {
    const limits = getWarmupLimits(60);
    expect(limits.listings).toBe(10);
    expect(limits.minDelayMinutes).toBe(20);
  });

  it('Day 75 → listings=20, minDelayMinutes=10', () => {
    const limits = getWarmupLimits(75);
    expect(limits.listings).toBe(20);
    expect(limits.minDelayMinutes).toBe(10);
  });

  it('Day 91 → listings=50, minDelayMinutes=5', () => {
    const limits = getWarmupLimits(91);
    expect(limits.listings).toBe(50);
    expect(limits.minDelayMinutes).toBe(5);
  });
});

// ─── isActionSafe ───────────────────────────────────────────────────────────

describe('isActionSafe', () => {
  it('safe=false when nextActionAt is in the future', () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now
    const schedule = makeSchedule({ nextActionAt: future });
    const result = isActionSafe(schedule, 'list');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/too soon/i);
  });

  it('safe=false when listing daily limit reached', () => {
    const schedule = makeSchedule({ day: 1, listingsMadeToday: 2 }); // limit is 2 on day 1
    const result = isActionSafe(schedule, 'list');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/listing limit/i);
  });

  it('safe=false when search daily limit reached', () => {
    const schedule = makeSchedule({ day: 1, searchesMadeToday: 5 }); // limit is 5 on day 1
    const result = isActionSafe(schedule, 'search');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/search limit/i);
  });

  it('safe=false when view daily limit reached', () => {
    const schedule = makeSchedule({ day: 1, viewsMadeToday: 10 }); // limit is 10 on day 1
    const result = isActionSafe(schedule, 'view');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/view limit/i);
  });

  it('safe=true when timing gate passed and listing limit not reached', () => {
    const schedule = makeSchedule({ day: 1, listingsMadeToday: 1 }); // limit=2, made=1
    const result = isActionSafe(schedule, 'list');
    expect(result.safe).toBe(true);
    expect(result.reason).toMatch(/permitted/i);
  });

  it('safe=true when timing gate passed and search limit not reached', () => {
    const schedule = makeSchedule({ day: 1, searchesMadeToday: 3 }); // limit=5, made=3
    const result = isActionSafe(schedule, 'search');
    expect(result.safe).toBe(true);
  });

  it('safe=true when timing gate passed and view limit not reached', () => {
    const schedule = makeSchedule({ day: 1, viewsMadeToday: 5 }); // limit=10, made=5
    const result = isActionSafe(schedule, 'view');
    expect(result.safe).toBe(true);
  });
});

// ─── recordAction ───────────────────────────────────────────────────────────

describe('recordAction', () => {
  it('increments listingsMadeToday for list action', () => {
    const schedule = makeSchedule({ day: 1, listingsMadeToday: 0 });
    const updated = recordAction(schedule, 'list');
    expect(updated.listingsMadeToday).toBe(1);
    // other counters unchanged
    expect(updated.searchesMadeToday).toBe(0);
    expect(updated.viewsMadeToday).toBe(0);
  });

  it('increments searchesMadeToday for search action', () => {
    const schedule = makeSchedule({ day: 1, searchesMadeToday: 2 });
    const updated = recordAction(schedule, 'search');
    expect(updated.searchesMadeToday).toBe(3);
    expect(updated.listingsMadeToday).toBe(0);
  });

  it('increments viewsMadeToday for view action', () => {
    const schedule = makeSchedule({ day: 1, viewsMadeToday: 4 });
    const updated = recordAction(schedule, 'view');
    expect(updated.viewsMadeToday).toBe(5);
    expect(updated.listingsMadeToday).toBe(0);
  });

  it('updates lastActionAt to approximately now', () => {
    const before = Date.now();
    const schedule = makeSchedule({ day: 1 });
    const updated = recordAction(schedule, 'list');
    const after = Date.now();
    const lastAt = new Date(updated.lastActionAt).getTime();
    expect(lastAt).toBeGreaterThanOrEqual(before);
    expect(lastAt).toBeLessThanOrEqual(after);
  });

  it('sets nextActionAt = now + minDelayMinutes (day 1 → 60 min)', () => {
    const before = Date.now();
    const schedule = makeSchedule({ day: 1 });
    const updated = recordAction(schedule, 'list');
    const nextAt = new Date(updated.nextActionAt).getTime();
    const expectedMin = before + 60 * 60 * 1000;
    const expectedMax = Date.now() + 60 * 60 * 1000;
    expect(nextAt).toBeGreaterThanOrEqual(expectedMin);
    expect(nextAt).toBeLessThanOrEqual(expectedMax + 1000); // 1s tolerance
  });

  it('sets nextActionAt = now + 20 min on day 45', () => {
    const before = Date.now();
    const schedule = makeSchedule({ day: 45 });
    const updated = recordAction(schedule, 'search');
    const nextAt = new Date(updated.nextActionAt).getTime();
    const expectedMin = before + 20 * 60 * 1000;
    expect(nextAt).toBeGreaterThanOrEqual(expectedMin);
  });

  it('prepends a note to the notes array', () => {
    const schedule = makeSchedule({ day: 5, notes: ['old note'] });
    const updated = recordAction(schedule, 'list');
    expect(updated.notes.length).toBe(2);
    expect(updated.notes[0]).toMatch(/listing recorded/i);
    expect(updated.notes[1]).toBe('old note');
  });

  it('notes array is capped at 50 entries', () => {
    const existingNotes = Array.from({ length: 50 }, (_, i) => `note ${i}`);
    const schedule = makeSchedule({ day: 1, notes: existingNotes });
    const updated = recordAction(schedule, 'view');
    expect(updated.notes.length).toBe(50);
    expect(updated.notes[0]).toMatch(/view recorded/i);
  });

  it('does not mutate the original schedule', () => {
    const schedule = makeSchedule({ day: 1, listingsMadeToday: 0 });
    recordAction(schedule, 'list');
    expect(schedule.listingsMadeToday).toBe(0);
  });
});
