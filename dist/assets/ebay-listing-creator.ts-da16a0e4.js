(function(){const s={title:'input[name="title"], #listing-title, [data-testid="listing-title"]',description:'textarea[name="description"], #listing-description, [data-testid="listing-description"], .ql-editor',price:'input[name="price"], #listing-price, [data-testid="listing-price"]',condition:'select[name="condition"], #listing-condition',quantity:'input[name="quantity"], #listing-quantity',submitBtn:'button[type="submit"], #listing-submit, [data-testid="submit-listing"]'};async function u(){const t=await chrome.storage.local.get("pendingListing");return t.pendingListing?t.pendingListing:null}function o(t,e){const i=document.querySelector(t);return i?(i.focus(),i.value=String(e),i.dispatchEvent(new Event("input",{bubbles:!0})),i.dispatchEvent(new Event("change",{bubbles:!0})),!0):!1}function c(t,e){const i=document.querySelector(t);return i?(i.innerHTML=e,i.dispatchEvent(new Event("input",{bubbles:!0})),!0):!1}async function l(t){let e=0;return await new Promise(n=>setTimeout(n,1e3)),o(s.title,t.title)&&e++,(o(s.description,t.description)||c(".ql-editor",t.description))&&e++,o(s.price,t.price.toFixed(2))&&e++,o(s.quantity,"1")&&e++,e}function r(t,e=!1){const i=document.getElementById("syndrax-status");i&&i.remove();const n=document.createElement("div");n.id="syndrax-status",n.style.cssText=`
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${e?"#ef4444":"#22c55e"};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `,n.textContent=`Syndrax: ${t}`,document.body.appendChild(n),setTimeout(()=>n.remove(),5e3)}async function a(){const t=await u();if(!t)return;r("Auto-filling listing data...");const e=await l(t);e>0?(r(`Filled ${e} listing fields`),await chrome.storage.local.remove("pendingListing"),chrome.runtime.sendMessage({type:"LISTING_CREATED",payload:{success:!0,filled:e,title:t.title},timestamp:Date.now()})):r("Could not fill listing fields",!0)}chrome.runtime.onMessage.addListener((t,e,i)=>{if(t.type==="FILL_LISTING"){const n=t.payload;return l(n).then(d=>{i({success:d>0,filled:d})}),!0}return!1});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(a,2e3)):setTimeout(a,2e3);
})()
