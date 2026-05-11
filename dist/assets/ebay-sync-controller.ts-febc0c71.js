(function(){const H={logs:"https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m",errors:"https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",priceUpdates:"https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY",outOfStock:"https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS"};async function v(e,n){try{await fetch(H[e],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[n]})})}catch(t){console.error("Discord webhook failed:",t)}}const O={syncStarted:e=>v("logs",{title:"⚡ Sync Started",description:`Beginning price and stock check for **${e}** eBay listings`,color:53247,timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),syncComplete:e=>v("logs",{title:"✅ Sync Complete",description:"Finished checking all listings",color:65416,fields:[{name:"📦 Total Checked",value:String(e.checked),inline:!0},{name:"💰 Prices Updated",value:String(e.updated),inline:!0},{name:"❌ Out of Stock",value:String(e.outOfStock),inline:!0},{name:"⚠️ Flagged",value:String(e.flagged),inline:!0},{name:"🔴 Errors",value:String(e.errors),inline:!0},{name:"⏱️ Duration",value:e.duration,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),priceUpdated:e=>v("priceUpdates",{title:e.direction==="up"?"📈 Price Increased":"📉 Price Decreased",description:`**${e.title.substring(0,60)}**`,color:e.direction==="up"?16766720:65416,fields:[{name:"Old eBay Price",value:`$${e.oldPrice.toFixed(2)}`,inline:!0},{name:"New eBay Price",value:`$${e.newPrice.toFixed(2)}`,inline:!0},{name:"Amazon Price",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0},{name:"eBay Listing",value:`[View Listing](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),outOfStock:e=>v("outOfStock",{title:"🚫 Out of Stock — eBay Set to 0",description:`**${e.title.substring(0,60)}**`,color:16727357,fields:[{name:"eBay Listing",value:`[View on eBay](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"Amazon Source",value:`[View on Amazon](${e.amazonUrl})`,inline:!0},{name:"Last Amazon Price",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),wrongItem:e=>v("errors",{title:"⚠️ Wrong Item — Manual Review Needed",description:"Title mismatch between eBay and Amazon",color:16747520,fields:[{name:"eBay Title",value:e.title.substring(0,100),inline:!1},{name:"Amazon Title",value:e.amazonTitle.substring(0,100),inline:!1},{name:"Similarity Score",value:`${(e.similarity*100).toFixed(0)}%`,inline:!0},{name:"ASIN",value:e.asin,inline:!0},{name:"eBay Listing",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),error:e=>v("errors",{title:"🔴 Sync Error",description:`Failed to process: **${e.title.substring(0,60)}**`,color:16711680,fields:[{name:"Error",value:e.error.substring(0,200),inline:!1},{name:"ASIN",value:e.asin||"Unknown",inline:!0},{name:"Listing ID",value:e.listingId,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}),progress:(e,n,t,r)=>{if(e%10===0||e===n)return v("logs",{title:"🔄 Sync Progress",description:`Checked **${e}** of **${n}** items`,color:8019199,fields:[{name:"💰 Updated",value:String(t),inline:!0},{name:"❌ Out of Stock",value:String(r),inline:!0},{name:"📊 Progress",value:`${Math.round(e/n*100)}%`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}})},dryRunComplete:e=>v("logs",{title:"🧪 Dry Run Complete — No Changes Made",description:"Here is what a live sync would have done:",color:8019199,fields:[{name:"💰 Would Update Price",value:String(e.wouldUpdate),inline:!0},{name:"❌ Would Mark Out of Stock",value:String(e.wouldMarkOutOfStock),inline:!0},{name:"⚠️ Would Flag as Wrong Item",value:String(e.wouldFlag),inline:!0},{name:"🔴 Would Error",value:String(e.wouldError),inline:!0},{name:"📦 Total Checked",value:String(e.total),inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync — Dry Run Mode"}}),noAsin:e=>v("errors",{title:"⚪ No ASIN Found — Skipped",description:`**${e.title.substring(0,60)}**`,color:4473924,fields:[{name:"Raw SKU",value:e.rawSku||"Empty",inline:!0},{name:"Listing ID",value:e.listingId,inline:!0},{name:"eBay Listing",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}})};let A=0,q=0,D=0;const i={pageNum:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalNoChange:0,totalRestocked:0};let C=!1,E=!1,_=[];async function G(){const e=document.getElementById("syndrax-log");e&&(_=Array.from(e.children).slice(-30).map(t=>t.textContent||""));const n={isRunning:!0,pageNum:i.pageNum,totalChecked:i.totalChecked,totalUpdated:i.totalUpdated,totalOutOfStock:i.totalOutOfStock,totalFlagged:i.totalFlagged,totalNoChange:i.totalNoChange,totalRestocked:i.totalRestocked,startTime:Date.now(),logMessages:_};await chrome.storage.local.set({syncState:n}),console.log("[Sync] Saved state before navigation:",n)}async function Q(){return(await chrome.storage.local.get("syncState")).syncState||null}async function z(){await chrome.storage.local.remove("syncState")}function f(e){return new Promise(n=>setTimeout(n,e))}async function N(e=15e3){const n=Date.now();for(;Date.now()-n<e;){const t=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(t.length>0)return console.log(`[Sync] Found ${t.length} rows after ${Date.now()-n}ms`),t;await f(500)}return console.log("[Sync] Timeout waiting for rows"),[]}function a(e,n="info"){const t=document.getElementById("syndrax-log");if(t){const r={info:"#00CFFF",success:"#22c55e",error:"#ef4444",warn:"#FFD700"},o=new Date().toLocaleTimeString(),l=document.createElement("div");for(l.style.cssText=`
      font-size: 10px;
      color: ${r[n]};
      margin-bottom: 2px;
      word-break: break-all;
    `,l.textContent=`[${o}] ${e}`,t.appendChild(l),t.scrollTop=t.scrollHeight;t.children.length>50;)t.removeChild(t.firstChild)}console.log(`[Sync ${n}]`,e)}function F(e){const n=document.getElementById("syndrax-status");n&&(n.textContent=e,n.style.color="#00CFFF");const t=document.getElementById("syndrax-loading-msg");t&&(t.textContent=e),a(e,"info")}function V(e){if(!e)return"";try{const t=atob(e.trim());if(/^[A-Z0-9]{10}$/i.test(t))return t.toUpperCase()}catch{}if(/^[A-Z0-9]{10}$/i.test(e.trim()))return e.trim().toUpperCase();const n=e.match(/[A-Z0-9]{10}/i);return n?n[0].toUpperCase():""}function Y(e){var x,y;const n=e.getAttribute("data-id")||"";if(!n)return null;const t=e.querySelector(".shui-dt-column__title a")||e.querySelector(".column-title__text a")||e.querySelector('[data-test-id="item-title"]'),r=((x=t==null?void 0:t.textContent)==null?void 0:x.trim())||"",o=e.querySelector(".shui-dt-column__price")||e.querySelector(".col-price__current"),d=((o==null?void 0:o.textContent)||"").match(/\$([0-9,]+\.?[0-9]*)/),s=d?parseFloat(d[1].replace(",","")):0,g=e.querySelector(".shui-dt-column__listingSKU")||e.querySelector('[data-test-id="listing-sku"]'),m=((y=g==null?void 0:g.textContent)==null?void 0:y.trim())||"",p=V(m);return console.log(`[Sync] Row ${n}: "${r.substring(0,30)}..." Price: $${s} SKU: ${m} ASIN: ${p}`),{listingId:n,title:r,price:s,rawSku:m,asin:p,row:e}}function j(e){var r;const n=e.querySelector('input[name*="availableQuantity"]');if(n)return parseInt(n.value)||0;const t=e.querySelector(".shui-dt-column__availableQuantity");if(t){const l=(((r=t.textContent)==null?void 0:r.trim())||"").match(/\d+/);if(l)return parseInt(l[0])||0}return 1}async function Z(e,n){var p,x;const t=e,r=t.querySelector('button[aria-label="Edit Current price"]')||t.querySelector('button[column="price"]');if(!r)return console.log("[Sync Debug] Edit price button not found"),a("  ❌ Edit price button not found","error"),!1;a("  📝 Clicking Edit Price...","info"),r.click(),await f(1200);let o=null;const l=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');console.log("[Sync Debug] Found price dialogs:",l.length);for(const y of l){const c=y.querySelector('input[name*="price"]')||y.querySelector('input[aria-label*="price" i]')||y.querySelector("input.textbox__control");if(c){o=c,console.log("[Sync Debug] Found price input:",c.name||c.className);break}}if(o||(o=document.querySelector('input[name*="price"]')||document.querySelector("input.textbox__control")),!o)return a("  ❌ Price input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const d=n.toFixed(2);if(a(`  ✏️ Setting price to $${d}...`,"info"),o.focus(),await f(100),o.select(),await f(100),o.setSelectionRange(0,o.value.length),document.execCommand("insertText",!1,d),await f(100),o.value!==d){const y=(p=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:p.set;y&&y.call(o,d),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}o.value!==d&&(o.value=d,o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))),console.log("[Sync Debug] Price input value after setting:",o.value),await f(300),a("  💾 Submitting price...","info");let s=null;const g=document.querySelectorAll("button");for(const y of g)if((((x=y.textContent)==null?void 0:x.trim().toLowerCase())||"")==="submit"){s=y,console.log("[Sync Debug] Found price Submit button with text:",y.className);break}if(s||(s=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),s)console.log("[Sync Debug] Clicking price Submit button"),s.focus(),await f(100),s.click();else{console.log("[Sync Debug] Price Submit button not found");const y=document.querySelector("form.quick-edit-field");if(y){const c=y.querySelector('button[type="submit"]');c?c.click():y.submit()}else return a("  ⚠️ Could not find Submit button for price","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}return await f(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(a("  ⚠️ Price dialog still open","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(a(`  ✅ Price updated to $${d}!`,"success"),!0)}async function M(e,n){var p,x,y;const t=e,r=t.querySelector('button[aria-label="Edit Available quantity"]');if(!r)return t.querySelector('[data-test-id="variation-count"]')||((p=t.textContent)==null?void 0:p.includes("variation"))?(a("  ⚠️ Has variations - skip inline edit","warn"),!1):(a("  ❌ Edit button not found","error"),!1);if(r.disabled||r.getAttribute("aria-disabled")==="true")return a("  ⚠️ Edit disabled - item may be locked","warn"),!1;a("  📝 Clicking Edit...","info"),r.click(),await f(1200);let o=null;const l=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"], [class*="modal"]');console.log("[Sync Debug] Found dialogs:",l.length);for(const c of l){const b=c.querySelector('input[type="text"], input.textbox__control, input');if(b){o=b,console.log("[Sync Debug] Found input in dialog:",b.className);break}}if(o||(o=document.querySelector("input.textbox__control:focus")||document.querySelector('input[aria-label*="quantity" i]')||document.querySelector("input.textbox__control")),!o)return a("  ❌ Input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;if(a(`  ✏️ Setting to ${n}...`,"info"),o.focus(),await f(100),o.select(),o.setSelectionRange(0,o.value.length),await f(100),document.execCommand("insertText",!1,n.toString()),await f(100),o.value!==n.toString()){const c=(x=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:x.set;c&&c.call(o,n.toString()),o.dispatchEvent(new Event("input",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new Event("change",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:n.toString(),inputType:"insertText"}))}if(await f(100),o.value!==n.toString()){o.focus(),o.select();for(let b=0;b<5;b++)o.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keyup",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0}));const c=n.toString();o.dispatchEvent(new KeyboardEvent("keydown",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keypress",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:c,inputType:"insertText"})),o.dispatchEvent(new KeyboardEvent("keyup",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),o.value=n.toString(),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}console.log("[Sync Debug] Input value after setting:",o.value),await f(300),a("  💾 Finding Submit button...","info");const d=document.querySelectorAll('.lightbox-dialog, [role="dialog"], .quick-edit-modal');console.log("[Sync Debug] Open dialogs:",d.length);let s=null;const g=document.querySelectorAll("button");for(const c of g)if((((y=c.textContent)==null?void 0:y.trim().toLowerCase())||"")==="submit"){s=c,console.log('[Sync Debug] Found button with text "Submit":',c.className);break}if(s||(s=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),s)console.log("[Sync Debug] Clicking Submit button:",s.outerHTML.substring(0,100)),s.focus(),await f(100),s.click(),console.log("[Sync Debug] Clicked Submit button");else{console.log("[Sync Debug] Submit button not found, trying form submit");const c=document.querySelectorAll(".lightbox-dialog button, form button");console.log("[Sync Debug] All dialog buttons:",Array.from(c).map(S=>{var w;return{text:(w=S.textContent)==null?void 0:w.trim().substring(0,20),class:S.className,type:S.type}}));const b=document.querySelector("form.quick-edit-field");if(b){const S=b.querySelector('button[type="submit"]');S?(console.log("[Sync Debug] Found form submit button"),S.click()):b.submit()}else return a("  ⚠️ Could not find Submit button","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}return await f(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(a("  ⚠️ Dialog still open - may need manual submit","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(a("  ✅ Updated!","success"),!0)}function k(e,n,t){const r=e,o=r.querySelector(".syndrax-badge");o&&o.remove();const l=document.createElement("span");l.className="syndrax-badge",l.textContent=n,l.style.cssText=`
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: ${t}22;
    border: 1px solid ${t};
    color: ${t};
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    z-index: 9999;
    white-space: nowrap;
  `,r.style.position="relative",r.appendChild(l)}async function L(e,n){var s,g,m;const t=e.row,r=j(e.row),o=e.title.substring(0,25);t.style.outline="2px solid #00CFFF",t.style.background="rgba(0, 207, 255, 0.05)";const l=n.amazonPrice?`$${n.amazonPrice.toFixed(2)}`:"N/A",d=`$${e.price.toFixed(2)}`;switch(a(`${e.asin}: ${n.action}`,"info"),a(`  eBay: qty=${r} price=${d} | Amazon: ${l}`,"info"),n.action){case"WRONG_ITEM":i.totalFlagged++,t.style.outline="2px solid #FF8C00",t.style.background="rgba(255, 140, 0, 0.08)",k(t,`⚠ Wrong Item (${Math.round((n.similarity||0)*100)}%)`,"#FF8C00"),a(`⚠ ${o}... → Wrong item match`,"warn");break;case"OUT_OF_STOCK":if(r>0){a(`🔴 ${o}... → OOS! Needs qty 0`,"error");const p=await M(e.row,0);i.totalOutOfStock++,p?(i.totalUpdated++,a("✓ Quantity updated to 0","success"),await O.outOfStock({title:e.title,listingId:e.listingId,amazonUrl:`https://www.amazon.com/dp/${e.asin}`,amazonPrice:n.amazonPrice||0})):a("⚠ Manual update needed","warn"),t.style.outline="2px solid #FF3D3D",t.style.background="rgba(255, 61, 61, 0.08)",k(t,`✗ OOS (was ${r})`,"#FF3D3D")}else i.totalOutOfStock++,t.style.outline="2px solid #888",k(t,"✗ Already 0","#888"),a(`- ${o}... → Already 0`,"info");break;case"PRICE_UPDATED":case"NO_CHANGE":if(r===0)a(`💚 ${o}... → IN STOCK! Needs qty 1`,"success"),await M(e.row,1)?(i.totalUpdated++,i.totalRestocked++,a("✓ Restocked to 1","success")):a("⚠ Manual restock needed","warn"),t.style.outline="2px solid #00FF88",t.style.background="rgba(0, 255, 136, 0.08)",k(t,"↑ Restocked to 1","#00FF88");else if(n.action==="PRICE_UPDATED"&&n.newEbayPrice){const p=n.priceWentUp?"#FFD700":"#00FF88";t.style.outline=`2px solid ${p}`,t.style.background=n.priceWentUp?"rgba(255, 215, 0, 0.08)":"rgba(0, 255, 136, 0.08)",a(`💰 ${o}... → Price ${n.priceWentUp?"↑":"↓"} $${n.amazonPrice}→$${(s=n.newEbayPrice)==null?void 0:s.toFixed(2)}`,n.priceWentUp?"warn":"success"),await Z(e.row,n.newEbayPrice)?(i.totalUpdated++,k(t,`${n.priceWentUp?"↑":"↓"} $${(g=n.newEbayPrice)==null?void 0:g.toFixed(2)} ✓`,p),a(`✓ Price updated to $${n.newEbayPrice.toFixed(2)}`,"success"),await O.priceUpdated({title:e.title,listingId:e.listingId,oldPrice:e.price,newPrice:n.newEbayPrice,amazonPrice:n.amazonPrice||0,direction:n.priceWentUp?"up":"down"})):(k(t,`${n.priceWentUp?"↑":"↓"} $${(m=n.newEbayPrice)==null?void 0:m.toFixed(2)} ⚠`,p),a("⚠ Manual price update needed","warn"))}else i.totalNoChange++,t.style.outline="2px solid #22c55e",t.style.background="rgba(34, 197, 94, 0.03)",k(t,"✓ OK","#22c55e"),a(`✓ ${o}... → OK ($${n.amazonPrice})`,"success"),setTimeout(()=>{t.style.outline="",t.style.background=""},2e3);break;case"ERROR":case"SOURCE_NOT_FOUND":i.totalFlagged++,t.style.outline="2px solid #888",k(t,"? Error","#888"),a(`? ${o}... → ${n.action}`,"error");break}i.totalChecked++,$()}async function T(){var t;if(C){a("⚠ Sync already running!","warn");return}if(C=!0,i.totalChecked>0)a(`🚀 Continuing sync on page ${i.pageNum}...`,"success");else{const r=document.getElementById("syndrax-log");r&&(r.innerHTML=""),a("🚀 Starting sync...","success"),i.pageNum=1,i.totalChecked=0,i.totalUpdated=0,i.totalOutOfStock=0,i.totalFlagged=0,i.totalNoChange=0,q=0,A=Date.now(),D=document.querySelectorAll("tr.grid-row[data-id]").length,await O.syncStarted(D)}for(chrome.runtime.sendMessage({type:"SYNC_STARTED",payload:{pageNum:i.pageNum},timestamp:Date.now()});!E;){console.log(`[Sync] Processing page ${i.pageNum}`),await f(1e3);const r=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(console.log(`[Sync] Found ${r.length} rows on page ${i.pageNum}`),r.length===0){console.log("[Sync] No rows found, stopping");break}for(let c=0;c<r.length;c+=3){if(E){a("⏹️ Sync stopped by user","warn");break}const b=r.slice(c,c+3),S=[];for(const u of b){const h=Y(u);h&&S.push(h)}const w=S.filter(u=>u.asin);if(w.length===0){console.log(`[Sync] No valid ASINs in batch ${c/3+1}, skipping`),i.totalFlagged+=S.length,i.totalChecked+=S.length;for(const u of S)if(!u.asin){const h=u.row;h.style.outline="2px solid #888",k(h,"⚠ No ASIN","#888")}continue}console.log(`[Sync] Checking ${w.length} items with ASINs...`),F(`Checking batch ${Math.floor(c/3)+1}...`);const I=w.map(u=>({listingId:u.listingId,title:u.title,price:u.price,asin:u.asin,amazonUrl:`https://www.amazon.com/dp/${u.asin}`})),W=I.map(u=>u.asin).join(", ");a(`📦 Batch ASINs: ${W}`,"info"),console.log("[Sync] Sending to background:",I.map(u=>u.asin)),a(`🌐 Opening ${w.length} Amazon tabs...`,"info");try{const u=await chrome.runtime.sendMessage({type:"CHECK_AMAZON_BATCH",payload:{items:I},timestamp:Date.now()});if(console.log("[Sync] Response from background:",u),u!=null&&u.results){F(`Processing ${u.results.length} results...`);for(let h=0;h<u.results.length;h++){const B=w[h],U=u.results[h];console.log(`[Sync] Result for ${B.asin}:`,U),await L(B,U)}}else console.error("[Sync] No results in response:",u),F("Error: No response from Amazon check")}catch(u){console.error("[Sync] Error checking Amazon:",u),F(`Error: ${u.message}`);for(const h of w)await L(h,{action:"ERROR"})}chrome.runtime.sendMessage({type:"SYNC_PROGRESS",payload:{pageNum:i.pageNum,checked:i.totalChecked,updated:i.totalUpdated,outOfStock:i.totalOutOfStock,flagged:i.totalFlagged,noChange:i.totalNoChange},timestamp:Date.now()}),await f(3e3)}const o=new URL(window.location.href),l=parseInt(o.searchParams.get("offset")||"0"),d=r.length;parseInt(o.searchParams.get("limit")||d.toString());const s=l+d,g=document.querySelector('button[aria-label="Go to next page"]')||document.querySelector(".pagination__next:not([disabled])")||document.querySelector('a[rel="next"]'),p=(((t=document.querySelector(".pagination-results, .shui-pagination-status"))==null?void 0:t.textContent)||"").match(/of\s+([\d,]+)/i),x=p?parseInt(p[1].replace(",","")):0;if(!(g!==null||x>0&&l+d<x)){console.log("[Sync] Last page reached - no more pages to process"),a("📄 Last page - no Next button found","info");break}console.log(`[Sync] Going to next page: offset ${l} → ${s}`),a(`📄 Going to page ${i.pageNum+1}...`,"info"),i.pageNum++,await G(),o.searchParams.set("offset",s.toString()),window.location.href=o.toString();return}C=!1,a(`✅ COMPLETE! Checked: ${i.totalChecked}, OOS: ${i.totalOutOfStock}`,"success"),console.log("[Sync] Complete!",i);const n=`${Math.round((Date.now()-A)/1e3)}s`;await O.syncComplete({checked:i.totalChecked,updated:i.totalUpdated,outOfStock:i.totalOutOfStock,flagged:i.totalFlagged,errors:q,duration:n}),chrome.runtime.sendMessage({type:"SYNC_COMPLETE",payload:{totalPages:i.pageNum,totalChecked:i.totalChecked,totalUpdated:i.totalUpdated,totalOutOfStock:i.totalOutOfStock,totalFlagged:i.totalFlagged,totalNoChange:i.totalNoChange},timestamp:Date.now()})}function X(){const e=document.getElementById("syndrax-control-panel");e&&e.remove();const n=document.createElement("div");n.id="syndrax-control-panel",n.innerHTML=`
    <div style="
      position: fixed;
      top: 10px;
      right: 10px;
      width: 280px;
      background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3e 100%);
      border: 1px solid #00CFFF;
      border-radius: 10px;
      padding: 14px;
      z-index: 999999;
      font-family: Inter, system-ui, sans-serif;
      box-shadow: 0 4px 30px rgba(0,207,255,0.3);
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      ">
        <span style="
          color: #00CFFF;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          ⚡ Syndrax Sync
        </span>
        <button id="syndrax-minimize" style="
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 16px;
        ">−</button>
      </div>
      
      <div id="syndrax-content">
        <div id="syndrax-stats" style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-bottom: 12px;
        ">
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-checked" style="font-size: 18px; font-weight: 700; color: #00CFFF;">0</div>
            <div style="font-size: 9px; color: #888;">Checked</div>
          </div>
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-updated" style="font-size: 18px; font-weight: 700; color: #22c55e;">0</div>
            <div style="font-size: 9px; color: #888;">Updated</div>
          </div>
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <div id="stat-oos" style="font-size: 18px; font-weight: 700; color: #ef4444;">0</div>
            <div style="font-size: 9px; color: #888;">OOS</div>
          </div>
        </div>
        
        <div id="syndrax-status" style="
          font-size: 11px;
          color: #888;
          margin-bottom: 12px;
          min-height: 20px;
        ">Ready to sync</div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-direction: column;">
          <div id="syndrax-progress-container" style="
            width: 100%;
            height: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
            overflow: hidden;
          ">
            <div id="syndrax-progress-bar" style="
              height: 100%;
              width: 0%;
              background: linear-gradient(90deg, #00CFFF 0%, #7A5CFF 50%, #FF00D4 100%);
              border-radius: 4px;
              transition: width 0.3s ease;
              animation: progressPulse 1.5s ease-in-out infinite;
            "></div>
          </div>
          <style>
            @keyframes progressPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          </style>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div id="syndrax-loading-text" style="
              flex: 1;
              color: #00CFFF;
              font-size: 12px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              <span class="syndrax-spinner" style="
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(0,207,255,0.3);
                border-top-color: #00CFFF;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              "></span>
              <style>
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              </style>
              <span id="syndrax-loading-msg">Starting...</span>
            </div>
            <button id="syndrax-stop" style="
              background: #FF3D3D;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 12px;
              font-family: Inter, system-ui, sans-serif;
            ">
              ⏹ Stop
            </button>
          </div>
        </div>
        
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        ">
          <span style="font-size: 10px; color: #888; font-weight: 600;">📋 Live Log:</span>
          <button id="syndrax-copy" style="
            background: rgba(0,207,255,0.1);
            border: 1px solid #00CFFF;
            color: #00CFFF;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9px;
            cursor: pointer;
            font-family: Inter, system-ui, sans-serif;
          ">📋 Copy</button>
        </div>
        <div id="syndrax-log" style="
          background: #000;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          max-height: 200px;
          overflow-y: auto;
          font-family: 'Consolas', monospace;
          font-size: 10px;
          color: #00CFFF;
        ">
          <div style="color: #888;">[Ready] Waiting for sync to start...</div>
        </div>
      </div>
    </div>
  `,document.body.appendChild(n);const t=document.getElementById("syndrax-run"),r=document.getElementById("syndrax-stop"),o=document.getElementById("syndrax-minimize"),l=document.getElementById("syndrax-content");t==null||t.addEventListener("click",async()=>{if(C)return;E=!1,t.textContent="⏳ Running...",t.style.display="none",r.style.display="block",R(),await T();const s=document.getElementById("syndrax-big-stats");s&&s.remove(),r.style.display="none",t.style.display="block",t.textContent="✓ Complete",E=!1,setTimeout(()=>{t.textContent="▶ Run Sync"},3e3)}),r==null||r.addEventListener("click",()=>{E=!0,r.textContent="⏹ Stopping...",a("⏹️ Stop requested...","warn")}),o==null||o.addEventListener("click",()=>{if(l){const s=l.style.display==="none";l.style.display=s?"block":"none",o.textContent=s?"−":"+"}});const d=document.getElementById("syndrax-copy");d==null||d.addEventListener("click",()=>{const s=document.getElementById("syndrax-log");if(s){const g=s.innerText;navigator.clipboard.writeText(g).then(()=>{d.textContent="✓ Copied!",setTimeout(()=>{d.textContent="📋 Copy"},2e3)}).catch(()=>{const m=document.createElement("textarea");m.value=g,document.body.appendChild(m),m.select(),document.execCommand("copy"),document.body.removeChild(m),d.textContent="✓ Copied!",setTimeout(()=>{d.textContent="📋 Copy"},2e3)})}})}function R(){const e=document.getElementById("syndrax-big-stats");e&&e.remove();const n=document.createElement("div");n.id="syndrax-big-stats",n.innerHTML=`
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 15, 30, 0.85);
      border: 2px solid #00CFFF;
      border-radius: 16px;
      padding: 16px 32px;
      z-index: 999998;
      font-family: Inter, system-ui, sans-serif;
      display: flex;
      gap: 32px;
      align-items: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 40px rgba(0,207,255,0.4);
    ">
      <div style="text-align: center;">
        <div id="big-page" style="font-size: 28px; font-weight: 800; color: #7A5CFF;">1</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Page</div>
      </div>
      <div style="width: 1px; height: 40px; background: #333;"></div>
      <div style="text-align: center;">
        <div id="big-checked" style="font-size: 36px; font-weight: 800; color: #00CFFF;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Checked</div>
      </div>
      <div style="text-align: center;">
        <div id="big-updated" style="font-size: 36px; font-weight: 800; color: #22c55e;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Updated</div>
      </div>
      <div style="text-align: center;">
        <div id="big-oos" style="font-size: 36px; font-weight: 800; color: #ef4444;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">OOS</div>
      </div>
      <div style="text-align: center;">
        <div id="big-restocked" style="font-size: 36px; font-weight: 800; color: #00FF88;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">Restocked</div>
      </div>
      <div style="text-align: center;">
        <div id="big-ok" style="font-size: 36px; font-weight: 800; color: #888;">0</div>
        <div style="font-size: 11px; color: #888; text-transform: uppercase;">OK</div>
      </div>
    </div>
  `,document.body.appendChild(n)}function $(){const e=document.getElementById("stat-checked"),n=document.getElementById("stat-updated"),t=document.getElementById("stat-oos"),r=document.getElementById("syndrax-status");e&&(e.textContent=i.totalChecked.toString()),n&&(n.textContent=i.totalUpdated.toString()),t&&(t.textContent=i.totalOutOfStock.toString()),r&&C&&(r.textContent=`Page ${i.pageNum} | ${i.totalFlagged} flagged | ${i.totalNoChange} unchanged`);const o=document.getElementById("big-page"),l=document.getElementById("big-checked"),d=document.getElementById("big-updated"),s=document.getElementById("big-oos"),g=document.getElementById("big-restocked"),m=document.getElementById("big-ok");o&&(o.textContent=i.pageNum.toString()),l&&(l.textContent=i.totalChecked.toString()),d&&(d.textContent=i.totalUpdated.toString()),s&&(s.textContent=i.totalOutOfStock.toString()),g&&(g.textContent=i.totalRestocked.toString()),m&&(m.textContent=i.totalNoChange.toString())}chrome.runtime.onMessage.addListener(e=>{e.type==="SYNC_PROGRESS"&&$()});function J(){const e=document.getElementById("syndrax-control-panel");if(e){let n=document.getElementById("syndrax-error-badge");if(!n){n=document.createElement("div"),n.id="syndrax-error-badge",n.style.cssText=`
        position: absolute;
        top: -8px;
        left: -8px;
        background: #FF3D3D;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(255,61,61,0.5);
        z-index: 9999999;
        animation: pulse 1s infinite;
      `,n.textContent="⚠️";const t=document.createElement("style");t.textContent=`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `,document.head.appendChild(t);const r=e.querySelector("div");r&&(r.style.position="relative",r.appendChild(n))}}}async function P(e){console.log("[Syndrax Sync] 🚨 EMERGENCY RESUME - Normal resume failed, auto-clicking Run button"),J(),a("🚨 Resume failed! Emergency auto-start...","error"),i.pageNum=e.pageNum,i.totalChecked=e.totalChecked,i.totalUpdated=e.totalUpdated,i.totalOutOfStock=e.totalOutOfStock,i.totalFlagged=e.totalFlagged,i.totalNoChange=e.totalNoChange,i.totalRestocked=e.totalRestocked||0,$(),await N(1e4);const n=document.getElementById("syndrax-run");n?(console.log("[Syndrax Sync] Clicking Run button as fallback"),n.click()):a("❌ Could not find Run button!","error")}async function K(){const e=window.location.href;if(console.log("[Syndrax Sync] Checking URL:",e),!(e.includes("ebay.com/sh/lst")||e.includes("ebay.com/mys/active")||e.includes("ebay.com/sh/lst/active")||e.includes("ebay.com/sh/lst?")||e.includes("/sh/lst"))){console.log("[Syndrax Sync] Not a listings page, skipping");return}console.log("[Syndrax Sync] eBay Active Listings page detected!"),X(),console.log("[Syndrax Sync] Checking for saved state...");let t=null;try{t=await Q(),console.log("[Syndrax Sync] Loaded state:",t)}catch(l){console.error("[Syndrax Sync] Error loading state:",l),a(`❌ Error loading state: ${l}`,"error")}if(!t||!t.isRunning){console.log("[Syndrax Sync] No running state - auto-starting fresh sync..."),a("🚀 Auto-starting sync...","success"),a("⏳ Waiting for table...","info");const l=await N(15e3);if(l.length===0){a("⚠️ No table found after 15s","warn");return}a(`✅ Found ${l.length} items, starting...`,"success"),R(),await T();const d=document.getElementById("syndrax-big-stats");d&&d.remove(),a("✅ Sync complete!","success");const s=document.getElementById("syndrax-loading-msg");s&&(s.textContent="Complete!");return}const r=Date.now()-t.startTime;if(console.log("[Syndrax Sync] Time since save:",r,"ms"),r>=5*60*1e3){console.log("[Syndrax Sync] Saved state too old, clearing"),await z();return}console.log("[Syndrax Sync] Attempting to resume from saved state:",t);const o=setTimeout(()=>{console.error("[Syndrax Sync] ⚠️ Resume timeout! Triggering emergency fallback"),P(t)},3e4);try{i.pageNum=t.pageNum,i.totalChecked=t.totalChecked,i.totalUpdated=t.totalUpdated,i.totalOutOfStock=t.totalOutOfStock,i.totalFlagged=t.totalFlagged,i.totalNoChange=t.totalNoChange,i.totalRestocked=t.totalRestocked||0;const l=document.getElementById("syndrax-log");if(l&&t.logMessages&&t.logMessages.length>0){l.innerHTML="";for(const m of t.logMessages){const p=document.createElement("div");p.style.cssText="font-size: 10px; color: #888; margin-bottom: 2px;",p.textContent=m,l.appendChild(p)}}$(),a(`📄 Resumed on page ${i.pageNum}`,"success"),R(),a("⏳ Waiting for table to load...","info");const d=await N(15e3);if(d.length===0){a("⚠️ Table not loaded after 15s, trying emergency...","warn"),clearTimeout(o),await P(t);return}a(`✅ Found ${d.length} rows, continuing sync...`,"success");const s=document.getElementById("syndrax-run"),g=document.getElementById("syndrax-stop");s&&(s.style.display="none"),g&&(g.style.display="block"),clearTimeout(o),await T(),g&&(g.style.display="none"),s&&(s.style.display="block",s.textContent="✓ Complete",setTimeout(()=>{s.textContent="▶ Run Sync"},3e3)),await z()}catch(l){console.error("[Syndrax Sync] Error in resume:",l),a(`❌ Resume error: ${l}`,"error"),clearTimeout(o),await P(t)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",K):K();
})()
