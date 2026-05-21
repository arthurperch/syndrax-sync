let I=0;const N=5;let a=null;function b(){var e,o;(e=document.getElementById("syndrax-automation-status"))==null||e.remove(),(o=document.getElementById("syndrax-highlight"))==null||o.remove(),a=document.createElement("div"),a.id="syndrax-automation-status",a.style.cssText=`
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.95);
        color: #00ff00;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        min-width: 350px;
        max-width: 450px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 2px solid #00ff00;
    `,a.innerHTML=`
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #00ff00;">
            🤖 Syndrax Automation
        </div>
        <div id="syndrax-step-status" style="line-height: 1.5;">
            Initializing...
        </div>
    `,document.body.appendChild(a)}function f(e,o,t=!1){document.getElementById("syndrax-automation-status")||b();const n=document.getElementById("syndrax-step-status");if(n){const r=t?"#ff4444":"#00ff00";n.innerHTML=`
            <div style="color: ${r};">
                <strong>Step ${e}:</strong> ${o}
            </div>
        `}console.log(`[Step ${e}] ${o}`)}function P(e){a||b(),a&&(a.style.borderColor="#f59e0b",a.innerHTML=`
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #f59e0b;">
                📦 Address to Fill (from eBay order)
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin-bottom: 12px; line-height: 1.6;">
                <div><strong>Name:</strong> ${e.fullName||"⚠️ MISSING"}</div>
                <div><strong>Street:</strong> ${e.street||"⚠️ MISSING"}</div>
                ${e.street2?`<div><strong>Street 2:</strong> ${e.street2}</div>`:""}
                <div><strong>City:</strong> ${e.city||"⚠️ MISSING"}</div>
                <div><strong>State:</strong> ${e.state||"⚠️ MISSING"}</div>
                <div><strong>ZIP:</strong> ${e.zipCode||"⚠️ MISSING"}</div>
                <div><strong>Phone:</strong> ${e.phone||"Not provided"}</div>
            </div>
        `)}function O(e,o){var t;a||b(),a&&(a.style.borderColor="#22c55e",a.innerHTML=`
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #22c55e;">
                ✅ Address Form Filled - REVIEW REQUIRED
            </div>
            <div style="background: rgba(34,197,94,0.2); padding: 10px; border-radius: 6px; margin-bottom: 12px; line-height: 1.5; font-size: 11px;">
                <div><strong>Name:</strong> ${o.name||"❌ Not filled"}</div>
                <div><strong>Street:</strong> ${o.street||"❌ Not filled"}</div>
                <div><strong>City:</strong> ${o.city||"❌ Not filled"}</div>
                <div><strong>State:</strong> ${o.state||"❌ Not filled"}</div>
                <div><strong>ZIP:</strong> ${o.zip||"❌ Not filled"}</div>
                <div><strong>Phone:</strong> ${o.phone||"Skipped"}</div>
            </div>
            <div style="background: rgba(255,0,0,0.2); padding: 10px; border-radius: 6px; margin-bottom: 12px; color: #ff6b6b; font-weight: bold;">
                ⚠️ AUTOMATION STOPPED HERE ⚠️<br>
                Please review the filled address above.<br>
                If correct, manually click "Use this address" button.
            </div>
            <button id="syndrax-close-btn" style="
                width: 100%;
                padding: 10px;
                background: #22c55e;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 13px;
            ">OK - I'll Review & Continue Manually</button>
        `,(t=document.getElementById("syndrax-close-btn"))==null||t.addEventListener("click",async()=>{await S(!0),a==null||a.remove()}))}function u(e,o){var t,n;a||b(),a&&(a.style.borderColor="#ff4444",a.innerHTML=`
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #ff4444;">
                ❌ Step ${e} Failed
            </div>
            <div style="color: #ff4444; line-height: 1.5; margin-bottom: 10px;">
                ${o}
            </div>
            <button id="syndrax-retry-btn" style="
                padding: 8px 16px;
                background: #f59e0b;
                color: black;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                margin-right: 8px;
            ">Retry</button>
            <button id="syndrax-close-btn" style="
                padding: 8px 16px;
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            ">Cancel</button>
        `,(t=document.getElementById("syndrax-close-btn"))==null||t.addEventListener("click",async()=>{await S(),a==null||a.remove()}),(n=document.getElementById("syndrax-retry-btn"))==null||n.addEventListener("click",()=>{window.location.reload()}))}function k(e,o){const t=document.getElementById("syndrax-highlight");t&&t.remove();const n=e.getBoundingClientRect(),r=document.createElement("div");r.id="syndrax-highlight",r.style.cssText=`
        position: fixed;
        top: ${n.top-5}px;
        left: ${n.left-5}px;
        width: ${n.width+10}px;
        height: ${n.height+10}px;
        background: rgba(255, 0, 0, 0.2);
        border: 3px solid rgba(255, 0, 0, 0.8);
        border-radius: 4px;
        z-index: 999998;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
    `;const s=document.createElement("div");s.style.cssText=`
        position: absolute;
        top: -25px;
        left: 0;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-family: monospace;
    `,s.textContent=o,r.appendChild(s),document.body.appendChild(r),setTimeout(()=>r.remove(),2e3)}async function D(e){return new Promise(o=>{chrome.storage.local.set({syndraxAutomationState:e},o)})}async function R(){return new Promise(e=>{chrome.storage.local.get(["syndraxAutomationState"],o=>{e(o.syndraxAutomationState||null)})})}async function S(e=!1){return new Promise(o=>{e?chrome.storage.local.remove(["syndraxAutomationState","pendingAmazonOrder","autoOrderInProgress"],o):chrome.storage.local.remove(["syndraxAutomationState"],o)})}function d(e){return new Promise(o=>setTimeout(o,e))}let y=null;function L(){if(!y)try{const e=chrome.runtime.getURL("button1.mp3");y=new Audio(e),y.volume=.5,y.load(),console.log("🔊 Audio initialized:",e)}catch(e){console.log("Could not init audio:",e)}}function M(){if(y||L(),y)try{y.currentTime=0;const e=y.play();e&&e.catch(o=>{console.log("Audio play blocked, trying AudioContext..."),z()})}catch(e){console.log("Audio play error:",e)}}async function z(){try{const e=chrome.runtime.getURL("button1.mp3"),t=await(await fetch(e)).arrayBuffer(),n=new(window.AudioContext||window.webkitAudioContext),r=await n.decodeAudioData(t),s=n.createBufferSource();s.buffer=r;const l=n.createGain();l.gain.value=.5,s.connect(l),l.connect(n.destination),s.start(0)}catch(e){console.log("AudioContext play failed:",e)}}async function E(e,o=1e4){const t=Date.now();for(;Date.now()-t<o;){const n=document.querySelector(e);if(n)return n;await d(100)}return null}async function x(e,o,t,n=800){f(o,`Looking for: ${t}...`);const r=await E(e,1e4);if(!r)return{success:!1,error:`Could not find: ${t}
Selector: ${e}`};r.scrollIntoView({behavior:"auto",block:"center"}),await d(100),k(r,t),f(o,`Clicking: ${t}`),await d(150);try{return M(),r.click(),r.dispatchEvent(new MouseEvent("click",{bubbles:!0,cancelable:!0,view:window})),f(o,`✓ Clicked ${t}`),n>0&&await d(n),{success:!0}}catch(s){return{success:!1,error:`Click failed: ${s}`}}}async function A(e,o,t,n){var s;if(!o||o.trim()==="")return f(t,`Skipping empty: ${n}`),{success:!0,value:""};f(t,`Filling: ${n} = "${o}"`);const r=await E(e,5e3);if(!r)return{success:!1,error:`Field not found: ${n}
Selector: ${e}`};k(r,`${n}: ${o}`),await d(100);try{if(r.focus(),await d(30),r.tagName==="SELECT"){const i=r;let h=!1;const p={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",PR:"Puerto Rico"},g=o.toUpperCase(),w=p[g]||o;console.log(`🔍 Looking for state: "${o}" → "${w}"`);for(let c=0;c<i.options.length;c++){const m=i.options[c].value,v=i.options[c].text;if(m===g||m===w||v===w||v.toUpperCase().includes(w.toUpperCase())||m.toUpperCase()===g){i.selectedIndex=c,i.value=m,i.dispatchEvent(new Event("change",{bubbles:!0})),i.dispatchEvent(new Event("input",{bubbles:!0})),console.log(`✅ Selected state: "${v}" (value: "${m}")`),h=!0;break}}if(!h)return console.warn(`State not found for: ${o}. Available:`,Array.from(i.options).slice(0,10).map(c=>c.text)),{success:!1,error:`Could not find state "${o}" in dropdown`}}else{const i=r;i.value="",i.dispatchEvent(new Event("input",{bubbles:!0})),await d(30),i.value=o,i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0})),i.dispatchEvent(new Event("blur",{bubbles:!0}))}await d(100);const l=r.tagName==="SELECT"?(s=r.options[r.selectedIndex])==null?void 0:s.text:r.value;return!l||l.trim()===""?{success:!1,error:`Field "${n}" appears empty after filling!`}:(M(),f(t,`✓ Filled ${n}: "${l}"`),{success:!0,value:l})}catch(l){return{success:!1,error:`Fill failed: ${l}`}}}async function F(e,o){var s,l;f(o,`Selecting state: ${e}`);const t=e.toUpperCase();console.log(`🔍 Looking for state dropdown with: "${t}"`);const r={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",PR:"Puerto Rico",AS:"American Samoa",GU:"Guam",MP:"Northern Mariana Islands",VI:"Virgin Islands",FM:"Federated States of Micronesia",MH:"Marshall Islands",PW:"Palau",AA:"Armed Forces - AA",AE:"Armed Forces - AE",AP:"Armed Forces - AP"}[t]||e;console.log(`🔍 State: "${t}" → "${r}"`);try{const i=await E('#address-ui-widgets-enterAddressStateOrRegion .a-dropdown-prompt, #address-ui-widgets-enterAddressStateOrRegion-dropdown-nativeId .a-dropdown-prompt, [data-csa-c-slot-id*="StateOrRegion"] .a-dropdown-prompt, span[id*="StateOrRegion"] .a-dropdown-prompt',5e3);if(!i)return{success:!1,error:"State dropdown trigger not found"};k(i,"State Dropdown"),await d(100),i.click(),console.log("✅ Clicked state dropdown trigger"),await d(300),await d(500);const h=`a.a-dropdown-link[data-value*='"${t}"']`;console.log(`🔍 Looking for state with selector: ${h}`);let p=document.querySelector(h);if(!p){console.log("🔍 Direct selector failed, searching all dropdown links...");const w=document.querySelectorAll("a.a-dropdown-link");for(const c of w){const m=((s=c.textContent)==null?void 0:s.trim())||"",v=c.getAttribute("data-value")||"";if(m===r||v.includes(`"${t}"`)){p=c,console.log(`✅ Found via text search: "${m}"`);break}}}if(!p){const w=Array.from(document.querySelectorAll("a.a-dropdown-link")).slice(0,5).map(c=>c.textContent);return console.warn("Available options:",w),{success:!1,error:`Could not find state "${r}" in dropdown`}}const g=((l=p.textContent)==null?void 0:l.trim())||r;return console.log(`✅ Found state option: "${g}"`),k(p,`State: ${g}`),await d(100),p.click(),console.log(`✅ Clicked state: "${g}"`),await d(200),M(),f(o,`✓ Selected state: ${g}`),{success:!0,value:g}}catch(i){return{success:!1,error:`State selection failed: ${i}`}}}function T(){const e=window.location.href;return e.includes("/dp/")||e.includes("/gp/product/")?"product":e.includes("/checkout/")||e.includes("/gp/buy/")||e.includes("/gp/aw/")?"checkout":"other"}async function C(e,o=1){if(console.log(`🚀 Running automation from step ${o}`),console.log("📦 Shipping data:",e),!e.fullName||!e.street||!e.city||!e.state||!e.zipCode){b(),u(0,`Missing required shipping data!

            Name: ${e.fullName||"MISSING"}

            Street: ${e.street||"MISSING"}

            City: ${e.city||"MISSING"}

            State: ${e.state||"MISSING"}

            ZIP: ${e.zipCode||"MISSING"}`);return}b();let t;const n={},r=async s=>{await D({currentStep:s,shipping:e,startTime:Date.now(),lastUrl:window.location.href})};if(o<=1&&T()==="product"){if(P(e),await d(500),await r(1),t=await x("#buy-now-button",1,"Buy Now",1e3),!t.success){u(1,t.error||"Buy Now button not found");return}await r(2);return}if(o<=2){if(await r(2),f(2,"On checkout page, looking for Change Address..."),await d(500),t=await x('a[aria-label="Change delivery address"]',2,"Change delivery address",800),t.success||(t=await x('[data-testid="change-shipping-address-link"]',2,"Change address (alt)",800)),!t.success){u(2,t.error||`Change address link not found.
Make sure you have at least one saved address.`);return}await r(3)}if(o<=3){if(await d(500),t=await x("#edit-address-desktop-tango-sasp-0",3,"Edit address",800),!t.success){const s=['a[data-testid="edit-address-link"]',".address-edit-link"];for(const l of s)if(t=await x(l,3,"Edit address (alt)",800),t.success)break}if(!t.success){u(3,t.error||"Edit address link not found");return}await r(4)}if(await d(800),o<=4){if(t=await A("#address-ui-widgets-enterAddressFullName",e.fullName,4,"Full Name"),!t.success){u(4,t.error||"Name field failed");return}n.name=t.value||""}if(o<=5&&(t=await A("#address-ui-widgets-enterAddressPhoneNumber",e.phone||"",5,"Phone"),n.phone=t.value||"Not provided"),o<=6){if(t=await A("#address-ui-widgets-enterAddressLine1",e.street,6,"Street Address"),!t.success){u(6,t.error||"Street address field failed");return}n.street=t.value||""}if(o<=7){if(t=await A("#address-ui-widgets-enterAddressCity",e.city,7,"City"),!t.success){u(7,t.error||"City field failed");return}n.city=t.value||""}if(o<=8){if(t=await F(e.state,8),!t.success){u(8,t.error||"State field failed");return}n.state=t.value||""}if(o<=9){if(t=await A("#address-ui-widgets-enterAddressPostalCode",e.zipCode,9,"ZIP Code"),!t.success){u(9,t.error||"ZIP code field failed");return}n.zip=t.value||""}await S(!0),O(e,n),console.log("🛑 AUTOMATION STOPPED - User must manually review and click Continue")}async function U(){await d(300);const e=T();console.log("📍 Current page type:",e);const o=await R();if(o)if(console.log("📦 Found saved state, step:",o.currentStep),e==="product"&&o.currentStep>1)console.warn("⚠️ On product page but state is step",o.currentStep,"- resetting"),await S();else{if(e==="checkout"&&o.currentStep>=2)return console.log("📦 Resuming automation from step:",o.currentStep),b(),f(o.currentStep,"Resuming automation..."),await d(400),await C(o.shipping,o.currentStep),!0;console.warn("⚠️ Invalid state/page combo - clearing state"),await S()}const t=await new Promise(n=>{chrome.storage.local.get(["pendingAmazonOrder","autoOrderInProgress"],n)});if(t.pendingAmazonOrder&&t.autoOrderInProgress){console.log("📦 Found pending order:",t.pendingAmazonOrder);const n=t.pendingAmazonOrder;return console.log("📦 Shipping data from eBay:",n.shipping),console.log("📍 Page type:",e),e==="product"?document.querySelector("#buy-now-button")?(await C(n.shipping,1),!0):(b(),u(0,`No Buy Now button found.
Please use a Prime-eligible product.`),!0):e==="checkout"?(await C(n.shipping,2),!0):(console.log("📍 Not on product or checkout page, waiting..."),!1)}return!1}chrome.runtime.onMessage.addListener((e,o,t)=>window.self!==window.top?!1:e.type==="startFulfillment"&&e.shipping?(C(e.shipping,1).then(()=>t({success:!0})).catch(n=>t({success:!1,error:String(n)})),!0):!1);async function $(){console.log(`🔄 Init attempt ${I+1}/${N}`),I++;try{const e=await U();!e&&I<N?(console.log("⏳ No automation started, will retry in 2s..."),setTimeout($,2e3)):e&&console.log("✅ Automation started successfully")}catch(e){console.error("❌ Init failed:",e),I<N&&(console.log("🔄 Retrying in 2s..."),setTimeout($,2e3))}}window.self!==window.top||(console.log("🚚 Syndrax Fulfillment loaded (top-level)"),console.log("📍 URL:",window.location.href),$());export{C as fulfillAmazonOrder};
