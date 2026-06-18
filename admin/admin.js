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
const CAT_TYPES = [["tee","Áo thun"],["tank","Ba lỗ / Tank"],["ringer","Ringer"],["polo","Polo"],["long","Dài tay"],["hoodie","Hoodie"],["sweater","Sweater"],["pants","Quần"],["tote","Túi tote"]];

const A = { user:null, tab:"orders" };

/* Nạp danh mục từ DB vào S.CATEGORIES để form/khắp nơi dùng */
async function loadCats(){
  try{ const rows=await DB.listCategoriesAll(); if(rows&&rows.length) S.CATEGORIES.splice(0,S.CATEGORIES.length,...rows); }
  catch(e){ console.warn("loadCats",e); }
}

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
  await loadCats();
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
    <button data-tab="categories">Danh mục</button>
  </div></div>
  <div class="admin-wrap" id="adminContent"></div>`;
  $("#logoutBtn").onclick=async()=>{ await DB.signOut(); if(!DB.cloud) boot(); };
  $$(".admin-tabs button").forEach(b=> b.onclick=()=>switchTab(b.dataset.tab));
}
function switchTab(tab){
  A.tab=tab;
  $$(".admin-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="orders") renderOrders(); else if(tab==="categories") renderCategories(); else renderProducts();
}

/* ---------------- DANH MỤC ---------------- */
let _cats=[];
async function renderCategories(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải danh mục…</div>`;
  _cats = await DB.listCategoriesAll();
  if(!_products.length){ try{ _products = await DB.listProducts({adminAll:true}); }catch(e){} }
  const typeName = (t)=>(CAT_TYPES.find(x=>x[0]===t)||[t,t])[1];
  c.innerHTML=`
  <div class="admin-head"><h1>Danh mục (${_cats.length})</h1>
    <div class="admin-actions"><button class="btn btn-dark" id="addCat" style="padding:10px 18px">+ Thêm danh mục</button></div>
  </div>
  <p class="muted" style="margin:-8px 0 18px;font-size:13.5px">Danh mục dùng để phân loại sản phẩm, hiển thị ở bộ lọc cửa hàng và form thêm sản phẩm. <b>Type</b> quyết định kiểu ảnh tự sinh (áo thun / hoodie / túi…).</p>
  ${_cats.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Thứ tự</th><th>Tên danh mục</th><th>Mã (key)</th><th>Type</th><th>SP</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_cats.map(ct=>{
      const count=_products.filter(p=>p.catKey===ct.key).length;
      return `<tr>
      <td style="font-variant-numeric:tabular-nums">${ct.sort||0}</td>
      <td><b>${esc(ct.name)}</b></td>
      <td><code style="font-size:12px;color:var(--muted)">${esc(ct.key)}</code></td>
      <td>${esc(typeName(ct.type))}</td>
      <td>${count}</td>
      <td><span class="pill ${ct.active!==false?'tag-on':'tag-off'}">${ct.active!==false?"Hiện":"Ẩn"}</span></td>
      <td style="white-space:nowrap">
        <button class="mini cedit" data-key="${esc(ct.key)}">Sửa</button>
        <button class="mini danger cdel" data-key="${esc(ct.key)}">Xoá</button>
      </td></tr>`;}).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có danh mục.</div>`}`;
  $("#addCat").onclick=()=>categoryModal(null);
  $$(".cedit").forEach(b=> b.onclick=()=>categoryModal(_cats.find(x=>x.key===b.dataset.key)));
  $$(".cdel").forEach(b=> b.onclick=async()=>{
    const ct=_cats.find(x=>x.key===b.dataset.key);
    const used=(_products||[]).filter(p=>p.catKey===b.dataset.key).length;
    if(used){ if(!confirm(`Danh mục "${ct?.name}" đang có ${used} sản phẩm. Vẫn xoá? (sản phẩm sẽ mất danh mục)`)) return; }
    else if(!confirm(`Xoá danh mục "${ct?.name}"?`)) return;
    try{ await DB.deleteCategory(b.dataset.key); await loadCats(); toast("Đã xoá danh mục"); renderCategories(); }
    catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
}

function categoryModal(ct){
  const editing=!!ct;
  ct = ct || {key:"",name:"",type:"tee",sort:(_cats.length),active:true};
  const typeOpts = CAT_TYPES.map(([v,l])=>`<option value="${v}" ${ct.type===v?"selected":""}>${l}</option>`).join("");
  openModal(`<h3 class="modal-title">${editing?"Sửa":"Thêm"} danh mục</h3>
    <form id="cform">
      <label class="fld"><span>Tên danh mục *</span><input name="name" value="${esc(ct.name)}" required placeholder="VD: Áo Khoác"></label>
      <div class="frow">
        <label class="fld"><span>Mã key ${editing?'(không đổi)':'(tự tạo)'}</span><input name="key" value="${esc(ct.key)}" ${editing?'readonly style="background:var(--bg-soft)"':'placeholder="ao-khoac"'}></label>
        <label class="fld"><span>Kiểu ảnh (type)</span><select name="type">${typeOpts}</select></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Thứ tự hiển thị</span><input name="sort" type="number" value="${ct.sort||0}"></label>
        <label class="fld" style="display:flex;align-items:center;gap:8px;flex-direction:row;align-self:end;padding-bottom:10px">
          <input type="checkbox" name="active" ${ct.active!==false?"checked":""} style="width:18px;height:18px"> <span style="margin:0">Hiển thị</span></label>
      </div>
      <button class="btn btn-dark btn-block" type="submit" id="csave">${editing?"Lưu":"Thêm danh mục"}</button>
    </form>`);
  const nameInp=$("[name=name]"), keyInp=$("[name=key]");
  if(!editing) nameInp.oninput=()=>{ keyInp.value = S.slugify(nameInp.value); };
  $("#cform").onsubmit=async(e)=>{
    e.preventDefault(); const f=e.target;
    const name=f.name.value.trim(); let key=(f.key.value.trim()||slugify(name));
    if(!name||!key){ toast("Nhập tên danh mục"); return; }
    if(!editing && _cats.some(c=>c.key===key)){ toast("Mã key đã tồn tại, đổi tên khác"); return; }
    const btn=$("#csave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{
      await DB.upsertCategory({key, name, type:f.type.value, sort:+f.sort.value||0, active:f.active.checked});
      await loadCats(); toast("Đã lưu danh mục"); closeModal(); renderCategories();
    }catch(err){ console.error(err); toast("Lỗi: "+(err.message||err)); btn.disabled=false; btn.textContent=editing?"Lưu":"Thêm danh mục"; }
  };
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
      <b>${esc(o.customer_name||"")}</b> · ${esc(o.phone||"")}${o.email?` · <a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`:""}<br>${esc(o.address||"")}
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
    <thead><tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Tồn</th><th>Đã bán</th><th>♥</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_products.map(p=>`<tr>
      <td><div class="pthumb">${thumb(p)}</div></td>
      <td><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc(p.collection||"")}</div></td>
      <td>${esc(p.catName||p.catKey)}</td>
      <td><b>${money(p.price)}</b>${p.compare>p.price?`<div class="muted" style="font-size:11.5px;text-decoration:line-through">${money(p.compare)}</div>`:""}</td>
      <td style="${p.stock<=0?'color:var(--sale);font-weight:700':''}">${p.stock}</td>
      <td style="font-variant-numeric:tabular-nums">${p.sold||0}</td>
      <td style="font-variant-numeric:tabular-nums">${p.likes||0}</td>
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
  p = p || {name:"",print:"",catKey:(S.CATEGORIES[0]&&S.CATEGORIES[0].key)||"ao-thun",collection:"",price:0,compare:0,stock:50,sold:0,likes:0,colors:["#1c1c1c","#f0ede6"],sizes:["S","M","L","XL"],images:[],color_images:{},image_url:null,active:true};

  // variants = [{color, imgs:[url,...]}] — ảnh gắn theo từng màu
  const ci = p.color_images||{};
  let variants = (p.colors&&p.colors.length?p.colors:["#1c1c1c"]).map(c=>({color:c, imgs:(ci[c]||[]).slice()}));
  if(!Object.keys(ci).length && Array.isArray(p.images) && p.images.length){ variants[0].imgs = p.images.slice(); }

  const catOpts = S.CATEGORIES.map(c=>`<option value="${c.key}" ${p.catKey===c.key?"selected":""}>${esc(c.name)}</option>`).join("");
  const colList = S.COLLECTIONS.map(c=>`<option value="${esc(c)}">`).join("");
  const sizeBoxes = SIZES_ALL.map(s=>`<label><input type="checkbox" value="${s}" ${(p.sizes||[]).includes(s)?"checked":""}> ${s}</label>`).join("");

  openModal(`<h3 class="modal-title">${editing?"Sửa":"Thêm"} sản phẩm</h3>
    <form id="pform">
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Tên sản phẩm *</span><input name="name" value="${esc(p.name)}" required></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Chữ in / slogan (ảnh tự sinh khi thiếu ảnh)</span><input name="print" value="${esc(p.print||"")}" placeholder="VD: POUR OVER"></label>
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
      <div class="frow">
        <label class="fld"><span>Đã bán (số ảo)</span><input name="sold" type="number" min="0" value="${p.sold||0}" placeholder="VD: 250"></label>
        <label class="fld"><span>Yêu thích (số ảo)</span><input name="likes" type="number" min="0" value="${p.likes||0}" placeholder="VD: 42"></label>
      </div>
      <div class="fld"><span>Màu sắc & ảnh theo màu
        <small style="font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0;font-size:11px;margin-left:6px">mỗi màu up ảnh áo của màu đó (nhiều ảnh được). Khi thêm mới: mỗi màu ≥1 ảnh, tổng ≥3 ảnh.</small></span>
        <div id="variants"></div>
        <button type="button" class="mini" id="addColor" style="margin-top:10px">+ Thêm màu</button>
      </div>
      <div class="fld"><span>Kích cỡ</span><div class="sizebox" id="sizes">${sizeBoxes}</div></div>
      <label class="fld" style="display:flex;align-items:center;gap:8px;flex-direction:row">
        <input type="checkbox" name="active" ${p.active!==false?"checked":""} style="width:18px;height:18px"> <span style="margin:0">Hiển thị trên cửa hàng</span></label>
      <button class="btn btn-dark btn-block" type="submit" id="psave">${editing?"Lưu thay đổi":"Thêm sản phẩm"}</button>
    </form>`,"wide");

  function drawVariants(){
    const root=$("#variants");
    root.innerHTML = variants.map((v,vi)=>`
      <div class="variant">
        <div class="variant-head">
          <input type="color" class="vcolor" value="${v.color}" data-vi="${vi}" title="Đổi màu">
          <code class="muted" style="font-size:12px">${esc(v.color)}</code>
          <span class="muted" style="font-size:12px">· ${v.imgs.length} ảnh</span>
          <span style="flex:1"></span>
          <button type="button" class="mini danger vdel" data-vi="${vi}" ${variants.length<=1?'disabled':''}>Xoá màu</button>
        </div>
        <div class="img-gallery">
          ${v.imgs.map((url,ii)=>`
            <div class="img-tile ${ii===0?'is-main':''}">
              <img src="${esc(url)}" alt="">
              ${ii===0?`<span class="img-badge">Chính</span>`:``}
              <div class="img-tools">
                <button type="button" class="img-btn" data-vi="${vi}" data-ii="${ii}" data-act="left"  ${ii===0?'disabled':''}>◀</button>
                <button type="button" class="img-btn" data-vi="${vi}" data-ii="${ii}" data-act="right" ${ii===v.imgs.length-1?'disabled':''}>▶</button>
                <button type="button" class="img-btn danger" data-vi="${vi}" data-ii="${ii}" data-act="del">×</button>
              </div>
            </div>`).join("")}
          <label class="img-drop vdrop"><span>＋ Thêm ảnh</span><input type="file" class="vfile" data-vi="${vi}" accept="image/*" multiple hidden></label>
        </div>
      </div>`).join("");

    $$(".vcolor",root).forEach(inp=> inp.oninput=()=>{ variants[+inp.dataset.vi].color=inp.value; drawVariants(); });
    $$(".vdel",root).forEach(b=> b.onclick=()=>{ if(variants.length>1){ variants.splice(+b.dataset.vi,1); drawVariants(); } });
    $$(".img-btn",root).forEach(b=> b.onclick=()=>{
      const vi=+b.dataset.vi, ii=+b.dataset.ii, act=b.dataset.act, imgs=variants[vi].imgs;
      if(act==="del") imgs.splice(ii,1);
      if(act==="left"  && ii>0){ const t=imgs[ii-1]; imgs[ii-1]=imgs[ii]; imgs[ii]=t; }
      if(act==="right" && ii<imgs.length-1){ const t=imgs[ii+1]; imgs[ii+1]=imgs[ii]; imgs[ii]=t; }
      drawVariants();
    });
    $$(".vfile",root).forEach(inp=> inp.onchange=async(e)=>{
      const vi=+inp.dataset.vi; const files=Array.from(e.target.files||[]); if(!files.length) return;
      toast("Đang tải "+files.length+" ảnh…");
      for(const fl of files){ try{ const url=await DB.uploadImage(fl); variants[vi].imgs.push(url); }catch(err){ toast("Lỗi ảnh "+fl.name+": "+(err.message||err)); } }
      drawVariants();
    });
  }
  drawVariants();
  $("#addColor").onclick=()=>{ variants.push({color:"#888888",imgs:[]}); drawVariants(); };

  $("#pform").onsubmit=async(e)=>{
    e.preventDefault(); const f=e.target;
    if(!f.name.value.trim()){ toast("Nhập tên sản phẩm"); return; }
    const sizes=$$("#sizes input:checked").map(x=>x.value);
    const colors = variants.map(v=>v.color);
    const color_images = {}; variants.forEach(v=>{ if(v.imgs.length) color_images[v.color]=v.imgs.slice(); });
    const images = variants.flatMap(v=>v.imgs);
    if(!editing){
      if(variants.some(v=>!v.imgs.length)){ toast("Mỗi màu cần ít nhất 1 ảnh của màu đó"); return; }
      if(images.length<3){ toast("Cần tối thiểu 3 ảnh khi thêm sản phẩm mới"); return; }
    }
    const prod={
      ...(editing?{id:p.id}:{}),
      name:f.name.value.trim(), print:f.print.value.trim(),
      catKey:f.catKey.value, collection:f.collection.value.trim(),
      price:+f.price.value||0, compare:+f.compare.value||0, stock:+f.stock.value||0,
      sold:+f.sold.value||0, likes:+f.likes.value||0,
      colors, sizes:sizes.length?sizes:["Freesize"],
      images, color_images, image_url:images[0]||null, active:f.active.checked,
    };
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
