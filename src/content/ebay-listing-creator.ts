// ebay-listing-creator.ts
// Runs on /lstng* (eBay's Marko listing form, 2024+)
// Fills: title, price, quantity, description, brand, images from pendingListing storage

// Import file logger for Hermes debugging
let fileLogAvailable = false;
async function initFileLog() {
  try {
    // Try to import and use file logger if available
    const msg = `[FileLog] Image upload debug session started at ${new Date().toISOString()}`;
    chrome.storage.local.get('debugLogs', (result) => {
      const logs = result.debugLogs || [];
      logs.push(msg);
      chrome.storage.local.set({ debugLogs: logs.slice(-500) });
    });
    fileLogAvailable = true;
  } catch (e) {
    // Ignore — file logging not critical
  }
}

async function debugLog(msg: string, detail?: string): Promise<void> {
  const fullMsg = detail ? `${msg} | ${detail}` : msg;
  if (fileLogAvailable) {
    try {
      chrome.storage.local.get('debugLogs', (result) => {
        const logs = result.debugLogs || [];
        logs.push(`[${new Date().toISOString()}] ${fullMsg}`);
        chrome.storage.local.set({ debugLogs: logs.slice(-500) });
      });
    } catch (e) {
      // Silent fail
    }
  }
}

interface ListingData {
  title: string;
  description: string;
  price: number;
  keywords?: string[];
  condition?: string;
  quantity?: number;
  categoryId?: string;
  images?: string[];
  asin?: string;
  brand?: string;
  sku?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = { info: '#00CFFF', success: '#22c55e', error: '#ef4444', warn: '#FFD700' };
  console.log(`%c[Syndrax Listing] ${msg}`, `color: ${colors[type]}`);
}

// React/Marko-compatible native value setter
function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

// Poll for element
async function waitFor<T extends Element>(
  selector: string | (() => T | null),
  timeoutMs = 15000
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const el = typeof selector === 'string'
      ? document.querySelector<T>(selector)
      : selector();
    if (el) return el;
    await sleep(150);
  }
  return null;
}

// Full pointer event click
async function realClick(el: HTMLElement): Promise<void> {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const opts: MouseEventInit = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, button: 0, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...opts, button: 0, buttons: 1 }));
  await sleep(40);
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, button: 0 }));
  el.dispatchEvent(new MouseEvent('mouseup', { ...opts, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { ...opts, button: 0 }));
}

// ── TITLE ─────────────────────────────────────────────────────────────────────

async function fillTitle(title: string): Promise<boolean> {
  const input = await waitFor<HTMLInputElement>(() => {
    return (
      document.querySelector<HTMLInputElement>('[data-testid="listing-title-input"]') ||
      document.querySelector<HTMLInputElement>('input[aria-label*="title" i]') ||
      document.querySelector<HTMLInputElement>('input[placeholder*="title" i]') ||
      document.querySelector<HTMLInputElement>('input[name="title"]') ||
      (() => {
        const sec = document.querySelector('[class*="title-section"], [class*="listing-title"]');
        return sec?.querySelector<HTMLInputElement>('input[type="text"]') ?? null;
      })()
    ) ?? null;
  }, 20000);

  if (!input) { log('Title input not found', 'error'); return false; }

  const truncated = title.slice(0, 80);
  setInputValue(input, truncated);
  log(`Title: "${truncated.slice(0, 50)}..."`, 'success');
  return true;
}

// ── PRICE ─────────────────────────────────────────────────────────────────────

async function fillPrice(price: number): Promise<boolean> {
  const input = await waitFor<HTMLInputElement>(() => {
    return (
      document.querySelector<HTMLInputElement>('[data-testid*="price" i] input') ||
      document.querySelector<HTMLInputElement>('input[aria-label*="price" i]') ||
      document.querySelector<HTMLInputElement>('input[name="price"]') ||
      document.querySelector<HTMLInputElement>('input[placeholder*="price" i]') ||
      document.querySelector<HTMLInputElement>('input[id*="price" i]') ||
      (() => {
        const dollarLabel = Array.from(document.querySelectorAll('span, label')).find(el =>
          el.textContent?.trim() === '$'
        );
        return dollarLabel?.closest('[class*="price"]')?.querySelector<HTMLInputElement>('input') ??
               dollarLabel?.parentElement?.querySelector<HTMLInputElement>('input') ?? null;
      })()
    ) ?? null;
  }, 10000);

  if (!input) { log('Price input not found', 'warn'); return false; }
  setInputValue(input, price.toFixed(2));
  log(`Price: $${price.toFixed(2)}`, 'success');
  return true;
}

// ── QUANTITY ──────────────────────────────────────────────────────────────────

async function fillQuantity(qty: number): Promise<boolean> {
  const input = await waitFor<HTMLInputElement>(() => {
    return (
      document.querySelector<HTMLInputElement>('[data-testid*="quantity" i] input') ||
      document.querySelector<HTMLInputElement>('input[aria-label*="quantity" i]') ||
      document.querySelector<HTMLInputElement>('input[name="quantity"]') ||
      document.querySelector<HTMLInputElement>('input[id*="quantity" i]')
    ) ?? null;
  }, 8000);

  if (!input) { log('Quantity not found', 'warn'); return false; }
  setInputValue(input, String(qty));
  log(`Quantity: ${qty}`, 'success');
  return true;
}

// ── DESCRIPTION ───────────────────────────────────────────────────────────────
// eBay uses: hidden <textarea name="description"> as backing store
//            + <iframe> with <div[contenteditable]> as the visual editor
// We must write to BOTH for eBay to save the content.

async function fillDescription(description: string): Promise<boolean> {
  await sleep(500);

  let filled = false;

  // ── Step 1: Write to the hidden textarea (backing store) ──────────────────
  // This is what eBay actually submits. data-testid="richEditor" name="description"
  const hiddenTextarea = await waitFor<HTMLTextAreaElement>(() => {
    return (
      document.querySelector<HTMLTextAreaElement>('textarea[name="description"][data-testid="richEditor"]') ||
      document.querySelector<HTMLTextAreaElement>('textarea[data-testid="richEditor"]') ||
      document.querySelector<HTMLTextAreaElement>('textarea[name="description"]') ||
      document.querySelector<HTMLTextAreaElement>('textarea[aria-label*="description" i]')
    ) ?? null;
  }, 5000);

  if (hiddenTextarea) {
    setInputValue(hiddenTextarea, description);
    // Unhide temporarily to force state update
    const wasHidden = hiddenTextarea.classList.contains('hidden');
    if (wasHidden) hiddenTextarea.classList.remove('hidden');
    hiddenTextarea.focus();
    hiddenTextarea.blur();
    if (wasHidden) hiddenTextarea.classList.add('hidden');
    log('Description → hidden textarea (backing store)', 'info');
    filled = true;
  }

  // ── Step 2: Write to the iframe contenteditable (visual layer) ─────────────
  // eBay's RTE lives in an iframe. Find it by looking for contenteditable inside any iframe.
  const allIframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
  for (const iframe of allIframes) {
    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) continue;
      const editable = iframeDoc.querySelector<HTMLElement>('[contenteditable="true"]') ||
                       iframeDoc.querySelector<HTMLElement>('[datatestid="richEditor"]') ||
                       iframeDoc.body;
      if (!editable) continue;

      // Focus iframe window first
      iframe.contentWindow?.focus();
      editable.focus();

      // Clear + insert via execCommand (works inside iframe doc context)
      iframeDoc.execCommand('selectAll', false, '');
      iframeDoc.execCommand('delete', false, '');
      iframeDoc.execCommand('insertText', false, description);

      // Also set innerHTML as fallback
      if (!editable.textContent?.trim()) {
        editable.innerHTML = description.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
      }

      editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: description }));
      editable.dispatchEvent(new Event('change', { bubbles: true }));
      log('Description → iframe contenteditable (visual)', 'success');
      filled = true;
      break;
    } catch {
      // Cross-origin iframe — skip
    }
  }

  // ── Step 3: Quill editor outside iframe ───────────────────────────────────
  if (!filled) {
    const qlEditor = document.querySelector<HTMLElement>('.ql-editor[contenteditable="true"]');
    if (qlEditor) {
      qlEditor.focus();
      document.execCommand('selectAll', false, '');
      document.execCommand('insertText', false, description);
      qlEditor.dispatchEvent(new Event('input', { bubbles: true }));
      log('Description → Quill editor', 'success');
      filled = true;
    }
  }

  if (!filled) log('Description editor not found — all strategies exhausted', 'warn');
  return filled;
}

// ── BRAND (Item Specifics) ────────────────────────────────────────────────────
// eBay item specifics use custom combobox dropdowns.
// We find the Brand field by its label text and fill via type-ahead.

async function fillBrand(brand: string): Promise<void> {
  if (!brand) return;

  // Try plain input first (sometimes rendered as text input)
  const brandInput = await waitFor<HTMLInputElement>(() => {
    return (
      document.querySelector<HTMLInputElement>('input[aria-label*="brand" i]') ||
      document.querySelector<HTMLInputElement>('input[id*="brand" i]') ||
      document.querySelector<HTMLInputElement>('input[name*="brand" i]') ||
      (() => {
        // Find label containing "Brand" and get sibling/child input
        const label = Array.from(document.querySelectorAll('span, label, div')).find(el =>
          el.textContent?.trim().toLowerCase() === 'brand'
        );
        return label?.closest('[class*="specific"], [class*="item-spec"]')
          ?.querySelector<HTMLInputElement>('input') ??
          label?.parentElement?.querySelector<HTMLInputElement>('input') ?? null;
      })()
    ) ?? null;
  }, 5000);

  if (brandInput) {
    brandInput.focus();
    setInputValue(brandInput, brand);
    await sleep(300);
    // Trigger dropdown if it appeared
    const firstOption = document.querySelector<HTMLElement>(
      '[role="option"]:first-child, [class*="menu-item"]:first-child, li:first-child'
    );
    if (firstOption) {
      await realClick(firstOption);
      log(`Brand set: ${brand}`, 'success');
    } else {
      brandInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      log(`Brand typed (no dropdown option): ${brand}`, 'warn');
    }
    return;
  }

  // Fallback: find Brand combobox by label proximity
  const brandSection = Array.from(document.querySelectorAll<HTMLElement>(
    '[class*="item-specific"], [class*="specifics"], [data-testid*="specifics"]'
  )).find(section => section.textContent?.toLowerCase().includes('brand'));

  if (brandSection) {
    const comboInput = brandSection.querySelector<HTMLInputElement>('input, [role="combobox"]');
    if (comboInput instanceof HTMLInputElement) {
      setInputValue(comboInput, brand);
      comboInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      log(`Brand via section combobox: ${brand}`, 'success');
    }
  }
}

// ── SKU / CUSTOM LABEL ────────────────────────────────────────────────────────
// eBay field: name="customLabel", placeholder="-", label="Custom label (SKU)"

async function fillSku(sku: string): Promise<void> {
  if (!sku) return;

  const skuInput = await waitFor<HTMLInputElement>(() => {
    return (
      // Primary: eBay's actual field name from page source
      document.querySelector<HTMLInputElement>('input[name="customLabel"]') ||
      // Secondary: aria/id selectors
      document.querySelector<HTMLInputElement>('input[aria-label*="custom label" i]') ||
      document.querySelector<HTMLInputElement>('input[aria-label*="sku" i]') ||
      document.querySelector<HTMLInputElement>('input[id*="customLabel" i]') ||
      document.querySelector<HTMLInputElement>('input[id*="custom-label" i]') ||
      // Tertiary: find by label text proximity
      (() => {
        const label = Array.from(document.querySelectorAll('label, span, div')).find(el =>
          /custom label|sku/i.test(el.textContent?.trim() || '')
        );
        return label?.closest('[class*="title"], [class*="custom"]')
          ?.querySelector<HTMLInputElement>('input') ??
          label?.parentElement?.querySelector<HTMLInputElement>('input') ??
          label?.nextElementSibling?.querySelector<HTMLInputElement>('input') ?? null;
      })()
    ) ?? null;
  }, 5000);

  if (skuInput) {
    skuInput.focus();
    setInputValue(skuInput, sku.slice(0, 50));
    skuInput.blur();
    log(`SKU/Custom label: ${sku}`, 'success');
  } else {
    log('SKU field not found', 'warn');
  }
}

// ── IMAGES ────────────────────────────────────────────────────────────────────
// eBay has a URL import feature under "See photo options" → "Add from URL"
// Inputs have placeholder="Enter URL" — we paste image URLs directly.
// Fallback: drop event on the dropzone.

async function fillImages(images: string[]): Promise<boolean> {
  if (!images || images.length === 0) return false;

  const urls = images.slice(0, 8);

  // NOTE: Direct file injection (fehelix-uploader, DataTransfer drop) was attempted
  // and confirmed BROKEN — all events fire but eBay checks event.isTrusted=false
  // and silently ignores programmatic events. Only URL import works.

  // ── Strategy 1: URL Import via "See photo options" dropdown ─────────────
  // Use MutationObserver to capture exactly what DOM appears after clicking.

  const seePhotoBtn2 = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => {
    const cls = b.className || '';
    const text = b.textContent?.trim().toLowerCase() || '';
    return cls.includes('fake-menu') && (text.includes('see photo') || text.includes('photo option'));
  });

  if (seePhotoBtn2) {
    log('Clicking "See photo options" + watching for dropdown...', 'info');

    // Watch for new elements added to DOM after click
    const newEls: string[] = [];
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) {
            const el = n as Element;
            // Log any new button/list items that appear
            [el, ...Array.from(el.querySelectorAll('button, li, [role], span, label'))].forEach(child => {
              const text = child.textContent?.trim().slice(0, 60) || '';
              const tag = child.tagName;
              const cls = child.className?.toString().slice(0, 50) || '';
              const role = child.getAttribute('role') || '';
              if (text || cls) {
                const entry = `${tag}|${cls}|${role}|"${text}"`;
                if (!newEls.includes(entry)) {
                  newEls.push(entry);
                  log(`[Dropdown] ${entry}`, 'info');
                }
              }
            });
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await realClick(seePhotoBtn2);
    await sleep(1000); // Give dropdown time to render

    observer.disconnect();
    log(`[Dropdown] ${newEls.length} new elements found after click`, 'info');

    // Now try to find "Upload from web" toggle in whatever appeared
    // Try every possible selector pattern
    const webToggleEl = (
      // Pattern A: button/element containing "web" text
      Array.from(document.querySelectorAll<HTMLElement>(
        'button, [role="menuitem"], [role="option"], [role="switch"], li, span, label'
      )).find(el => {
        const t = el.textContent?.trim().toLowerCase() || '';
        return (t.includes('upload') || t.includes('photo')) && t.includes('web') && t.length < 40;
      }) ||
      // Pattern B: aria-label containing web
      document.querySelector<HTMLElement>('[aria-label*="web" i]') ||
      // Pattern C: data attribute containing web
      document.querySelector<HTMLElement>('[data-testid*="web" i]')
    );

    if (webToggleEl) {
      log(`Found web toggle: "${webToggleEl.textContent?.trim()}" | ${webToggleEl.tagName}.${webToggleEl.className.toString().slice(0,30)}`, 'info');
      await realClick(webToggleEl);
      await sleep(800);

      // Close dropdown by pressing Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(400);
    } else {
      log('[Dropdown] "Upload from web" toggle NOT found — closing dropdown via Escape', 'warn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
    }

    // Check if "Upload from web" button NOW appears in main photo area
    const uploadFromWebBtn = await waitFor<HTMLButtonElement>(() => {
      return Array.from(document.querySelectorAll<HTMLButtonElement>('button.btn--tertiary')).find(b => {
        const t = b.textContent?.trim().toLowerCase() || '';
        return t.includes('web') && !t.includes('computer') && !t.includes('mobile');
      }) ?? null;
    }, 1500);

    if (uploadFromWebBtn) {
      log(`Clicking new button: "${uploadFromWebBtn.textContent?.trim()}"`, 'info');
      await realClick(uploadFromWebBtn);
      await sleep(600);
    }
  }

  // Step 4: Look for URL input fields — try multiple selector patterns
  const urlInput = await waitFor<HTMLInputElement>(() => {
    return (
      // eBay's actual placeholder text (try variations)
      document.querySelector<HTMLInputElement>('input[placeholder*="Enter URL" i]') ||
      document.querySelector<HTMLInputElement>('input[placeholder*="url" i]') ||
      document.querySelector<HTMLInputElement>('input[placeholder*="link" i]') ||
      document.querySelector<HTMLInputElement>('input[placeholder*="photo" i]') ||
      // Fallback: any input in photo/image section that's not already filled
      (() => {
        const photoSection = document.querySelector('[class*="photo"], [class*="image"], [class*="upload"]');
        if (!photoSection) return null;
        const inputs = photoSection.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
        return Array.from(inputs).find(inp => inp.offsetParent !== null && !inp.value) ?? null;
      })()
    ) ?? null;
  }, 2500);

  if (urlInput) {
    const allUrlInputs = Array.from(document.querySelectorAll<HTMLInputElement>(
      'input[placeholder*="Enter URL" i], input[placeholder*="url" i], input[placeholder*="link" i], input[placeholder*="photo" i]'
    )).filter(inp => inp.offsetParent !== null);
    let filled = 0;
    for (let i = 0; i < Math.min(urls.length, allUrlInputs.length); i++) {
      const inp = allUrlInputs[i];
      inp.focus();
      setInputValue(inp, urls[i]);
      await sleep(200);
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      filled++;
      await sleep(300);
    }
    if (filled > 0) {
      const addBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => {
        const t = b.textContent?.trim().toLowerCase() || '';
        return t === 'add' || t === 'go' || t === 'import';
      });
      if (addBtn) { await sleep(200); await realClick(addBtn); }
      log(`Images → URL import (${filled} URLs)`, 'success');
      return true;
    }
  }

  // All file-injection strategies are blocked by event.isTrusted=false.
  // Show image URLs in the status overlay for manual "Upload from web" paste.
  log('⚠ Auto-upload blocked by eBay security (isTrusted) — URLs below:', 'warn');
  urls.slice(0, 3).forEach((u, i) => log(`IMG ${i+1}: ${u.slice(0, 90)}`, 'info'));

  // Also inject URLs into page as a visible helper element
  const existing = document.getElementById('syndrax-img-urls');
  if (existing) existing.remove();
  const helper = document.createElement('div');
  helper.id = 'syndrax-img-urls';
  helper.style.cssText = `
    position: fixed; bottom: 12px; right: 12px; z-index: 999999;
    background: #0a0f1e; border: 1px solid #fbbf24; border-radius: 10px;
    padding: 12px 16px; color: #e2e8f0; font-family: monospace;
    font-size: 10px; line-height: 1.6; max-width: 400px;
    box-shadow: 0 4px 20px rgba(251,191,36,0.3);
  `;
  helper.innerHTML = `
    <div style="color:#fbbf24;font-weight:700;margin-bottom:6px">📷 Paste these URLs → "Upload from web"</div>
    ${urls.slice(0,3).map((u,i) => `
      <div style="margin-bottom:4px">
        <span style="color:#94a3b8">[${i+1}]</span>
        <input readonly value="${u}" onclick="this.select()"
          style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:4px;
                 padding:2px 4px;color:#e2e8f0;font-size:9px;cursor:pointer;margin-top:2px">
      </div>`).join('')}
    <div style="color:#64748b;font-size:9px;margin-top:4px">Click any URL → Ctrl+C to copy</div>
  `;
  document.body.appendChild(helper);
  setTimeout(() => helper.remove(), 60000);

  return false;
}

// ── STATUS OVERLAY ────────────────────────────────────────────────────────────

function showStatus(lines: Array<{ text: string; ok: boolean | null }>): void {
  document.getElementById('syndrax-listing-status')?.remove();
  const el = document.createElement('div');
  el.id = 'syndrax-listing-status';
  el.style.cssText = `
    position: fixed; top: 12px; right: 12px; z-index: 999999;
    background: #0a0f1e; border: 1px solid #00CFFF; border-radius: 10px;
    padding: 12px 16px; color: #e2e8f0; font-family: system-ui, monospace;
    font-size: 12px; line-height: 1.8; max-width: 340px;
    box-shadow: 0 4px 24px rgba(0,207,255,0.2);
  `;
  const header = `<div style="color:#00CFFF;font-weight:700;margin-bottom:6px">⚡ Syndrax — Auto-Fill</div>`;
  const body = lines.map(l => {
    const icon  = l.ok === true ? '✅' : l.ok === false ? '❌' : '⚠️';
    const color = l.ok === true ? '#4ade80' : l.ok === false ? '#f87171' : '#fbbf24';
    return `<div style="color:${color}">${icon} ${l.text}</div>`;
  }).join('');
  el.innerHTML = header + body;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 16000);
}

// ── DEBUG: Uploader event tracer ──────────────────────────────────────────────
// When debug mode is on, attaches event listeners to ALL uploader elements
// and reports every event back to the service worker console.

async function attachUploaderTracer(): Promise<void> {
  const report = (source: string, evt: string, detail?: string) => {
    const msg = `[DebugUploader] ${source} → ${evt}${detail ? ` | ${detail}` : ''}`;
    console.log(`%c${msg}`, 'color: #FFD700; font-weight: bold');
    chrome.runtime.sendMessage({ type: 'DEBUG_UPLOADER_EVENT', payload: { source, evt, detail } }).catch(() => {});
  };

  // Watch file input
  const fehelix = document.getElementById('fehelix-uploader') as HTMLInputElement | null;
  if (fehelix) {
    ['change','input','click','focus','blur'].forEach(e =>
      fehelix.addEventListener(e, ev => report('fehelix-uploader', e, `files: ${fehelix.files?.length ?? 0}`), true)
    );
    report('fehelix-uploader', 'FOUND', `accept: ${fehelix.accept}, hidden: ${fehelix.hidden}`);
  } else {
    report('fehelix-uploader', 'NOT FOUND');
  }

  // Watch dropzone
  const dropzone = document.getElementById('uploader-ui-dropzone');
  if (dropzone) {
    ['drop','dragover','dragenter','dragleave','click'].forEach(e =>
      dropzone.addEventListener(e, ev => {
        const dt = (ev as DragEvent).dataTransfer;
        report('uploader-ui-dropzone', e, dt ? `files: ${dt.files?.length ?? 0}, types: ${[...dt.types].join(',')}` : '');
      }, true)
    );
    report('uploader-ui-dropzone', 'FOUND', `class: ${dropzone.className.slice(0,50)}`);
  } else {
    report('uploader-ui-dropzone', 'NOT FOUND');
  }

  // Watch all buttons in the photo area
  const photoSection = document.querySelector('.smry.summary__photos, [class*="uploader"]');
  if (photoSection) {
    photoSection.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => report('photo-button', 'click', btn.textContent?.trim().slice(0,30) ?? ''), true);
    });
    report('photo-section', 'FOUND', `buttons: ${photoSection.querySelectorAll('button').length}`);
  }

  // Check for React internals on the file input
  if (fehelix) {
    const fiberKey = Object.keys(fehelix).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
    report('fehelix-react', fiberKey ? 'HAS REACT FIBER' : 'NO REACT FIBER', fiberKey ?? '');
  }

  // Log all existing file inputs
  const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  allFileInputs.forEach((inp, i) => {
    const el = inp as HTMLInputElement;
    report(`file-input-${i}`, 'EXISTS', `id: ${el.id}, accept: ${el.accept}, hidden: ${el.hidden}`);
  });

  // Log ALL 7 buttons in the photo section
  const photoSectionEl = document.querySelector('.smry.summary__photos, [class*="uploader"], [class*="photo-module"]');
  if (photoSectionEl) {
    const btns = Array.from(photoSectionEl.querySelectorAll('button'));
    btns.forEach((btn, i) => {
      report(`photo-btn-${i}`, 'FOUND', `text: "${btn.textContent?.trim().slice(0,40)}" | class: ${btn.className.slice(0,50)} | aria: ${btn.getAttribute('aria-label') || ''}`);
    });
  }

  // Also log ALL buttons on page that mention upload/web/photo
  const allBtns = Array.from(document.querySelectorAll('button')).filter(b =>
    /upload|web|photo|computer|mobile|url/i.test(b.textContent || b.getAttribute('aria-label') || '')
  );
  allBtns.forEach((btn, i) => {
    report(`upload-btn-${i}`, 'FOUND', `text: "${btn.textContent?.trim().slice(0,50)}" | class: ${btn.className.slice(0,40)}`);
  });

  report('tracer', 'ATTACHED', `url: ${location.href.slice(0,60)}`);
}

// ── MAIN ───────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  if (!window.location.href.includes('ebay.com/lstng') &&
      !window.location.href.includes('ebay.com/sl/sell') &&
      !window.location.href.includes('ebay.com/sell/')) return;

  const { pendingListing, syndrax_debug_mode } = await chrome.storage.local.get(['pendingListing', 'syndrax_debug_mode']);

  // Attach uploader tracer in debug mode (even before pendingListing check)
  if (syndrax_debug_mode) {
    log('🧪 DEBUG MODE — attaching uploader tracer...', 'warn');
    await sleep(1500); // Wait for page to render
    await attachUploaderTracer();
  }
  if (!pendingListing?.title) {
    log('No pending listing — skipping auto-fill');
    return;
  }

  const data = pendingListing as ListingData;
  log(`Auto-filling: "${data.title.slice(0, 50)}..."`, 'info');

  // Wait for Marko hydration
  await sleep(1500);

  const results: Array<{ text: string; ok: boolean | null }> = [];

  // ── Fill fields in order ────────────────────────────────────────────────────
  const titleOk = await fillTitle(data.title);
  results.push({ text: 'Title', ok: titleOk });

  const priceOk = await fillPrice(data.price);
  results.push({ text: `Price $${data.price.toFixed(2)}`, ok: priceOk });

  const qtyOk = await fillQuantity(data.quantity ?? 1);
  results.push({ text: `Qty ${data.quantity ?? 1}`, ok: qtyOk });

  if (data.description) {
    const descOk = await fillDescription(data.description);
    results.push({ text: 'Description', ok: descOk });
  }

  if (data.brand) {
    await fillBrand(data.brand);
    results.push({ text: `Brand: ${data.brand}`, ok: null });
  }

  // SKU = ASIN (useful for tracking which Amazon product this is)
  const sku = data.sku || data.asin;
  if (sku) {
    await fillSku(sku);
    results.push({ text: `SKU: ${sku}`, ok: null });
  }

  if (data.images && data.images.length > 0) {
    const imgOk = await fillImages(data.images);
    results.push({ text: `Images (${data.images.length})`, ok: imgOk });
  }

  showStatus(results);

  const anyFilled = results.some(r => r.ok === true);
  if (!anyFilled) {
    log('No fields filled — page may not have loaded yet', 'error');
    chrome.runtime.sendMessage({ type: 'LISTING_COMPLETE', payload: { success: false, error: 'No fields filled' } });
    return;
  }

  await chrome.storage.local.remove('pendingListing');
  log('Auto-fill complete ✓', 'success');

  // ── Auto-submit: click "List item" button ─────────────────────────────────
  // Give user 3 seconds to see the filled form before submitting
  await sleep(3000);

  const submitBtn = await waitFor<HTMLButtonElement>(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b => {
      const text = b.textContent?.trim().toLowerCase() || '';
      return (
        text === 'list item' ||
        text === 'submit listing' ||
        text === 'save and preview' ||
        text === 'publish' ||
        text.includes('list item') ||
        text.includes('submit listing')
      );
    }) ?? null;
  }, 5000);

  if (submitBtn && !submitBtn.disabled) {
    log(`Auto-submitting: "${submitBtn.textContent?.trim()}"...`, 'info');
    await realClick(submitBtn);
  } else {
    log('Submit button not found or disabled — waiting for manual submit', 'warn');
  }

  // ── Watch for URL navigation → listing complete ───────────────────────────
  let completionSent = false;
  const sendComplete = (success: boolean, error?: string) => {
    if (completionSent) return;
    completionSent = true;
    chrome.runtime.sendMessage({ type: 'LISTING_COMPLETE', payload: { success, error } });
    log(success ? '✓ Listed successfully!' : `✗ Failed: ${error}`, success ? 'success' : 'warn');
  };

  let lastHref = location.href;
  const urlWatcher = setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    const url = location.href;

    if (url.includes('/sell/success') || url.includes('/sh/lst/active') ||
        url.includes('/myebay/selling') || url.includes('itemId=') || url.includes('/itm/')) {
      clearInterval(urlWatcher);
      sendComplete(true);
    } else if (url.includes('/lstng/') || url.includes('/sl/sell')) {
      // Still on listing form — keep watching
    } else {
      clearInterval(urlWatcher);
      sendComplete(true); // Navigated away from listing flow — assume success
    }
  }, 400);

  // Fallback timeout — 80s from here
  setTimeout(() => {
    clearInterval(urlWatcher);
    if (!completionSent) sendComplete(false, 'Submit timed out — form may need manual completion');
  }, 80_000);
}

// Start after Marko hydration
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
} else {
  setTimeout(init, 1200);
}
