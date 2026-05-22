/**
 * eBay Mesh Order Overlay
 * Auto Order Button and Utility Tools for eBay Order Details Pages
 * Target URL: https://www.ebay.com/mesh/ord/details?orderid=*
 */

import { 
    ShippingAddress, 
    LineItem, 
    OrderData, 
    AutoOrderSettings,
    ETASettings,
    FeedbackSettings,
    DEFAULT_AUTO_ORDER_SETTINGS,
    DEFAULT_ETA_SETTINGS,
    DEFAULT_FEEDBACK_SETTINGS,
    EBAY_MESH_SELECTORS 
} from './ebay-mesh-order-types';
import { INJECT_STYLES } from './ebay-mesh-order-styles';

console.log('🛒 Syndrax Sync: eBay Mesh Order Overlay loaded');

// ==================== UTILITY FUNCTIONS ====================

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    const existingToast = document.querySelector('.ecomflow-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `ecomflow-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
}

/**
 * Copy text to clipboard with feedback
 */
async function copyToClipboard(text: string, successMsg = 'Copied!'): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy', 'error');
        return false;
    }
}

/**
 * Decode Base64 SKU to potential ASIN or product identifier
 */
function decodeSkuToAsin(base64Sku: string): string {
    try {
        // Try to decode Base64
        const decoded = atob(base64Sku);
        // Check if it looks like an ASIN (10 chars, alphanumeric)
        const asinMatch = decoded.match(/[A-Z0-9]{10}/i);
        if (asinMatch) {
            return asinMatch[0].toUpperCase();
        }
        return decoded;
    } catch {
        return base64Sku; // Return original if not valid Base64
    }
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const match = priceStr.match(/[\d,.]+/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
}

/**
 * Extract eBay Order Earnings (net profit after fees)
 * This is the "Order earnings" value from the payment section
 */
function extractEbayOrderEarnings(): number | null {
    try {
        // Multiple selectors to find Order Earnings
        // The structure is: .earnings .total dd.amount .value .sh-bold
        const selectors = [
            '.earnings dl.total dd.amount .sh-bold',
            '.earnings .total dd.amount .value .sh-bold',
            '.earnings .total .amount .sh-bold',
            'dl.total:has(button:contains("Order earnings")) dd.amount .sh-bold',
            // Fallback: find "Order earnings" button and get sibling value
        ];
        
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/\$?([\d,]+\.?\d*)/);
                if (match) {
                    const amount = parseFloat(match[1].replace(',', ''));
                    if (!isNaN(amount) && amount > 0) {
                        console.log(`💰 Found eBay earnings: $${amount.toFixed(2)} via "${sel}"`);
                        return amount;
                    }
                }
            }
        }
        
        // Fallback: Find the "Order earnings" button and navigate to the value
        const earningsButton = document.evaluate(
            "//button[contains(text(), 'Order earnings')]",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
        
        if (earningsButton && earningsButton instanceof Element) {
            // Navigate up to dl.total, then find dd.amount .sh-bold
            const dlTotal = (earningsButton as Element).closest('dl.total');
            if (dlTotal) {
                const amountEl = dlTotal.querySelector('dd.amount .sh-bold');
                if (amountEl) {
                    const text = amountEl.textContent?.trim() || '';
                    const match = text.match(/\$?([\d,]+\.?\d*)/);
                    if (match) {
                        const amount = parseFloat(match[1].replace(',', ''));
                        console.log(`💰 Found eBay earnings via XPath: $${amount.toFixed(2)}`);
                        return amount;
                    }
                }
            }
        }
        
        console.log('💰 eBay Order Earnings not found');
        return null;
    } catch (err) {
        console.error('Error extracting eBay earnings:', err);
        return null;
    }
}

/**
 * Wait for element to appear in DOM
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(document.querySelector(selector));
        }, timeout);
    });
}

// ==================== PAGE DETECTION ====================

/**
 * Check if current page is an eBay Mesh Order Details page
 */
function isOrderDetailsPage(): boolean {
    const url = window.location.href;
    return url.includes('ebay.com/mesh/ord/details');
}

/**
 * Extract order ID from URL
 */
function extractOrderIdFromUrl(): string {
    const url = window.location.href;
    const match = url.match(EBAY_MESH_SELECTORS.orderIdFromUrl);
    return match ? match[1] : '';
}

// ==================== DATA EXTRACTION ====================

/**
 * Extract shipping address from page
 * Parses the eBay mesh order details address block
 * Uses content-based detection instead of fragile div index positions
 */
function extractShippingAddress(): ShippingAddress {
    const address: ShippingAddress = {
        fullName: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
    };

    try {
        console.log('🔍 Extracting shipping address...');
        
        // Find the shipping address container using multiple selectors
        const addressContainer = document.querySelector('.ship-to .address') || 
                                  document.querySelector('.ship-to') || 
                                  document.querySelector('.shipping-address, [class*="ship-to"], [class*="shipping"]');
        
        console.log('📍 Address container:', addressContainer ? 'Found' : 'NOT FOUND');
        
        if (!addressContainer) {
            console.error('❌ Cannot find shipping address container');
            return address;
        }

        // Collect all text parts from buttons (eBay uses tooltip buttons for address parts)
        const buttons = addressContainer.querySelectorAll('.tooltip button, button.tooltip__host, button');
        const allParts: string[] = [];
        
        buttons.forEach(btn => {
            const text = btn.textContent?.trim();
            if (text && text.length > 0 && !text.includes('Copy') && !text.includes('Edit')) {
                allParts.push(text);
            }
        });
        
        console.log('📍 All address parts:', allParts);

        // Parse address parts using pattern matching instead of index positions
        const streetPatterns = [/^\d+\s+\w/, /^PO\s*Box/i, /^P\.?O\.?\s*Box/i, /Apt|Suite|Unit|#|\d{2,}/i];
        const statePattern = /^[A-Z]{2}$/;
        const zipPattern = /^\d{5}(-\d{4})?$/;
        const countryPatterns = ['United States', 'Canada', 'UK', 'Australia', 'Germany', 'France'];
        
        let nameSet = false;
        const streetParts: string[] = [];
        
        for (let i = 0; i < allParts.length; i++) {
            const part = allParts[i];
            
            // Check if it's a ZIP code
            if (zipPattern.test(part)) {
                address.zipCode = part;
                continue;
            }
            
            // Check if it's a state abbreviation (2 uppercase letters)
            if (statePattern.test(part) && !address.state) {
                address.state = part;
                continue;
            }
            
            // Check if it's a country
            if (countryPatterns.some(c => part.toLowerCase().includes(c.toLowerCase()))) {
                address.country = part;
                continue;
            }
            
            // Check if it looks like a street address
            const looksLikeStreet = streetPatterns.some(p => p.test(part));
            
            // First non-pattern part is likely the name
            if (!nameSet && !looksLikeStreet && !address.fullName) {
                address.fullName = part;
                nameSet = true;
                continue;
            }
            
            // If we have a name and this isn't city/state/zip, it's probably street or city
            if (nameSet) {
                // Check if this could be city (usually before state)
                const nextPart = allParts[i + 1];
                if (nextPart && statePattern.test(nextPart) && !address.city) {
                    address.city = part;
                    continue;
                }
                
                // Otherwise it's part of the street address
                if (!address.city && !looksLikeStreet && !zipPattern.test(part) && !statePattern.test(part)) {
                    // Could be city if next is state
                    const nextIdx = i + 1;
                    if (nextIdx < allParts.length && statePattern.test(allParts[nextIdx])) {
                        address.city = part;
                    } else {
                        streetParts.push(part);
                    }
                } else if (looksLikeStreet) {
                    streetParts.push(part);
                }
            }
        }
        
        // Combine street parts
        if (streetParts.length > 0) {
            address.street = streetParts.join(' ');
        }
        
        // If city wasn't found, look for city/state/zip pattern in remaining parts
        if (!address.city) {
            for (const part of allParts) {
                // Match "City, State ZIP" or "City State ZIP" patterns
                const cityStateZip = part.match(/^([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)$/);
                if (cityStateZip) {
                    address.city = cityStateZip[1].trim();
                    address.state = cityStateZip[2];
                    address.zipCode = cityStateZip[3];
                    break;
                }
            }
        }

        // Extract phone number - it's in a separate dl.phone element
        const phoneElement = document.querySelector('.phone button, dl.phone button, .phone .tooltip button');
        if (phoneElement) {
            let phoneText = phoneElement.textContent?.trim() || '';
            // Clean up phone format - remove +1 if present
            phoneText = phoneText.replace(/^\+1\s*/, '').replace(/[^\d]/g, '');
            if (phoneText.length >= 10) {
                address.phone = phoneText;
            }
            console.log('📞 Phone extracted:', address.phone);
        }

        // Set default country if not found
        if (!address.country) {
            address.country = 'United States';
        }

        console.log('✅ Extracted address:', address);

    } catch (err) {
        console.error('❌ Error extracting shipping address:', err);
    }

    return address;
}

/**
 * Extract line item data from a line item card
 */
function extractLineItem(lineItemCard: Element): LineItem {
    const item: LineItem = {
        itemId: '',
        title: '',
        sku: '',
        decodedSku: '',
        quantity: 1,
        available: 0,
        itemPrice: 0,
        itemTotal: 0,
        imageUrl: '',
        itemUrl: ''
    };

    try {
        // Title
        const titleEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemTitle);
        item.title = titleEl?.textContent?.trim() || '';

        // Item URL
        const linkEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemLink) as HTMLAnchorElement;
        item.itemUrl = linkEl?.href || '';

        // Image
        const imgEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemImage) as HTMLImageElement;
        item.imageUrl = imgEl?.src || '';

        // Item ID
        const itemIdContainer = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemIdContainer);
        if (itemIdContainer) {
            const spans = itemIdContainer.querySelectorAll('span.sh-secondary');
            if (spans.length >= 2) {
                item.itemId = spans[1].textContent?.trim() || '';
            }
        }

        // SKU
        const skuContainer = lineItemCard.querySelector(EBAY_MESH_SELECTORS.skuContainer);
        if (skuContainer) {
            const spans = skuContainer.querySelectorAll('span.sh-secondary');
            if (spans.length >= 2) {
                item.sku = spans[1].textContent?.trim() || '';
                item.decodedSku = decodeSkuToAsin(item.sku);
            }
        }

        // Quantity
        const qtyEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.quantityValue);
        if (qtyEl) {
            const qtyMatch = qtyEl.textContent?.match(/\d+/);
            item.quantity = qtyMatch ? parseInt(qtyMatch[0]) : 1;
        }

        // Available
        const availEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.quantityAvailable);
        if (availEl) {
            const availMatch = availEl.textContent?.match(/\((\d+)\s*available\)/i);
            item.available = availMatch ? parseInt(availMatch[1]) : 0;
        }

        // Item Price
        const priceEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemPriceValue);
        item.itemPrice = parsePrice(priceEl?.textContent || '');

        // Item Total
        const totalEl = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemTotalValue);
        item.itemTotal = parsePrice(totalEl?.textContent || '');

    } catch (err) {
        console.error('Error extracting line item:', err);
    }

    return item;
}

/**
 * Extract all order data from page
 */
function extractOrderData(): OrderData {
    const orderId = extractOrderIdFromUrl();
    const shipping = extractShippingAddress();
    const lineItems: LineItem[] = [];

    // Find all line item cards
    const lineItemCards = document.querySelectorAll(EBAY_MESH_SELECTORS.lineItemCard);
    lineItemCards.forEach(card => {
        const item = extractLineItem(card);
        if (item.itemId || item.title) {
            lineItems.push(item);
        }
    });

    return {
        orderId,
        lineItems,
        shipping
    };
}

// ==================== SETTINGS MANAGEMENT ====================

/**
 * Load settings from chrome storage
 */
async function loadSettings(): Promise<{
    autoOrder: AutoOrderSettings;
    eta: ETASettings;
    feedback: FeedbackSettings;
}> {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            ['autoOrderSettings', 'etaSettings', 'feedbackSettings'],
            (result: Record<string, any>) => {
                resolve({
                    autoOrder: result.autoOrderSettings || DEFAULT_AUTO_ORDER_SETTINGS,
                    eta: result.etaSettings || DEFAULT_ETA_SETTINGS,
                    feedback: result.feedbackSettings || DEFAULT_FEEDBACK_SETTINGS
                });
            }
        );
    });
}

/**
 * Save settings to chrome storage
 */
async function saveSettings(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

// ==================== UI CREATION ====================

/**
 * Create the settings modal HTML
 */
function createSettingsModal(settings: AutoOrderSettings): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'ecomflow-settings-modal';
    modal.innerHTML = `
        <span class="ecomflow-settings-modal-close">×</span>
        <div class="ecomflow-settings-modal-content">
            <label>
                <input type="checkbox" id="ecomflow-get-link-only" ${settings.getLinkOnly ? 'checked' : ''}>
                Get link instead of auto order
            </label>
            <label>
                <input type="checkbox" id="ecomflow-use-gift" ${settings.useGiftOption ? 'checked' : ''}>
                Use Gift Option
            </label>
            <div class="ecomflow-gift-options" style="display: ${settings.useGiftOption ? 'block' : 'none'}">
                <label style="flex-direction: column; align-items: flex-start;">
                    Gift Message:
                    <textarea id="ecomflow-gift-message" rows="3" cols="25">${settings.giftMessage}</textarea>
                </label>
                <label style="flex-direction: column; align-items: flex-start;">
                    Gift Message Sender:
                    <input type="text" id="ecomflow-gift-sender" value="${settings.giftSender}">
                </label>
            </div>
        </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector('.ecomflow-settings-modal-close');
    closeBtn?.addEventListener('click', () => modal.classList.remove('visible'));

    const getLinkCheckbox = modal.querySelector('#ecomflow-get-link-only') as HTMLInputElement;
    const useGiftCheckbox = modal.querySelector('#ecomflow-use-gift') as HTMLInputElement;
    const giftOptionsDiv = modal.querySelector('.ecomflow-gift-options') as HTMLElement;
    const giftMessageTextarea = modal.querySelector('#ecomflow-gift-message') as HTMLTextAreaElement;
    const giftSenderInput = modal.querySelector('#ecomflow-gift-sender') as HTMLInputElement;

    getLinkCheckbox?.addEventListener('change', async () => {
        settings.getLinkOnly = getLinkCheckbox.checked;
        await saveSettings('autoOrderSettings', settings);
    });

    useGiftCheckbox?.addEventListener('change', async () => {
        settings.useGiftOption = useGiftCheckbox.checked;
        giftOptionsDiv.style.display = useGiftCheckbox.checked ? 'block' : 'none';
        await saveSettings('autoOrderSettings', settings);
    });

    giftMessageTextarea?.addEventListener('change', async () => {
        settings.giftMessage = giftMessageTextarea.value;
        await saveSettings('autoOrderSettings', settings);
    });

    giftSenderInput?.addEventListener('change', async () => {
        settings.giftSender = giftSenderInput.value;
        await saveSettings('autoOrderSettings', settings);
    });

    return modal;
}

/**
 * Create quantity selector
 */
function createQuantitySelector(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ecomflow-quantity-container';
    
    container.innerHTML = `
        <label class="ecomflow-quantity-label">Increase Quantity:</label>
        <select class="ecomflow-quantity-select">
            ${Array.from({ length: 11 }, (_, i) => 
                `<option value="${i}">${i}</option>`
            ).join('')}
        </select>
        <button class="ecomflow-update-quantity-button">Update</button>
    `;

    return container;
}

/**
 * Create ETA section
 */
function createETASection(etaSettings: ETASettings): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ecomflow-eta-div';
    
    const today = new Date();
    const defaultDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = defaultDate.toISOString().split('T')[0];

    container.innerHTML = `
        <div class="ecomflow-eta-row">
            <label class="ecomflow-eta-label">ETA:</label>
            <input type="date" class="ecomflow-eta-field" value="${etaSettings.customEtaDate || dateStr}">
            <a class="ecomflow-eta-link" href="#" title="Configure ETA Message">Change ETA Message</a>
        </div>
        <button class="ecomflow-copy-eta-button">Copy ETA Message</button>
    `;

    // Copy ETA button handler
    const copyBtn = container.querySelector('.ecomflow-copy-eta-button');
    const dateInput = container.querySelector('.ecomflow-eta-field') as HTMLInputElement;
    
    copyBtn?.addEventListener('click', async () => {
        const selectedDate = dateInput?.value || dateStr;
        const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const message = etaSettings.etaMessage.replace('{date}', formattedDate);
        await copyToClipboard(message, 'ETA message copied!');
    });

    return container;
}

/**
 * Create feedback section
 */
function createFeedbackSection(feedbackSettings: FeedbackSettings): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ecomflow-feedback-div';
    
    container.innerHTML = `
        <a class="ecomflow-feedback-link" href="#" title="Configure Feedback Message">Change Feedback Message</a>
        <button class="ecomflow-copy-feedback-button">Copy Feedback Message</button>
    `;

    const copyBtn = container.querySelector('.ecomflow-copy-feedback-button');
    copyBtn?.addEventListener('click', async () => {
        await copyToClipboard(feedbackSettings.feedbackMessage, 'Feedback message copied!');
    });

    return container;
}

/**
 * Create action buttons row
 */
function createActionButtons(orderData: OrderData): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ecomflow-action-buttons-container';
    
    container.innerHTML = `
        <div class="ecomflow-action-buttons-row">
            <label class="ecomflow-clipboard-label">Quick Actions:</label>
            <button class="ecomflow-icon-button" id="ecomflow-copy-address" title="Copy Full Address">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
            </button>
            <button class="ecomflow-icon-button" id="ecomflow-copy-order" title="Copy Order Details">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                </svg>
            </button>
            <button class="ecomflow-icon-button" id="ecomflow-copy-name" title="Copy Buyer Name">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </button>
            <button class="ecomflow-icon-button" id="ecomflow-search-amazon" title="Search on Amazon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
            </button>
        </div>
    `;

    // Add event handlers
    const copyAddressBtn = container.querySelector('#ecomflow-copy-address');
    const copyOrderBtn = container.querySelector('#ecomflow-copy-order');
    const copyNameBtn = container.querySelector('#ecomflow-copy-name');
    const searchAmazonBtn = container.querySelector('#ecomflow-search-amazon');

    copyAddressBtn?.addEventListener('click', () => {
        const addr = orderData.shipping;
        const addressText = `${addr.fullName}\n${addr.street}\n${addr.city}, ${addr.state} ${addr.zipCode}\n${addr.country}`;
        copyToClipboard(addressText, 'Address copied!');
    });

    copyOrderBtn?.addEventListener('click', () => {
        const item = orderData.lineItems[0];
        const addr = orderData.shipping;
        const orderText = `Order: ${orderData.orderId}
Item: ${item?.title || 'N/A'}
Item ID: ${item?.itemId || 'N/A'}
SKU: ${item?.sku || 'N/A'} (Decoded: ${item?.decodedSku || 'N/A'})
Quantity: ${item?.quantity || 0}
Price: $${item?.itemPrice?.toFixed(2) || '0.00'}
Total: $${item?.itemTotal?.toFixed(2) || '0.00'}

Ship To:
${addr.fullName}
${addr.street}
${addr.city}, ${addr.state} ${addr.zipCode}
${addr.country}`;
        copyToClipboard(orderText, 'Order details copied!');
    });

    copyNameBtn?.addEventListener('click', () => {
        copyToClipboard(orderData.shipping.fullName, 'Name copied!');
    });

    searchAmazonBtn?.addEventListener('click', () => {
        const item = orderData.lineItems[0];
        const searchTerm = item?.decodedSku || item?.title || '';
        if (searchTerm) {
            window.open(`https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}`, '_blank');
        }
    });

    return container;
}

/**
 * Create the main utility buttons overlay for a line item
 */
async function createOverlayForItem(
    lineItemCard: Element, 
    item: LineItem, 
    orderData: OrderData,
    settings: { autoOrder: AutoOrderSettings; eta: ETASettings; feedback: FeedbackSettings }
): Promise<void> {
    // Find the injection point
    const injectionPoint = lineItemCard.querySelector(EBAY_MESH_SELECTORS.itemIdContainer);
    if (!injectionPoint) {
        console.warn('Injection point not found for item:', item.itemId);
        return;
    }

    // Check if already injected
    if (injectionPoint.querySelector('.ecomflow-utility-buttons')) {
        return;
    }

    // Create main container
    const utilityButtons = document.createElement('div');
    utilityButtons.className = 'ecomflow-utility-buttons';

    // Create automation div (Copy + Auto Order + Settings)
    const automationDiv = document.createElement('div');
    automationDiv.className = 'ecomflow-automation-div';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'ecomflow-copy-link-button';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
        const amazonUrl = item.decodedSku 
            ? `https://www.amazon.com/dp/${item.decodedSku}`
            : `https://www.amazon.com/s?k=${encodeURIComponent(item.title)}`;
        copyToClipboard(amazonUrl, 'Amazon link copied!');
    });

    // Auto Order container
    const autoOrderContainer = document.createElement('div');
    autoOrderContainer.className = 'ecomflow-auto-order-container';

    // Auto Order button
    const autoOrderBtn = document.createElement('button');
    autoOrderBtn.className = 'ecomflow-auto-order-button';
    autoOrderBtn.textContent = 'Auto Order';
    autoOrderBtn.addEventListener('click', async () => {
        await handleAutoOrder(item, orderData, settings.autoOrder);
    });

    // Settings icon
    const settingsIcon = document.createElement('span');
    settingsIcon.className = 'ecomflow-settings-icon';
    settingsIcon.textContent = '⚙';

    // Settings modal
    const settingsModal = createSettingsModal(settings.autoOrder);

    settingsIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsModal.classList.toggle('visible');
    });

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsModal.contains(e.target as Node) && e.target !== settingsIcon) {
            settingsModal.classList.remove('visible');
        }
    });

    autoOrderContainer.appendChild(autoOrderBtn);
    autoOrderContainer.appendChild(settingsIcon);
    autoOrderContainer.appendChild(settingsModal);

    automationDiv.appendChild(copyBtn);
    automationDiv.appendChild(autoOrderContainer);

    // Add all sections
    utilityButtons.appendChild(automationDiv);
    utilityButtons.appendChild(createQuantitySelector());
    utilityButtons.appendChild(createETASection(settings.eta));
    utilityButtons.appendChild(createFeedbackSection(settings.feedback));
    utilityButtons.appendChild(createActionButtons(orderData));

    // Inject into page
    injectionPoint.appendChild(utilityButtons);
    
    console.log('✅ Syndrax overlay injected for item:', item.itemId);
}

// ==================== AUTO ORDER HANDLER ====================

/**
 * Handle Auto Order button click
 */
async function handleAutoOrder(
    item: LineItem, 
    orderData: OrderData, 
    settings: AutoOrderSettings
): Promise<void> {
    console.log('🚀 Auto Order triggered for:', item.title);
    
    // Build Amazon URL
    let amazonUrl: string;
    if (item.decodedSku && item.decodedSku.match(/^[A-Z0-9]{10}$/i)) {
        // Direct product link if we have valid ASIN
        amazonUrl = `https://www.amazon.com/dp/${item.decodedSku}`;
    } else {
        // Search URL
        amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(item.title)}`;
    }

    // If "get link only" is enabled, just copy the URL
    if (settings.getLinkOnly) {
        await copyToClipboard(amazonUrl, 'Amazon link copied!');
        return;
    }

    // Extract eBay Order Earnings (net profit from eBay)
    const ebayEarnings = extractEbayOrderEarnings();
    console.log('💰 Extracted eBay Order Earnings:', ebayEarnings);

    // Store order data for Amazon page script
    const pendingOrder = {
        shipping: orderData.shipping,
        itemTitle: item.title,
        quantity: item.quantity,
        amazonUrl: amazonUrl,
        itemId: item.itemId,
        ebayOrderId: orderData.orderId,
        ebayEarnings: ebayEarnings, // Net earnings from eBay order for profit calculation
        giftOptions: settings.useGiftOption ? {
            enabled: true,
            message: settings.giftMessage,
            sender: settings.giftSender
        } : undefined,
        timestamp: Date.now()
    };

    await new Promise<void>((resolve) => {
        chrome.storage.local.set({
            pendingAmazonOrder: pendingOrder,
            autoOrderInProgress: true
        }, resolve);
    });

    // Send message to background service
    chrome.runtime.sendMessage({
        type: 'startAutoOrder',
        data: pendingOrder
    }, (response: { success?: boolean } | undefined) => {
        if (response?.success) {
            showToast('Opening Amazon...', 'info');
        }
    });

    // Open Amazon
    window.open(amazonUrl, '_blank');
    showToast('Amazon opened! Complete purchase with buyer address.', 'success', 5000);
}

// ==================== INITIALIZATION ====================

/**
 * Initialize the overlay
 */
async function init(): Promise<void> {
    if (!isOrderDetailsPage()) {
        console.log('Not an eBay mesh order details page');
        return;
    }

    console.log('✅ eBay Mesh Order Details page detected');

    // Inject styles
    INJECT_STYLES();

    // Wait for page content to load
    await waitForElement(EBAY_MESH_SELECTORS.lineItemCard);
    
    // Small delay to ensure all content is rendered
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Load settings
    const settings = await loadSettings();

    // Extract order data
    const orderData = extractOrderData();
    console.log('📦 Order data extracted:', orderData);

    // Create overlay for each line item
    const lineItemCards = document.querySelectorAll(EBAY_MESH_SELECTORS.lineItemCard);
    
    for (let i = 0; i < lineItemCards.length; i++) {
        const card = lineItemCards[i];
        const item = orderData.lineItems[i];
        if (item) {
            await createOverlayForItem(card, item, orderData, settings);
        }
    }

    // Watch for dynamic content changes
    const observer = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                const newCards = document.querySelectorAll(EBAY_MESH_SELECTORS.lineItemCard);
                for (let i = 0; i < newCards.length; i++) {
                    const card = newCards[i];
                    if (!card.querySelector('.ecomflow-utility-buttons')) {
                        const item = extractLineItem(card);
                        const updatedOrderData = extractOrderData();
                        await createOverlayForItem(card, item, updatedOrderData, settings);
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    showToast('Syndrax Sync: Auto Order tools loaded!', 'success', 2000);
}

// ==================== ENTRY POINT ====================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((
    message: { type: string; data?: any },
    _sender: any,
    sendResponse: (response?: any) => void
) => {
    if (message.type === 'refreshOverlay') {
        init();
        sendResponse({ success: true });
    }
    return true;
});

// Export for testing
export { 
    extractOrderData, 
    extractShippingAddress, 
    extractLineItem,
    isOrderDetailsPage,
    decodeSkuToAsin 
};
