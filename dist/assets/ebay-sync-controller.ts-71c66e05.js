(function(){const Z={logs:"https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m",errors:"https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",priceUpdates:"https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY",outOfStock:"https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS"};function O(){return new Date().toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0,timeZone:"America/Los_Angeles"})}async function x(e,t){try{await fetch(Z[e],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[t]})})}catch(n){console.error("Discord webhook failed:",n)}}const R={syncStarted:e=>x("logs",{title:"⚡ SYNC STARTED",description:[`🕐 **Time:** ${O()}`,`📦 **Listings to Check:** ${e}`,"","Starting price & stock check on eBay Active Listings...","","> Amazon tabs will open in background","> Each item checked against live Amazon data","> Price updates applied with 2x markup rule"].join(`
`),color:53247,timestamp:new Date().toISOString(),footer:{text:"🔄 Checking prices on Amazon..."}}),syncComplete:e=>{const t=e.errors===0?"✅ Healthy":e.errors<3?"⚠️ Minor Issues":"❌ Issues Found",n=e.checked>0?((e.checked-e.errors)/e.checked*100).toFixed(1):"100";return x("logs",{title:"✅ SYNC COMPLETE",description:[`🕐 **Finished:** ${O()}`,`⏱️ **Duration:** ${e.duration}`,`📊 **Success Rate:** ${n}%`,`🏥 **Health:** ${t}`,"","**📋 Summary:**"].join(`
`),color:e.errors===0?65416:16766720,fields:[{name:"📦 Checked",value:`**${e.checked}**
items scanned`,inline:!0},{name:"💰 Updated",value:`**${e.updated}**
prices changed`,inline:!0},{name:"🔴 Out of Stock",value:`**${e.outOfStock}**
set to qty 0`,inline:!0},{name:"⚠️ Flagged",value:`**${e.flagged}**
needs review`,inline:!0},{name:"❌ Errors",value:`**${e.errors}**
failed items`,inline:!0},{name:"✅ All Good",value:`**${e.checked-e.updated-e.outOfStock-e.flagged-e.errors}**
no changes`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"✨ Next sync will skip already-scanned items today"}})},priceUpdated:e=>{const t=Math.abs(e.newPrice-e.oldPrice).toFixed(2),n=(Math.abs(e.newPrice-e.oldPrice)/e.oldPrice*100).toFixed(1),i=(e.newPrice-e.amazonPrice).toFixed(2),o=((e.newPrice-e.amazonPrice)/e.newPrice*100).toFixed(1);return x("priceUpdates",{title:e.direction==="up"?"📈 PRICE INCREASED":"📉 PRICE DECREASED",description:[`**${e.title.substring(0,80)}**`,"",e.direction==="up"?`🔺 Price went UP by $${t} (${n}%)`:`🔻 Price went DOWN by $${t} (${n}%)`,"",`**💵 Profit per Sale:** $${i}`,`**📊 Margin:** ${o}%`].join(`
`),color:e.direction==="up"?16766720:65416,fields:[{name:"📦 Amazon Cost",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0},{name:"🏷️ Was",value:`~~$${e.oldPrice.toFixed(2)}~~`,inline:!0},{name:"✅ Now",value:`**$${e.newPrice.toFixed(2)}**`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Listing ID: ${e.listingId}`}})},outOfStock:e=>x("outOfStock",{title:"🚫 OUT OF STOCK — Set to Qty 0",description:[`**${e.title.substring(0,80)}**`,"","⚠️ **Amazon source is out of stock!**","✅ eBay listing quantity set to 0 to prevent sales","","> When Amazon restocks, next sync will set qty back to 1"].join(`
`),color:16727357,fields:[{name:"💰 Last Price",value:e.amazonPrice>0?`$${e.amazonPrice.toFixed(2)}`:"N/A",inline:!0},{name:"🔗 eBay",value:`[View Listing](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"🔗 Amazon",value:`[Check Source](${e.amazonUrl})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"⏳ Will auto-restock when Amazon has inventory"}}),restocked:e=>x("logs",{title:"💚 RESTOCKED — Back in Stock!",description:[`**${e.title.substring(0,80)}**`,"","✅ **Amazon is back in stock!**","✅ eBay listing quantity set to 1","","This item was previously out of stock and is now available again."].join(`
`),color:65416,fields:[{name:"📦 Amazon Price",value:`$${e.amazonPrice.toFixed(2)}`,inline:!0},{name:"🏷️ eBay Price",value:`$${e.ebayPrice.toFixed(2)}`,inline:!0},{name:"💵 Profit",value:`$${(e.ebayPrice-e.amazonPrice).toFixed(2)}`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Listing ID: ${e.listingId}`}}),wrongItem:e=>x("errors",{title:"⚠️ WRONG ITEM — Manual Review Needed",description:["The eBay listing doesn't seem to match the Amazon product.","","**📦 eBay Title:**",`> ${e.title.substring(0,100)}`,"","**🔗 Amazon Title:**",`> ${e.amazonTitle.substring(0,100)}`,"",`⚠️ **Match Score:** Only ${(e.similarity*100).toFixed(0)}% similar`].join(`
`),color:16747520,fields:[{name:"🔖 ASIN",value:e.asin,inline:!0},{name:"🔗 eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"🔗 Amazon",value:`[View](https://amazon.com/dp/${e.asin})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"👆 Please verify the correct Amazon ASIN is in the SKU"}}),error:e=>x("errors",{title:"🔴 SYNC ERROR",description:[`**${e.title.substring(0,80)}**`,"",`❌ **Error:** ${e.error.substring(0,200)}`,"","This item could not be processed. May need manual check."].join(`
`),color:16711680,fields:[{name:"🔖 ASIN",value:e.asin||"Unknown",inline:!0},{name:"📋 Listing ID",value:e.listingId,inline:!0},{name:"🔗 eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"🔧 Check Amazon page manually"}}),progress:(e,t,n,i,o)=>{if(e%25!==0&&e!==t)return;const l=Math.round(e/t*100),c=e>0?Math.round((t-e)*3/60):0;return x("logs",{title:`🔄 SYNC PROGRESS — ${l}%`,description:[`📄 **Page ${o}** | Checked **${e}** of **${t}** items`,"",`${"█".repeat(Math.floor(l/5))}${"░".repeat(20-Math.floor(l/5))} ${l}%`,"",c>0?`⏳ Est. ${c} min remaining`:"🏁 Almost done!"].join(`
`),color:8019199,fields:[{name:"💰 Updated",value:String(n),inline:!0},{name:"🔴 OOS",value:String(i),inline:!0},{name:"✅ OK",value:String(e-n-i),inline:!0}],timestamp:new Date().toISOString(),footer:{text:`Page ${o} | ${O()}`}})},pageComplete:(e,t)=>x("logs",{title:`📄 PAGE ${e} COMPLETE`,description:[`Finished scanning page ${e}`,"","**This Page:**",`• Checked: ${t.pageChecked} items`,`• Updated: ${t.pageUpdated} prices`,`• Out of Stock: ${t.pageOOS}`,"",`**Total Progress:** ${t.totalChecked} items across ${e} pages`].join(`
`),color:8019199,timestamp:new Date().toISOString(),footer:{text:`Moving to page ${e+1}...`}}),dryRunComplete:e=>x("logs",{title:"🧪 DRY RUN COMPLETE — No Changes Made",description:["This was a test run. **No actual changes** were made to your listings.","","**📋 What a LIVE sync would do:**"].join(`
`),color:8019199,fields:[{name:"💰 Update Prices",value:`${e.wouldUpdate} items`,inline:!0},{name:"🔴 Mark OOS",value:`${e.wouldMarkOutOfStock} items`,inline:!0},{name:"⚠️ Flag Wrong",value:`${e.wouldFlag} items`,inline:!0},{name:"❌ Errors",value:`${e.wouldError} items`,inline:!0},{name:"📦 Total Scanned",value:`${e.total} items`,inline:!0},{name:"✅ No Changes",value:`${e.total-e.wouldUpdate-e.wouldMarkOutOfStock-e.wouldFlag-e.wouldError}`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"🔄 Run a live sync to apply these changes"}}),noAsin:e=>x("errors",{title:"⚪ NO ASIN FOUND — Skipped",description:[`**${e.title.substring(0,80)}**`,"","⚠️ Could not find a valid Amazon ASIN in the SKU field.","",`**Raw SKU Value:** \`${e.rawSku||"Empty"}\``,"","> To fix: Edit listing and set SKU to base64-encoded ASIN","> Example: B08XYZ1234 → encode to QjA4WFlaWjEyMzQ="].join(`
`),color:4473924,fields:[{name:"📋 Listing ID",value:e.listingId,inline:!0},{name:"🔗 Edit Listing",value:`[Open](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"💡 Set SKU = base64(ASIN) to enable auto-sync"}}),dailyReset:()=>x("logs",{title:"🌅 NEW DAY — Memory Reset",description:[`**${O()}**`,"","📆 Starting fresh for today!","• Daily scan memory cleared","• All items will be re-checked","• Stats reset to zero","","> Yesterday's scans are archived"].join(`
`),color:16766720,timestamp:new Date().toISOString(),footer:{text:"🔄 Run sync to check all listings"}})},P="syndrax_fingerprints",S={ASIN_REDIRECT:100,BRAND_CHANGED:90,DIMENSIONS_CHANGED:85,IMAGE_HASH_CHANGED:80,WEIGHT_CHANGED:80,KEYWORD_SIMILARITY_ZERO:70,IMAGE_URL_CHANGED:65,CATEGORY_CHANGED:60,REVIEWS_DROPPED_80PCT:50,RATING_DROPPED_2PT:30,KEYWORD_SIMILARITY_LOW:30,IMAGE_COUNT_CHANGED:25},X=80,J=50,ee=30,te=new Set(["the","and","for","with","your","our","this","that","have","from","are","was","will","has","perfect","great","best","high","quality","easy","new","free","includes","included","features","product","item","made","make","use","used","using","also","more","very","can"]);function L(e){let t=0;for(let n=0;n<e.length;n++){const i=e.charCodeAt(n);t=(t<<5)-t+i,t=t&t}return Math.abs(t).toString(16)}function B(e){return e.join(" ").toLowerCase().split(/\s+/).filter(n=>n.length>4).filter(n=>!te.has(n)).filter(n=>/^[a-z0-9-]+$/.test(n)).slice(0,20)}function ne(e,t){if(!e.length||!t.length)return 1;const n=new Set(e),i=new Set(t),o=[...n].filter(c=>i.has(c)),l=new Set([...n,...i]);return l.size===0?1:o.length/l.size}async function oe(){return(await chrome.storage.local.get(P))[P]||{}}async function G(e){await chrome.storage.local.set({[P]:e})}async function ie(e,t){var g;const n=await oe(),i=(g=n[e.listingId])==null?void 0:g.fingerprint;if(!i)return n[e.listingId]={fingerprint:{capturedAt:new Date().toISOString(),brand:t.brand,imageUrl:t.imageUrl,imageHash:L(t.imageUrl),imageCount:t.imageCount,category:t.category,dimensions:t.dimensions,weight:t.weight,reviewCount:t.reviewCount,starRating:t.starRating,keywords:B(t.bullets)}},await G(n),{action:"baseline",score:0,signals:[],reasons:["First scan — baseline captured"]};const o=[],l=[];let c=0;const a=(d,h,E)=>{c+=h,o.push(d),l.push(E)};t.finalAsin&&t.finalAsin!==e.asin&&a("ASIN_REDIRECT",S.ASIN_REDIRECT,`Amazon redirected ${e.asin} → ${t.finalAsin}. Original product no longer exists at this URL.`),i.brand&&t.brand&&i.brand.toLowerCase()!==t.brand.toLowerCase()&&a("BRAND_CHANGED",S.BRAND_CHANGED,`Brand changed: "${i.brand}" → "${t.brand}". Different manufacturer — likely ASIN hijack.`),i.dimensions&&t.dimensions&&i.dimensions!==t.dimensions&&a("DIMENSIONS_CHANGED",S.DIMENSIONS_CHANGED,`Dimensions changed: "${i.dimensions}" → "${t.dimensions}". Different physical size = different product.`);const y=L(t.imageUrl);i.imageHash&&y!==i.imageHash&&a("IMAGE_HASH_CHANGED",S.IMAGE_HASH_CHANGED,"Main product image changed. Supplier uploaded new photo — possible design or product change."),i.weight&&t.weight&&i.weight!==t.weight&&a("WEIGHT_CHANGED",S.WEIGHT_CHANGED,`Weight changed: ${i.weight} → ${t.weight}. Different weight = different physical product.`);const m=B(t.bullets),u=ne(i.keywords||[],m);if(u<.1?a("KEYWORD_SIMILARITY_ZERO",S.KEYWORD_SIMILARITY_ZERO,`Description keywords have ${(u*100).toFixed(0)}% overlap with baseline. Product description is completely different — almost certainly a different product.`):u<.25&&a("KEYWORD_SIMILARITY_LOW",S.KEYWORD_SIMILARITY_LOW,`Description keywords only ${(u*100).toFixed(0)}% match with baseline. Significant product description change detected.`),i.imageUrl&&t.imageUrl&&i.imageUrl!==t.imageUrl&&!o.includes("IMAGE_HASH_CHANGED")&&a("IMAGE_URL_CHANGED",S.IMAGE_URL_CHANGED,"Amazon image URL changed. New product photo was uploaded to this listing."),i.category&&t.category&&i.category!==t.category&&a("CATEGORY_CHANGED",S.CATEGORY_CHANGED,`Category changed: "${i.category}" → "${t.category}". Product type classification changed.`),i.reviewCount>50&&t.reviewCount>0){const d=(i.reviewCount-t.reviewCount)/i.reviewCount*100;d>=80&&a("REVIEWS_DROPPED_80PCT",S.REVIEWS_DROPPED_80PCT,`Reviews dropped ${d.toFixed(0)}%: ${i.reviewCount.toLocaleString()} → ${t.reviewCount.toLocaleString()}. Likely ASIN hijack — new product wiped original reviews.`)}if(i.starRating>0&&t.starRating>0){const d=i.starRating-t.starRating;d>=2&&a("RATING_DROPPED_2PT",S.RATING_DROPPED_2PT,`Star rating dropped ${d.toFixed(1)} points: ${i.starRating} → ${t.starRating}. Severe customer dissatisfaction detected.`)}i.imageCount>0&&Math.abs(t.imageCount-i.imageCount)>=3&&a("IMAGE_COUNT_CHANGED",S.IMAGE_COUNT_CHANGED,`Image count changed: ${i.imageCount} → ${t.imageCount} photos. Photo gallery significantly changed.`);let f="clean";return c>=X?f="delist":c>=J?f="flag":c>=ee&&(f="log"),n[e.listingId].lastScore=c,n[e.listingId].lastSignals=o,n[e.listingId].lastScanned=new Date().toISOString(),n[e.listingId].status=f,await G(n),{action:f,score:c,signals:o,reasons:l}}let H=0,q=0,W=0;const s={pageNum:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalNoChange:0,totalRestocked:0};let k=!1,$=!1,K=[];async function se(){const e=document.getElementById("syndrax-log");e&&(K=Array.from(e.children).slice(-30).map(n=>n.textContent||""));const t={isRunning:!0,pageNum:s.pageNum,totalChecked:s.totalChecked,totalUpdated:s.totalUpdated,totalOutOfStock:s.totalOutOfStock,totalFlagged:s.totalFlagged,totalNoChange:s.totalNoChange,totalRestocked:s.totalRestocked,startTime:Date.now(),logMessages:K};await chrome.storage.local.set({syncState:t}),console.log("[Sync] Saved state before navigation:",t)}async function ae(){return(await chrome.storage.local.get("syncState")).syncState||null}async function Y(){await chrome.storage.local.remove("syncState")}function b(e){return new Promise(t=>setTimeout(t,e))}async function _(e=15e3){const t=Date.now();for(;Date.now()-t<e;){const n=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(n.length>0)return console.log(`[Sync] Found ${n.length} rows after ${Date.now()-t}ms`),n;await b(500)}return console.log("[Sync] Timeout waiting for rows"),[]}function r(e,t="info"){const n=document.getElementById("syndrax-log");if(n){const i={info:"#00CFFF",success:"#22c55e",error:"#ef4444",warn:"#FFD700"},o=new Date().toLocaleTimeString(),l=document.createElement("div");for(l.style.cssText=`
      font-size: 10px;
      color: ${i[t]};
      margin-bottom: 2px;
      word-break: break-all;
    `,l.textContent=`[${o}] ${e}`,n.appendChild(l),n.scrollTop=n.scrollHeight;n.children.length>50;)n.removeChild(n.firstChild)}console.log(`[Sync ${t}]`,e)}function F(e){const t=document.getElementById("syndrax-status");t&&(t.textContent=e,t.style.color="#00CFFF");const n=document.getElementById("syndrax-loading-msg");n&&(n.textContent=e),r(e,"info")}function re(e){if(!e)return"";try{const n=atob(e.trim());if(/^[A-Z0-9]{10}$/i.test(n))return n.toUpperCase()}catch{}if(/^[A-Z0-9]{10}$/i.test(e.trim()))return e.trim().toUpperCase();const t=e.match(/[A-Z0-9]{10}/i);return t?t[0].toUpperCase():""}function le(e){var f,g;const t=e.getAttribute("data-id")||"";if(!t)return null;const n=e.querySelector(".shui-dt-column__title a")||e.querySelector(".column-title__text a")||e.querySelector('[data-test-id="item-title"]'),i=((f=n==null?void 0:n.textContent)==null?void 0:f.trim())||"",o=e.querySelector(".shui-dt-column__price")||e.querySelector(".col-price__current"),c=((o==null?void 0:o.textContent)||"").match(/\$([0-9,]+\.?[0-9]*)/),a=c?parseFloat(c[1].replace(",","")):0,y=e.querySelector(".shui-dt-column__listingSKU")||e.querySelector('[data-test-id="listing-sku"]'),m=((g=y==null?void 0:y.textContent)==null?void 0:g.trim())||"",u=re(m);return console.log(`[Sync] Row ${t}: "${i.substring(0,30)}..." Price: $${a} SKU: ${m} ASIN: ${u}`),{listingId:t,title:i,price:a,rawSku:m,asin:u,row:e}}function ce(e){var i;const t=e.querySelector('input[name*="availableQuantity"]');if(t)return parseInt(t.value)||0;const n=e.querySelector(".shui-dt-column__availableQuantity");if(n){const l=(((i=n.textContent)==null?void 0:i.trim())||"").match(/\d+/);if(l)return parseInt(l[0])||0}return 1}async function de(e,t){var u,f;const n=e,i=n.querySelector('button[aria-label="Edit Current price"]')||n.querySelector('button[column="price"]');if(!i)return console.log("[Sync Debug] Edit price button not found"),r("  ❌ Edit price button not found","error"),!1;r("  📝 Clicking Edit Price...","info"),i.click(),await b(1200);let o=null;const l=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');console.log("[Sync Debug] Found price dialogs:",l.length);for(const g of l){const d=g.querySelector('input[name*="price"]')||g.querySelector('input[aria-label*="price" i]')||g.querySelector("input.textbox__control");if(d){o=d,console.log("[Sync Debug] Found price input:",d.name||d.className);break}}if(o||(o=document.querySelector('input[name*="price"]')||document.querySelector("input.textbox__control")),!o)return r("  ❌ Price input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const c=t.toFixed(2);if(r(`  ✏️ Setting price to $${c}...`,"info"),o.focus(),await b(100),o.select(),await b(100),o.setSelectionRange(0,o.value.length),document.execCommand("insertText",!1,c),await b(100),o.value!==c){const g=(u=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:u.set;g&&g.call(o,c),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}o.value!==c&&(o.value=c,o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))),console.log("[Sync Debug] Price input value after setting:",o.value),await b(300),r("  💾 Submitting price...","info");let a=null;const y=document.querySelectorAll("button");for(const g of y)if((((f=g.textContent)==null?void 0:f.trim().toLowerCase())||"")==="submit"){a=g,console.log("[Sync Debug] Found price Submit button with text:",g.className);break}if(a||(a=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),a){console.log("[Sync Debug] Clicking price Submit button");const g=a.closest("form");g&&g.addEventListener("submit",d=>{d.preventDefault()},{once:!0}),a.focus(),await b(100),a.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window}))}else return console.log("[Sync Debug] Price Submit button not found"),r("  ⚠️ Could not find Submit button for price","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await b(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(r("  ⚠️ Price dialog still open","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(r(`  ✅ Price updated to $${c}!`,"success"),!0)}async function j(e,t){var u,f,g;const n=e,i=n.querySelector('button[aria-label="Edit Available quantity"]');if(!i)return n.querySelector('[data-test-id="variation-count"]')||((u=n.textContent)==null?void 0:u.includes("variation"))?(r("  ⚠️ Has variations - skip inline edit","warn"),!1):(r("  ❌ Edit button not found","error"),!1);if(i.disabled||i.getAttribute("aria-disabled")==="true")return r("  ⚠️ Edit disabled - item may be locked","warn"),!1;r("  📝 Clicking Edit...","info"),i.click(),await b(1200);let o=null;const l=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"], [class*="modal"]');console.log("[Sync Debug] Found dialogs:",l.length);for(const d of l){const h=d.querySelector('input[type="text"], input.textbox__control, input');if(h){o=h,console.log("[Sync Debug] Found input in dialog:",h.className);break}}if(o||(o=document.querySelector("input.textbox__control:focus")||document.querySelector('input[aria-label*="quantity" i]')||document.querySelector("input.textbox__control")),!o)return r("  ❌ Input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;if(r(`  ✏️ Setting to ${t}...`,"info"),o.focus(),await b(100),o.select(),o.setSelectionRange(0,o.value.length),await b(100),document.execCommand("insertText",!1,t.toString()),await b(100),o.value!==t.toString()){const d=(f=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:f.set;d&&d.call(o,t.toString()),o.dispatchEvent(new Event("input",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new Event("change",{bubbles:!0,cancelable:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:t.toString(),inputType:"insertText"}))}if(await b(100),o.value!==t.toString()){o.focus(),o.select();for(let h=0;h<5;h++)o.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keyup",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0}));const d=t.toString();o.dispatchEvent(new KeyboardEvent("keydown",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.dispatchEvent(new KeyboardEvent("keypress",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.dispatchEvent(new InputEvent("input",{bubbles:!0,data:d,inputType:"insertText"})),o.dispatchEvent(new KeyboardEvent("keyup",{key:d,code:`Digit${d}`,keyCode:48+parseInt(d),bubbles:!0})),o.value=t.toString(),o.dispatchEvent(new Event("input",{bubbles:!0})),o.dispatchEvent(new Event("change",{bubbles:!0}))}console.log("[Sync Debug] Input value after setting:",o.value),await b(300),r("  💾 Finding Submit button...","info");const c=document.querySelectorAll('.lightbox-dialog, [role="dialog"], .quick-edit-modal');console.log("[Sync Debug] Open dialogs:",c.length);let a=null;const y=document.querySelectorAll("button");for(const d of y)if((((g=d.textContent)==null?void 0:g.trim().toLowerCase())||"")==="submit"){a=d,console.log('[Sync Debug] Found button with text "Submit":',d.className);break}if(a||(a=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),a){console.log("[Sync Debug] Clicking Submit button:",a.outerHTML.substring(0,100));const d=a.closest("form");d&&d.addEventListener("submit",h=>{h.preventDefault()},{once:!0}),a.focus(),await b(100),a.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window})),console.log("[Sync Debug] Clicked Submit button")}else return console.log("[Sync Debug] Submit button not found"),r("  ⚠️ Could not find Submit button","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await b(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(r("  ⚠️ Dialog still open - may need manual submit","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(r("  ✅ Updated!","success"),!0)}function v(e,t,n){const i=e,o=i.querySelector(".syndrax-badge");o&&o.remove();const l=document.createElement("span");l.className="syndrax-badge",l.textContent=t,l.style.cssText=`
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: ${n}22;
    border: 1px solid ${n};
    color: ${n};
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    z-index: 9999;
    white-space: nowrap;
  `,i.style.position="relative",i.appendChild(l)}async function ue(e,t){const n="https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",i=[...e.reasons.map((o,l)=>({name:`${e.action==="delist"?"🔴":"⚠️"} ${e.signals[l]} (+${S[e.signals[l]]||0} pts)`,value:o,inline:!1})),{name:"📊 Total Score",value:`${e.score} pts`,inline:!0},{name:"🏪 eBay",value:`[View Listing](https://www.ebay.com/itm/${t.listingId})`,inline:!0},{name:"🛒 Amazon",value:`[View on Amazon](https://www.amazon.com/dp/${t.asin})`,inline:!0},{name:"⚡ Action Taken",value:"eBay quantity set to 0. Listing stays active but cannot receive orders. Review and manually reinstate when confirmed safe.",inline:!1}];try{await fetch(n,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:e.action==="delist"?"🚨 CRITICAL — Product Changed — Quantity Set to 0":"⚠️ WARNING — Suspicious Changes — Quantity Set to 0",description:`**${t.title.substring(0,80)}**
ASIN: \`${t.asin}\` | Listing: \`${t.listingId}\``,color:e.action==="delist"?16711680:16747520,fields:i,timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync — Fingerprint Check"}}]})})}catch(o){console.error("Fingerprint webhook failed:",o)}}async function z(e,t){var a,y,m;const n=e.row,i=ce(e.row),o=e.title.substring(0,25);if(t.title&&t.brand!==void 0){const u=await ie({listingId:e.listingId,title:e.title,asin:e.asin},{title:t.title||"",price:t.amazonPrice||0,brand:t.brand||"",imageUrl:t.imageUrl||"",imageCount:t.imageCount||0,category:t.category||"",dimensions:t.dimensions||"",weight:t.weight||"",reviewCount:t.reviewCount||0,starRating:t.starRating||0,bullets:t.bullets||[],finalAsin:t.finalAsin||e.asin});if(u.action==="delist"||u.action==="flag"){r(`🔍 Fingerprint: ${u.action.toUpperCase()} (${u.score}pts)`,u.action==="delist"?"error":"warn");const f=n.querySelector(".shui-dt-column__availableQuantity");if(f){f.click(),await b(500);const g=f.querySelector("input");g&&(g.value="0",g.dispatchEvent(new Event("input",{bubbles:!0})),g.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:!0})),await b(500))}await ue(u,e),n.style.outline=`2px solid ${u.action==="delist"?"#FF0000":"#FF8C00"}`,v(n,`${u.action==="delist"?"🚨":"⚠️"} ${u.score}pts — Qty Set to 0`,u.action==="delist"?"#FF0000":"#FF8C00"),s.totalFlagged++,s.totalChecked++,I();return}u.action==="baseline"&&(v(n,"📸 Baseline Saved","#00CFFF"),r(`📸 ${o}... → Baseline captured`,"info"))}n.style.outline="2px solid #00CFFF",n.style.background="rgba(0, 207, 255, 0.05)";const l=t.amazonPrice?`$${t.amazonPrice.toFixed(2)}`:"N/A",c=`$${e.price.toFixed(2)}`;switch(r(`${e.asin}: ${t.action}`,"info"),r(`  eBay: qty=${i} price=${c} | Amazon: ${l}`,"info"),t.action){case"WRONG_ITEM":s.totalFlagged++,n.style.outline="2px solid #FF8C00",n.style.background="rgba(255, 140, 0, 0.08)",v(n,`⚠ Wrong Item (${Math.round((t.similarity||0)*100)}%)`,"#FF8C00"),r(`⚠ ${o}... → Wrong item match`,"warn");break;case"OUT_OF_STOCK":if(i>0){r(`🔴 ${o}... → OOS! Needs qty 0`,"error");const u=await j(e.row,0);s.totalOutOfStock++,u?(s.totalUpdated++,r("✓ Quantity updated to 0","success"),await R.outOfStock({title:e.title,listingId:e.listingId,amazonUrl:`https://www.amazon.com/dp/${e.asin}`,amazonPrice:t.amazonPrice||0})):r("⚠ Manual update needed","warn"),n.style.outline="2px solid #FF3D3D",n.style.background="rgba(255, 61, 61, 0.08)",v(n,`✗ OOS (was ${i})`,"#FF3D3D")}else s.totalOutOfStock++,n.style.outline="2px solid #888",v(n,"✗ Already 0","#888"),r(`- ${o}... → Already 0`,"info");break;case"PRICE_UPDATED":case"NO_CHANGE":if(i===0)r(`💚 ${o}... → IN STOCK! Needs qty 1`,"success"),await j(e.row,1)?(s.totalUpdated++,s.totalRestocked++,r("✓ Restocked to 1","success")):r("⚠ Manual restock needed","warn"),n.style.outline="2px solid #00FF88",n.style.background="rgba(0, 255, 136, 0.08)",v(n,"↑ Restocked to 1","#00FF88");else if(t.action==="PRICE_UPDATED"&&t.newEbayPrice){const u=t.priceWentUp?"#FFD700":"#00FF88";n.style.outline=`2px solid ${u}`,n.style.background=t.priceWentUp?"rgba(255, 215, 0, 0.08)":"rgba(0, 255, 136, 0.08)",r(`💰 ${o}... → Price ${t.priceWentUp?"↑":"↓"} $${t.amazonPrice}→$${(a=t.newEbayPrice)==null?void 0:a.toFixed(2)}`,t.priceWentUp?"warn":"success"),await de(e.row,t.newEbayPrice)?(s.totalUpdated++,v(n,`${t.priceWentUp?"↑":"↓"} $${(y=t.newEbayPrice)==null?void 0:y.toFixed(2)} ✓`,u),r(`✓ Price updated to $${t.newEbayPrice.toFixed(2)}`,"success"),await R.priceUpdated({title:e.title,listingId:e.listingId,oldPrice:e.price,newPrice:t.newEbayPrice,amazonPrice:t.amazonPrice||0,direction:t.priceWentUp?"up":"down"})):(v(n,`${t.priceWentUp?"↑":"↓"} $${(m=t.newEbayPrice)==null?void 0:m.toFixed(2)} ⚠`,u),r("⚠ Manual price update needed","warn"))}else s.totalNoChange++,n.style.outline="2px solid #22c55e",n.style.background="rgba(34, 197, 94, 0.03)",v(n,"✓ OK","#22c55e"),r(`✓ ${o}... → OK ($${t.amazonPrice})`,"success"),setTimeout(()=>{n.style.outline="",n.style.background=""},2e3);break;case"ERROR":case"SOURCE_NOT_FOUND":s.totalFlagged++,n.style.outline="2px solid #888",v(n,"? Error","#888"),r(`? ${o}... → ${t.action}`,"error");break}s.totalChecked++,I()}async function T(){var n;if(k){r("⚠ Sync already running!","warn");return}if(k=!0,s.totalChecked>0)r(`🚀 Continuing sync on page ${s.pageNum}...`,"success");else{const i=document.getElementById("syndrax-log");i&&(i.innerHTML=""),r("🚀 Starting sync...","success"),s.pageNum=1,s.totalChecked=0,s.totalUpdated=0,s.totalOutOfStock=0,s.totalFlagged=0,s.totalNoChange=0,q=0,H=Date.now(),W=document.querySelectorAll("tr.grid-row[data-id]").length,await R.syncStarted(W)}for(chrome.runtime.sendMessage({type:"SYNC_STARTED",payload:{pageNum:s.pageNum},timestamp:Date.now()});!$;){console.log(`[Sync] Processing page ${s.pageNum}`),await b(1e3);const i=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(console.log(`[Sync] Found ${i.length} rows on page ${s.pageNum}`),i.length===0){console.log("[Sync] No rows found, stopping");break}for(let d=0;d<i.length;d+=3){if($){r("⏹️ Sync stopped by user","warn");break}const h=i.slice(d,d+3),E=[];for(const p of h){const w=le(p);w&&E.push(w)}const C=E.filter(p=>p.asin);if(C.length===0){console.log(`[Sync] No valid ASINs in batch ${d/3+1}, skipping`),s.totalFlagged+=E.length,s.totalChecked+=E.length;for(const p of E)if(!p.asin){const w=p.row;w.style.outline="2px solid #888",v(w,"⚠ No ASIN","#888")}continue}console.log(`[Sync] Checking ${C.length} items with ASINs...`),F(`Checking batch ${Math.floor(d/3)+1}...`);const A=C.map(p=>({listingId:p.listingId,title:p.title,price:p.price,asin:p.asin,amazonUrl:`https://www.amazon.com/dp/${p.asin}`})),Q=A.map(p=>p.asin).join(", ");r(`📦 Batch ASINs: ${Q}`,"info"),console.log("[Sync] Sending to background:",A.map(p=>p.asin)),r(`🌐 Opening ${C.length} Amazon tabs...`,"info");try{const p=await chrome.runtime.sendMessage({type:"CHECK_AMAZON_BATCH",payload:{items:A},timestamp:Date.now()});if(console.log("[Sync] Response from background:",p),p!=null&&p.results){F(`Processing ${p.results.length} results...`);for(let w=0;w<p.results.length;w++){const U=C[w],M=p.results[w];console.log(`[Sync] Result for ${U.asin}:`,M),await z(U,M)}}else console.error("[Sync] No results in response:",p),F("Error: No response from Amazon check")}catch(p){console.error("[Sync] Error checking Amazon:",p),F(`Error: ${p.message}`);for(const w of C)await z(w,{action:"ERROR"})}chrome.runtime.sendMessage({type:"SYNC_PROGRESS",payload:{pageNum:s.pageNum,checked:s.totalChecked,updated:s.totalUpdated,outOfStock:s.totalOutOfStock,flagged:s.totalFlagged,noChange:s.totalNoChange},timestamp:Date.now()}),await b(3e3)}const o=new URL(window.location.href),l=parseInt(o.searchParams.get("offset")||"0"),c=i.length;parseInt(o.searchParams.get("limit")||c.toString());const a=l+c,y=document.querySelector('button[aria-label="Go to next page"]')||document.querySelector(".pagination__next:not([disabled])")||document.querySelector('a[rel="next"]'),u=(((n=document.querySelector(".pagination-results, .shui-pagination-status"))==null?void 0:n.textContent)||"").match(/of\s+([\d,]+)/i),f=u?parseInt(u[1].replace(",","")):0;if(!(y!==null||f>0&&l+c<f)){console.log("[Sync] Last page reached - no more pages to process"),r("📄 Last page - no Next button found","info");break}console.log(`[Sync] Going to next page: offset ${l} → ${a}`),r(`📄 Going to page ${s.pageNum+1}...`,"info"),s.pageNum++,await se(),o.searchParams.set("offset",a.toString()),window.location.href=o.toString();return}k=!1,r(`✅ COMPLETE! Checked: ${s.totalChecked}, OOS: ${s.totalOutOfStock}`,"success"),console.log("[Sync] Complete!",s);const t=`${Math.round((Date.now()-H)/1e3)}s`;await R.syncComplete({checked:s.totalChecked,updated:s.totalUpdated,outOfStock:s.totalOutOfStock,flagged:s.totalFlagged,errors:q,duration:t}),chrome.runtime.sendMessage({type:"SYNC_COMPLETE",payload:{totalPages:s.pageNum,totalChecked:s.totalChecked,totalUpdated:s.totalUpdated,totalOutOfStock:s.totalOutOfStock,totalFlagged:s.totalFlagged,totalNoChange:s.totalNoChange},timestamp:Date.now()})}function ge(){const e=document.getElementById("syndrax-control-panel");e&&e.remove();const t=document.createElement("div");t.id="syndrax-control-panel",t.innerHTML=`
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
  `,document.body.appendChild(t);const n=document.getElementById("syndrax-run"),i=document.getElementById("syndrax-stop"),o=document.getElementById("syndrax-minimize"),l=document.getElementById("syndrax-content");n==null||n.addEventListener("click",async()=>{if(k)return;$=!1,n.textContent="⏳ Running...",n.style.display="none",i.style.display="block",D(),await T();const a=document.getElementById("syndrax-big-stats");a&&a.remove(),i.style.display="none",n.style.display="block",n.textContent="✓ Complete",$=!1,setTimeout(()=>{n.textContent="▶ Run Sync"},3e3)}),i==null||i.addEventListener("click",()=>{$=!0,i.textContent="⏹ Stopping...",r("⏹️ Stop requested...","warn")}),o==null||o.addEventListener("click",()=>{if(l){const a=l.style.display==="none";l.style.display=a?"block":"none",o.textContent=a?"−":"+"}});const c=document.getElementById("syndrax-copy");c==null||c.addEventListener("click",()=>{const a=document.getElementById("syndrax-log");if(a){const y=a.innerText;navigator.clipboard.writeText(y).then(()=>{c.textContent="✓ Copied!",setTimeout(()=>{c.textContent="📋 Copy"},2e3)}).catch(()=>{const m=document.createElement("textarea");m.value=y,document.body.appendChild(m),m.select(),document.execCommand("copy"),document.body.removeChild(m),c.textContent="✓ Copied!",setTimeout(()=>{c.textContent="📋 Copy"},2e3)})}})}function D(){const e=document.getElementById("syndrax-big-stats");e&&e.remove();const t=document.createElement("div");t.id="syndrax-big-stats",t.innerHTML=`
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
  `,document.body.appendChild(t)}function I(){const e=document.getElementById("stat-checked"),t=document.getElementById("stat-updated"),n=document.getElementById("stat-oos"),i=document.getElementById("syndrax-status");e&&(e.textContent=s.totalChecked.toString()),t&&(t.textContent=s.totalUpdated.toString()),n&&(n.textContent=s.totalOutOfStock.toString()),i&&k&&(i.textContent=`Page ${s.pageNum} | ${s.totalFlagged} flagged | ${s.totalNoChange} unchanged`);const o=document.getElementById("big-page"),l=document.getElementById("big-checked"),c=document.getElementById("big-updated"),a=document.getElementById("big-oos"),y=document.getElementById("big-restocked"),m=document.getElementById("big-ok");o&&(o.textContent=s.pageNum.toString()),l&&(l.textContent=s.totalChecked.toString()),c&&(c.textContent=s.totalUpdated.toString()),a&&(a.textContent=s.totalOutOfStock.toString()),y&&(y.textContent=s.totalRestocked.toString()),m&&(m.textContent=s.totalNoChange.toString())}chrome.runtime.onMessage.addListener(e=>{e.type==="SYNC_PROGRESS"&&I()});function pe(){const e=document.getElementById("syndrax-control-panel");if(e){let t=document.getElementById("syndrax-error-badge");if(!t){t=document.createElement("div"),t.id="syndrax-error-badge",t.style.cssText=`
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
      `,t.textContent="⚠️";const n=document.createElement("style");n.textContent=`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `,document.head.appendChild(n);const i=e.querySelector("div");i&&(i.style.position="relative",i.appendChild(t))}}}async function N(e){console.log("[Syndrax Sync] 🚨 EMERGENCY RESUME - Normal resume failed, auto-clicking Run button"),pe(),r("🚨 Resume failed! Emergency auto-start...","error"),s.pageNum=e.pageNum,s.totalChecked=e.totalChecked,s.totalUpdated=e.totalUpdated,s.totalOutOfStock=e.totalOutOfStock,s.totalFlagged=e.totalFlagged,s.totalNoChange=e.totalNoChange,s.totalRestocked=e.totalRestocked||0,I(),await _(1e4);const t=document.getElementById("syndrax-run");t?(console.log("[Syndrax Sync] Clicking Run button as fallback"),t.click()):r("❌ Could not find Run button!","error")}function ye(){window.addEventListener("beforeunload",n=>{if(k)return console.log("[Syndrax Sync] 🛑 Blocking navigation - sync in progress"),n.preventDefault(),n.returnValue="",""}),document.addEventListener("click",n=>{const o=n.target.closest("a");if(o&&o.href&&(o.href.includes("/n/all-categories")||o.href.includes("_nkw=")||o.href.includes("/sch/")&&!o.href.includes("/sh/")))return console.log("[Syndrax Sync] 🛑 Blocked bad navigation:",o.href),n.preventDefault(),n.stopPropagation(),!1},!0),document.addEventListener("submit",n=>{const i=n.target;if(i.action&&(i.action.includes("/n/all-categories")||i.action.includes("_nkw=")||i.action.includes("/sch/")))return console.log("[Syndrax Sync] 🛑 Blocked bad form submission:",i.action),n.preventDefault(),n.stopPropagation(),!1},!0);const e=window.location.assign;window.location.assign=function(n){if(n.includes("/n/all-categories")||n.includes("_nkw=")){console.log("[Syndrax Sync] 🛑 Blocked location.assign:",n);return}return e.call(window.location,n)};const t=Object.getOwnPropertyDescriptor(Location.prototype,"href");t&&t.set&&Object.defineProperty(window.location,"href",{set:function(n){if(n.includes("/n/all-categories")||n.includes("_nkw=")&&!n.includes("/sh/lst")){console.log("[Syndrax Sync] 🛑 Blocked location.href:",n);return}return t.set.call(window.location,n)},get:function(){return t.get.call(window.location)}})}async function V(){const e=window.location.href;if(console.log("[Syndrax Sync] Checking URL:",e),e.includes("/n/all-categories")||e.includes("_nkw=")&&!e.includes("/sh/lst")){console.log("[Syndrax Sync] 🚨 EMERGENCY: On bad page! Redirecting back to listings..."),window.location.href="https://www.ebay.com/sh/lst/active";return}if(!(e.includes("ebay.com/sh/lst")||e.includes("ebay.com/mys/active")||e.includes("ebay.com/sh/lst/active")||e.includes("ebay.com/sh/lst?")||e.includes("/sh/lst"))){console.log("[Syndrax Sync] Not a listings page, skipping");return}console.log("[Syndrax Sync] eBay Active Listings page detected!"),ye(),ge(),console.log("[Syndrax Sync] Checking for saved state...");let n=null;try{n=await ae(),console.log("[Syndrax Sync] Loaded state:",n)}catch(l){console.error("[Syndrax Sync] Error loading state:",l),r(`❌ Error loading state: ${l}`,"error")}if(!n||!n.isRunning){console.log("[Syndrax Sync] No running state - auto-starting fresh sync..."),r("🚀 Auto-starting sync...","success"),r("⏳ Waiting for table...","info");const l=await _(15e3);if(l.length===0){r("⚠️ No table found after 15s","warn");return}r(`✅ Found ${l.length} items, starting...`,"success"),D(),await T();const c=document.getElementById("syndrax-big-stats");c&&c.remove(),r("✅ Sync complete!","success");const a=document.getElementById("syndrax-loading-msg");a&&(a.textContent="Complete!");return}const i=Date.now()-n.startTime;if(console.log("[Syndrax Sync] Time since save:",i,"ms"),i>=5*60*1e3){console.log("[Syndrax Sync] Saved state too old, clearing"),await Y();return}console.log("[Syndrax Sync] Attempting to resume from saved state:",n);const o=setTimeout(()=>{console.error("[Syndrax Sync] ⚠️ Resume timeout! Triggering emergency fallback"),N(n)},3e4);try{s.pageNum=n.pageNum,s.totalChecked=n.totalChecked,s.totalUpdated=n.totalUpdated,s.totalOutOfStock=n.totalOutOfStock,s.totalFlagged=n.totalFlagged,s.totalNoChange=n.totalNoChange,s.totalRestocked=n.totalRestocked||0;const l=document.getElementById("syndrax-log");if(l&&n.logMessages&&n.logMessages.length>0){l.innerHTML="";for(const m of n.logMessages){const u=document.createElement("div");u.style.cssText="font-size: 10px; color: #888; margin-bottom: 2px;",u.textContent=m,l.appendChild(u)}}I(),r(`📄 Resumed on page ${s.pageNum}`,"success"),D(),r("⏳ Waiting for table to load...","info");const c=await _(15e3);if(c.length===0){r("⚠️ Table not loaded after 15s, trying emergency...","warn"),clearTimeout(o),await N(n);return}r(`✅ Found ${c.length} rows, continuing sync...`,"success");const a=document.getElementById("syndrax-run"),y=document.getElementById("syndrax-stop");a&&(a.style.display="none"),y&&(y.style.display="block"),clearTimeout(o),await T(),y&&(y.style.display="none"),a&&(a.style.display="block",a.textContent="✓ Complete",setTimeout(()=>{a.textContent="▶ Run Sync"},3e3)),await Y()}catch(l){console.error("[Syndrax Sync] Error in resume:",l),r(`❌ Resume error: ${l}`,"error"),clearTimeout(o),await N(n)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",V):V();
})()
