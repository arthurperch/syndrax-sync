const I={getLinkOnly:!1,useGiftOption:!1,giftMessage:"",giftSender:"",defaultQuantityIncrease:0,autoFillAddress:!0},O={etaMessage:"Your order is expected to arrive by {date}. Thank you for your purchase!",customEtaDate:""},q={feedbackMessage:"Thank you for your purchase! We hope you enjoy your item. If you have any questions, please don't hesitate to reach out."},u={orderIdFromUrl:/orderid[=\/]([^&\/]+)/i,shipToContainer:".ship-to",addressContainer:".ship-to .address",copyAddressButton:'.ship-to button[aria-label*="Copy address"]',nameButton:".address div:first-child .tooltip button",streetButton:".address div:nth-child(2) .tooltip button",cityStateZipContainer:".address div:nth-child(3)",countryButton:".address div:nth-child(4) .tooltip button",itemInfoContainer:"#itemInfo",lineItemCard:".lineItemCard",lineItemCardInfo:".lineItemCardInfo",itemIdContainer:".lineItemCardInfo__itemId.spaceTop",skuContainer:".lineItemCardInfo__sku.spaceTop",itemTitle:".lineItemCardInfo__content .details a span.PSEUDOLINK",itemImage:".orders-image-control__image",itemLink:".lineItemCardInfo__content .details a",quantityValue:".quantity__value span.sh-bold",quantityAvailable:".quantity__value",itemPriceValue:".soldPrice__value",itemTotalValue:".total__value",itemIdText:".lineItemCardInfo__itemId span.sh-secondary:last-child",skuText:".lineItemCardInfo__sku span.sh-secondary:last-child",trackingContainer:".lineItemCardInfo__tracking",addTrackingButton:".tracking-info button.edit-link",orderStatus:".order-status",orderDate:".order-date"},T=`
/* Main utility buttons container */
.ecomflow-utility-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
    padding: 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 8px;
    border: 1px solid #dee2e6;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Automation row with Auto Order button */
.ecomflow-automation-div {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

/* Copy link button */
.ecomflow-copy-link-button {
    padding: 8px 16px;
    background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.ecomflow-copy-link-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    background: linear-gradient(135deg, #5a6268 0%, #3d4246 100%);
}

/* Auto order container */
.ecomflow-auto-order-container {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
}

/* Main Auto Order button */
.ecomflow-auto-order-button {
    padding: 10px 20px;
    background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 3px 6px rgba(255,107,53,0.3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.ecomflow-auto-order-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255,107,53,0.4);
    background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%);
}

.ecomflow-auto-order-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(255,107,53,0.3);
}

.ecomflow-auto-order-button.processing {
    background: linear-gradient(135deg, #adb5bd 0%, #6c757d 100%);
    cursor: wait;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

/* Settings icon */
.ecomflow-settings-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
}

.ecomflow-settings-icon:hover {
    background: #dee2e6;
    transform: rotate(45deg);
}

/* Settings modal */
.ecomflow-settings-modal {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    padding: 16px;
    min-width: 300px;
    z-index: 10000;
    display: none;
}

.ecomflow-settings-modal.visible {
    display: block;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.ecomflow-settings-modal-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ecomflow-settings-modal-close {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 18px;
    cursor: pointer;
    color: #6c757d;
    line-height: 1;
}

.ecomflow-settings-modal-close:hover {
    color: #343a40;
}

.ecomflow-settings-modal label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #495057;
    cursor: pointer;
}

.ecomflow-settings-modal input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #ff6b35;
}

.ecomflow-settings-modal textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 12px;
    resize: vertical;
    font-family: inherit;
}

.ecomflow-settings-modal input[type="text"] {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
}

/* Quantity container */
.ecomflow-quantity-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid #dee2e6;
    margin-top: 4px;
}

.ecomflow-quantity-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 500;
}

.ecomflow-quantity-select {
    padding: 6px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
    background: white;
    cursor: pointer;
}

.ecomflow-update-quantity-button {
    padding: 6px 12px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.ecomflow-update-quantity-button:hover {
    background: #218838;
}

/* ETA Section */
.ecomflow-eta-div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #dee2e6;
}

.ecomflow-eta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.ecomflow-eta-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 600;
    min-width: 30px;
}

.ecomflow-eta-field {
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
}

.ecomflow-eta-link {
    font-size: 11px;
    color: #007bff;
    text-decoration: none;
}

.ecomflow-eta-link:hover {
    text-decoration: underline;
}

.ecomflow-copy-eta-button {
    padding: 6px 12px;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.ecomflow-copy-eta-button:hover {
    background: #138496;
}

/* Feedback Section */
.ecomflow-feedback-div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #dee2e6;
}

.ecomflow-feedback-link {
    font-size: 11px;
    color: #007bff;
    text-decoration: none;
}

.ecomflow-feedback-link:hover {
    text-decoration: underline;
}

.ecomflow-copy-feedback-button {
    padding: 6px 12px;
    background: #6f42c1;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
    align-self: flex-start;
}

.ecomflow-copy-feedback-button:hover {
    background: #5a32a3;
}

/* Action buttons container */
.ecomflow-action-buttons-container {
    padding-top: 10px;
    border-top: 1px solid #dee2e6;
}

.ecomflow-action-buttons-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.ecomflow-clipboard-label {
    font-size: 11px;
    color: #6c757d;
    font-weight: 500;
    margin-right: 4px;
}

.ecomflow-icon-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.ecomflow-icon-button:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ecomflow-icon-button img,
.ecomflow-icon-button svg {
    width: 20px;
    height: 20px;
}

.ecomflow-icon-button-status {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.ecomflow-icon-button-status.success {
    background: #28a745;
}

.ecomflow-icon-button-status.error {
    background: #dc3545;
}

/* Toast notifications */
.ecomflow-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: #343a40;
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 100000;
    animation: slideInUp 0.3s ease;
}

.ecomflow-toast.success {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
}

.ecomflow-toast.error {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
}

.ecomflow-toast.info {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Section headers */
.ecomflow-section-header {
    font-size: 11px;
    font-weight: 600;
    color: #495057;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}

/* Divider */
.ecomflow-divider {
    height: 1px;
    background: #dee2e6;
    margin: 8px 0;
}

/* Button states */
.ecomflow-button-copied {
    background: #28a745 !important;
}

/* Loading spinner */
.ecomflow-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`,A=()=>{if(document.getElementById("ecomflow-overlay-styles"))return;const e=document.createElement("style");e.id="ecomflow-overlay-styles",e.textContent=T,document.head.appendChild(e)};console.log("🛒 Syndrax Sync: eBay Mesh Order Overlay loaded");function b(e,t="info",n=3e3){const c=document.querySelector(".ecomflow-toast");c&&c.remove();const a=document.createElement("div");a.className=`ecomflow-toast ${t}`,a.textContent=e,document.body.appendChild(a),setTimeout(()=>a.remove(),n)}async function g(e,t="Copied!"){try{return await navigator.clipboard.writeText(e),b(t,"success"),!0}catch(n){return console.error("Failed to copy:",n),b("Failed to copy","error"),!1}}function $(e){try{const t=atob(e),n=t.match(/[A-Z0-9]{10}/i);return n?n[0].toUpperCase():t}catch{return e}}function v(e){if(!e)return 0;const t=e.match(/[\d,.]+/);return t?parseFloat(t[0].replace(/,/g,"")):0}function L(){var e,t;try{const n=[".earnings dl.total dd.amount .sh-bold",".earnings .total dd.amount .value .sh-bold",".earnings .total .amount .sh-bold",'dl.total:has(button:contains("Order earnings")) dd.amount .sh-bold'];for(const a of n){const i=document.querySelector(a);if(i){const r=(((e=i.textContent)==null?void 0:e.trim())||"").match(/\$?([\d,]+\.?\d*)/);if(r){const l=parseFloat(r[1].replace(",",""));if(!isNaN(l)&&l>0)return console.log(`💰 Found eBay earnings: $${l.toFixed(2)} via "${a}"`),l}}}const c=document.evaluate("//button[contains(text(), 'Order earnings')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;if(c&&c instanceof Element){const a=c.closest("dl.total");if(a){const i=a.querySelector("dd.amount .sh-bold");if(i){const r=(((t=i.textContent)==null?void 0:t.trim())||"").match(/\$?([\d,]+\.?\d*)/);if(r){const l=parseFloat(r[1].replace(",",""));return console.log(`💰 Found eBay earnings via XPath: $${l.toFixed(2)}`),l}}}}return console.log("💰 eBay Order Earnings not found"),null}catch(n){return console.error("Error extracting eBay earnings:",n),null}}function _(e,t=1e4){return new Promise(n=>{const c=document.querySelector(e);if(c){n(c);return}const a=new MutationObserver((i,o)=>{const r=document.querySelector(e);r&&(o.disconnect(),n(r))});a.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{a.disconnect(),n(document.querySelector(e))},t)})}function z(){return window.location.href.includes("ebay.com/mesh/ord/details")}function M(){const t=window.location.href.match(u.orderIdFromUrl);return t?t[1]:""}function N(){var t;const e={fullName:"",street:"",city:"",state:"",zipCode:"",country:""};try{console.log("🔍 Extracting shipping address...");const n=document.querySelector(".ship-to");if(console.log("📍 Ship-to container:",n?"Found":"NOT FOUND"),!n&&!document.querySelector('.shipping-address, [class*="ship-to"], [class*="shipping"]'))return console.error("❌ Cannot find shipping address container"),e;const c=document.querySelector(".ship-to .address")||document.querySelector(".address");if(console.log("📍 Address container:",c?"Found":"NOT FOUND"),!c)return e;const a=c.querySelectorAll(":scope > div");console.log(`📍 Found ${a.length} address divs`),a.forEach((o,r)=>{const l=o.querySelectorAll(".tooltip button, button.tooltip__host"),s=[];if(l.forEach(d=>{var p;const m=(p=d.textContent)==null?void 0:p.trim();m&&m.length>0&&s.push(m)}),console.log(`📍 Div ${r} parts:`,s),r===0&&s.length>0)e.fullName=s[0];else if(r===1&&s.length>0)e.street=s.join(" ");else if(r===2){if(s.length>=3)e.city=s[0],e.state=s[1],e.zipCode=s[2];else if(s.length===2){e.city=s[0];const d=s[1].match(/([A-Z]{2})\s*([\d-]+)/);d&&(e.state=d[1],e.zipCode=d[2])}}else r===3&&s.length>0&&(e.country=s[0])});const i=document.querySelector(".phone button, dl.phone button, .phone .tooltip button");if(i){let o=((t=i.textContent)==null?void 0:t.trim())||"";o=o.replace(/^\+1\s*/,"").replace(/[^\d]/g,""),o.length>=10&&(e.phone=o),console.log("📞 Phone extracted:",e.phone)}e.country||(e.country="United States"),console.log("✅ Extracted address:",e)}catch(n){console.error("❌ Error extracting shipping address:",n)}return e}function E(e){var n,c,a,i,o;const t={itemId:"",title:"",sku:"",decodedSku:"",quantity:1,available:0,itemPrice:0,itemTotal:0,imageUrl:"",itemUrl:""};try{const r=e.querySelector(u.itemTitle);t.title=((n=r==null?void 0:r.textContent)==null?void 0:n.trim())||"";const l=e.querySelector(u.itemLink);t.itemUrl=(l==null?void 0:l.href)||"";const s=e.querySelector(u.itemImage);t.imageUrl=(s==null?void 0:s.src)||"";const d=e.querySelector(u.itemIdContainer);if(d){const f=d.querySelectorAll("span.sh-secondary");f.length>=2&&(t.itemId=((c=f[1].textContent)==null?void 0:c.trim())||"")}const m=e.querySelector(u.skuContainer);if(m){const f=m.querySelectorAll("span.sh-secondary");f.length>=2&&(t.sku=((a=f[1].textContent)==null?void 0:a.trim())||"",t.decodedSku=$(t.sku))}const p=e.querySelector(u.quantityValue);if(p){const f=(i=p.textContent)==null?void 0:i.match(/\d+/);t.quantity=f?parseInt(f[0]):1}const k=e.querySelector(u.quantityAvailable);if(k){const f=(o=k.textContent)==null?void 0:o.match(/\((\d+)\s*available\)/i);t.available=f?parseInt(f[1]):0}const x=e.querySelector(u.itemPriceValue);t.itemPrice=v((x==null?void 0:x.textContent)||"");const h=e.querySelector(u.itemTotalValue);t.itemTotal=v((h==null?void 0:h.textContent)||"")}catch(r){console.error("Error extracting line item:",r)}return t}function S(){const e=M(),t=N(),n=[];return document.querySelectorAll(u.lineItemCard).forEach(a=>{const i=E(a);(i.itemId||i.title)&&n.push(i)}),{orderId:e,lineItems:n,shipping:t}}async function F(){return new Promise(e=>{chrome.storage.local.get(["autoOrderSettings","etaSettings","feedbackSettings"],t=>{e({autoOrder:t.autoOrderSettings||I,eta:t.etaSettings||O,feedback:t.feedbackSettings||q})})})}async function y(e,t){return new Promise(n=>{chrome.storage.local.set({[e]:t},n)})}function D(e){const t=document.createElement("div");t.className="ecomflow-settings-modal",t.innerHTML=`
        <span class="ecomflow-settings-modal-close">×</span>
        <div class="ecomflow-settings-modal-content">
            <label>
                <input type="checkbox" id="ecomflow-get-link-only" ${e.getLinkOnly?"checked":""}>
                Get link instead of auto order
            </label>
            <label>
                <input type="checkbox" id="ecomflow-use-gift" ${e.useGiftOption?"checked":""}>
                Use Gift Option
            </label>
            <div class="ecomflow-gift-options" style="display: ${e.useGiftOption?"block":"none"}">
                <label style="flex-direction: column; align-items: flex-start;">
                    Gift Message:
                    <textarea id="ecomflow-gift-message" rows="3" cols="25">${e.giftMessage}</textarea>
                </label>
                <label style="flex-direction: column; align-items: flex-start;">
                    Gift Message Sender:
                    <input type="text" id="ecomflow-gift-sender" value="${e.giftSender}">
                </label>
            </div>
        </div>
    `;const n=t.querySelector(".ecomflow-settings-modal-close");n==null||n.addEventListener("click",()=>t.classList.remove("visible"));const c=t.querySelector("#ecomflow-get-link-only"),a=t.querySelector("#ecomflow-use-gift"),i=t.querySelector(".ecomflow-gift-options"),o=t.querySelector("#ecomflow-gift-message"),r=t.querySelector("#ecomflow-gift-sender");return c==null||c.addEventListener("change",async()=>{e.getLinkOnly=c.checked,await y("autoOrderSettings",e)}),a==null||a.addEventListener("change",async()=>{e.useGiftOption=a.checked,i.style.display=a.checked?"block":"none",await y("autoOrderSettings",e)}),o==null||o.addEventListener("change",async()=>{e.giftMessage=o.value,await y("autoOrderSettings",e)}),r==null||r.addEventListener("change",async()=>{e.giftSender=r.value,await y("autoOrderSettings",e)}),t}function U(){const e=document.createElement("div");return e.className="ecomflow-quantity-container",e.innerHTML=`
        <label class="ecomflow-quantity-label">Increase Quantity:</label>
        <select class="ecomflow-quantity-select">
            ${Array.from({length:11},(t,n)=>`<option value="${n}">${n}</option>`).join("")}
        </select>
        <button class="ecomflow-update-quantity-button">Update</button>
    `,e}function P(e){const t=document.createElement("div");t.className="ecomflow-eta-div";const n=new Date,a=new Date(n.getTime()+7*24*60*60*1e3).toISOString().split("T")[0];t.innerHTML=`
        <div class="ecomflow-eta-row">
            <label class="ecomflow-eta-label">ETA:</label>
            <input type="date" class="ecomflow-eta-field" value="${e.customEtaDate||a}">
            <a class="ecomflow-eta-link" href="#" title="Configure ETA Message">Change ETA Message</a>
        </div>
        <button class="ecomflow-copy-eta-button">Copy ETA Message</button>
    `;const i=t.querySelector(".ecomflow-copy-eta-button"),o=t.querySelector(".ecomflow-eta-field");return i==null||i.addEventListener("click",async()=>{const r=(o==null?void 0:o.value)||a,l=new Date(r).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),s=e.etaMessage.replace("{date}",l);await g(s,"ETA message copied!")}),t}function B(e){const t=document.createElement("div");t.className="ecomflow-feedback-div",t.innerHTML=`
        <a class="ecomflow-feedback-link" href="#" title="Configure Feedback Message">Change Feedback Message</a>
        <button class="ecomflow-copy-feedback-button">Copy Feedback Message</button>
    `;const n=t.querySelector(".ecomflow-copy-feedback-button");return n==null||n.addEventListener("click",async()=>{await g(e.feedbackMessage,"Feedback message copied!")}),t}function Y(e){const t=document.createElement("div");t.className="ecomflow-action-buttons-container",t.innerHTML=`
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
    `;const n=t.querySelector("#ecomflow-copy-address"),c=t.querySelector("#ecomflow-copy-order"),a=t.querySelector("#ecomflow-copy-name"),i=t.querySelector("#ecomflow-search-amazon");return n==null||n.addEventListener("click",()=>{const o=e.shipping,r=`${o.fullName}
${o.street}
${o.city}, ${o.state} ${o.zipCode}
${o.country}`;g(r,"Address copied!")}),c==null||c.addEventListener("click",()=>{var s,d;const o=e.lineItems[0],r=e.shipping,l=`Order: ${e.orderId}
Item: ${(o==null?void 0:o.title)||"N/A"}
Item ID: ${(o==null?void 0:o.itemId)||"N/A"}
SKU: ${(o==null?void 0:o.sku)||"N/A"} (Decoded: ${(o==null?void 0:o.decodedSku)||"N/A"})
Quantity: ${(o==null?void 0:o.quantity)||0}
Price: $${((s=o==null?void 0:o.itemPrice)==null?void 0:s.toFixed(2))||"0.00"}
Total: $${((d=o==null?void 0:o.itemTotal)==null?void 0:d.toFixed(2))||"0.00"}

Ship To:
${r.fullName}
${r.street}
${r.city}, ${r.state} ${r.zipCode}
${r.country}`;g(l,"Order details copied!")}),a==null||a.addEventListener("click",()=>{g(e.shipping.fullName,"Name copied!")}),i==null||i.addEventListener("click",()=>{const o=e.lineItems[0],r=(o==null?void 0:o.decodedSku)||(o==null?void 0:o.title)||"";r&&window.open(`https://www.amazon.com/s?k=${encodeURIComponent(r)}`,"_blank")}),t}async function C(e,t,n,c){const a=e.querySelector(u.itemIdContainer);if(!a){console.warn("Injection point not found for item:",t.itemId);return}if(a.querySelector(".ecomflow-utility-buttons"))return;const i=document.createElement("div");i.className="ecomflow-utility-buttons";const o=document.createElement("div");o.className="ecomflow-automation-div";const r=document.createElement("button");r.className="ecomflow-copy-link-button",r.textContent="Copy",r.addEventListener("click",()=>{const p=t.decodedSku?`https://www.amazon.com/dp/${t.decodedSku}`:`https://www.amazon.com/s?k=${encodeURIComponent(t.title)}`;g(p,"Amazon link copied!")});const l=document.createElement("div");l.className="ecomflow-auto-order-container";const s=document.createElement("button");s.className="ecomflow-auto-order-button",s.textContent="Auto Order",s.addEventListener("click",async()=>{await G(t,n,c.autoOrder)});const d=document.createElement("span");d.className="ecomflow-settings-icon",d.textContent="⚙";const m=D(c.autoOrder);d.addEventListener("click",p=>{p.stopPropagation(),m.classList.toggle("visible")}),document.addEventListener("click",p=>{!m.contains(p.target)&&p.target!==d&&m.classList.remove("visible")}),l.appendChild(s),l.appendChild(d),l.appendChild(m),o.appendChild(r),o.appendChild(l),i.appendChild(o),i.appendChild(U()),i.appendChild(P(c.eta)),i.appendChild(B(c.feedback)),i.appendChild(Y(n)),a.appendChild(i),console.log("✅ Syndrax overlay injected for item:",t.itemId)}async function G(e,t,n){console.log("🚀 Auto Order triggered for:",e.title);let c;if(e.decodedSku&&e.decodedSku.match(/^[A-Z0-9]{10}$/i)?c=`https://www.amazon.com/dp/${e.decodedSku}`:c=`https://www.amazon.com/s?k=${encodeURIComponent(e.title)}`,n.getLinkOnly){await g(c,"Amazon link copied!");return}const a=L();console.log("💰 Extracted eBay Order Earnings:",a);const i={shipping:t.shipping,itemTitle:e.title,quantity:e.quantity,amazonUrl:c,itemId:e.itemId,ebayOrderId:t.orderId,ebayEarnings:a,giftOptions:n.useGiftOption?{enabled:!0,message:n.giftMessage,sender:n.giftSender}:void 0,timestamp:Date.now()};await new Promise(o=>{chrome.storage.local.set({pendingAmazonOrder:i,autoOrderInProgress:!0},o)}),chrome.runtime.sendMessage({type:"startAutoOrder",data:i},o=>{o!=null&&o.success&&b("Opening Amazon...","info")}),window.open(c,"_blank"),b("Amazon opened! Complete purchase with buyer address.","success",5e3)}async function w(){if(!z()){console.log("Not an eBay mesh order details page");return}console.log("✅ eBay Mesh Order Details page detected"),A(),await _(u.lineItemCard),await new Promise(a=>setTimeout(a,1500));const e=await F(),t=S();console.log("📦 Order data extracted:",t);const n=document.querySelectorAll(u.lineItemCard);for(let a=0;a<n.length;a++){const i=n[a],o=t.lineItems[a];o&&await C(i,o,t,e)}new MutationObserver(async a=>{for(const i of a)if(i.addedNodes.length>0){const o=document.querySelectorAll(u.lineItemCard);for(let r=0;r<o.length;r++){const l=o[r];if(!l.querySelector(".ecomflow-utility-buttons")){const s=E(l),d=S();await C(l,s,d,e)}}}}).observe(document.body,{childList:!0,subtree:!0}),b("Syndrax Sync: Auto Order tools loaded!","success",2e3)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",w):w();chrome.runtime.onMessage.addListener((e,t,n)=>(e.type==="refreshOverlay"&&(w(),n({success:!0})),!0));export{$ as decodeSkuToAsin,E as extractLineItem,S as extractOrderData,N as extractShippingAddress,z as isOrderDetailsPage};
