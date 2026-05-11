(function(){const G={logs:"https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m",errors:"https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",priceUpdates:"https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY",outOfStock:"https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS"};function $(){return new Date().toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0,timeZone:"America/Los_Angeles"})}async function x(e,n){try{await fetch(G[e],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[n]})})}catch(t){console.error("Discord webhook failed:",t)}}const O={syncStarted:e=>x("logs",{title:"⚡ SYNC STARTED",description:[`🕐 **Time:** ${$()}`,`📦 **Listings to Check:** ${e}`,"","Starting price & stock check on eBay Active Listings...","","> Amazon tabs will open in background","> Each item checked against live Amazon data","> Price updates applied with 2x markup rule"].join(`
`),color:53247,timestamp:new Date().toISOString(),footer:{text:"🔄 Checking prices on Amazon..."}}),syncComplete:e=>{const n=e.errors===0?"✅ Healthy":e.errors<3?"⚠️ Minor Issues":"❌ Issues Found",t=e.checked>0?((e.checked-e.errors)/e.checked*100).toFixed(1):"100";return x("logs",{title:"✅ SYNC COMPLETE",description:[`🕐 **Finished:** ${$()}`,`⏱️ **Duration:** ${e.duration}`,`📊 **Success Rate:** ${t}%`,`🏥 **Health:** ${n}`,"","**📋 Summary:**"].join(`
`),color:e.errors===0?65416:16766720,fields:[{name:"📦 Checked",value:`**${e.checked}**
items scanned`,inline:!0},{name:"💰 Updated",value:`**${e.updated}**
prices changed`,inline:!0},{name:"🔴 Out of Stock",value:`**${e.outOfStock}**
set to qty 0`,inline:!0},{name:"⚠️ Flagged",value:`**${e.flagged}**
needs review`,inline:!0},{name:"❌ Errors",value:`**${e.errors}**
failed items`,inline:!0},{name:"✅ All Good",value:`**${e.checked-e.updated-e.outOfStock-e.flagged-e.errors}**
no changes`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"✨ Next sync will skip already-scanned items today"}})},priceUpdated:e=>{const n=Math.abs(e.newPrice-e.oldPrice).toFixed(2),t=(Math.abs(e.newPrice-e.oldPrice)/e.oldPrice*100).toFixed(1),a=(e.newPrice-e.amazonPrice).toFixed(2),o=((e.newPrice-e.amazonPrice)/e.newPrice*100).toFixed(1);return x("priceUpdates",{title:e.direction==="up"?"📈 PRICE INCREASED":"📉 PRICE DECREASED",description:[`**${e.title.substring(0,80)}**`,"",e.direction==="up"?`🔺 Price went UP by $${n} (${t}%)`:`🔻 Price went DOWN by $${n} (${t}%)`,"",`**💵 Profit per Sale:** $${a}`,`**📊 Margin:** ${o}%`].join(`
`),color:e.direction==="up"?16766720:65416,fields:[{name:"📦 Amazon Cost",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0},{name:"🏷️ Was",value:`~~$${e.oldPrice.toFixed(2)}~~`,inline:!0},{name:"✅ Now",value:`**$${e.newPrice.toFixed(2)}**`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Listing ID: ${e.listingId}`}})},outOfStock:e=>x("outOfStock",{title:"🚫 OUT OF STOCK — Set to Qty 0",description:[`**${e.title.substring(0,80)}**`,"","⚠️ **Amazon source is out of stock!**","✅ eBay listing quantity set to 0 to prevent sales","","> When Amazon restocks, next sync will set qty back to 1"].join(`
`),color:16727357,fields:[{name:"💰 Last Price",value:e.amazonPrice>0?`$${e.amazonPrice.toFixed(2)}`:"N/A",inline:!0},{name:"🔗 eBay",value:`[View Listing](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"🔗 Amazon",value:`[Check Source](${e.amazonUrl})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"⏳ Will auto-restock when Amazon has inventory"}}),restocked:e=>x("logs",{title:"💚 RESTOCKED — Back in Stock!",description:[`**${e.title.substring(0,80)}**`,"","✅ **Amazon is back in stock!**","✅ eBay listing quantity set to 1","","This item was previously out of stock and is now available again."].join(`
`),color:65416,fields:[{name:"📦 Amazon Price",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0},{name:"🏷️ eBay Price",value:`$${e.ebayPrice.toFixed(2)}`,inline:!0},{name:"💵 Profit",value:`$${(e.ebayPrice-e.amazonPrice).toFixed(2)}`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Listing ID: ${e.listingId}`}}),wrongItem:e=>x("errors",{title:"⚠️ WRONG ITEM — Manual Review Needed",description:["The eBay listing doesn't seem to match the Amazon product.","","**📦 eBay Title:**",`> ${e.title.substring(0,100)}`,"","**🔗 Amazon Title:**",`> ${e.amazonTitle.substring(0,100)}`,"",`⚠️ **Match Score:** Only ${(e.similarity*100).toFixed(0)}% similar`].join(`
`),color:16747520,fields:[{name:"🔖 ASIN",value:e.asin,inline:!0},{name:"🔗 eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"🔗 Amazon",value:`[View](https://amazon.com/dp/${e.asin})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"👆 Please verify the correct Amazon ASIN is in the SKU"}}),error:e=>x("errors",{title:"🔴 SYNC ERROR",description:[`**${e.title.substring(0,80)}**`,"",`❌ **Error:** ${e.error.substring(0,200)}`,"","This item could not be processed. May need manual check."].join(`
`),color:16711680,fields:[{name:"🔖 ASIN",value:e.asin||"Unknown",inline:!0},{name:"📋 Listing ID",value:e.listingId,inline:!0},{name:"🔗 eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"🔧 Check Amazon page manually"}}),progress:(e,n,t,a,o)=>{if(e%25!==0&&e!==n)return;const r=Math.round(e/n*100),c=e>0?Math.round((n-e)*3/60):0;return x("logs",{title:`🔄 SYNC PROGRESS — ${r}%`,description:[`📄 **Page ${o}** | Checked **${e}** of **${n}** items`,"",`${"█".repeat(Math.floor(r/5))}${"░".repeat(20-Math.floor(r/5))} ${r}%`,"",c>0?`⏳ Est. ${c} min remaining`:"🏁 Almost done!"].join(`
`),color:8019199,fields:[{name:"💰 Updated",value:String(t),inline:!0},{name:"🔴 OOS",value:String(a),inline:!0},{name:"✅ OK",value:String(e-t-a),inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Page ${o} | ${$()}`}})},pageComplete:(e,n)=>x("logs",{title:`📄 PAGE ${e} COMPLETE`,description:[`Finished scanning page ${e}`,"","**This Page:**",`• Checked: ${n.pageChecked} items`,`• Updated: ${n.pageUpdated} prices`,`• Out of Stock: ${n.pageOOS}`,"",`**Total Progress:** ${n.totalChecked} items across ${e} pages`].join(`
`),color:8019199,timestamp:new Date().toISOString(),footer:{text:`Moving to page ${e+1}...`}}),dryRunComplete:e=>x("logs",{title:"🧪 DRY RUN COMPLETE — No Changes Made",description:["This was a test run. **No actual changes** were made to your listings.","","**📋 What a LIVE sync would do:**"].join(`
`),color:8019199,fields:[{name:"💰 Update Prices",value:`${e.wouldUpdate} items`,inline:!0},{name:"🔴 Mark OOS",value:`${e.wouldMarkOutOfStock} items`,inline:!0},{name:"⚠️ Flag Wrong",value:`${e.wouldFlag} items`,inline:!0},{name:"❌ Errors",value:`${e.wouldError} items`,inline:!0},{name:"📦 Total Scanned",value:`${e.total} items`,inline:!0},{name:"✅ No Changes",value:`${e.total-e.wouldUpdate-e.wouldMarkOutOfStock-e.wouldFlag-e.wouldError}`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"🔄 Run a live sync to apply these changes"}}),noAsin:e=>x("errors",{title:"⚪ NO ASIN FOUND — Skipped",description:[`**${e.title.substring(0,80)}**`,"","⚠️ Could not find a valid Amazon ASIN in the SKU field.","",`**Raw SKU Value:** \`${e.rawSku||"Empty"}\``,"","> To fix: Edit listing and set SKU to base64-encoded ASIN","> Example: B08XYZ1234 → encode to QjA4WFlaWjEyMzQ="].join(`
`),color:4473924,fields:[{name:"📋 Listing ID",value:e.listingId,inline:!0},{name:"🔗 Edit Listing",value:`[Open](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"💡 Set SKU = base64(ASIN) to enable auto-sync"}}),dailyReset:()=>x("logs",{title:"🌅 NEW DAY — Memory Reset",description:[`**${$()}**`,"","📆 Starting fresh for today!","• Daily scan memory cleared","• All items will be re-checked","• Stats reset to zero","","> Yesterday's scans are archived"].join(`
`),color:16766720,timestamp:new Date().toISOString(),footer:{text:"🔄 Run sync to check all listings"}})};let D=0,z=0,M=0;const i={pageNum:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalNoChange:0,totalRestocked:0};let k=!1,C=!1,_=[];async function Y(){const e=document.getElementById("syndrax-log");e&&(_=Array.from(e.children).slice(-30).map(t=>t.textContent||""));const n={isRunning:!0,pageNum:i.pageNum,totalChecked:i.totalChecked,totalUpdated:i.totalUpdated,totalOutOfStock:i.totalOutOfStock,totalFlagged:i.totalFlagged,totalNoChange:i.totalNoChange,totalRestocked:i.totalRestocked,startTime:Date.now(),logMessages:_};await chrome.storage.local.set({syncState:n}),console.log("[Sync] Saved state before navigation:",n)}async function H(){return(await chrome.storage.local.get("syncState")).syncState||null}async function L(){await chrome.storage.local.remove("syncState")}function f(e){return new Promise(n=>setTimeout(n,e))}async function R(e=15e3){const n=Date.now();for(;Date.now()-n<e;){const t=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(t.length>0)return console.log(`[Sync] Found ${t.length} rows after ${Date.now()-n}ms`),t;await f(500)}return console.log("[Sync] Timeout waiting for rows"),[]}function s(e,n="info"){const t=document.getElementById("syndrax-log");if(t){const a={info:"#00CFFF",success:"#22c55e",error:"#ef4444",warn:"#FFD700"},o=new Date().toLocaleTimeString(),r=document.createElement("div");for(r.style.cssText=`
      font-size: 10px;
      color: ${a[n]};
      margin-bottom: 2px;
      word-break: break-all;
    `,r.textContent=`[${o}] ${e}`,t.appendChild(r),t.scrollTop=t.scrollHeight;t.children.length>50;)t.removeChild(t.firstChild)}console.log(`[Sync ${n}]`,e)}function F(e){const n=document.getElementById("syndrax-status");n&&(n.textContent=e,n.style.color="#00CFFF");const t=document.getElementById("syndrax-loading-msg");t&&(t.textContent=e),s(e,"info")}function Q(e){if(!e)return"";try{const t=atob(e.trim());if(/^[A-Z0-9]{10}$/i.test(t))return t.toUpperCase()}catch{}if(/^[A-Z0-9]{10}$/i.test(e.trim()))return e.trim().toUpperCase();const n=e.match(/[A-Z0-9]{10}/i);return n?n[0].toUpperCase():""}function V(e){var b,y;const n=e.getAttribute("data-id")||"";if(!n)return null;const t=e.querySelector(".shui-dt-column__title a")||e.querySelector(".column-title__text a")||e.querySelector('[data-test-id="item-title"]'),a=((b=t==null?void 0:t.textContent)==null?void 0:b.trim())||"",o=e.querySelector(".shui-dt-column__price")||e.querySelector(".col-price__current"),c=((o==null?void 0:o.textContent)||"").match(/\$([0-9,]+\.?[0-9]*)/),l=c?parseFloat(c[1].replace(",","")):0,g=e.querySelector(".shui-dt-column__listingSKU")||e.querySelector('[data-test-id="listing-sku"]'),m=((y=g==null?void 0:g.textContent)==null?void 0:y.trim())||"",p=Q(m);return console.log(`[Sync] Row ${n}: "${a.substring(0,30)}..." Price: $${l} SKU: ${m} ASIN: ${p}`),{listingId:n,title:a,price:l,rawSku:m,asin:p,row:e}}function Z(e){var a;const n=e.querySelector('input[name*="availableQuantity"]');if(n)return parseInt(n.value)||0;const t=e.querySelector(".shui-dt-column__availableQuantity");if(t){const r=(((a=t.textContent)==null?void 0:a.trim())||"").match(/\d+/);if(r)return parseInt(r[0])||0}return 1}async function X(e,n){var p,b;const t=e,a=t.querySelector('button[aria-label="Edit Current price"]')||t.querySelector('button[column="price"]');if(!a)return console.log("[Sync Debug] Edit price button not found"),s("  ❌ Edit price button not found","error"),!1;s("  📝 Clicking Edit Price...","info"),a.click(),await f(1200);let o=null;const r=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');console.log("[Sync Debug] Found price dialogs:",r.length);for(const y of r){const d=y.querySelector('input[name*="price"]')||y.querySelector('input[aria-label*="price" i]')||y.querySelector("input.textbox__control");if(d){o=d,console.log("[Sync Debug] Found price input:",d.name||d.className);break}}if(o||(o=document.querySelector('input[name*="price"]')||document.querySelector("input.textbox__control")),!o)return s("  ❌ Price input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const c=n.toFixed(2);if(s(`  ✏️ Setting price to $${c}...`,"info"),o.focus(),await f(100),o.select(),await f(100),o.setSelectionRange(0,o.value.length),document.execCommand("insertText",!1,c),await f(100),o.value!==c){const y=(p=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:p.set;y&&y.call(o,c),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}o.value!==c&&(o.value=c,o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))),console.log("[Sync Debug] Price input value after setting:",o.value),await f(300),s("  💾 Submitting price...","info");let l=null;const g=document.querySelectorAll("button");for(const y of g)if((((b=y.textContent)==null?void 0:b.trim().toLowerCase())||"")==="submit"){l=y,console.log("[Sync Debug] Found price Submit button with text:",y.className);break}if(l||(l=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),l){console.log("[Sync Debug] Clicking price Submit button");const y=l.closest("form");y&&y.addEventListener("submit",d=>{d.preventDefault()},{once:!0}),l.focus(),await f(100),l.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window}))}else return console.log("[Sync Debug] Price Submit button not found"),s("  ⚠️ Could not find Submit button for price","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await f(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(s("  ⚠️ Price dialog still open","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(s(`  ✅ Price updated to $${c}!`,"success"),!0)}async function q(e,n){var p,b,y;const t=e,a=t.querySelector('button[aria-label="Edit Available quantity"]');if(!a)return t.querySelector('[data-test-id="variation-count"]')||((p=t.textContent)==null?void 0:p.includes("variation"))?(s("  ⚠️ Has variations - skip inline edit","warn"),!1):(s("  ❌ Edit button not found","error"),!1);if(a.disabled||a.getAttribute("aria-disabled")==="true")return s("  ⚠️ Edit disabled - item may be locked","warn"),!1;s("  📝 Clicking Edit...","info"),a.click(),await f(1200);let o=null;const r=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"], [class*="modal"]');console.log("[Sync Debug] Found dialogs:",r.length);for(const d of r){const S=d.querySelector('input[type="text"], input.textbox__control, input');if(S){o=S,console.log("[Sync Debug] Found input in dialog:",S.className);break}}if(o||(o=document.querySelector("input.textbox__control:focus")||document.querySelector('input[aria-label*="quantity" i]')||document.querySelector("input.textbox__control")),!o)return s("  ❌ Input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;if(s(`  ✏️ Setting to ${n}...`,"info"),o.focus(),await f(100),o.select(),o.setSelectionRange(0,o.value.length),await f(100),document.execCommand("insertText",!1,n.toString()),await f(100),o.value!==n.toString()){const d=(b=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:b.set;d&&d.call(o,n.toString()),o.dispatchEvent(new Event("input",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new Event("change",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:n.toString(),inputType:"insertText"}))}if(await f(100),o.value!==n.toString()){o.focus(),o.select();for(let S=0;S<5;S++)o.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keyup",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0}));const d=n.toString();o.dispatchEvent(new KeyboardEvent("keydown",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keypress",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:d,inputType:"insertText"})),o.dispatchEvent(new KeyboardEvent("keyup",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.value=n.toString(),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}console.log("[Sync Debug] Input value after setting:",o.value),await f(300),s("  💾 Finding Submit button...","info");const c=document.querySelectorAll('.lightbox-dialog, [role="dialog"], .quick-edit-modal');console.log("[Sync Debug] Open dialogs:",c.length);let l=null;const g=document.querySelectorAll("button");for(const d of g)if((((y=d.textContent)==null?void 0:y.trim().toLowerCase())||"")==="submit"){l=d,console.log('[Sync Debug] Found button with text "Submit":',d.className);break}if(l||(l=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),l){console.log("[Sync Debug] Clicking Submit button:",l.outerHTML.substring(0,100));const d=l.closest("form");d&&d.addEventListener("submit",S=>{S.preventDefault()},{once:!0}),l.focus(),await f(100),l.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window})),console.log("[Sync Debug] Clicked Submit button")}else return console.log("[Sync Debug] Submit button not found"),s("  ⚠️ Could not find Submit button","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await f(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(s("  ⚠️ Dialog still open - may need manual submit","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(s("  ✅ Updated!","success"),!0)}function w(e,n,t){const a=e,o=a.querySelector(".syndrax-badge");o&&o.remove();const r=document.createElement("span");r.className="syndrax-badge",r.textContent=n,r.style.cssText=`
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
  `,a.style.position="relative",a.appendChild(r)}async function K(e,n){var l,g,m;const t=e.row,a=Z(e.row),o=e.title.substring(0,25);t.style.outline="2px solid #00CFFF",t.style.background="rgba(0, 207, 255, 0.05)";const r=n.amazonPrice?`$${n.amazonPrice.toFixed(2)}`:"N/A",c=`$${e.price.toFixed(2)}`;switch(s(`${e.asin}: ${n.action}`,"info"),s(`  eBay: qty=${a} price=${c} | Amazon: ${r}`,"info"),n.action){case"WRONG_ITEM":i.totalFlagged++,t.style.outline="2px solid #FF8C00",t.style.background="rgba(255, 140, 0, 0.08)",w(t,`⚠ Wrong Item (${Math.round((n.similarity||0)*100)}%)`,"#FF8C00"),s(`⚠ ${o}... → Wrong item match`,"warn");break;case"OUT_OF_STOCK":if(a>0){s(`🔴 ${o}... → OOS! Needs qty 0`,"error");const p=await q(e.row,0);i.totalOutOfStock++,p?(i.totalUpdated++,s("✓ Quantity updated to 0","success"),await O.outOfStock({title:e.title,listingId:e.listingId,amazonUrl:`https://www.amazon.com/dp/${e.asin}`,amazonPrice:n.amazonPrice||0})):s("⚠ Manual update needed","warn"),t.style.outline="2px solid #FF3D3D",t.style.background="rgba(255, 61, 61, 0.08)",w(t,`✗ OOS (was ${a})`,"#FF3D3D")}else i.totalOutOfStock++,t.style.outline="2px solid #888",w(t,"✗ Already 0","#888"),s(`- ${o}... → Already 0`,"info");break;case"PRICE_UPDATED":case"NO_CHANGE":if(a===0)s(`💚 ${o}... → IN STOCK! Needs qty 1`,"success"),await q(e.row,1)?(i.totalUpdated++,i.totalRestocked++,s("✓ Restocked to 1","success")):s("⚠ Manual restock needed","warn"),t.style.outline="2px solid #00FF88",t.style.background="rgba(0, 255, 136, 0.08)",w(t,"↑ Restocked to 1","#00FF88");else if(n.action==="PRICE_UPDATED"&&n.newEbayPrice){const p=n.priceWentUp?"#FFD700":"#00FF88";t.style.outline=`2px solid ${p}`,t.style.background=n.priceWentUp?"rgba(255, 215, 0, 0.08)":"rgba(0, 255, 136, 0.08)",s(`💰 ${o}... → Price ${n.priceWentUp?"↑":"↓"} $${n.amazonPrice}→$${(l=n.newEbayPrice)==null?void 0:l.toFixed(2)}`,n.priceWentUp?"warn":"success"),await X(e.row,n.newEbayPrice)?(i.totalUpdated++,w(t,`${n.priceWentUp?"↑":"↓"} $${(g=n.newEbayPrice)==null?void 0:g.toFixed(2)} ✓`,p),s(`✓ Price updated to $${n.newEbayPrice.toFixed(2)}`,"success"),await O.priceUpdated({title:e.title,listingId:e.listingId,oldPrice:e.price,newPrice:n.newEbayPrice,amazonPrice:n.amazonPrice||0,direction:n.priceWentUp?"up":"down"})):(w(t,`${n.priceWentUp?"↑":"↓"} $${(m=n.newEbayPrice)==null?void 0:m.toFixed(2)} ⚠`,p),s("⚠ Manual price update needed","warn"))}else i.totalNoChange++,t.style.outline="2px solid #22c55e",t.style.background="rgba(34, 197, 94, 0.03)",w(t,"✓ OK","#22c55e"),s(`✓ ${o}... → OK ($${n.amazonPrice})`,"success"),setTimeout(()=>{t.style.outline="",t.style.background=""},2e3);break;case"ERROR":case"SOURCE_NOT_FOUND":i.totalFlagged++,t.style.outline="2px solid #888",w(t,"? Error","#888"),s(`? ${o}... → ${n.action}`,"error");break}i.totalChecked++,I()}async function T(){var t;if(k){s("⚠ Sync already running!","warn");return}if(k=!0,i.totalChecked>0)s(`🚀 Continuing sync on page ${i.pageNum}...`,"success");else{const a=document.getElementById("syndrax-log");a&&(a.innerHTML=""),s("🚀 Starting sync...","success"),i.pageNum=1,i.totalChecked=0,i.totalUpdated=0,i.totalOutOfStock=0,i.totalFlagged=0,i.totalNoChange=0,z=0,D=Date.now(),M=document.querySelectorAll("tr.grid-row[data-id]").length,await O.syncStarted(M)}for(chrome.runtime.sendMessage({type:"SYNC_STARTED",payload:{pageNum:i.pageNum},timestamp:Date.now()});!C;){console.log(`[Sync] Processing page ${i.pageNum}`),await f(1e3);const a=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(console.log(`[Sync] Found ${a.length} rows on page ${i.pageNum}`),a.length===0){console.log("[Sync] No rows found, stopping");break}for(let d=0;d<a.length;d+=3){if(C){s("⏹️ Sync stopped by user","warn");break}const S=a.slice(d,d+3),E=[];for(const u of S){const h=V(u);h&&E.push(h)}const v=E.filter(u=>u.asin);if(v.length===0){console.log(`[Sync] No valid ASINs in batch ${d/3+1}, skipping`),i.totalFlagged+=E.length,i.totalChecked+=E.length;for(const u of E)if(!u.asin){const h=u.row;h.style.outline="2px solid #888",w(h,"⚠ No ASIN","#888")}continue}console.log(`[Sync] Checking ${v.length} items with ASINs...`),F(`Checking batch ${Math.floor(d/3)+1}...`);const P=v.map(u=>({listingId:u.listingId,title:u.title,price:u.price,asin:u.asin,amazonUrl:`https://www.amazon.com/dp/${u.asin}`})),j=P.map(u=>u.asin).join(", ");s(`📦 Batch ASINs: ${j}`,"info"),console.log("[Sync] Sending to background:",P.map(u=>u.asin)),s(`🌐 Opening ${v.length} Amazon tabs...`,"info");try{const u=await chrome.runtime.sendMessage({type:"CHECK_AMAZON_BATCH",payload:{items:P},timestamp:Date.now()});if(console.log("[Sync] Response from background:",u),u!=null&&u.results){F(`Processing ${u.results.length} results...`);for(let h=0;h<u.results.length;h++){const U=v[h],B=u.results[h];console.log(`[Sync] Result for ${U.asin}:`,B),await K(U,B)}}else console.error("[Sync] No results in response:",u),F("Error: No response from Amazon check")}catch(u){console.error("[Sync] Error checking Amazon:",u),F(`Error: ${u.message}`);for(const h of v)await K(h,{action:"ERROR"})}chrome.runtime.sendMessage({type:"SYNC_PROGRESS",payload:{pageNum:i.pageNum,checked:i.totalChecked,updated:i.totalUpdated,outOfStock:i.totalOutOfStock,flagged:i.totalFlagged,noChange:i.totalNoChange},timestamp:Date.now()}),await f(3e3)}const o=new URL(window.location.href),r=parseInt(o.searchParams.get("offset")||"0"),c=a.length;parseInt(o.searchParams.get("limit")||c.toString());const l=r+c,g=document.querySelector('button[aria-label="Go to next page"]')||document.querySelector(".pagination__next:not([disabled])")||document.querySelector('a[rel="next"]'),p=(((t=document.querySelector(".pagination-results, .shui-pagination-status"))==null?void 0:t.textContent)||"").match(/of\s+([\d,]+)/i),b=p?parseInt(p[1].replace(",","")):0;if(!(g!==null||b>0&&r+c<b)){console.log("[Sync] Last page reached - no more pages to process"),s("📄 Last page - no Next button found","info");break}console.log(`[Sync] Going to next page: offset ${r} → ${l}`),s(`📄 Going to page ${i.pageNum+1}...`,"info"),i.pageNum++,await Y(),o.searchParams.set("offset",l.toString()),window.location.href=o.toString();return}k=!1,s(`✅ COMPLETE! Checked: ${i.totalChecked}, OOS: ${i.totalOutOfStock}`,"success"),console.log("[Sync] Complete!",i);const n=`${Math.round((Date.now()-D)/1e3)}s`;await O.syncComplete({checked:i.totalChecked,updated:i.totalUpdated,outOfStock:i.totalOutOfStock,flagged:i.totalFlagged,errors:z,duration:n}),chrome.runtime.sendMessage({type:"SYNC_COMPLETE",payload:{totalPages:i.pageNum,totalChecked:i.totalChecked,totalUpdated:i.totalUpdated,totalOutOfStock:i.totalOutOfStock,totalFlagged:i.totalFlagged,totalNoChange:i.totalNoChange},timestamp:Date.now()})}function J(){const e=document.getElementById("syndrax-control-panel");e&&e.remove();const n=document.createElement("div");n.id="syndrax-control-panel",n.innerHTML=`
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
  `,document.body.appendChild(n);const t=document.getElementById("syndrax-run"),a=document.getElementById("syndrax-stop"),o=document.getElementById("syndrax-minimize"),r=document.getElementById("syndrax-content");t==null||t.addEventListener("click",async()=>{if(k)return;C=!1,t.textContent="⏳ Running...",t.style.display="none",a.style.display="block",A(),await T();const l=document.getElementById("syndrax-big-stats");l&&l.remove(),a.style.display="none",t.style.display="block",t.textContent="✓ Complete",C=!1,setTimeout(()=>{t.textContent="▶ Run Sync"},3e3)}),a==null||a.addEventListener("click",()=>{C=!0,a.textContent="⏹ Stopping...",s("⏹️ Stop requested...","warn")}),o==null||o.addEventListener("click",()=>{if(r){const l=r.style.display==="none";r.style.display=l?"block":"none",o.textContent=l?"−":"+"}});const c=document.getElementById("syndrax-copy");c==null||c.addEventListener("click",()=>{const l=document.getElementById("syndrax-log");if(l){const g=l.innerText;navigator.clipboard.writeText(g).then(()=>{c.textContent="✓ Copied!",setTimeout(()=>{c.textContent="📋 Copy"},2e3)}).catch(()=>{const m=document.createElement("textarea");m.value=g,document.body.appendChild(m),m.select(),document.execCommand("copy"),document.body.removeChild(m),c.textContent="✓ Copied!",setTimeout(()=>{c.textContent="📋 Copy"},2e3)})}})}function A(){const e=document.getElementById("syndrax-big-stats");e&&e.remove();const n=document.createElement("div");n.id="syndrax-big-stats",n.innerHTML=`
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
  `,document.body.appendChild(n)}function I(){const e=document.getElementById("stat-checked"),n=document.getElementById("stat-updated"),t=document.getElementById("stat-oos"),a=document.getElementById("syndrax-status");e&&(e.textContent=i.totalChecked.toString()),n&&(n.textContent=i.totalUpdated.toString()),t&&(t.textContent=i.totalOutOfStock.toString()),a&&k&&(a.textContent=`Page ${i.pageNum} | ${i.totalFlagged} flagged | ${i.totalNoChange} unchanged`);const o=document.getElementById("big-page"),r=document.getElementById("big-checked"),c=document.getElementById("big-updated"),l=document.getElementById("big-oos"),g=document.getElementById("big-restocked"),m=document.getElementById("big-ok");o&&(o.textContent=i.pageNum.toString()),r&&(r.textContent=i.totalChecked.toString()),c&&(c.textContent=i.totalUpdated.toString()),l&&(l.textContent=i.totalOutOfStock.toString()),g&&(g.textContent=i.totalRestocked.toString()),m&&(m.textContent=i.totalNoChange.toString())}chrome.runtime.onMessage.addListener(e=>{e.type==="SYNC_PROGRESS"&&I()});function ee(){const e=document.getElementById("syndrax-control-panel");if(e){let n=document.getElementById("syndrax-error-badge");if(!n){n=document.createElement("div"),n.id="syndrax-error-badge",n.style.cssText=`
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
      `,document.head.appendChild(t);const a=e.querySelector("div");a&&(a.style.position="relative",a.appendChild(n))}}}async function N(e){console.log("[Syndrax Sync] 🚨 EMERGENCY RESUME - Normal resume failed, auto-clicking Run button"),ee(),s("🚨 Resume failed! Emergency auto-start...","error"),i.pageNum=e.pageNum,i.totalChecked=e.totalChecked,i.totalUpdated=e.totalUpdated,i.totalOutOfStock=e.totalOutOfStock,i.totalFlagged=e.totalFlagged,i.totalNoChange=e.totalNoChange,i.totalRestocked=e.totalRestocked||0,I(),await R(1e4);const n=document.getElementById("syndrax-run");n?(console.log("[Syndrax Sync] Clicking Run button as fallback"),n.click()):s("❌ Could not find Run button!","error")}function te(){window.addEventListener("beforeunload",t=>{if(k)return console.log("[Syndrax Sync] 🛑 Blocking navigation - sync in progress"),t.preventDefault(),t.returnValue="",""}),document.addEventListener("click",t=>{const o=t.target.closest("a");if(o&&o.href&&(o.href.includes("/n/all-categories")||o.href.includes("_nkw=")||o.href.includes("/sch/")&&!o.href.includes("/sh/")))return console.log("[Syndrax Sync] 🛑 Blocked bad navigation:",o.href),t.preventDefault(),t.stopPropagation(),!1},!0),document.addEventListener("submit",t=>{const a=t.target;if(a.action&&(a.action.includes("/n/all-categories")||a.action.includes("_nkw=")||a.action.includes("/sch/")))return console.log("[Syndrax Sync] 🛑 Blocked bad form submission:",a.action),t.preventDefault(),t.stopPropagation(),!1},!0);const e=window.location.assign;window.location.assign=function(t){if(t.includes("/n/all-categories")||t.includes("_nkw=")){console.log("[Syndrax Sync] 🛑 Blocked location.assign:",t);return}return e.call(window.location,t)};const n=Object.getOwnPropertyDescriptor(Location.prototype,"href");n&&n.set&&Object.defineProperty(window.location,"href",{set:function(t){if(t.includes("/n/all-categories")||t.includes("_nkw=")&&!t.includes("/sh/lst")){console.log("[Syndrax Sync] 🛑 Blocked location.href:",t);return}return n.set.call(window.location,t)},get:function(){return n.get.call(window.location)}})}async function W(){const e=window.location.href;if(console.log("[Syndrax Sync] Checking URL:",e),e.includes("/n/all-categories")||e.includes("_nkw=")&&!e.includes("/sh/lst")){console.log("[Syndrax Sync] 🚨 EMERGENCY: On bad page! Redirecting back to listings..."),window.location.href="https://www.ebay.com/sh/lst/active";return}if(!(e.includes("ebay.com/sh/lst")||e.includes("ebay.com/mys/active")||e.includes("ebay.com/sh/lst/active")||e.includes("ebay.com/sh/lst?")||e.includes("/sh/lst"))){console.log("[Syndrax Sync] Not a listings page, skipping");return}console.log("[Syndrax Sync] eBay Active Listings page detected!"),te(),J(),console.log("[Syndrax Sync] Checking for saved state...");let t=null;try{t=await H(),console.log("[Syndrax Sync] Loaded state:",t)}catch(r){console.error("[Syndrax Sync] Error loading state:",r),s(`❌ Error loading state: ${r}`,"error")}if(!t||!t.isRunning){console.log("[Syndrax Sync] No running state - auto-starting fresh sync..."),s("🚀 Auto-starting sync...","success"),s("⏳ Waiting for table...","info");const r=await R(15e3);if(r.length===0){s("⚠️ No table found after 15s","warn");return}s(`✅ Found ${r.length} items, starting...`,"success"),A(),await T();const c=document.getElementById("syndrax-big-stats");c&&c.remove(),s("✅ Sync complete!","success");const l=document.getElementById("syndrax-loading-msg");l&&(l.textContent="Complete!");return}const a=Date.now()-t.startTime;if(console.log("[Syndrax Sync] Time since save:",a,"ms"),a>=5*60*1e3){console.log("[Syndrax Sync] Saved state too old, clearing"),await L();return}console.log("[Syndrax Sync] Attempting to resume from saved state:",t);const o=setTimeout(()=>{console.error("[Syndrax Sync] ⚠️ Resume timeout! Triggering emergency fallback"),N(t)},3e4);try{i.pageNum=t.pageNum,i.totalChecked=t.totalChecked,i.totalUpdated=t.totalUpdated,i.totalOutOfStock=t.totalOutOfStock,i.totalFlagged=t.totalFlagged,i.totalNoChange=t.totalNoChange,i.totalRestocked=t.totalRestocked||0;const r=document.getElementById("syndrax-log");if(r&&t.logMessages&&t.logMessages.length>0){r.innerHTML="";for(const m of t.logMessages){const p=document.createElement("div");p.style.cssText="font-size: 10px; color: #888; margin-bottom: 2px;",p.textContent=m,r.appendChild(p)}}I(),s(`📄 Resumed on page ${i.pageNum}`,"success"),A(),s("⏳ Waiting for table to load...","info");const c=await R(15e3);if(c.length===0){s("⚠️ Table not loaded after 15s, trying emergency...","warn"),clearTimeout(o),await N(t);return}s(`✅ Found ${c.length} rows, continuing sync...`,"success");const l=document.getElementById("syndrax-run"),g=document.getElementById("syndrax-stop");l&&(l.style.display="none"),g&&(g.style.display="block"),clearTimeout(o),await T(),g&&(g.style.display="none"),l&&(l.style.display="block",l.textContent="✓ Complete",setTimeout(()=>{l.textContent="▶ Run Sync"},3e3)),await L()}catch(r){console.error("[Syndrax Sync] Error in resume:",r),s(`❌ Resume error: ${r}`,"error"),clearTimeout(o),await N(t)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",W):W();
})()
