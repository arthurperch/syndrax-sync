(function(){const $=`
#syndrax-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999999;
  background: #0a0f1e;
  border: 1px solid rgba(0,207,255,0.3);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 0 30px rgba(0,207,255,0.15), 0 0 60px rgba(122,92,255,0.1);
  width: 200px;
  font-family: Inter, -apple-system, sans-serif;
}

#syndrax-panel .panel-logo {
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(90deg, #00CFFF, #7A5CFF, #FF00D4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

#syndrax-panel button {
  display: block;
  width: 100%;
  padding: 7px 10px;
  margin-bottom: 5px;
  background: rgba(0,207,255,0.08);
  border: 1px solid rgba(0,207,255,0.2);
  border-radius: 6px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  font-family: Inter, -apple-system, sans-serif;
  transition: all 0.2s;
}

#syndrax-panel button:hover {
  background: rgba(0,207,255,0.15);
  border-color: rgba(0,207,255,0.4);
}

#syndrax-panel button:last-child {
  margin-bottom: 0;
}
`;function C(){if(document.getElementById("syndrax-styles"))return;const t=document.createElement("style");t.id="syndrax-styles",t.textContent=$,document.head.appendChild(t)}function y(){var r,n,e,a;if(document.getElementById("syndrax-panel"))return;const t=document.createElement("div");t.id="syndrax-panel",t.innerHTML=`
    <div class="panel-logo">SYNDRAX SYNC</div>
    <button id="syndrax-extract">📦 Extract Order</button>
    <button id="syndrax-fulfill">🚀 Auto Fulfill</button>
    <button id="syndrax-copy">📋 Copy Address</button>
    <button id="syndrax-tracking">📍 Update Tracking</button>
  `,document.body.appendChild(t),(r=document.getElementById("syndrax-extract"))==null||r.addEventListener("click",L),(n=document.getElementById("syndrax-fulfill"))==null||n.addEventListener("click",R),(e=document.getElementById("syndrax-copy"))==null||e.addEventListener("click",z),(a=document.getElementById("syndrax-tracking"))==null||a.addEventListener("click",B)}function L(){const t=d();t?(chrome.runtime.sendMessage({type:"ORDER_EXTRACTED",payload:t,timestamp:Date.now()}),s("Order extracted successfully!")):s("Could not extract order data",!0)}function d(){var t,r,n,e,a,x,g,b,f,h;try{const i=((r=(t=document.querySelector('[data-testid="buyer-name"], .buyer-info .name, [class*="buyer"] [class*="name"]'))==null?void 0:t.textContent)==null?void 0:r.trim())||((e=(n=document.querySelector('.ship-to-name, [class*="shipTo"] [class*="name"]'))==null?void 0:n.textContent)==null?void 0:e.trim())||"",c=document.querySelector('[data-testid="shipping-address"], .shipping-address, [class*="address"]'),l=((c==null?void 0:c.textContent)||"").split(`
`).map(F=>F.trim()).filter(Boolean),k=l[0]||"",o=(l[1]||"").match(/^(.+?),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)/),E=(o==null?void 0:o[1])||"",S=(o==null?void 0:o[2])||"",T=(o==null?void 0:o[3])||"",I=l[2]||"United States",w=((x=(a=document.querySelector('[data-testid="item-title"], .item-title, [class*="itemTitle"]'))==null?void 0:a.textContent)==null?void 0:x.trim())||((b=(g=document.querySelector("h1"))==null?void 0:g.textContent)==null?void 0:b.trim())||"",u=document.querySelector('[data-testid="item-id"], [class*="itemId"]'),v=((f=u==null?void 0:u.textContent)==null?void 0:f.replace(/\D/g,""))||((h=window.location.href.match(/\/(\d{12,})/))==null?void 0:h[1])||"",p=document.querySelector('[data-testid="item-price"], .item-price, [class*="price"]'),A=(p==null?void 0:p.textContent)||"0",q=parseFloat(A.replace(/[^0-9.]/g,""))||0,m=document.querySelector('[data-testid="quantity"], .quantity'),D=parseInt((m==null?void 0:m.textContent)||"1")||1;return!i&&!w?null:{id:`order-${Date.now()}`,buyerName:i,buyerAddress:k,buyerCity:E,buyerState:S,buyerZip:T,buyerCountry:I,itemTitle:w,itemId:v,quantity:D,salePrice:q}}catch(i){return console.error("Syndrax: Error extracting order:",i),null}}async function R(){var a;const t=d();if(!t){s("Extract order first",!0);return}await chrome.storage.local.set({pendingFulfillment:t});const n=((a=(await chrome.storage.local.get("syndrax_settings")).syndrax_settings)==null?void 0:a.defaultSupplier)||"amazon",e=n==="amazon"?`https://www.amazon.com/s?k=${encodeURIComponent(t.itemTitle)}`:`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(t.itemTitle)}`;window.open(e,"_blank"),s(`Opening ${n} to fulfill order`)}function z(){const t=d();if(!t){s("Could not find address",!0);return}const r=`${t.buyerName}
${t.buyerAddress}
${t.buyerCity}, ${t.buyerState} ${t.buyerZip}
${t.buyerCountry}`;navigator.clipboard.writeText(r),s("Address copied!")}function B(){const t=document.querySelector('[data-testid="tracking-input"], input[name*="tracking"], [class*="tracking"] input');t?(t.focus(),t.scrollIntoView({behavior:"smooth",block:"center"}),s("Enter tracking number")):s("Tracking input not found",!0)}function s(t,r=!1){const n=document.getElementById("syndrax-notification");n&&n.remove();const e=document.createElement("div");e.id="syndrax-notification",e.style.cssText=`
    position: fixed;
    bottom: 250px;
    right: 24px;
    z-index: 9999999;
    background: ${r?"#ef4444":"#22c55e"};
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: Inter, -apple-system, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `,e.textContent=t,document.body.appendChild(e),setTimeout(()=>e.remove(),3e3)}chrome.runtime.onMessage.addListener((t,r,n)=>{if(t.type==="EXTRACT_ORDER"){const e=d();n({success:!!e,order:e})}else t.type==="PAGE_READY"&&(y(),n({success:!0}));return!0});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{C(),y()}):(C(),y());
})()
