(function(){function y(){const e=[];return document.querySelectorAll(".s-item, .srp-results li[data-viewport]").forEach(t=>{var n,d,r;try{const o=t.querySelector(".s-item__title, h3"),c=((n=o==null?void 0:o.textContent)==null?void 0:n.trim())||"";if(c==="Shop on eBay")return;const a=t.querySelector(".s-item__price, .prc"),g=(a==null?void 0:a.textContent)||"0",i=parseFloat(g.replace(/[^0-9.]/g,""))||0,l=t.querySelector(".s-item__seller-info, .si-inner"),h=((d=l==null?void 0:l.textContent)==null?void 0:d.trim())||"Unknown",p=t.querySelector(".s-item__subtitle, .cndtn"),b=((r=p==null?void 0:p.textContent)==null?void 0:r.trim())||"Used",u=t.querySelector("a.s-item__link, a"),w=(u==null?void 0:u.href)||"",m=i*.5,x=i-m-i*.13,C=x/i*100;c&&i>0&&e.push({title:c,soldPrice:i,estimatedCost:m,estimatedProfit:x,profitPercent:C,seller:h,condition:b,url:w})}catch(o){console.error("Syndrax: Error parsing competitor row:",o)}}),e.sort((t,n)=>n.profitPercent-t.profitPercent)}function f(){if(document.getElementById("syndrax-research-btn")||!window.location.href.includes("LH_Complete=1")&&!window.location.href.includes("LH_Sold=1"))return;const e=document.createElement("button");e.id="syndrax-research-btn",e.innerHTML="🔍 Analyze Competitors",e.style.cssText=`
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: linear-gradient(90deg, #00CFFF, #7A5CFF);
    color: white;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,207,255,0.4);
  `,e.addEventListener("click",async()=>{e.disabled=!0,e.innerHTML="⏳ Analyzing...";const s=y();chrome.runtime.sendMessage({type:"COMPETITORS_SCANNED",payload:s,timestamp:Date.now()}),v(s),e.disabled=!1,e.innerHTML="🔍 Analyze Competitors"}),document.body.appendChild(e)}function v(e){var d;const s=document.getElementById("syndrax-results");s&&s.remove();const t=document.createElement("div");t.id="syndrax-results",t.style.cssText=`
    position: fixed;
    top: 70px;
    right: 20px;
    z-index: 999998;
    background: #0a0f1e;
    border: 1px solid rgba(0,207,255,0.3);
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    max-height: 400px;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-family: Inter, -apple-system, sans-serif;
  `;const n=document.createElement("div");n.style.cssText=`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  `,n.innerHTML=`
    <span style="color: white; font-weight: 700; font-size: 14px;">
      Found ${e.length} Products
    </span>
    <button id="syndrax-close" style="background: none; border: none; color: #999; cursor: pointer; font-size: 18px;">✕</button>
  `,t.appendChild(n),e.slice(0,10).forEach(r=>{const o=document.createElement("div");o.style.cssText=`
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(0,207,255,0.1);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    `;const c=r.profitPercent>=30?"#22c55e":r.profitPercent>=15?"#f59e0b":"#ef4444";o.innerHTML=`
      <div style="color: white; font-size: 11px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${r.title}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span style="color: #94a3b8;">Sold: $${r.soldPrice.toFixed(2)}</span>
        <span style="color: ${c}; font-weight: 600;">${r.profitPercent.toFixed(0)}% profit</span>
      </div>
    `,t.appendChild(o)}),document.body.appendChild(t),(d=document.getElementById("syndrax-close"))==null||d.addEventListener("click",()=>t.remove())}chrome.runtime.onMessage.addListener((e,s,t)=>{if(e.type==="SCAN_COMPETITORS"){const n=y();t({success:!0,items:n}),chrome.runtime.sendMessage({type:"COMPETITORS_SCANNED",payload:n,timestamp:Date.now()})}return!0});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):setTimeout(f,500);
})()
