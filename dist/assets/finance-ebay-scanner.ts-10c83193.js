(function(){function S(){const e=[];console.log("🔍 Scanning eBay sold page for orders...");const o=document.querySelectorAll('.sold-item, .m-order-card, [class*="order-item"], .sh-revison-card, .soldItemContainer');return console.log(`📦 Found ${o.length} potential order cards`),o.length===0?D(e):o.forEach((n,t)=>{try{const r=$(n,t);r&&e.push(r)}catch(r){console.warn(`Failed to extract order ${t}:`,r)}}),e.length===0&&U(e),console.log(`✅ Extracted ${e.length} orders from page`),e}function $(e,o){var b,w,v;const n=e.textContent||"",t=n.match(/Order ID[:\s]*(\d{2}-\d{5}-\d{5})/i)||n.match(/(\d{2}-\d{5}-\d{5})/)||n.match(/Order[:\s#]*(\d+)/i),r=n.match(/Item ID[:\s]*(\d{10,14})/i)||n.match(/Item[:\s#]*(\d{10,14})/i),s=e.querySelector('a[href*="/itm/"]'),d=s==null?void 0:s.href,i=(b=d==null?void 0:d.match(/\/itm\/(\d+)/))==null?void 0:b[1],a=e.querySelector('.item-title, .sh-listing-title, [class*="title"] a, a[href*="/itm/"]'),c=(w=a==null?void 0:a.textContent)==null?void 0:w.trim(),g=n.match(/Custom label[:\s]*([^\n\r]+)/i)||n.match(/SKU[:\s]*([^\n\r]+)/i),u=n.match(/(Sold|Paid)\s+on\s+(\w+\s+\d+,?\s*\d*)/i)||n.match(/(\w+\s+\d+,?\s*\d{4})/),h=e.querySelector('a[href*="transactiondetails"], a[href*="mes/"]'),E=h==null?void 0:h.href,m=e.querySelector('a[href*="mesh/ord/details"]'),I=m==null?void 0:m.href;if(!c&&!t&&!i&&!r)return null;const f=t==null?void 0:t[1],y=i||(r==null?void 0:r[1]),x={id:`ebay-${f||y||o}-${Date.now()}`,orderId:f,itemId:y,sku:(v=g==null?void 0:g[1])==null?void 0:v.trim(),ebayTitle:c,ebayItemUrl:d,orderDetailsUrl:I,paymentDetailsUrl:E,soldDate:(u==null?void 0:u[2])||(u==null?void 0:u[1]),scanSourceUrl:window.location.href,status:"ebay_found",createdAt:Date.now(),updatedAt:Date.now(),raw:{ebayListSnippet:e.innerHTML.substring(0,1e3)}};return!x.paymentDetailsUrl&&f&&(x.paymentDetailsUrl=`https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${f}`),console.log(`📦 Order ${o}: ID=${f}, Item=${y}, Title="${c==null?void 0:c.substring(0,30)}..."`),x}function D(e){const n=document.body.innerText.match(/\d{2}-\d{5}-\d{5}/g)||[],t=[...new Set(n)];console.log(`📋 Found ${t.length} unique order IDs via text scan`),t.forEach((r,s)=>{e.push({id:`ebay-${r}-${Date.now()}`,orderId:r,paymentDetailsUrl:`https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${r}`,scanSourceUrl:window.location.href,status:"ebay_found",createdAt:Date.now(),updatedAt:Date.now()})})}function U(e){const o=document.querySelectorAll("a[href]"),n=new Set;o.forEach(t=>{var s,d,i;const r=t.href;if(r.includes("transactiondetails")||r.includes("mes/transactiondetails")){const a=r.match(/ordid=([^&]+)/);if(a&&!n.has(a[1])){n.add(a[1]);const c=t.closest('.sold-item, .m-order-card, [class*="order"]'),g=(c==null?void 0:c.querySelector('[class*="title"]'))||((d=(s=t.parentElement)==null?void 0:s.parentElement)==null?void 0:d.querySelector('[class*="title"]'));e.push({id:`ebay-${a[1]}-${Date.now()}`,orderId:a[1],ebayTitle:(i=g==null?void 0:g.textContent)==null?void 0:i.trim(),paymentDetailsUrl:r,scanSourceUrl:window.location.href,status:"ebay_found",createdAt:Date.now(),updatedAt:Date.now()})}}if(r.includes("mesh/ord/details")){const a=r.match(/orderid=([^&]+)/);a&&!n.has(a[1])&&(n.add(a[1]),e.push({id:`ebay-${a[1]}-${Date.now()}`,orderId:a[1],orderDetailsUrl:r,paymentDetailsUrl:`https://www.ebay.com/mes/transactiondetails?type=ORDER&ordid=${a[1]}`,scanSourceUrl:window.location.href,status:"ebay_found",createdAt:Date.now(),updatedAt:Date.now()}))}}),console.log(`📋 Found ${e.length} orders via link scan`)}function C(){var t;const e=document.querySelector("button.pagination__next[data-url]");if(e&&!e.hasAttribute("aria-disabled")){const r=e.getAttribute("data-url");if(r){const d=(window.location.origin+window.location.pathname).replace("/rf/","/rf/")+(r.startsWith("?")?r:"?"+r);return console.log(`📄 Found next page via data-url: ${d}`),d}}const o=['a[aria-label*="Next"]','a[title*="Next"]',".pagination__next a",'.pagination a[rel="next"]',"a.pagination__item--next"];for(const r of o){const s=document.querySelector(r);if(s!=null&&s.href)return console.log(`📄 Found next page: ${s.href}`),s.href}const n=(t=document.querySelector(".pagination h2"))==null?void 0:t.textContent;if(n){const r=n.match(/Page (\d+) of (\d+)/i);if(r){const s=parseInt(r[1]),d=parseInt(r[2]);if(console.log(`📄 Page ${s} of ${d}`),s<d){const i=new URL(window.location.href),a=s*25;return i.searchParams.set("offset",String(a)),console.log(`📄 Next page URL: ${i.href}`),i.href}}}return console.log("📄 No next page found"),null}function A(){var o,n,t;if(document.getElementById("earnings-scanner-ui"))return;const e=document.createElement("div");e.id="earnings-scanner-ui",e.innerHTML=`
    <style>
      #earnings-scanner-ui {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 380px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white;
        overflow: hidden;
      }
      .es-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .es-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .es-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
      }
      .es-body { padding: 16px; }
      .es-stats {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
        margin-bottom: 14px;
      }
      .es-stat {
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px;
        text-align: center;
      }
      .es-stat-val { font-size: 20px; font-weight: 700; color: #4ade80; }
      .es-stat-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; }
      .es-progress {
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
        height: 6px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .es-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4ade80, #22d3ee);
        width: 0%;
        transition: width 0.3s;
      }
      .es-status { font-size: 12px; color: #94a3b8; margin-bottom: 12px; min-height: 18px; }
      .es-btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 8px;
        transition: all 0.2s;
      }
      .es-btn-primary {
        background: linear-gradient(135deg, #4ade80 0%, #22d3ee 100%);
        color: #0f172a;
      }
      .es-btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(74, 222, 128, 0.4);
      }
      .es-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .es-btn-secondary {
        background: rgba(255,255,255,0.1);
        color: white;
      }
      .es-log {
        background: rgba(0,0,0,0.3);
        border-radius: 8px;
        padding: 10px;
        max-height: 150px;
        overflow-y: auto;
        font-size: 10px;
        font-family: monospace;
      }
      .es-log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .es-log-success { color: #4ade80; }
      .es-log-error { color: #f87171; }
      .es-log-info { color: #60a5fa; }
    </style>
    
    <div class="es-header">
      <h3>💰 eBay Earnings Scanner</h3>
      <button class="es-close" id="es-close">×</button>
    </div>
    
    <div class="es-body">
      <div class="es-stats">
        <div class="es-stat">
          <div class="es-stat-val" id="es-found">0</div>
          <div class="es-stat-label">Found</div>
        </div>
        <div class="es-stat">
          <div class="es-stat-val" id="es-processed">0</div>
          <div class="es-stat-label">Processed</div>
        </div>
        <div class="es-stat">
          <div class="es-stat-val" id="es-total">$0</div>
          <div class="es-stat-label">Earnings</div>
        </div>
      </div>
      
      <div class="es-progress">
        <div class="es-progress-bar" id="es-progress"></div>
      </div>
      
      <div class="es-status" id="es-status">Ready. Click "Start Scan" to begin.</div>
      
      <button class="es-btn es-btn-primary" id="es-start">🚀 Start Earnings Scan</button>
      <button class="es-btn es-btn-secondary" id="es-view">📋 View Inventory</button>
      
      <div class="es-log" id="es-log">
        <div class="es-log-entry es-log-info">Scanner ready.</div>
      </div>
    </div>
  `,document.body.appendChild(e),(o=document.getElementById("es-close"))==null||o.addEventListener("click",()=>e.remove()),(n=document.getElementById("es-start"))==null||n.addEventListener("click",B),(t=document.getElementById("es-view"))==null||t.addEventListener("click",F)}function l(e,o="info"){const n=document.getElementById("es-log");if(!n)return;const t=document.createElement("div");for(t.className=`es-log-entry es-log-${o}`,t.textContent=`[${new Date().toLocaleTimeString()}] ${e}`,n.insertBefore(t,n.firstChild);n.children.length>30;)n.removeChild(n.lastChild)}function p(e){if(e.found!==void 0){const o=document.getElementById("es-found");o&&(o.textContent=String(e.found))}if(e.processed!==void 0){const o=document.getElementById("es-processed");o&&(o.textContent=String(e.processed))}if(e.total!==void 0){const o=document.getElementById("es-total");o&&(o.textContent=e.total)}if(e.status!==void 0){const o=document.getElementById("es-status");o&&(o.textContent=e.status)}if(e.progress!==void 0){const o=document.getElementById("es-progress");o&&(o.style.width=`${e.progress}%`)}}async function B(){const e=document.getElementById("es-start");e&&(e.disabled=!0,e.textContent="⏳ Scanning..."),l("Extracting orders from page...","info"),p({status:"Extracting orders..."});const o=S();if(o.length===0){l("No orders found on page","error"),p({status:"No orders found"}),e&&(e.disabled=!1,e.textContent="🚀 Start Earnings Scan");return}l(`Found ${o.length} orders`,"success"),p({found:o.length,status:`Opening ${o.length} payment pages...`});const n=o.map(t=>({...t,paymentUrl:t.paymentDetailsUrl||`https://www.ebay.com/mesh/pmt/details?orderId=${t.orderId}`}));console.log("📤 Sending orders to background:",n),chrome.runtime.sendMessage({type:"START_EARNINGS_BATCH_SCAN",payload:{orders:n,batchSize:5},timestamp:Date.now()}).then(t=>{console.log("📥 Response:",t),t!=null&&t.success?l("Batch scan started","success"):l(`Error: ${t==null?void 0:t.error}`,"error")}).catch(t=>{l(`Error: ${t.message}`,"error")})}async function F(){var r;const o=(await chrome.storage.local.get("soldInventory")).soldInventory||[];let n=0;o.forEach(s=>{if(s.orderEarnings){const d=s.orderEarnings.match(/[\d,.]+/);d&&(n+=parseFloat(d[0].replace(",","")))}});const t=document.createElement("div");t.id="es-inventory-modal",t.style.cssText=`
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); z-index: 9999999;
    display: flex; align-items: center; justify-content: center;
  `,t.innerHTML=`
    <div style="background: #1a1a2e; border-radius: 16px; width: 90%; max-width: 1000px; max-height: 80vh; overflow: auto; color: white; font-family: sans-serif;">
      <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 16px 20px; display: flex; justify-content: space-between;">
        <h2 style="margin: 0;">📋 Sold Inventory (${o.length} items) - $${n.toFixed(2)} Total</h2>
        <button id="es-close-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Close</button>
      </div>
      <div style="padding: 20px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; color: white; font-size: 12px;">
          <thead>
            <tr style="background: rgba(255,255,255,0.1);">
              <th style="padding: 10px; text-align: left;">Order ID</th>
              <th style="padding: 10px; text-align: left;">Title</th>
              <th style="padding: 10px; text-align: right;">Earnings</th>
              <th style="padding: 10px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${o.length===0?'<tr><td colspan="4" style="padding: 40px; text-align: center; color: #94a3b8;">No items yet. Run an earnings scan!</td></tr>':o.map(s=>`
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <td style="padding: 10px; font-family: monospace;">${s.orderId||"—"}</td>
                  <td style="padding: 10px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.itemTitle||"—"}</td>
                  <td style="padding: 10px; text-align: right; color: #4ade80; font-weight: bold;">${s.orderEarnings||"—"}</td>
                  <td style="padding: 10px; text-align: center;"><span style="background: #4ade80; color: black; padding: 2px 8px; border-radius: 10px; font-size: 10px;">${s.status||"pending"}</span></td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `,document.body.appendChild(t),(r=document.getElementById("es-close-modal"))==null||r.addEventListener("click",()=>t.remove()),t.addEventListener("click",s=>{s.target===t&&t.remove()})}chrome.runtime.onMessage.addListener((e,o,n)=>{if(console.log("📨 Finance scanner received message:",e.type),e.type==="EXTRACT_EBAY_SOLD_LIST"){try{const t=S(),r=C();n({success:!0,orders:t,nextPageUrl:r,currentUrl:window.location.href,timestamp:Date.now()})}catch(t){console.error("❌ Extraction failed:",t),n({success:!1,error:String(t),currentUrl:window.location.href})}return!0}if(e.type==="EARNINGS_SCAN_PROGRESS")return p({processed:e.processed,progress:e.processed/e.total*100,status:`Processing ${e.processed}/${e.total}...`}),l(`${e.orderId} → ${e.earnings||"extracting..."}`,e.earnings?"success":"info"),!1;if(e.type==="EARNINGS_SCAN_COMPLETE"){p({processed:e.total,progress:100,status:"Scan complete!"}),l(`✅ Scan complete! ${e.total} orders processed.`,"success");const t=document.getElementById("es-start");return t&&(t.disabled=!1,t.textContent="🚀 Start Earnings Scan"),chrome.storage.local.get("soldInventory").then(r=>{const s=r.soldInventory||[];let d=0;s.forEach(i=>{if(i.orderEarnings){const a=i.orderEarnings.match(/[\d,.]+/);a&&(d+=parseFloat(a[0].replace(",","")))}}),p({total:`$${d.toFixed(2)}`})}),!1}return e.type==="PING"?(n({success:!0,scriptLoaded:!0}),!0):!1});console.log("💰 Finance eBay Scanner V2 loaded on:",window.location.href);(window.location.href.includes("/mys/sold")||window.location.href.includes("/sh/ord/"))&&(console.log("📋 On eBay sold page - showing scanner UI"),setTimeout(()=>{A(),l("Scanner ready. Click Start to scan this page.","info"),chrome.storage.local.get("soldInventory").then(e=>{const o=e.soldInventory||[];if(o.length>0){let n=0;o.forEach(t=>{if(t.orderEarnings){const r=t.orderEarnings.match(/[\d,.]+/);r&&(n+=parseFloat(r[0].replace(",","")))}}),p({total:`$${n.toFixed(2)}`}),l(`Loaded ${o.length} items from storage`,"info")}})},1500),chrome.runtime.sendMessage({type:"FINANCE_SCANNER_READY",url:window.location.href}).catch(()=>{}));
})()
