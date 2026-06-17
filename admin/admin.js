/* =========================================================
   ORIGINALS ADMIN — quản lý đơn hàng & sản phẩm
   ========================================================= */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const S = window.STORE;
const money = S.formatVND;
const esc = (s)=>(s||"").toString().replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const STATUS = {pending:"Chờ xác nhận",confirmed:"Đã xác nhận",shipping:"Đang giao",completed:"Hoàn thành",cancelled:"Đã huỷ"};
const STATUS_COLOR = {pending:"#d8a441",confirmed:"#378add",shipping:"#7a5cff",completed:"#1d9e75",cancelled:"#e02424"};
const SIZES_ALL = ["S","M","L","XL","2XL","Freesize"];

const A = { user:null, tab:"orders" };

function thumb(p){
  if(p.image_url) return `<img src="${esc(p.image_url)}" alt="">`;
  return S.productSVG(p,{seed:0});
}
function toast(msg){
  let t=$(".toast"); if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t);}
  t.textContent="✓ "+msg; requestAnimationFrame(()=>t.classList.add("show"));
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ---------------- BOOT / AUTH ---------------- */
async function boot(){
  A.user = await DB.getUser();
  if(!A.user || !DB.isAdmin(A.user)){ renderLogin(A.user); return; }
  renderShell();
  switchTab(A.tab);
}

function renderLogin(user){
  const denied = user && !DB.isAdmin(user);
  const gsvg = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/><path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.6 0-12.2-4.5-14.2-10.5l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>`;
  const adminEmail = (window.CONFIG.ADMIN_EMAILS||[""])[0]||"";
  document.body.innerHTML = `<div class="login-screen"><div class="login-card">
    <div class="logo">${S.BRAND.name}<span class="dot">.</span></div>
    <p>Trang quản trị cửa hàng</p>
    ${denied
      ? `<div class="notice err">Tài khoản <b>${esc(user.email)}</b> không có quyền admin.</div>
         <button class="gbtn" id="logoutBtn">Đăng xuất & thử tài khoản khác</button>`
      : `<form id="pwForm" style="text-align:left">
          <label class="fld"><span>Email admin</span><input name="email" type="email" value="${esc(adminEmail)}" required></label>
          <label class="fld"><span>Mật khẩu</span><input name="password" type="password" placeholder="••••••••" required></label>
          <button class="btn btn-dark btn-block" type="submit" id="pwBtn">Đăng nhập</button>
        </form>
        ${DB.cloud?`<div class="or-sep">hoặc</div><button class="gbtn" id="loginBtn">${gsvg} Đăng nhập bằng Google</button>`:``}`}
    <div class="login-note">${DB.cloud
      ? "Tạo tài khoản admin trong Supabase → Authentication → Users (nhớ bật Auto Confirm). Chỉ email trong danh sách admin mới vào được."
      : "Đang ở <b>chế độ demo</b>. Nhập email admin ("+esc(adminEmail)+") với mật khẩu bất kỳ để vào thử."}</div>
  </div></div>`;
  const pf=$("#pwForm");
  if(pf) pf.onsubmit=async(e)=>{
    e.preventDefault(); const b=$("#pwBtn"); b.disabled=true; b.textContent="Đang đăng nhập…";
    try{ await DB.signInPassword(pf.email.value, pf.password.value); boot(); }
    catch(err){ b.disabled=false; b.textContent="Đăng nhập"; toast("Đăng nhập thất bại: "+(err.message||err)); }
  };
  const lb=$("#loginBtn"); if(lb) lb.onclick=async()=>{ try{ await DB.signInGoogle({asAdmin:true}); if(!DB.cloud) boot(); }catch(e){ toast("Lỗi Google: "+(e.message||e)); } };
  const ob=$("#logoutBtn"); if(ob) ob.onclick=async()=>{ await DB.signOut(); boot(); };
}

function renderShell(){
  const modeBadge = DB.cloud
    ? `<span class="badge-mode badge-cloud">Cloud</span>`
    : `<span class="badge-mode badge-demo">Demo</span>`;
  document.body.innerHTML = `
  <div class="admin-top"><div class="row">
    <a class="logo" href="../index.html">${S.BRAND.name}<span class="dot">.</span></a>
    <span style="font-size:13px;color:#cfcfcf">Admin</span> ${modeBadge}
    <div class="spacer"></div>
    <span class="who">${esc(A.user.email||"")}</span>
    <button class="logout" id="logoutBtn">Đăng xuất</button>
  </div></div>
  <div class="admin-tabs"><div class="row">
    <button data-tab="orders">Đơn hàng</button>
    <button data-tab="products">Sản phẩm</button>
  </div></div>
  <div class="admin-wrap" id="adminContent"></div>`;
  $("#logoutBtn").onclick=async()=>{ await DB.signOut(); if(!DB.cloud) boot(); };
  $$(".admin-tabs button").forEach(b=> b.onclick=()=>switchTab(b.dataset.tab));
}
function switchTab(tab){
  A.tab=tab;
  $$(".admin-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="orders") renderOrders(); else renderProducts();
}

/* ---------------- ĐƠN HÀNG ---------------- */
let _orders=[];
async function renderOrders(filter=""){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải đơn hàng…</div>`;
  _orders = await DB.listOrders({});
  const list = filter? _orders.filter(o=>o.status===filter) : _orders;
  const revenue = _orders.filter(o=>o.status==="completed").reduce((s,o)=>s+(o.total||0),0);
  const pending = _orders.filter(o=>o.status==="pending").length;

  c.innerHTML=`
  <div class="admin-head"><h1>Đơn hàng</h1>
    <div class="admin-actions">
      <select class="statusSelect" id="ofilter">
        <option value="">Tất cả trạng thái</option>
        ${Object.keys(STATUS).map(k=>`<option value="${k}" ${filter===k?"selected":""}>${STATUS[k]}</option>`).join("")}
      </select>
      <button class="mini" id="refreshO">↻ Tải lại</button>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="k">Tổng đơn</div><div class="v">${_orders.length}</div></div>
    <div class="stat"><div class="k">Chờ xác nhận</div><div class="v sale">${pending}</div></div>
    <div class="stat"><div class="k">Hoàn thành</div><div class="v green">${_orders.filter(o=>o.status==="completed").length}</div></div>
    <div class="stat"><div class="k">Doanh thu (đã hoàn thành)</div><div class="v">${money(revenue)}</div></div>
  </div>
  ${list.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>SĐT</th><th>SP</th><th>Tổng</th><th>Trạng thái</th><th>Ngày</th><th></th></tr></thead>
    <tbody>${list.map(o=>`<tr>
      <td><b>${esc(o.code)}</b></td>
      <td>${esc(o.customer_name||"")}</td>
      <td>${esc(o.phone||"")}</td>
      <td>${(o.items||[]).reduce((s,i)=>s+i.qty,0)}</td>
      <td><b>${money(o.total||0)}</b></td>
      <td><select class="statusSelect ostatus" data-id="${esc(o.id||o.code)}" style="border-color:${STATUS_COLOR[o.status]||'#ccc'}">
        ${Object.keys(STATUS).map(k=>`<option value="${k}" ${o.status===k?"selected":""}>${STATUS[k]}</option>`).join("")}
      </select></td>
      <td>${new Date(o.created_at).toLocaleDateString("vi-VN")}</td>
      <td><button class="mini odetail" data-code="${esc(o.code)}">Xem</button></td>
    </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có đơn hàng nào.</div>`}`;

  $("#ofilter").onchange=e=>renderOrders(e.target.value);
  $("#refreshO").onclick=()=>renderOrders(filter);
  $$(".ostatus").forEach(sel=> sel.onchange=async()=>{
    try{ await DB.updateOrderStatus(sel.dataset.id, sel.value); sel.style.borderColor=STATUS_COLOR[sel.value]; toast("Đã cập nhật trạng thái"); }
    catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
  $$(".odetail").forEach(b=> b.onclick=()=>{ const o=_orders.find(x=>x.code===b.dataset.code); if(o) orderModal(o); });
}

function orderModal(o){
  const items=(o.items||[]).map(it=>`<div class="cart-item" style="grid-template-columns:1fr auto">
    <div><h4 style="font-size:14px">${esc(it.name)}</h4>
      <div class="ci-meta">Màu <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${it.color};border:1px solid #ccc;vertical-align:middle"></span> · Size ${esc(it.size)} · SL ${it.qty}</div></div>
    <div style="text-align:right;font-weight:700">${money(it.price*it.qty)}</div></div>`).join("");
  openModal(`<h3 class="modal-title">Đơn ${esc(o.code)}</h3>
    <p style="font-size:14px;line-height:1.8;margin-bottom:14px">
      <b>${esc(o.customer_name||"")}</b> · ${esc(o.phone||"")}<br>${esc(o.address||"")}
      ${o.note?`<br><span class="muted">Ghi chú: ${esc(o.note)}</span>`:""}</p>
    ${items}
    <div class="ck-summary" style="margin-top:14px">
      <div class="line"><span>Tạm tính</span><span>${money(o.subtotal||0)}</span></div>
      <div class="line"><span>Giao hàng</span><span>${o.shipping?money(o.shipping):"Miễn phí"}</span></div>
      <div class="total"><span>Tổng</span><span>${money(o.total||0)}</span></div>
    </div>`);
}

/* ---------------- SẢN PHẨM ---------------- */
let _products=[];
async function renderProducts(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải sản phẩm…</div>`;
  _products = await DB.listProducts({adminAll:true});
  c.innerHTML=`
  <div class="admin-head"><h1>Sản phẩm (${_products.length})</h1>
    <div class="admin-actions">
      ${_products.length?"":`<button class="mini" id="seedBtn">⬇ Nhập dữ liệu mẫu</button>`}
      <button class="btn btn-dark" id="addBtn" style="padding:10px 18px">+ Thêm sản phẩm</button>
    </div>
  </div>
  ${_products.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Tồn</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_products.map(p=>`<tr>
      <td><div class="pthumb">${thumb(p)}</div></td>
      <td><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc(p.collection||"")}</div></td>
      <td>${esc(p.catName||p.catKey)}</td>
      <td><b>${money(p.price)}</b>${p.compare>p.price?`<div class="muted" style="font-size:11.5px;text-decoration:line-through">${money(p.compare)}</div>`:""}</td>
      <td style="${p.stock<=0?'color:var(--sale);font-weight:700':''}">${p.stock}</td>
      <td><span class="pill ${p.active!==false?'tag-on':'tag-off'}">${p.active!==false?"Hiện":"Ẩn"}</span></td>
      <td style="white-space:nowrap">
        <button class="mini pedit" data-id="${esc(p.id)}">Sửa</button>
        <button class="mini danger pdel" data-id="${esc(p.id)}">Xoá</button>
      </td>
    </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có sản phẩm.<br><br>Bấm <b>Nhập dữ liệu mẫu</b> để có sẵn 30 sản phẩm demo, hoặc <b>Thêm sản phẩm</b>.</div>`}`;

  const sb=$("#seedBtn"); if(sb) sb.onclick=async()=>{ sb.disabled=true; sb.textContent="Đang nhập…"; try{ const n=await DB.seedDemo(); toast("Đã nhập "+n+" sản phẩm"); renderProducts(); }catch(e){ toast("Lỗi: "+(e.message||e)); sb.disabled=false; sb.textContent="⬇ Nhập dữ liệu mẫu"; } };
  $("#addBtn").onclick=()=>productModal(null);
  $$(".pedit").forEach(b=> b.onclick=()=>productModal(_products.find(p=>p.id===b.dataset.id)));
  $$(".pdel").forEach(b=> b.onclick=async()=>{
    const p=_products.find(x=>x.id===b.dataset.id);
    if(!confirm("Xoá sản phẩm \""+(p?.name||"")+"\"?")) return;
    try{ await DB.deleteProduct(b.dataset.id); toast("Đã xoá"); renderProducts(); }catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
}

function productModal(p){
  const editing=!!p;
  p = p || {name:"",print:"",catKey:"ao-thun",collection:"",price:0,compare:0,stock:50,colors:["#1c1c1c","#f0ede6"],sizes:["S","M","L","XL"],images:[],image_url:null,active:true};
  // images = array URL. Back-compat: nếu chỉ có image_url cũ → đưa vào array.
  let images = (Array.isArray(p.images) && p.images.length ? p.images.slice()
                : (p.image_url ? [p.image_url] : []));
  let colors = (p.colors&&p.colors.length?p.colors:["#1c1c1c"]).slice();

  const catOpts = S.CATEGORIES.map(c=>`<option value="${c.key}" ${p.catKey===c.key?"selected":""}>${c.name}</option>`).join("");
  const colList = S.COLLECTIONS.map(c=>`<option value="${esc(c)}">`).join("");
  const sizeBoxes = SIZES_ALL.map(s=>`<label><input type="checkbox" value="${s}" ${(p.sizes||[]).includes(s)?"checked":""}> ${s}</label>`).join("");

  openModal(`<h3 class="modal-title">${editing?"Sửa":"Thêm"} sản phẩm</h3>
    <form id="pform">
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Tên sản phẩm *</span><input name="name" value="${esc(p.name)}" required></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Chữ in / slogan (ảnh tự sinh)</span><input name="print" value="${esc(p.print||"")}" placeholder="VD: POUR OVER"></label>
        <label class="fld"><span>Danh mục *</span><select name="catKey">${catOpts}</select></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Bộ sưu tập</span><input name="collection" list="cols" value="${esc(p.collection||"")}"><datalist id="cols">${colList}</datalist></label>
        <label class="fld"><span>Tồn kho</span><input name="stock" type="number" min="0" value="${p.stock||0}"></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Giá bán (₫) *</span><input name="price" type="number" min="0" value="${p.price||0}" required></label>
        <label class="fld"><span>Giá gốc (₫)</span><input name="compare" type="number" min="0" value="${p.compare||0}"></label>
      </div>
      <div class="fld"><span>Màu sắc</span><div class="colorchips" id="chips"></div>
        <button type="button" class="mini" id="addColor" style="margin-top:8px">+ Thêm màu</button></div>
      <div class="fld"><span>Kích cỡ</span><div class="sizebox" id="sizes">${sizeBoxes}</div></div>
      <div class="fld"><span>Ảnh sản phẩm <small style="font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0;font-size:11px;margin-left:6px">ảnh đầu = ảnh chính, kéo ◀ ▶ để đổi thứ tự</small></span>
        <div class="img-gallery" id="gallery"></div>
        <label class="img-drop" id="drop">＋ Bấm để thêm ảnh (có thể chọn nhiều)<input type="file" id="imgfile" accept="image/*" multiple hidden></label>
      </div>
      <label class="fld" style="display:flex;align-items:center;gap:8px;flex-direction:row">
        <input type="checkbox" name="active" ${p.active!==false?"checked":""} style="width:18px;height:18px"> <span style="margin:0">Hiển thị trên cửa hàng</span></label>
      <button class="btn btn-dark btn-block" type="submit" id="psave">${editing?"Lưu thay đổi":"Thêm sản phẩm"}</button>
    </form>`,"wide");

  function drawChips(){
    $("#chips").innerHTML = colors.map((c,i)=>`<span class="chipc"><input type="color" value="${c}" data-i="${i}"><button type="button" data-del="${i}" style="color:#b00">×</button></span>`).join("");
    $$("#chips input[type=color]").forEach(inp=> inp.oninput=()=>{ colors[+inp.dataset.i]=inp.value; drawPrev(); });
    $$("#chips [data-del]").forEach(b=> b.onclick=()=>{ if(colors.length>1){ colors.splice(+b.dataset.del,1); drawChips(); drawPrev(); } });
  }
  function drawGallery(){
    const g = $("#gallery");
    if(!images.length){
      const cat=S.CATEGORIES.find(c=>c.key===$("[name=catKey]")?.value)||{type:"tee"};
      const fake={type:cat.type,print:($("[name=print]")?.value)||($("[name=name]")?.value)||"PRINT",collection:($("[name=collection]")?.value)||"",colors:colors,name:"preview"};
      g.innerHTML=`<div class="img-empty">${S.productSVG(fake,{seed:0})}<span>Chưa có ảnh — sẽ dùng ảnh tự sinh từ chữ in & màu</span></div>`;
      return;
    }
    g.innerHTML = images.map((url,i)=>`
      <div class="img-tile ${i===0?'is-main':''}" data-i="${i}">
        <img src="${esc(url)}" alt="">
        ${i===0?`<span class="img-badge">Ảnh chính</span>`:``}
        <div class="img-tools">
          <button type="button" class="img-btn" data-act="left"  data-i="${i}" title="Sang trái"  ${i===0?'disabled':''}>◀</button>
          <button type="button" class="img-btn" data-act="right" data-i="${i}" title="Sang phải" ${i===images.length-1?'disabled':''}>▶</button>
          <button type="button" class="img-btn danger" data-act="del" data-i="${i}" title="Xoá">×</button>
        </div>
      </div>`).join("");
    $$(".img-btn", g).forEach(b=> b.onclick=()=>{
      const i = +b.dataset.i, act = b.dataset.act;
      if(act==="del") images.splice(i,1);
      if(act==="left" && i>0){ const t=images[i-1]; images[i-1]=images[i]; images[i]=t; }
      if(act==="right" && i<images.length-1){ const t=images[i+1]; images[i+1]=images[i]; images[i]=t; }
      drawGallery();
    });
  }
  drawChips(); drawGallery();
  $("#addColor").onclick=()=>{ colors.push("#888888"); drawChips(); };
  $("[name=catKey]").onchange=drawGallery; $("[name=print]").oninput=drawGallery; $("[name=name]").oninput=()=>{ if(!images.length) drawGallery(); };
  // <label for="imgfile"> đã tự trigger input — KHÔNG gắn onclick thủ công kẻo double-trigger
  $("#imgfile").onchange=async(e)=>{
    const files = Array.from(e.target.files||[]); if(!files.length) return;
    const drop=$("#drop"); const original=drop.textContent;
    let done=0;
    drop.textContent=`Đang tải ảnh… 0/${files.length}`;
    for(const f of files){
      try{
        const url = await DB.uploadImage(f);
        images.push(url); done++;
        drop.textContent=`Đang tải ảnh… ${done}/${files.length}`;
        drawGallery();
      }catch(err){ toast("Lỗi tải ảnh "+f.name+": "+(err.message||err)); }
    }
    drop.textContent="＋ Bấm để thêm ảnh nữa";
    e.target.value=""; // cho phép chọn lại cùng file nếu cần
  };

  $("#pform").onsubmit=async(e)=>{
    e.preventDefault(); const f=e.target;
    const sizes=$$("#sizes input:checked").map(x=>x.value);
    const prod={
      ...(editing?{id:p.id}:{}),
      name:f.name.value.trim(), print:f.print.value.trim(),
      catKey:f.catKey.value, collection:f.collection.value.trim(),
      price:+f.price.value||0, compare:+f.compare.value||0, stock:+f.stock.value||0,
      colors, sizes:sizes.length?sizes:["Freesize"],
      images, image_url:images[0]||null, active:f.active.checked,
    };
    if(!prod.name){ toast("Nhập tên sản phẩm"); return; }
    const btn=$("#psave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{ await DB.upsertProduct(prod); toast("Đã lưu sản phẩm"); closeModal(); renderProducts(); }
    catch(err){ console.error(err); toast("Lỗi: "+(err.message||err)); btn.disabled=false; btn.textContent=editing?"Lưu thay đổi":"Thêm sản phẩm"; }
  };
}

/* ---------------- MODAL CHUNG ---------------- */
function openModal(html, cls=""){
  closeModal();
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="adminModal";
  ov.innerHTML=`<div class="modal ${cls}"><button class="modal-close" id="mClose">×</button>${html}</div>`;
  document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add("show"));
  $("#mClose").onclick=closeModal; ov.addEventListener("click",e=>{ if(e.target===ov) closeModal(); });
}
function closeModal(){ const m=$("#adminModal"); if(m){ m.classList.remove("show"); setTimeout(()=>m.remove(),180); } }

/* ---------------- START ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if(DB.cloud) DB.onAuth(()=>boot()); else boot();
});
