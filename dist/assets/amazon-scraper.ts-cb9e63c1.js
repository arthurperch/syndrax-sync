(function(){function x(){var e,o,n,t;try{const r=((o=(e=document.querySelector("#productTitle"))==null?void 0:e.textContent)==null?void 0:o.trim())||"",c=document.querySelector(".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole"),f=(c==null?void 0:c.textContent)||"0",g=parseFloat(f.replace(/[^0-9.]/g,""))||0,i=window.location.href.match(/\/dp\/([A-Z0-9]{10})/),y=(i==null?void 0:i[1])||"",d=document.querySelector("#landingImage, #imgBlkFront"),b=(d==null?void 0:d.src)||"",l=[];document.querySelectorAll("#altImages img, .imageThumbnail img").forEach(S=>{const u=S.src;if(u&&!u.includes("transparent-pixel")){const w=u.replace(/\._[^.]+_\./,".");l.push(w)}});const s=document.querySelector("#productDescription, #feature-bullets"),h=((n=s==null?void 0:s.textContent)==null?void 0:n.trim())||"",a=document.querySelector("#availability, #outOfStock"),C=!((t=a==null?void 0:a.textContent)!=null&&t.toLowerCase().includes("out of stock"));return r?{title:r,price:g,asin:y,mainImage:b,images:l.slice(0,10),description:h,inStock:C,url:window.location.href}:null}catch(r){return console.error("Syndrax: Error scraping Amazon product:",r),null}}function p(){if(document.getElementById("syndrax-add-btn")||!document.querySelector("#productTitle"))return;const e=document.createElement("button");e.id="syndrax-add-btn",e.innerHTML="➕ Add to Syndrax",e.style.cssText=`
    position: fixed;
    bottom: 24px;
    right: 24px;
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
    transition: all 0.2s;
  `,e.addEventListener("click",()=>{const o=x();o?(chrome.runtime.sendMessage({type:"PRODUCT_SCRAPED",payload:o,timestamp:Date.now()}),m("Product added to Syndrax Sync!")):m("Could not scrape product data",!0)}),document.body.appendChild(e)}function m(e,o=!1){const n=document.getElementById("syndrax-notification");n&&n.remove();const t=document.createElement("div");t.id="syndrax-notification",t.style.cssText=`
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 9999999;
    background: ${o?"#ef4444":"#22c55e"};
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `,t.textContent=e,document.body.appendChild(t),setTimeout(()=>t.remove(),3e3)}chrome.runtime.onMessage.addListener((e,o,n)=>{if(e.type==="SCRAPE_PRODUCT"){const t=x();n({success:!!t,product:t})}return!0});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",p):setTimeout(p,500);
})()
