/* =========================================================
   ORIGINALS — Engine dùng chung cho mọi trang
   ========================================================= */
const S = window.STORE;
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const money = S.formatVND;
// safeColor() được khai báo global trong data.js (chặn CSS injection qua style="background:${c}")
const param = (k) => new URLSearchParams(location.search).get(k);

/* trạng thái đơn hàng */
const ORDER_STATUS = {
  pending:   {label:"Chờ xác nhận", step:0, color:"#d8a441"},
  confirmed: {label:"Đã xác nhận",  step:1, color:"#378add"},
  shipping:  {label:"Đang giao",    step:2, color:"#7a5cff"},
  completed: {label:"Hoàn thành",   step:3, color:"#1d9e75"},
  cancelled: {label:"Đã huỷ",       step:-1,color:"#e02424"},
};
/* lưu mã đơn trên máy khách để xem lại */
const MY_ORDERS_KEY = "originals_my_orders_v1";
function saveMyOrder(o){
  const a = JSON.parse(localStorage.getItem(MY_ORDERS_KEY)||"[]");
  a.unshift({code:o.code, total:o.total, date:o.created_at||new Date().toISOString()});
  localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(a.slice(0,20)));
}
function getMyOrders(){ return JSON.parse(localStorage.getItem(MY_ORDERS_KEY)||"[]"); }

/* lưu thông tin liên hệ lần đặt gần nhất để prefill checkout */
const LAST_CONTACT_KEY = "originals_last_contact_v1";
function saveLastContact(c){ try{ localStorage.setItem(LAST_CONTACT_KEY, JSON.stringify(c)); }catch(e){} }
function getLastContact(){ try{ return JSON.parse(localStorage.getItem(LAST_CONTACT_KEY)||"null"); }catch(e){ return null; } }

/* ---------------- EMAIL (gửi xác nhận đơn hàng qua EmailJS) ----------------
   Bật bằng cách dán 3 key EMAILJS_* trong assets/config.js. Nếu thiếu,
   module tự tắt — đặt hàng vẫn chạy bình thường, chỉ không gửi email. */
const Email = {
  inited: false,
  get cfg(){ const c=window.CONFIG||{}; return {pk:c.EMAILJS_PUBLIC_KEY||"", svc:c.EMAILJS_SERVICE_ID||"", tpl:c.EMAILJS_TEMPLATE_ID||""}; },
  get enabled(){ const {pk,svc,tpl}=this.cfg; return !!(pk&&svc&&tpl&&window.emailjs); },
  diagnose(){
    const c=this.cfg;
    const probs=[];
    if(!window.emailjs) probs.push("EmailJS SDK chưa load (kiểm tra <script @emailjs/browser> trong cart.html, hoặc adblock chặn CDN, hoặc đang chạy file://)");
    if(!c.pk)  probs.push("Thiếu EMAILJS_PUBLIC_KEY trong assets/config.js");
    if(!c.svc) probs.push("Thiếu EMAILJS_SERVICE_ID trong assets/config.js");
    if(!c.tpl) probs.push("Thiếu EMAILJS_TEMPLATE_ID trong assets/config.js");
    return probs;
  },
  init(){
    if(this.inited || !this.enabled) return;
    try{ window.emailjs.init({publicKey:this.cfg.pk}); this.inited=true; console.info("[Email] init OK"); }
    catch(e){ console.warn("[Email] init fail",e); }
  },
  // Định dạng item dạng text dễ đọc trong email (template plain-text vẫn xài được)
  formatItems(items){
    return (items||[]).map(it=>{
      const opts=[it.color?`màu ${it.color}`:"", it.size?`size ${it.size}`:""].filter(Boolean).join(", ");
      return `• ${it.name}${opts?` (${opts})`:""} × ${it.qty} — ${money(it.price*it.qty)}`;
    }).join("\n");
  },
  esc(s){ return (s||"").toString().replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
  // Chỉ cho phép http(s) URL trong email (chặn javascript:, data:, …)
  safeUrl(u){ if(!u) return ""; try{ const x=new URL(u, location.href); return (x.protocol==="http:"||x.protocol==="https:") ? x.href : ""; }catch(e){ return ""; } },
  // Định dạng HTML có ảnh — dùng cho template email rich. Trong EmailJS template
  // dùng triple braces {{{order_items_html}}} để insert raw HTML (không escape).
  formatItemsHtml(items){
    const rows=(items||[]).map(it=>{
      const opts=[it.color?`Màu ${this.esc(it.color)}`:"", it.size?`Size ${this.esc(it.size)}`:""].filter(Boolean).join(" · ");
      const safeImg = this.safeUrl(it.image);
      const img=safeImg
        ? `<img src="${this.esc(safeImg)}" width="64" height="64" alt="" style="display:block;border-radius:6px;object-fit:cover;border:1px solid #eee">`
        : `<div style="width:64px;height:64px;background:#f4f4f4;border-radius:6px;border:1px solid #eee"></div>`;
      return `<tr>
        <td width="72" style="padding:12px 12px 12px 0;border-bottom:1px solid #eee;vertical-align:top">${img}</td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;vertical-align:top">
          <div style="font-size:14px;font-weight:600;color:#1d1d1d">${this.esc(it.name)}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${opts}${opts?" · ":""}SL ${it.qty}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;vertical-align:top;font-size:14px;font-weight:600;color:#1d1d1d;white-space:nowrap">
          ${money(it.price*it.qty)}
        </td>
      </tr>`;
    }).join("");
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif">${rows}</table>`;
  },
  async sendConfirmation(order){
    if(!this.enabled){
      const probs=this.diagnose();
      console.warn("[Email] SKIP send — tính năng đang TẮT. Lý do:\n - "+probs.join("\n - "));
      return {sent:false, reason:"disabled", probs};
    }
    const to=(order.email||"").trim();
    if(!to){ console.warn("[Email] SKIP send — đơn không có email người mua"); return {sent:false, reason:"no-email"}; }
    this.init();
    console.info("[Email] sending to", to, "via service", this.cfg.svc, "template", this.cfg.tpl);
    const trackingUrl = `${location.origin}${location.pathname.replace(/[^/]+$/,"")}order.html?code=${encodeURIComponent(order.code)}`;
    const params = {
      to_email: to,
      to_name: order.customer_name || "",
      order_code: order.code,
      order_total: money(order.total||0),
      order_subtotal: money(order.subtotal||0),
      order_shipping: order.shipping ? money(order.shipping) : "Miễn phí",
      order_items: this.formatItems(order.items),
      order_items_html: this.formatItemsHtml(order.items),
      order_address: order.address || "",
      order_phone: order.phone || "",
      order_note: order.note || "",
      tracking_url: trackingUrl,
      store_name: (window.CONFIG&&window.CONFIG.STORE_NAME) || (S.BRAND&&S.BRAND.name) || "Shop",
    };
    try{
      const res=await window.emailjs.send(this.cfg.svc, this.cfg.tpl, params);
      console.info("[Email] sent OK", res);
      return {sent:true, res};
    }catch(e){
      console.warn("[Email] send FAIL — chi tiết:", e);
      console.warn("[Email] payload đã gửi:", params);
      return {sent:false, reason:"error", error:e};
    }
  },
};

/* ---------------- GIỎ HÀNG (localStorage) ---------------- */
const CART_KEY = "originals_cart_v1";
const Cart = {
  items: JSON.parse(localStorage.getItem(CART_KEY) || "[]"),
  _reload(){ try{ this.items = JSON.parse(localStorage.getItem(CART_KEY)||"[]"); }catch(e){ this.items = []; } },
  save(){ localStorage.setItem(CART_KEY, JSON.stringify(this.items)); updateCartCount(); },
  add(it){
    this._reload();   // tránh đè mất hàng tab khác vừa thêm
    const f = this.items.find(x => x.id===it.id && x.size===it.size && x.color===it.color);
    if(f) f.qty += it.qty; else this.items.push(it);
    this.save();
  },
  remove(i){ this._reload(); this.items.splice(i,1); this.save(); },
  setQty(i,q){ this._reload(); if(this.items[i]) this.items[i].qty = Math.max(1, q); this.save(); },
  count(){ return this.items.reduce((s,x)=>s+x.qty,0); },
  subtotal(){ return this.items.reduce((s,x)=>s+x.price*x.qty,0); },
};
// Đồng bộ giỏ hàng giữa các tab — nếu tab khác thay đổi, cập nhật ngay.
window.addEventListener("storage", e=>{
  if(e.key!==CART_KEY) return;
  Cart._reload();
  updateCartCount();
  if(document.body.dataset.page==="cart" && typeof renderCart==="function") renderCart();
});
function updateCartCount(){ $$(".cart-count").forEach(e => e.textContent = Cart.count()); renderCartPop(); }

/* ---------------- MODAL UX (Escape + scroll lock) ----------------
   Mọi modal ở đây dùng <div class="modal-overlay"> + nút .modal-close.
   Thay vì sửa từng chỗ openModal cục bộ, đăng ký 1 lần handler global:
   - Escape: đóng modal trên cùng (click .modal-close của overlay show cuối).
   - Khi có modal show → khoá scroll body; không còn → mở lại. */
(function setupModalUX(){
  const lockScroll = ()=>{
    const visible = document.querySelectorAll(".modal-overlay.show").length;
    document.body.style.overflow = visible ? "hidden" : "";
  };
  // observer: tự lock/unlock khi class .show xuất hiện/biến mất trên modal-overlay
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==="attributes" && m.target.classList?.contains("modal-overlay")) lockScroll();
      if(m.type==="childList"){ for(const n of m.addedNodes){ if(n.classList?.contains("modal-overlay")) lockScroll(); } for(const n of m.removedNodes){ if(n.classList?.contains("modal-overlay")) lockScroll(); } }
    }
  }).observe(document.body,{childList:true,subtree:false,attributes:true,attributeFilter:["class"],subtree:true});
  document.addEventListener("keydown", e=>{
    if(e.key!=="Escape") return;
    const ovs = document.querySelectorAll(".modal-overlay.show");
    if(!ovs.length) return;
    const top = ovs[ovs.length-1];
    const closeBtn = top.querySelector(".modal-close");
    if(closeBtn) closeBtn.click();
    else top.classList.remove("show"), setTimeout(()=>top.remove(),200);
  });
})();

/* ---------------- TOAST ---------------- */
let toastT;
function toast(msg){
  let t = $(".toast");
  if(!t){ t = document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent = "✓ " + ((msg==null?"":String(msg)));
  requestAnimationFrame(()=> t.classList.add("show"));
  clearTimeout(toastT);
  toastT = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* ---------------- AUTH (đăng nhập Google cho khách) ---------------- */
const Auth = {
  user: null,
  listeners: [],
  ready: false,
  async init(){
    try{ this.user = await DB.getUser(); }catch(e){ this.user = null; }
    this.ready = true;
    // Lắng nghe state change từ Supabase (cloud) — đăng nhập/đăng xuất ở tab khác
    if(DB.cloud){
      DB.onAuth((u)=>{
        const changed = (this.user?.id||null) !== (u?.id||null);
        this.user = u;
        if(changed){ renderAuthSlot(); this.listeners.forEach(fn=>fn(u)); }
      });
    }
  },
  isLoggedIn(){ return !!this.user; },
  displayName(){
    if(!this.user) return "";
    const m = this.user.user_metadata || {};
    return m.full_name || m.name || this.user.name || (this.user.email||"").split("@")[0] || "Bạn";
  },
  email(){ return this.user?.email || ""; },
  initial(){ return (this.displayName()||"?").trim().charAt(0).toUpperCase(); },
  onChange(fn){ this.listeners.push(fn); },
  async signInGoogle(){
    try{ await DB.signInGoogle(); }
    catch(e){ toast("Lỗi đăng nhập: "+(e.message||e)); return; }
    // Cloud sẽ redirect ra Google rồi quay lại; demo thì cập nhật ngay
    if(!DB.cloud){
      this.user = await DB.getUser();
      renderAuthSlot();
      this.listeners.forEach(fn=>fn(this.user));
      toast("Đã đăng nhập (demo) — "+this.displayName());
    }
  },
  async signOut(){
    await DB.signOut();
    this.user = null;
    renderAuthSlot();
    this.listeners.forEach(fn=>fn(null));
    toast("Đã đăng xuất");
  },
};

function renderAuthSlot(){
  const slot = $("#authSlot"); if(!slot) return;
  const userI = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg>`;
  if(!Auth.user){
    slot.innerHTML = `<button class="icon-btn" id="loginBtnHeader" aria-label="Đăng nhập" title="Đăng nhập">${userI}</button>`;
    $("#loginBtnHeader").onclick = openLoginModal;
    return;
  }
  slot.innerHTML = `
    <div class="user-menu" id="userMenu">
      <button class="icon-btn" id="userBtnHeader" aria-label="Tài khoản" title="${escapeXML(Auth.displayName())}">
        <span class="ua-circle">${escapeXML(Auth.initial())}</span>
      </button>
      <div class="user-dd" id="userDD" hidden>
        <div class="ud-head">
          <div class="ud-name">${escapeXML(Auth.displayName())}</div>
          <div class="ud-email">${escapeXML(Auth.email())}</div>
        </div>
        <a href="order.html" class="ud-item">Đơn của tôi</a>
        <button class="ud-item danger" id="signOutBtnHeader" type="button">Đăng xuất</button>
      </div>
    </div>`;
  const menu = $("#userMenu"), dd = $("#userDD");
  $("#userBtnHeader").onclick = (e)=>{
    e.stopPropagation();
    const open = dd.hidden;
    dd.hidden = !open;
    menu.classList.toggle("open", open);
  };
  $("#signOutBtnHeader").onclick = async ()=>{
    dd.hidden = true; menu.classList.remove("open");
    await Auth.signOut();
  };
}
// đóng dropdown khi click ngoài
document.addEventListener("click", (e)=>{
  const dd = $("#userDD"); if(!dd || dd.hidden) return;
  if(!e.target.closest("#userMenu")){ dd.hidden = true; $("#userMenu")?.classList.remove("open"); }
});

function openLoginModal(){
  if($("#loginModal")) return;
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="loginModal";
  const gsvg = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/><path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.6 0-12.2-4.5-14.2-10.5l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>`;
  ov.innerHTML=`<div class="modal" style="max-width:400px">
    <button class="modal-close" id="lmClose" aria-label="Đóng">×</button>
    <h3 class="modal-title" style="text-align:center">Đăng nhập</h3>
    <p class="muted" style="font-size:13.5px;text-align:center;margin-bottom:20px">Đăng nhập để lưu lịch sử đơn hàng và theo dõi giao hàng dễ dàng.</p>
    <button class="gbtn" id="gLoginBtn">${gsvg}Đăng nhập bằng Google</button>
    <p class="muted" style="font-size:12px;text-align:center;margin-top:14px">Vẫn có thể đặt hàng mà không cần đăng nhập.</p>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#lmClose").onclick=close; ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  $("#gLoginBtn").onclick=async()=>{
    $("#gLoginBtn").disabled=true; $("#gLoginBtn").textContent="Đang đăng nhập…";
    await Auth.signInGoogle();
    close();
  };
}

/* ---------------- CARD SẢN PHẨM ---------------- */
function productImage(p, opts){
  if(p.image_url) return `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy">`;
  return S.productSVG(p, opts||{seed:hashSeed(p.id)});
}
/* Ảnh của 1 dòng trong đơn hàng — ưu tiên ảnh đã lưu vào đơn lúc đặt (snapshot),
   sau đó mới tra sản phẩm hiện tại, cuối cùng fallback SVG. Nhờ vậy đơn vẫn
   hiển thị đúng ảnh kể cả khi sản phẩm bị ẩn / xoá / đổi sau này. */
function orderItemImage(it){
  if(it.image) return `<img class="thumb-img" src="${it.image}" alt="${escapeXML(it.name||"")}" loading="lazy">`;
  const pr = S.getProduct(it.id);
  if(pr) return productImage(pr,{color:it.color});
  return S.productSVG({type:"tee",print:it.name,collection:"",colors:[it.color||"#ccc"],name:it.name},{color:it.color});
}
function formatCount(n){
  n = +n||0;
  if(n>=1000) return (n/1000).toFixed(n%1000===0?0:1).replace(/\.0$/,"") + "k";
  return ""+n;
}
// Thiết bị cảm ứng không có hover → bỏ ảnh mặt sau (tiết kiệm ~2KB SVG/card)
const HAS_HOVER = typeof window.matchMedia==="function" ? window.matchMedia("(hover:hover)").matches : true;
function productCard(p){
  if(!p || !p.id){ console.warn("productCard: SP thiếu id, bỏ qua:", p); return ""; }
  const off = S.discountPct(p.price, p.compare);
  const swatches = (p.colors||[]).slice(0,4).map((c,i)=>`<button type="button" class="swatch${i===0?' active':''}" data-c="${escapeXML(c)}" data-id="${p.id}" style="background:${safeColor(c)}" aria-label="Màu ${escapeXML(c)}"></button>`).join("");
  const url = `product.html?id=${encodeURIComponent(p.id)}`;
  const soldOut = (p.stock!=null && p.stock<=0);
  const ci0 = (p.color_images||{})[p.colors[0]];
  const fallbackSvg = HAS_HOVER
    ? S.productSVG(p,{seed:hashSeed(p.id)}) + `<div class="hoverimg">${S.productSVG(p,{color:p.colors[1]||p.colors[0],seed:hashSeed(p.id)+1})}</div>`
    : S.productSVG(p,{seed:hashSeed(p.id)});
  const media = (ci0 && ci0[0])
    ? `<img class="thumb-img" src="${ci0[0]}" alt="${escapeXML(p.name)}" loading="lazy">`
    : (p.image_url
      ? `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy">`
      : fallbackSvg);
  const sold=+p.sold||0, likes=+p.likes||0;
  const stats = (sold>0 || likes>0)
    ? `<div class="card-stats">
        ${sold>0?`<span class="stat-sold">Đã bán ${formatCount(sold)}</span>`:""}
        ${likes>0?`<span class="stat-like">♥ ${formatCount(likes)}</span>`:""}
      </div>`
    : "";
  return `<article class="card">
    <div class="thumb">
      <a class="thumb-link" href="${url}" aria-label="${escapeXML(p.name)}">
        ${soldOut?`<span class="badge dark">Hết hàng</span>`: (p.sale?`<span class="badge">-${off}%</span>`:``)}
        ${media}
      </a>
      ${soldOut?``:`<div class="quick"><button class="btn btn-dark btn-block qadd" data-id="${p.id}">Thêm vào giỏ hàng</button></div>
      <button class="card-cart qadd" data-id="${p.id}" aria-label="Thêm vào giỏ hàng" title="Thêm vào giỏ hàng"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg></button>`}
    </div>
    <div class="info">
      <div class="cat">${p.collection}</div>
      <a class="name" href="${url}">${p.name}</a>
      <div class="price">
        <span class="now">${money(p.price)}</span>
        ${p.compare>p.price?`<span class="was">${money(p.compare)}</span><span class="off">-${off}%</span>`:``}
      </div>
      ${stats}
      <div class="swatches">${swatches}</div>
    </div>
  </article>`;
}
function hashSeed(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h%4; }

/* quick add → mở popup chọn size (kèm bảng size) rồi mới thêm vào giỏ */
document.addEventListener("click", e=>{
  const b = e.target.closest(".qadd");
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  const p = S.getProduct(b.dataset.id);
  if(!p) return;
  if(p.stock!=null && p.stock<=0){ toast("Sản phẩm đã hết hàng"); return; }
  openQuickAdd(p);
});

/* Đổi ảnh thumbnail trên thẻ sản phẩm khi bấm vào swatch màu */
document.addEventListener("click", e=>{
  const sw = e.target.closest(".card .swatch");
  if(!sw || !sw.dataset.c) return;
  e.preventDefault(); e.stopPropagation();
  const card = sw.closest(".card");
  const p = S.getProduct(sw.dataset.id);
  if(!p || !card) return;
  const c = sw.dataset.c;
  const link = card.querySelector(".thumb-link");
  if(!link) return;
  const badge = link.querySelector(".badge");
  const ci = (p.color_images||{})[c];
  let html;
  if(ci && ci[0]){
    html = `<img class="thumb-img" src="${ci[0]}" alt="${escapeXML(p.name)}" loading="lazy">`;
  } else if(p.image_url && c===p.colors[0]){
    html = `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy">`;
  } else {
    html = S.productSVG(p,{color:c,seed:hashSeed(p.id)});
    if(HAS_HOVER) html += `<div class="hoverimg">${S.productSVG(p,{back:true,color:c,seed:hashSeed(p.id)+1})}</div>`;
  }
  link.innerHTML = (badge?badge.outerHTML:"") + html;
  card.querySelectorAll(".swatch").forEach(x=>x.classList.toggle("active", x===sw));
});

/* Popup thêm nhanh: chọn màu + size (bấm size = thêm vào giỏ), kèm bảng size */
function openQuickAdd(p){
  if(!p || $("#quickAddModal")) return;
  let qaColor = p.colors[0];
  const sizes = p.sizes||[];
  const thumbHTML = ()=> p.image_url
    ? `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}">`
    : S.productSVG(p,{color:qaColor});
  const sizeRows = (typeof SIZE_CHART!=="undefined"?SIZE_CHART:[]).filter(s=>sizes.includes(s.size))
    .map(s=>`<tr><td><b>${s.size}</b></td><td>${s.hMin}–${s.hMax}</td><td>${s.wMin}–${s.wMax}</td></tr>`).join("");
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="quickAddModal";
  ov.innerHTML=`<div class="modal qa-modal">
    <button class="modal-close" id="qaClose" aria-label="Đóng">×</button>
    <div class="qa-head">
      <a class="qa-thumb" href="product.html?id=${encodeURIComponent(p.id)}" id="qaThumb">${thumbHTML()}</a>
      <div class="qa-meta">
        <div class="qa-cat">${escapeXML(p.collection||p.catName||"")}</div>
        <h3 class="qa-name">${escapeXML(p.name)}</h3>
        <div class="price"><span class="now">${money(p.price)}</span>${p.compare>p.price?`<span class="was">${money(p.compare)}</span>`:""}</div>
      </div>
    </div>
    ${p.colors.length>1?`<div class="opt-label">Màu sắc</div>
      <div class="color-row" id="qaColors">${p.colors.map((c,i)=>`<button class="color-dot ${i===0?'active':''}" data-c="${escapeXML(c)}" style="background:${safeColor(c)}" title="${escapeXML(c)}"></button>`).join("")}</div>`:""}
    <div class="opt-label">Chọn size <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:12px">— bấm size để thêm vào giỏ</span></div>
    <div class="opt-row" id="qaSizes">${sizes.map(s=>`<button class="size-btn qa-size" data-s="${s}">${s}</button>`).join("")}</div>
    ${sizeRows?`<details class="qa-guide">
      <summary>📐 Bảng size tham khảo</summary>
      <table class="sg-table" style="margin-top:10px"><thead><tr><th>Size</th><th>Cao (cm)</th><th>Nặng (kg)</th></tr></thead><tbody>${sizeRows}</tbody></table>
      <button type="button" class="mini-link" id="qaFullGuide">Gợi ý size theo chiều cao / cân nặng →</button>
    </details>`:""}
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#qaClose").onclick=close; ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  $$("#qaColors .color-dot").forEach(b=> b.onclick=()=>{
    $$("#qaColors .color-dot").forEach(x=>x.classList.remove("active")); b.classList.add("active");
    qaColor=b.dataset.c; if(!p.image_url) $("#qaThumb").innerHTML=thumbHTML();
  });
  $$("#qaSizes .qa-size").forEach(b=> b.onclick=()=>{
    Cart.add({id:p.id,name:p.name,price:p.price,color:qaColor,size:b.dataset.s,qty:1});
    toast("Đã thêm vào giỏ · size "+b.dataset.s);
    close();
  });
  const fg=$("#qaFullGuide"); if(fg) fg.onclick=()=>{ close(); openSizeGuide(p.catKey); };
}

/* ---------------- HEADER + FOOTER ---------------- */
function megaFor(catKey){
  const cols = [...new Set(S.byCategory(catKey).map(p=>p.collection))];
  if(!cols.length) return "";
  const colLinks = cols.map(c=>`<a href="collection.html?cat=${catKey}&collection=${encodeURIComponent(c)}">${c}</a>`).join("");
  const featured = S.byCategory(catKey)[0];
  return `<div class="mega"><div class="mega-grid">
    <div class="mega-col"><h4>Bộ sưu tập</h4>${colLinks}</div>
    <div class="mega-col"><h4>Xem nhanh</h4>
      <a href="collection.html?cat=${catKey}">Tất cả ${S.CATEGORIES.find(c=>c.key===catKey).name}</a>
      <a href="collection.html?sale=1">Đang giảm giá</a>
      <a href="collection.html">Toàn bộ sản phẩm</a>
    </div>
    <div class="mega-col" style="grid-column:span 2">
      <a href="product.html?id=${featured.id}" style="display:block">
        <div class="thumb" style="aspect-ratio:16/9;border-radius:10px;overflow:hidden">${S.productSVG(featured,{seed:1})}</div>
        <div style="margin-top:8px;font-weight:600;font-size:13px">${featured.name}</div>
      </a>
    </div>
  </div></div>`;
}

function renderHeader(){
  const navItems = [
    {label:"Trang chủ", href:"index.html"},
    {label:"Áo Thun",  href:"collection.html?cat=ao-thun", cat:"ao-thun"},
    {label:"Áo Ba Lỗ", href:"collection.html?cat=ba-lo",   cat:"ba-lo"},
    {label:"Hoodie",   href:"collection.html?cat=hoodie",  cat:"hoodie"},
    {label:"Phụ kiện", href:"collection.html?cat=tote",    cat:"tote"},
    {label:"Sale",     href:"collection.html?sale=1"},
    {label:"Đơn hàng", href:"order.html"},
    {label:"Liên hệ",  href:"#footer"},
  ];
  const nav = navItems.map(n=>{
    const mega = n.cat ? megaFor(n.cat) : "";
    return `<li class="${mega?'has-mega':''}"><a href="${n.href}">${n.label}</a>${mega}</li>`;
  }).join("");

  const annItems = `
    <span>🚚 Miễn phí giao hàng cho đơn từ 500.000₫</span>
    <span>⚡ Sale tới 50% toàn bộ sản phẩm</span>
    <span>↩ Đổi trả miễn phí trong 7 ngày</span>
    <span>✨ Hàng mới về mỗi tuần</span>
    <span>💬 Hỗ trợ tư vấn 24/7</span>`;
  const ann = `<div class="announce"><div class="track">${Array(4).fill(annItems).join("")}</div></div>`;

  const icon = (d)=>`<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const searchI = icon(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`);
  const userI   = icon(`<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>`);
  const cartI   = icon(`<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>`);

  $("#site-header").innerHTML = ann + `
  <header class="header"><div class="wrap header-row">
    <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
    <a class="logo" href="index.html">${S.BRAND.name}<span class="dot">.</span></a>
    <nav><ul class="nav">${nav}</ul></nav>
    <div class="icons">
      <button class="icon-btn search-d" id="searchBtnHeader" aria-label="Tìm kiếm">${searchI}</button>
      <span id="authSlot"></span>
      <div class="cart-menu" id="cartMenu">
        <a class="icon-btn cart-link" href="cart.html" aria-label="Giỏ hàng">${cartI}<span class="cart-count">0</span></a>
        <div class="cart-pop" id="cartPop"></div>
      </div>
    </div>
  </div></header>`;

  // mobile nav
  const mob = document.createElement("div");
  mob.innerHTML = `<div class="overlay" id="ov"></div>
    <aside class="mobile-nav" id="mnav">
      <button class="close" id="mclose" aria-label="Đóng">×</button>
      <a class="logo" href="index.html" style="font-size:20px">${S.BRAND.name}<span class="dot">.</span></a>
      <div style="clear:both"></div>
      <h4>Danh mục</h4>
      ${S.CATEGORIES.map(c=>`<a href="collection.html?cat=${c.key}">${c.name}</a>`).join("")}
      <h4>Khác</h4>
      <a href="collection.html?sale=1">Sale</a>
      <a href="collection.html">Tất cả sản phẩm</a>
      <a href="order.html">Tra cứu đơn hàng</a>
      <a href="#footer">Liên hệ</a>
    </aside>`;
  document.body.appendChild(mob);
  const ov=$("#ov"), mnav=$("#mnav");
  const open=()=>{mnav.classList.add("open");ov.classList.add("show")};
  const close=()=>{mnav.classList.remove("open");ov.classList.remove("show")};
  $("#burger").onclick=open; $("#mclose").onclick=close; ov.onclick=close;
  updateCartCount();   // cập nhật badge số lượng + vẽ mini-cart
  renderAuthSlot();
  // Làm mới mini-cart mỗi lần rê chuột vào (đề phòng giỏ thay đổi ở tab khác)
  const cm=$("#cartMenu"); if(cm) cm.addEventListener("mouseenter", renderCartPop);
  // Mobile (≤880px): tap icon giỏ → mở popup giống desktop hover. Tap nữa hoặc nút
  // "Xem giỏ" trong popup → sang trang giỏ. Tap ra ngoài → đóng popup.
  const cartLink = $(".cart-link");
  const isMobileCart = ()=> window.matchMedia("(max-width:880px)").matches;
  if(cm && cartLink){
    cartLink.addEventListener("click", e=>{
      if(!isMobileCart()) return;
      if(!cm.classList.contains("open")){ e.preventDefault(); renderCartPop(); cm.classList.add("open"); }
    });
    // Tap/scroll/touch ngoài popup → đóng
    const closeIfOutside = (e)=>{
      if(!cm.classList.contains("open")) return;
      if(!e.target.closest("#cartMenu")) cm.classList.remove("open");
    };
    document.addEventListener("click", closeIfOutside);
    document.addEventListener("wheel", closeIfOutside, {passive:true});
    document.addEventListener("touchmove", closeIfOutside, {passive:true});
  }
  const sb=$("#searchBtnHeader"); if(sb) sb.onclick = openSearchModal;
}

/* Search modal: tìm theo tên / chữ in / bộ sưu tập, hiển thị tối đa 8 gợi ý */
function openSearchModal(){
  if($("#searchModal")) return;
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="searchModal";
  ov.innerHTML=`<div class="modal" style="max-width:560px;padding:22px">
    <button class="modal-close" id="schClose" aria-label="Đóng">×</button>
    <h3 class="modal-title" style="margin-bottom:14px">Tìm kiếm sản phẩm</h3>
    <input id="schInput" type="search" placeholder="Tên áo, slogan, bộ sưu tập…" autocomplete="off" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px;outline:none">
    <div id="schResults" style="margin-top:14px;max-height:50vh;overflow-y:auto"></div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#schClose").onclick=close; ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  const input=$("#schInput"), out=$("#schResults");
  setTimeout(()=>input.focus(), 80);
  function draw(q){
    q=(q||"").trim().toLowerCase();
    if(!q){ out.innerHTML=`<p class="muted" style="font-size:13px;margin:8px 4px">Gõ ít nhất 2 ký tự…</p>`; return; }
    const list=S.PRODUCTS.filter(p=>{
      const hay=[p.name,p.print,p.collection,p.catName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    }).slice(0,8);
    if(!list.length){ out.innerHTML=`<p class="muted" style="font-size:13.5px;text-align:center;padding:20px 0">Không tìm thấy sản phẩm phù hợp.</p>`; return; }
    out.innerHTML = list.map(p=>{
      const ci0=(p.color_images||{})[p.colors[0]];
      const img = (ci0&&ci0[0]) ? ci0[0] : (p.image_url||"");
      const thumb = img ? `<img src="${escapeXML(img)}" alt="" style="width:54px;height:64px;object-fit:cover;border-radius:8px;background:var(--bg-soft)">` : `<div style="width:54px;height:64px;border-radius:8px;background:var(--bg-soft)"></div>`;
      return `<a href="product.html?id=${encodeURIComponent(p.id)}" style="display:flex;gap:12px;padding:10px 6px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;align-items:center">
        ${thumb}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${escapeXML(p.name)}</div><div class="muted" style="font-size:12px">${escapeXML(p.collection||p.catName||"")}</div></div>
        <div style="font-weight:700;font-size:14px;white-space:nowrap">${money(p.price)}</div>
      </a>`;
    }).join("");
  }
  draw("");
  input.addEventListener("input", e=>draw(e.target.value));
  input.addEventListener("keydown", e=>{
    if(e.key==="Enter"){
      const q=input.value.trim(); if(!q) return;
      location.href = "collection.html?q="+encodeURIComponent(q);
    }
  });
}

/* Mini-cart: popup hover trên icon giỏ hàng — xem nhanh sản phẩm trong giỏ.
   Tự vẽ lại mỗi khi giỏ thay đổi (qua updateCartCount trong Cart.save). */
function renderCartPop(){
  const pop = $("#cartPop");
  if(!pop) return;
  // Nút × chỉ hiện trên mobile (CSS .cart-pop-close ẩn trên desktop)
  const closeBtn = `<button type="button" class="cart-pop-close" id="cartPopCloseBtn" aria-label="Đóng">×</button>`;
  if(!Cart.items.length){
    pop.innerHTML = `<div class="cart-pop-inner">
      <div class="cart-pop-head"><span>Giỏ hàng</span>${closeBtn}</div>
      <div class="cart-pop-empty">
        <div class="ic">🛍️</div>
        <p>Giỏ hàng đang trống</p>
        <a class="btn btn-dark btn-block" href="collection.html">Mua sắm ngay</a>
      </div></div>`;
    bindCartPopClose();
    return;
  }
  const sub = Cart.subtotal();
  const rows = Cart.items.map((it,i)=>{
    const p = S.getProduct(it.id);
    const img = p ? productImage(p,{color:it.color})
      : S.productSVG({type:"tee",print:it.name,collection:"",colors:[it.color||"#ccc"],name:it.name},{color:it.color});
    const url = `product.html?id=${encodeURIComponent(it.id)}`;
    return `<div class="cart-pop-item">
      <a class="cpi-thumb" href="${url}">${img}</a>
      <div class="cpi-info">
        <a class="cpi-name" href="${url}">${escapeXML(it.name)}</a>
        <div class="cpi-meta">${it.size?`Size ${escapeXML(it.size)} · `:""}SL ${it.qty}</div>
        <div class="cpi-price">${money(it.price*it.qty)}</div>
      </div>
      <button class="cpi-rm" data-cprm="${i}" aria-label="Xóa" title="Xóa">×</button>
    </div>`;
  }).join("");
  pop.innerHTML = `<div class="cart-pop-inner">
    <div class="cart-pop-head"><span>Giỏ hàng (${Cart.count()})</span>${closeBtn}</div>
    <div class="cart-pop-list">${rows}</div>
    <div class="cart-pop-foot">
      <div class="cart-pop-sub"><span>Tạm tính</span><span>${money(sub)}</span></div>
      <a class="btn btn-dark btn-block" href="cart.html">Xem giỏ &amp; thanh toán</a>
    </div>
  </div>`;
  pop.querySelectorAll("[data-cprm]").forEach(b=> b.onclick=(e)=>{
    e.preventDefault(); e.stopPropagation();
    Cart.remove(+b.dataset.cprm);   // Cart.save() → updateCartCount() → renderCartPop()
  });
  bindCartPopClose();
}
function bindCartPopClose(){
  const btn = $("#cartPopCloseBtn");
  if(!btn) return;
  btn.onclick = ()=>{ const cm=$("#cartMenu"); if(cm) cm.classList.remove("open"); };
}

function renderFooter(){
  const policies = ["Chính sách bảo mật","Chính sách giao nhận","Chính sách đổi trả","Chính sách thanh toán","Điều khoản dịch vụ"];
  $("#site-footer").innerHTML = `
  <footer class="footer" id="footer"><div class="wrap">
    <div class="foot-grid">
      <div>
        <div class="logo">${S.BRAND.name}<span class="dot">.</span></div>
        <p style="max-width:260px;color:#b9b9b9">${S.BRAND.tagline}. Thời trang local brand cho người trẻ dám khác biệt.</p>
        <div class="socials">
          <a href="#" aria-label="Facebook">f</a>
          <a href="#" aria-label="Instagram">◎</a>
          <a href="#" aria-label="TikTok">♪</a>
        </div>
      </div>
      <div><h5>Danh mục</h5><ul>
        ${S.CATEGORIES.slice(0,6).map(c=>`<li><a href="collection.html?cat=${c.key}">${c.name}</a></li>`).join("")}
      </ul></div>
      <div><h5>Hỗ trợ</h5><ul>
        ${policies.map(p=>`<li><a href="#" onclick="return false">${p}</a></li>`).join("")}
      </ul></div>
      <div><h5>Liên hệ</h5>
        <p style="color:#b9b9b9;line-height:1.9">
          Hotline: <strong style="color:#fff">${S.BRAND.hotline}</strong><br>
          Email: ${S.BRAND.email}<br>
          ${S.BRAND.hours}
        </p>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${new Date().getFullYear()} ${S.BRAND.name}. Demo dựng bởi yêu cầu khách hàng.</span>
      <span>Thiết kế lấy cảm hứng từ phong cách streetwear Việt Nam.</span>
    </div>
  </div></footer>`;
}

/* ---------------- TRANG CHỦ ---------------- */
function scrollerRow(products){
  return `<div class="scroller">
    <button class="scroll-btn prev">‹</button>
    <div class="row">${products.map(productCard).join("")}</div>
    <button class="scroll-btn next">›</button>
  </div>`;
}
function featureBlock({eyebrow,title,sub,cta,href,color,products,reverse}){
  const banner = `<a class="feature-banner" href="${href}" style="background:linear-gradient(135deg,${color[0]},${color[1]})">
      <div class="label"><div class="eyebrow">${eyebrow}</div><h3>${title}</h3>
      <span class="btn btn-light">${cta}</span></div></a>`;
  const copy = `<div class="feature-copy" style="width:100%">
      <div style="margin-bottom:14px"><div class="section-head" style="margin-bottom:6px"><div>
        <div class="eyebrow" style="color:var(--sale);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600">${sub}</div>
        <h2 style="font-family:var(--font-display);text-transform:uppercase;font-size:clamp(22px,2.6vw,30px)">${title}</h2>
      </div></div></div>
      ${scrollerRow(products)}</div>`;
  return `<div class="feature ${reverse?'rev':''}">${reverse?copy+banner:banner+copy}</div>`;
}

function renderHome(){
  const root = $("#page");
  const blocks = [
    {eyebrow:"Signature",     title:"Relaxed Fit",   sub:"Bán chạy nhất", cta:"Khám phá", href:"collection.html?cat=ao-thun", color:["#1d1d1d","#444"], products:S.byCollection("Coffee Club").concat(S.byCategory("ao-thun")).slice(0,8)},
    {eyebrow:"Aesthetic",     title:"Ringer Tee",    sub:"Phong cách cổ điển", cta:"Mua ngay", href:"collection.html?cat=ringer", color:["#2c3a4f","#5b7da0"], products:S.byCategory("ringer").concat(S.byCollection("Ocean Calling")).slice(0,8), reverse:true},
    {eyebrow:"Pure comfort",  title:"Polo Relaxed",  sub:"Lịch sự mà thoải mái", cta:"Khám phá", href:"collection.html?cat=polo", color:["#3f5c46","#6f7445"], products:S.byCategory("polo").concat(S.byCollection("Old Money")).slice(0,8)},
    {eyebrow:"New drop",      title:"Tank Top",      sub:"Hè 2026", cta:"Khám phá", href:"collection.html?cat=ba-lo", color:["#b5523a","#d8a441"], products:S.byCategory("ba-lo").slice(0,8), reverse:true},
    {eyebrow:"Everyday",      title:"Hoodie & Sweater", sub:"Ấm áp mỗi ngày", cta:"Khám phá", href:"collection.html?cat=hoodie", color:["#2c3a4f","#1c1c1c"], products:S.byCategory("hoodie").concat(S.byCategory("sweater")).slice(0,8)},
  ];

  const hero = `<section class="hero">
    <div class="hero-inner">
      <h1>Be Bold.<br>Be New.<br>Be <em>Original.</em></h1>
      <p>${S.BRAND.name} — local brand streetwear cho người trẻ dám thể hiện chất riêng.</p>
      <a class="btn btn-light" href="collection.html">Khám phá bộ sưu tập</a>
    </div>
    <div class="ticker"><div class="track">${Array(6).fill(`<span>★ FREESHIP 500K</span><span>★ SALE 50%</span><span>★ NEW ARRIVALS</span><span>★ ${S.BRAND.tagline.toUpperCase()}</span>`).join("")}</div></div>
  </section>`;

  const cats = `<section class="section tight"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Mua theo danh mục</div><h2>Danh mục nổi bật</h2></div>
      <a class="more" href="collection.html">Tất cả</a></div>
    <div class="cats">
      ${[["ao-thun","#1d1d1d","#555"],["hoodie","#2c3a4f","#557"],["polo","#3f5c46","#697"],["tote","#b5523a","#d8a441"]]
        .map(([k,a,b])=>{const c=S.CATEGORIES.find(x=>x.key===k);
          return `<a class="cat-tile" href="collection.html?cat=${k}" style="background:linear-gradient(135deg,${a},${b})"><span>${c.name}</span></a>`}).join("")}
    </div></div></section>`;

  const strip = `<div class="strip"><div class="track">${Array(8).fill(`<span>${S.BRAND.name}</span><span class="star">✦</span><span>${S.BRAND.tagline.toUpperCase()}</span><span class="star">✦</span>`).join("")}</div></div>`;

  const perks = `<section class="section tight"><div class="wrap"><div class="perks">
    <div class="perk"><div class="ic">🚚</div><h5>Freeship 500K</h5><p>Toàn quốc cho đơn từ 500.000₫</p></div>
    <div class="perk"><div class="ic">↩</div><h5>Đổi trả 7 ngày</h5><p>Đổi size, đổi mẫu dễ dàng</p></div>
    <div class="perk"><div class="ic">✓</div><h5>Chất liệu cao cấp</h5><p>Cotton 100% form relaxed</p></div>
    <div class="perk"><div class="ic">💬</div><h5>Hỗ trợ 24/7</h5><p>Nhắn tin là có phản hồi</p></div>
  </div></div></section>`;

  root.innerHTML = hero + cats +
    `<section class="section"><div class="wrap">${blocks.map(featureBlock).join("")}</div></section>` +
    strip + perks + newsletterHTML();

  bindScrollers();
  bindNewsletter();
}

/* ---------------- NEWSLETTER ---------------- */
function newsletterHTML(){
  return `<section class="newsletter"><div class="wrap">
    <h2>Đăng ký nhận ưu đãi</h2>
    <p>Nhập email để nhận mã giảm giá, quà tặng và tin sản phẩm mới nhất.</p>
    <form class="subscribe" id="nl"><input type="email" placeholder="Email của bạn" required>
      <button class="btn btn-dark" type="submit">Đăng ký</button></form>
  </div></section>`;
}
function bindNewsletter(){
  const f=$("#nl"); if(!f) return;
  f.onsubmit=e=>{
    e.preventDefault();
    const btn=f.querySelector("button[type=submit]");
    if(btn && btn.disabled) return;
    if(btn){ btn.disabled=true; setTimeout(()=>{ btn.disabled=false; }, 1500); }
    f.reset();
    toast("Cảm ơn! Bạn đã đăng ký.");
  };
}
function bindScrollers(){
  $$(".scroller").forEach(sc=>{
    const row=$(".row",sc);
    $(".prev",sc).onclick=()=>row.scrollBy({left:-row.clientWidth*0.8,behavior:"smooth"});
    $(".next",sc).onclick=()=>row.scrollBy({left: row.clientWidth*0.8,behavior:"smooth"});
  });
}

/* ---------------- TRANG DANH SÁCH ---------------- */
function renderCollection(){
  const root=$("#page");
  let activeCat = param("cat") || "";
  let activeCol = param("collection") || "";
  const saleOnly = param("sale")==="1";
  const query = (param("q")||"").trim().toLowerCase();

  const state = { cat:activeCat, cols:activeCol?[activeCol]:[], price:"", sort:"featured", sale:saleOnly, q:query };

  const title = query ? `Kết quả: "${query}"`
    : saleOnly ? "Đang giảm giá"
    : activeCat ? S.CATEGORIES.find(c=>c.key===activeCat)?.name
    : "Tất cả sản phẩm";

  root.innerHTML = `
  <div class="wrap page-head">
    <div class="crumb"><a href="index.html">Trang chủ</a> / ${title}</div>
    <h1 class="page-title">${title}</h1>
  </div>
  <div class="filter-backdrop" id="fbackdrop"></div>
  <div class="wrap shop">
    <aside class="filters" id="filters">
      <div class="filters-head"><span>Bộ lọc</span><button class="close" id="fclose" aria-label="Đóng">×</button></div>
      <div class="filter-group"><h4>Danh mục</h4>
        <label><input type="radio" name="cat" value="" ${!state.cat?'checked':''}> Tất cả</label>
        ${S.CATEGORIES.map(c=>`<label><input type="radio" name="cat" value="${c.key}" ${state.cat===c.key?'checked':''}> ${c.name}</label>`).join("")}
      </div>
      <div class="filter-group"><h4>Bộ sưu tập</h4>
        ${S.COLLECTIONS.map(c=>`<label><input type="checkbox" name="col" value="${c}" ${state.cols.includes(c)?'checked':''}> ${c}</label>`).join("")}
      </div>
      <div class="filter-group"><h4>Mức giá</h4>
        ${[["","Tất cả"],["lt200","Dưới 200.000₫"],["200-300","200.000₫ – 300.000₫"],["gt300","Trên 300.000₫"]]
          .map(([v,l])=>`<label><input type="radio" name="price" value="${v}" ${state.price===v?'checked':''}> ${l}</label>`).join("")}
      </div>
      <div class="filter-group"><label><input type="checkbox" id="saleChk" ${state.sale?'checked':''}> Chỉ hàng giảm giá</label></div>
    </aside>
    <div>
      <div class="shop-toolbar">
        <button class="btn btn-outline filter-toggle" id="ftoggle" style="padding:9px 18px">Lọc ▾</button>
        <span class="count" id="count"></span>
        <select id="sort">
          <option value="featured">Nổi bật</option>
          <option value="price-asc">Giá: thấp → cao</option>
          <option value="price-desc">Giá: cao → thấp</option>
          <option value="discount">Giảm giá nhiều</option>
          <option value="name">Tên A → Z</option>
        </select>
      </div>
      <div class="grid" id="grid"></div>
      <div id="empty" style="display:none;text-align:center;padding:70px 0;color:var(--muted)">Không có sản phẩm phù hợp bộ lọc.</div>
    </div>
  </div>`;

  function apply(){
    let list = S.PRODUCTS.slice();
    if(state.q){
      const q=state.q;
      list = list.filter(p=>{
        const hay=[p.name,p.print,p.collection,p.catName].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if(state.cat)  list = list.filter(p=>p.catKey===state.cat);
    if(state.cols.length) list = list.filter(p=>state.cols.includes(p.collection));
    if(state.sale) list = list.filter(p=>p.sale);
    if(state.price==="lt200") list=list.filter(p=>p.price<200000);
    if(state.price==="200-300") list=list.filter(p=>p.price>=200000&&p.price<=300000);
    if(state.price==="gt300") list=list.filter(p=>p.price>300000);
    if(state.sort==="price-asc") list.sort((a,b)=>a.price-b.price);
    if(state.sort==="price-desc") list.sort((a,b)=>b.price-a.price);
    if(state.sort==="discount") list.sort((a,b)=>S.discountPct(b.price,b.compare)-S.discountPct(a.price,a.compare));
    if(state.sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name,"vi"));
    $("#grid").innerHTML = list.map(productCard).join("");
    $("#count").textContent = list.length + " sản phẩm";
    $("#empty").style.display = list.length? "none":"block";
  }
  $$('input[name=cat]').forEach(r=>r.onchange=e=>{state.cat=e.target.value;apply()});
  $$('input[name=col]').forEach(r=>r.onchange=()=>{state.cols=$$('input[name=col]:checked').map(x=>x.value);apply()});
  $$('input[name=price]').forEach(r=>r.onchange=e=>{state.price=e.target.value;apply()});
  $("#saleChk").onchange=e=>{state.sale=e.target.checked;apply()};
  $("#sort").onchange=e=>{state.sort=e.target.value;apply()};
  // mobile filter drawer (trượt từ trái, có backdrop + khoá cuộn nền)
  const fil=$("#filters"), fbd=$("#fbackdrop");
  const openF =()=>{ fil.classList.add("open");  fbd&&fbd.classList.add("show");  document.body.style.overflow="hidden"; };
  const closeF=()=>{ fil.classList.remove("open"); fbd&&fbd.classList.remove("show"); document.body.style.overflow=""; };
  $("#ftoggle").onclick=openF;
  $("#fclose").onclick=closeF;
  if(fbd) fbd.onclick=closeF;
  apply();
}

/* ---------------- HƯỚNG DẪN CHỌN SIZE ---------------- */
const SIZE_CHART = [
  {size:"S",   hMin:150,hMax:160, wMin:40,wMax:53, chest:"88–92",   length:68},
  {size:"M",   hMin:158,hMax:168, wMin:50,wMax:63, chest:"92–98",   length:70},
  {size:"L",   hMin:165,hMax:174, wMin:60,wMax:72, chest:"98–104",  length:72},
  {size:"XL",  hMin:170,hMax:180, wMin:70,wMax:83, chest:"104–110", length:74},
  {size:"2XL", hMin:176,hMax:188, wMin:80,wMax:95, chest:"110–118", length:76},
];
function suggestSize(h,w){
  let best=SIZE_CHART[0], bestScore=Infinity;
  SIZE_CHART.forEach(s=>{
    const dh = h<s.hMin ? s.hMin-h : h>s.hMax ? h-s.hMax : 0;
    const dw = w<s.wMin ? s.wMin-w : w>s.wMax ? w-s.wMax : 0;
    const score = dw*1.6 + dh*0.8;   // cân nặng quan trọng hơn cho áo
    if(score<bestScore){ bestScore=score; best=s; }
  });
  return best;
}
function openSizeGuide(catKey){
  if($("#sizeGuideModal")) return;
  const isTote = catKey==="tote";
  const rows = SIZE_CHART.map(s=>`<tr data-size="${s.size}">
    <td><b>${s.size}</b></td><td>${s.hMin}–${s.hMax}</td><td>${s.wMin}–${s.wMax}</td></tr>`).join("");
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="sizeGuideModal";
  ov.innerHTML=`<div class="modal sg-modal">
    <button class="modal-close" id="sgClose" aria-label="Đóng">×</button>
    <h3 class="modal-title">Hướng dẫn chọn size</h3>
    ${isTote?`<p class="muted" style="font-size:13.5px">Sản phẩm phụ kiện này là <b>Freesize</b> — phù hợp mọi nhu cầu.</p>`:`
    <p class="muted" style="font-size:13px;margin-bottom:14px">Bảng size tiêu chuẩn (form relaxed). Số đo mang tính tham khảo, có thể lệch 1–2cm tuỳ dáng người.</p>
    <div class="sg-tablewrap"><table class="sg-table">
      <thead><tr><th>Size</th><th>Cao (cm)</th><th>Nặng (kg)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="sg-tool">
      <div class="sg-tool-title">✨ Gợi ý size theo số đo của bạn</div>
      <div class="sg-fields">
        <label class="fld"><span>Chiều cao (cm)</span><input id="sgH" type="number" inputmode="numeric" min="120" max="210" placeholder="VD: 170"></label>
        <label class="fld"><span>Cân nặng (kg)</span><input id="sgW" type="number" inputmode="numeric" min="30" max="150" placeholder="VD: 62"></label>
        <button class="btn btn-dark" id="sgGo" type="button">Gợi ý</button>
      </div>
      <div class="sg-result" id="sgResult" hidden></div>
    </div>`}
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#sgClose").onclick=close; ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  const go=$("#sgGo");
  if(go) go.onclick=()=>{
    const h=+$("#sgH").value, w=+$("#sgW").value;
    if(!h||!w){ toast("Nhập chiều cao và cân nặng"); return; }
    const s=suggestSize(h,w);
    $$(".sg-table tbody tr").forEach(tr=>tr.classList.toggle("hl", tr.dataset.size===s.size));
    const onPDP = !!document.querySelector(`#sizes .size-btn[data-s="${s.size}"]`);
    const res=$("#sgResult"); res.hidden=false;
    res.innerHTML=`Với <b>${h}cm</b> · <b>${w}kg</b>, size phù hợp nhất là <span class="sg-badge">${s.size}</span>.
      <div class="muted" style="font-size:12.5px;margin-top:6px">Thích mặc rộng hơn → chọn lên 1 size; thích ôm → giảm 1 size.</div>
      ${onPDP?`<button class="btn btn-dark btn-block" id="sgPick" type="button" style="margin-top:12px">Chọn size ${s.size}</button>`:""}`;
    const pick=$("#sgPick");
    if(pick) pick.onclick=()=>{ const b=document.querySelector(`#sizes .size-btn[data-s="${s.size}"]`); if(b){ b.click(); toast("Đã chọn size "+s.size); } close(); };
  };
}

/* ---------------- TRANG CHI TIẾT ---------------- */
async function renderProduct(){
  const root=$("#page");
  const id = param("id");
  let p = id ? S.getProduct(id) : null;
  // Cache miss → fetch trực tiếp DB (tránh trường hợp PRODUCTS chưa load
  // hoặc id trong URL không khớp gì trong cache local)
  if(!p && id){
    root.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center;color:var(--muted)">Đang tải sản phẩm…</div>`;
    try{ p = await DB.getProduct(id); }catch(e){ console.warn("getProduct DB",e); }
  }
  if(!p){
    console.warn("renderProduct: không tìm được SP với id=",id,"→ fallback PRODUCTS[0]");
    p = S.PRODUCTS[0];
  }
  if(!p){
    root.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center"><h2>Sản phẩm không tồn tại</h2><p class="muted" style="margin-top:8px">Quay về <a href="collection.html" style="text-decoration:underline">danh sách sản phẩm</a></p></div>`;
    return;
  }
  let color = p.colors[0], size = "", qty = 1;
  const off = S.discountPct(p.price,p.compare);
  const soldOut = (p.stock!=null && p.stock<=0);

  // Gallery theo MÀU: ảnh của màu đang chọn → ảnh chung → SVG fallback
  function galleryFor(c){
    const ci = p.color_images || {};
    const own = (ci[c]||[]).filter(Boolean);
    if(own.length) return own.map(u=>`<img class="thumb-img" src="${u}" alt="${escapeXML(p.name)}">`);
    const flat = Array.isArray(p.images)?p.images.filter(Boolean):[];
    // Màu mặc định (đầu tiên) chưa gán ảnh riêng → dùng ảnh thật chung (đẹp hơn)
    if(c===p.colors[0] && flat.length) return flat.map(u=>`<img class="thumb-img" src="${u}" alt="${escapeXML(p.name)}">`);
    // Màu khác chưa có ảnh riêng → dựng mockup SVG đúng màu để bấm màu thấy đổi ngay
    return [S.productSVG(p,{color:c}), S.productSVG(p,{back:true,color:c})];
  }
  let gallery = galleryFor(color);
  let slideIdx = 0, slideTimer = null;

  root.innerHTML = `
  <div class="wrap page-head">
    <div class="crumb"><a href="index.html">Trang chủ</a> / <a href="collection.html?cat=${p.catKey}">${p.catName}</a> / ${p.shortName}</div>
  </div>
  <div class="wrap pdp">
    <div class="gallery">
      <div class="main" id="main">
        <div class="pdp-stage" id="mainStage">${gallery[0]||""}</div>
        <button class="pdp-nav prev" id="gPrev" type="button" aria-label="Ảnh trước">‹</button>
        <button class="pdp-nav next" id="gNext" type="button" aria-label="Ảnh sau">›</button>
      </div>
      <div class="thumbs" id="thumbs"></div>
    </div>
    <div class="pdp-info">
      <div class="sub">${p.collection}</div>
      <h1>${p.name}</h1>
      <div class="price">
        <span class="now">${money(p.price)}</span>
        ${p.compare>p.price?`<span class="was">${money(p.compare)}</span><span class="off">-${off}%</span>`:``}
      </div>
      ${((+p.sold||0)>0 || (+p.likes||0)>0)?`<div class="pdp-stats">
        ${(+p.sold||0)>0?`<span class="stat-sold">Đã bán ${formatCount(p.sold)}</span>`:""}
        ${(+p.likes||0)>0?`<span class="stat-like">♥ ${formatCount(p.likes)} yêu thích</span>`:""}
      </div>`:""}
      ${soldOut?`<div style="color:var(--sale);font-weight:700;margin:0 0 10px">● Hết hàng</div>`
        :(p.stock!=null&&p.stock<=5?`<div class="muted" style="margin:0 0 10px">Chỉ còn ${p.stock} sản phẩm</div>`:``)}
      <p style="color:var(--ink-soft);font-size:14.5px">Form relaxed fit, chất cotton 100% co giãn nhẹ, in/thêu bền màu. Phong cách ${p.collection}.</p>

      <div class="opt-label">Màu sắc <span class="muted" id="colorName"></span></div>
      <div class="color-row" id="colors">
        ${p.colors.map((c,i)=>`<button class="color-dot ${i===0?'active':''}" data-c="${escapeXML(c)}" style="background:${safeColor(c)}" title="${escapeXML(c)}"></button>`).join("")}
      </div>

      <div class="opt-label">Kích cỡ <a href="#" class="muted" onclick="openSizeGuide('${p.catKey}');return false" style="text-decoration:underline">📐 Hướng dẫn chọn size</a></div>
      <div class="opt-row" id="sizes">
        ${p.sizes.map(s=>`<button class="size-btn" data-s="${s}">${s}</button>`).join("")}
      </div>

      <div class="opt-label">Số lượng</div>
      <div class="qty"><button id="minus">−</button><span id="qval">1</span><button id="plus">+</button></div>

      <div class="pdp-actions">
        ${soldOut
          ? `<button class="btn btn-dark btn-block" disabled style="opacity:.5;cursor:not-allowed">Hết hàng</button>`
          : `<button class="btn btn-outline" id="addCart">Thêm vào giỏ</button>
             <button class="btn btn-dark" id="buyNow">Mua ngay</button>`}
      </div>

      <div class="accordion">
        <details class="acc-item" open><summary>Mô tả</summary><div class="acc-body">
          Áo thuộc bộ sưu tập <strong>${p.collection}</strong> của ${S.BRAND.name}. Thiết kế tối giản, dễ phối, hợp đi chơi lẫn đi làm.
        </div></details>
        <details class="acc-item"><summary>Chất liệu & bảo quản</summary><div class="acc-body"><ul>
          <li>Cotton 100% / cotton pha, định lượng dày dặn</li>
          <li>Giặt máy nước lạnh, lộn trái khi giặt</li>
          <li>Không tẩy, ủi nhiệt độ vừa</li>
        </ul></div></details>
        <details class="acc-item"><summary>Vận chuyển & đổi trả</summary><div class="acc-body"><ul>
          <li>Giao toàn quốc 2–4 ngày, freeship đơn từ 500.000₫</li>
          <li>Đổi size/mẫu trong 7 ngày</li>
        </ul></div></details>
      </div>
    </div>
  </div>

  <section class="section"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Gợi ý</div><h2>Có thể bạn thích</h2></div></div>
    <div class="grid">${S.byCollection(p.collection).filter(x=>x.id!==p.id).concat(S.byCategory(p.catKey).filter(x=>x.id!==p.id)).slice(0,4).map(productCard).join("")}</div>
  </div></section>`;

  // ----- Gallery slideshow theo màu (tự chuyển ảnh) -----
  function showSlide(i){
    if(!gallery.length) return;
    slideIdx = (i+gallery.length)%gallery.length;
    $("#mainStage").innerHTML = gallery[slideIdx];
    $$("#thumbs button").forEach((b,bi)=>b.classList.toggle("active",bi===slideIdx));
  }
  function restartAuto(){
    if(slideTimer) clearInterval(slideTimer);
    if(gallery.length>1) slideTimer = setInterval(()=>showSlide(slideIdx+1), 3500);
  }
  function renderThumbs(){
    $("#thumbs").innerHTML = gallery.map((g,i)=>`<button class="${i===slideIdx?'active':''}" data-i="${i}">${g}</button>`).join("");
    $$("#thumbs button").forEach(b=> b.onclick=()=>{ showSlide(+b.dataset.i); restartAuto(); });
    const showNav = gallery.length>1;
    $("#gPrev").style.display = $("#gNext").style.display = showNav?"flex":"none";
  }
  function setColor(c){
    color=c; gallery=galleryFor(c); slideIdx=0;
    $("#mainStage").innerHTML = gallery[0]||"";
    renderThumbs(); restartAuto();
  }
  renderThumbs(); restartAuto();
  $("#gPrev").onclick=()=>{ showSlide(slideIdx-1); restartAuto(); };
  $("#gNext").onclick=()=>{ showSlide(slideIdx+1); restartAuto(); };
  // colors → đổi gallery sang ảnh của màu đó
  $$("#colors .color-dot").forEach(b=> b.onclick=()=>{
    $$("#colors .color-dot").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); setColor(b.dataset.c);
  });
  // sizes
  $$("#sizes .size-btn").forEach(b=> b.onclick=()=>{
    $$("#sizes .size-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); size=b.dataset.s;
  });
  // qty
  $("#minus").onclick=()=>{qty=Math.max(1,qty-1);$("#qval").textContent=qty};
  $("#plus").onclick=()=>{qty++;$("#qval").textContent=qty};
  // add / buy
  function doAdd(){
    if(!size){ toast("Vui lòng chọn size"); return false; }
    if(p.stock!=null && qty>p.stock){ toast("Chỉ còn "+p.stock+" sản phẩm"); return false; }
    Cart.add({id:p.id,name:p.name,price:p.price,color,size,qty});
    return true;
  }
  const acBtn=$("#addCart"), bnBtn=$("#buyNow");
  if(acBtn) acBtn.onclick=()=>{ if(doAdd()) toast("Đã thêm vào giỏ"); };
  if(bnBtn) bnBtn.onclick=()=>{ if(doAdd()) location.href="cart.html"; };
}

/* ---------------- TRANG GIỎ HÀNG ---------------- */
function renderCart(){
  const root=$("#page");
  function draw(){
    if(!Cart.items.length){
      root.innerHTML = `<div class="wrap empty-cart">
        <div class="ic">🛍️</div>
        <h2 class="page-title" style="font-size:28px">Giỏ hàng trống</h2>
        <p class="muted" style="margin:10px 0 22px">Chưa có sản phẩm nào. Cùng khám phá nhé!</p>
        <a class="btn btn-dark" href="collection.html">Tiếp tục mua sắm</a>
      </div>`;
      return;
    }
    const sub = Cart.subtotal();
    const ship = sub>=500000 || sub===0 ? 0 : 30000;
    const items = Cart.items.map((it,i)=>{
      const p=S.getProduct(it.id);
      return `<div class="cart-item">
        <a class="ci-thumb" href="product.html?id=${it.id}">${p?productImage(p,{color:it.color}):S.productSVG({type:"tee",print:it.name,collection:"",colors:[it.color||"#ccc"],name:it.name},{color:it.color})}</a>
        <div>
          <h4><a href="product.html?id=${it.id}">${it.name}</a></h4>
          <div class="ci-meta">Màu: <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safeColor(it.color)};vertical-align:middle;border:1px solid #ccc"></span> · Size: ${escapeXML(it.size||"")}</div>
          <div class="qty"><button data-act="dec" data-i="${i}">−</button><span>${it.qty}</span><button data-act="inc" data-i="${i}">+</button></div>
          <a class="remove" data-act="rm" data-i="${i}">Xóa</a>
        </div>
        <div style="text-align:right;font-weight:700">${money(it.price*it.qty)}</div>
      </div>`;
    }).join("");

    root.innerHTML = `
    <div class="wrap page-head"><div class="crumb"><a href="index.html">Trang chủ</a> / Giỏ hàng</div>
      <h1 class="page-title">Giỏ hàng (${Cart.count()})</h1></div>
    <div class="wrap cart-wrap">
      <div>${items}</div>
      <aside class="summary">
        <h3>Tóm tắt đơn hàng</h3>
        <div class="line"><span>Tạm tính</span><span>${money(sub)}</span></div>
        <div class="line"><span>Phí giao hàng</span><span>${ship?money(ship):"Miễn phí"}</span></div>
        ${sub<500000?`<div class="line" style="color:var(--sale);font-size:12.5px">Mua thêm ${money(500000-sub)} để được freeship</div>`:``}
        <div class="total"><span>Tổng cộng</span><span>${money(sub+ship)}</span></div>
        <button class="btn btn-dark btn-block" style="margin-top:18px" id="checkoutBtn">Tiến hành đặt hàng</button>
        <a class="btn btn-outline btn-block" style="margin-top:10px" href="collection.html">Tiếp tục mua sắm</a>
      </aside>
    </div>`;

    $$('[data-act]').forEach(b=> b.onclick=()=>{
      const i=+b.dataset.i;
      if(b.dataset.act==="inc") Cart.setQty(i,Cart.items[i].qty+1);
      if(b.dataset.act==="dec") Cart.setQty(i,Cart.items[i].qty-1);
      if(b.dataset.act==="rm")  Cart.remove(i);
      draw();
    });
    const cb=$("#checkoutBtn"); if(cb) cb.onclick=openCheckout;
  }
  draw();
}

/* ---------------- CHECKOUT (đặt hàng) ---------------- */
function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s||"").trim()); }

function openCheckout(){
  if(!Cart.items.length){ toast("Giỏ hàng trống"); return; }
  const sub=Cart.subtotal(); const ship = sub>=500000?0:30000; const total=sub+ship;
  const last = getLastContact() || {};
  const prefillName = (Auth.isLoggedIn() && Auth.displayName()) || last.customer_name || "";
  const prefillPhone = last.phone || "";
  const prefillAddress = last.address || "";
  const prefillEmail = (Auth.isLoggedIn() && Auth.email()) || last.email || "";
  const accountInfo = Auth.isLoggedIn()
    ? `<div class="notice" style="background:#eef7f1;color:#1d6c4d;border:1px solid #c5e6d4;font-size:13px">
        Đặt hàng với tài khoản <b>${escapeXML(Auth.email())}</b> — đơn sẽ lưu vào "Đơn của tôi".
       </div>`
    : `<div class="notice" style="background:#fff6e0;color:#7a5b00;border:1px solid #f0d98a;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span>Mẹo: <a href="#" id="ckLogin" style="text-decoration:underline;color:inherit"><b>Đăng nhập Google</b></a> để lưu đơn vào tài khoản & xem trên mọi thiết bị.</span>
       </div>`;
  const emailHint = Email.enabled
    ? `Email xác nhận đơn hàng sẽ được gửi tới đây.`
    : `Dùng để liên hệ khi cần xác nhận đơn.`;
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="checkoutModal";
  ov.innerHTML=`<div class="modal">
    <button class="modal-close" id="ckClose" aria-label="Đóng">×</button>
    <h3 class="modal-title">Thông tin đặt hàng</h3>
    ${accountInfo}
    <form id="ckForm" novalidate>
      <label class="fld"><span>Họ và tên *</span><input name="name" required value="${escapeXML(prefillName)}"></label>
      <label class="fld"><span>Số điện thoại *</span><input name="phone" required inputmode="tel" value="${escapeXML(prefillPhone)}"></label>
      <label class="fld"><span>Email *</span><input name="email" type="email" required inputmode="email" autocomplete="email" placeholder="ban@example.com" value="${escapeXML(prefillEmail)}">
        <small class="muted" style="font-size:12px;display:block;margin-top:4px">${emailHint}</small></label>
      <label class="fld"><span>Địa chỉ nhận hàng *</span><textarea name="address" rows="2" required>${escapeXML(prefillAddress)}</textarea></label>
      <label class="fld"><span>Ghi chú (tuỳ chọn)</span><input name="note"></label>
      <div class="ck-summary">
        <div class="line"><span>Tạm tính</span><span>${money(sub)}</span></div>
        <div class="line"><span>Giao hàng</span><span>${ship?money(ship):"Miễn phí"}</span></div>
        <div class="total"><span>Tổng cộng</span><span>${money(total)}</span></div>
      </div>
      <button class="btn btn-dark btn-block" type="submit" id="ckSubmit">Đặt hàng (COD)</button>
      <p class="muted" style="font-size:12px;text-align:center;margin-top:8px">Thanh toán khi nhận hàng • ${DB.cloud?"Đơn lưu trên hệ thống":"Chế độ demo (lưu trên máy)"}</p>
    </form>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#ckClose").onclick=close;
  ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  const ckLogin=$("#ckLogin"); if(ckLogin) ckLogin.onclick=(e)=>{ e.preventDefault(); close(); openLoginModal(); };
  $("#ckForm").onsubmit=async(e)=>{
    e.preventDefault();
    const f=e.target;
    const name=f.name.value.trim(), phone=f.phone.value.trim(),
          email=f.email.value.trim(), address=f.address.value.trim();
    if(!name||!phone||!address||!email){ toast("Vui lòng điền đủ tên, SĐT, email, địa chỉ"); return; }
    if(!isValidEmail(email)){ toast("Email không hợp lệ"); f.email.focus(); return; }
    const btn=$("#ckSubmit"); btn.disabled=true; btn.textContent="Đang xử lý...";
    const order={ customer_name:name, phone, email, address, note:f.note.value.trim(),
      items:Cart.items.map(x=>{ const p=S.getProduct(x.id);
        return {id:x.id,name:x.name,price:x.price,color:x.color,size:x.size,qty:x.qty, image:(p&&p.image_url)||null}; }),
      subtotal:sub, shipping:ship, total:total };
    try{
      const saved=await DB.createOrder(order);
      saveMyOrder(saved);
      saveLastContact({customer_name:name, phone, email, address});
      Cart.items=[]; Cart.save();
      // Gửi email xác nhận (không chặn redirect — nếu lỗi vẫn vào trang đơn)
      const orderForEmail = { ...saved, email };
      Email.sendConfirmation(orderForEmail).then(r=>{
        if(r.sent) sessionStorage.setItem("ck_email_sent_"+saved.code, email);
      });
      location.href="order.html?code="+encodeURIComponent(saved.code)+"&new=1";
    }catch(err){
      console.error(err); btn.disabled=false; btn.textContent="Đặt hàng (COD)";
      toast("Lỗi đặt hàng: "+(err.message||err));
    }
  };
}

/* Modal chi tiết đơn — dùng cho list "Đơn của tôi" (không cần fetch lại) */
function openOrderDetailModal(o){
  const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
  const steps=["pending","confirmed","shipping","completed"];
  const timeline = o.status==="cancelled"
    ? `<div class="od-cancel">Đơn hàng này đã bị huỷ.</div>`
    : `<div class="od-track-card"><div class="timeline">${steps.map(s=>{const info=ORDER_STATUS[s];const done=info.step<=st.step;const cur=info.step===st.step;
        return `<div class="tl-step ${done?'done':''} ${cur?'cur':''}"><div class="tl-dot">${done?'✓':''}</div><div class="tl-label">${info.label}</div></div>`;}).join("")}</div></div>`;
  const items=(o.items||[]).map(it=>{
    const url=`product.html?id=${encodeURIComponent(it.id)}`;
    return `<div class="od-item">
      <a class="od-item-thumb" href="${url}">${orderItemImage(it)}</a>
      <div class="od-item-info">
        <a class="od-item-name" href="${url}">${escapeXML(it.name)}</a>
        <div class="od-item-meta"><span class="od-swatch" style="background:${safeColor(it.color)}"></span>${it.size?`Size ${escapeXML(it.size)} · `:""}SL ${it.qty}</div>
      </div>
      <div class="od-item-price"><div class="p-now">${money(it.price*it.qty)}</div>${it.qty>1?`<div class="p-unit">${money(it.price)} × ${it.qty}</div>`:""}</div>
    </div>`;
  }).join("");

  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="orderDetailModal";
  ov.innerHTML=`<div class="modal od-modal" style="--od-accent:${st.color}">
    <button class="modal-close" id="odClose" aria-label="Đóng">×</button>
    <div class="od-head">
      <div class="od-head-top">
        <div><div class="od-eyebrow">Đơn hàng</div><h3 class="od-code">#${escapeXML(o.code)}</h3></div>
        <span class="status-pill" style="background:${st.color}">${st.label}</span>
      </div>
      <div class="od-date">🕒 Đặt lúc ${new Date(o.created_at).toLocaleString("vi-VN")}</div>
    </div>
    <div class="od-body">
      ${timeline}
      <div class="od-section">
        <div class="od-section-title">Sản phẩm <span class="muted">(${(o.items||[]).length})</span></div>
        <div class="od-items">${items}</div>
      </div>
      <div class="od-grid">
        <div class="od-card">
          <div class="od-card-title">📍 Giao tới</div>
          <div class="od-ship"><span class="name">${escapeXML(o.customer_name||"")}</span> · ${escapeXML(o.phone||"")}<br>${escapeXML(o.address||"")}${o.note?`<br><span class="muted">Ghi chú: ${escapeXML(o.note)}</span>`:""}</div>
        </div>
        <div class="od-card od-sum">
          <div class="line"><span>Tạm tính</span><span>${money(o.subtotal||0)}</span></div>
          <div class="line"><span>Giao hàng</span><span>${o.shipping?money(o.shipping):"Miễn phí"}</span></div>
          <div class="total"><span>Tổng cộng</span><span>${money(o.total||0)}</span></div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close=()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(),200); };
  $("#odClose").onclick=close;
  ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
}

/* ---------------- TRANG TRA CỨU / TRẠNG THÁI ĐƠN ---------------- */
async function renderOrder(){
  const root=$("#page");
  // genCode() trả uppercase; getOrderByCode cũng upper. Chuẩn hoá ngay để
  // heading/lookup hiển thị nhất quán dù user paste URL chữ thường.
  const code=(param("code")||"").trim().toUpperCase();

  async function lookupView(msg){
    const recents=getMyOrders();
    const myOrders = Auth.isLoggedIn() ? await DB.listMyOrders() : [];

    let accountBlock = "";
    if(Auth.isLoggedIn()){
      const heading = `<h3 style="font-family:var(--font-display);text-transform:uppercase;font-size:16px;margin:0 0 12px">Đơn của tôi${myOrders.length?` (${myOrders.length})`:""}</h3>`;
      if(myOrders.length){
        accountBlock = heading + myOrders.map(o=>{
          const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
          return `<button type="button" class="my-orders-row" data-code="${escapeXML(o.code)}">
            <div><div class="mo-code">${escapeXML(o.code)}</div><div class="mo-date">${new Date(o.created_at).toLocaleString("vi-VN")} · ${(o.items||[]).reduce((s,i)=>s+i.qty,0)} sản phẩm</div></div>
            <div class="mo-meta-right"><div class="mo-total">${money(o.total||0)}</div><span class="mo-status" style="background:${st.color}">${st.label}</span></div>
            <span class="mo-arrow" aria-hidden="true">›</span>
          </button>`;
        }).join("");
      } else {
        accountBlock = heading + `<p class="muted" style="margin-bottom:24px">Bạn chưa có đơn nào trên tài khoản <b>${escapeXML(Auth.email())}</b>. Đặt đơn đầu tiên nhé!</p>`;
      }
    } else {
      accountBlock = `<div class="notice" style="background:#fff6e0;color:#7a5b00;border:1px solid #f0d98a;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
        <span><b>Đăng nhập Google</b> để xem toàn bộ đơn của bạn — đồng bộ trên mọi thiết bị.</span>
        <button class="btn btn-dark" id="ovLogin" style="padding:9px 18px;font-size:13px">Đăng nhập</button>
      </div>`;
    }

    const recentBlock = (!Auth.isLoggedIn() && recents.length)
      ? `<h3 style="font-family:var(--font-display);text-transform:uppercase;font-size:16px;margin:24px 0 12px">Đơn gần đây trên thiết bị này</h3>
        ${recents.map(r=>`<a class="recent-row" href="order.html?code=${encodeURIComponent(r.code)}">
          <span><strong>${r.code}</strong> · ${new Date(r.date).toLocaleDateString("vi-VN")}</span>
          <span>${money(r.total)} ›</span></a>`).join("")}`
      : "";

    root.innerHTML=`
    <div class="wrap page-head"><div class="crumb"><a href="index.html">Trang chủ</a> / ${Auth.isLoggedIn()?"Đơn của tôi":"Tra cứu đơn hàng"}</div>
      <h1 class="page-title">${Auth.isLoggedIn()?"Đơn của tôi":"Tra cứu đơn hàng"}</h1></div>
    <div class="wrap" style="max-width:680px;padding-bottom:60px">
      ${msg?`<div class="notice err">${msg}</div>`:""}
      ${accountBlock}
      <h3 style="font-family:var(--font-display);text-transform:uppercase;font-size:16px;margin:28px 0 12px">Tra cứu bằng mã đơn</h3>
      <p class="muted" style="margin-bottom:12px;font-size:13.5px">Dùng cho đơn đặt khi chưa đăng nhập (đã in trên màn hình sau khi đặt).</p>
      <form id="lookup" class="subscribe" style="max-width:none;margin:0 0 24px">
        <input id="codeInput" placeholder="Nhập mã đơn, ví dụ OR1A2B3" required>
        <button class="btn btn-dark" type="submit">Tra cứu</button>
      </form>
      ${recentBlock}
    </div>`;
    $("#lookup").onsubmit=e=>{
      e.preventDefault();
      const btn=e.target.querySelector("button[type=submit]");
      if(btn && btn.disabled) return;
      const c=$("#codeInput").value.trim();
      if(!c) return;
      if(btn){ btn.disabled=true; btn.textContent="Đang chuyển…"; }
      location.href="order.html?code="+encodeURIComponent(c);
    };
    const ovl=$("#ovLogin"); if(ovl) ovl.onclick=openLoginModal;
    // Click vào hàng đơn → mở modal chi tiết (không cần fetch lại từ server)
    $$(".my-orders-row").forEach(b=> b.onclick=()=>{
      const o=myOrders.find(x=>x.code===b.dataset.code);
      if(o) openOrderDetailModal(o);
    });
  }

  if(!code){ await lookupView(); return; }

  root.innerHTML=`<div class="wrap" style="padding:80px 0;text-align:center;color:var(--muted)">Đang tải đơn ${escapeXML(code)}…</div>`;
  let o=null;
  try{ o=await DB.getOrderByCode(code); }catch(e){ console.warn(e); }
  if(!o){ await lookupView(`Không tìm thấy đơn <strong>${escapeXML(code)}</strong>. Vui lòng kiểm tra lại mã.`); return; }

  const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
  const steps=["pending","confirmed","shipping","completed"];
  const timeline = o.status==="cancelled"
    ? `<div class="notice err">Đơn hàng này đã bị huỷ.</div>`
    : `<div class="timeline">${steps.map(s=>{const info=ORDER_STATUS[s];const done=info.step<=st.step;
        return `<div class="tl-step ${done?'done':''}"><div class="tl-dot">${done?'✓':''}</div><div class="tl-label">${info.label}</div></div>`;}).join("")}</div>`;

  const items=(o.items||[]).map(it=>{
    return `<div class="cart-item">
      <div class="ci-thumb">${orderItemImage(it)}</div>
      <div><h4>${escapeXML(it.name||"")}</h4><div class="ci-meta">Màu <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safeColor(it.color)};border:1px solid #ccc;vertical-align:middle"></span> · Size ${escapeXML(it.size||"")} · SL ${it.qty}</div></div>
      <div style="text-align:right;font-weight:700">${money(it.price*it.qty)}</div></div>`;}).join("");

  root.innerHTML=`
  <div class="wrap page-head"><div class="crumb"><a href="index.html">Trang chủ</a> / <a href="order.html">Tra cứu</a> / ${o.code}</div>
    <h1 class="page-title">Đơn ${o.code}</h1>
    <div style="margin-top:8px"><span class="status-pill" style="background:${st.color}">${st.label}</span>
    <span class="muted" style="margin-left:10px">Đặt lúc ${new Date(o.created_at).toLocaleString("vi-VN")}</span></div>
  </div>
  <div class="wrap cart-wrap">
    <div>
      ${timeline}
      <h3 style="font-family:var(--font-display);text-transform:uppercase;font-size:16px;margin:26px 0 8px">Sản phẩm (${(o.items||[]).length})</h3>
      ${items}
    </div>
    <aside class="summary">
      <h3>Giao tới</h3>
      <p style="font-size:14px;line-height:1.85;margin-bottom:16px">
        <strong>${o.customer_name||""}</strong><br>${o.phone||""}<br>${o.address||""}
        ${o.note?`<br><span class="muted">Ghi chú: ${o.note}</span>`:``}</p>
      <div class="line"><span>Tạm tính</span><span>${money(o.subtotal||0)}</span></div>
      <div class="line"><span>Giao hàng</span><span>${o.shipping?money(o.shipping):"Miễn phí"}</span></div>
      <div class="total"><span>Tổng cộng</span><span>${money(o.total||0)}</span></div>
      <a class="btn btn-outline btn-block" style="margin-top:16px" href="collection.html">Tiếp tục mua sắm</a>
    </aside>
  </div>`;
  if(param("new")==="1"){
    const sentTo = sessionStorage.getItem("ck_email_sent_"+o.code);
    if(sentTo){
      toast("Đặt hàng thành công! Đã gửi email xác nhận tới "+sentTo);
      sessionStorage.removeItem("ck_email_sent_"+o.code);
    } else {
      toast("Đặt hàng thành công! Mã đơn: "+o.code);
    }
  }
}

/* ---------------- CATEGORIES ---------------- */
const Categories = { loaded:false, async load(){
  try{ const rows=await DB.listCategories(); if(rows&&rows.length) S.CATEGORIES.splice(0,S.CATEGORIES.length,...rows); }
  catch(e){ console.warn("Categories.load",e); }
  this.loaded=true;
}};

/* ---------------- CATALOG ---------------- */
const Catalog = { loaded:false, async load(){
  try{ const rows=await DB.listProducts(); if(rows&&rows.length) S.PRODUCTS.splice(0,S.PRODUCTS.length,...rows); }
  catch(e){ console.warn("Catalog.load",e); }
  this.loaded=true;
}};

/* ---------------- LOADING OVERLAY ---------------- */
function showAppLoader(){
  if($("#appLoader")) return;
  const el=document.createElement("div");
  el.className="app-loader"; el.id="appLoader";
  el.innerHTML=`<div class="al-logo">${S.BRAND.name}<span class="dot">.</span></div><div class="app-spinner"></div>`;
  document.body.appendChild(el);
}
function hideAppLoader(){
  const el=$("#appLoader"); if(!el) return;
  el.classList.add("hide");
  setTimeout(()=>el.remove(), 400);
}

/* ---------------- NÚT LÊN ĐẦU TRANG ---------------- */
function initScrollTop(){
  if($("#toTop")) return;
  const b=document.createElement("button");
  b.id="toTop"; b.className="to-top"; b.setAttribute("aria-label","Lên đầu trang");
  b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`;
  document.body.appendChild(b);
  b.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
  const onScroll=()=>b.classList.toggle("show", window.scrollY>500);
  window.addEventListener("scroll", onScroll, {passive:true});
  onScroll();
}

/* ---------------- BOOT ---------------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  showAppLoader();
  // Danh mục phải nạp trước (vì map sản phẩm cần tên/type danh mục)
  await Promise.all([Categories.load(), Auth.init()]);
  await Catalog.load();
  renderHeader();
  renderFooter();
  const page = document.body.dataset.page;
  if(page==="home") renderHome();
  if(page==="collection") renderCollection();
  if(page==="product") renderProduct();
  if(page==="cart") renderCart();
  if(page==="order") renderOrder();
  // Khi user đăng nhập / đăng xuất (kể cả OAuth callback bắn muộn), vẽ lại các trang
  // mà nội dung phụ thuộc Auth: order (tra cứu vs danh sách đơn), cart (gắn user_id checkout).
  Auth.onChange(()=>{
    const pg = document.body.dataset.page;
    if(pg==="order") renderOrder();
    else if(pg==="cart") renderCart();
  });
  initScrollTop();
  // Ẩn overlay loading sau khi trang đã dựng xong
  requestAnimationFrame(hideAppLoader);
});
