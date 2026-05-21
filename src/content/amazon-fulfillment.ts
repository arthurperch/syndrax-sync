/**
 * Amazon Order Fulfillment Automation - Syndrax
 * SAFE MODE: Fills address form, then STOPS for manual review
 * Does NOT proceed to checkout automatically!
 */

// Variables for retry mechanism
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;

// ==================== TYPES ====================

interface ShippingData {
    fullName: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
}

interface PendingAmazonOrder {
    shipping: ShippingData;
    itemTitle: string;
    quantity: number;
    amazonUrl: string;
    itemId: string;
    ebayOrderId: string;
    timestamp: number;
    ebayEarnings?: number; // Net earnings from eBay order
}

interface ProfitData {
    ebayEarnings: number | null;
    amazonCost: number | null;
    profit: number | null;
}

interface AutomationState {
    currentStep: number;
    shipping: ShippingData;
    startTime: number;
    lastUrl: string;
}

interface StepResult {
    success: boolean;
    error?: string;
    value?: string;
}

// ==================== PROFIT TRACKING ====================

let profitBox: HTMLDivElement | null = null;
let profitUpdateInterval: number | null = null;

// Current session profit data (not persisted until order complete)
let currentProfitData: ProfitData = {
    ebayEarnings: null,
    amazonCost: null,
    profit: null
};

function extractAmazonOrderTotal(): number | null {
    // Try multiple selectors for Amazon order total
    const selectors = [
        '[data-shimmer-target="ordertotals-amount"]', // Main checkout
        '.order-summary-line-definition span[data-shimmer-target]',
        '.grand-total-price',
        '#subtotals-marketplace-table .a-text-bold',
        '.aok-align-right .a-text-bold'
    ];
    
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const text = el.textContent?.trim() || '';
            const match = text.match(/\$?([\d,]+\.?\d*)/);
            if (match) {
                const amount = parseFloat(match[1].replace(',', ''));
                if (!isNaN(amount) && amount > 0) {
                    console.log(`💰 Found Amazon total: $${amount.toFixed(2)} via "${sel}"`);
                    return amount;
                }
            }
        }
    }
    
    console.log('💰 Amazon order total not found on page');
    return null;
}

function createProfitOverlay(ebayEarnings: number | null): void {
    // Remove old one if exists
    document.getElementById('syndrax-profit-box')?.remove();
    
    profitBox = document.createElement('div');
    profitBox.id = 'syndrax-profit-box';
    profitBox.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999998;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        min-width: 220px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
    `;
    
    currentProfitData.ebayEarnings = ebayEarnings;
    updateProfitDisplay();
    
    document.body.appendChild(profitBox);
    
    // Start monitoring for Amazon total updates
    startProfitMonitoring();
}

function updateProfitDisplay(): void {
    if (!profitBox) return;
    
    const { ebayEarnings, amazonCost } = currentProfitData;
    const profit = (ebayEarnings !== null && amazonCost !== null) 
        ? ebayEarnings - amazonCost 
        : null;
    
    currentProfitData.profit = profit;
    
    const profitColor = profit === null ? '#888' : (profit >= 0 ? '#22c55e' : '#ef4444');
    const profitText = profit === null ? '---' : (profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`);
    
    profitBox.innerHTML = `
        <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 12px;">
            💼 Profit Breakdown
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 8px 10px; background: rgba(34, 197, 94, 0.15); border-radius: 6px;">
            <span style="color: #22c55e; font-size: 12px;">📈 eBay Earnings</span>
            <span style="color: #22c55e; font-weight: 600;">${ebayEarnings !== null ? `$${ebayEarnings.toFixed(2)}` : '---'}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 8px 10px; background: rgba(239, 68, 68, 0.15); border-radius: 6px;">
            <span style="color: #ef4444; font-size: 12px;">📉 Amazon Cost</span>
            <span style="color: #ef4444; font-weight: 600;">${amazonCost !== null ? `$${amazonCost.toFixed(2)}` : '<span style="color:#666">waiting...</span>'}</span>
        </div>
        
        <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 14px;">Net Profit</span>
                <span style="font-weight: 700; font-size: 18px; color: ${profitColor};">${profitText}</span>
            </div>
        </div>
        
        <div style="font-size: 10px; color: #666; text-align: center; margin-top: 8px;">
            ${amazonCost === null ? '⏳ Will update when order total appears' : '✓ Live calculation'}
        </div>
    `;
}

function startProfitMonitoring(): void {
    if (profitUpdateInterval) {
        clearInterval(profitUpdateInterval);
    }
    profitUpdateInterval = window.setInterval(() => {
        const newTotal = extractAmazonOrderTotal();
        if (newTotal !== null && newTotal !== currentProfitData.amazonCost) {
            console.log(`💰 Amazon cost updated: $${newTotal.toFixed(2)}`);
            currentProfitData.amazonCost = newTotal;
            updateProfitDisplay();
        }
    }, 2000);
}

// ==================== VISUAL OVERLAY ====================

let statusBox: HTMLDivElement | null = null;

function createDebugOverlay(): void {
    document.getElementById('syndrax-automation-status')?.remove();
    document.getElementById('syndrax-highlight')?.remove();

    statusBox = document.createElement('div');
    statusBox.id = 'syndrax-automation-status';
    statusBox.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.95);
        color: #00ff00;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        min-width: 350px;
        max-width: 450px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 2px solid #00ff00;
    `;
    statusBox.innerHTML = `
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #00ff00;">
            🤖 Syndrax Automation
        </div>
        <div id="syndrax-step-status" style="line-height: 1.5;">
            Initializing...
        </div>
    `;
    document.body.appendChild(statusBox);
}

function updateStatus(step: number, message: string, isError = false): void {
    if (!document.getElementById('syndrax-automation-status')) {
        createDebugOverlay();
    }
    
    const statusEl = document.getElementById('syndrax-step-status');
    if (statusEl) {
        const color = isError ? '#ff4444' : '#00ff00';
        statusEl.innerHTML = `
            <div style="color: ${color};">
                <strong>Step ${step}:</strong> ${message}
            </div>
        `;
    }
    console.log(`[Step ${step}] ${message}`);
}

function showAddressPreview(shipping: ShippingData): void {
    if (!statusBox) createDebugOverlay();
    if (statusBox) {
        statusBox.style.borderColor = '#f59e0b';
        statusBox.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #f59e0b;">
                📦 Address to Fill (from eBay order)
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin-bottom: 12px; line-height: 1.6;">
                <div><strong>Name:</strong> ${shipping.fullName || '⚠️ MISSING'}</div>
                <div><strong>Street:</strong> ${shipping.street || '⚠️ MISSING'}</div>
                ${shipping.street2 ? `<div><strong>Street 2:</strong> ${shipping.street2}</div>` : ''}
                <div><strong>City:</strong> ${shipping.city || '⚠️ MISSING'}</div>
                <div><strong>State:</strong> ${shipping.state || '⚠️ MISSING'}</div>
                <div><strong>ZIP:</strong> ${shipping.zipCode || '⚠️ MISSING'}</div>
                <div><strong>Phone:</strong> ${shipping.phone || 'Not provided'}</div>
            </div>
        `;
    }
}

function showFilledSummary(shipping: ShippingData, filledValues: Record<string, string>): void {
    if (!statusBox) createDebugOverlay();
    if (statusBox) {
        statusBox.style.borderColor = '#22c55e';
        statusBox.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #22c55e;">
                ✅ Address Form Filled - REVIEW REQUIRED
            </div>
            <div style="background: rgba(34,197,94,0.2); padding: 10px; border-radius: 6px; margin-bottom: 12px; line-height: 1.5; font-size: 11px;">
                <div><strong>Name:</strong> ${filledValues.name || '❌ Not filled'}</div>
                <div><strong>Street:</strong> ${filledValues.street || '❌ Not filled'}</div>
                <div><strong>City:</strong> ${filledValues.city || '❌ Not filled'}</div>
                <div><strong>State:</strong> ${filledValues.state || '❌ Not filled'}</div>
                <div><strong>ZIP:</strong> ${filledValues.zip || '❌ Not filled'}</div>
                <div><strong>Phone:</strong> ${filledValues.phone || 'Skipped'}</div>
            </div>
            <div style="background: rgba(255,0,0,0.2); padding: 10px; border-radius: 6px; margin-bottom: 12px; color: #ff6b6b; font-weight: bold;">
                ⚠️ AUTOMATION STOPPED HERE ⚠️<br>
                Please review the filled address above.<br>
                If correct, manually click "Use this address" button.
            </div>
            <button id="syndrax-close-btn" style="
                width: 100%;
                padding: 10px;
                background: #22c55e;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 13px;
            ">OK - I'll Review & Continue Manually</button>
        `;
        
        document.getElementById('syndrax-close-btn')?.addEventListener('click', async () => {
            await clearAutomationState(true);
            statusBox?.remove();
        });
    }
}

function showErrorOverlay(step: number, errorMsg: string): void {
    if (!statusBox) createDebugOverlay();
    if (statusBox) {
        statusBox.style.borderColor = '#ff4444';
        statusBox.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #ff4444;">
                ❌ Step ${step} Failed
            </div>
            <div style="color: #ff4444; line-height: 1.5; margin-bottom: 10px;">
                ${errorMsg}
            </div>
            <button id="syndrax-retry-btn" style="
                padding: 8px 16px;
                background: #f59e0b;
                color: black;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                margin-right: 8px;
            ">Retry</button>
            <button id="syndrax-close-btn" style="
                padding: 8px 16px;
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            ">Cancel</button>
        `;
        
        document.getElementById('syndrax-close-btn')?.addEventListener('click', async () => {
            await clearAutomationState();
            statusBox?.remove();
        });
        
        document.getElementById('syndrax-retry-btn')?.addEventListener('click', () => {
            window.location.reload();
        });
    }
}

function highlightElement(element: Element, label: string): void {
    const oldHighlight = document.getElementById('syndrax-highlight');
    if (oldHighlight) oldHighlight.remove();

    const rect = element.getBoundingClientRect();
    
    const highlight = document.createElement('div');
    highlight.id = 'syndrax-highlight';
    highlight.style.cssText = `
        position: fixed;
        top: ${rect.top - 5}px;
        left: ${rect.left - 5}px;
        width: ${rect.width + 10}px;
        height: ${rect.height + 10}px;
        background: rgba(255, 0, 0, 0.2);
        border: 3px solid rgba(255, 0, 0, 0.8);
        border-radius: 4px;
        z-index: 999998;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
    `;
    
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
        position: absolute;
        top: -25px;
        left: 0;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-family: monospace;
    `;
    labelEl.textContent = label;
    highlight.appendChild(labelEl);
    
    document.body.appendChild(highlight);
    setTimeout(() => highlight.remove(), 2000);
}

// ==================== STATE MANAGEMENT ====================

async function saveAutomationState(state: AutomationState): Promise<void> {
    return new Promise(resolve => {
        chrome.storage.local.set({ syndraxAutomationState: state }, resolve);
    });
}

async function getAutomationState(): Promise<AutomationState | null> {
    return new Promise(resolve => {
        chrome.storage.local.get(['syndraxAutomationState'], (data) => {
            resolve(data.syndraxAutomationState || null);
        });
    });
}

async function clearAutomationState(alsoRemoveOrder = false): Promise<void> {
    return new Promise(resolve => {
        if (alsoRemoveOrder) {
            // Full clear - remove everything including pending order
            chrome.storage.local.remove(['syndraxAutomationState', 'pendingAmazonOrder', 'autoOrderInProgress'], resolve);
        } else {
            // Only clear step state, keep the pending order
            chrome.storage.local.remove(['syndraxAutomationState'], resolve);
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Preloaded audio element
let buttonAudio: HTMLAudioElement | null = null;

function initAudio(): void {
    if (!buttonAudio) {
        try {
            const soundUrl = chrome.runtime.getURL('button1.mp3');
            buttonAudio = new Audio(soundUrl);
            buttonAudio.volume = 0.5;
            // Pre-load the audio
            buttonAudio.load();
            console.log('🔊 Audio initialized:', soundUrl);
        } catch (err) {
            console.log('Could not init audio:', err);
        }
    }
}

function playButtonSound(): void {
    if (!buttonAudio) initAudio();
    if (buttonAudio) {
        try {
            // Reset to beginning and play
            buttonAudio.currentTime = 0;
            const playPromise = buttonAudio.play();
            if (playPromise) {
                playPromise.catch(err => {
                    // If blocked, try creating a new audio context
                    console.log('Audio play blocked, trying AudioContext...');
                    playWithAudioContext();
                });
            }
        } catch (err) {
            console.log('Audio play error:', err);
        }
    }
}

async function playWithAudioContext(): Promise<void> {
    try {
        const soundUrl = chrome.runtime.getURL('button1.mp3');
        const response = await fetch(soundUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.5;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start(0);
    } catch (err) {
        console.log('AudioContext play failed:', err);
    }
}

async function waitForSelector(selector: string, timeout = 10000): Promise<Element | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await delay(100);
    }
    return null;
}

async function clickElement(selector: string, stepNum: number, stepName: string, waitAfter = 800): Promise<StepResult> {
    updateStatus(stepNum, `Looking for: ${stepName}...`);
    
    const element = await waitForSelector(selector, 10000);
    
    if (!element) {
        return { success: false, error: `Could not find: ${stepName}\nSelector: ${selector}` };
    }
    
    element.scrollIntoView({ behavior: 'auto', block: 'center' });
    await delay(100);
    
    highlightElement(element, stepName);
    updateStatus(stepNum, `Clicking: ${stepName}`);
    await delay(150);
    
    try {
        playButtonSound(); // Play sound on click
        (element as HTMLElement).click();
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        
        updateStatus(stepNum, `✓ Clicked ${stepName}`);
        if (waitAfter > 0) await delay(waitAfter);
        
        return { success: true };
    } catch (err) {
        return { success: false, error: `Click failed: ${err}` };
    }
}

async function fillAndVerifyField(selector: string, value: string, stepNum: number, fieldName: string): Promise<StepResult> {
    if (!value || value.trim() === '') {
        updateStatus(stepNum, `Skipping empty: ${fieldName}`);
        return { success: true, value: '' };
    }
    
    updateStatus(stepNum, `Filling: ${fieldName} = "${value}"`);
    
    const element = await waitForSelector(selector, 5000) as HTMLInputElement | HTMLSelectElement | null;
    
    if (!element) {
        return { success: false, error: `Field not found: ${fieldName}\nSelector: ${selector}` };
    }
    
    highlightElement(element, `${fieldName}: ${value}`);
    await delay(100);
    
    try {
        element.focus();
        await delay(30);
        
        if (element.tagName === 'SELECT') {
            const select = element as HTMLSelectElement;
            let found = false;
            
            // State abbreviation to full name mapping
            const stateNames: Record<string, string> = {
                'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
                'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
                'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
                'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
                'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
                'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
                'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
                'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
                'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
                'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
                'DC': 'District of Columbia', 'PR': 'Puerto Rico'
            };
            
            const searchAbbrev = value.toUpperCase();
            const fullStateName = stateNames[searchAbbrev] || value;
            console.log(`🔍 Looking for state: "${value}" → "${fullStateName}"`);
            
            // Search through all options
            for (let i = 0; i < select.options.length; i++) {
                const optVal = select.options[i].value;
                const optText = select.options[i].text;
                
                if (optVal === searchAbbrev || optVal === fullStateName ||
                    optText === fullStateName || optText.toUpperCase().includes(fullStateName.toUpperCase()) ||
                    optVal.toUpperCase() === searchAbbrev) {
                    select.selectedIndex = i;
                    select.value = optVal;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`✅ Selected state: "${optText}" (value: "${optVal}")`);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.warn(`State not found for: ${value}. Available:`, Array.from(select.options).slice(0, 10).map(o => o.text));
                return { success: false, error: `Could not find state "${value}" in dropdown` };
            }
        } else {
            const input = element as HTMLInputElement;
            // Clear field completely
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(30);
            
            // Set new value
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        
        await delay(100);
        
        // VERIFY the value was set
        const actualValue = element.tagName === 'SELECT' 
            ? (element as HTMLSelectElement).options[(element as HTMLSelectElement).selectedIndex]?.text
            : (element as HTMLInputElement).value;
        
        if (!actualValue || actualValue.trim() === '') {
            return { success: false, error: `Field "${fieldName}" appears empty after filling!` };
        }
        
        playButtonSound(); // Play sound on successful fill
        updateStatus(stepNum, `✓ Filled ${fieldName}: "${actualValue}"`);
        return { success: true, value: actualValue };
    } catch (err) {
        return { success: false, error: `Fill failed: ${err}` };
    }
}

// ==================== AMAZON STATE DROPDOWN ====================

/**
 * Handle Amazon's custom state dropdown (not a native <select>)
 * Amazon uses a custom dropdown with <a> links inside <li> elements
 */
async function selectAmazonStateDropdown(stateAbbrev: string, stepNum: number): Promise<StepResult> {
    updateStatus(stepNum, `Selecting state: ${stateAbbrev}`);
    
    const searchAbbrev = stateAbbrev.toUpperCase();
    console.log(`🔍 Looking for state dropdown with: "${searchAbbrev}"`);
    
    // State abbreviation to full name mapping
    const stateNames: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
        'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'AS': 'American Samoa', 'GU': 'Guam',
        'MP': 'Northern Mariana Islands', 'VI': 'Virgin Islands', 'FM': 'Federated States of Micronesia',
        'MH': 'Marshall Islands', 'PW': 'Palau', 'AA': 'Armed Forces - AA', 'AE': 'Armed Forces - AE', 'AP': 'Armed Forces - AP'
    };
    
    const fullStateName = stateNames[searchAbbrev] || stateAbbrev;
    console.log(`🔍 State: "${searchAbbrev}" → "${fullStateName}"`);
    
    try {
        // Find and click the STATE dropdown trigger (not country!)
        // The state dropdown has specific IDs containing "StateOrRegion"
        const dropdownTrigger = await waitForSelector(
            '#address-ui-widgets-enterAddressStateOrRegion .a-dropdown-prompt, ' +
            '#address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId .a-dropdown-prompt, ' +
            '[data-csa-c-slot-id*="StateOrRegion"] .a-dropdown-prompt, ' +
            'span[id*="StateOrRegion"] .a-dropdown-prompt',
            5000
        );
        
        if (!dropdownTrigger) {
            return { success: false, error: 'State dropdown trigger not found' };
        }
        
        highlightElement(dropdownTrigger, 'State Dropdown');
        await delay(100);
        
        // Click to open dropdown
        (dropdownTrigger as HTMLElement).click();
        console.log('✅ Clicked state dropdown trigger');
        await delay(300);
        
        // Wait for dropdown list to appear
        await delay(500); // Wait for dropdown to fully render
        
        // Direct selector for the state - build ID based on Amazon's naming pattern
        // The state dropdown options have IDs like: address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId_50 for Texas
        const directSelector = `a.a-dropdown-link[data-value*='"${searchAbbrev}"']`;
        console.log(`🔍 Looking for state with selector: ${directSelector}`);
        
        let stateOption = document.querySelector(directSelector) as HTMLElement | null;
        
        // If not found by abbreviation, search all dropdown links
        if (!stateOption) {
            console.log('🔍 Direct selector failed, searching all dropdown links...');
            const allLinks = document.querySelectorAll('a.a-dropdown-link');
            
            for (const link of allLinks) {
                const text = link.textContent?.trim() || '';
                const dataValue = link.getAttribute('data-value') || '';
                
                if (text === fullStateName || dataValue.includes(`"${searchAbbrev}"`)) {
                    stateOption = link as HTMLElement;
                    console.log(`✅ Found via text search: "${text}"`);
                    break;
                }
            }
        }
        
        if (!stateOption) {
            const available = Array.from(document.querySelectorAll('a.a-dropdown-link')).slice(0, 5).map(a => a.textContent);
            console.warn('Available options:', available);
            return { success: false, error: `Could not find state "${fullStateName}" in dropdown` };
        }
        
        const selectedStateName = stateOption.textContent?.trim() || fullStateName;
        console.log(`✅ Found state option: "${selectedStateName}"`);
        
        highlightElement(stateOption, `State: ${selectedStateName}`);
        await delay(100);
        
        // Click the state option
        stateOption.click();
        console.log(`✅ Clicked state: "${selectedStateName}"`);
        
        await delay(200);
        
        playButtonSound(); // Play sound on state selection
        updateStatus(stepNum, `✓ Selected state: ${selectedStateName}`);
        return { success: true, value: selectedStateName };
        
    } catch (err) {
        return { success: false, error: `State selection failed: ${err}` };
    }
}

// ==================== PAGE DETECTION ====================

function getCurrentPageType(): 'product' | 'checkout' | 'other' {
    const url = window.location.href;
    
    if (url.includes('/dp/') || url.includes('/gp/product/')) {
        return 'product';
    }
    if (url.includes('/checkout/') || url.includes('/gp/buy/') || url.includes('/gp/aw/')) {
        return 'checkout';
    }
    return 'other';
}

// ==================== MAIN AUTOMATION ====================

async function runAutomation(shipping: ShippingData, startFromStep = 1): Promise<void> {
    console.log(`🚀 Running automation from step ${startFromStep}`);
    console.log('📦 Shipping data:', shipping);
    
    // Validate shipping data
    if (!shipping.fullName || !shipping.street || !shipping.city || !shipping.state || !shipping.zipCode) {
        createDebugOverlay();
        showErrorOverlay(0, `Missing required shipping data!\n
            Name: ${shipping.fullName || 'MISSING'}\n
            Street: ${shipping.street || 'MISSING'}\n
            City: ${shipping.city || 'MISSING'}\n
            State: ${shipping.state || 'MISSING'}\n
            ZIP: ${shipping.zipCode || 'MISSING'}`);
        return;
    }
    
    createDebugOverlay();
    
    let result: StepResult;
    const filledValues: Record<string, string> = {};
    
    const saveState = async (step: number) => {
        await saveAutomationState({
            currentStep: step,
            shipping: shipping,
            startTime: Date.now(),
            lastUrl: window.location.href
        });
    };
    
    // STEP 1: Click Buy Now (only on product page)
    if (startFromStep <= 1) {
        const pageType = getCurrentPageType();
        if (pageType === 'product') {
            showAddressPreview(shipping);
            await delay(500);
            
            await saveState(1);
            result = await clickElement('#buy-now-button', 1, 'Buy Now', 1000);
            if (!result.success) {
                showErrorOverlay(1, result.error || 'Buy Now button not found');
                return;
            }
            await saveState(2);
            return; // Page will navigate
        }
    }
    
    // STEP 2: Click Change Delivery Address
    if (startFromStep <= 2) {
        await saveState(2);
        updateStatus(2, 'On checkout page, looking for Change Address...');
        await delay(500);
        
        result = await clickElement('a[aria-label="Change delivery address"]', 2, 'Change delivery address', 800);
        if (!result.success) {
            // Try alternates
            result = await clickElement('[data-testid="change-shipping-address-link"]', 2, 'Change address (alt)', 800);
        }
        if (!result.success) {
            showErrorOverlay(2, result.error || 'Change address link not found.\nMake sure you have at least one saved address.');
            return;
        }
        await saveState(3);
    }
    
    // STEP 3: Click Edit on first address
    if (startFromStep <= 3) {
        await delay(500);
        result = await clickElement('#edit-address-desktop-tango-sasp-0', 3, 'Edit address', 800);
        if (!result.success) {
            const alts = ['a[data-testid="edit-address-link"]', '.address-edit-link'];
            for (const sel of alts) {
                result = await clickElement(sel, 3, 'Edit address (alt)', 800);
                if (result.success) break;
            }
        }
        if (!result.success) {
            showErrorOverlay(3, result.error || 'Edit address link not found');
            return;
        }
        await saveState(4);
    }
    
    // Wait for address form modal
    await delay(800);
    
    // STEP 4-9: Fill address form fields WITH VERIFICATION
    
    // STEP 4: Name
    if (startFromStep <= 4) {
        result = await fillAndVerifyField('#address-ui-widgets-enterAddressFullName', shipping.fullName, 4, 'Full Name');
        if (!result.success) {
            showErrorOverlay(4, result.error || 'Name field failed');
            return;
        }
        filledValues.name = result.value || '';
    }
    
    // STEP 5: Phone (optional)
    if (startFromStep <= 5) {
        result = await fillAndVerifyField('#address-ui-widgets-enterAddressPhoneNumber', shipping.phone || '', 5, 'Phone');
        filledValues.phone = result.value || 'Not provided';
    }
    
    // STEP 6: Street Address
    if (startFromStep <= 6) {
        result = await fillAndVerifyField('#address-ui-widgets-enterAddressLine1', shipping.street, 6, 'Street Address');
        if (!result.success) {
            showErrorOverlay(6, result.error || 'Street address field failed');
            return;
        }
        filledValues.street = result.value || '';
    }
    
    // STEP 7: City
    if (startFromStep <= 7) {
        result = await fillAndVerifyField('#address-ui-widgets-enterAddressCity', shipping.city, 7, 'City');
        if (!result.success) {
            showErrorOverlay(7, result.error || 'City field failed');
            return;
        }
        filledValues.city = result.value || '';
    }
    
    // STEP 8: State (Amazon custom dropdown)
    if (startFromStep <= 8) {
        result = await selectAmazonStateDropdown(shipping.state, 8);
        if (!result.success) {
            showErrorOverlay(8, result.error || 'State field failed');
            return;
        }
        filledValues.state = result.value || '';
    }
    
    // STEP 9: ZIP Code
    if (startFromStep <= 9) {
        result = await fillAndVerifyField('#address-ui-widgets-enterAddressPostalCode', shipping.zipCode, 9, 'ZIP Code');
        if (!result.success) {
            showErrorOverlay(9, result.error || 'ZIP code field failed');
            return;
        }
        filledValues.zip = result.value || '';
    }
    
    // ========== STOP HERE - DO NOT PROCEED TO CHECKOUT ==========
    await clearAutomationState(true); // Full clear - form is filled, job done
    showFilledSummary(shipping, filledValues);
    
    console.log('🛑 AUTOMATION STOPPED - User must manually review and click Continue');
}

// ==================== INITIALIZATION ====================

async function initFulfillment(): Promise<boolean> {
    await delay(300);
    
    const pageType = getCurrentPageType();
    console.log('📍 Current page type:', pageType);
    
    // Check for saved state (resuming after page nav)
    const savedState = await getAutomationState();
    
    if (savedState) {
        console.log('📦 Found saved state, step:', savedState.currentStep);
        
        // Validate: If on product page, we should only be at step 1
        // If state is > 1, it means we're resuming on wrong page - reset
        if (pageType === 'product' && savedState.currentStep > 1) {
            console.warn('⚠️ On product page but state is step', savedState.currentStep, '- resetting');
            await clearAutomationState();
            // Continue to check for pending order below
        } else if (pageType === 'checkout' && savedState.currentStep >= 2) {
            // Valid: Resume on checkout page
            console.log('📦 Resuming automation from step:', savedState.currentStep);
            createDebugOverlay();
            updateStatus(savedState.currentStep, 'Resuming automation...');
            await delay(400);
            await runAutomation(savedState.shipping, savedState.currentStep);
            return true;
        } else {
            // Invalid state - clear it
            console.warn('⚠️ Invalid state/page combo - clearing state');
            await clearAutomationState();
        }
    }
    
    // Check for new pending order
    const data = await new Promise<any>((resolve) => {
        chrome.storage.local.get(['pendingAmazonOrder', 'autoOrderInProgress'], resolve);
    });
    
    if (data.pendingAmazonOrder && data.autoOrderInProgress) {
        console.log('📦 Found pending order:', data.pendingAmazonOrder);
        
        const order = data.pendingAmazonOrder as PendingAmazonOrder;
        
        console.log('📦 Shipping data from eBay:', order.shipping);
        console.log('📍 Page type:', pageType);
        
        if (pageType === 'product') {
            const buyNow = document.querySelector('#buy-now-button');
            if (!buyNow) {
                createDebugOverlay();
                showErrorOverlay(0, 'No Buy Now button found.\nPlease use a Prime-eligible product.');
                return true; // Error shown, don't retry
            }
            // Start from step 1 - click Buy Now
            await runAutomation(order.shipping, 1);
            return true;
        } else if (pageType === 'checkout') {
            // Already on checkout, start from step 2
            await runAutomation(order.shipping, 2);
            return true;
        } else {
            console.log('📍 Not on product or checkout page, waiting...');
            return false; // Will retry
        }
    }
    
    // No pending order found
    return false;
}

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: any) => {
    if (window.self !== window.top) return false;
    
    if (msg.type === 'startFulfillment' && msg.shipping) {
        runAutomation(msg.shipping, 1)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: String(err) }));
        return true;
    }
    
    return false;
});

export { runAutomation as fulfillAmazonOrder };
export type { ShippingData };

// ==================== STARTUP WITH RETRY ====================

async function startWithRetry(): Promise<void> {
    console.log(`🔄 Init attempt ${initAttempts + 1}/${MAX_INIT_ATTEMPTS}`);
    initAttempts++;
    
    try {
        const didRun = await initFulfillment();
        
        if (!didRun && initAttempts < MAX_INIT_ATTEMPTS) {
            console.log('⏳ No automation started, will retry in 2s...');
            setTimeout(startWithRetry, 2000);
        } else if (didRun) {
            console.log('✅ Automation started successfully');
        }
    } catch (err) {
        console.error('❌ Init failed:', err);
        if (initAttempts < MAX_INIT_ATTEMPTS) {
            console.log('🔄 Retrying in 2s...');
            setTimeout(startWithRetry, 2000);
        }
    }
}

// ==================== SCRIPT ENTRY POINT ====================

if (window.self !== window.top) {
    // Running in iframe - exit silently
} else {
    console.log('🚚 Syndrax Fulfillment loaded (top-level)');
    console.log('📍 URL:', window.location.href);
    startWithRetry();
}
