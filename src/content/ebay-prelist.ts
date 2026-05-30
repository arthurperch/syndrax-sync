// Content script for eBay prelist page — drives the full search → match → condition flow
// Runs on: *://*.ebay.com/sl/prelist/*  and  *://*.ebay.com/sl/sell/identif*
//
// Flow:
//   1. URL arrives with ?title= pre-filled by listing-handler.ts
//   2. Click Search (keyword already in box from URL param; fill it if missing)
//   3. "Find a match" page → always click "Continue without match"
//   4. Condition dialog → select New (handles both old button UI + new radio modal)
//   5. eBay redirects to /sl/sell?... → ebay-listing-creator.ts takes over

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll<T>(
  fn: () => T | null,
  timeout = 15000,
  interval = 150    // was 400ms — faster polling
): Promise<T | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }
  return null;
}

function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function showStatus(msg: string, color = '#00CFFF'): HTMLDivElement {
  document.getElementById('syndrax-prelist-status')?.remove();
  const el = document.createElement('div');
  el.id = 'syndrax-prelist-status';
  el.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 999999;
    background: #0a0f1e; border: 1px solid ${color}; border-radius: 8px;
    padding: 10px 14px; color: ${color}; font-family: system-ui, sans-serif;
    font-size: 12px; font-weight: 600; line-height: 1.5; max-width: 300px;
    box-shadow: 0 4px 20px rgba(0,207,255,0.25);
  `;
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  document.body.appendChild(el);
  return el as HTMLDivElement;
}

function updateStatus(el: HTMLDivElement, msg: string, color?: string): void {
  el.innerHTML = `<span style="opacity:.7">⚡ Syndrax Sync</span><br>${msg}`;
  if (color) { el.style.borderColor = color; el.style.color = color; }
}

// ── Simulate a real click with pointer events ──────────────────────────────────
async function realClick(el: HTMLElement): Promise<void> {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const opts: MouseEventInit = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
  el.dispatchEvent(new PointerEvent('pointerover', opts));
  el.dispatchEvent(new MouseEvent('mouseover', opts));
  await sleep(50);
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, button: 0, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...opts, button: 0, buttons: 1 }));
  await sleep(50);
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, button: 0 }));
  el.dispatchEvent(new MouseEvent('mouseup', { ...opts, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { ...opts, button: 0 }));
}

// ── PHASE 1: Search ────────────────────────────────────────────────────────────

async function phaseSearch(title: string, statusEl: HTMLDivElement): Promise<boolean> {
  updateStatus(statusEl, `Searching: ${title.slice(0, 40)}…`);

  const alreadyOnMatchPage =
    window.location.href.includes('/sl/prelist/identify') ||
    !!document.querySelector('h1, h2')?.textContent?.toLowerCase().includes('find a match') ||
    !!document.querySelector('[class*="radix-match"], [class*="find-a-match"], .prelist-radix');

  if (alreadyOnMatchPage) {
    console.log('[Syndrax Prelist] Already on match results page — skipping search phase');
    return true;
  }

  const searchBtn = await poll<HTMLButtonElement>(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(btn => {
      const text = btn.textContent?.trim().toLowerCase() || '';
      const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
      return text === 'search' || label === 'search' || text.includes('search ebay');
    }) ?? null;
  }, 8000);

  if (!searchBtn) {
    console.log('[Syndrax Prelist] No search button — assuming already past search step');
    return true;
  }

  const searchInput = document.querySelector<HTMLInputElement>(
    'input[type="search"], input[type="text"]:not([disabled])'
  );
  if (searchInput && !searchInput.value.trim()) {
    searchInput.focus();
    setNativeValue(searchInput, title);
    await sleep(200);
  }

  console.log('[Syndrax Prelist] Clicking Search...');
  searchBtn.click();
  return true;
}

// ── PHASE 1.5: Category selection (if eBay shows category picker first) ──────
// eBay sometimes shows a category picker before/after "Continue without match".
// If visible, click the first suggested category then click "Done".

async function phaseCategory(statusEl: HTMLDivElement): Promise<void> {
  // Check if category picker is currently open
  const categoryPicker = document.querySelector(
    '.category-picker-radix__sidepane, .lightbox-dialog[aria-hidden="false"] .category-picker, .category-picker'
  );
  if (!categoryPicker) return;

  updateStatus(statusEl, 'Selecting category…');
  console.log('[Syndrax Prelist] Category picker detected — selecting first suggestion');

  // Click first suggested category button
  const firstSuggested = await poll<HTMLButtonElement>(() => {
    return (
      // Suggested category card buttons
      document.querySelector<HTMLButtonElement>('.se-panel-section .se-field-card__body') ||
      // Any category button with a name attribute (category ID)
      document.querySelector<HTMLButtonElement>('button.se-field-card__body[name]')
    ) ?? null;
  }, 4000);

  if (firstSuggested) {
    console.log(`[Syndrax Prelist] Clicking category: "${firstSuggested.textContent?.trim().slice(0, 50)}"`);
    await realClick(firstSuggested);
    await sleep(500);
  }

  // Click "Done" button in the category picker
  const doneBtn = await poll<HTMLButtonElement>(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => {
      const text = b.textContent?.trim().toLowerCase() || '';
      return text === 'done' && !b.disabled;
    }) ?? null;
  }, 3000);

  if (doneBtn) {
    console.log('[Syndrax Prelist] Clicking Done to confirm category');
    await realClick(doneBtn);
    await sleep(600);
  }
}

// ── PHASE 2: Skip catalog match ───────────────────────────────────────────────

async function phaseMatch(statusEl: HTMLDivElement): Promise<void> {
  updateStatus(statusEl, 'Skipping catalog match…');

  // First handle any category picker that might be open before we can skip
  await phaseCategory(statusEl);

  const skipBtn = await poll<HTMLButtonElement>(() => {
    // "Continue without match" — only enabled once category is set (if required)
    const byClass = document.querySelector<HTMLButtonElement>('button.prelist-radix__next-action');
    if (byClass) return byClass;
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button, a')).find(el => {
      const text = el.textContent?.trim().toLowerCase() || '';
      return (
        text.includes('continue without match') ||
        text.includes('continue without') ||
        text.includes('without a match') ||
        text === 'skip'
      );
    }) as HTMLButtonElement ?? null;
  }, 15000);

  if (!skipBtn) {
    console.log('[Syndrax Prelist] Match page not shown — continuing...');
    return;
  }

  console.log(`[Syndrax Prelist] Clicking "${skipBtn.textContent?.trim()}"...`);

  // If "Continue without match" is disabled, category may be required first
  if (skipBtn.disabled || skipBtn.getAttribute('aria-disabled') === 'true') {
    console.log('[Syndrax Prelist] Skip button disabled — need to select category first');
    // Open the category picker by clicking the "None selected" button
    const categoryBtn = document.querySelector<HTMLButtonElement>('button.category-button, button[aria-label*="category" i]');
    if (categoryBtn) {
      await realClick(categoryBtn);
      await sleep(500);
      await phaseCategory(statusEl);
    }
    // Wait for skip button to become enabled
    await poll(() => (!skipBtn.disabled && skipBtn.getAttribute('aria-disabled') !== 'true') ? true : null, 4000);
  }

  skipBtn.click();
  await sleep(800);

  // Category picker may appear AFTER clicking skip too
  await phaseCategory(statusEl);
}

// ── PHASE 3: Condition selection ──────────────────────────────────────────────
// eBay shows TWO different UIs depending on the flow:
//   A) Old UI: <button class="condition-button"> with aria-pressed
//   B) New modal: <dialog> or overlay with <input type="radio"> or styled radio items

async function phaseCondition(statusEl: HTMLDivElement): Promise<boolean> {
  updateStatus(statusEl, 'Setting condition: New…');

  // ── Approach A: New modal radio UI (the "Confirm details" dialog) ──────────
  // This is what the current eBay flow shows — radio buttons labeled
  // "New with tags", "New without tags", "New with defects", "Pre-owned"
  const radioCondition = await poll<HTMLElement>(() => {
    // Try native radio inputs first
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const newRadio = radios.find(r => {
      const label = r.closest('label')?.textContent?.toLowerCase() ||
                    document.querySelector(`label[for="${r.id}"]`)?.textContent?.toLowerCase() ||
                    r.value?.toLowerCase() || '';
      return label.includes('new with tags') || label.includes('new without') || label === 'new';
    });
    if (newRadio) return newRadio;

    // Try clickable list items / styled radio buttons in modal
    const items = Array.from(document.querySelectorAll<HTMLElement>(
      'li, [role="radio"], [role="option"], [class*="condition-item"], [class*="condition-row"]'
    ));
    return items.find(item => {
      const text = item.textContent?.trim().toLowerCase() || '';
      return text.startsWith('new with tags') || text.startsWith('new without tags') || text === 'new';
    }) ?? null;
  }, 6000);

  if (radioCondition) {
    console.log('[Syndrax Prelist] Found condition radio/item — clicking "New"');

    if (radioCondition instanceof HTMLInputElement && radioCondition.type === 'radio') {
      // Native radio — click the label for proper event propagation
      const label = radioCondition.closest('label') ||
                    document.querySelector(`label[for="${radioCondition.id}"]`);
      if (label) {
        await realClick(label as HTMLElement);
      } else {
        radioCondition.checked = true;
        radioCondition.dispatchEvent(new Event('change', { bubbles: true }));
        radioCondition.dispatchEvent(new Event('click', { bubbles: true }));
      }
    } else {
      // Styled item — simulate real click
      await realClick(radioCondition);
    }

    await sleep(300);
    console.log('[Syndrax Prelist] Condition selected via radio/item UI');
  } else {
    // ── Approach B: Old button.condition-button UI with aria-pressed ──────────
    console.log('[Syndrax Prelist] No radio UI found — trying legacy button.condition-button...');

    const conditionBtn = await poll<HTMLButtonElement>(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(
        'button.condition-button, li.condition-button-list__item button, [data-testid*="condition"] button'
      ));
      // Try with aria-pressed first
      const withAriaPressed = buttons.find(btn =>
        btn.getAttribute('aria-pressed') !== null &&
        (btn.textContent?.trim().toLowerCase().startsWith('new with tags') ||
         btn.textContent?.trim().toLowerCase().startsWith('new without'))
      );
      if (withAriaPressed) return withAriaPressed;

      // Also try without aria-pressed check (click even if framework not fully ready)
      return buttons.find(btn =>
        btn.textContent?.trim().toLowerCase().startsWith('new with tags') ||
        btn.textContent?.trim().toLowerCase().startsWith('new without') ||
        btn.textContent?.trim().toLowerCase() === 'new'
      ) ?? null;
    }, 8000);

    if (conditionBtn) {
      console.log(`[Syndrax Prelist] Legacy condition button found. Clicking "New"...`);
      await realClick(conditionBtn);

      // Wait for aria-pressed="true" (up to 3s)
      await poll(() =>
        conditionBtn.getAttribute('aria-pressed') === 'true' ? true : null, 3000
      );
      await sleep(300);
    } else {
      console.log('[Syndrax Prelist] No condition UI found at all — trying Continue anyway');
    }
  }

  // ── Click Continue / Continue to listing ─────────────────────────────────────
  // Poll up to 5s for the button to become enabled
  const continueBtn = await poll<HTMLButtonElement>(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    // Enabled continue button
    const enabled = btns.find(b => {
      const text = b.textContent?.trim().toLowerCase() || '';
      const isEnabled = !b.disabled && b.getAttribute('aria-disabled') !== 'true';
      return isEnabled && (text === 'continue' || text.includes('continue to list'));
    });
    if (enabled) return enabled;
    return null;
  }, 5000);

  if (continueBtn) {
    updateStatus(statusEl, '✓ Condition set — opening listing form…', '#4ade80');
    console.log(`[Syndrax Prelist] Clicking "${continueBtn.textContent?.trim()}"...`);
    await realClick(continueBtn);
    return true;
  }

  // Last resort: click any Continue button regardless of disabled state
  console.log('[Syndrax Prelist] Continue not enabled — force-clicking any Continue button');
  const anyBtn = document.querySelector<HTMLButtonElement>(
    '.prelist-radix__next-container button, button[type="submit"], dialog button'
  );
  if (anyBtn) {
    await realClick(anyBtn);
    return true;
  }

  return false;
}

// ── INIT ───────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const { pendingListing } = await chrome.storage.local.get('pendingListing');

  if (!pendingListing?.title) {
    console.log('[Syndrax Prelist] No pending listing — skipping');
    return;
  }

  const title: string = pendingListing.title;
  console.log(`[Syndrax Prelist] Starting flow for: "${title}"`);

  await sleep(800); // was 2000ms — reduced

  const statusEl = showStatus('Starting…');

  const searched = await phaseSearch(title, statusEl);
  if (!searched) {
    updateStatus(statusEl, `⚠ Search failed — enter title manually:<br><b>${title.slice(0, 50)}</b>`, '#f59e0b');
    return;
  }

  await phaseMatch(statusEl);
  await phaseCondition(statusEl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
