/**
 * Customer Message Tool — Session H
 * Floating panel on eBay order detail pages.
 * Injects 5 buyer message templates with variable substitution.
 * Position: bottom-right (avoids ebay-mesh-order-overlay which injects at top).
 *
 * Target: https://www.ebay.com/mesh/ord/details?orderid=*
 */

import type { OrderData, ShippingAddress, LineItem } from './ebay-mesh-order-types';

console.log('💬 Syndrax Sync: Customer Message Tool loaded');

// ==================== TYPES ====================

type OrderSource = 'amazon' | 'aliexpress' | 'unknown';

interface BuyerData {
    buyerName: string;
    itemTitle: string;
    estimatedDelivery: string;   // ISO date string YYYY-MM-DD
    orderId: string;
    orderSource: OrderSource;
}

interface PanelState {
    activeTemplate: number;       // 1–5
    reason: string;
    substitute: string;
    amount: string;
    date: string;                 // YYYY-MM-DD
    minimized: boolean;
}

interface SavedTemplate {
    name: string;
    text: string;
    templateType: number;
    savedAt: number;
}

// ==================== UTILITY ====================

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    const existing = document.querySelector('.ssx-msg-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ssx-msg-toast';
    toast.textContent = message;

    const colors: Record<string, string> = {
        success: '#10b981',
        error:   '#ef4444',
        info:    '#22d3ee',
    };

    Object.assign(toast.style, {
        position:     'fixed',
        bottom:       '90px',
        right:        '20px',
        zIndex:       '10000001',
        background:   '#0a0f1e',
        border:       `1px solid ${colors[type]}`,
        color:        colors[type],
        padding:      '8px 14px',
        borderRadius: '8px',
        fontSize:     '12px',
        fontFamily:   'system-ui, sans-serif',
        boxShadow:    '0 4px 20px rgba(0,0,0,0.6)',
        maxWidth:     '300px',
        wordBreak:    'break-word',
        transition:   'opacity 0.3s',
    });

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function copyToClipboard(text: string, successMsg = 'Copied!'): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
        return true;
    } catch {
        showToast('Failed to copy', 'error');
        return false;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
    return new Promise(resolve => {
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }

        const obs = new MutationObserver(() => {
            const found = document.querySelector(selector);
            if (found) { obs.disconnect(); resolve(found); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(document.querySelector(selector)); }, timeout);
    });
}

// ==================== DATA EXTRACTION ====================

function extractOrderIdFromUrl(): string {
    const match = window.location.href.match(/orderid[=\/]([^&\/]+)/i);
    return match ? match[1] : '';
}

function extractBuyerName(): string {
    const selectors = [
        '.order-details__buyer-info .username',
        '[data-test-id="buyer-username"]',
        '.buyer-info__username',
        '.buyer-info .username',
        '[class*="buyer"] [class*="username"]',
        '[class*="buyer"] [class*="name"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text && text.length > 0 && text.length < 60) return text;
    }
    return 'there';
}

function extractItemTitle(): string {
    const selectors = [
        '[data-test-id="item-title"]',
        '.item-info__title',
        '.line-item__title',
        '.lineItemCardInfo__content .details a span.PSEUDOLINK',
        '.lineItemCardInfo__content .details a',
        '[class*="item-title"]',
        '[class*="itemTitle"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text && text.length > 3) return text;
    }
    return 'your item';
}

function extractEstimatedDelivery(): string {
    const selectors = [
        '[data-test-id="delivery-date"]',
        '.tracking-info__eta',
        '.delivery-date',
        '[class*="delivery-date"]',
        '[class*="deliveryDate"]',
        '[class*="estimated"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.trim();
        if (text) {
            // Try to parse a date from the text
            const dateMatch = text.match(/(\w+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const parsed = new Date(dateMatch[1]);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toISOString().split('T')[0];
                }
            }
        }
    }
    // Default: 7 days from today
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
}

async function getOrderSource(orderId: string): Promise<OrderSource> {
    return new Promise(resolve => {
        chrome.storage.local.get(`order_source_${orderId}`, result => {
            const src = result[`order_source_${orderId}`];
            resolve(src === 'amazon' || src === 'aliexpress' ? src : 'unknown');
        });
    });
}

async function extractBuyerData(): Promise<BuyerData> {
    const orderId = extractOrderIdFromUrl();
    const orderSource = await getOrderSource(orderId);

    return {
        buyerName:         extractBuyerName(),
        itemTitle:         extractItemTitle(),
        estimatedDelivery: extractEstimatedDelivery(),
        orderId,
        orderSource,
    };
}

// ==================== ETA LOGIC ====================

/**
 * Apply source-specific ETA logic per BUSINESS_RULES.md:
 * - Amazon: estimated date + 1 day buffer
 * - AliExpress: use LAST day of delivery range (user must set manually — we show warning)
 * Returns { date: YYYY-MM-DD, note: string | null, warning: string | null }
 */
function applyETALogic(
    rawDate: string,
    orderSource: OrderSource
): { date: string; note: string | null; warning: string | null } {
    const base = new Date(rawDate + 'T12:00:00');

    if (orderSource === 'amazon') {
        base.setDate(base.getDate() + 1);
        return {
            date:    base.toISOString().split('T')[0],
            note:    'Amazon Prime — +1 day buffer applied',
            warning: null,
        };
    }

    if (orderSource === 'aliexpress') {
        return {
            date:    rawDate,
            note:    null,
            warning: '⚠ AliExpress order — use LAST day of delivery range',
        };
    }

    return { date: rawDate, note: null, warning: null };
}

// ==================== TEMPLATES ====================

/**
 * All 5 templates word-for-word from BUSINESS_RULES.md.
 * Variables: [name], [item], [reason], [substitute], [amount], [date]
 */
const TEMPLATES: Record<number, string> = {
    1: `Hey [name]! I just found out the [item] you ordered [reason].
Really sorry about that. I run a small family business and
want to make this right. Would it be okay if I sent you
[substitute] instead? I'm also throwing in a 10% off coupon
(THANKYOU10). If that doesn't work just let me know and
I'll refund you right away. Thanks so much!`,

    2: `Hey! Just following up since the carrier marked this as
delivered. Sometimes they leave packages in odd spots —
mailroom, back porch, with a neighbour. Would you mind
checking real quick? If not found, just let me know and
I'll start the process on my side right away!`,

    3: `Hey! Your item is scheduled to arrive [date].
Let me know if you have any questions!`,

    4: `Hey [name], so sorry to hear about the issue! Would a
partial refund of [amount] work for you? If you'd prefer
a full return I can send a prepaid label — whatever works
best for you!`,

    5: `Of course! I'll process your refund right away. Sorry it
didn't work out and hope to see you again!`,
};

// Template 5 UI note (shown in panel, NOT included in message text)
const TEMPLATE_5_NOTE = 'Note: Always select "buyer requested to cancel" in eBay.';

const TEMPLATE_LABELS: Record<number, string> = {
    1: 'OOS',
    2: 'Not Received',
    3: 'Shipping',
    4: 'Return',
    5: 'Cancel',
};

const REASON_OPTIONS = [
    'is out of stock',
    'has been discontinued',
    'arrived damaged at our warehouse',
];

// ==================== MESSAGE BUILDER ====================

function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function buildMessage(templateId: number, state: PanelState, buyer: BuyerData): string {
    let text = TEMPLATES[templateId] ?? '';

    const name      = buyer.buyerName || 'there';
    const item      = truncate(buyer.itemTitle || 'your item', 40);
    const reason    = state.reason || REASON_OPTIONS[0];
    const substitute = state.substitute || '[substitute]';
    const amount    = state.amount ? `$${state.amount}` : '[amount]';
    const date      = formatDateForMessage(state.date || buyer.estimatedDelivery);

    text = text
        .replace(/\[name\]/g, name)
        .replace(/\[item\]/g, item)
        .replace(/\[reason\]/g, reason)
        .replace(/\[substitute\]/g, substitute)
        .replace(/\[amount\]/g, amount)
        .replace(/\[date\]/g, date);

    return text;
}

function formatDateForMessage(isoDate: string): string {
    if (!isoDate) return '[date]';
    const d = new Date(isoDate + 'T12:00:00');
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ==================== SEND ON EBAY ====================

async function sendOnEbay(message: string): Promise<void> {
    const contactSelectors = [
        '[data-test-id="contact-buyer-btn"]',
        'button[aria-label*="Contact buyer"]',
        'button[aria-label*="contact buyer"]',
        'a[href*="contact"]',
    ];

    let contactBtn: Element | null = null;
    for (const sel of contactSelectors) {
        contactBtn = document.querySelector(sel);
        if (contactBtn) break;
    }

    if (!contactBtn) {
        await copyToClipboard(message);
        showToast('Click Contact Buyer on the page, then paste with Ctrl+V', 'info', 5000);
        return;
    }

    (contactBtn as HTMLElement).click();

    // Wait up to 1500ms for a textarea — never throws, resolves null on timeout
    const textarea = await new Promise<HTMLTextAreaElement | null>(resolve => {
        const deadline = setTimeout(() => resolve(null), 1500);
        const poll = setInterval(() => {
            const el = document.querySelector<HTMLTextAreaElement>(
                'textarea[name*="message"], textarea[placeholder*="message"], textarea[aria-label*="message"], textarea'
            );
            if (el) {
                clearInterval(poll);
                clearTimeout(deadline);
                resolve(el);
            }
        }, 100);
    });

    if (!textarea) {
        await copyToClipboard(message);
        showToast('Click Contact Buyer on the page, then paste with Ctrl+V', 'info', 5000);
        return;
    }

    textarea.focus();
    textarea.value = message;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    showToast('Message ready — review and click Send', 'success', 4000);
}

// ==================== SAVED TEMPLATES ====================

async function saveTemplate(name: string, text: string, templateType: number): Promise<void> {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(
            { type: 'SAVE_MESSAGE_TEMPLATE', payload: { name, text, templateType } },
            () => resolve()
        );
    });
}

// ==================== PANEL STYLES ====================

function injectStyles(): void {
    if (document.getElementById('ssx-msg-styles')) return;

    const style = document.createElement('style');
    style.id = 'ssx-msg-styles';
    style.textContent = `
        #ssx-msg-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 340px;
            z-index: 999999;
            background: #0a0f1e;
            border: 1px solid #22d3ee;
            border-radius: 14px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 12px;
            color: #e2e8f0;
            box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(34,211,238,0.08);
            overflow: hidden;
            transition: height 0.2s ease;
        }
        #ssx-msg-panel.minimized .ssx-msg-body {
            display: none;
        }
        .ssx-msg-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(34,211,238,0.06);
            border-bottom: 1px solid rgba(34,211,238,0.15);
            cursor: default;
        }
        .ssx-msg-header-left {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .ssx-msg-title {
            font-size: 13px;
            font-weight: 600;
            color: #22d3ee;
            letter-spacing: 0.03em;
        }
        .ssx-msg-buyer {
            font-size: 10px;
            color: #94a3b8;
        }
        .ssx-msg-minimize {
            background: none;
            border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8;
            border-radius: 6px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: border-color 0.15s, color 0.15s;
        }
        .ssx-msg-minimize:hover {
            border-color: #22d3ee;
            color: #22d3ee;
        }
        .ssx-msg-body {
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ssx-msg-warning {
            background: rgba(245,158,11,0.1);
            border: 1px solid rgba(245,158,11,0.3);
            border-radius: 6px;
            padding: 6px 10px;
            color: #fbbf24;
            font-size: 11px;
        }
        .ssx-msg-note {
            background: rgba(34,211,238,0.06);
            border: 1px solid rgba(34,211,238,0.2);
            border-radius: 6px;
            padding: 6px 10px;
            color: #67e8f9;
            font-size: 11px;
        }
        .ssx-msg-pills {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
        .ssx-msg-pill {
            padding: 4px 10px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.15s;
        }
        .ssx-msg-pill:hover {
            border-color: rgba(34,211,238,0.4);
            color: #e2e8f0;
        }
        .ssx-msg-pill.active {
            border-color: #22d3ee;
            background: rgba(34,211,238,0.12);
            color: #22d3ee;
        }
        .ssx-msg-inputs {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .ssx-msg-label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 2px;
        }
        .ssx-msg-select,
        .ssx-msg-input,
        .ssx-msg-date {
            width: 100%;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: #e2e8f0;
            padding: 6px 10px;
            font-size: 12px;
            font-family: inherit;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.15s;
        }
        .ssx-msg-select:focus,
        .ssx-msg-input:focus,
        .ssx-msg-date:focus {
            border-color: rgba(34,211,238,0.5);
        }
        .ssx-msg-select option {
            background: #0a0f1e;
        }
        .ssx-msg-amount-wrap {
            position: relative;
        }
        .ssx-msg-amount-prefix {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
            font-size: 12px;
            pointer-events: none;
        }
        .ssx-msg-amount-wrap .ssx-msg-input {
            padding-left: 20px;
        }
        .ssx-msg-preview-wrap {
            position: relative;
        }
        .ssx-msg-preview {
            width: 100%;
            min-height: 100px;
            max-height: 160px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            color: #cbd5e1;
            padding: 8px 10px;
            font-size: 11px;
            font-family: inherit;
            line-height: 1.5;
            resize: vertical;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.15s;
        }
        .ssx-msg-preview:focus {
            border-color: rgba(34,211,238,0.3);
        }
        .ssx-msg-charcount {
            position: absolute;
            bottom: 6px;
            right: 8px;
            font-size: 10px;
            color: #475569;
            pointer-events: none;
        }
        .ssx-msg-t5-note {
            font-size: 10px;
            color: #f59e0b;
            background: rgba(245,158,11,0.06);
            border: 1px solid rgba(245,158,11,0.2);
            border-radius: 6px;
            padding: 5px 8px;
        }
        .ssx-msg-actions {
            display: flex;
            gap: 6px;
        }
        .ssx-msg-btn {
            flex: 1;
            padding: 7px 6px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
            cursor: pointer;
            font-size: 11px;
            font-family: inherit;
            font-weight: 500;
            transition: all 0.15s;
            white-space: nowrap;
        }
        .ssx-msg-btn:hover {
            border-color: rgba(34,211,238,0.4);
            color: #e2e8f0;
            background: rgba(34,211,238,0.06);
        }
        .ssx-msg-btn.primary {
            border-color: rgba(34,211,238,0.4);
            background: rgba(34,211,238,0.1);
            color: #22d3ee;
        }
        .ssx-msg-btn.primary:hover {
            background: rgba(34,211,238,0.18);
        }
        .ssx-msg-divider {
            height: 1px;
            background: rgba(255,255,255,0.06);
            margin: 0 -14px;
        }
        .ssx-msg-quick-label {
            font-size: 10px;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        .ssx-msg-quick-row {
            display: flex;
            gap: 5px;
        }
        .ssx-msg-quick-btn {
            flex: 1;
            padding: 6px 4px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.03);
            color: #64748b;
            cursor: pointer;
            font-size: 10px;
            font-family: inherit;
            font-weight: 500;
            transition: all 0.15s;
            text-align: center;
        }
        .ssx-msg-quick-btn:hover {
            border-color: rgba(34,211,238,0.3);
            color: #94a3b8;
            background: rgba(34,211,238,0.04);
        }
    `;
    document.head.appendChild(style);
}

// ==================== PANEL CREATION ====================

function createPanel(buyer: BuyerData): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'ssx-msg-panel';

    const etaResult = applyETALogic(buyer.estimatedDelivery, buyer.orderSource);

    const state: PanelState = {
        activeTemplate: 1,
        reason:         REASON_OPTIONS[0],
        substitute:     '',
        amount:         '',
        date:           etaResult.date,
        minimized:      false,
    };

    function render(): void {
        const msg = buildMessage(state.activeTemplate, state, buyer);
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        if (preview && document.activeElement !== preview) {
            preview.value = msg;
        }
        const counter = panel.querySelector<HTMLElement>('#ssx-charcount');
        if (counter) {
            const current = preview ? preview.value.length : msg.length;
            counter.textContent = `${current} chars`;
        }

        // Show/hide variable inputs
        const inputsEl = panel.querySelector<HTMLElement>('#ssx-inputs');
        if (inputsEl) {
            inputsEl.innerHTML = buildInputsHTML(state.activeTemplate, state, etaResult);
            bindInputEvents(inputsEl, state, render);
        }

        // Show/hide T5 note
        const t5note = panel.querySelector<HTMLElement>('#ssx-t5-note');
        if (t5note) {
            t5note.style.display = state.activeTemplate === 5 ? 'block' : 'none';
        }

        // Update pill active states
        panel.querySelectorAll<HTMLElement>('.ssx-msg-pill').forEach(pill => {
            const t = parseInt(pill.dataset.template ?? '0');
            pill.classList.toggle('active', t === state.activeTemplate);
        });

        // Update warning/note banners
        const warningEl = panel.querySelector<HTMLElement>('#ssx-warning');
        const noteEl    = panel.querySelector<HTMLElement>('#ssx-note');
        if (warningEl) {
            warningEl.textContent  = etaResult.warning ?? '';
            warningEl.style.display = etaResult.warning ? 'block' : 'none';
        }
        if (noteEl) {
            noteEl.textContent  = etaResult.note ?? '';
            noteEl.style.display = etaResult.note ? 'block' : 'none';
        }
    }

    panel.innerHTML = buildPanelHTML(buyer, state, etaResult);

    // ── Minimize ──
    panel.querySelector('#ssx-minimize')?.addEventListener('click', () => {
        state.minimized = !state.minimized;
        panel.classList.toggle('minimized', state.minimized);
        const btn = panel.querySelector<HTMLElement>('#ssx-minimize');
        if (btn) btn.textContent = state.minimized ? '+' : '−';
    });

    // ── Template pills ──
    panel.querySelectorAll<HTMLElement>('.ssx-msg-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            state.activeTemplate = parseInt(pill.dataset.template ?? '1');
            render();
        });
    });

    // ── Preview textarea live char count ──
    panel.querySelector('#ssx-preview')?.addEventListener('input', () => {
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const counter = panel.querySelector<HTMLElement>('#ssx-charcount');
        if (preview && counter) counter.textContent = `${preview.value.length} chars`;
    });

    // ── Copy button ──
    panel.querySelector('#ssx-copy')?.addEventListener('click', async () => {
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const text = preview ? preview.value : buildMessage(state.activeTemplate, state, buyer);
        await copyToClipboard(text, 'Copied!');
    });

    // ── Send on eBay ──
    panel.querySelector('#ssx-send')?.addEventListener('click', async () => {
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const text = preview ? preview.value : buildMessage(state.activeTemplate, state, buyer);
        await sendOnEbay(text);
    });

    // ── Save as Template ──
    panel.querySelector('#ssx-save')?.addEventListener('click', async () => {
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const text = preview ? preview.value : buildMessage(state.activeTemplate, state, buyer);
        const name = `${TEMPLATE_LABELS[state.activeTemplate]} — ${new Date().toLocaleDateString()}`;
        await saveTemplate(name, text, state.activeTemplate);
        showToast('Template saved!', 'success');
    });

    // ── Quick: Mark Shipped ──
    panel.querySelector('#ssx-quick-shipped')?.addEventListener('click', async () => {
        state.activeTemplate = 3;
        // Use today + 1 as ETA for quick action
        const d = new Date();
        d.setDate(d.getDate() + 1);
        state.date = d.toISOString().split('T')[0];
        render();
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const text = preview ? preview.value : buildMessage(3, state, buyer);
        await copyToClipboard(text, 'Shipping notice copied!');
    });

    // ── Quick: INR Follow-up ──
    panel.querySelector('#ssx-quick-inr')?.addEventListener('click', async () => {
        state.activeTemplate = 2;
        render();
        const preview = panel.querySelector<HTMLTextAreaElement>('#ssx-preview');
        const text = preview ? preview.value : buildMessage(2, state, buyer);
        await copyToClipboard(text, 'INR message copied!');
    });

    // ── Quick: Return Response ──
    panel.querySelector('#ssx-quick-return')?.addEventListener('click', () => {
        state.activeTemplate = 4;
        render();
        // Focus amount input
        setTimeout(() => {
            panel.querySelector<HTMLInputElement>('#ssx-amount')?.focus();
        }, 50);
    });

    // Bind initial input events
    const inputsEl = panel.querySelector<HTMLElement>('#ssx-inputs');
    if (inputsEl) bindInputEvents(inputsEl, state, render);

    // Initial render
    render();

    return panel;
}

// ==================== HTML BUILDERS ====================

function buildPanelHTML(
    buyer: BuyerData,
    state: PanelState,
    etaResult: { date: string; note: string | null; warning: string | null }
): string {
    const pillsHTML = Object.entries(TEMPLATE_LABELS)
        .map(([id, label]) =>
            `<button class="ssx-msg-pill${parseInt(id) === state.activeTemplate ? ' active' : ''}" data-template="${id}">${label}</button>`
        ).join('');

    const initialMsg = buildMessage(state.activeTemplate, state, buyer);

    return `
        <div class="ssx-msg-header">
            <div class="ssx-msg-header-left">
                <span class="ssx-msg-title">💬 Message Tool</span>
                <span class="ssx-msg-buyer">To: ${escapeHtml(buyer.buyerName)}</span>
            </div>
            <button class="ssx-msg-minimize" id="ssx-minimize" title="Minimize">−</button>
        </div>
        <div class="ssx-msg-body">
            <div id="ssx-warning" class="ssx-msg-warning" style="display:${etaResult.warning ? 'block' : 'none'}">${escapeHtml(etaResult.warning ?? '')}</div>
            <div id="ssx-note" class="ssx-msg-note" style="display:${etaResult.note ? 'block' : 'none'}">${escapeHtml(etaResult.note ?? '')}</div>
            <div class="ssx-msg-pills">${pillsHTML}</div>
            <div id="ssx-inputs" class="ssx-msg-inputs">${buildInputsHTML(state.activeTemplate, state, etaResult)}</div>
            <div class="ssx-msg-preview-wrap">
                <textarea id="ssx-preview" class="ssx-msg-preview" spellcheck="true">${escapeHtml(initialMsg)}</textarea>
                <span id="ssx-charcount" class="ssx-msg-charcount">${initialMsg.length} chars</span>
            </div>
            <div id="ssx-t5-note" class="ssx-msg-t5-note" style="display:${state.activeTemplate === 5 ? 'block' : 'none'}">${TEMPLATE_5_NOTE}</div>
            <div class="ssx-msg-actions">
                <button class="ssx-msg-btn primary" id="ssx-copy">📋 Copy</button>
                <button class="ssx-msg-btn" id="ssx-send">✉️ Send on eBay</button>
                <button class="ssx-msg-btn" id="ssx-save">💾 Save</button>
            </div>
            <div class="ssx-msg-divider"></div>
            <span class="ssx-msg-quick-label">Quick Actions</span>
            <div class="ssx-msg-quick-row">
                <button class="ssx-msg-quick-btn" id="ssx-quick-shipped">📦 Mark Shipped</button>
                <button class="ssx-msg-quick-btn" id="ssx-quick-inr">🔍 INR Follow-up</button>
                <button class="ssx-msg-quick-btn" id="ssx-quick-return">↩️ Return</button>
            </div>
        </div>
    `;
}

function buildInputsHTML(
    templateId: number,
    state: PanelState,
    etaResult: { date: string; note: string | null; warning: string | null }
): string {
    if (templateId === 1) {
        const reasonOptions = REASON_OPTIONS
            .map(r => `<option value="${escapeHtml(r)}"${r === state.reason ? ' selected' : ''}>${escapeHtml(r)}</option>`)
            .join('');
        return `
            <div>
                <div class="ssx-msg-label">Reason</div>
                <select class="ssx-msg-select" id="ssx-reason">${reasonOptions}</select>
            </div>
            <div>
                <div class="ssx-msg-label">Substitute item</div>
                <input class="ssx-msg-input" id="ssx-substitute" type="text" placeholder="e.g. a similar model in black" value="${escapeHtml(state.substitute)}">
            </div>
        `;
    }

    if (templateId === 3) {
        return `
            <div>
                <div class="ssx-msg-label">Estimated delivery date</div>
                <input class="ssx-msg-date" id="ssx-date" type="date" value="${escapeHtml(state.date)}">
            </div>
        `;
    }

    if (templateId === 4) {
        return `
            <div>
                <div class="ssx-msg-label">Partial refund amount</div>
                <div class="ssx-msg-amount-wrap">
                    <span class="ssx-msg-amount-prefix">$</span>
                    <input class="ssx-msg-input" id="ssx-amount" type="number" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(state.amount)}">
                </div>
            </div>
        `;
    }

    // Templates 2 and 5 — no inputs
    return '';
}

function bindInputEvents(container: HTMLElement, state: PanelState, render: () => void): void {
    container.querySelector<HTMLSelectElement>('#ssx-reason')?.addEventListener('change', e => {
        state.reason = (e.target as HTMLSelectElement).value;
        render();
    });

    container.querySelector<HTMLInputElement>('#ssx-substitute')?.addEventListener('input', e => {
        state.substitute = (e.target as HTMLInputElement).value;
        render();
    });

    container.querySelector<HTMLInputElement>('#ssx-date')?.addEventListener('change', e => {
        state.date = (e.target as HTMLInputElement).value;
        render();
    });

    container.querySelector<HTMLInputElement>('#ssx-amount')?.addEventListener('input', e => {
        state.amount = (e.target as HTMLInputElement).value;
        render();
    });
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== INIT ====================

async function init(): Promise<void> {
    if (!window.location.href.includes('ebay.com/mesh/ord/details')) return;

    // Avoid double-inject
    if (document.getElementById('ssx-msg-panel')) return;

    console.log('💬 Customer Message Tool: order details page detected');

    // Wait for page content
    await waitForElement('.lineItemCard', 8000);
    await sleep(1200);

    injectStyles();

    const buyer = await extractBuyerData();
    console.log('💬 Buyer data:', buyer);

    const panel = createPanel(buyer);
    document.body.appendChild(panel);

    console.log('✅ Customer Message Tool panel injected');
}

// ==================== ENTRY POINT ====================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Re-init on SPA navigation (eBay uses pushState)
let lastUrl = window.location.href;
const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        // Remove old panel if present
        document.getElementById('ssx-msg-panel')?.remove();
        // Re-init after short delay for page to settle
        setTimeout(init, 2000);
    }
});
navObserver.observe(document.body, { childList: true, subtree: true });
