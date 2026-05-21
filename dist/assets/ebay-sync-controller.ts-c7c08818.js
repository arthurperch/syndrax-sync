(function(){const R="syndrax_fingerprints",w={ASIN_REDIRECT:100,BRAND_CHANGED:90,DIMENSIONS_CHANGED:85,IMAGE_HASH_CHANGED:80,WEIGHT_CHANGED:80,KEYWORD_SIMILARITY_ZERO:70,IMAGE_URL_CHANGED:65,CATEGORY_CHANGED:60,REVIEWS_DROPPED_80PCT:50,VARIANT_CHANGED:45,RATING_DROPPED_2PT:30,KEYWORD_SIMILARITY_LOW:30,IMAGE_COUNT_CHANGED:25},J=80,Q=50,Z=30,z=new Set(["the","and","for","with","your","our","this","that","have","from","are","was","will","has","perfect","great","best","high","quality","easy","new","free","includes","included","features","product","item","made","make","use","used","using","also","more","very","can"]);function L(e){let t=0;for(let o=0;o<e.length;o++){const n=e.charCodeAt(o);t=(t<<5)-t+n,t=t&t}return Math.abs(t).toString(16)}function M(e){return e.join(" ").toLowerCase().split(/\s+/).filter(o=>o.length>4).filter(o=>!z.has(o)).filter(o=>/^[a-z0-9-]+$/.test(o)).slice(0,20)}function X(e,t){if(!e.length||!t.length)return 1;const o=new Set(e),n=new Set(t),i=[...o].filter(d=>n.has(d)),r=new Set([...o,...n]);return r.size===0?1:i.length/r.size}async function ee(){return(await chrome.storage.local.get(R))[R]||{}}async function G(e){await chrome.storage.local.set({[R]:e})}async function te(e,t){var h;const o=await ee(),n=(h=o[e.listingId])==null?void 0:h.fingerprint;if(!n)return o[e.listingId]={fingerprint:{capturedAt:new Date().toISOString(),brand:t.brand,imageUrl:t.imageUrl,imageHash:L(t.imageUrl),imageCount:t.imageCount,category:t.category,dimensions:t.dimensions,weight:t.weight,reviewCount:t.reviewCount,starRating:t.starRating,keywords:M(t.bullets),variantLabel:t.selectedVariantLabel||""}},await G(o),{action:"baseline",score:0,signals:[],reasons:["First scan — baseline captured"]};const i=[],r=[];let d=0;const l=(S,I,F)=>{d+=I,i.push(S),r.push(F)};t.finalAsin&&t.finalAsin!==e.asin&&l("ASIN_REDIRECT",w.ASIN_REDIRECT,`Amazon redirected ${e.asin} → ${t.finalAsin}. Original product no longer exists at this URL.`),n.brand&&t.brand&&n.brand.toLowerCase()!==t.brand.toLowerCase()&&l("BRAND_CHANGED",w.BRAND_CHANGED,`Brand changed: "${n.brand}" → "${t.brand}". Different manufacturer — likely ASIN hijack.`),n.dimensions&&t.dimensions&&n.dimensions!==t.dimensions&&l("DIMENSIONS_CHANGED",w.DIMENSIONS_CHANGED,`Dimensions changed: "${n.dimensions}" → "${t.dimensions}". Different physical size = different product.`);const y=L(t.imageUrl);n.imageHash&&y!==n.imageHash&&l("IMAGE_HASH_CHANGED",w.IMAGE_HASH_CHANGED,"Main product image changed. Supplier uploaded new photo — possible design or product change."),n.weight&&t.weight&&n.weight!==t.weight&&l("WEIGHT_CHANGED",w.WEIGHT_CHANGED,`Weight changed: ${n.weight} → ${t.weight}. Different weight = different physical product.`);const m=M(t.bullets),f=X(n.keywords||[],m);if(f<.1?l("KEYWORD_SIMILARITY_ZERO",w.KEYWORD_SIMILARITY_ZERO,`Description keywords have ${(f*100).toFixed(0)}% overlap with baseline. Product description is completely different — almost certainly a different product.`):f<.25&&l("KEYWORD_SIMILARITY_LOW",w.KEYWORD_SIMILARITY_LOW,`Description keywords only ${(f*100).toFixed(0)}% match with baseline. Significant product description change detected.`),n.imageUrl&&t.imageUrl&&n.imageUrl!==t.imageUrl&&!i.includes("IMAGE_HASH_CHANGED")&&l("IMAGE_URL_CHANGED",w.IMAGE_URL_CHANGED,"Amazon image URL changed. New product photo was uploaded to this listing."),n.category&&t.category&&n.category!==t.category&&l("CATEGORY_CHANGED",w.CATEGORY_CHANGED,`Category changed: "${n.category}" → "${t.category}". Product type classification changed.`),n.reviewCount>50&&t.reviewCount>0){const S=(n.reviewCount-t.reviewCount)/n.reviewCount*100;S>=80&&l("REVIEWS_DROPPED_80PCT",w.REVIEWS_DROPPED_80PCT,`Reviews dropped ${S.toFixed(0)}%: ${n.reviewCount.toLocaleString()} → ${t.reviewCount.toLocaleString()}. Likely ASIN hijack — new product wiped original reviews.`)}if(n.starRating>0&&t.starRating>0){const S=n.starRating-t.starRating;S>=2&&l("RATING_DROPPED_2PT",w.RATING_DROPPED_2PT,`Star rating dropped ${S.toFixed(1)} points: ${n.starRating} → ${t.starRating}. Severe customer dissatisfaction detected.`)}n.imageCount>0&&Math.abs(t.imageCount-n.imageCount)>=3&&l("IMAGE_COUNT_CHANGED",w.IMAGE_COUNT_CHANGED,`Image count changed: ${n.imageCount} → ${t.imageCount} photos. Photo gallery significantly changed.`);const g=n.variantLabel||"",u=t.selectedVariantLabel||"";g&&u&&g!==u&&l("VARIANT_CHANGED",w.VARIANT_CHANGED,`Variant changed from "${g}" to "${u}". The specific size/color your eBay listing shows may now be different from what Amazon ships.`);let c="clean";return d>=J?c="delist":d>=Q?c="flag":d>=Z&&(c="log"),o[e.listingId].lastScore=d,o[e.listingId].lastSignals=i,o[e.listingId].lastScanned=new Date().toISOString(),o[e.listingId].status=c,await G(o),{action:c,score:d,signals:i,reasons:r}}const C={logs:"https://discord.com/api/webhooks/1503287936739971184/qPvU1WhFw6MIGLQvCSB7uuVo-RfCGTyLEuIQ9KGzqSIx1u0tVu9SBHABAb3UO-XLLd0m",errors:"https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",priceUpdates:"https://discord.com/api/webhooks/1503288293804998656/Q_JgPTP45rhzRcZ4K1l2PoD6zl1sglro2_wGyM7s-pLzPGdhmJOw719-pllOsjEEaSGY",outOfStock:"https://discord.com/api/webhooks/1503288443197980815/irYdU3Dw4FhQwtEZRvQ-SXroysuhWDFiQgzOT53bxuYz0zfgcGI5kBdZWu5vX3h0I5pS",variantAlerts:"https://discord.com/api/webhooks/1504718905489231972/fEr_SUxMKUON5IMhqW9LSAf8LlF0OkCxMbS5M168S0oPb5a8RIHQrJyOj6wdHaC0vrPI",fingerprintLog:"https://discord.com/api/webhooks/1504719051027386508/xH26ae_MBs7GyDVgQfWwaYzjIIJNKpvI032Wkq9yCbUq92kfwG8E69VG_nxNilMLJSyy",dailySummary:"https://discord.com/api/webhooks/1504719193684054180/I_BkYjc3oT--dSExLekK8HCUTE63GbASpzlbDCJ_NVgNCkOGZlttjEAgF3tIEKJAQeHb"};let E={startedAt:"",completedAt:"",page:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalErrors:0,totalNoAsin:0,totalNoChange:0,totalRestocked:0,outOfStockItems:[],priceUpdatedItems:[],flaggedItems:[],errorItems:[],noAsinItems:[]};function ne(){E={startedAt:new Date().toISOString(),completedAt:"",page:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalErrors:0,totalNoAsin:0,totalNoChange:0,totalRestocked:0,outOfStockItems:[],priceUpdatedItems:[],flaggedItems:[],errorItems:[],noAsinItems:[]}}let H=!1;async function oe(){if(H)return;H=!0,console.log("[Sync] 🔔 Testing all webhook connections..."),a("🔔 Testing Discord webhook connections...","info");const e=new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),t=Object.keys(C),o=[];for(const i of t){try{const r=await fetch(C[i],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:{logs:"Syndrax Sync",errors:"Syndrax Alert System",priceUpdates:"Syndrax PriceBot",outOfStock:"Syndrax StockBot",variantAlerts:"Syndrax VariantBot",fingerprintLog:"Syndrax Fingerprint",dailySummary:"Syndrax Daily Report"}[i]||"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:`✅ Webhook Connection Test — #${i}`,description:"This channel is connected and receiving messages from Syndrax Sync.",color:65416,fields:[{name:"🕐 Time",value:e,inline:!0},{name:"📡 Channel",value:`#${i}`,inline:!0},{name:"🤖 Status",value:"Connected ✅",inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync — Connection Test"}}]})});r.ok?(o.push({channel:i,success:!0}),console.log(`[Discord] ✅ Ping successful: #${i}`)):(o.push({channel:i,success:!1}),console.error(`[Discord] ❌ Ping failed: #${i} — HTTP ${r.status}`))}catch(r){o.push({channel:i,success:!1}),console.error(`[Discord] ❌ Ping failed: #${i}:`,r)}await new Promise(r=>setTimeout(r,300))}const n=o.filter(i=>i.success).length;a(`✅ Webhooks: ${n}/${t.length} connected`,n===t.length?"success":"warn")}async function ie(e){await oe();try{await fetch(C.logs,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:"⚡ SYNC STARTED",description:`Starting inventory sync at ${new Date().toLocaleTimeString()}`,color:53247,fields:[{name:"📦 Listings Found",value:`${e} items`,inline:!0},{name:"🕐 Time",value:new Date().toLocaleTimeString(),inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync"}}]})})}catch(t){console.error("Sync started webhook failed:",t)}}async function se(){const e=E;e.completedAt=new Date().toISOString();const t=Math.round((new Date(e.completedAt).getTime()-new Date(e.startedAt).getTime())/1e3),o=t>60?`${Math.floor(t/60)}m ${t%60}s`:`${t}s`;try{await fetch(C.logs,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:e.totalErrors>0||e.totalFlagged>0?"⚠️ SYNC COMPLETE — Issues Found":"✅ SYNC COMPLETE — All Clear",description:[`**Pages scanned:** ${e.page}`,`**Duration:** ${o}`,`**Started:** ${new Date(e.startedAt).toLocaleTimeString()}`,`**Finished:** ${new Date(e.completedAt).toLocaleTimeString()}`].join(`
`),color:e.totalErrors>0||e.totalOutOfStock>0?16747520:65416,fields:[{name:"📊 Full Results",value:[`📦 **Total Checked:** ${e.totalChecked}`,`💰 **Prices Updated:** ${e.totalUpdated}`,`🚫 **Out of Stock:** ${e.totalOutOfStock}`,`⚠️ **Flagged Items:** ${e.totalFlagged}`,`❌ **Errors:** ${e.totalErrors}`,`⚪ **No ASIN:** ${e.totalNoAsin}`].join(`
`),inline:!1},...e.outOfStockItems.length>0?[{name:`🚫 Out of Stock Items (${e.outOfStockItems.length})`,value:e.outOfStockItems.slice(0,10).map(n=>`• \`${n.asin}\` — ${n.title.substring(0,35)}${n.variantLabel?` [${n.variantLabel}]`:""}
  [eBay](https://www.ebay.com/itm/${n.listingId}) | [Amazon](https://www.amazon.com/dp/${n.asin}?th=1&psc=1)`).join(`
`)||"None",inline:!1}]:[],...e.priceUpdatedItems.length>0?[{name:`💰 Price Updates (${e.priceUpdatedItems.length})`,value:e.priceUpdatedItems.slice(0,8).map(n=>`• ${n.direction==="up"?"📈":"📉"} ${n.title.substring(0,35)}
  Amazon: $${n.amazonPrice.toFixed(2)} | eBay: $${n.oldPrice.toFixed(2)} → $${n.newPrice.toFixed(2)}`).join(`
`)||"None",inline:!1}]:[],...e.flaggedItems.length>0?[{name:`🚨 Flagged — Possible Product Changes (${e.flaggedItems.length})`,value:e.flaggedItems.slice(0,5).map(n=>`• \`${n.asin}\` — ${n.title.substring(0,35)}
  Signals: ${n.signals.join(", ")}`).join(`
`)||"None",inline:!1}]:[],...e.noAsinItems.length>0?[{name:`⚪ Items Without ASIN (${e.noAsinItems.length})`,value:e.noAsinItems.slice(0,5).map(n=>`• ${n.title.substring(0,40)} | SKU: \`${n.rawSku||"empty"}\`
  [View eBay](https://www.ebay.com/itm/${n.listingId})`).join(`
`)||"None",inline:!1}]:[]],timestamp:new Date().toISOString(),footer:{text:`Syndrax Sync | ${e.totalChecked} items processed`}}]})})}catch(n){console.error("Sync completion webhook failed:",n)}if(e.outOfStockItems.length>0)try{await fetch(C.outOfStock,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax StockBot",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:`🚫 ${e.outOfStockItems.length} Item${e.outOfStockItems.length>1?"s":""} Out of Stock — eBay Quantities Set to 0`,description:`Sync run at ${new Date(e.completedAt).toLocaleTimeString()} detected these items unavailable on Amazon. eBay quantities have been automatically set to 0 to prevent orders.`,color:16727357,fields:e.outOfStockItems.slice(0,5).map(n=>({name:`❌ ${n.title.substring(0,50)}`,value:[`**ASIN:** \`${n.asin}\``,`**Variant:** ${n.variantLabel||"Single variant"}`,`**eBay:** [View Listing](https://www.ebay.com/itm/${n.listingId})`,`**Amazon:** [View Source](https://www.amazon.com/dp/${n.asin}?th=1&psc=1)`,"**Action:** Qty set to 0 — relist when back in stock"].join(`
`),inline:!1})),timestamp:new Date().toISOString(),footer:{text:"Syndrax StockBot — Auto Stock Monitor"}}]})})}catch(n){console.error("Out of stock webhook failed:",n)}if(e.priceUpdatedItems.length>0)try{await fetch(C.priceUpdates,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax PriceBot",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:`💰 ${e.priceUpdatedItems.length} Price Update${e.priceUpdatedItems.length>1?"s":""} Applied`,description:`Automatic price updates from sync run at ${new Date(e.completedAt).toLocaleTimeString()}. All prices recalculated at 100% markup over Amazon cost.`,color:53247,fields:[{name:"📊 Price Change Summary",value:[`📈 **Increased:** ${e.priceUpdatedItems.filter(n=>n.direction==="up").length} items`,`📉 **Decreased:** ${e.priceUpdatedItems.filter(n=>n.direction==="down").length} items`,`💵 **Total Revenue Impact:** ${e.priceUpdatedItems.reduce((n,i)=>n+(i.newPrice-i.oldPrice),0)>0?"+":""}$${e.priceUpdatedItems.reduce((n,i)=>n+(i.newPrice-i.oldPrice),0).toFixed(2)}`].join(`
`),inline:!1},...e.priceUpdatedItems.slice(0,10).map(n=>({name:`${n.direction==="up"?"📈":"📉"} ${n.title.substring(0,45)}`,value:[`**Amazon:** $${n.amazonPrice.toFixed(2)} (source)`,`**eBay was:** $${n.oldPrice.toFixed(2)}`,`**eBay now:** $${n.newPrice.toFixed(2)} (100% markup)`,`**Change:** ${n.direction==="up"?"+":""}$${(n.newPrice-n.oldPrice).toFixed(2)}`,`[View eBay Listing](https://www.ebay.com/itm/${n.listingId})`].join(`
`),inline:!0}))],timestamp:new Date().toISOString(),footer:{text:"Syndrax PriceBot — Auto Price Sync"}}]})})}catch(n){console.error("Price updates webhook failed:",n)}if(e.flaggedItems.length>0||e.errorItems.length>0||e.noAsinItems.length>0)try{await fetch(C.errors,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Alert System",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:`🚨 Sync Alert Report — ${e.flaggedItems.length+e.errorItems.length+e.noAsinItems.length} Issues Found`,description:`Issues detected during sync run at ${new Date(e.completedAt).toLocaleTimeString()}. Manual review required for flagged items.`,color:16711680,fields:[{name:"⚡ Issue Summary",value:[`🚨 **Product Changed (Fingerprint):** ${e.flaggedItems.length}`,`❌ **Scrape Errors:** ${e.errorItems.length}`,`⚪ **No ASIN Found:** ${e.noAsinItems.length}`].join(`
`),inline:!1},...e.flaggedItems.slice(0,5).map(n=>({name:`🚨 FLAGGED — ${n.title.substring(0,45)}`,value:[`**ASIN:** \`${n.asin}\``,`**Why flagged:** ${n.signals.join(", ")}`,"**eBay qty set to 0** — verify product before relisting",`[eBay](https://www.ebay.com/itm/${n.listingId}) | [Amazon](https://www.amazon.com/dp/${n.asin}?th=1&psc=1)`].join(`
`),inline:!1})),...e.noAsinItems.slice(0,5).map(n=>({name:`⚪ NO ASIN — ${n.title.substring(0,45)}`,value:[`**Listing ID:** ${n.listingId}`,`**Raw SKU:** \`${n.rawSku||"empty"}\``,"**Fix:** Add Amazon ASIN to eBay custom label field",`[View eBay Listing](https://www.ebay.com/itm/${n.listingId})`].join(`
`),inline:!1})),...e.errorItems.slice(0,5).map(n=>({name:`❌ ERROR — ${n.title.substring(0,45)}`,value:[`**Listing ID:** ${n.listingId}`,`**Error:** ${n.error.substring(0,150)}`].join(`
`),inline:!1}))],timestamp:new Date().toISOString(),footer:{text:"Syndrax Alert System — Manual review required"}}]})})}catch(n){console.error("Errors webhook failed:",n)}console.log("[Sync] All Discord webhooks sent")}let q=0;const s={pageNum:1,totalChecked:0,totalUpdated:0,totalOutOfStock:0,totalFlagged:0,totalNoChange:0,totalRestocked:0};let k=!1,$=!1,W=[];async function ae(){const e=document.getElementById("syndrax-log");e&&(W=Array.from(e.children).slice(-30).map(o=>o.textContent||""));const t={isRunning:!0,pageNum:s.pageNum,totalChecked:s.totalChecked,totalUpdated:s.totalUpdated,totalOutOfStock:s.totalOutOfStock,totalFlagged:s.totalFlagged,totalNoChange:s.totalNoChange,totalRestocked:s.totalRestocked,startTime:Date.now(),logMessages:W};await chrome.storage.local.set({syncState:t}),console.log("[Sync] Saved state before navigation:",t)}async function re(){return(await chrome.storage.local.get("syncState")).syncState||null}async function K(){await chrome.storage.local.remove("syncState")}function b(e){return new Promise(t=>setTimeout(t,e))}async function T(e=15e3){const t=Date.now();for(;Date.now()-t<e;){const o=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(o.length>0)return console.log(`[Sync] Found ${o.length} rows after ${Date.now()-t}ms`),o;await b(500)}return console.log("[Sync] Timeout waiting for rows"),[]}function a(e,t="info"){const o=document.getElementById("syndrax-log");if(o){const n={info:"#00CFFF",success:"#22c55e",error:"#ef4444",warn:"#FFD700"},i=new Date().toLocaleTimeString(),r=document.createElement("div");for(r.style.cssText=`
      font-size: 10px;
      color: ${n[t]};
      margin-bottom: 2px;
      word-break: break-all;
    `,r.textContent=`[${i}] ${e}`,o.appendChild(r),o.scrollTop=o.scrollHeight;o.children.length>50;)o.removeChild(o.firstChild)}console.log(`[Sync ${t}]`,e)}function O(e){const t=document.getElementById("syndrax-status");t&&(t.textContent=e,t.style.color="#00CFFF");const o=document.getElementById("syndrax-loading-msg");o&&(o.textContent=e),a(e,"info")}function le(e){if(!e)return"";try{const o=atob(e.trim());if(/^[A-Z0-9]{10}$/i.test(o))return o.toUpperCase()}catch{}if(/^[A-Z0-9]{10}$/i.test(e.trim()))return e.trim().toUpperCase();const t=e.match(/[A-Z0-9]{10}/i);return t?t[0].toUpperCase():""}function ce(e){var g,u;const t=e.getAttribute("data-id")||"";if(!t)return null;const o=e.querySelector(".shui-dt-column__title a")||e.querySelector(".column-title__text a")||e.querySelector('[data-test-id="item-title"]'),n=((g=o==null?void 0:o.textContent)==null?void 0:g.trim())||"",i=e.querySelector(".shui-dt-column__price")||e.querySelector(".col-price__current"),d=((i==null?void 0:i.textContent)||"").match(/\$([0-9,]+\.?[0-9]*)/),l=d?parseFloat(d[1].replace(",","")):0,y=e.querySelector(".shui-dt-column__listingSKU")||e.querySelector('[data-test-id="listing-sku"]'),m=((u=y==null?void 0:y.textContent)==null?void 0:u.trim())||"",f=le(m);return console.log(`[Sync] Row ${t}: "${n.substring(0,30)}..." Price: $${l} SKU: ${m} ASIN: ${f}`),{listingId:t,title:n,price:l,rawSku:m,asin:f,row:e}}function de(e){var n;const t=e.querySelector('input[name*="availableQuantity"]');if(t)return parseInt(t.value)||0;const o=e.querySelector(".shui-dt-column__availableQuantity");if(o){const r=(((n=o.textContent)==null?void 0:n.trim())||"").match(/\d+/);if(r)return parseInt(r[0])||0}return 1}async function ue(e,t){var f,g;const o=e,n=o.querySelector('button[aria-label="Edit Current price"]')||o.querySelector('button[column="price"]');if(!n)return console.log("[Sync Debug] Edit price button not found"),a("  ❌ Edit price button not found","error"),!1;a("  📝 Clicking Edit Price...","info"),n.click(),await b(1200);let i=null;const r=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"]');console.log("[Sync Debug] Found price dialogs:",r.length);for(const u of r){const c=u.querySelector('input[name*="price"]')||u.querySelector('input[aria-label*="price" i]')||u.querySelector("input.textbox__control");if(c){i=c,console.log("[Sync Debug] Found price input:",c.name||c.className);break}}if(i||(i=document.querySelector('input[name*="price"]')||document.querySelector("input.textbox__control")),!i)return a("  ❌ Price input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const d=t.toFixed(2);if(a(`  ✏️ Setting price to $${d}...`,"info"),i.focus(),await b(100),i.select(),await b(100),i.setSelectionRange(0,i.value.length),document.execCommand("insertText",!1,d),await b(100),i.value!==d){const u=(f=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:f.set;u&&u.call(i,d),i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0}))}i.value!==d&&(i.value=d,i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0}))),console.log("[Sync Debug] Price input value after setting:",i.value),await b(300),a("  💾 Submitting price...","info");let l=null;const y=document.querySelectorAll("button");for(const u of y)if((((g=u.textContent)==null?void 0:g.trim().toLowerCase())||"")==="submit"){l=u,console.log("[Sync Debug] Found price Submit button with text:",u.className);break}if(l||(l=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),l){console.log("[Sync Debug] Clicking price Submit button");const u=l.closest("form");u&&u.addEventListener("submit",c=>{c.preventDefault()},{once:!0}),l.focus(),await b(100),l.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window}))}else return console.log("[Sync Debug] Price Submit button not found"),a("  ⚠️ Could not find Submit button for price","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await b(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(a("  ⚠️ Price dialog still open","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(a(`  ✅ Price updated to $${d}!`,"success"),!0)}async function j(e,t){var f,g,u;const o=e,n=o.querySelector('button[aria-label="Edit Available quantity"]');if(!n)return o.querySelector('[data-test-id="variation-count"]')||((f=o.textContent)==null?void 0:f.includes("variation"))?(a("  ⚠️ Has variations - skip inline edit","warn"),!1):(a("  ❌ Edit button not found","error"),!1);if(n.disabled||n.getAttribute("aria-disabled")==="true")return a("  ⚠️ Edit disabled - item may be locked","warn"),!1;a("  📝 Clicking Edit...","info"),n.click(),await b(1200);let i=null;const r=document.querySelectorAll('[role="dialog"], .lightbox-dialog, [class*="dialog"], [class*="modal"]');console.log("[Sync Debug] Found dialogs:",r.length);for(const c of r){const h=c.querySelector('input[type="text"], input.textbox__control, input');if(h){i=h,console.log("[Sync Debug] Found input in dialog:",h.className);break}}if(i||(i=document.querySelector("input.textbox__control:focus")||document.querySelector('input[aria-label*="quantity" i]')||document.querySelector("input.textbox__control")),!i)return a("  ❌ Input not found","error"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;if(a(`  ✏️ Setting to ${t}...`,"info"),i.focus(),await b(100),i.select(),i.setSelectionRange(0,i.value.length),await b(100),document.execCommand("insertText",!1,t.toString()),await b(100),i.value!==t.toString()){const c=(g=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value"))==null?void 0:g.set;c&&c.call(i,t.toString()),i.dispatchEvent(new Event("input",{bubbles:!0,cancelable:!0})),i.dispatchEvent(new Event("change",{bubbles:!0,cancelable:!0})),i.dispatchEvent(new InputEvent("input",{bubbles:!0,data:t.toString(),inputType:"insertText"}))}if(await b(100),i.value!==t.toString()){i.focus(),i.select();for(let h=0;h<5;h++)i.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0})),i.dispatchEvent(new KeyboardEvent("keyup",{key:"Backspace",code:"Backspace",keyCode:8,bubbles:!0}));const c=t.toString();i.dispatchEvent(new KeyboardEvent("keydown",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),i.dispatchEvent(new KeyboardEvent("keypress",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),i.dispatchEvent(new InputEvent("input",{bubbles:!0,data:c,inputType:"insertText"})),i.dispatchEvent(new KeyboardEvent("keyup",{key:c,code:`Digit${c}`,keyCode:48+parseInt(c),bubbles:!0})),i.value=t.toString(),i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0}))}console.log("[Sync Debug] Input value after setting:",i.value),await b(300),a("  💾 Finding Submit button...","info");const d=document.querySelectorAll('.lightbox-dialog, [role="dialog"], .quick-edit-modal');console.log("[Sync Debug] Open dialogs:",d.length);let l=null;const y=document.querySelectorAll("button");for(const c of y)if((((u=c.textContent)==null?void 0:u.trim().toLowerCase())||"")==="submit"){l=c,console.log('[Sync Debug] Found button with text "Submit":',c.className);break}if(l||(l=document.querySelector('button.btn--primary[type="submit"]')||document.querySelector('button[type="submit"].btn--primary')||document.querySelector('.lightbox-dialog__main button[type="submit"]')||document.querySelector('form button[type="submit"]')),l){console.log("[Sync Debug] Clicking Submit button:",l.outerHTML.substring(0,100));const c=l.closest("form");c&&c.addEventListener("submit",h=>{h.preventDefault()},{once:!0}),l.focus(),await b(100),l.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window})),console.log("[Sync Debug] Clicked Submit button")}else return console.log("[Sync Debug] Submit button not found"),a("  ⚠️ Could not find Submit button","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;return await b(1500),document.querySelector('.lightbox-dialog__window:not([aria-hidden="true"])')?(a("  ⚠️ Dialog still open - may need manual submit","warn"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1):(a("  ✅ Updated!","success"),!0)}function v(e,t,o){const n=e,i=n.querySelector(".syndrax-badge");i&&i.remove();const r=document.createElement("span");r.className="syndrax-badge",r.textContent=t,r.style.cssText=`
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: ${o}22;
    border: 1px solid ${o};
    color: ${o};
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    z-index: 9999;
    white-space: nowrap;
  `,n.style.position="relative",n.appendChild(r)}async function ge(e,t){const o="https://discord.com/api/webhooks/1503288142210404355/X9iDEyw858yJpfrMvhY-8-onXKe_v4UXeEyFZIVfMJw3lBwAVyaM6iRoJzp3KzCW_vS-",n=[...e.reasons.map((i,r)=>({name:`${e.action==="delist"?"🔴":"⚠️"} ${e.signals[r]} (+${w[e.signals[r]]||0} pts)`,value:i,inline:!1})),{name:"📊 Total Score",value:`${e.score} pts`,inline:!0},{name:"🏪 eBay",value:`[View Listing](https://www.ebay.com/itm/${t.listingId})`,inline:!0},{name:"🛒 Amazon",value:`[View on Amazon](https://www.amazon.com/dp/${t.asin})`,inline:!0},{name:"⚡ Action Taken",value:"eBay quantity set to 0. Listing stays active but cannot receive orders. Review and manually reinstate when confirmed safe.",inline:!1}];try{await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax Sync",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:e.action==="delist"?"🚨 CRITICAL — Product Changed — Quantity Set to 0":"⚠️ WARNING — Suspicious Changes — Quantity Set to 0",description:`**${t.title.substring(0,80)}**
ASIN: \`${t.asin}\` | Listing: \`${t.listingId}\``,color:e.action==="delist"?16711680:16747520,fields:n,timestamp:new Date().toISOString(),footer:{text:"Syndrax Sync — Fingerprint Check"}}]})})}catch(i){console.error("Fingerprint webhook failed:",i)}}async function V(e,t){var l,y,m,f;const o=e.row,n=de(e.row),i=e.title.substring(0,25);if(t.title&&t.brand!==void 0){const g=await te({listingId:e.listingId,title:e.title,asin:e.asin},{title:t.title||"",price:t.amazonPrice||0,brand:t.brand||"",imageUrl:t.imageUrl||"",imageCount:t.imageCount||0,category:t.category||"",dimensions:t.dimensions||"",weight:t.weight||"",reviewCount:t.reviewCount||0,starRating:t.starRating||0,bullets:t.bullets||[],finalAsin:t.finalAsin||e.asin});if(g.action==="delist"||g.action==="flag"){a(`🔍 Fingerprint: ${g.action.toUpperCase()} (${g.score}pts)`,g.action==="delist"?"error":"warn");const u=o.querySelector(".shui-dt-column__availableQuantity");if(u){u.click(),await b(500);const c=u.querySelector("input");c&&(c.value="0",c.dispatchEvent(new Event("input",{bubbles:!0})),c.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",keyCode:13,bubbles:!0})),await b(500))}await ge(g,e),o.style.outline=`2px solid ${g.action==="delist"?"#FF0000":"#FF8C00"}`,v(o,`${g.action==="delist"?"🚨":"⚠️"} ${g.score}pts — Qty Set to 0`,g.action==="delist"?"#FF0000":"#FF8C00"),s.totalFlagged++,s.totalChecked++,A();return}g.action==="baseline"&&(v(o,"📸 Baseline Saved","#00CFFF"),a(`📸 ${i}... → Baseline captured`,"info"))}o.style.outline="2px solid #00CFFF",o.style.background="rgba(0, 207, 255, 0.05)";const r=t.amazonPrice?`$${t.amazonPrice.toFixed(2)}`:"N/A",d=`$${e.price.toFixed(2)}`;switch(a(`${e.asin}: ${t.action}`,"info"),a(`  eBay: qty=${n} price=${d} | Amazon: ${r}`,"info"),t.action){case"WRONG_ITEM":s.totalFlagged++,o.style.outline="2px solid #FF8C00",o.style.background="rgba(255, 140, 0, 0.08)",v(o,`⚠ Wrong Item (${Math.round((t.similarity||0)*100)}%)`,"#FF8C00"),a(`⚠ ${i}... → Wrong item match`,"warn");break;case"OUT_OF_STOCK":if(n>0){a(`🔴 ${i}... → OOS! Needs qty 0`,"error");const g=await j(e.row,0);if(s.totalOutOfStock++,g){s.totalUpdated++,a("✓ Quantity updated to 0","success"),E.totalOutOfStock++,E.outOfStockItems.push({title:e.title,listingId:e.listingId,asin:e.asin,variantLabel:void 0});try{await fetch(C.outOfStock,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax StockBot",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:"🚫 OUT OF STOCK — eBay Set to 0",description:`**${e.title.substring(0,60)}**`,color:16727357,fields:[{name:"ASIN",value:`\`${e.asin}\``,inline:!0},{name:"eBay Price",value:`$${e.price.toFixed(2)}`,inline:!0},{name:"eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0},{name:"Amazon",value:`[View](https://www.amazon.com/dp/${e.asin}?th=1&psc=1)`,inline:!0},{name:"Action",value:"✅ Quantity set to 0",inline:!1}],timestamp:new Date().toISOString(),footer:{text:"Syndrax StockBot — Real-time Alert"}}]})})}catch(u){console.error("OOS webhook failed:",u)}}else a("⚠ Manual update needed","warn");o.style.outline="2px solid #FF3D3D",o.style.background="rgba(255, 61, 61, 0.08)",v(o,`✗ OOS (was ${n})`,"#FF3D3D")}else s.totalOutOfStock++,o.style.outline="2px solid #888",v(o,"✗ Already 0","#888"),a(`- ${i}... → Already 0`,"info");break;case"PRICE_UPDATED":case"NO_CHANGE":if(n===0)a(`💚 ${i}... → IN STOCK! Needs qty 1`,"success"),await j(e.row,1)?(s.totalUpdated++,s.totalRestocked++,a("✓ Restocked to 1","success")):a("⚠ Manual restock needed","warn"),o.style.outline="2px solid #00FF88",o.style.background="rgba(0, 255, 136, 0.08)",v(o,"↑ Restocked to 1","#00FF88");else if(t.action==="PRICE_UPDATED"&&t.newEbayPrice){const g=t.priceWentUp?"#FFD700":"#00FF88";if(o.style.outline=`2px solid ${g}`,o.style.background=t.priceWentUp?"rgba(255, 215, 0, 0.08)":"rgba(0, 255, 136, 0.08)",a(`💰 ${i}... → Price ${t.priceWentUp?"↑":"↓"} $${t.amazonPrice}→$${(l=t.newEbayPrice)==null?void 0:l.toFixed(2)}`,t.priceWentUp?"warn":"success"),await ue(e.row,t.newEbayPrice)){s.totalUpdated++,v(o,`${t.priceWentUp?"↑":"↓"} $${(y=t.newEbayPrice)==null?void 0:y.toFixed(2)} ✓`,g),a(`✓ Price updated to $${t.newEbayPrice.toFixed(2)}`,"success"),E.totalUpdated++,E.priceUpdatedItems.push({title:e.title,listingId:e.listingId,oldPrice:e.price,newPrice:t.newEbayPrice,amazonPrice:t.amazonPrice||0,direction:t.priceWentUp?"up":"down"});try{await fetch(C.priceUpdates,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"Syndrax PriceBot",avatar_url:"https://syndrax.io/assets/images/logo.png",embeds:[{title:t.priceWentUp?"📈 PRICE INCREASED":"📉 PRICE DECREASED",description:`**${e.title.substring(0,60)}**`,color:t.priceWentUp?16766720:65416,fields:[{name:"ASIN",value:`\`${e.asin}\``,inline:!0},{name:"Amazon Price",value:`$${(m=t.amazonPrice)==null?void 0:m.toFixed(2)}`,inline:!0},{name:"Old eBay Price",value:`$${e.price.toFixed(2)}`,inline:!0},{name:"New eBay Price",value:`**$${t.newEbayPrice.toFixed(2)}**`,inline:!0},{name:"Change",value:`${t.priceWentUp?"+":""}$${(t.newEbayPrice-e.price).toFixed(2)}`,inline:!0},{name:"eBay",value:`[View](https://www.ebay.com/itm/${e.listingId})`,inline:!0}],timestamp:new Date().toISOString(),footer:{text:"Syndrax PriceBot — Real-time Alert"}}]})})}catch(c){console.error("Price webhook failed:",c)}}else v(o,`${t.priceWentUp?"↑":"↓"} $${(f=t.newEbayPrice)==null?void 0:f.toFixed(2)} ⚠`,g),a("⚠ Manual price update needed","warn")}else s.totalNoChange++,o.style.outline="2px solid #22c55e",o.style.background="rgba(34, 197, 94, 0.03)",v(o,"✓ OK","#22c55e"),a(`✓ ${i}... → OK ($${t.amazonPrice})`,"success"),setTimeout(()=>{o.style.outline="",o.style.background=""},2e3);break;case"ERROR":case"SOURCE_NOT_FOUND":s.totalFlagged++,o.style.outline="2px solid #888",v(o,"? Error","#888"),a(`? ${i}... → ${t.action}`,"error");break}s.totalChecked++,A()}async function P(){var t;if(k){a("⚠ Sync already running!","warn");return}if(k=!0,s.totalChecked>0)a(`🚀 Continuing sync on page ${s.pageNum}...`,"success");else{const o=document.getElementById("syndrax-log");o&&(o.innerHTML=""),a("🚀 Starting sync...","success"),s.pageNum=1,s.totalChecked=0,s.totalUpdated=0,s.totalOutOfStock=0,s.totalFlagged=0,s.totalNoChange=0,q=document.querySelectorAll("tr.grid-row[data-id]").length,ne(),await ie(q)}for(chrome.runtime.sendMessage({type:"SYNC_STARTED",payload:{pageNum:s.pageNum},timestamp:Date.now()});!$;){console.log(`[Sync] Processing page ${s.pageNum}`),await b(1e3);const o=Array.from(document.querySelectorAll("tr.grid-row[data-id]"));if(console.log(`[Sync] Found ${o.length} rows on page ${s.pageNum}`),o.length===0){console.log("[Sync] No rows found, stopping");break}for(let u=0;u<o.length;u+=3){if($){a("⏹️ Sync stopped by user","warn");break}const c=o.slice(u,u+3),h=[];for(const p of c){const x=ce(p);x&&h.push(x)}const S=h.filter(p=>p.asin);if(S.length===0){console.log(`[Sync] No valid ASINs in batch ${u/3+1}, skipping`),s.totalFlagged+=h.length,s.totalChecked+=h.length;for(const p of h)if(!p.asin){const x=p.row;x.style.outline="2px solid #888",v(x,"⚠ No ASIN","#888")}continue}console.log(`[Sync] Checking ${S.length} items with ASINs...`),O(`Checking batch ${Math.floor(u/3)+1}...`);const I=S.map(p=>({listingId:p.listingId,title:p.title,price:p.price,asin:p.asin,amazonUrl:`https://www.amazon.com/dp/${p.asin}`})),F=I.map(p=>p.asin).join(", ");a(`📦 Batch ASINs: ${F}`,"info"),console.log("[Sync] Sending to background:",I.map(p=>p.asin)),a(`🌐 Opening ${S.length} Amazon tabs...`,"info");try{const p=await chrome.runtime.sendMessage({type:"CHECK_AMAZON_BATCH",payload:{items:I},timestamp:Date.now()});if(console.log("[Sync] Response from background:",p),p!=null&&p.results){O(`Processing ${p.results.length} results...`);for(let x=0;x<p.results.length;x++){const U=S[x],B=p.results[x];console.log(`[Sync] Result for ${U.asin}:`,B),await V(U,B)}}else console.error("[Sync] No results in response:",p),O("Error: No response from Amazon check")}catch(p){console.error("[Sync] Error checking Amazon:",p),O(`Error: ${p.message}`);for(const x of S)await V(x,{action:"ERROR"})}chrome.runtime.sendMessage({type:"SYNC_PROGRESS",payload:{pageNum:s.pageNum,checked:s.totalChecked,updated:s.totalUpdated,outOfStock:s.totalOutOfStock,flagged:s.totalFlagged,noChange:s.totalNoChange},timestamp:Date.now()}),await b(3e3)}const n=new URL(window.location.href),i=parseInt(n.searchParams.get("offset")||"0"),r=o.length;parseInt(n.searchParams.get("limit")||r.toString());const d=i+r,l=document.querySelector('button[aria-label="Go to next page"]')||document.querySelector(".pagination__next:not([disabled])")||document.querySelector('a[rel="next"]'),m=(((t=document.querySelector(".pagination-results, .shui-pagination-status"))==null?void 0:t.textContent)||"").match(/of\s+([\d,]+)/i),f=m?parseInt(m[1].replace(",","")):0;if(!(l!==null||f>0&&i+r<f)){console.log("[Sync] Last page reached - no more pages to process"),a("📄 Last page - no Next button found","info");break}console.log(`[Sync] Going to next page: offset ${i} → ${d}`),a(`📄 Going to page ${s.pageNum+1}...`,"info"),s.pageNum++,await ae(),D=!0,n.searchParams.set("offset",d.toString()),window.location.href=n.toString();return}k=!1,a(`✅ COMPLETE! Checked: ${s.totalChecked}, OOS: ${s.totalOutOfStock}`,"success"),console.log("[Sync] Complete!",s),E.totalChecked=s.totalChecked,E.totalNoChange=s.totalNoChange,E.totalFlagged=s.totalFlagged,E.page=s.pageNum,await se(),chrome.runtime.sendMessage({type:"SYNC_COMPLETE",payload:{totalPages:s.pageNum,totalChecked:s.totalChecked,totalUpdated:s.totalUpdated,totalOutOfStock:s.totalOutOfStock,totalFlagged:s.totalFlagged,totalNoChange:s.totalNoChange},timestamp:Date.now()})}function pe(){const e=document.getElementById("syndrax-control-panel");e&&e.remove();const t=document.createElement("div");t.id="syndrax-control-panel",t.innerHTML=`
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
  `,document.body.appendChild(t);const o=document.getElementById("syndrax-run"),n=document.getElementById("syndrax-stop"),i=document.getElementById("syndrax-minimize"),r=document.getElementById("syndrax-content");o==null||o.addEventListener("click",async()=>{if(k)return;$=!1,o.textContent="⏳ Running...",o.style.display="none",n.style.display="block",_(),await P();const l=document.getElementById("syndrax-big-stats");l&&l.remove(),n.style.display="none",o.style.display="block",o.textContent="✓ Complete",$=!1,setTimeout(()=>{o.textContent="▶ Run Sync"},3e3)}),n==null||n.addEventListener("click",()=>{$=!0,n.textContent="⏹ Stopping...",a("⏹️ Stop requested...","warn")}),i==null||i.addEventListener("click",()=>{if(r){const l=r.style.display==="none";r.style.display=l?"block":"none",i.textContent=l?"−":"+"}});const d=document.getElementById("syndrax-copy");d==null||d.addEventListener("click",()=>{const l=document.getElementById("syndrax-log");if(l){const y=l.innerText;navigator.clipboard.writeText(y).then(()=>{d.textContent="✓ Copied!",setTimeout(()=>{d.textContent="📋 Copy"},2e3)}).catch(()=>{const m=document.createElement("textarea");m.value=y,document.body.appendChild(m),m.select(),document.execCommand("copy"),document.body.removeChild(m),d.textContent="✓ Copied!",setTimeout(()=>{d.textContent="📋 Copy"},2e3)})}})}function _(){const e=document.getElementById("syndrax-big-stats");e&&e.remove();const t=document.createElement("div");t.id="syndrax-big-stats",t.innerHTML=`
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
  `,document.body.appendChild(t)}function A(){const e=document.getElementById("stat-checked"),t=document.getElementById("stat-updated"),o=document.getElementById("stat-oos"),n=document.getElementById("syndrax-status");e&&(e.textContent=s.totalChecked.toString()),t&&(t.textContent=s.totalUpdated.toString()),o&&(o.textContent=s.totalOutOfStock.toString()),n&&k&&(n.textContent=`Page ${s.pageNum} | ${s.totalFlagged} flagged | ${s.totalNoChange} unchanged`);const i=document.getElementById("big-page"),r=document.getElementById("big-checked"),d=document.getElementById("big-updated"),l=document.getElementById("big-oos"),y=document.getElementById("big-restocked"),m=document.getElementById("big-ok");i&&(i.textContent=s.pageNum.toString()),r&&(r.textContent=s.totalChecked.toString()),d&&(d.textContent=s.totalUpdated.toString()),l&&(l.textContent=s.totalOutOfStock.toString()),y&&(y.textContent=s.totalRestocked.toString()),m&&(m.textContent=s.totalNoChange.toString())}chrome.runtime.onMessage.addListener(e=>{e.type==="SYNC_PROGRESS"&&A()});function ye(){const e=document.getElementById("syndrax-control-panel");if(e){let t=document.getElementById("syndrax-error-badge");if(!t){t=document.createElement("div"),t.id="syndrax-error-badge",t.style.cssText=`
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
      `,t.textContent="⚠️";const o=document.createElement("style");o.textContent=`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `,document.head.appendChild(o);const n=e.querySelector("div");n&&(n.style.position="relative",n.appendChild(t))}}}async function N(e){console.log("[Syndrax Sync] 🚨 EMERGENCY RESUME - Normal resume failed, auto-clicking Run button"),ye(),a("🚨 Resume failed! Emergency auto-start...","error"),s.pageNum=e.pageNum,s.totalChecked=e.totalChecked,s.totalUpdated=e.totalUpdated,s.totalOutOfStock=e.totalOutOfStock,s.totalFlagged=e.totalFlagged,s.totalNoChange=e.totalNoChange,s.totalRestocked=e.totalRestocked||0,A(),await T(1e4);const t=document.getElementById("syndrax-run");t?(console.log("[Syndrax Sync] Clicking Run button as fallback"),t.click()):a("❌ Could not find Run button!","error")}let D=!1;function me(){window.addEventListener("beforeunload",e=>{if(D){console.log("[Syndrax Sync] ✅ Allowing intentional navigation");return}k&&!D&&console.log("[Syndrax Sync] 🛑 Warning user - sync in progress")}),document.addEventListener("click",e=>{const o=e.target.closest("a");if(o&&o.href&&(o.href.includes("/n/all-categories")||o.href.includes("_nkw=")||o.href.includes("/sch/")&&!o.href.includes("/sh/")))return console.log("[Syndrax Sync] 🛑 Blocked bad navigation:",o.href),e.preventDefault(),e.stopPropagation(),!1},!0),document.addEventListener("submit",e=>{const t=e.target;if(t.action&&(t.action.includes("/n/all-categories")||t.action.includes("_nkw=")||t.action.includes("/sch/")))return console.log("[Syndrax Sync] 🛑 Blocked bad form submission:",t.action),e.preventDefault(),e.stopPropagation(),!1},!0)}async function Y(){const e=window.location.href;if(console.log("[Syndrax Sync] Checking URL:",e),e.includes("/n/all-categories")||e.includes("_nkw=")&&!e.includes("/sh/lst")){console.log("[Syndrax Sync] 🚨 EMERGENCY: On bad page! Redirecting back to listings..."),window.location.href="https://www.ebay.com/sh/lst/active";return}if(!(e.includes("ebay.com/sh/lst")||e.includes("ebay.com/mys/active")||e.includes("ebay.com/sh/lst/active")||e.includes("ebay.com/sh/lst?")||e.includes("/sh/lst"))){console.log("[Syndrax Sync] Not a listings page, skipping");return}console.log("[Syndrax Sync] eBay Active Listings page detected!"),me(),pe(),console.log("[Syndrax Sync] Checking for saved state...");let o=null;try{o=await re(),console.log("[Syndrax Sync] Loaded state:",o)}catch(r){console.error("[Syndrax Sync] Error loading state:",r),a(`❌ Error loading state: ${r}`,"error")}if(!o||!o.isRunning){console.log("[Syndrax Sync] No running state - auto-starting fresh sync..."),a("🚀 Auto-starting sync...","success"),a("⏳ Waiting for table...","info");const r=await T(15e3);if(r.length===0){a("⚠️ No table found after 15s","warn");return}a(`✅ Found ${r.length} items, starting...`,"success"),_(),await P();const d=document.getElementById("syndrax-big-stats");d&&d.remove(),a("✅ Sync complete!","success");const l=document.getElementById("syndrax-loading-msg");l&&(l.textContent="Complete!");return}const n=Date.now()-o.startTime;if(console.log("[Syndrax Sync] Time since save:",n,"ms"),n>=5*60*1e3){console.log("[Syndrax Sync] Saved state too old, clearing"),await K();return}console.log("[Syndrax Sync] Attempting to resume from saved state:",o);const i=setTimeout(()=>{console.error("[Syndrax Sync] ⚠️ Resume timeout! Triggering emergency fallback"),N(o)},3e4);try{s.pageNum=o.pageNum,s.totalChecked=o.totalChecked,s.totalUpdated=o.totalUpdated,s.totalOutOfStock=o.totalOutOfStock,s.totalFlagged=o.totalFlagged,s.totalNoChange=o.totalNoChange,s.totalRestocked=o.totalRestocked||0;const r=document.getElementById("syndrax-log");if(r&&o.logMessages&&o.logMessages.length>0){r.innerHTML="";for(const m of o.logMessages){const f=document.createElement("div");f.style.cssText="font-size: 10px; color: #888; margin-bottom: 2px;",f.textContent=m,r.appendChild(f)}}A(),a(`📄 Resumed on page ${s.pageNum}`,"success"),_(),a("⏳ Waiting for table to load...","info");const d=await T(15e3);if(d.length===0){a("⚠️ Table not loaded after 15s, trying emergency...","warn"),clearTimeout(i),await N(o);return}a(`✅ Found ${d.length} rows, continuing sync...`,"success");const l=document.getElementById("syndrax-run"),y=document.getElementById("syndrax-stop");l&&(l.style.display="none"),y&&(y.style.display="block"),clearTimeout(i),await P(),y&&(y.style.display="none"),l&&(l.style.display="block",l.textContent="✓ Complete",setTimeout(()=>{l.textContent="▶ Run Sync"},3e3)),await K()}catch(r){console.error("[Syndrax Sync] Error in resume:",r),a(`❌ Resume error: ${r}`,"error"),clearTimeout(i),await N(o)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Y):Y();
})()
