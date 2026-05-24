/**
 * sniper-overlay.ts — Syndrax Sniper Content Script
 * Injected on Amazon product pages.
 * Floating button + slide-in panel for fast eBay listing.
 */

// ─── Guard: only run on product pages ────────────────────────────────────────

if (!document.querySelector('#productTitle')) {
  // Not a product page — do nothing
} else {
  initSniper();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SniperProductData {
  asin: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  brand: string;
  bullets: string[];
}

interface ComplianceResult {
  status: 'clear' | 'warning' | 'blocked';
  brand: string;
  message: string;
}

// ─── Main init ────────────────────────────────────────────────────────────────

function initSniper() {
  // Check if sniper is enabled (default: enabled)
  chrome.storage.local.get('sniper_enabled', (result) => {
    if (result.sniper_enabled === false) return;
    injectStyles();
    createFloatingButton();
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('syndrax-sniper-styles')) return;
  const style = document.createElement('style');
  style.id = 'syndrax-sniper-styles';
  style.textContent = `
    #syndrax-sniper-btn {
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      border: none;
      cursor: pointer;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 16px rgba(6,182,212,0.4);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: syndrax-pulse 2s ease-in-out 3;
    }
    #syndrax-sniper-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(6,182,212,0.6);
    }
    #syndrax-sniper-btn:hover::after {
      content: 'Sniper — List on eBay';
      position: absolute;
      right: 56px;
      top: 50%;
      transform: translateY(-50%);
      background: #0f172a;
      color: #22d3ee;
      font-size: 12px;
      font-family: -apple-system, sans-serif;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      border: 1px solid rgba(34,211,238,0.3);
      pointer-events: none;
    }
    @keyframes syndrax-pulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(6,182,212,0.4); }
      50% { box-shadow: 0 4px 32px rgba(6,182,212,0.8); }
    }
    #syndrax-sniper-panel {
      position: fixed;
      right: 0;
      top: 0;
      width: 380px;
      height: 100vh;
      background: #02050f;
      border-left: 1px solid rgba(34,211,238,0.2);
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
      z-index: 999998;
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 300ms ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #e2e8f0;
    }
    #syndrax-sniper-panel.open {
      transform: translateX(0);
    }
    .sniper-section {
      padding: 16px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .sniper-section:first-child {
      border-top: none;
    }
    .sniper-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 8px;
    }
    .sniper-input {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 12px;
      color: #e2e8f0;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .sniper-input:focus {
      border-color: #06b6d4;
    }
    .sniper-btn-primary {
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .sniper-btn-primary:hover { opacity: 0.9; }
    .sniper-btn-secondary {
      flex: 1;
      padding: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #94a3b8;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sniper-btn-secondary:hover { background: rgba(255,255,255,0.1); }
    .sniper-btn-gen {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: opacity 0.2s;
    }
    .sniper-btn-gen:hover { opacity: 0.85; }
    .sniper-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #065f46;
      color: #6ee7b7;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 9999999;
      border: 1px solid rgba(110,231,183,0.3);
      animation: sniper-fadein 0.3s ease;
    }
    .sniper-toast.error {
      background: #7f1d1d;
      color: #fca5a5;
      border-color: rgba(252,165,165,0.3);
    }
    @keyframes sniper-fadein {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .sniper-score-bar {
      height: 4px;
      border-radius: 2px;
      background: #1e293b;
      overflow: hidden;
      margin-top: 4px;
    }
    .sniper-score-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s ease, background 0.3s ease;
    }
    .sniper-compliance-card {
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sniper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .sniper-row-label { color: #64748b; }
    .sniper-row-value { color: #e2e8f0; font-weight: 500; }
    .sniper-row-value.cyan { color: #22d3ee; }
    .sniper-row-value.green { color: #34d399; }
    .sniper-row-value.amber { color: #fbbf24; }
    .sniper-row-value.red { color: #f87171; }
    .sniper-char-counter { font-size: 11px; }
    .sniper-char-counter.green { color: #34d399; }
    .sniper-char-counter.cyan { color: #22d3ee; }
    .sniper-char-counter.red { color: #f87171; }
    .sniper-model-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 8px;
    }
    .sniper-model-badge.local { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }
    .sniper-model-badge.cloud { background: rgba(96,165,250,0.15); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3); }
  `;
  document.head.appendChild(style);
}

// ─── Floating Button ──────────────────────────────────────────────────────────

function createFloatingButton() {
  if (document.getElementById('syndrax-sniper-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'syndrax-sniper-btn';
  btn.innerHTML = '⚡';
  btn.title = 'Sniper — List on eBay';
  document.body.appendChild(btn);

  createPanel();

  btn.addEventListener('click', () => {
    const panel = document.getElementById('syndrax-sniper-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
    } else {
      panel.classList.add('open');
      loadPanelData();
    }
  });
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function createPanel() {
  if (document.getElementById('syndrax-sniper-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'syndrax-sniper-panel';
  panel.innerHTML = `
    <div id="syndrax-sniper-inner">
      <div style="padding:16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;gap:10px;">
          <img id="sniper-thumb" src="" style="width:40px;height:40px;border-radius:6px;object-fit:cover;display:none;" />
          <div>
            <div style="font-size:15px;font-weight:700;color:#22d3ee;">⚡ Sniper</div>
            <div id="sniper-asin" style="font-size:10px;font-family:monospace;color:#64748b;"></div>
          </div>
        </div>
        <button id="sniper-close" style="background:none;border:none;color:#64748b;font-size:20px;cursor:pointer;padding:4px 8px;line-height:1;">×</button>
      </div>

      <!-- Product Info -->
      <div class="sniper-section" id="sniper-product-section">
        <div class="sniper-label">Product</div>
        <div id="sniper-title-display" style="font-size:13px;color:#e2e8f0;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;"></div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:6px;">
          <span id="sniper-price-display" style="font-size:16px;font-weight:700;color:#22d3ee;"></span>
          <span id="sniper-brand-display" style="font-size:12px;color:#64748b;"></span>
        </div>
        <div id="sniper-bullets-toggle" style="font-size:11px;color:#06b6d4;cursor:pointer;display:none;">▶ Show features</div>
        <ul id="sniper-bullets-list" style="display:none;margin:8px 0 0 0;padding-left:16px;font-size:12px;color:#94a3b8;line-height:1.6;"></ul>
      </div>

      <!-- eBay Title Generator -->
      <div class="sniper-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div class="sniper-label" style="margin-bottom:0;">eBay Title</div>
          <span id="sniper-char-count" class="sniper-char-counter green">0/80</span>
        </div>
        <textarea id="sniper-title-input" class="sniper-input" rows="2" style="resize:none;line-height:1.4;" placeholder="Generate or type eBay title..."></textarea>
        <div class="sniper-score-bar" style="margin-top:6px;">
          <div id="sniper-score-fill" class="sniper-score-fill" style="width:0%;background:#34d399;"></div>
        </div>
        <div id="sniper-score-label" style="font-size:11px;color:#64748b;margin-top:3px;">SEO Score: 0/100</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button id="sniper-gen-local" class="sniper-btn-gen" style="background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3);">⚡ Generate (LOCAL)</button>
          <button id="sniper-gen-cloud" class="sniper-btn-gen" style="background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3);">☁ Generate (CLOUD)</button>
        </div>
        <div id="sniper-model-badge-container" style="margin-top:6px;min-height:18px;"></div>
      </div>

      <!-- Price Calculator -->
      <div class="sniper-section">
        <div class="sniper-label">Price Calculator</div>
        <div class="sniper-row">
          <span class="sniper-row-label">Amazon Price</span>
          <span id="calc-amazon-price" class="sniper-row-value cyan">—</span>
        </div>
        <div class="sniper-row">
          <span class="sniper-row-label">Markup</span>
          <input id="calc-markup" type="number" value="2.0" min="1.1" step="0.1"
            style="width:70px;background:#0f172a;border:1px solid #334155;border-radius:4px;padding:4px 8px;color:#e2e8f0;font-size:13px;outline:none;text-align:right;" />
        </div>
        <div class="sniper-row">
          <span class="sniper-row-label">eBay Price</span>
          <span id="calc-ebay-price" class="sniper-row-value" style="font-weight:700;color:#fff;">—</span>
        </div>
        <div class="sniper-row">
          <span class="sniper-row-label">Est. Profit</span>
          <span id="calc-profit" class="sniper-row-value green">—</span>
        </div>
        <div class="sniper-row" style="margin-bottom:0;">
          <span class="sniper-row-label">Margin</span>
          <span id="calc-margin" class="sniper-row-value green">—</span>
        </div>
      </div>

      <!-- Compliance Check -->
      <div class="sniper-section">
        <div class="sniper-label">Compliance</div>
        <div id="sniper-compliance-result" class="sniper-compliance-card" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#64748b;">
          ⏳ Checking...
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="sniper-section" style="position:sticky;bottom:0;background:#02050f;padding-bottom:20px;">
        <button id="sniper-list-btn" class="sniper-btn-primary" style="margin-bottom:10px;">⚡ List on eBay</button>
        <div style="display:flex;gap:8px;">
          <button id="sniper-research-btn" class="sniper-btn-secondary">🔍 Research Competitors</button>
          <button id="sniper-scan-btn" class="sniper-btn-secondary">📊 Scan Seller</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Close button
  panel.querySelector('#sniper-close')?.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Title input → live SEO score + char count
  const titleInput = panel.querySelector('#sniper-title-input') as HTMLTextAreaElement;
  titleInput?.addEventListener('input', () => {
    updateCharCount(titleInput.value);
    updateSeoScore(titleInput.value, '');
  });

  // Markup input → live price calc
  const markupInput = panel.querySelector('#calc-markup') as HTMLInputElement;
  markupInput?.addEventListener('input', () => {
    recalcPrice();
  });

  // Generate buttons
  panel.querySelector('#sniper-gen-local')?.addEventListener('click', () => generateTitle('LOCAL'));
  panel.querySelector('#sniper-gen-cloud')?.addEventListener('click', () => generateTitle('CLOUD'));

  // List button
  panel.querySelector('#sniper-list-btn')?.addEventListener('click', () => listOnEbay());

  // Research button
  panel.querySelector('#sniper-research-btn')?.addEventListener('click', () => {
    const titleInput = document.getElementById('sniper-title-input') as HTMLTextAreaElement;
    const query = encodeURIComponent(titleInput?.value || currentData?.title || '');
    window.open(`https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Complete=1&LH_Sold=1&_sop=13`, '_blank');
  });

  // Scan seller button
  panel.querySelector('#sniper-scan-btn')?.addEventListener('click', () => {
    showToast('📊 Scan Seller — Coming soon', false);
  });

  // Bullets toggle
  panel.querySelector('#sniper-bullets-toggle')?.addEventListener('click', () => {
    const list = document.getElementById('sniper-bullets-list');
    const toggle = document.getElementById('sniper-bullets-toggle');
    if (!list || !toggle) return;
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'block' : 'none';
    toggle.textContent = isHidden ? '▼ Hide features' : '▶ Show features';
  });
}

// ─── Current data store ───────────────────────────────────────────────────────

let currentData: SniperProductData | null = null;

// ─── Load panel data ──────────────────────────────────────────────────────────

function loadPanelData() {
  const data = scrapeProductData();
  currentData = data;

  // Header
  const thumb = document.getElementById('sniper-thumb') as HTMLImageElement;
  if (thumb && data.image) {
    thumb.src = data.image;
    thumb.style.display = 'block';
  }
  const asinEl = document.getElementById('sniper-asin');
  if (asinEl) asinEl.textContent = data.asin ? `ASIN: ${data.asin}` : '';

  // Product info
  const titleDisplay = document.getElementById('sniper-title-display');
  if (titleDisplay) titleDisplay.textContent = data.title;

  const priceDisplay = document.getElementById('sniper-price-display');
  if (priceDisplay) priceDisplay.textContent = data.price || 'Price N/A';

  const brandDisplay = document.getElementById('sniper-brand-display');
  if (brandDisplay) brandDisplay.textContent = data.brand;

  // Bullets
  const bulletsList = document.getElementById('sniper-bullets-list');
  const bulletsToggle = document.getElementById('sniper-bullets-toggle');
  if (bulletsList && data.bullets.length > 0) {
    bulletsList.innerHTML = data.bullets.map(b => `<li>${b}</li>`).join('');
    if (bulletsToggle) bulletsToggle.style.display = 'block';
  }

  // Price calculator
  const amazonPriceEl = document.getElementById('calc-amazon-price');
  if (amazonPriceEl) amazonPriceEl.textContent = data.price || '—';
  recalcPrice();

  // Compliance check (1 second delay)
  setTimeout(() => runComplianceCheck(data.title, data.brand), 1000);
}

// ─── Scrape product data ──────────────────────────────────────────────────────

function scrapeProductData(): SniperProductData {
  const asin = (
    (document.querySelector('[data-asin]') as HTMLElement)?.getAttribute('data-asin') ||
    window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ||
    ''
  );

  const title = (document.querySelector('#productTitle') as HTMLElement)?.textContent?.trim() || '';

  const rawPrice = (
    (document.querySelector('.a-price .a-offscreen') as HTMLElement)?.textContent ||
    (document.querySelector('#price_inside_buybox') as HTMLElement)?.textContent ||
    (document.querySelector('.a-price-whole') as HTMLElement)?.textContent ||
    ''
  ).trim();

  const priceNum = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;

  const image = (
    (document.querySelector('#landingImage') as HTMLImageElement)?.getAttribute('src') ||
    (document.querySelector('#imgBlkFront') as HTMLImageElement)?.getAttribute('src') ||
    ''
  );

  const brand = (document.querySelector('#bylineInfo') as HTMLElement)?.textContent?.trim() || '';

  const bullets = [...document.querySelectorAll('#feature-bullets li span')]
    .map(el => el.textContent?.trim() || '')
    .filter(t => t.length > 10)
    .slice(0, 5);

  return { asin, title, price: rawPrice, priceNum, image, brand, bullets };
}

// ─── SEO Score ────────────────────────────────────────────────────────────────

function calculateSeoScore(title: string, brand: string): number {
  if (!title) return 0;
  let score = 0;
  const words = title.toLowerCase().split(/\s+/);
  const len = title.length;

  // Length scoring
  if (len >= 72 && len <= 80) score += 25;
  else if (len >= 60 && len < 72) score += 15;

  // No filler words
  const fillers = ['new', 'the', 'a', 'an', 'for', 'with', 'and', 'its', 'this'];
  let fillerPenalty = 0;
  words.forEach(w => { if (fillers.includes(w)) fillerPenalty += 3; });
  score += Math.max(0, 20 - fillerPenalty);

  // Brand in first 3 words
  if (brand) {
    const brandLower = brand.toLowerCase().replace(/^visit the |store$/gi, '').trim();
    const first3 = words.slice(0, 3).join(' ');
    if (brandLower && first3.includes(brandLower.split(' ')[0])) score += 20;
  }

  // Contains number or model info
  if (/\d/.test(title)) score += 15;

  // No repeated words
  const wordSet = new Set(words);
  if (wordSet.size === words.length) score += 20;

  return Math.min(100, score);
}

function updateSeoScore(title: string, brand: string) {
  const score = calculateSeoScore(title, brand || currentData?.brand || '');
  const fill = document.getElementById('sniper-score-fill');
  const label = document.getElementById('sniper-score-label');
  if (!fill || !label) return;

  fill.style.width = `${score}%`;
  if (score >= 80) {
    fill.style.background = '#34d399';
  } else if (score >= 50) {
    fill.style.background = '#fbbf24';
  } else {
    fill.style.background = '#f87171';
  }
  label.textContent = `SEO Score: ${score}/100`;
}

function updateCharCount(title: string) {
  const counter = document.getElementById('sniper-char-count');
  if (!counter) return;
  const len = title.length;
  counter.textContent = `${len}/80`;
  counter.className = 'sniper-char-counter';
  if (len <= 72) counter.classList.add('green');
  else if (len <= 80) counter.classList.add('cyan');
  else counter.classList.add('red');
}

// ─── Price Calculator ─────────────────────────────────────────────────────────

function recalcPrice() {
  const markupInput = document.getElementById('calc-markup') as HTMLInputElement;
  const markup = parseFloat(markupInput?.value || '2.0') || 2.0;
  const amazonPrice = currentData?.priceNum || 0;

  if (!amazonPrice) return;

  const ebayPrice = amazonPrice * markup;
  const fees = ebayPrice * 0.159;
  const profit = ebayPrice - amazonPrice - fees;
  const margin = (profit / ebayPrice) * 100;

  const ebayEl = document.getElementById('calc-ebay-price');
  const profitEl = document.getElementById('calc-profit');
  const marginEl = document.getElementById('calc-margin');

  if (ebayEl) ebayEl.textContent = `$${ebayPrice.toFixed(2)}`;

  if (profitEl) {
    profitEl.textContent = `$${profit.toFixed(2)}`;
    profitEl.className = 'sniper-row-value ' + (profit >= 0 ? 'green' : 'red');
  }

  if (marginEl) {
    marginEl.textContent = `${margin.toFixed(1)}%`;
    const color = margin >= 20 ? 'green' : margin >= 10 ? 'amber' : 'red';
    marginEl.className = `sniper-row-value ${color}`;
  }
}

// ─── Title Generation ─────────────────────────────────────────────────────────

function generateTitle(mode: 'LOCAL' | 'CLOUD') {
  if (!currentData) return;

  const btn = document.getElementById(mode === 'LOCAL' ? 'sniper-gen-local' : 'sniper-gen-cloud') as HTMLButtonElement;
  if (btn) { btn.textContent = '⏳ Generating...'; btn.disabled = true; }

  const prompt = `Generate an optimized eBay listing title under 80 characters.
Product: ${currentData.title}
Brand: ${currentData.brand}
Key features: ${currentData.bullets.join(', ')}
Rules:
- No filler words (new, the, a, an, for, with, and, its, this)
- Put brand and product type in first 3 words
- Include top 3 searchable keywords
- Must be under 80 characters
- Return ONLY the title, nothing else, no quotes`;

  chrome.runtime.sendMessage(
    { type: 'SNIPER_GENERATE_TITLE', payload: { prompt, productData: currentData, preferCloud: mode === 'CLOUD' } },
    (response: { title: string; model: string; error?: string }) => {
      if (btn) { btn.textContent = mode === 'LOCAL' ? '⚡ Generate (LOCAL)' : '☁ Generate (CLOUD)'; btn.disabled = false; }

      if (response?.title) {
        const titleInput = document.getElementById('sniper-title-input') as HTMLTextAreaElement;
        if (titleInput) {
          titleInput.value = response.title;
          updateCharCount(response.title);
          updateSeoScore(response.title, currentData?.brand || '');
        }

        const badgeContainer = document.getElementById('sniper-model-badge-container');
        if (badgeContainer) {
          const isLocal = response.model === 'LOCAL';
          badgeContainer.innerHTML = `<span class="sniper-model-badge ${isLocal ? 'local' : 'cloud'}">${isLocal ? 'LOCAL qwen2.5' : 'CLOUD claude'}</span>`;
        }
      } else {
        showToast(`❌ Generation failed: ${response?.error || 'Unknown error'}`, true);
      }
    }
  );
}

// ─── Compliance Check ─────────────────────────────────────────────────────────

function runComplianceCheck(title: string, brand: string) {
  const resultEl = document.getElementById('sniper-compliance-result');
  if (resultEl) resultEl.innerHTML = '⏳ Checking...';

  chrome.runtime.sendMessage(
    { type: 'SNIPER_COMPLIANCE_CHECK', payload: { title, brand } },
    (response: ComplianceResult) => {
      if (!resultEl) return;
      if (response?.status === 'blocked') {
        resultEl.innerHTML = `❌ BLOCKED — VERO brand detected: <strong>${response.brand}</strong> — Do not list`;
        resultEl.style.cssText = 'background:rgba(127,29,29,0.3);border:1px solid rgba(248,113,113,0.4);color:#fca5a5;padding:10px 12px;border-radius:8px;font-size:12px;';
      } else if (response?.status === 'warning') {
        resultEl.innerHTML = `⚠️ WARNING — Possible protected brand: <strong>${response.brand}</strong>`;
        resultEl.style.cssText = 'background:rgba(120,53,15,0.3);border:1px solid rgba(251,191,36,0.4);color:#fde68a;padding:10px 12px;border-radius:8px;font-size:12px;';
      } else {
        resultEl.innerHTML = '✅ CLEAR — No VERO violations detected';
        resultEl.style.cssText = 'background:rgba(6,78,59,0.3);border:1px solid rgba(52,211,153,0.4);color:#6ee7b7;padding:10px 12px;border-radius:8px;font-size:12px;';
      }
    }
  );
}

// ─── List on eBay ─────────────────────────────────────────────────────────────

function listOnEbay() {
  if (!currentData) return;

  const titleInput = document.getElementById('sniper-title-input') as HTMLTextAreaElement;
  const markupInput = document.getElementById('calc-markup') as HTMLInputElement;
  const markup = parseFloat(markupInput?.value || '2.0') || 2.0;
  const ebayPrice = currentData.priceNum * markup;

  const pendingListing = {
    asin: currentData.asin,
    title: titleInput?.value || currentData.title,
    price: ebayPrice,
    amazonPrice: currentData.priceNum,
    markup,
    image: currentData.image,
    brand: currentData.brand,
    bullets: currentData.bullets,
    timestamp: new Date().toISOString()
  };

  chrome.runtime.sendMessage(
    { type: 'SNIPER_LIST_ITEM', payload: pendingListing },
    (response: { ok: boolean; error?: string }) => {
      if (response?.ok) {
        showToast('✅ Opening eBay listing form...', false);
      } else {
        showToast(`❌ Error: ${response?.error || 'Failed to open eBay'}`, true);
      }
    }
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message: string, isError: boolean) {
  const existing = document.getElementById('syndrax-sniper-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'syndrax-sniper-toast';
  toast.className = `sniper-toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}
