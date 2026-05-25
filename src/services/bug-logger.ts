/**
 * bug-logger.ts — In-extension bug logging service
 * Stores bug reports in chrome.storage.local (max 200 entries)
 * Posts errors to Discord #bug-reports (errors channel)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BugReport {
  id: string;              // crypto.randomUUID()
  timestamp: string;       // ISO
  level: 'error' | 'warn' | 'info';
  feature: string;         // e.g. "Sniper", "Order Fulfillment", "TrackCaptain"
  message: string;         // human-readable description
  stack?: string;          // error stack trace if available
  context?: Record<string, unknown>;  // extra key/value data
  resolved: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bug_reports';
const MAX_ENTRIES = 200;

// ─── Discord helper ───────────────────────────────────────────────────────────

async function postBugToDiscord(report: BugReport): Promise<void> {
  try {
    // Dynamically import to avoid issues in non-extension contexts
    const { WEBHOOKS } = await import('../config/webhooks.config');
    const webhookUrl = (WEBHOOKS as Record<string, string>)['errors'];
    if (!webhookUrl) return;

    const levelEmoji = { error: '🔴', warn: '🟡', info: '🔵' }[report.level];
    const color = { error: 0xFF3D3D, warn: 0xFFD700, info: 0x00CFFF }[report.level];

    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: '🏷️ Feature', value: report.feature, inline: true },
      { name: '🕐 Time', value: new Date(report.timestamp).toLocaleString(), inline: true },
      { name: '🆔 ID', value: `\`${report.id.slice(0, 8)}…\``, inline: true },
    ];

    if (report.stack) {
      fields.push({
        name: '📋 Stack Trace',
        value: `\`\`\`\n${report.stack.slice(0, 500)}\n\`\`\``,
        inline: false,
      });
    }

    if (report.context && Object.keys(report.context).length > 0) {
      const contextStr = Object.entries(report.context)
        .map(([k, v]) => `**${k}:** ${String(v)}`)
        .join('\n');
      fields.push({
        name: '🔍 Context',
        value: contextStr.slice(0, 400),
        inline: false,
      });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Syndrax Bug Reporter',
        avatar_url: 'https://syndrax.io/assets/images/logo.png',
        embeds: [{
          title: `${levelEmoji} BUG REPORT — ${report.feature}`,
          description: report.message,
          color,
          fields,
          timestamp: report.timestamp,
          footer: { text: `Syndrax Sync — Bug Logger | Level: ${report.level.toUpperCase()}` },
        }],
      }),
    });
  } catch (err) {
    // Silently fail — don't cause infinite loops
    console.error('[BugLogger] Discord post failed:', err);
  }
}

// ─── Core functions ───────────────────────────────────────────────────────────

export async function logBug(
  report: Omit<BugReport, 'id' | 'timestamp' | 'resolved'>
): Promise<void> {
  const newReport: BugReport = {
    ...report,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    resolved: false,
  };

  try {
    // Read existing reports
    let reports: BugReport[] = [];
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      reports = (result[STORAGE_KEY] as BugReport[]) ?? [];
    }

    // Append new report, enforce max 200 (drop oldest)
    reports.push(newReport);
    if (reports.length > MAX_ENTRIES) {
      reports = reports.slice(reports.length - MAX_ENTRIES);
    }

    // Save back
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: reports });
    }
  } catch (err) {
    console.error('[BugLogger] Storage write failed:', err);
  }

  // Post to Discord for errors only
  if (report.level === 'error') {
    await postBugToDiscord(newReport);
  }
}

export async function getBugReports(): Promise<BugReport[]> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return [];
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const reports = (result[STORAGE_KEY] as BugReport[]) ?? [];
    // Sort by timestamp descending (newest first)
    return [...reports].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.error('[BugLogger] Storage read failed:', err);
    return [];
  }
}

export async function markResolved(id: string): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const reports = (result[STORAGE_KEY] as BugReport[]) ?? [];
    const updated = reports.map(r => r.id === id ? { ...r, resolved: true } : r);
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  } catch (err) {
    console.error('[BugLogger] markResolved failed:', err);
  }
}

export async function clearAllResolved(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const reports = (result[STORAGE_KEY] as BugReport[]) ?? [];
    const filtered = reports.filter(r => !r.resolved);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  } catch (err) {
    console.error('[BugLogger] clearAllResolved failed:', err);
  }
}

export async function clearAll(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  } catch (err) {
    console.error('[BugLogger] clearAll failed:', err);
  }
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

export const logger = {
  error: (feature: string, message: string, context?: Record<string, unknown>) =>
    logBug({ level: 'error', feature, message, context }),
  warn: (feature: string, message: string, context?: Record<string, unknown>) =>
    logBug({ level: 'warn', feature, message, context }),
  info: (feature: string, message: string, context?: Record<string, unknown>) =>
    logBug({ level: 'info', feature, message, context }),
};
