/**
 * warmup-agent.ts — eBay Account Warmup Automation Service
 * Pure functions for safe warmup scheduling, action gating, and day progression.
 * Storage helpers for chrome.storage.local persistence.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface WarmupSchedule {
  accountId: string;
  day: number;                    // current warmup day (1-90)
  phase: 'phase1' | 'phase2' | 'phase3';  // 1-30, 31-60, 61-90
  listingsAllowedToday: number;
  listingsMadeToday: number;
  searchesAllowedToday: number;
  searchesMadeToday: number;
  viewsAllowedToday: number;
  viewsMadeToday: number;
  lastActionAt: string;           // ISO timestamp
  nextActionAt: string;           // ISO timestamp — when next action is safe
  notes: string[];                // log of warmup actions
}

// ═══════════════════════════════════════════════════════════════
// WARMUP RULES — PURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getWarmupLimits(day: number): {
  listings: number;
  searches: number;
  views: number;
  minDelayMinutes: number;
} {
  if (day <= 7)  return { listings: 2,  searches: 5,  views: 10,  minDelayMinutes: 60 };
  if (day <= 14) return { listings: 3,  searches: 8,  views: 15,  minDelayMinutes: 45 };
  if (day <= 30) return { listings: 5,  searches: 12, views: 20,  minDelayMinutes: 30 };
  if (day <= 60) return { listings: 10, searches: 20, views: 30,  minDelayMinutes: 20 };
  if (day <= 90) return { listings: 20, searches: 30, views: 50,  minDelayMinutes: 10 };
  // Day 90+
  return { listings: 50, searches: 50, views: 100, minDelayMinutes: 5 };
}

export function isActionSafe(
  schedule: WarmupSchedule,
  action: 'list' | 'search' | 'view'
): { safe: boolean; reason: string } {
  const now = new Date();
  const nextAt = new Date(schedule.nextActionAt);

  // Check timing gate
  if (nextAt > now) {
    const diffMs = nextAt.getTime() - now.getTime();
    const diffMin = Math.ceil(diffMs / 60000);
    return { safe: false, reason: `Too soon since last action — wait ${diffMin} minute${diffMin !== 1 ? 's' : ''}` };
  }

  // Check daily limits
  const limits = getWarmupLimits(schedule.day);

  if (action === 'list') {
    if (schedule.listingsMadeToday >= limits.listings) {
      return { safe: false, reason: 'Daily listing limit reached' };
    }
  } else if (action === 'search') {
    if (schedule.searchesMadeToday >= limits.searches) {
      return { safe: false, reason: 'Daily search limit reached' };
    }
  } else if (action === 'view') {
    if (schedule.viewsMadeToday >= limits.views) {
      return { safe: false, reason: 'Daily view limit reached' };
    }
  }

  return { safe: true, reason: 'Action permitted' };
}

export function recordAction(
  schedule: WarmupSchedule,
  action: 'list' | 'search' | 'view'
): WarmupSchedule {
  const now = new Date();
  const limits = getWarmupLimits(schedule.day);
  const nextAt = new Date(now.getTime() + limits.minDelayMinutes * 60 * 1000);
  const timestamp = now.toISOString();

  const updated: WarmupSchedule = {
    ...schedule,
    lastActionAt: timestamp,
    nextActionAt: nextAt.toISOString(),
  };

  if (action === 'list') {
    updated.listingsMadeToday = schedule.listingsMadeToday + 1;
  } else if (action === 'search') {
    updated.searchesMadeToday = schedule.searchesMadeToday + 1;
  } else if (action === 'view') {
    updated.viewsMadeToday = schedule.viewsMadeToday + 1;
  }

  const noteLabel = action === 'list' ? 'listing' : action === 'search' ? 'search' : 'view';
  const note = `[${timestamp}] ${noteLabel} recorded — day ${schedule.day}`;
  updated.notes = [note, ...schedule.notes].slice(0, 50); // keep last 50

  return updated;
}

export function advanceDay(schedule: WarmupSchedule): WarmupSchedule {
  const newDay = schedule.day + 1;
  const limits = getWarmupLimits(newDay);

  let phase: WarmupSchedule['phase'];
  if (newDay <= 30) phase = 'phase1';
  else if (newDay <= 60) phase = 'phase2';
  else phase = 'phase3';

  const timestamp = new Date().toISOString();
  const note = `[${timestamp}] Day advanced to ${newDay} — phase ${phase}`;

  return {
    ...schedule,
    day: newDay,
    phase,
    listingsAllowedToday: limits.listings,
    listingsMadeToday: 0,
    searchesAllowedToday: limits.searches,
    searchesMadeToday: 0,
    viewsAllowedToday: limits.views,
    viewsMadeToday: 0,
    notes: [note, ...schedule.notes].slice(0, 50),
  };
}

// ═══════════════════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'warmup_schedules';

async function readSchedules(): Promise<WarmupSchedule[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return (result[STORAGE_KEY] as WarmupSchedule[]) || [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WarmupSchedule[]) : [];
  } catch {
    return [];
  }
}

async function writeSchedules(schedules: WarmupSchedule[]): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: schedules });
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch {
    // silent
  }
}

export async function getWarmupSchedules(): Promise<WarmupSchedule[]> {
  return readSchedules();
}

export async function saveWarmupSchedule(schedule: WarmupSchedule): Promise<void> {
  const schedules = await readSchedules();
  const idx = schedules.findIndex(s => s.accountId === schedule.accountId);
  if (idx >= 0) {
    schedules[idx] = schedule;
  } else {
    schedules.push(schedule);
  }
  await writeSchedules(schedules);
}

export async function deleteWarmupSchedule(accountId: string): Promise<void> {
  const schedules = await readSchedules();
  await writeSchedules(schedules.filter(s => s.accountId !== accountId));
}

export async function getScheduleByAccount(accountId: string): Promise<WarmupSchedule | undefined> {
  const schedules = await readSchedules();
  return schedules.find(s => s.accountId === accountId);
}
