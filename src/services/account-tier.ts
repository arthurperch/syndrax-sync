/**
 * account-tier.ts — eBay Account Tier Management Service
 * Pure functions for tier enforcement, risk assessment, and status.
 * Storage helpers for chrome.storage.local persistence.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EbayAccount {
  id: string;                     // unique id, crypto.randomUUID()
  username: string;               // eBay username
  nodeId: string;                 // which node this account runs on (e.g. "root162")
  platform: 'ebay' | 'walmart' | 'poshmark';
  tier: 'new' | 'established' | 'top_rated';
  mode: 'WARMUP' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';
  age_days: number;               // days since account creation
  feedback_score: number;
  feedback_positive_pct: number;  // 0-100
  kyc_verified: boolean;
  daily_listing_limit: number;    // enforced cap
  listings_today: number;         // how many listed today
  violations: string[];           // e.g. ["MC011", "VeRO warning"]
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;             // ISO date
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// TIER ENFORCEMENT RULES
// ═══════════════════════════════════════════════════════════════

export function getTierLimits(account: EbayAccount): {
  dailyLimit: number;
  canList: boolean;
  reason: string;
} {
  // Suspended — cannot list
  if (account.mode === 'SUSPENDED') {
    return { dailyLimit: 0, canList: false, reason: 'Account suspended' };
  }

  // Restricted — cannot list
  if (account.mode === 'RESTRICTED') {
    return { dailyLimit: 0, canList: false, reason: 'Account restricted — resolve violations' };
  }

  // Warmup mode — age-based limits
  if (account.mode === 'WARMUP') {
    let dailyLimit: number;
    let reason: string;

    if (account.age_days < 30) {
      dailyLimit = 5;
      reason = 'Warmup: max 5/day';
    } else if (account.age_days < 60) {
      dailyLimit = 15;
      reason = 'Warmup: max 15/day';
    } else {
      dailyLimit = 30;
      reason = 'Warmup: max 30/day';
    }

    if (account.listings_today >= dailyLimit) {
      return {
        dailyLimit,
        canList: false,
        reason: `Daily limit reached (${account.listings_today}/${dailyLimit})`,
      };
    }

    return { dailyLimit, canList: true, reason };
  }

  // Active mode — tier-based limits
  let dailyLimit: number;
  if (account.tier === 'new') {
    dailyLimit = 50;
  } else if (account.tier === 'established') {
    dailyLimit = 150;
  } else {
    dailyLimit = 500; // top_rated
  }

  if (account.listings_today >= dailyLimit) {
    return {
      dailyLimit,
      canList: false,
      reason: `Daily limit reached (${account.listings_today}/${dailyLimit})`,
    };
  }

  return { dailyLimit, canList: true, reason: '' };
}

// ═══════════════════════════════════════════════════════════════
// RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════════

export function assessRisk(account: EbayAccount): 'low' | 'medium' | 'high' {
  const { dailyLimit } = getTierLimits(account);

  // High risk conditions
  if (
    account.violations.length > 0 ||
    account.feedback_positive_pct < 95 ||
    account.mode === 'RESTRICTED' ||
    account.mode === 'SUSPENDED'
  ) {
    return 'high';
  }

  // Medium risk conditions
  if (
    account.age_days < 90 ||
    account.feedback_score < 50 ||
    (dailyLimit > 0 && account.listings_today > dailyLimit * 0.8)
  ) {
    return 'medium';
  }

  return 'low';
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT STATUS
// ═══════════════════════════════════════════════════════════════

export function getAccountStatus(account: EbayAccount): {
  badge: string;
  color: 'green' | 'amber' | 'red' | 'blue';
  description: string;
} {
  if (account.mode === 'WARMUP') {
    return {
      badge: 'WARMUP',
      color: 'blue',
      description: 'Building account history',
    };
  }

  if (account.mode === 'RESTRICTED') {
    return {
      badge: 'RESTRICTED',
      color: 'red',
      description: 'Account restricted — resolve violations',
    };
  }

  if (account.mode === 'SUSPENDED') {
    return {
      badge: 'SUSPENDED',
      color: 'red',
      description: 'Account suspended',
    };
  }

  // ACTIVE — color depends on risk
  const risk = assessRisk(account);
  if (risk === 'low') {
    return {
      badge: 'ACTIVE',
      color: 'green',
      description: 'Account in good standing',
    };
  }

  return {
    badge: 'ACTIVE',
    color: 'amber',
    description: 'Account active with elevated risk',
  };
}

// ═══════════════════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'ebay_accounts';

export async function getAccounts(): Promise<EbayAccount[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return (result[STORAGE_KEY] as EbayAccount[]) || [];
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EbayAccount[]) : [];
    }
  } catch {
    return [];
  }
}

export async function saveAccount(account: EbayAccount): Promise<void> {
  const accounts = await getAccounts();
  const idx = accounts.findIndex(a => a.id === account.id);
  const updated = account.id
    ? idx >= 0
      ? accounts.map(a => (a.id === account.id ? { ...account, updated_at: new Date().toISOString() } : a))
      : [...accounts, { ...account, updated_at: new Date().toISOString() }]
    : [...accounts, { ...account, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];

  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('[account-tier] saveAccount failed:', e);
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const accounts = await getAccounts();
  const updated = accounts.filter(a => a.id !== id);
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('[account-tier] deleteAccount failed:', e);
  }
}

export async function getAccountsByNode(nodeId: string): Promise<EbayAccount[]> {
  const accounts = await getAccounts();
  return accounts.filter(a => a.nodeId === nodeId);
}
