/* =========================================================
   ORIGINALS — Engine dùng chung cho mọi trang
   ========================================================= */

/* ---------------- SPECULATION RULES (Chrome prerender) ----------------
   Khi user hover/touch link cùng origin, Chromium prerender full document
   ở background → click = swap instant, không loader. Browser khác bỏ qua.
   Exclude /admin (heavy, auth flow), logout/signout URL, và anchor links. */
(function injectSpeculationRules(){
  try{
    if(!HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;
    if(document.querySelector('script[type="speculationrules"]')) return;
    const rules = {
      prerender: [{
        where: {
          and: [
            { href_matches: "/*" },
            { not: { href_matches: "/admin/*" } },
            { not: { href_matches: "/*\\?*logout*" } },
            { not: { selector_matches: "[data-no-prerender]" } },
          ],
        },
        eagerness: "moderate",   // prerender khi hover ~200ms trước click
      }],
    };
    const s = document.createElement("script");
    s.type = "speculationrules";
    s.textContent = JSON.stringify(rules);
    document.head.appendChild(s);
  }catch(e){ /* ignore — feature detection only */ }
})();

const S = window.STORE;
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const money = S.formatVND;
// safeColor() được khai báo global trong data.js (chặn CSS injection qua style="background:${c}")
const param = (k) => new URLSearchParams(location.search).get(k);
// debounce: trì hoãn fn cho tới khi user ngừng kích hoạt ms mili-giây — tránh
// rebuild list mỗi keystroke (search modal, filter input).
function debounce(fn, ms=300){
  let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), ms); };
}

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
  // Di chuyển .modal-close vào trong .modal-title (cuối) để flex-align chuẩn.
  const fixCloseInTitle = (root)=>{
    root.querySelectorAll(".modal").forEach(mod=>{
      const close = mod.querySelector(":scope > .modal-close");
      const title = mod.querySelector(":scope > .modal-title");
      if(close && title && !title.contains(close)) title.appendChild(close);
    });
  };
  new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==="attributes" && m.target.classList?.contains("modal-overlay")) lockScroll();
      if(m.type==="childList"){
        for(const n of m.addedNodes){
          if(n.nodeType!==1) continue;
          if(n.classList?.contains("modal-overlay")){ lockScroll(); fixCloseInTitle(n); }
        }
        for(const n of m.removedNodes){ if(n.classList?.contains("modal-overlay")) lockScroll(); }
      }
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
// toast(msg) → tự detect status từ nội dung message.
// toast(msg, "success"|"error"|"warn"|"info") → ép kiểu status.
let toastT;
function toast(msg, type){
  const text = (msg==null ? "" : String(msg));
  if(!type){
    if(/(^|\s)lỗi\b|^err|fail|không\s+(tìm\s+được|đủ|hợp\s+lệ|tồn\s+tại)/i.test(text)) type = "error";
    else if(/^(đã |cảm ơn|áp dụng|thành công|đặt hàng thành công|đăng (nhập|xuất))/i.test(text)) type = "success";
    else if(/^(chỉ còn|hãy |vui lòng|cần |thiếu|hết hàng|sắp hết)/i.test(text)) type = "warn";
    else type = "info";
  }
  const icons = { success:"✓", error:"✕", warn:"!", info:"i" };
  let t = $(".toast");
  if(!t){ t = document.createElement("div"); document.body.appendChild(t); }
  t.className = "toast t-" + type;
  t.innerHTML = `<span class="t-icon" aria-hidden="true"></span><span class="t-msg"></span>`;
  t.querySelector(".t-icon").textContent = icons[type] || "•";
  t.querySelector(".t-msg").textContent  = text;
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
    // Preload trạng thái admin (chỉ trả true/false, không lộ danh sách admin email)
    // để DB.isAdmin() sync chính xác khi render auth slot.
    try{ if(this.user && DB.isAdminAsync) await DB.isAdminAsync(this.user); }catch(e){}
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
  const isAdmin = DB.isAdmin ? DB.isAdmin(Auth.user) : false;
  // Admin: avatar = link thẳng vào /admin/, không mở dropdown
  // Khách thường: avatar = button mở dropdown (đơn của tôi, đăng xuất)
  if(isAdmin){
    slot.innerHTML = `
      <a href="admin/" class="icon-btn user-admin-link" title="${escapeXML(Auth.displayName())} · Vào trang quản trị" aria-label="Vào trang quản trị">
        <span class="ua-circle is-admin">${escapeXML(Auth.initial())}</span>
        <span class="ua-admin-tag">ADMIN</span>
      </a>`;
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
    const ok = await confirmDialog({
      title:"Đăng xuất?",
      body:`Bạn sẽ thoát khỏi tài khoản <b>${escapeXML(Auth.email()||"")}</b>. Đơn hàng đã đặt vẫn lưu — đăng nhập lại bất cứ lúc nào để xem.`,
      confirmText:"Đăng xuất",
    });
    if(!ok) return;
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
  if(p.image_url) return `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy" decoding="async">`;
  return S.productSVG(p, opts||{seed:hashSeed(p.id)});
}
/* Ảnh của 1 dòng trong đơn hàng — ưu tiên ảnh đã lưu vào đơn lúc đặt (snapshot),
   sau đó mới tra sản phẩm hiện tại, cuối cùng fallback SVG. Nhờ vậy đơn vẫn
   hiển thị đúng ảnh kể cả khi sản phẩm bị ẩn / xoá / đổi sau này. */
function orderItemImage(it){
  if(it.image) return `<img class="thumb-img" src="${it.image}" alt="${escapeXML(it.name||"")}" loading="lazy" decoding="async">`;
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
  const swatches = (p.colors||[]).slice(0,4).map((c,i)=>{
    const name = S.colorName ? S.colorName(c) : c;
    return `<button type="button" class="swatch${i===0?' active':''}" data-c="${escapeXML(c)}" data-id="${p.id}" style="background:${safeColor(c)}" aria-label="Màu ${escapeXML(name)}" title="${escapeXML(name)}"></button>`;
  }).join("");
  const url = `product.html?id=${encodeURIComponent(p.id)}`;
  const soldOut = (p.stock!=null && p.stock<=0);
  const ci0 = (p.color_images||{})[p.colors[0]];
  const fallbackSvg = HAS_HOVER
    ? S.productSVG(p,{seed:hashSeed(p.id)}) + `<div class="hoverimg">${S.productSVG(p,{color:p.colors[1]||p.colors[0],seed:hashSeed(p.id)+1})}</div>`
    : S.productSVG(p,{seed:hashSeed(p.id)});
  const media = (ci0 && ci0[0])
    ? `<img class="thumb-img" src="${ci0[0]}" alt="${escapeXML(p.name)}" loading="lazy" decoding="async">`
    : (p.image_url
      ? `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy" decoding="async">`
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
    html = `<img class="thumb-img" src="${ci[0]}" alt="${escapeXML(p.name)}" loading="lazy" decoding="async">`;
  } else if(p.image_url && c===p.colors[0]){
    html = `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" loading="lazy" decoding="async">`;
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
    ? `<img class="thumb-img" src="${p.image_url}" alt="${escapeXML(p.name)}" decoding="async">`
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
    if(window.SEO) SEO.trackAddToCart(p, 1);
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

  const annList = (Home.get().tickerHeader && Home.get().tickerHeader.length) ? Home.get().tickerHeader : Home.defaults.tickerHeader;
  const annItems = annList.map(t=>`<span>${escapeXML(t)}</span>`).join("");
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
  ov.innerHTML=`<div class="modal" style="max-width:560px">
    <button class="modal-close" id="schClose" aria-label="Đóng">×</button>
    <h3 class="modal-title">Tìm kiếm sản phẩm</h3>
    <input id="schInput" type="search" placeholder="Tên áo, slogan, bộ sưu tập…" autocomplete="off" style="width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px;outline:none">
    <div id="schResults" style="margin-top:14px"></div>
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
      const thumb = img ? `<img src="${escapeXML(img)}" alt="" loading="lazy" decoding="async" style="width:54px;height:64px;object-fit:cover;border-radius:8px;background:var(--bg-soft)">` : `<div style="width:54px;height:64px;border-radius:8px;background:var(--bg-soft)"></div>`;
      return `<a href="product.html?id=${encodeURIComponent(p.id)}" style="display:flex;gap:12px;padding:10px 6px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;align-items:center">
        ${thumb}
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${escapeXML(p.name)}</div><div class="muted" style="font-size:12px">${escapeXML(p.collection||p.catName||"")}</div></div>
        <div style="font-weight:700;font-size:14px;white-space:nowrap">${money(p.price)}</div>
      </a>`;
    }).join("");
  }
  draw("");
  const drawDebounced = debounce(draw, 200);
  input.addEventListener("input", e=>drawDebounced(e.target.value));
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
        <p style="max-width:260px;color:#b9b9b9">${escapeXML(Home.get().footerAbout || (S.BRAND.tagline+". Thời trang local brand cho người trẻ dám khác biệt."))}</p>
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
// Trả về cards thật nếu có; trả skeleton khi Catalog đang load (data từ API chưa về).
function cardsOrSkeleton(products /*, n*/){
  return (products||[]).map(productCard).join("");
}
// (Stub giữ tương thích lời gọi cũ; skeleton đã bỏ — boot dùng showAppLoader)
function _unused_cardsOrSkeletonOld(products, n=6){
  if(products && products.length) return products.map(productCard).join("");
  return Catalog.loaded ? "" : Array.from({length:n}, skCard).join("");
}
function scrollerRow(products){
  return `<div class="scroller">
    <button class="scroll-btn prev">‹</button>
    <div class="row">${cardsOrSkeleton(products, 5)}</div>
    <button class="scroll-btn next">›</button>
  </div>`;
}
function featureBlock(b){
  const {eyebrow,title,sub,cta,href,products,reverse,image,from,to} = b;
  const bg = image
    ? `background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)),url('${escapeXML(image)}') center/cover no-repeat`
    : `background:linear-gradient(135deg,${safeColor(from||"#1d1d1d")},${safeColor(to||"#444")})`;
  const banner = `<a class="feature-banner" href="${escapeXML(href||"#")}" style="${bg}">
      <div class="label"><div class="eyebrow">${escapeXML(eyebrow||"")}</div><h3>${escapeXML(title||"")}</h3>
      <span class="btn btn-light">${escapeXML(cta||"")}</span></div></a>`;
  const copy = `<div class="feature-copy" style="width:100%">
      <div style="margin-bottom:14px"><div class="section-head" style="margin-bottom:6px"><div>
        <div class="eyebrow" style="color:var(--sale);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600">${escapeXML(sub||"")}</div>
        <h2 style="font-family:var(--font-display);text-transform:uppercase;font-size:clamp(22px,2.6vw,30px)">${escapeXML(title||"")}</h2>
      </div></div></div>
      ${scrollerRow(products)}</div>`;
  return `<div class="feature ${reverse?'rev':''}">${reverse?copy+banner:banner+copy}</div>`;
}

function renderHome(){
  const root = $("#page");
  if(window.SEO) SEO.set({
    title: S.BRAND.tagline || "Be Bold · Be New · Be Original",
    description: `${S.BRAND.name} — local brand streetwear. ${S.BRAND.tagline||""}`,
  });
  // Blocks từ Home settings — admin custom, fallback defaults. Products derived
  // tự động theo catKey/collection của từng block.
  const HBlocks = (Home.get().featureBlocks && Home.get().featureBlocks.length) ? Home.get().featureBlocks : Home.defaults.featureBlocks;
  const blocks = HBlocks.map(b=>{
    let products = [];
    if(b.collection) products = products.concat(S.byCollection(b.collection));
    if(b.catKey)     products = products.concat(S.byCategory(b.catKey));
    // Dedup theo id
    const seen = new Set();
    products = products.filter(p=>p&&p.id&&!seen.has(p.id)&&seen.add(p.id)).slice(0,8);
    return {...b, products};
  }).filter(b=>b.products.length); // bỏ block không có SP nào

  // Hero — đọc từ Home settings; nếu admin set heroImage thì dùng cover image, fallback gradient.
  const HG = Home.get();
  const heroSub = HG.heroSub || `${S.BRAND.name} — local brand streetwear cho người trẻ dám thể hiện chất riêng.`;
  const heroStyle = HG.heroImage ? `style="background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url('${escapeXML(HG.heroImage)}') center/cover no-repeat"` : "";
  const tickerBottomItems = (HG.tickerBottom && HG.tickerBottom.length ? HG.tickerBottom : Home.defaults.tickerBottom)
    .map(t=>`<span>${escapeXML(t)}</span>`).join("");
  const hero = `<section class="hero" ${heroStyle}>
    <div class="hero-inner">
      <h1>${HG.heroHeadline || Home.defaults.heroHeadline}</h1>
      <p>${escapeXML(heroSub)}</p>
      <a class="btn btn-light" href="${escapeXML(HG.heroCtaHref || "collection.html")}">${escapeXML(HG.heroCta || "Khám phá bộ sưu tập")}</a>
    </div>
    <div class="ticker"><div class="track">${Array(6).fill(tickerBottomItems).join("")}</div></div>
  </section>`;

  // Danh mục nổi bật — admin có thể custom ảnh nền từng tile, fallback gradient mặc định.
  const defaultTiles = [["ao-thun","#1d1d1d","#555"],["hoodie","#2c3a4f","#557"],["polo","#3f5c46","#697"],["tote","#b5523a","#d8a441"]];
  const cats = `<section class="section tight"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Mua theo danh mục</div><h2>Danh mục nổi bật</h2></div>
      <a class="more" href="collection.html">Tất cả</a></div>
    <div class="cats">
      ${defaultTiles.map(([k,a,b])=>{
        const cat=S.CATEGORIES.find(x=>x.key===k); if(!cat) return "";
        const tile = Home.tile(k);
        const bg = tile && tile.image
          ? `background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)),url('${escapeXML(tile.image)}') center/cover no-repeat`
          : `background:linear-gradient(135deg,${safeColor(tile&&tile.from||a)},${safeColor(tile&&tile.to||b)})`;
        return `<a class="cat-tile" href="collection.html?cat=${k}" style="${bg}"><span>${escapeXML(cat.name)}</span></a>`;
      }).join("")}
    </div></div></section>`;

  const stripText = HG.stripText || S.BRAND.tagline.toUpperCase();
  const strip = `<div class="strip"><div class="track">${Array(8).fill(`<span>${escapeXML(S.BRAND.name)}</span><span class="star">✦</span><span>${escapeXML(stripText)}</span><span class="star">✦</span>`).join("")}</div></div>`;

  const perkItems = HG.perks && HG.perks.length ? HG.perks : Home.defaults.perks;
  const perks = `<section class="section tight"><div class="wrap"><div class="perks">
    ${perkItems.map(p=>`<div class="perk"><div class="ic">${escapeXML(p.icon||"")}</div><h5>${escapeXML(p.title||"")}</h5><p>${escapeXML(p.desc||"")}</p></div>`).join("")}
  </div></div></section>`;

  root.innerHTML = hero + cats +
    `<section class="section"><div class="wrap">${blocks.map(featureBlock).join("")}</div></section>` +
    strip + perks + newsletterHTML();

  bindScrollers();
  bindNewsletter();
}

/* ---------------- NEWSLETTER ---------------- */
function newsletterHTML(){
  const H = Home.get();
  return `<section class="newsletter"><div class="wrap">
    <h2>${escapeXML(H.newsletterTitle || Home.defaults.newsletterTitle)}</h2>
    <p>${escapeXML(H.newsletterSub || Home.defaults.newsletterSub)}</p>
    <form class="subscribe" id="nl" style="align-items:flex-start" novalidate>
      <div class="fld" style="flex:1;margin:0"><input id="nlEmail" type="email" placeholder="Email của bạn" required></div>
      <button class="btn btn-dark" type="submit">Đăng ký</button></form>
  </div></section>`;
}
function bindNewsletter(){
  const f=$("#nl"); if(!f) return;
  f.onsubmit=e=>{
    e.preventDefault();
    const inp=$("#nlEmail");
    const ok = validateFields([{el:inp, msg:"Email không hợp lệ", test:v=> isValidEmail(v)}]);
    if(!ok) return;
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
  if(window.SEO){
    const q = (param("q")||"").trim();
    const cat = param("cat") || "";
    const sale = param("sale")==="1";
    SEO.set({
      title: q ? `Tìm: ${q}` : sale ? "Đang giảm giá" : cat ? (S.CATEGORIES.find(c=>c.key===cat)?.name||"Cửa hàng") : "Cửa hàng",
      description: `Toàn bộ sản phẩm ${S.BRAND.name}: áo thun, ba lỗ, hoodie, polo, túi tote. Lọc theo danh mục, màu, size, mức giá.`,
    });
  }
  let activeCat = param("cat") || "";
  let activeCol = param("collection") || "";
  const saleOnly = param("sale")==="1";
  const query = (param("q")||"").trim().toLowerCase();

  const initColors = (param("color")||"").split(",").filter(Boolean);
  const initSizes  = (param("size")||"").split(",").filter(Boolean);
  const state = { cat:activeCat, cols:activeCol?[activeCol]:[], price:"", sort:"featured", sale:saleOnly, q:query, colors:initColors, sizes:initSizes };
  const ALL_SIZES = ["S","M","L","XL","2XL","Freesize"];

  const title = query ? `Kết quả: "${query}"`
    : saleOnly ? "Đang giảm giá"
    : activeCat ? S.CATEGORIES.find(c=>c.key===activeCat)?.name
    : "Tất cả sản phẩm";

  root.innerHTML = `
  <div class="wrap page-head">
    <div class="crumb"><a href="index.html">Trang chủ</a> / ${title}</div>
    <h1 class="page-title">${title} <span class="page-count" id="count"></span></h1>
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
      <div class="filter-group"><h4>Màu sắc</h4>
        <div class="filter-colors">
        ${(S.COLORS||[]).filter(c=>c.active!==false).map(c=>{
          const checked = state.colors.includes(c.hex);
          return `<button type="button" class="fcolor${checked?' active':''}" data-c="${escapeXML(c.hex)}" title="${escapeXML(c.name)}" aria-pressed="${checked}">
            <span class="fcolor-dot" style="background:${safeColor(c.hex)}"></span>
            <span class="fcolor-name">${escapeXML(c.name)}</span>
          </button>`;
        }).join("")}
        </div>
      </div>
      <div class="filter-group"><h4>Size</h4>
        <div class="filter-sizes">
        ${ALL_SIZES.map(s=>`<button type="button" class="fsize${state.sizes.includes(s)?' active':''}" data-s="${s}" aria-pressed="${state.sizes.includes(s)}">${s}</button>`).join("")}
        </div>
      </div>
      <div class="filter-group"><h4>Mức giá</h4>
        ${[["","Tất cả"],["lt200","Dưới 200.000₫"],["200-300","200.000₫ – 300.000₫"],["gt300","Trên 300.000₫"]]
          .map(([v,l])=>`<label><input type="radio" name="price" value="${v}" ${state.price===v?'checked':''}> ${l}</label>`).join("")}
      </div>
      <div class="filter-group"><label><input type="checkbox" id="saleChk" ${state.sale?'checked':''}> Chỉ hàng giảm giá</label></div>
      <button type="button" class="btn btn-outline btn-block" id="fclear" style="margin-top:8px;padding:10px">Xoá toàn bộ lọc</button>
    </aside>
    <div>
      <div class="shop-toolbar">
        <button class="btn btn-outline filter-toggle" id="ftoggle" style="padding:9px 18px">Lọc ▾</button>
        <select id="sort">
          <option value="featured">Nổi bật</option>
          <option value="price-asc">Giá: thấp → cao</option>
          <option value="price-desc">Giá: cao → thấp</option>
          <option value="discount">Giảm giá nhiều</option>
          <option value="name">Tên A → Z</option>
        </select>
      </div>
      <div class="grid" id="grid"></div>
      <div id="loadMoreWrap" style="display:none;text-align:center;margin:24px 0 8px"><button class="btn btn-outline" id="loadMoreBtn" type="button" style="padding:10px 28px">Xem thêm</button></div>
      <div id="empty" style="display:none;text-align:center;padding:70px 0;color:var(--muted)">Không có sản phẩm phù hợp bộ lọc.</div>
    </div>
  </div>`;

  // Pagination: render dần 24 sp / lần thay vì xả hết list. Khi list dài
  // (vd 100+ sp) giúp giảm DOM nodes và thời gian innerHTML lần đầu.
  const PAGE_SIZE = 24;
  let shown = 0;
  let currentList = [];

  function renderPage(){
    const slice = currentList.slice(0, shown);
    $("#grid").innerHTML = cardsOrSkeleton(slice, 8);
    const wrap = $("#loadMoreWrap");
    if(wrap) wrap.style.display = shown < currentList.length ? "block" : "none";
  }

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
    if(state.colors.length) list = list.filter(p=>(p.colors||[]).some(c=>state.colors.includes(c)));
    if(state.sizes.length)  list = list.filter(p=>(p.sizes||[]).some(s=>state.sizes.includes(s)));
    if(state.sale) list = list.filter(p=>p.sale);
    if(state.price==="lt200") list=list.filter(p=>p.price<200000);
    if(state.price==="200-300") list=list.filter(p=>p.price>=200000&&p.price<=300000);
    if(state.price==="gt300") list=list.filter(p=>p.price>300000);
    if(state.sort==="price-asc") list.sort((a,b)=>a.price-b.price);
    if(state.sort==="price-desc") list.sort((a,b)=>b.price-a.price);
    if(state.sort==="discount") list.sort((a,b)=>S.discountPct(b.price,b.compare)-S.discountPct(a.price,a.compare));
    if(state.sort==="name") list.sort((a,b)=>a.name.localeCompare(b.name,"vi"));
    currentList = list;
    shown = Math.min(PAGE_SIZE, list.length);
    renderPage();
    $("#count").textContent = Catalog.loaded ? `(${list.length})` : "";
    $("#empty").style.display = (Catalog.loaded && !list.length) ? "block" : "none";
  }
  const loadMoreBtn = $("#loadMoreBtn");
  if(loadMoreBtn) loadMoreBtn.onclick = ()=>{
    shown = Math.min(shown + PAGE_SIZE, currentList.length);
    renderPage();
  };
  $$('input[name=cat]').forEach(r=>r.onchange=e=>{state.cat=e.target.value;apply()});
  $$('input[name=col]').forEach(r=>r.onchange=()=>{state.cols=$$('input[name=col]:checked').map(x=>x.value);apply()});
  $$('input[name=price]').forEach(r=>r.onchange=e=>{state.price=e.target.value;apply()});
  $("#saleChk").onchange=e=>{state.sale=e.target.checked;apply()};
  $("#sort").onchange=e=>{state.sort=e.target.value;apply()};
  $$(".fcolor").forEach(b=>b.onclick=()=>{
    const c=b.dataset.c, on=state.colors.includes(c);
    state.colors = on ? state.colors.filter(x=>x!==c) : [...state.colors, c];
    b.classList.toggle("active", !on); b.setAttribute("aria-pressed", String(!on));
    apply();
  });
  $$(".fsize").forEach(b=>b.onclick=()=>{
    const s=b.dataset.s, on=state.sizes.includes(s);
    state.sizes = on ? state.sizes.filter(x=>x!==s) : [...state.sizes, s];
    b.classList.toggle("active", !on); b.setAttribute("aria-pressed", String(!on));
    apply();
  });
  const fclr=$("#fclear"); if(fclr) fclr.onclick=()=>{
    Object.assign(state, {cat:"",cols:[],colors:[],sizes:[],price:"",sale:false,sort:"featured",q:""});
    location.href = "collection.html";
  };
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
    const hEl=$("#sgH"), wEl=$("#sgW");
    const ok = validateFields([
      {el:hEl, msg:"Nhập chiều cao (cm)", test:v=> +v>=100 && +v<=220},
      {el:wEl, msg:"Nhập cân nặng (kg)",  test:v=> +v>=25  && +v<=200},
    ]);
    if(!ok) return;
    const h=+hEl.value, w=+wEl.value;
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
    showAppLoader();
    try{ p = await DB.getProduct(id); }catch(e){ console.warn("getProduct DB",e); }
    hideAppLoader();
  }
  if(!p){
    console.warn("renderProduct: không tìm được SP với id=",id,"→ fallback PRODUCTS[0]");
    p = S.PRODUCTS[0];
  }
  if(!p){
    root.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center"><h2>Sản phẩm không tồn tại</h2><p class="muted" style="margin-top:8px">Quay về <a href="collection.html" style="text-decoration:underline">danh sách sản phẩm</a></p></div>`;
    if(window.SEO) SEO.set({ title:"Không tìm thấy sản phẩm", description:"Sản phẩm bạn tìm không còn tồn tại." });
    return;
  }
  if(window.SEO) SEO.product(p);
  let color = p.colors[0], size = "", qty = 1;
  const off = S.discountPct(p.price,p.compare);
  const soldOut = (p.stock!=null && p.stock<=0);

  // Gallery theo MÀU: ảnh của màu đang chọn → ảnh chung → SVG fallback.
  // Ảnh đầu eager (above the fold) — phần sau lazy + decoding async.
  const imgTag = (u,i)=>`<img class="thumb-img" src="${u}" alt="${escapeXML(p.name)}"${i===0?' fetchpriority="high"':' loading="lazy" decoding="async"'}>`;
  function galleryFor(c){
    const ci = p.color_images || {};
    const own = (ci[c]||[]).filter(Boolean);
    if(own.length) return own.map(imgTag);
    const flat = Array.isArray(p.images)?p.images.filter(Boolean):[];
    if(c===p.colors[0] && flat.length) return flat.map(imgTag);
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
  // Swipe trái/phải trên ảnh chính để next/prev (mobile + cảm ứng).
  const stage = $("#mainStage");
  if(stage){
    let sx=0, sy=0, tracking=false;
    stage.addEventListener("touchstart", (e)=>{
      if(gallery.length<2) return;
      const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; tracking=true;
    }, {passive:true});
    stage.addEventListener("touchend", (e)=>{
      if(!tracking) return; tracking=false;
      const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
      // Chỉ trigger nếu quẹt rõ ràng theo trục ngang (|dx|>40 và |dx| > |dy|*1.5)
      if(Math.abs(dx)<40 || Math.abs(dx) < Math.abs(dy)*1.5) return;
      if(dx<0) showSlide(slideIdx+1); else showSlide(slideIdx-1);
      restartAuto();
    }, {passive:true});
  }
  // colors → đổi gallery sang ảnh của màu đó + hiện tên màu cạnh label
  const setColorName = (c)=>{ const el=$("#colorName"); if(el) el.textContent = S.colorName ? " · "+S.colorName(c) : ""; };
  setColorName(color);
  $$("#colors .color-dot").forEach(b=> b.onclick=()=>{
    $$("#colors .color-dot").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); setColor(b.dataset.c); setColorName(b.dataset.c);
  });
  // sizes — chọn size; nếu đang có lỗi inline thì xoá luôn
  $$("#sizes .size-btn").forEach(b=> b.onclick=()=>{
    $$("#sizes .size-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); size=b.dataset.s;
    const oe=$("#sizesErr"); if(oe) oe.remove();
  });
  // qty
  $("#minus").onclick=()=>{qty=Math.max(1,qty-1);$("#qval").textContent=qty};
  $("#plus").onclick=()=>{qty++;$("#qval").textContent=qty};
  // add / buy
  function doAdd(){
    if(!size){
      let oe=$("#sizesErr");
      if(!oe){ oe=document.createElement("div"); oe.id="sizesErr"; oe.className="opt-error"; oe.textContent="Vui lòng chọn size"; $("#sizes").parentNode.insertBefore(oe, $("#sizes").nextSibling); }
      $("#sizes").scrollIntoView({block:"center",behavior:"smooth"});
      return false;
    }
    if(p.stock!=null && qty>p.stock){ toast("Chỉ còn "+p.stock+" sản phẩm"); return false; }
    Cart.add({id:p.id,name:p.name,price:p.price,color,size,qty});
    if(window.SEO) SEO.trackAddToCart(p, qty);
    return true;
  }
  const acBtn=$("#addCart"), bnBtn=$("#buyNow");
  if(acBtn) acBtn.onclick=()=>{ if(doAdd()) toast("Đã thêm vào giỏ"); };
  if(bnBtn) bnBtn.onclick=()=>{ if(doAdd()) location.href="cart.html"; };
}

/* ---------------- TRANG GIỎ HÀNG (giỏ + form đặt hàng cùng 1 màn) ---------------- */
async function renderCart(){
  const root=$("#page");
  // Prefetch list tỉnh GHN ngay khi mở trang giỏ — chạy nền song song với
  // việc vẽ UI, đến lúc user click "Chọn tỉnh" thì data đã có sẵn.
  prefetchAddressData();
  // Tải địa chỉ đã lưu (chỉ khi đăng nhập) — async, không chặn render đầu
  const savedAddrsPromise = Auth.isLoggedIn() ? DB.listMyAddresses().catch(()=>[]) : Promise.resolve([]);
  function draw(savedAddrs){
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
    // Phí ship động: bắt đầu bằng flat fee (fallback nếu GHN tắt/lỗi).
    // Sẽ được recompute khi user chọn đủ địa chỉ qua GHN.fee().
    const FLAT_SHIP = 30000;
    const ghnEnabled = !!(window.GHN && window.GHN.enabled);
    let ship = sub>=500000 || sub===0 ? 0 : FLAT_SHIP;
    // Voucher state: persist trong sessionStorage để chuyển tab / F5 không mất.
    const _voucher = (function(){
      try{ const v = JSON.parse(sessionStorage.getItem("ck_voucher")||"null"); return v||{}; }catch(e){ return {}; }
    })();
    // Nếu voucher freeship → ship = 0
    if(_voucher.type === "freeship") ship = 0;
    let discount = +_voucher.discount || 0;
    let total = Math.max(0, sub + ship - discount);
    let shipSource = "flat"; // "flat" | "ghn"
    const last = getLastContact() || {};
    const draft = loadCheckoutDraft() || {};
    // Ưu tiên: draft đang gõ → địa chỉ default đã lưu → lastContact → Auth
    const defaultAddr = (savedAddrs||[]).find(a=>a.is_default) || (savedAddrs||[])[0];
    const prefillName    = draft.name   || (Auth.isLoggedIn() && Auth.displayName()) || last.customer_name || (defaultAddr?.recipient) || "";
    const prefillPhone   = draft.phone  || last.phone || (defaultAddr?.phone) || "";
    const prefillStreet  = draft.street || last.street || (defaultAddr?.street) || last.address || "";
    const prefillEmail   = draft.email  || (Auth.isLoggedIn() && Auth.email()) || last.email || "";
    const prefillStruct  = draft.province_code ? draft : (defaultAddr || last);
    const accountInfo = Auth.isLoggedIn()
      ? `<div class="notice" style="background:#eef7f1;color:#1d6c4d;border:1px solid #c5e6d4;font-size:13px">Đặt hàng với tài khoản <b>${escapeXML(Auth.email())}</b> — đơn sẽ lưu vào "Đơn của tôi".</div>`
      : `<div class="notice" style="background:#fff6e0;color:#7a5b00;border:1px solid #f0d98a;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>Mẹo: <a href="#" id="ckLogin" style="text-decoration:underline;color:inherit"><b>Đăng nhập Google</b></a> để lưu đơn trên mọi thiết bị.</span></div>`;
    const emailHint = Email.enabled
      ? `Email xác nhận đơn hàng sẽ được gửi tới đây.`
      : `Dùng để liên hệ khi cần xác nhận đơn.`;

    const trashIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
    const items = Cart.items.map((it,i)=>{
      const p=S.getProduct(it.id);
      return `<div class="cart-item">
        <a class="ci-thumb" href="product.html?id=${it.id}">${p?productImage(p,{color:it.color}):S.productSVG({type:"tee",print:it.name,collection:"",colors:[it.color||"#ccc"],name:it.name},{color:it.color})}</a>
        <div>
          <h4><a href="product.html?id=${it.id}">${escapeXML(it.name)}</a></h4>
          <div class="ci-meta">Màu: <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safeColor(it.color)};vertical-align:middle;border:1px solid #ccc"></span> · Size: ${escapeXML(it.size||"")}</div>
          <div class="qty"><button data-act="dec" data-i="${i}">−</button><span>${it.qty}</span><button data-act="inc" data-i="${i}">+</button></div>
        </div>
        <div class="ci-right">
          <div class="ci-price">${money(it.price*it.qty)}</div>
          <button class="ci-rm-btn" data-act="rm" data-i="${i}" aria-label="Xoá sản phẩm" title="Xoá">${trashIcon}</button>
        </div>
      </div>`;
    }).join("");

    root.innerHTML = `
    <div class="wrap page-head">
      <div class="crumb"><a href="index.html">Trang chủ</a> / Giỏ hàng</div>
      <h1 class="page-title">Giỏ hàng <span class="page-count">(${Cart.count()})</span></h1>
    </div>
    <div class="wrap cart-page">
      <div class="cart-main">
        <section class="cart-items">
          ${items}
        </section>
        <section class="cart-section">
          <h3 class="cart-section-title">📋 Thông tin nhận hàng</h3>
          ${accountInfo}
          ${savedAddrs && savedAddrs.length ? `
            <div class="saved-addrs">
              <div class="saved-addrs-head">
                <span class="saved-addrs-title">Địa chỉ đã lưu</span>
                <button type="button" class="mini" id="saveCurrentAddr">+ Lưu địa chỉ đang nhập</button>
              </div>
              <div class="saved-addrs-list">
                ${savedAddrs.map(a=>`<button type="button" class="saved-addr-item" data-aid="${escapeXML(a.id)}">
                  ${a.is_default?'<span class="saved-addr-badge">Mặc định</span>':''}
                  <div class="saved-addr-name"><b>${escapeXML(a.recipient||"")}</b> · ${escapeXML(a.phone||"")}</div>
                  <div class="saved-addr-line">${escapeXML([a.street,a.ward_name,a.district_name,a.province_name].filter(Boolean).join(", "))}</div>
                </button>`).join("")}
              </div>
            </div>
          ` : (Auth.isLoggedIn() ? `<p class="muted" style="font-size:12.5px;margin:10px 0">Chưa có địa chỉ đã lưu. Điền & bấm "+ Lưu" để dùng lại lần sau.</p>` : "")}
          <form id="ckForm" novalidate autocomplete="on" style="margin-top:14px">
            <div class="frow">
              <label class="fld"><span>Họ và tên *</span><input name="name" required value="${escapeXML(prefillName)}"></label>
              <label class="fld"><span>Số điện thoại *</span><input name="phone" required inputmode="tel" placeholder="VD: 0987654321" value="${escapeXML(prefillPhone)}"></label>
            </div>
            <label class="fld"><span>Email *</span><input name="email" type="email" required inputmode="email" autocomplete="email" placeholder="ban@example.com" value="${escapeXML(prefillEmail)}">
              <small class="muted" style="font-size:12px;display:block;margin-top:4px">${emailHint}</small></label>
            <label class="fld fld-addr"><span>Địa chỉ nhận hàng *</span>
              <div class="addr-picker">
                <button type="button" class="addr-sel" data-level="p" id="addrPBtn">
                  <span class="addr-sel-cap">Tỉnh / Thành phố</span>
                  <span class="addr-sel-val">Chọn</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4l3.5 4 3.5-4"/></svg>
                </button>
                <button type="button" class="addr-sel" data-level="d" id="addrDBtn" disabled>
                  <span class="addr-sel-cap">Quận / Huyện</span>
                  <span class="addr-sel-val">Chọn</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4l3.5 4 3.5-4"/></svg>
                </button>
                <button type="button" class="addr-sel" data-level="w" id="addrWBtn" disabled>
                  <span class="addr-sel-cap">Phường / Xã</span>
                  <span class="addr-sel-val">Chọn</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4l3.5 4 3.5-4"/></svg>
                </button>
              </div>
              <input type="text" id="addrStreet" placeholder="Số nhà, tên đường, hẻm/ngõ…" value="${escapeXML(prefillStreet)}" style="margin-top:10px">
              <small class="muted" style="font-size:11.5px;margin-top:6px;display:block">Nhập đủ <b>số nhà</b> + <b>tên đường</b> để shipper tìm chính xác.</small>
              <input type="hidden" name="address" id="addrInput">
            </label>
            <label class="fld"><span>Ghi chú (tuỳ chọn)</span><input name="note" value="${escapeXML(draft.note||"")}"></label>
          </form>
        </section>
      </div>
      <aside class="cart-summary">
        <h3 class="cart-section-title">💰 Tóm tắt đơn hàng</h3>
        <div class="line"><span>Tạm tính</span><span>${money(sub)}</span></div>
        <div class="line"><span id="ckShipLabel">Phí giao hàng</span><span id="ckShipValue">${ship?money(ship):"Miễn phí"}</span></div>
        <div id="ckShipHint" class="line" style="color:var(--sale);font-size:12.5px;${sub<500000?'':'display:none'}">
          ${sub<500000?`Mua thêm ${money(500000-sub)} để được freeship`:``}
        </div>
        <div class="ck-voucher">
          <div class="ck-voucher-input">
            <input type="text" id="ckVoucherCode" placeholder="Mã giảm giá" autocomplete="off" spellcheck="false" value="${escapeXML(_voucher.code||'')}">
            <button type="button" class="btn btn-outline btn-sm" id="ckVoucherApply">${_voucher.code?'Đổi mã':'Áp dụng'}</button>
          </div>
          <div id="ckVoucherMsg" class="ck-voucher-msg ${_voucher.code?'ok':''}" ${_voucher.code?'':'hidden'}>
            ${_voucher.code?`✓ ${escapeXML(_voucher.code)}: ${escapeXML(_voucher.message||'')}${_voucher.discount?` · giảm ${money(_voucher.discount)}`:''}`:''}
          </div>
        </div>
        ${_voucher.code?`<div class="line ck-discount-line"><span>Giảm giá (${escapeXML(_voucher.code)})</span><span id="ckDiscountVal">-${money(_voucher.discount||0)}</span><button type="button" id="ckVoucherClear" title="Bỏ mã" class="ck-voucher-x">×</button></div>`:''}
        <div class="line" style="font-size:12px;color:var(--muted);margin-top:6px"><span>Hình thức</span><span>COD</span></div>
        <div class="total"><span>Tổng cộng</span><span class="cart-total-amount" id="ckTotal">${money(total)}</span></div>
        <button class="btn btn-dark btn-block" type="submit" form="ckForm" id="ckSubmit" style="margin-top:14px">Đặt hàng (COD)</button>
        <a class="btn btn-outline btn-block" href="collection.html" style="margin-top:10px">Tiếp tục mua sắm</a>
        <p class="muted" style="font-size:11.5px;text-align:center;margin-top:8px">Thanh toán khi nhận hàng • ${DB.cloud?"Đơn lưu trên hệ thống":"Chế độ demo"}</p>
      </aside>
    </div>`;

    $$('[data-act]').forEach(b=> b.onclick=()=>{
      const i=+b.dataset.i;
      if(b.dataset.act==="inc") Cart.setQty(i,Cart.items[i].qty+1);
      if(b.dataset.act==="dec") Cart.setQty(i,Cart.items[i].qty-1);
      if(b.dataset.act==="rm")  Cart.remove(i);
      draw(savedAddrs);
    });
    const ckLogin=$("#ckLogin"); if(ckLogin) ckLogin.onclick=(e)=>{ e.preventDefault(); openLoginModal(); };

    /* ---- Tính phí ship động qua GHN khi đủ địa chỉ ---- */
    let _shipReqId = 0;  // tránh race giữa các request liên tiếp
    async function recomputeShipping(st){
      const labelEl = $("#ckShipLabel"), valEl = $("#ckShipValue"),
            hintEl = $("#ckShipHint"), totEl = $("#ckTotal");
      if(!labelEl) return;  // trang đã bị re-render
      const setShip = (v, source, note="")=>{
        // Voucher freeship đè lên ship thật
        if(_voucher.type === "freeship") v = 0;
        ship = v; shipSource = source;
        total = Math.max(0, sub + v - (discount||0));
        valEl.textContent = v ? money(v) : "Miễn phí";
        labelEl.textContent = note ? `Phí giao hàng (${note})` : "Phí giao hàng";
        totEl.textContent = money(total);
        if(source === "ghn" || sub >= 500000 || _voucher.type === "freeship"){
          hintEl.style.display = "none";
        } else {
          hintEl.style.display = "";
          hintEl.innerHTML = `Mua thêm ${money(500000-sub)} để được freeship`;
        }
      };
      // Freeship vẫn ưu tiên: đơn ≥ 500k → 0đ (chính sách shop)
      if(sub >= 500000){ setShip(0, "flat", "freeship"); return; }
      // Chưa bật GHN hoặc chưa đủ địa chỉ → flat fee
      if(!ghnEnabled || !st || !st.p || !st.d || !st.w){
        setShip(FLAT_SHIP, "flat"); return;
      }
      // Gọi GHN; giữ flat trong lúc chờ. Truyền GHN IDs trực tiếp (không
       // qua resolveAddress) — code lưu trong state.* chính là GHN IDs.
      const myReq = ++_shipReqId;
      labelEl.textContent = "Phí giao hàng (đang tính…)";
      try{
        const r = await GHN.fee({
          to_district_id: +st.d.code,
          to_ward_code:   String(st.w.code),
        });
        if(myReq !== _shipReqId) return;
        setShip(+r.total || FLAT_SHIP, "ghn", "GHN");
      }catch(e){
        if(myReq !== _shipReqId) return;
        console.warn("[GHN.fee] lỗi → fallback flat:", e.message);
        setShip(FLAT_SHIP, "flat");
      }
    }
    // ===== Voucher handlers =====
    const vApply = $("#ckVoucherApply"), vClear = $("#ckVoucherClear"), vMsg = $("#ckVoucherMsg"), vIn = $("#ckVoucherCode");
    if(vApply) vApply.onclick = async ()=>{
      const code = (vIn.value||"").trim();
      if(!code){ vMsg.removeAttribute("hidden"); vMsg.className="ck-voucher-msg err"; vMsg.textContent="Nhập mã giảm giá"; return; }
      vApply.disabled = true; vApply.textContent = "Đang kiểm tra…";
      vMsg.removeAttribute("hidden"); vMsg.className="ck-voucher-msg"; vMsg.textContent="Đang kiểm tra mã…";
      try{
        const r = await DB.checkVoucher(code, sub);
        vApply.disabled = false; vApply.textContent = "Áp dụng";
        if(!r.valid){
          vMsg.className = "ck-voucher-msg err";
          vMsg.textContent = "✗ " + (r.message||"Mã không hợp lệ");
          sessionStorage.removeItem("ck_voucher");
          return;
        }
        sessionStorage.setItem("ck_voucher", JSON.stringify(r));
        draw(savedAddrs);   // re-render để hiển thị dòng giảm giá + cập nhật total
        toast("Đã áp dụng mã " + r.code);
      }catch(e){
        vApply.disabled = false; vApply.textContent = "Áp dụng";
        vMsg.className = "ck-voucher-msg err"; vMsg.textContent = "Lỗi: " + (e.message||e);
      }
    };
    if(vClear) vClear.onclick = ()=>{
      sessionStorage.removeItem("ck_voucher");
      draw(savedAddrs);
    };
    if(vIn) vIn.addEventListener("keydown", e=>{
      if(e.key === "Enter"){ e.preventDefault(); vApply.click(); }
    });

    bindAddressPicker(prefillStruct, recomputeShipping);
    // Nếu prefill đã có đủ địa chỉ (3 cấp) → tính ngay
    if(prefillStruct && prefillStruct.province_code && prefillStruct.district_code && prefillStruct.ward_code){
      recomputeShipping({
        p:{ code:prefillStruct.province_code, name:prefillStruct.province_name },
        d:{ code:prefillStruct.district_code, name:prefillStruct.district_name },
        w:{ code:prefillStruct.ward_code,     name:prefillStruct.ward_name },
      });
    }

    // Click 1 saved-addr → fill toàn bộ form
    $$(".saved-addr-item").forEach(b=> b.onclick=()=>{
      const a = (savedAddrs||[]).find(x=>x.id===b.dataset.aid); if(!a) return;
      const f = $("#ckForm");
      f.name.value = a.recipient || "";
      f.phone.value = a.phone || "";
      $("#addrStreet").value = a.street || "";
      bindAddressPicker(a, recomputeShipping);
      if(a.province_code && a.district_code && a.ward_code){
        recomputeShipping({
          p:{ code:a.province_code, name:a.province_name },
          d:{ code:a.district_code, name:a.district_name },
          w:{ code:a.ward_code,     name:a.ward_name },
        });
      }
      $$(".saved-addr-item").forEach(x=>x.classList.toggle("active", x===b));
      toast("Đã chọn địa chỉ");
    });

    // Lưu địa chỉ đang nhập (cho user đăng nhập)
    const saveBtn = $("#saveCurrentAddr");
    if(saveBtn) saveBtn.onclick = async ()=>{
      const f=$("#ckForm");
      const st = getAddressState();
      if(!f.name.value.trim() || !f.phone.value.trim() || !$("#addrStreet").value.trim() || !st || !st.p){
        toast("Hãy điền tên / SĐT / số nhà & chọn Tỉnh/Xã trước");
        return;
      }
      const ok = await confirmDialog({
        title:"Lưu địa chỉ này?",
        body:"Địa chỉ sẽ xuất hiện trong danh sách 'Đã lưu' cho lần đặt sau.",
        confirmText:"Lưu",
      });
      if(!ok) return;
      try{
        await DB.upsertAddress({
          label:"Nhà",
          recipient:f.name.value.trim(), phone:f.phone.value.trim(),
          province_code:st.p?.code, province_name:st.p?.name,
          district_code:st.d?.code, district_name:st.d?.name,
          ward_code:st.w?.code,     ward_name:st.w?.name,
          street:$("#addrStreet").value.trim(),
          is_default: !(savedAddrs && savedAddrs.length),
        });
        const fresh = await DB.listMyAddresses();
        draw(fresh);  // re-render với list mới
      }catch(e){ toast("Lỗi lưu: "+(e.message||e)); }
    };

    // Autosave draft form (debounce 400ms)
    let draftTimer = null;
    const captureDraft = ()=>{
      const f=$("#ckForm"); const st = getAddressState();
      const data = {
        name:f.name.value, phone:f.phone.value, email:f.email.value,
        note:f.note.value, street:$("#addrStreet").value,
        province_code:st?.p?.code||null, province_name:st?.p?.name||null,
        district_code:st?.d?.code||null, district_name:st?.d?.name||null,
        ward_code:st?.w?.code||null,     ward_name:st?.w?.name||null,
      };
      saveCheckoutDraft(data);
    };
    $("#ckForm").addEventListener("input", ()=>{ clearTimeout(draftTimer); draftTimer = setTimeout(captureDraft, 400); });

    $("#ckForm").onsubmit=async(e)=>{
      e.preventDefault();
      const f=e.target;
      const ok = validateFields([
        {el:f.name,    msg:"Vui lòng nhập họ tên"},
        {el:f.phone,   msg:"SĐT không hợp lệ — đầu số VN 10 số (vd 0987654321)", test:v=> isValidVNPhone(v)},
        {el:f.email,   msg:"Email không hợp lệ", test:v=> isValidEmail(v)},
        {el:f.address, msg:"Chọn đủ Tỉnh / Huyện / Xã + nhập số nhà"},
      ]);
      const st = getAddressState();
      // Yêu cầu thêm: phải có Tỉnh + Xã, street không quá ngắn
      if(ok && (!st || !st.p || !st.w)){
        setFieldError(f.address, "Vui lòng chọn đầy đủ Tỉnh và Phường/Xã");
        $("#addrPBtn").focus(); return;
      }
      if(ok && (($("#addrStreet").value||"").trim().length < 3)){
        setFieldError(f.address, "Số nhà / tên đường quá ngắn (≥3 ký tự)");
        $("#addrStreet").focus(); return;
      }
      if(!ok){ $("#ckForm").scrollIntoView({behavior:"smooth",block:"start"}); return; }
      const name=f.name.value.trim(), phone=f.phone.value.trim().replace(/[\s.\-()]/g,""), email=f.email.value.trim();
      const address=f.address.value.trim();
      const btn=$("#ckSubmit"); btn.disabled=true; btn.textContent="Đang xử lý...";
      const order={
        customer_name:name, phone, email, address, note:f.note.value.trim(),
        // Structured (cho shipping API + báo cáo)
        province_code:st?.p?.code, province_name:st?.p?.name,
        district_code:st?.d?.code, district_name:st?.d?.name,
        ward_code:st?.w?.code,     ward_name:st?.w?.name,
        street:$("#addrStreet").value.trim(),
        items:Cart.items.map(x=>{ const p=S.getProduct(x.id);
          return {id:x.id,name:x.name,price:x.price,color:x.color,size:x.size,qty:x.qty, image:(p&&p.image_url)||null}; }),
        subtotal:sub, shipping:ship, total:total,
        voucher_code: _voucher.code || null,
        voucher_discount: _voucher.code ? (_voucher.type === "freeship" ? (FLAT_SHIP || 0) : (discount||0)) : 0,
      };
      try{
        const saved=await DB.createOrder(order);
        saveMyOrder(saved);
        // (Voucher consume + stock decrement đều đã làm trong RPC create_order
        //  — security: trước đây client tự gọi consume_voucher → abuse được.)
        sessionStorage.removeItem("ck_voucher");
        saveLastContact({
          customer_name:name, phone, email, address,
          street:order.street,
          province_code:order.province_code, province_name:order.province_name,
          district_code:order.district_code, district_name:order.district_name,
          ward_code:order.ward_code, ward_name:order.ward_name,
        });
        clearCheckoutDraft();
        if(window.SEO) SEO.trackPurchase(saved);
        Cart.items=[]; Cart.save();
        // Gửi email XÁC NHẬN trước khi chuyển trang. KHÔNG fire-and-forget vì
        // browser huỷ XHR khi navigate. Đợi tối đa 6s rồi chuyển trang (giữ nguyên "Đang xử lý...").
        const result = await Promise.race([
          Email.sendConfirmation({ ...saved, email }).catch(e=>({sent:false, reason:"error", error:e})),
          new Promise(r=>setTimeout(()=>r({sent:false, reason:"timeout"}), 6000)),
        ]);
        if(result && result.sent) sessionStorage.setItem("ck_email_sent_"+saved.code, email);
        else if(result && !["disabled","no-email"].includes(result.reason)) console.warn("[Email] không gửi được, reason:", result.reason, result.error);
        // Cache đơn vừa đặt trong sessionStorage để trang order.html show ngay
        // mà KHÔNG phải gọi RPC (RPC yêu cầu phone tail cho khách ẩn danh).
        // Khi user mở lại tab khác hoặc sau khi đóng tab, cache hết → vào lại
        // sẽ qua flow tra cứu bằng SĐT + mã đơn như bình thường.
        try{ sessionStorage.setItem("just_placed_"+saved.code, JSON.stringify(saved)); }catch(e){}
        location.href="order.html?code="+encodeURIComponent(saved.code)+"&new=1";
      }catch(err){
        console.error(err); btn.disabled=false; btn.textContent="Đặt hàng (COD)";
        toast("Lỗi đặt hàng: "+(err.message||err));
      }
    };
  }
  // Render lần đầu (chưa có addresses), sau khi fetch xong → re-render
  draw([]);
  savedAddrsPromise.then(list=>{
    if(Cart.items.length) draw(list);
  });
}

/* ---------------- CHECKOUT (đặt hàng) ---------------- */
function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s||"").trim()); }
// VN phone: 0xxx hoặc +84xxx, prefix 3/5/7/8/9, đúng 10 số sau prefix mạng
function isValidVNPhone(s){
  const v = (s||"").replace(/[\s.\-()]/g,"");
  return /^(\+84|0)(3|5|7|8|9)\d{8}$/.test(v);
}

/* Lưu / khôi phục draft form checkout vào localStorage (debounced) */
const CHECKOUT_DRAFT_KEY = "originals_checkout_draft_v1";
function loadCheckoutDraft(){ try{ return JSON.parse(localStorage.getItem(CHECKOUT_DRAFT_KEY)||"null"); }catch(e){ return null; } }
function saveCheckoutDraft(data){ try{ localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(data)); }catch(e){} }
function clearCheckoutDraft(){ try{ localStorage.removeItem(CHECKOUT_DRAFT_KEY); }catch(e){} }

/* Shopee-style address picker — 3 dropdown cascade (Tỉnh → Huyện → Xã) + ô số nhà/đường.
   Data: GHN master-data API qua edge function `ghn-proxy?action=master`.
   Mã địa chỉ trong đơn = GHN IDs trực tiếp → không cần resolve name → ID
   khi push lên GHN nữa.
   ---
   PERF: cache 24h trong localStorage. List tỉnh/huyện/xã GHN gần như cố
   định (đổi vài lần/năm), không cần fetch mỗi lần mở picker. Lần 2 mở
   checkout = đọc local = instant, không tốn 1-3s cold-start edge function. */
const _addrCache = { provinces: null, district: {}, ward: {} };
const ADDR_CACHE_TTL = 24 * 60 * 60 * 1000;   // 24h
// Map raw GHN row → {code, name} cho picker UI
const ghnProvinceItem = r => ({ code: String(r.ProvinceID), name: r.ProvinceName });
const ghnDistrictItem = r => ({ code: String(r.DistrictID), name: r.DistrictName });
const ghnWardItem     = r => ({ code: String(r.WardCode),   name: r.WardName });

function _addrLsGet(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const {ts, data} = JSON.parse(raw);
    if(Date.now() - ts > ADDR_CACHE_TTL) return null;
    return data;
  }catch(e){ return null; }
}
function _addrLsSet(key, data){
  try{ localStorage.setItem(key, JSON.stringify({ts: Date.now(), data})); }catch(e){}
}

async function fetchProvinces(){
  if(_addrCache.provinces) return _addrCache.provinces;
  const cached = _addrLsGet("ghn_provinces_v1");
  if(cached){ _addrCache.provinces = cached; return cached; }
  const rows = await GHN.master("province");
  const list = (Array.isArray(rows)?rows:[]).map(ghnProvinceItem);
  _addrCache.provinces = list;
  _addrLsSet("ghn_provinces_v1", list);
  return list;
}
async function fetchDistricts(provinceCode){
  if(_addrCache.district[provinceCode]) return _addrCache.district[provinceCode];
  const key = `ghn_districts_v1_${provinceCode}`;
  const cached = _addrLsGet(key);
  if(cached){ _addrCache.district[provinceCode] = cached; return cached; }
  const rows = await GHN.master("district", { province_id: +provinceCode });
  const list = (Array.isArray(rows)?rows:[]).map(ghnDistrictItem);
  _addrCache.district[provinceCode] = list;
  _addrLsSet(key, list);
  return list;
}
async function fetchWards(districtCode){
  if(_addrCache.ward[districtCode]) return _addrCache.ward[districtCode];
  const key = `ghn_wards_v1_${districtCode}`;
  const cached = _addrLsGet(key);
  if(cached){ _addrCache.ward[districtCode] = cached; return cached; }
  const rows = await GHN.master("ward", { district_id: +districtCode });
  const list = (Array.isArray(rows)?rows:[]).map(ghnWardItem);
  _addrCache.ward[districtCode] = list;
  _addrLsSet(key, list);
  return list;
}

/* Prefetch list tỉnh khi mở checkout (background, không đợi). Khi user click
   "Chọn tỉnh/thành" thì data đã sẵn → modal mở instant. */
function prefetchAddressData(){
  fetchProvinces().catch(()=>{});
}
function openAddrPicker(title, list, onSelect){
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.id = "addrPickModal";
  ov.innerHTML = `<div class="modal addr-pick-modal">
    <h3 class="modal-title">${escapeXML(title)}</h3>
    <button class="modal-close" aria-label="Đóng">×</button>
    <input type="text" class="addr-pick-search" placeholder="🔍 Tìm kiếm...">
    <div class="addr-pick-listwrap">
      <div class="addr-pick-list">
        ${list.map((it,i)=>`<button type="button" class="addr-pick-item" data-i="${i}">${escapeXML(it.name)}</button>`).join("")}
      </div>
      <div class="addr-pick-empty" hidden>
        <div class="addr-pick-empty-ic">🔍</div>
        <div class="addr-pick-empty-text">Không tìm thấy địa danh nào khớp với "<b id="addrPickEmptyQ"></b>"</div>
        <div class="muted" style="font-size:12px;margin-top:6px">Thử gõ ngắn hơn hoặc đổi cách viết (vd: "Hà Nội" → "ha noi")</div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  const close = ()=>{ ov.classList.remove("show"); setTimeout(()=>ov.remove(), 200); };
  ov.querySelector(".modal-close").onclick = close;
  ov.addEventListener("click", e=>{ if(e.target===ov) close(); });
  const search = ov.querySelector(".addr-pick-search");
  const lst = ov.querySelector(".addr-pick-list");
  const empty = ov.querySelector(".addr-pick-empty");
  const emptyQ = ov.querySelector("#addrPickEmptyQ");
  // Bỏ dấu để search "ha noi" ra "Hà Nội"
  const noDiacritics = (s)=> (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d");
  search.addEventListener("input", ()=>{
    const q = noDiacritics((search.value||"").trim());
    let matched = 0;
    lst.querySelectorAll(".addr-pick-item").forEach(b=>{
      const name = noDiacritics(b.textContent);
      const show = (!q || name.includes(q));
      b.style.display = show ? "" : "none";
      if(show) matched++;
    });
    // Show empty placeholder + giữ chiều cao list (không co popup)
    if(matched===0 && q){
      empty.hidden = false;
      lst.style.display = "none";
      emptyQ.textContent = search.value.trim();
    } else {
      empty.hidden = true;
      lst.style.display = "";
    }
  });
  lst.onclick = (e)=>{
    const b = e.target.closest(".addr-pick-item");
    if(!b) return;
    onSelect(list[+b.dataset.i]);
    close();
  };
  setTimeout(()=>search.focus(), 100);
}
/* Trả state hiện tại để form submit có thể đọc structured fields */
let _addrPickerState = null;
function getAddressState(){ return _addrPickerState; }

function bindAddressPicker(prefill, onChange){
  const pBtn = $("#addrPBtn"), dBtn = $("#addrDBtn"), wBtn = $("#addrWBtn");
  const streetInp = $("#addrStreet"), addrInp = $("#addrInput");
  const state = { p: null, d: null, w: null };
  _addrPickerState = state;
  const fire = ()=>{ if(typeof onChange==="function") try{ onChange(state); }catch(e){} };
  const setLabel = (btn, txt, active)=>{
    const val = btn.querySelector(".addr-sel-val");
    if(val) val.textContent = txt;
    btn.classList.toggle("active", !!active);
  };
  const syncFinal = ()=>{
    const parts = [];
    if(streetInp.value.trim()) parts.push(streetInp.value.trim());
    if(state.w) parts.push(state.w.name);
    if(state.d) parts.push(state.d.name);
    if(state.p) parts.push(state.p.name);
    addrInp.value = parts.join(", ");
    state.street = streetInp.value.trim();
    if(addrInp.value) setFieldError(addrInp, "");
  };
  const loadingBtn = (btn, on)=>{ btn.disabled = on; btn.classList.toggle("loading", on); };
  pBtn.onclick = async ()=>{
    loadingBtn(pBtn, true);
    try{
      const list = await fetchProvinces();
      loadingBtn(pBtn, false);
      openAddrPicker("Chọn Tỉnh/Thành phố", list, (item)=>{
        state.p = item; state.d = null; state.w = null;
        setLabel(pBtn, item.name, true);
        setLabel(dBtn, "Chọn", false); dBtn.disabled = false;
        setLabel(wBtn, "Chọn", false); wBtn.disabled = true;
        syncFinal(); fire();
      });
    }catch(e){ loadingBtn(pBtn, false); toast("Lỗi tải danh sách tỉnh"); }
  };
  dBtn.onclick = async ()=>{
    if(!state.p) return;
    loadingBtn(dBtn, true);
    try{
      const list = await fetchDistricts(state.p.code);
      loadingBtn(dBtn, false);
      openAddrPicker(`Chọn Quận/Huyện · ${state.p.name}`, list, (item)=>{
        state.d = item; state.w = null;
        setLabel(dBtn, item.name, true);
        setLabel(wBtn, "Chọn", false); wBtn.disabled = false;
        syncFinal(); fire();
      });
    }catch(e){ loadingBtn(dBtn, false); toast("Lỗi tải danh sách huyện"); }
  };
  wBtn.onclick = async ()=>{
    if(!state.d) return;
    loadingBtn(wBtn, true);
    try{
      const list = await fetchWards(state.d.code);
      loadingBtn(wBtn, false);
      openAddrPicker(`Chọn Phường/Xã · ${state.d.name}`, list, (item)=>{
        state.w = item;
        setLabel(wBtn, item.name, true);
        syncFinal(); fire();
      });
    }catch(e){ loadingBtn(wBtn, false); toast("Lỗi tải danh sách xã"); }
  };
  streetInp.addEventListener("input", syncFinal);
  // Khởi tạo từ prefill có structured (chỉ áp dụng nếu prefill đã dùng GHN IDs;
  // dữ liệu cũ từ VN gov code sẽ không match → user phải chọn lại).
  if(prefill && prefill.province_code && prefill.district_code){
    state.p = { code: prefill.province_code, name: prefill.province_name };
    setLabel(pBtn, prefill.province_name, true);
    state.d = { code: prefill.district_code, name: prefill.district_name };
    setLabel(dBtn, prefill.district_name, true);
    dBtn.disabled = false;
    if(prefill.ward_code){
      state.w = { code: prefill.ward_code, name: prefill.ward_name };
      setLabel(wBtn, prefill.ward_name, true);
    }
    wBtn.disabled = false;
  }
  if(streetInp.value.trim()) syncFinal();
}

/* Modal chi tiết đơn — vertical timeline + receipt style */
function openOrderDetailModal(o){
  const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
  const steps=["pending","confirmed","shipping","completed"];
  // Horizontal timeline (ngang) — track xám + fill xanh theo --progress
  const htimeline = o.status==="cancelled"
    ? `<div class="od-cancel">Đơn hàng này đã bị huỷ.</div>`
    : `<div class="od-track-card">
        <div class="timeline" style="--progress:${Math.max(0,st.step)/(steps.length-1)}">${steps.map(s=>{const info=ORDER_STATUS[s];const done=info.step<=st.step;const cur=info.step===st.step;
        return `<div class="tl-step ${done?'done':''} ${cur?'cur':''}"><div class="tl-dot">${done?'<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5"/></svg>':''}</div><div class="tl-label">${info.label}</div></div>`;}).join("")}</div>
      </div>`;

  const items=(o.items||[]).map(it=>{
    const url=`product.html?id=${encodeURIComponent(it.id)}`;
    const colorName = (S.colorName&&it.color)?S.colorName(it.color):"";
    return `<div class="od-r-item">
      <a class="od-r-thumb" href="${url}">${orderItemImage(it)}</a>
      <div class="od-r-info">
        <a class="od-r-name" href="${url}">${escapeXML(it.name)}</a>
        <div class="od-r-meta">
          ${it.color?`<span class="od-swatch" style="background:${safeColor(it.color)}"></span>${escapeXML(colorName||it.color)}`:""}
          ${it.size?` · Size ${escapeXML(it.size)}`:""}
          · <b>×${it.qty}</b>
        </div>
      </div>
      <div class="od-r-price">${money(it.price*it.qty)}</div>
    </div>`;
  }).join("");

  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="orderDetailModal";
  ov.innerHTML=`<div class="modal od-modal od-modal-v" style="--od-accent:${st.color}">
    <div class="od-head">
      <button class="modal-close" id="odClose" aria-label="Đóng">×</button>
      <div class="od-head-top">
        <div class="od-head-left"><div class="od-eyebrow">Đơn hàng</div><h3 class="od-code">#${escapeXML(o.code)}</h3></div>
        <span class="status-pill" style="background:${st.color}">${st.label}</span>
      </div>
      <div class="od-date">🕒 Đặt lúc ${new Date(o.created_at).toLocaleString("vi-VN")}</div>
    </div>
    <div class="od-body">
      <div class="od-v-section od-v-track">
        <div class="od-v-title">Tiến trình đơn hàng</div>
        ${htimeline}
      </div>

      <div class="od-v-section">
        <div class="od-v-title">Sản phẩm <span class="od-count">${(o.items||[]).length}</span></div>
        <div class="od-receipt">${items}</div>
      </div>

      <div class="od-v-section">
        <div class="od-v-title">📍 Giao tới</div>
        <div class="od-v-ship">
          <div class="od-v-ship-row1"><b>${escapeXML(o.customer_name||"")}</b><span class="od-v-sep">·</span><span>${escapeXML(o.phone||"")}</span></div>
          <div class="od-v-ship-addr">${escapeXML(o.address||"")}</div>
          ${o.note?`<div class="od-v-ship-note"><b>Ghi chú:</b> ${escapeXML(o.note)}</div>`:""}
        </div>
      </div>

      <div class="od-v-section od-v-sum">
        <div class="line"><span>Tạm tính</span><span>${money(o.subtotal||0)}</span></div>
        <div class="line"><span>Phí giao hàng</span><span>${o.shipping?money(o.shipping):"Miễn phí"}</span></div>
        <div class="line"><span class="muted" style="font-size:12px">Hình thức</span><span class="muted" style="font-size:12px">COD</span></div>
        <div class="total"><span>Tổng thanh toán</span><span class="od-total-amount">${money(o.total||0)}</span></div>
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
      // Bỏ heading "Đơn của tôi" trong block vì H1 page-title đã có; tránh trùng lặp.
      if(myOrders.length){
        accountBlock = myOrders.map(o=>{
          const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
          return `<button type="button" class="my-orders-row" data-code="${escapeXML(o.code)}">
            <div><div class="mo-code">${escapeXML(o.code)}</div><div class="mo-date">${new Date(o.created_at).toLocaleString("vi-VN")} · ${(o.items||[]).reduce((s,i)=>s+i.qty,0)} sản phẩm</div></div>
            <div class="mo-meta-right"><div class="mo-total">${money(o.total||0)}</div><span class="mo-status" style="background:${st.color}">${st.label}</span></div>
            <span class="mo-arrow" aria-hidden="true">›</span>
          </button>`;
        }).join("");
      } else {
        accountBlock = `<p class="muted" style="margin-bottom:24px">Bạn chưa có đơn nào trên tài khoản <b>${escapeXML(Auth.email())}</b>. Đặt đơn đầu tiên nhé!</p>`;
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
      <h1 class="page-title">${Auth.isLoggedIn()?`Đơn của tôi${myOrders.length?` <span class="page-count">(${myOrders.length})</span>`:""}`:"Tra cứu đơn hàng"}</h1></div>
    <div class="wrap" style="max-width:680px;padding-bottom:60px">
      ${msg?`<div class="notice err">${msg}</div>`:""}
      ${accountBlock}
      <h3 style="font-family:var(--font-display);text-transform:uppercase;font-size:16px;margin:28px 0 12px">Tra cứu đơn hàng</h3>
      <p class="muted" style="margin-bottom:14px;font-size:13.5px">Nhập mã đơn + số điện thoại đã đặt đơn.</p>
      <form id="lookup" style="margin:0 0 24px;display:flex;flex-direction:column;gap:10px;max-width:420px">
        <div class="fld" style="margin:0"><input id="codeInput" value="${escapeXML(code||"")}" placeholder="Mã đơn (vd OR1A2B3)" required style="text-transform:uppercase"></div>
        ${!Auth.isLoggedIn()?`<div class="fld" style="margin:0"><input id="phoneInput" placeholder="Số điện thoại đã đặt đơn" inputmode="tel" required></div>`:""}
        <button class="btn btn-dark" type="submit">Tra cứu</button>
      </form>
      ${recentBlock}
    </div>`;
    const needsPhone = !Auth.isLoggedIn();
    $("#lookup").onsubmit=async e=>{
      e.preventDefault();
      const btn=e.target.querySelector("button[type=submit]");
      if(btn && btn.disabled) return;
      const inp=$("#codeInput"), c=inp.value.trim().toUpperCase();
      if(!c){ setFieldError(inp, "Vui lòng nhập mã đơn"); inp.focus(); return; }
      setFieldError(inp,"");
      let phone = "";
      if(needsPhone){
        const pinp=$("#phoneInput");
        phone = (pinp.value||"").replace(/\D/g,"");
        if(phone.length < 4){ setFieldError(pinp, "Vui lòng nhập số điện thoại"); pinp.focus(); return; }
        setFieldError(pinp,"");
      }
      if(btn){ btn.disabled=true; btn.textContent="Đang tìm…"; }
      let found=null;
      try{ found = await DB.getOrderByCode(c, phone); }catch(err){ console.warn(err); }
      if(!found){
        if(btn){ btn.disabled=false; btn.textContent="Tra cứu"; }
        setFieldError(needsPhone?$("#phoneInput"):inp, "Không tìm thấy đơn — kiểm tra lại mã & SĐT");
        return;
      }
      // Cache đơn → reload trang cùng URL → renderOrder đọc từ cache → render instant.
      try{ sessionStorage.setItem("just_placed_"+found.code, JSON.stringify(found)); }catch(e){}
      location.href="order.html?code="+encodeURIComponent(found.code);
    };
    const ovl=$("#ovLogin"); if(ovl) ovl.onclick=openLoginModal;
    // Click vào hàng đơn → mở modal chi tiết (không cần fetch lại từ server)
    $$(".my-orders-row").forEach(b=> b.onclick=()=>{
      const o=myOrders.find(x=>x.code===b.dataset.code);
      if(o) openOrderDetailModal(o);
    });
  }

  if(!code){ await lookupView(); return; }

  // Ưu tiên cache đơn vừa đặt (cùng session) → khách ẩn danh không bị
  // bắt nhập SĐT lại ngay sau khi đặt đơn.
  let o = null;
  try{
    const cached = sessionStorage.getItem("just_placed_"+code);
    if(cached) o = JSON.parse(cached);
  }catch(e){}

  if(!o){
    showAppLoader();
    try{ o = await DB.getOrderByCode(code); }catch(e){ console.warn(e); }
    hideAppLoader();
  }

  if(!o){
    const msg = Auth.isLoggedIn()
      ? `Đơn <strong>${escapeXML(code)}</strong> không thuộc về tài khoản <b>${escapeXML(Auth.email())}</b>. Đăng xuất nếu cần tra cứu bằng SĐT.`
      : `Để xem đơn <strong>${escapeXML(code)}</strong>, vui lòng nhập số điện thoại đã dùng đặt đơn.`;
    await lookupView(msg);
    return;
  }

  const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
  const steps=["pending","confirmed","shipping","completed"];
  const timeline = o.status==="cancelled"
    ? `<div class="notice err">Đơn hàng này đã bị huỷ.</div>`
    : `<div class="od-track-card">
        <div class="timeline" style="--progress:${Math.max(0,st.step)/(steps.length-1)}">${steps.map(s=>{const info=ORDER_STATUS[s];const done=info.step<=st.step;const cur=info.step===st.step;
        return `<div class="tl-step ${done?'done':''} ${cur?'cur':''}"><div class="tl-dot">${done?'<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5"/></svg>':''}</div><div class="tl-label">${info.label}</div></div>`;}).join("")}</div></div>`;

  const items=(o.items||[]).map(it=>{
    return `<div class="cart-item">
      <div class="ci-thumb">${orderItemImage(it)}</div>
      <div><h4>${escapeXML(it.name||"")}</h4><div class="ci-meta">Màu <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safeColor(it.color)};border:1px solid #ccc;vertical-align:middle"></span> · Size ${escapeXML(it.size||"")} · SL ${it.qty}</div></div>
      <div style="text-align:right;font-weight:700">${money(it.price*it.qty)}</div></div>`;}).join("");

  root.innerHTML=`
  <div class="wrap page-head"><div class="crumb"><a href="index.html">Trang chủ</a> / <a href="order.html">Tra cứu đơn hàng</a></div>
    <h1 class="page-title">#${escapeXML(o.code)}</h1>
    <div style="margin-top:8px"><span class="status-pill" style="background:${st.color}">${st.label}</span>
    <span class="muted" style="margin-left:10px">Đặt lúc ${new Date(o.created_at).toLocaleString("vi-VN")}</span></div>
  </div>
  <div class="wrap cart-wrap">
    <div>
      ${timeline}
      <div id="ghnTrackBox"></div>
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

  // GHN tracking — chỉ render khi đơn đã có mã vận đơn.
  if(o.ghn_order_code){
    renderGhnTrack(o);
  }
  if(param("new")==="1"){
    const sentTo = sessionStorage.getItem("ck_email_sent_"+o.code);
    if(sentTo){
      toast("Đặt hàng thành công! \nĐã gửi email tới "+sentTo);
      sessionStorage.removeItem("ck_email_sent_"+o.code);
    } else {
      toast("Đặt hàng thành công! Mã đơn: "+o.code);
    }
  }
}

/* ---------------- GHN TRACKING (khách) ----------------
   Bật khi đơn đã có ghn_order_code. Tự pull GHN status mới nhất (qua edge
   function `track`) rồi load events từ bảng ghn_tracking_events. Nếu auto
   pull lỗi, vẫn fallback hiển thị snapshot DB hiện có. */
const GHN_STATUS_VI = {
  ready_to_pick:  "Chờ shipper lấy hàng",
  picking:        "Đang lấy hàng",
  money_collect_picking: "Đang lấy hàng",
  picked:         "Đã lấy hàng",
  storing:        "Đang ở kho GHN",
  transporting:   "Đang vận chuyển",
  sorting:        "Đang phân loại",
  delivering:     "Đang giao tới bạn",
  money_collect_delivering: "Đang giao tới bạn",
  delivered:      "Giao thành công",
  delivery_fail:  "Giao thất bại",
  waiting_to_return: "Chờ trả hàng",
  return:         "Đang trả hàng",
  return_transporting: "Đang trả hàng",
  return_sorting: "Đang phân loại trả",
  returning:      "Đang trả về shop",
  return_fail:    "Trả hàng thất bại",
  returned:       "Đã trả hàng",
  cancel:         "Đã huỷ",
  exception:      "Có vấn đề",
  damage:         "Hư hỏng",
  lost:           "Thất lạc",
};
const GHN_DONE_ORDER = ["ready_to_pick","picking","picked","storing","transporting","sorting","delivering","delivered"];

async function renderGhnTrack(o){
  const box = $("#ghnTrackBox");
  if(!box) return;
  const ghnUrl = `https://tracking.ghn.dev/?order_code=${encodeURIComponent(o.ghn_order_code)}`;
  const etaTxt = o.ghn_expected_at
    ? `Dự kiến giao: <b>${new Date(o.ghn_expected_at).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</b>`
    : "";
  const skeleton = (status, events, refreshing)=>{
    const stName = GHN_STATUS_VI[status] || status || "Đang xử lý";
    const stepIdx = Math.max(0, GHN_DONE_ORDER.indexOf(status));
    const isDelivered = status === "delivered";
    const isCancelled = status === "cancel" || status === "returned" || status === "return_fail";
    const progressColor = isDelivered ? "var(--success,#1d9e75)" : isCancelled ? "var(--sale,#e02424)" : "#7a5cff";
    // 4 mốc rút gọn (cho UI cảm giác liền mạch với timeline trên)
    const milestones = [
      { keys:["ready_to_pick"],                                    label:"Đã nhận đơn" },
      { keys:["picking","money_collect_picking","picked","storing"], label:"Đã lấy hàng" },
      { keys:["transporting","sorting","delivering","money_collect_delivering"], label:"Đang vận chuyển" },
      { keys:["delivered"],                                        label:"Đã giao" },
    ];
    const reachedIdx = milestones.findIndex(m => m.keys.includes(status));
    const progressFraction = isDelivered ? 1 : Math.max(0, reachedIdx) / (milestones.length-1);
    const eventList = events.length
      ? events.slice().reverse().map(e=>{
          const dt = new Date(e.event_at || e.created_at).toLocaleString("vi-VN");
          return `<li>
            <div class="ghn-ev-dot"></div>
            <div class="ghn-ev-body">
              <div class="ghn-ev-status">${escapeXML(e.status_name || GHN_STATUS_VI[e.status] || e.status)}</div>
              ${e.description ? `<div class="ghn-ev-desc">${escapeXML(e.description)}</div>` : ""}
              <div class="ghn-ev-time">${dt}${e.location ? ` · ${escapeXML(e.location)}` : ""}</div>
            </div>
          </li>`;
        }).join("")
      : `<li class="ghn-ev-empty muted">Chưa có cập nhật chi tiết từ GHN.</li>`;
    return `<section class="ghn-track">
      <header class="ghn-track-head">
        <div>
          <h3>Vận đơn GHN</h3>
          <div class="ghn-meta">
            <span class="ghn-code">${escapeXML(o.ghn_order_code)}</span>
            <button type="button" class="ghn-copy" data-c="${escapeXML(o.ghn_order_code)}" title="Sao chép mã">Copy</button>
            ${etaTxt ? `<span class="ghn-eta">${etaTxt}</span>` : ""}
          </div>
        </div>
        <a class="btn btn-outline btn-sm" href="${ghnUrl}" target="_blank" rel="noopener">Xem trên GHN ↗</a>
      </header>
      <div class="ghn-status-row">
        <span class="ghn-status-pill" style="background:${progressColor}">${escapeXML(stName)}</span>
        ${refreshing ? `<span class="muted ghn-refresh-tag">Đang cập nhật…</span>` : ""}
      </div>
      <div class="ghn-mini-timeline" style="--progress:${progressFraction};--bar-color:${progressColor}">
        ${milestones.map((m,i)=>{
          const done = i<=reachedIdx;
          const cur  = i===reachedIdx && !isDelivered;
          return `<div class="ghn-mile ${done?'done':''} ${cur?'cur':''}">
            <div class="ghn-mile-dot"></div>
            <div class="ghn-mile-label">${m.label}</div>
          </div>`;
        }).join("")}
      </div>
      <h4 class="ghn-events-title">Lịch sử vận chuyển</h4>
      <ul class="ghn-events">${eventList}</ul>
    </section>`;
  };

  // Render ngay với DB snapshot
  let events = await DB.getTracking(o.code);
  box.innerHTML = skeleton(o.ghn_status, events, !!(window.GHN && window.GHN.enabled));
  bindGhnCopy(box);

  // Pull GHN status mới nhất (best-effort, không block UI)
  if(window.GHN && window.GHN.enabled){
    try{
      await GHN.track(o.code);
      // Re-fetch event list + order để có status mới nhất sau khi pull
      const [freshEvents, freshOrder] = await Promise.all([
        DB.getTracking(o.code),
        DB.getOrderByCode(o.code),
      ]);
      const status = (freshOrder && freshOrder.ghn_status) || o.ghn_status;
      o.ghn_status = status;
      o.ghn_expected_at = (freshOrder && freshOrder.ghn_expected_at) || o.ghn_expected_at;
      box.innerHTML = skeleton(status, freshEvents, false);
      bindGhnCopy(box);
    }catch(e){
      console.warn("[GHN.track] lỗi → giữ snapshot DB:", e.message);
      // Xoá tag "Đang cập nhật…" mà thôi
      box.innerHTML = skeleton(o.ghn_status, events, false);
      bindGhnCopy(box);
    }
  }
}

function bindGhnCopy(box){
  const btn = box.querySelector(".ghn-copy");
  if(!btn) return;
  btn.onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(btn.dataset.c);
      const old = btn.textContent;
      btn.textContent = "Đã copy ✓";
      setTimeout(()=>{ btn.textContent = old; }, 1500);
    }catch(e){
      console.warn("clipboard", e);
    }
  };
}

/* ---------------- CATEGORIES ---------------- */
const Categories = { loaded:false, async load(){
  try{ const rows=await DB.listCategories(); if(rows&&rows.length) S.CATEGORIES.splice(0,S.CATEGORIES.length,...rows); }
  catch(e){ console.warn("Categories.load",e); }
  this.loaded=true;
}};

/* ---------------- COLORS ---------------- */
const Colors = { loaded:false, async load(){
  try{ const rows=await DB.listColors(); if(rows&&rows.length) S.COLORS.splice(0,S.COLORS.length,...rows); }
  catch(e){ console.warn("Colors.load",e); }
  this.loaded=true;
}};

/* ---------------- HOME SETTINGS (admin tự custom) ----------------
   `Home.get()` luôn trả object có đủ field — thiếu thì fallback defaults.
   Admin lưu vào key "home" qua DB.saveSettings, load lúc boot. */
const Home = {
  data: null,
  defaults: {
    tickerHeader: [
      "🚚 Miễn phí giao hàng cho đơn từ 500.000₫",
      "⚡ Sale tới 50% toàn bộ sản phẩm",
      "↩ Đổi trả miễn phí trong 7 ngày",
      "✨ Hàng mới về mỗi tuần",
      "💬 Hỗ trợ tư vấn 24/7",
    ],
    tickerBottom: ["★ FREESHIP 500K","★ SALE 50%","★ NEW ARRIVALS"],
    heroHeadline: "Be Bold.<br>Be New.<br>Be <em>Original.</em>",
    heroSub: "",
    heroCta: "Khám phá bộ sưu tập",
    heroCtaHref: "collection.html",
    heroImage: "",
    catTiles: [],
    perks: [
      {icon:"🚚", title:"Freeship 500K", desc:"Toàn quốc cho đơn từ 500.000₫"},
      {icon:"↩",  title:"Đổi trả 7 ngày", desc:"Đổi size, đổi mẫu dễ dàng"},
      {icon:"✓",  title:"Chất liệu cao cấp", desc:"Cotton 100% form relaxed"},
      {icon:"💬", title:"Hỗ trợ 24/7", desc:"Nhắn tin là có phản hồi"},
    ],
    stripText: "",
    newsletterTitle: "Đăng ký nhận ưu đãi",
    newsletterSub: "Nhập email để nhận mã giảm giá, quà tặng và tin sản phẩm mới nhất.",
    footerAbout: "",
    featureBlocks: [
      {eyebrow:"Signature",     title:"Relaxed Fit",      sub:"Bán chạy nhất",       cta:"Khám phá", href:"collection.html?cat=ao-thun", from:"#1d1d1d", to:"#444",    image:"", catKey:"ao-thun", collection:"Coffee Club",  reverse:false},
      {eyebrow:"Aesthetic",     title:"Ringer Tee",       sub:"Phong cách cổ điển",  cta:"Mua ngay", href:"collection.html?cat=ringer",  from:"#2c3a4f", to:"#5b7da0", image:"", catKey:"ringer",  collection:"Ocean Calling",reverse:true},
      {eyebrow:"Pure comfort",  title:"Polo Relaxed",     sub:"Lịch sự mà thoải mái",cta:"Khám phá", href:"collection.html?cat=polo",    from:"#3f5c46", to:"#6f7445", image:"", catKey:"polo",    collection:"Old Money",    reverse:false},
      {eyebrow:"New drop",      title:"Tank Top",         sub:"Hè 2026",             cta:"Khám phá", href:"collection.html?cat=ba-lo",   from:"#b5523a", to:"#d8a441", image:"", catKey:"ba-lo",   collection:"",             reverse:true},
      {eyebrow:"Everyday",      title:"Hoodie & Sweater", sub:"Ấm áp mỗi ngày",      cta:"Khám phá", href:"collection.html?cat=hoodie",  from:"#2c3a4f", to:"#1c1c1c", image:"", catKey:"hoodie",  collection:"",             reverse:false},
    ],
  },
  get(){ return this.data || this.defaults; },
  tile(catKey){
    const tiles = this.get().catTiles || [];
    return tiles.find(t=>t.key===catKey) || null;
  },
  async load(){
    try{
      const v = await DB.getSettings("home");
      if(v && typeof v==="object") this.data = {...this.defaults, ...v};
    }catch(e){ console.warn("Home.load",e); }
  },
};

/* ---------------- CATALOG ---------------- */
// Cloud mode: LUÔN replace PRODUCTS bằng data cloud (kể cả rỗng), không giữ
// demo data từ data.js (id là slug, không match UUID schema → crash khi
// add to cart + checkout). Local mode: giữ demo seed.
const Catalog = { loaded:false, async load(){
  try{
    const rows = await DB.listProducts();
    if(DB.cloud){
      S.PRODUCTS.splice(0, S.PRODUCTS.length, ...(rows||[]));
    } else if(rows && rows.length){
      S.PRODUCTS.splice(0, S.PRODUCTS.length, ...rows);
    }
  }catch(e){ console.warn("Catalog.load",e); }
  this.loaded=true;
}};

// Cart cleanup: bỏ item có id không match UUID khi cloud mode. Tránh trường
// hợp user còn cart cũ với slug ID (từ session trước khi cloud setup xong).
function pruneCartForCloud(){
  if(!DB.cloud) return;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const before = Cart.items.length;
  Cart.items = Cart.items.filter(it => uuidRe.test(it.id||""));
  if(Cart.items.length < before){
    Cart.save();
    const dropped = before - Cart.items.length;
    console.warn("[Cart] đã xoá", dropped, "item không hợp lệ (slug ID cũ từ demo data)");
    setTimeout(()=>{
      if(typeof toast === "function") toast(`Đã xoá ${dropped} sản phẩm cũ khỏi giỏ`);
    }, 800);
  }
}

/* ---------------- LOADING OVERLAY (đơn giản, transparent + blur) ---------------- */
function showAppLoader(){
  if($("#appLoader")) return;
  const el = document.createElement("div");
  el.id="appLoader"; el.className="app-loader";
  el.innerHTML = `<div class="al-logo">${escapeXML(S.BRAND?.name||"VOISTUDIO")}<span class="dot">.</span></div><div class="app-spinner"></div>`;
  document.body.appendChild(el);
}
function hideAppLoader(){
  const el = $("#appLoader"); if(!el) return;
  el.classList.add("hide");
  setTimeout(()=>el.remove(), 400);
}

/* ---------------- SKELETON (deprecated — giữ để stub helpers nếu có chỗ gọi cũ) ----------------
   Không dùng cho boot nữa; đã quay lại showAppLoader. */
const skCard = ()=>`<article class="card sk-card">
  <div class="sk sk-thumb"></div>
  <div class="sk-info">
    <span class="sk sk-line w-30"></span>
    <span class="sk sk-line w-90"></span>
    <span class="sk sk-line w-60"></span>
  </div>
</article>`;
const skGrid = (n=8)=>`<div class="grid">${Array.from({length:n}, skCard).join("")}</div>`;
const skHeaderHTML = `<div class="sk-header"><div class="wrap" style="display:flex;align-items:center;gap:16px;padding:18px 20px">
  <span class="sk sk-block" style="width:30px;height:20px"></span>
  <span class="sk sk-block" style="width:140px;height:20px;margin:0 auto"></span>
  <span class="sk sk-block" style="width:34px;height:30px;border-radius:50%"></span>
  <span class="sk sk-block" style="width:34px;height:30px;border-radius:50%"></span>
</div></div>`;
function renderSkeleton(page){
  const root = $("#page"); if(!root) return;
  // Header skeleton — render ngay vào #site-header để không trắng đầu trang
  const sh = $("#site-header"); if(sh && !sh.children.length) sh.innerHTML = skHeaderHTML;
  if(page==="home"){
    root.innerHTML = `<section class="sk-hero"></section>
      <div class="wrap" style="padding:40px 0">${skGrid(4)}</div>
      <div class="wrap" style="padding:0 0 60px">${skGrid(8)}</div>`;
  } else if(page==="collection"){
    root.innerHTML = `<div class="wrap page-head"><span class="sk sk-line" style="width:180px;height:13px;margin-bottom:14px"></span><span class="sk sk-line" style="width:280px;height:36px"></span></div>
      <div class="wrap" style="padding-bottom:60px">${skGrid(8)}</div>`;
  } else if(page==="product"){
    root.innerHTML = `<div class="wrap" style="padding:24px 0">
      <div class="sk-pdp">
        <div class="sk sk-pdp-img"></div>
        <div class="sk-pdp-info">
          <span class="sk sk-line" style="width:120px;height:12px"></span>
          <span class="sk sk-line" style="width:80%;height:32px"></span>
          <span class="sk sk-line" style="width:140px;height:24px"></span>
          <span class="sk sk-line" style="width:90%;height:12px"></span>
          <span class="sk sk-line" style="width:80%;height:12px"></span>
          <span class="sk sk-line" style="width:160px;height:42px;border-radius:30px;margin-top:18px"></span>
          <span class="sk sk-line" style="width:60%;height:14px"></span>
          <div style="display:flex;gap:8px;margin-top:18px">${Array.from({length:4}, _=>`<span class="sk sk-block" style="width:46px;height:42px;border-radius:8px"></span>`).join("")}</div>
          <span class="sk sk-line" style="width:100%;height:54px;border-radius:14px;margin-top:24px"></span>
        </div>
      </div></div>`;
  } else if(page==="cart"){
    root.innerHTML = `<div class="wrap page-head"><span class="sk sk-line" style="width:260px;height:36px"></span></div>
      <div class="wrap sk-cart">
        <div>${Array.from({length:3}, _=>`<div class="sk-cart-row">
          <span class="sk sk-block" style="width:104px;aspect-ratio:4/5;border-radius:10px"></span>
          <div style="flex:1"><span class="sk sk-line" style="width:60%;height:14px;margin-bottom:8px"></span><span class="sk sk-line" style="width:40%;height:12px;margin-bottom:14px"></span><span class="sk sk-line" style="width:120px;height:32px;border-radius:30px"></span></div>
          <span class="sk sk-line" style="width:80px;height:18px"></span>
        </div>`).join("")}</div>
        <aside><span class="sk sk-block" style="width:100%;height:300px;border-radius:14px"></span></aside>
      </div>`;
  } else if(page==="order"){
    root.innerHTML = `<div class="wrap page-head"><span class="sk sk-line" style="width:160px;height:12px;margin-bottom:14px"></span><span class="sk sk-line" style="width:240px;height:36px"></span></div>
      <div class="wrap" style="max-width:680px;padding-bottom:60px">
        ${Array.from({length:3}, _=>`<div class="sk-order-row">
          <div style="flex:1"><span class="sk sk-line" style="width:140px;height:15px;margin-bottom:8px"></span><span class="sk sk-line" style="width:80%;height:12px"></span></div>
          <span class="sk sk-block" style="width:100px;height:26px;border-radius:30px"></span>
        </div>`).join("")}
      </div>`;
  } else {
    root.innerHTML = `<div class="wrap" style="padding:60px 0">${skGrid(6)}</div>`;
  }
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
  const page = document.body.dataset.page;
  await Promise.all([Categories.load(), Colors.load(), Home.load(), Auth.init()]);
  await Catalog.load();
  pruneCartForCloud();   // bỏ item slug ID cũ ra khỏi cart trước khi render
  renderHeader();
  renderFooter();
  if(page==="home") renderHome();
  if(page==="collection") renderCollection();
  if(page==="product") renderProduct();
  if(page==="cart") renderCart();
  if(page==="order") renderOrder();
  Auth.onChange(()=>{
    const pg = document.body.dataset.page;
    if(pg==="order") renderOrder();
    else if(pg==="cart") renderCart();
  });
  initScrollTop();
  requestAnimationFrame(hideAppLoader);
});
