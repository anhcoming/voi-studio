/* =========================================================
   ORIGINALS ADMIN — quản lý đơn hàng & sản phẩm
   ========================================================= */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const S = window.STORE;
const money = S.formatVND;
const esc = (s)=>(s||"").toString().replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// safeColor() được khai báo global trong data.js — không redeclare ở đây.

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
async function loadColors(){
  try{ const rows=await DB.listColorsAll(); if(rows&&rows.length) S.COLORS.splice(0,S.COLORS.length,...rows); }
  catch(e){ console.warn("loadColors",e); }
}

function thumb(p){
  if(p.image_url) return `<img src="${esc(p.image_url)}" alt="">`;
  return S.productSVG(p,{seed:0});
}
function toast(msg, type){
  const text = (msg==null ? "" : String(msg));
  if(!type){
    if(/(^|\s)lỗi\b|^err|fail|không\s+(tìm\s+được|đủ|hợp\s+lệ|tồn\s+tại)/i.test(text)) type = "error";
    else if(/^(đã |cảm ơn|áp dụng|thành công|đăng (nhập|xuất))/i.test(text)) type = "success";
    else if(/^(chỉ còn|hãy |vui lòng|cần |thiếu|hết hàng|sắp hết)/i.test(text)) type = "warn";
    else type = "info";
  }
  const icons = { success:"✓", error:"✕", warn:"!", info:"i" };
  let t=$(".toast"); if(!t){t=document.createElement("div");document.body.appendChild(t);}
  t.className = "toast t-" + type;
  t.innerHTML = `<span class="t-icon" aria-hidden="true"></span><span class="t-msg"></span>`;
  t.querySelector(".t-icon").textContent = icons[type] || "•";
  t.querySelector(".t-msg").textContent  = text;
  requestAnimationFrame(()=>t.classList.add("show"));
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ---------------- BOOT / AUTH ---------------- */
async function boot(){
  A.user = await DB.getUser();
  // Check quyền admin qua RPC am_i_admin (server-side, không lộ danh sách email)
  const allowed = DB.isAdminAsync ? await DB.isAdminAsync(A.user) : DB.isAdmin(A.user);
  if(!A.user || !allowed){ renderLogin(A.user); return; }
  await Promise.all([loadCats(), loadColors()]);
  renderShell();
  switchTab(A.tab);
}

function renderLogin(user){
  const denied = user && !DB.isAdmin(user);
  const gsvg = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/><path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.3-8.5 2.3-6.6 0-12.2-4.5-14.2-10.5l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>`;
  document.body.innerHTML = `<div class="login-screen"><div class="login-card">
    <div class="logo">${S.BRAND.name}<span class="dot">.</span></div>
    <p>Trang quản trị cửa hàng</p>
    ${denied
      ? `<div class="notice err">Tài khoản <b>${esc(user.email)}</b> không có quyền admin.</div>
         <button class="gbtn" id="logoutBtn">Đăng xuất & thử tài khoản khác</button>`
      : DB.cloud
        ? `<button class="gbtn" id="loginBtn">${gsvg} Đăng nhập bằng Google</button>`
        : `<button class="gbtn" id="loginBtn">${gsvg} Đăng nhập demo</button>`}
    <div class="login-note">${DB.cloud
      ? "Chỉ email trong danh sách admin mới vào được. Liên hệ chủ shop để được cấp quyền."
      : "Đang ở <b>chế độ demo</b> — bấm để giả lập tài khoản admin."}</div>
  </div></div>`;
  const lb=$("#loginBtn"); if(lb) lb.onclick=async()=>{
    if(lb.disabled) return;
    lb.disabled=true; const prevText=lb.textContent; lb.textContent="Đang mở Google…";
    try{ await DB.signInGoogle({asAdmin:true}); if(!DB.cloud) boot(); }
    catch(e){ toast("Lỗi Google: "+(e.message||e)); lb.disabled=false; lb.textContent=prevText; }
  };
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
    <button data-tab="colors">Màu sắc</button>
    <button data-tab="vouchers">Voucher</button>
    <button data-tab="home">Trang chủ</button>
  </div></div>
  <div class="admin-wrap" id="adminContent"></div>`;
  $("#logoutBtn").onclick=async()=>{
    const ok = await confirmDialog({
      title:"Đăng xuất?",
      body:`Bạn sẽ thoát khỏi tài khoản <b>${esc(A.user.email||"")}</b> và quay về màn hình đăng nhập.`,
      confirmText:"Đăng xuất",
    });
    if(!ok) return;
    await DB.signOut();
    if(!DB.cloud) boot();
  };
  $$(".admin-tabs button").forEach(b=> b.onclick=()=>switchTab(b.dataset.tab));
}
function switchTab(tab){
  A.tab=tab;
  $$(".admin-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="orders") renderOrders();
  else if(tab==="categories") renderCategories();
  else if(tab==="colors") renderColors();
  else if(tab==="home") renderHomeSettings();
  else if(tab==="vouchers") renderVouchers();
  else renderProducts();
}

/* ---------------- DANH MỤC ---------------- */
let _cats=[];
const _catTypeName = (t)=>(CAT_TYPES.find(x=>x[0]===t)||[t,t])[1];
async function renderCategories(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải danh mục…</div>`;
  _cats = await DB.listCategoriesAll();
  if(!_products.length){ try{ _products = await DB.listProducts({adminAll:true}); }catch(e){} }
  drawCategories();
}
function categoryRowHTML(ct){
  const count=_products.filter(p=>p.catKey===ct.key).length;
  return `<tr data-ckey="${esc(ct.key)}">
    <td style="font-variant-numeric:tabular-nums">${ct.sort||0}</td>
    <td><b>${esc(ct.name)}</b></td>
    <td><code style="font-size:12px;color:var(--muted)">${esc(ct.key)}</code></td>
    <td>${esc(_catTypeName(ct.type))}</td>
    <td>${count}</td>
    <td><button type="button" class="switch ctoggle ${ct.active!==false?'on':''}" data-key="${esc(ct.key)}" aria-label="${ct.active!==false?'Đang hiện — bấm để ẩn':'Đang ẩn — bấm để hiện'}">
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span class="switch-label">${ct.active!==false?"Hiện":"Ẩn"}</span>
    </button></td>
    <td style="white-space:nowrap">
      <button class="mini cedit" data-key="${esc(ct.key)}">Sửa</button>
      <button class="mini danger cdel" data-key="${esc(ct.key)}">Xoá</button>
    </td></tr>`;
}
function drawCategories(){
  const c=$("#adminContent");
  c.innerHTML=`
  <div class="admin-head"><h1>Danh mục (${_cats.length})</h1>
    <div class="admin-actions"><button class="btn btn-dark" id="addCat" style="padding:10px 18px">+ Thêm danh mục</button></div>
  </div>
  <p class="muted" style="margin:-8px 0 18px;font-size:13.5px">Danh mục dùng để phân loại sản phẩm, hiển thị ở bộ lọc cửa hàng và form thêm sản phẩm. <b>Type</b> quyết định kiểu ảnh tự sinh (áo thun / hoodie / túi…).</p>
  ${_cats.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Thứ tự</th><th>Tên danh mục</th><th>Mã (key)</th><th>Type</th><th>SP</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_cats.map(categoryRowHTML).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có danh mục.</div>`}`;
  bindCategoryRowActions();
}
function bindCategoryRowActions(){
  $("#addCat").onclick=()=>categoryModal(null);
  $$(".cedit").forEach(b=> b.onclick=()=>categoryModal(_cats.find(x=>x.key===b.dataset.key)));
  $$(".ctoggle").forEach(sw=> sw.onclick=async()=>{
    const ct=_cats.find(x=>x.key===sw.dataset.key); if(!ct) return;
    const wasActive = ct.active!==false;
    const used = (_products||[]).filter(p=>p.catKey===ct.key).length;
    const ok = await confirmDialog({
      title: wasActive ? "Ẩn danh mục?" : "Hiện danh mục?",
      body: wasActive
        ? `Danh mục "<b>${esc(ct.name)}</b>"${used?` (đang có ${used} sản phẩm)`:""} sẽ ẩn khỏi cửa hàng. Sản phẩm thuộc danh mục này có thể không hiển thị trong bộ lọc.`
        : `Danh mục "<b>${esc(ct.name)}</b>" sẽ hiện lại trên cửa hàng.`,
      confirmText: wasActive ? "Ẩn" : "Hiện",
      danger: wasActive,
    });
    if(!ok) return;
    sw.disabled=true;
    try{
      const saved = await DB.upsertCategory({...ct, active: !wasActive});
      Object.assign(ct, saved || {}, {active: !wasActive});
      // sync vào S.CATEGORIES để chỗ khác (form thêm SP) đọc đúng
      const sc = S.CATEGORIES.find(x=>x.key===ct.key); if(sc) Object.assign(sc, {active: ct.active});
      toast(wasActive?"Đã ẩn danh mục":"Đã hiện danh mục");
      const tr = $(`tr[data-ckey="${CSS.escape(ct.key)}"]`);
      if(tr){ tr.outerHTML = categoryRowHTML(ct); bindCategoryRowActions(); }
      else drawCategories();
    }catch(e){ toast("Lỗi: "+(e.message||e)); sw.disabled=false; }
  });
  $$(".cdel").forEach(b=> b.onclick=async()=>{
    const ct=_cats.find(x=>x.key===b.dataset.key);
    const used=(_products||[]).filter(p=>p.catKey===b.dataset.key).length;
    const ok = await confirmDialog({
      title:"Xoá danh mục?",
      body: used
        ? `Danh mục "<b>${esc(ct?.name||"")}</b>" đang có <b>${used} sản phẩm</b>. Xoá sẽ làm các sản phẩm này mất danh mục.`
        : `Danh mục "<b>${esc(ct?.name||"")}</b>" sẽ bị xoá vĩnh viễn.`,
      confirmText:"Xoá", cancelText:"Huỷ", danger:true,
    });
    if(!ok) return;
    try{
      await DB.deleteCategory(b.dataset.key);
      const idx = _cats.findIndex(x=>x.key===b.dataset.key);
      if(idx>=0) _cats.splice(idx,1);
      // Đồng bộ S.CATEGORIES luôn
      const sidx = S.CATEGORIES.findIndex(x=>x.key===b.dataset.key);
      if(sidx>=0) S.CATEGORIES.splice(sidx,1);
      toast("Đã xoá danh mục"); drawCategories();
    }catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
}

function categoryModal(ct){
  const editing=!!ct;
  ct = ct || {key:"",name:"",type:"tee",sort:(_cats.length),active:true};
  const typeOpts = CAT_TYPES.map(([v,l])=>`<option value="${v}" ${ct.type===v?"selected":""}>${l}</option>`).join("");
  openModal(`<h3 class="modal-title">${editing?"Sửa":"Thêm"} danh mục</h3>
    <form id="cform" novalidate>
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
      <div class="modal-foot">
        <button class="btn btn-dark btn-block" type="submit" id="csave">${editing?"Lưu":"Thêm danh mục"}</button>
      </div>
    </form>`);
  const nameInp=$("[name=name]"), keyInp=$("[name=key]");
  if(!editing) nameInp.oninput=()=>{ keyInp.value = S.slugify(nameInp.value); };
  $("#cform").onsubmit=async(e)=>{
    e.preventDefault(); const f=e.target;
    const ok = validateFields([{el:f.name, msg:"Nhập tên danh mục"}]);
    if(!ok) return;
    const name=f.name.value.trim(); let key=(f.key.value.trim()||S.slugify(name));
    if(!editing && _cats.some(c=>c.key===key)){ setFieldError(f.name, "Tên này đã tồn tại, đổi tên khác"); return; }
    const btn=$("#csave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{
      const payload = {key, name, type:f.type.value, sort:+f.sort.value||0, active:f.active.checked};
      const saved = await DB.upsertCategory(payload);
      // Cập nhật _cats local thay vì refetch
      if(editing){
        const idx = _cats.findIndex(x=>x.key===ct.key);
        if(idx>=0) _cats[idx] = saved || {..._cats[idx], ...payload};
      } else {
        _cats.push(saved || payload);
        _cats.sort((a,b)=>(a.sort||0)-(b.sort||0));
      }
      // Đồng bộ S.CATEGORIES để form thêm SP đọc đúng
      const sc = S.CATEGORIES.find(x=>x.key===key);
      if(sc) Object.assign(sc, saved||payload); else S.CATEGORIES.push(saved||payload);
      toast("Đã lưu danh mục"); closeModal(); drawCategories();
    }catch(err){ console.error(err); toast("Lỗi: "+(err.message||err)); btn.disabled=false; btn.textContent=editing?"Lưu":"Thêm danh mục"; }
  };
}

/* ---------------- MÀU SẮC ---------------- */
let _colors=[];
async function renderColors(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải màu sắc…</div>`;
  _colors = await DB.listColorsAll();
  if(!_products.length){ try{ _products = await DB.listProducts({adminAll:true}); }catch(e){} }
  drawColors();
}
function colorRowHTML(col){
  const used = _products.reduce((n,p)=> n + (Array.isArray(p.colors)&&p.colors.some(h=>(h||"").toLowerCase()===(col.hex||"").toLowerCase()) ? 1:0), 0);
  return `<tr data-ckkey="${esc(col.key)}">
    <td style="font-variant-numeric:tabular-nums">${col.sort||0}</td>
    <td><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${safeColor(col.hex)};border:1px solid rgba(0,0,0,.12);vertical-align:middle"></span></td>
    <td><b>${esc(col.name)}</b></td>
    <td><code style="font-size:12px;color:var(--muted)">${esc(col.hex)}</code></td>
    <td><code style="font-size:12px;color:var(--muted)">${esc(col.key)}</code></td>
    <td>${used}</td>
    <td><button type="button" class="switch cktoggle ${col.active!==false?'on':''}" data-key="${esc(col.key)}" aria-label="${col.active!==false?'Đang hiện — bấm để ẩn':'Đang ẩn — bấm để hiện'}">
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span class="switch-label">${col.active!==false?"Hiện":"Ẩn"}</span>
    </button></td>
    <td style="white-space:nowrap">
      <button class="mini ckedit" data-key="${esc(col.key)}">Sửa</button>
      <button class="mini danger ckdel" data-key="${esc(col.key)}">Xoá</button>
    </td></tr>`;
}
function drawColors(){
  const c=$("#adminContent");
  c.innerHTML=`
  <div class="admin-head"><h1>Màu sắc (${_colors.length})</h1>
    <div class="admin-actions"><button class="btn btn-dark" id="addCol" style="padding:10px 18px">+ Thêm màu</button></div>
  </div>
  <p class="muted" style="margin:-8px 0 18px;font-size:13.5px">Bảng màu chuẩn dùng chung cho mọi sản phẩm. Khi tạo / sửa SP, form sẽ pick từ list này thay vì gõ hex bừa. Ẩn 1 màu sẽ giấu khỏi picker (SP đang dùng vẫn giữ).</p>
  ${_colors.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Thứ tự</th><th>Màu</th><th>Tên</th><th>Hex</th><th>Mã (key)</th><th>SP</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_colors.map(colorRowHTML).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có màu. Thêm màu đầu tiên để dùng cho sản phẩm.</div>`}`;
  bindColorRowActions();
}
function bindColorRowActions(){
  $("#addCol").onclick=()=>colorModal(null);
  $$(".ckedit").forEach(b=> b.onclick=()=>colorModal(_colors.find(x=>x.key===b.dataset.key)));
  $$(".cktoggle").forEach(sw=> sw.onclick=async()=>{
    const col=_colors.find(x=>x.key===sw.dataset.key); if(!col) return;
    const wasActive = col.active!==false;
    const ok = await confirmDialog({
      title: wasActive ? "Ẩn màu?" : "Hiện màu?",
      body: wasActive
        ? `Màu "<b>${esc(col.name)}</b>" sẽ ẩn khỏi color-picker khi thêm/sửa SP. Sản phẩm đang dùng màu này vẫn giữ nguyên.`
        : `Màu "<b>${esc(col.name)}</b>" sẽ xuất hiện lại trong picker.`,
      confirmText: wasActive ? "Ẩn" : "Hiện",
      danger: wasActive,
    });
    if(!ok) return;
    sw.disabled=true;
    try{
      const saved = await DB.upsertColor({...col, active: !wasActive});
      Object.assign(col, saved || {}, {active: !wasActive});
      const sc = S.COLORS.find(x=>x.key===col.key); if(sc) Object.assign(sc, {active: col.active});
      toast(wasActive?"Đã ẩn màu":"Đã hiện màu");
      const tr = $(`tr[data-ckkey="${CSS.escape(col.key)}"]`);
      if(tr){ tr.outerHTML = colorRowHTML(col); bindColorRowActions(); }
      else drawColors();
    }catch(e){ toast("Lỗi: "+(e.message||e)); sw.disabled=false; }
  });
  $$(".ckdel").forEach(b=> b.onclick=async()=>{
    const col=_colors.find(x=>x.key===b.dataset.key);
    const used = _products.reduce((n,p)=> n + (Array.isArray(p.colors)&&p.colors.some(h=>(h||"").toLowerCase()===(col?.hex||"").toLowerCase()) ? 1:0), 0);
    const ok = await confirmDialog({
      title:"Xoá màu?",
      body: used
        ? `Màu "<b>${esc(col?.name||"")}</b>" đang được dùng bởi <b>${used} sản phẩm</b>. Xoá khỏi bảng màu chỉ ảnh hưởng picker; SP vẫn giữ giá trị hex hiện tại.`
        : `Màu "<b>${esc(col?.name||"")}</b>" sẽ bị xoá vĩnh viễn khỏi bảng màu.`,
      confirmText:"Xoá", cancelText:"Huỷ", danger:true,
    });
    if(!ok) return;
    try{
      await DB.deleteColor(b.dataset.key);
      const idx = _colors.findIndex(x=>x.key===b.dataset.key);
      if(idx>=0) _colors.splice(idx,1);
      const sidx = S.COLORS.findIndex(x=>x.key===b.dataset.key);
      if(sidx>=0) S.COLORS.splice(sidx,1);
      toast("Đã xoá màu"); drawColors();
    }catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
}
function colorModal(col){
  const editing=!!col;
  col = col || {key:"",name:"",hex:"#888888",sort:(_colors.length+1),active:true};
  openModal(`<h3 class="modal-title">${editing?"Sửa":"Thêm"} màu</h3>
    <form id="colform" novalidate>
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Tên hiển thị *</span><input name="name" value="${esc(col.name)}" required placeholder="VD: Xanh navy"></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Mã key ${editing?'(không đổi)':'(tự tạo)'}</span><input name="key" value="${esc(col.key)}" ${editing?'readonly style="background:var(--bg-soft)"':'placeholder="xanh-navy"'}></label>
        <label class="fld"><span>Thứ tự</span><input name="sort" type="number" value="${col.sort||0}"></label>
      </div>
      <div class="fld"><span>Màu (hex) *</span>
        <div style="display:flex;align-items:center;gap:12px">
          <input type="color" name="hex" value="${safeColor(col.hex)}" style="width:56px;height:44px;border:1.5px solid var(--line);border-radius:10px;background:#fff;padding:2px;cursor:pointer">
          <input type="text" name="hexText" value="${esc(col.hex)}" placeholder="#RRGGBB" pattern="^#[0-9a-fA-F]{3,8}$" style="flex:1">
          <span id="cpvw" style="display:inline-block;width:44px;height:44px;border-radius:50%;background:${safeColor(col.hex)};border:1px solid rgba(0,0,0,.12);flex-shrink:0"></span>
        </div>
      </div>
      <label class="fld" style="display:flex;align-items:center;gap:8px;flex-direction:row">
        <input type="checkbox" name="active" ${col.active!==false?"checked":""} style="width:18px;height:18px"> <span style="margin:0">Hiển thị trong picker</span></label>
      <div class="modal-foot">
        <button class="btn btn-dark btn-block" type="submit" id="colsave">${editing?"Lưu":"Thêm màu"}</button>
      </div>
    </form>`);
  const f=$("#colform");
  const nameInp=f.name, keyInp=f.key, hexInp=f.hex, hexText=f.hexText, pv=$("#cpvw");
  const syncFromColor = ()=>{ hexText.value=hexInp.value; pv.style.background=safeColor(hexInp.value); };
  const syncFromText = ()=>{
    if(/^#[0-9a-fA-F]{6}$/.test(hexText.value)){ hexInp.value=hexText.value; pv.style.background=safeColor(hexText.value); }
  };
  hexInp.oninput=syncFromColor; hexText.oninput=syncFromText;
  if(!editing) nameInp.oninput=()=>{ keyInp.value = S.slugify(nameInp.value); };
  f.onsubmit=async(e)=>{
    e.preventDefault();
    const ok = validateFields([
      {el:nameInp, msg:"Nhập tên màu"},
      {el:hexText, msg:"Hex không hợp lệ", test:v=> /^#[0-9a-fA-F]{6}$/.test(v)},
    ]);
    if(!ok) return;
    const name=nameInp.value.trim();
    let key=(keyInp.value.trim()||S.slugify(name));
    if(!editing && _colors.some(c=>c.key===key)){ setFieldError(nameInp,"Tên này đã tồn tại, đổi tên khác"); return; }
    const btn=$("#colsave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{
      const payload={key, name, hex:hexText.value.trim(), sort:+f.sort.value||0, active:f.active.checked};
      const saved = await DB.upsertColor(payload);
      if(editing){
        const idx=_colors.findIndex(x=>x.key===col.key);
        if(idx>=0) _colors[idx]=saved || {..._colors[idx],...payload};
      } else {
        _colors.push(saved||payload);
        _colors.sort((a,b)=>(a.sort||0)-(b.sort||0));
      }
      const sc = S.COLORS.find(x=>x.key===key);
      if(sc) Object.assign(sc, saved||payload); else S.COLORS.push(saved||payload);
      toast("Đã lưu màu"); closeModal(); drawColors();
    }catch(err){ console.error(err); toast("Lỗi: "+(err.message||err)); btn.disabled=false; btn.textContent=editing?"Lưu":"Thêm màu"; }
  };
}

/* ---------------- TRANG CHỦ (custom) ---------------- */
const HOME_DEFAULTS = {
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
};
let _home = {...HOME_DEFAULTS};
async function renderHomeSettings(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải cấu hình…</div>`;
  try{
    const v = await DB.getSettings("home");
    _home = {...HOME_DEFAULTS, ...(v||{})};
    if(!_home.catTiles) _home.catTiles = [];
  }catch(e){ console.warn(e); _home = {...HOME_DEFAULTS}; }
  if(!_products.length){ try{ _products = await DB.listProducts({adminAll:true}); }catch(e){} }
  drawHomeSettings();
}
function tileBg(t, fallbackA, fallbackB){
  if(t && t.image) return `background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)),url('${esc(t.image)}') center/cover no-repeat`;
  return `background:linear-gradient(135deg,${safeColor(t&&t.from||fallbackA)},${safeColor(t&&t.to||fallbackB)})`;
}
function drawHomeSettings(){
  // Live-preview full trang chủ — hover vào vùng nào sẽ hiện nút Sửa.
  const c=$("#adminContent");
  const HG = _home;
  const heroSub = HG.heroSub || `${S.BRAND.name} — local brand streetwear cho người trẻ dám thể hiện chất riêng.`;
  const heroStyle = HG.heroImage ? `style="background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url('${esc(HG.heroImage)}') center/cover no-repeat"` : "";
  const tHeader = (HG.tickerHeader||[]).map(t=>`<span>${esc(t)}</span>`).join("");
  const tBottom = (HG.tickerBottom||[]).map(t=>`<span>${esc(t)}</span>`).join("");
  const tiles = [["ao-thun","#1d1d1d","#555"],["hoodie","#2c3a4f","#557"],["polo","#3f5c46","#697"],["tote","#b5523a","#d8a441"]];
  const stripText = HG.stripText || (S.BRAND?.tagline || "BE BOLD. BE NEW.").toUpperCase();
  const perks = HG.perks && HG.perks.length ? HG.perks : HOME_DEFAULTS.perks;
  const footerAbout = HG.footerAbout || `${S.BRAND?.tagline||""}. Thời trang local brand cho người trẻ dám khác biệt.`;

  // Placeholder cards trắng cho product rows — không load data thật.
  const placeholderCard = (i)=>`<article class="card hp-pcard">
    <div class="thumb" style="background:#f4f1ec"></div>
    <div class="info">
      <div class="cat">COLLECTION</div>
      <div class="name">Sản phẩm mẫu #${i+1}</div>
      <div class="price"><span class="now">165.000₫</span><span class="was">318.000₫</span><span class="off">-48%</span></div>
    </div>
  </article>`;
  const placeholderRow = `<div class="scroller">
    <button class="scroll-btn prev" disabled>‹</button>
    <div class="row" style="display:flex;gap:18px;overflow:hidden">
      ${Array.from({length:5}, (_,i)=>placeholderCard(i)).join("")}
    </div>
    <button class="scroll-btn next" disabled>›</button>
  </div>`;
  // Feature blocks — admin có thể edit từng cái + reorder + xoá + thêm
  const blocks = (_home.featureBlocks && _home.featureBlocks.length) ? _home.featureBlocks : HOME_DEFAULTS.featureBlocks;
  const featureBlockHTML = (b, idx)=>{
    const bg = b.image
      ? `background:linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)),url('${esc(b.image)}') center/cover no-repeat`
      : `background:linear-gradient(135deg,${safeColor(b.from||"#1d1d1d")},${safeColor(b.to||"#444")})`;
    const banner = `<a class="feature-banner" href="javascript:void(0)" style="${bg}">
      <div class="label"><div class="eyebrow">${esc(b.eyebrow||"")}</div><h3>${esc(b.title||"")}</h3><span class="btn btn-light">${esc(b.cta||"")}</span></div>
    </a>`;
    const copy = `<div class="feature-copy" style="width:100%">
      <div style="margin-bottom:14px"><div class="section-head" style="margin-bottom:6px"><div>
        <div class="eyebrow" style="color:var(--sale);font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600">${esc(b.sub||"")}</div>
        <h2 style="font-family:var(--font-display);text-transform:uppercase;font-size:clamp(22px,2.6vw,30px)">${esc(b.title||"")}</h2>
      </div></div></div>
      ${placeholderRow}
    </div>`;
    return `<div class="hp-zone" data-zone="block-${idx}" style="position:relative">
      <div class="feature ${b.reverse?'rev':''}">${b.reverse?copy+banner:banner+copy}</div>
      <div class="hp-block-actions">
        <button type="button" class="hp-edit" data-edit="block" data-bi="${idx}">✎ Sửa block</button>
        <button type="button" class="hp-edit hp-mini" data-edit="block-up"  data-bi="${idx}" ${idx===0?'disabled':''}>↑</button>
        <button type="button" class="hp-edit hp-mini" data-edit="block-dn"  data-bi="${idx}" ${idx===blocks.length-1?'disabled':''}>↓</button>
        <button type="button" class="hp-edit hp-mini hp-danger" data-edit="block-del" data-bi="${idx}">🗑</button>
      </div>
    </div>`;
  };

  c.innerHTML=`
  <div class="admin-head"><h1>Trang chủ</h1>
    <div class="admin-actions">
      <button class="mini" id="hReset">Khôi phục mặc định</button>
      <button class="btn btn-dark" id="hSave" style="padding:10px 18px">Lưu thay đổi</button>
    </div>
  </div>
  <p class="muted" style="margin:-8px 0 18px;font-size:13.5px">Đây là <b>bản xem trước</b> đầy đủ trang chủ khách thấy (sản phẩm dùng ảnh placeholder trắng để dễ nhìn). Rê chuột vào vùng cần sửa → bấm nút <b style="color:var(--sale)">✎ Sửa</b> ở góc.</p>

  <div class="home-preview">
    <!-- Header (preview, không edit) -->
    <header class="header"><div class="wrap header-row">
      <a class="logo" href="javascript:void(0)">${esc(S.BRAND?.name||"VOISTUDIO")}<span class="dot">.</span></a>
      <nav><ul class="nav">
        <li><a href="javascript:void(0)">Trang chủ</a></li>
        <li><a href="javascript:void(0)">Áo Thun</a></li>
        <li><a href="javascript:void(0)">Hoodie</a></li>
        <li><a href="javascript:void(0)">Phụ kiện</a></li>
        <li><a href="javascript:void(0)">Sale</a></li>
      </ul></nav>
      <div class="icons"><span class="icon-btn">🔍</span><span class="icon-btn">👤</span><span class="icon-btn">🛒</span></div>
    </div></header>

    <!-- Ticker header -->
    <div class="hp-zone" data-zone="tickerHeader">
      <div class="announce"><div class="track">${Array(4).fill(tHeader).join("")}</div></div>
      <button type="button" class="hp-edit" data-edit="tickerHeader">✎ Sửa text chạy</button>
    </div>

    <!-- Hero -->
    <div class="hp-zone" data-zone="hero">
      <section class="hero" ${heroStyle}>
        <div class="hero-inner">
          <h1>${HG.heroHeadline || HOME_DEFAULTS.heroHeadline}</h1>
          <p>${esc(heroSub)}</p>
          <a class="btn btn-light" href="javascript:void(0)">${esc(HG.heroCta || "Khám phá")}</a>
        </div>
        <div class="ticker"><div class="track">${Array(6).fill(tBottom).join("")}</div></div>
      </section>
      <button type="button" class="hp-edit" data-edit="hero">✎ Sửa hero</button>
      <button type="button" class="hp-edit hp-edit-2" data-edit="tickerBottom">✎ Sửa text chạy dưới</button>
    </div>

    <!-- Danh mục nổi bật -->
    <div class="hp-zone" data-zone="tiles">
      <section class="section tight"><div class="wrap">
        <div class="section-head"><div><div class="eyebrow">Mua theo danh mục</div><h2>Danh mục nổi bật</h2></div></div>
        <div class="cats">
          ${tiles.map(([k,a,b])=>{
            const cat = (S.CATEGORIES||[]).find(x=>x.key===k);
            const tile = (_home.catTiles||[]).find(t=>t.key===k);
            if(!cat) return "";
            return `<div class="hp-tile-wrap">
              <a class="cat-tile" href="javascript:void(0)" style="${tileBg(tile,a,b)}"><span>${esc(cat.name)}</span></a>
              <button type="button" class="hp-edit" data-edit="tile" data-key="${esc(k)}">✎ Đổi ảnh</button>
            </div>`;
          }).join("")}
        </div>
      </div></section>
    </div>

    <!-- Feature blocks (placeholder products) -->
    <section class="section"><div class="wrap">
      ${blocks.map((b,i)=>featureBlockHTML(b,i)).join("")}
      <div style="text-align:center;padding:14px 0">
        <button type="button" class="mini" id="addBlock">+ Thêm block</button>
      </div>
    </div></section>

    <!-- Brand strip -->
    <div class="hp-zone" data-zone="strip">
      <div class="strip"><div class="track">${Array(8).fill(`<span>${esc(S.BRAND?.name||"VOISTUDIO")}</span><span class="star">✦</span><span>${esc(stripText)}</span><span class="star">✦</span>`).join("")}</div></div>
      <button type="button" class="hp-edit" data-edit="strip">✎ Sửa strip</button>
    </div>

    <!-- Perks -->
    <div class="hp-zone" data-zone="perks">
      <section class="section tight"><div class="wrap"><div class="perks">
        ${perks.map(p=>`<div class="perk"><div class="ic">${esc(p.icon)}</div><h5>${esc(p.title)}</h5><p>${esc(p.desc)}</p></div>`).join("")}
      </div></div></section>
      <button type="button" class="hp-edit" data-edit="perks">✎ Sửa quyền lợi</button>
    </div>

    <!-- Newsletter -->
    <div class="hp-zone" data-zone="newsletter">
      <section class="newsletter"><div class="wrap">
        <h2>${esc(HG.newsletterTitle || HOME_DEFAULTS.newsletterTitle)}</h2>
        <p>${esc(HG.newsletterSub || HOME_DEFAULTS.newsletterSub)}</p>
        <form class="subscribe" onsubmit="return false" style="align-items:flex-start">
          <div class="fld" style="flex:1;margin:0"><input type="email" placeholder="Email của bạn"></div>
          <button class="btn btn-dark" type="button">Đăng ký</button>
        </form>
      </div></section>
      <button type="button" class="hp-edit" data-edit="newsletter">✎ Sửa newsletter</button>
    </div>

    <!-- Footer -->
    <div class="hp-zone" data-zone="footer">
      <footer class="footer"><div class="wrap">
        <div class="foot-grid">
          <div>
            <div class="logo">${esc(S.BRAND?.name||"VOISTUDIO")}<span class="dot">.</span></div>
            <p style="max-width:260px;color:#b9b9b9">${esc(footerAbout)}</p>
            <div class="socials"><a href="javascript:void(0)">f</a><a href="javascript:void(0)">◎</a><a href="javascript:void(0)">♪</a></div>
          </div>
          <div><h5>Danh mục</h5><ul>
            ${(S.CATEGORIES||[]).slice(0,5).map(c=>`<li><a href="javascript:void(0)">${esc(c.name)}</a></li>`).join("")}
          </ul></div>
          <div><h5>Hỗ trợ</h5><ul>
            <li><a href="javascript:void(0)">Chính sách bảo mật</a></li>
            <li><a href="javascript:void(0)">Đổi trả</a></li>
            <li><a href="javascript:void(0)">Vận chuyển</a></li>
          </ul></div>
          <div><h5>Liên hệ</h5>
            <p style="color:#b9b9b9;line-height:1.9">
              Hotline: <strong style="color:#fff">${esc(S.BRAND?.hotline||"")}</strong><br>
              Email: ${esc(S.BRAND?.email||"")}<br>
              ${esc(S.BRAND?.hours||"")}
            </p>
          </div>
        </div>
        <div class="foot-bottom">
          <span>© ${new Date().getFullYear()} ${esc(S.BRAND?.name||"")}.</span>
          <span>Thiết kế lấy cảm hứng từ streetwear Việt Nam.</span>
        </div>
      </div></footer>
      <button type="button" class="hp-edit" data-edit="footer">✎ Sửa footer</button>
    </div>
  </div>`;

  bindHomePreviewEvents();
}
function bindHomePreviewEvents(){
  $$(".hp-edit").forEach(btn=> btn.onclick=async()=>{
    const t = btn.dataset.edit;
    if(t==="tickerHeader") openTickerEditor("tickerHeader","Text chạy ngang (header)");
    else if(t==="tickerBottom") openTickerEditor("tickerBottom","Text chạy ngang (cuối hero)");
    else if(t==="hero") openHeroEditor();
    else if(t==="tile") openTileEditor(btn.dataset.key);
    else if(t==="strip") openStripEditor();
    else if(t==="perks") openPerksEditor();
    else if(t==="newsletter") openNewsletterEditor();
    else if(t==="footer") openFooterEditor();
    else if(t==="block") openBlockEditor(+btn.dataset.bi);
    else if(t==="block-up" || t==="block-dn"){
      const i=+btn.dataset.bi; const list=_home.featureBlocks=_home.featureBlocks||[];
      const j = t==="block-up" ? i-1 : i+1;
      if(j<0||j>=list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      drawHomeSettings();
    } else if(t==="block-del"){
      const i=+btn.dataset.bi; const b=(_home.featureBlocks||[])[i];
      const ok = await confirmDialog({title:"Xoá block?", body:`Block "<b>${esc(b?.title||"")}</b>" sẽ bị xoá khỏi trang chủ.`, confirmText:"Xoá", danger:true});
      if(!ok) return;
      _home.featureBlocks.splice(i,1); drawHomeSettings();
    }
  });
  const addBlockBtn = $("#addBlock");
  if(addBlockBtn) addBlockBtn.onclick=()=>{
    _home.featureBlocks = _home.featureBlocks || [];
    _home.featureBlocks.push({eyebrow:"New",title:"Block mới",sub:"Mô tả",cta:"Khám phá",href:"collection.html",from:"#333",to:"#666",image:"",catKey:"",collection:"",reverse:false});
    drawHomeSettings();
    openBlockEditor(_home.featureBlocks.length-1);
  };
  $("#hReset").onclick=async()=>{
    const ok = await confirmDialog({
      title:"Khôi phục mặc định?",
      body:"Toàn bộ custom hiện tại sẽ bị xoá và trở về cấu hình gốc.",
      confirmText:"Khôi phục", danger:true,
    });
    if(!ok) return;
    _home = JSON.parse(JSON.stringify(HOME_DEFAULTS));
    drawHomeSettings();
  };
  $("#hSave").onclick=async()=>{
    const btn=$("#hSave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{
      _home.tickerHeader = (_home.tickerHeader||[]).map(s=>(s||"").trim()).filter(Boolean);
      _home.tickerBottom = (_home.tickerBottom||[]).map(s=>(s||"").trim()).filter(Boolean);
      _home.catTiles = (_home.catTiles||[]).filter(t=>t&&(t.image||t.from||t.to));
      await DB.saveSettings("home", _home);
      toast("Đã lưu cấu hình trang chủ");
    }catch(e){ toast("Lỗi: "+(e.message||e)); }
    finally{ btn.disabled=false; btn.textContent="Lưu thay đổi"; }
  };
}

/* --- Modal sửa: hero / ticker / tile --- */
function openTickerEditor(field, title){
  const items = (_home[field]||[]).slice();
  const itemsHtml = (arr)=> arr.map((t,i)=>`
    <div class="frow" style="grid-template-columns:1fr auto;gap:8px;margin-bottom:8px">
      <input type="text" data-ti="${i}" value="${esc(t)}" style="padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font-size:14px">
      <button type="button" class="mini danger" data-tdel="${i}">×</button>
    </div>`).join("");
  openModal(`<h3 class="modal-title">${esc(title)}</h3>
    <p class="muted" style="font-size:13px;margin-bottom:14px">Mỗi dòng là 1 đoạn text. Có thể dùng emoji (🚚 ⚡ ✨ …).</p>
    <div id="teList">${itemsHtml(items)}</div>
    <button type="button" class="mini" id="teAdd" style="margin-top:6px">+ Thêm dòng</button>
    <div class="modal-foot" style="display:flex;gap:10px">
      <button type="button" class="btn btn-outline" data-act="cancel" style="flex:1">Huỷ</button>
      <button type="button" class="btn btn-dark" data-act="ok" style="flex:1">Áp dụng</button>
    </div>`);
  const sync=()=>{ items.length=0; $$("#teList input").forEach((inp,i)=>{ items[i]=inp.value; }); };
  $("#teList").addEventListener("input", sync);
  $("#teAdd").onclick=()=>{ items.push(""); $("#teList").innerHTML=itemsHtml(items); };
  $("#teList").addEventListener("click",(e)=>{
    const b = e.target.closest("[data-tdel]");
    if(!b) return;
    items.splice(+b.dataset.tdel,1);
    $("#teList").innerHTML=itemsHtml(items);
  });
  document.querySelector("[data-act=cancel]").onclick=closeModal;
  document.querySelector("[data-act=ok]").onclick=()=>{
    sync();
    _home[field] = items.map(s=>(s||"").trim()).filter(Boolean);
    closeModal(); drawHomeSettings();
  };
}
function openHeroEditor(){
  const H = _home;
  openModal(`<h3 class="modal-title">Sửa hero</h3>
    <form id="heForm">
      <label class="fld"><span>Headline (cho phép &lt;br&gt;, &lt;em&gt;)</span>
        <textarea name="heroHeadline" rows="3">${esc(H.heroHeadline||"")}</textarea></label>
      <label class="fld"><span>Mô tả phụ</span>
        <textarea name="heroSub" rows="2" placeholder="Để trống = dùng tagline brand">${esc(H.heroSub||"")}</textarea></label>
      <div class="frow">
        <label class="fld"><span>Nút CTA — text</span><input name="heroCta" value="${esc(H.heroCta||"")}"></label>
        <label class="fld"><span>Nút CTA — link</span><input name="heroCtaHref" value="${esc(H.heroCtaHref||"")}" placeholder="collection.html"></label>
      </div>
      <div class="fld"><span>Ảnh nền hero</span>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <input name="heroImage" id="heFileUrl" value="${esc(H.heroImage||"")}" placeholder="https://… (để trống = gradient đen)" style="flex:1">
          <label class="mini" style="cursor:pointer"><span>⬆ Upload</span><input type="file" id="heFile" accept="image/*" hidden></label>
        </div>
        ${H.heroImage?`<div style="margin-top:8px"><img src="${esc(H.heroImage)}" alt="" style="max-width:100%;max-height:160px;border-radius:10px;border:1px solid var(--line)"></div>`:""}
      </div>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="heCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`);
  $("#heCancel").onclick=closeModal;
  $("#heFile").onchange=async(e)=>{
    const fl = e.target.files[0]; if(!fl) return;
    toast("Đang upload…");
    try{ const url = await DB.uploadImage(fl); $("#heFileUrl").value = url; toast("Đã upload"); }
    catch(err){ toast("Lỗi upload: "+(err.message||err)); }
  };
  $("#heForm").onsubmit=(e)=>{
    e.preventDefault(); const f=e.target;
    _home.heroHeadline = f.heroHeadline.value;
    _home.heroSub      = f.heroSub.value;
    _home.heroCta      = f.heroCta.value;
    _home.heroCtaHref  = f.heroCtaHref.value;
    _home.heroImage    = f.heroImage.value.trim();
    closeModal(); drawHomeSettings();
  };
}
function openTileEditor(catKey){
  const cat = (S.CATEGORIES||[]).find(c=>c.key===catKey);
  const tile = (_home.catTiles||[]).find(t=>t.key===catKey) || {key:catKey, image:"", from:"", to:""};
  openModal(`<h3 class="modal-title">Đổi ảnh tile: ${esc(cat?.name||catKey)}</h3>
    <form id="tlForm">
      <div class="fld"><span>Ảnh nền tile</span>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <input name="image" id="tlUrl" value="${esc(tile.image||"")}" placeholder="https://… để trống = dùng gradient" style="flex:1">
          <label class="mini" style="cursor:pointer"><span>⬆ Upload</span><input type="file" id="tlFile" accept="image/*" hidden></label>
        </div>
        ${tile.image?`<div style="margin-top:8px"><img src="${esc(tile.image)}" alt="" style="max-width:100%;max-height:140px;border-radius:10px;border:1px solid var(--line)"></div>`:""}
      </div>
      <div class="frow">
        <label class="fld"><span>Gradient — từ</span><input type="color" name="from" value="${safeColor(tile.from||'#1d1d1d')}" style="width:100%;height:42px;padding:2px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer"></label>
        <label class="fld"><span>Gradient — đến</span><input type="color" name="to" value="${safeColor(tile.to||'#555555')}" style="width:100%;height:42px;padding:2px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer"></label>
      </div>
      <p class="muted" style="font-size:12.5px">Có ảnh → ưu tiên ảnh. Không ảnh → dùng gradient 2 màu trên.</p>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="tlCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`);
  $("#tlCancel").onclick=closeModal;
  $("#tlFile").onchange=async(e)=>{
    const fl = e.target.files[0]; if(!fl) return;
    toast("Đang upload…");
    try{ const url = await DB.uploadImage(fl); $("#tlUrl").value = url; toast("Đã upload"); }
    catch(err){ toast("Lỗi upload: "+(err.message||err)); }
  };
  $("#tlForm").onsubmit=(e)=>{
    e.preventDefault(); const f=e.target;
    let t = (_home.catTiles||[]).find(x=>x.key===catKey);
    if(!t){ t={key:catKey}; (_home.catTiles=_home.catTiles||[]).push(t); }
    t.image = f.image.value.trim();
    t.from  = f.from.value;
    t.to    = f.to.value;
    closeModal(); drawHomeSettings();
  };
}
function openStripEditor(){
  openModal(`<h3 class="modal-title">Sửa strip thương hiệu</h3>
    <form id="stForm">
      <label class="fld"><span>Text strip (chữ in hoa)</span>
        <input name="stripText" value="${esc(_home.stripText||"")}" placeholder="Để trống = dùng tagline brand"></label>
      <p class="muted" style="font-size:12.5px">Dải chữ chạy ngang nằm giữa các block — thường là slogan brand.</p>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="stCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`);
  $("#stCancel").onclick=closeModal;
  $("#stForm").onsubmit=(e)=>{ e.preventDefault(); _home.stripText = e.target.stripText.value.trim(); closeModal(); drawHomeSettings(); };
}
function openPerksEditor(){
  const items = JSON.parse(JSON.stringify(_home.perks||HOME_DEFAULTS.perks));
  const rowHTML = (p,i)=>`
    <div class="frow" style="grid-template-columns:60px 1fr 1.5fr auto;gap:8px;margin-bottom:10px;align-items:center">
      <input data-pi="${i}" data-pf="icon" value="${esc(p.icon||"")}" placeholder="🚚" style="padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:18px;text-align:center">
      <input data-pi="${i}" data-pf="title" value="${esc(p.title||"")}" placeholder="Tiêu đề" style="padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:13.5px">
      <input data-pi="${i}" data-pf="desc" value="${esc(p.desc||"")}" placeholder="Mô tả ngắn" style="padding:10px;border:1.5px solid var(--line);border-radius:8px;font-size:13.5px">
      <button type="button" class="mini danger" data-pdel="${i}">×</button>
    </div>`;
  openModal(`<h3 class="modal-title">Sửa "Quyền lợi khách hàng"</h3>
    <p class="muted" style="font-size:13px;margin-bottom:14px">4 ô lợi ích hiển thị trước khối newsletter.</p>
    <div id="prList">${items.map(rowHTML).join("")}</div>
    <button type="button" class="mini" id="prAdd" style="margin-top:6px">+ Thêm ô</button>
    <div class="modal-foot" style="display:flex;gap:10px">
      <button type="button" class="btn btn-outline" data-act="cancel" style="flex:1">Huỷ</button>
      <button type="button" class="btn btn-dark" data-act="ok" style="flex:1">Áp dụng</button>
    </div>`);
  const sync=()=>{ $$("#prList input[data-pi]").forEach(inp=>{ const i=+inp.dataset.pi, f=inp.dataset.pf; if(!items[i]) items[i]={}; items[i][f]=inp.value; }); };
  $("#prList").addEventListener("input", sync);
  $("#prAdd").onclick=()=>{ items.push({icon:"✓",title:"",desc:""}); $("#prList").innerHTML=items.map(rowHTML).join(""); };
  $("#prList").addEventListener("click",(e)=>{
    const b = e.target.closest("[data-pdel]"); if(!b) return;
    items.splice(+b.dataset.pdel,1);
    $("#prList").innerHTML=items.map(rowHTML).join("");
  });
  document.querySelector("[data-act=cancel]").onclick=closeModal;
  document.querySelector("[data-act=ok]").onclick=()=>{
    sync();
    _home.perks = items.map(p=>({icon:(p.icon||"").trim(),title:(p.title||"").trim(),desc:(p.desc||"").trim()})).filter(p=>p.title||p.desc);
    closeModal(); drawHomeSettings();
  };
}
function openNewsletterEditor(){
  openModal(`<h3 class="modal-title">Sửa "Đăng ký nhận ưu đãi"</h3>
    <form id="nlForm">
      <label class="fld"><span>Tiêu đề</span><input name="newsletterTitle" value="${esc(_home.newsletterTitle||HOME_DEFAULTS.newsletterTitle)}"></label>
      <label class="fld"><span>Mô tả ngắn</span><textarea name="newsletterSub" rows="2">${esc(_home.newsletterSub||HOME_DEFAULTS.newsletterSub)}</textarea></label>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="nlCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`);
  $("#nlCancel").onclick=closeModal;
  $("#nlForm").onsubmit=(e)=>{ e.preventDefault(); const f=e.target;
    _home.newsletterTitle = f.newsletterTitle.value.trim();
    _home.newsletterSub   = f.newsletterSub.value.trim();
    closeModal(); drawHomeSettings();
  };
}
function openFooterEditor(){
  openModal(`<h3 class="modal-title">Sửa footer</h3>
    <form id="ftForm">
      <label class="fld"><span>Đoạn giới thiệu brand (cột trái footer)</span>
        <textarea name="footerAbout" rows="3" placeholder="Để trống = dùng tagline mặc định">${esc(_home.footerAbout||"")}</textarea></label>
      <p class="muted" style="font-size:12.5px">Hotline / email / địa chỉ đang lấy từ BRAND trong <code>data.js</code> — sửa ở đó nếu cần.</p>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="ftCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`);
  $("#ftCancel").onclick=closeModal;
  $("#ftForm").onsubmit=(e)=>{ e.preventDefault();
    _home.footerAbout = e.target.footerAbout.value.trim();
    closeModal(); drawHomeSettings();
  };
}
function openBlockEditor(idx){
  _home.featureBlocks = _home.featureBlocks || JSON.parse(JSON.stringify(HOME_DEFAULTS.featureBlocks));
  const b = _home.featureBlocks[idx];
  if(!b) return;
  const catOpts = `<option value="">— Bỏ lọc theo danh mục —</option>` + (S.CATEGORIES||[]).map(c=>`<option value="${esc(c.key)}" ${b.catKey===c.key?"selected":""}>${esc(c.name)}</option>`).join("");
  const colOpts = (S.COLLECTIONS||[]).map(c=>`<option value="${esc(c)}">`).join("");
  openModal(`<h3 class="modal-title">Sửa block #${idx+1}</h3>
    <form id="bkForm">
      <div class="frow">
        <label class="fld"><span>Eyebrow (chữ nhỏ phía trên)</span><input name="eyebrow" value="${esc(b.eyebrow||"")}" placeholder="VD: Signature"></label>
        <label class="fld"><span>Sub (mô tả phụ)</span><input name="sub" value="${esc(b.sub||"")}" placeholder="VD: Bán chạy nhất"></label>
      </div>
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Tiêu đề chính</span><input name="title" value="${esc(b.title||"")}" placeholder="VD: Polo Relaxed"></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Nút CTA — text</span><input name="cta" value="${esc(b.cta||"")}"></label>
        <label class="fld"><span>Nút CTA — link</span><input name="href" value="${esc(b.href||"")}" placeholder="collection.html?cat=polo"></label>
      </div>
      <div class="frow">
        <label class="fld"><span>Lọc sản phẩm theo Danh mục</span><select name="catKey">${catOpts}</select></label>
        <label class="fld"><span>… và/hoặc Bộ sưu tập</span><input name="collection" list="bkCols" value="${esc(b.collection||"")}" placeholder="Tự gõ hoặc chọn"><datalist id="bkCols">${colOpts}</datalist></label>
      </div>
      <div class="fld"><span>Ảnh nền banner</span>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <input name="image" id="bkUrl" value="${esc(b.image||"")}" placeholder="https://… để trống = dùng gradient" style="flex:1">
          <label class="mini" style="cursor:pointer"><span>⬆ Upload</span><input type="file" id="bkFile" accept="image/*" hidden></label>
        </div>
        ${b.image?`<div style="margin-top:8px"><img src="${esc(b.image)}" alt="" style="max-width:100%;max-height:140px;border-radius:10px;border:1px solid var(--line)"></div>`:""}
      </div>
      <div class="frow">
        <label class="fld"><span>Gradient — từ</span><input type="color" name="from" value="${safeColor(b.from||'#1d1d1d')}" style="width:100%;height:42px;padding:2px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer"></label>
        <label class="fld"><span>Gradient — đến</span><input type="color" name="to" value="${safeColor(b.to||'#444444')}" style="width:100%;height:42px;padding:2px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer"></label>
      </div>
      <label class="fld" style="display:flex;align-items:center;gap:8px;flex-direction:row">
        <input type="checkbox" name="reverse" ${b.reverse?"checked":""} style="width:18px;height:18px">
        <span style="margin:0">Đảo banner sang phải (reverse layout)</span></label>
      <p class="muted" style="font-size:12.5px">Có ảnh → ưu tiên ảnh. Không ảnh → dùng gradient 2 màu trên.</p>
      <div class="modal-foot" style="display:flex;gap:10px">
        <button type="button" class="btn btn-outline" id="bkCancel" style="flex:1">Huỷ</button>
        <button type="submit" class="btn btn-dark" style="flex:1">Áp dụng</button>
      </div>
    </form>`,"wide");
  $("#bkCancel").onclick=closeModal;
  $("#bkFile").onchange=async(e)=>{
    const fl=e.target.files[0]; if(!fl) return;
    toast("Đang upload…");
    try{ const url=await DB.uploadImage(fl); $("#bkUrl").value=url; toast("Đã upload"); }
    catch(err){ toast("Lỗi upload: "+(err.message||err)); }
  };
  $("#bkForm").onsubmit=(e)=>{
    e.preventDefault(); const f=e.target;
    Object.assign(b, {
      eyebrow:f.eyebrow.value.trim(), sub:f.sub.value.trim(), title:f.title.value.trim(),
      cta:f.cta.value.trim(), href:f.href.value.trim(),
      catKey:f.catKey.value, collection:f.collection.value.trim(),
      image:f.image.value.trim(), from:f.from.value, to:f.to.value,
      reverse:f.reverse.checked,
    });
    closeModal(); drawHomeSettings();
  };
}

/* ---------------- ĐƠN HÀNG ---------------- */
let _orders=[];
const _orderState = {
  // Filter state — persist trong session để chuyển tab quay lại không mất
  q: "",                  // search text
  status: "",             // "" = tất cả, hoặc 1 trong STATUS keys
  smart: "",              // "" | "slowConfirm" | "needShip" | "late"
  dateRange: "all",       // "today" | "7d" | "30d" | "all"
  sort: "newest",         // "newest" | "oldest" | "totalDesc" | "lateFirst"
  selected: new Set(),    // Set<string> các order code đã tick
};

// Quá hạn xác nhận sau bao lâu (giờ)
const SLOW_CONFIRM_HOURS = 24;

function _orderMatches(o, st){
  // search: code/phone/name
  if(st.q){
    const q = st.q.toLowerCase();
    const hay = `${o.code||""} ${o.customer_name||""} ${o.phone||""}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  // status pill (single-select)
  if(st.status && o.status !== st.status) return false;
  // smart filter
  if(st.smart === "slowConfirm"){
    if(o.status !== "pending") return false;
    if((Date.now() - new Date(o.created_at)) < SLOW_CONFIRM_HOURS*3600*1000) return false;
  }
  if(st.smart === "needShip"){
    if(o.status !== "confirmed") return false;
    if(o.ghn_order_code) return false;
  }
  if(st.smart === "late"){
    if(!o.ghn_expected_at) return false;
    if(new Date(o.ghn_expected_at) >= Date.now()) return false;
    if(["delivered","cancel","returned"].includes(o.ghn_status)) return false;
  }
  // date range
  if(st.dateRange !== "all"){
    const days = st.dateRange === "today" ? 0 : st.dateRange === "7d" ? 7 : st.dateRange === "30d" ? 30 : null;
    if(days !== null){
      const cutoff = days === 0
        ? new Date(new Date().toDateString()).getTime()
        : Date.now() - days*86400*1000;
      if(new Date(o.created_at).getTime() < cutoff) return false;
    }
  }
  return true;
}

function _sortOrders(arr, sort){
  const a = arr.slice();
  if(sort === "oldest")     a.sort((x,y)=> new Date(x.created_at) - new Date(y.created_at));
  else if(sort === "totalDesc") a.sort((x,y)=> (y.total||0) - (x.total||0));
  else if(sort === "lateFirst") a.sort((x,y)=>{
    const xd = x.ghn_expected_at ? new Date(x.ghn_expected_at) : new Date(8640000000000000);
    const yd = y.ghn_expected_at ? new Date(y.ghn_expected_at) : new Date(8640000000000000);
    return xd - yd;
  });
  else a.sort((x,y)=> new Date(y.created_at) - new Date(x.created_at));   // newest mặc định
  return a;
}

function _timeAgo(iso){
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms/60000);
  if(m<1) return "vừa xong";
  if(m<60) return `${m} phút trước`;
  const h = Math.floor(m/60);
  if(h<24) return `${h} giờ trước`;
  const d = Math.floor(h/24);
  if(d<7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

async function renderOrders(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải đơn hàng…</div>`;
  _orders = await DB.listOrders({});
  // Clear selection mỗi lần refetch tránh ghost selection
  _orderState.selected = new Set(
    Array.from(_orderState.selected).filter(code => _orders.some(o=>o.code===code))
  );
  _renderOrdersInner();
}

function _renderOrdersInner(){
  const st = _orderState;
  const c = $("#adminContent");

  // ===== STATS =====
  const now = Date.now();
  const todayStart = new Date(new Date().toDateString()).getTime();
  const isToday = (iso)=> new Date(iso).getTime() >= todayStart;

  const totalOrders   = _orders.length;
  const todayOrders   = _orders.filter(o=>isToday(o.created_at)).length;
  const pending       = _orders.filter(o=>o.status==="pending").length;
  const slowConfirm   = _orders.filter(o=>o.status==="pending" && (now - new Date(o.created_at)) > SLOW_CONFIRM_HOURS*3600*1000).length;
  const needShip      = _orders.filter(o=>o.status==="confirmed" && !o.ghn_order_code).length;
  const late          = _orders.filter(o=>o.ghn_expected_at && new Date(o.ghn_expected_at) < now && !["delivered","cancel","returned"].includes(o.ghn_status)).length;
  const completed     = _orders.filter(o=>o.status==="completed");
  const revenueAll    = completed.reduce((s,o)=>s+(o.total||0),0);
  const revenueToday  = completed.filter(o=>isToday(o.created_at)).reduce((s,o)=>s+(o.total||0),0);
  const avgOrderValue = completed.length ? Math.round(revenueAll / completed.length) : 0;

  // ===== FILTERED LIST =====
  const filtered = _orders.filter(o => _orderMatches(o, st));
  const sorted = _sortOrders(filtered, st.sort);
  const allSelected = sorted.length > 0 && sorted.every(o => st.selected.has(o.code));
  const selectedArr = Array.from(st.selected);
  const selectedHasGhn = selectedArr.filter(code => _orders.find(o=>o.code===code)?.ghn_order_code);

  // ===== TEMPLATE =====
  c.innerHTML = `
  <div class="admin-head">
    <h1>Đơn hàng</h1>
    <div class="admin-actions">
      <button class="mini" id="refreshO">↻ Tải lại</button>
    </div>
  </div>

  <div class="stats stats-grid-6">
    <button type="button" class="stat stat-click ${!st.status&&!st.smart?'active':''}" data-action="all">
      <div class="k">Tổng đơn</div><div class="v">${totalOrders}</div>
      <div class="sub muted">+${todayOrders} hôm nay</div>
    </button>
    <button type="button" class="stat stat-click ${st.smart==='slowConfirm'?'active stat-warn':''}" data-action="slowConfirm">
      <div class="k">Quá hạn xác nhận</div><div class="v ${slowConfirm?'sale':''}">${slowConfirm}</div>
      <div class="sub muted">${pending} chờ xác nhận</div>
    </button>
    <button type="button" class="stat stat-click ${st.smart==='needShip'?'active stat-info':''}" data-action="needShip">
      <div class="k">Cần gửi GHN</div><div class="v ${needShip?'info':''}">${needShip}</div>
      <div class="sub muted">đã xác nhận, chưa push</div>
    </button>
    <button type="button" class="stat stat-click ${st.smart==='late'?'active stat-danger':''}" data-action="late">
      <div class="k">Trễ giao</div><div class="v ${late?'sale':''}">${late}</div>
      <div class="sub muted">quá ngày dự kiến</div>
    </button>
    <div class="stat">
      <div class="k">Doanh thu hôm nay</div><div class="v">${money(revenueToday)}</div>
      <div class="sub muted">tổng ${money(revenueAll)}</div>
    </div>
    <div class="stat">
      <div class="k">Giá trị TB / đơn</div><div class="v">${money(avgOrderValue)}</div>
      <div class="sub muted">${completed.length} đơn hoàn thành</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="fb-search">
      <input id="oSearch" type="search" placeholder="Tìm mã đơn, tên, SĐT…" value="${esc(st.q||'')}">
    </div>
    <div class="fb-pills" role="tablist" aria-label="Lọc theo trạng thái">
      <button type="button" class="pill ${!st.status&&!st.smart?'active':''}" data-status="">Tất cả</button>
      ${Object.keys(STATUS).map(k=>`<button type="button" class="pill ${st.status===k?'active':''}" data-status="${k}" style="--pill-color:${STATUS_COLOR[k]}">${STATUS[k]}</button>`).join("")}
    </div>
    <div class="fb-secondary">
      <select id="oDateRange" class="statusSelect">
        <option value="all"   ${st.dateRange==='all'?'selected':''}>Mọi thời gian</option>
        <option value="today" ${st.dateRange==='today'?'selected':''}>Hôm nay</option>
        <option value="7d"    ${st.dateRange==='7d'?'selected':''}>7 ngày qua</option>
        <option value="30d"   ${st.dateRange==='30d'?'selected':''}>30 ngày qua</option>
      </select>
      <select id="oSort" class="statusSelect">
        <option value="newest"    ${st.sort==='newest'?'selected':''}>Mới nhất</option>
        <option value="oldest"    ${st.sort==='oldest'?'selected':''}>Cũ nhất</option>
        <option value="totalDesc" ${st.sort==='totalDesc'?'selected':''}>Giá trị cao</option>
        <option value="lateFirst" ${st.sort==='lateFirst'?'selected':''}>Sắp/đã trễ giao</option>
      </select>
      ${(st.q||st.status||st.smart||st.dateRange!=='all'||st.sort!=='newest') ? `<button type="button" class="mini ghost" id="oClearFilter">Xoá lọc</button>` : ""}
    </div>
  </div>

  ${st.selected.size ? `
  <div class="bulk-bar">
    <div class="bb-count">
      <span class="bb-num">${st.selected.size}</span>
      <span class="bb-label">
        đơn đã chọn
        ${selectedHasGhn.length<st.selected.size
          ? `<span class="bb-sub">${selectedHasGhn.length}/${st.selected.size} có vận đơn GHN</span>`
          : `<span class="bb-sub bb-sub-ok">Tất cả đã có vận đơn GHN</span>`}
      </span>
    </div>
    <div class="bb-actions">
      <div class="bb-print-group" ${selectedHasGhn.length?"":"data-disabled"}>
        <select id="bulkPrintSize" class="bb-size" title="Khổ giấy in">
          <option value="A5" selected>A5</option>
          <option value="A6">A6</option>
          <option value="80x80">80×80mm</option>
          <option value="52x70">52×70mm</option>
        </select>
        <button class="bb-print-btn" id="bulkPrint" ${selectedHasGhn.length?"":"disabled"}>
          <span class="bb-print-ic">🖨</span>
          <span class="bb-print-text">In tem GHN</span>
          <span class="bb-print-count">${selectedHasGhn.length}</span>
        </button>
      </div>
      <button class="bb-close" id="bulkClear" title="Bỏ chọn tất cả" aria-label="Bỏ chọn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  </div>
  ` : ""}

  ${sorted.length ? `<div class="tablewrap"><table class="tbl tbl-orders">
    <thead><tr>
      <th class="th-tick"><input type="checkbox" id="tickAll" ${allSelected?'checked':''}></th>
      <th>Mã đơn</th>
      <th>Khách hàng</th>
      <th>SĐT</th>
      <th>SP</th>
      <th>Tổng</th>
      <th>Trạng thái</th>
      <th>Ngày đặt</th>
      <th></th>
    </tr></thead>
    <tbody>${sorted.map(o=>{
      const checked = st.selected.has(o.code) ? "checked" : "";
      const isSlow = o.status==="pending" && (now - new Date(o.created_at)) > SLOW_CONFIRM_HOURS*3600*1000;
      const isLate = o.ghn_expected_at && new Date(o.ghn_expected_at) < now && !["delivered","cancel","returned"].includes(o.ghn_status);
      const rowClass = isLate ? "row-late" : (isSlow ? "row-slow" : "");
      const badges = [];
      if(o.ghn_order_code) badges.push(`<span class="rb rb-ghn" title="Đã đẩy GHN: ${esc(o.ghn_order_code)}">🚚 GHN</span>`);
      if(isSlow) badges.push(`<span class="rb rb-warn" title="Pending > ${SLOW_CONFIRM_HOURS}h">⏰ Chậm</span>`);
      if(isLate) badges.push(`<span class="rb rb-danger" title="Đã quá ngày dự kiến giao">⚠️ Trễ</span>`);
      const printBtn = o.ghn_order_code
        ? `<button class="mini icon-only oprint" data-code="${esc(o.code)}" title="In tem GHN (A5)">🖨</button>`
        : `<button class="mini icon-only" disabled title="Chưa có vận đơn GHN — tạo trong chi tiết">🖨</button>`;
      return `<tr class="${rowClass}">
        <td class="th-tick"><input type="checkbox" class="tick" data-code="${esc(o.code)}" ${checked}></td>
        <td><b>${esc(o.code)}</b><div class="row-badges">${badges.join("")}</div></td>
        <td>${esc(o.customer_name||"")}</td>
        <td>${esc(o.phone||"")}</td>
        <td class="cell-num">${(o.items||[]).reduce((s,i)=>s+i.qty,0)}</td>
        <td class="cell-num"><b>${money(o.total||0)}</b></td>
        <td><select class="statusSelect ostatus" data-id="${esc(o.id||o.code)}" style="border-color:${STATUS_COLOR[o.status]||'#ccc'}">
          ${Object.keys(STATUS).map(k=>`<option value="${k}" ${o.status===k?"selected":""}>${STATUS[k]}</option>`).join("")}
        </select></td>
        <td>
          <div>${new Date(o.created_at).toLocaleDateString("vi-VN")}</div>
          <div class="muted" style="font-size:11px">${_timeAgo(o.created_at)}</div>
        </td>
        <td class="cell-actions">
          <div class="row-actions">
            <button class="mini odetail" data-code="${esc(o.code)}">Xem</button>
            ${printBtn}
          </div>
        </td>
      </tr>`;
    }).join("")}</tbody></table></div>
    <div class="result-count muted" style="margin-top:10px;font-size:12.5px">Hiển thị ${sorted.length} / ${_orders.length} đơn</div>
    `
    : `<div class="empty-state">${(st.q||st.status||st.smart||st.dateRange!=='all') ? "Không có đơn nào khớp bộ lọc." : "Chưa có đơn hàng nào."}</div>`}`;

  // ===== BIND EVENTS =====
  $("#refreshO").onclick = ()=>renderOrders();

  // Stats click → smart filter
  $$(".stat-click").forEach(el => el.onclick = ()=>{
    const act = el.dataset.action;
    if(act === "all"){ st.smart = ""; st.status = ""; }
    else { st.smart = (st.smart === act) ? "" : act; st.status = ""; }
    _renderOrdersInner();
  });

  // Search (debounced)
  const sEl = $("#oSearch");
  if(sEl){
    let to;
    sEl.oninput = e =>{
      clearTimeout(to);
      to = setTimeout(()=>{
        st.q = e.target.value.trim();
        _renderOrdersInner();
        // Restore focus + cursor sau re-render
        setTimeout(()=>{ const ne=$("#oSearch"); if(ne){ ne.focus(); ne.setSelectionRange(ne.value.length,ne.value.length); } }, 0);
      }, 220);
    };
  }

  // Status pills
  $$(".fb-pills .pill").forEach(b => b.onclick = ()=>{
    st.status = b.dataset.status;
    st.smart = "";
    _renderOrdersInner();
  });

  // Date range + sort
  const drEl = $("#oDateRange"); if(drEl) drEl.onchange = e =>{ st.dateRange = e.target.value; _renderOrdersInner(); };
  const sortEl = $("#oSort"); if(sortEl) sortEl.onchange = e =>{ st.sort = e.target.value; _renderOrdersInner(); };
  const clearEl = $("#oClearFilter"); if(clearEl) clearEl.onclick = ()=>{
    st.q = ""; st.status = ""; st.smart = ""; st.dateRange = "all"; st.sort = "newest";
    _renderOrdersInner();
  };

  // Bulk: tick all / individual
  const ta = $("#tickAll"); if(ta) ta.onchange = e =>{
    if(e.target.checked) sorted.forEach(o => st.selected.add(o.code));
    else sorted.forEach(o => st.selected.delete(o.code));
    _renderOrdersInner();
  };
  $$(".tick").forEach(cb => cb.onchange = e =>{
    if(e.target.checked) st.selected.add(cb.dataset.code);
    else st.selected.delete(cb.dataset.code);
    _renderOrdersInner();
  });

  // Bulk action: print
  const bp = $("#bulkPrint"); if(bp) bp.onclick = async ()=>{
    if(!window.GHN || !window.GHN.enabled){ toast("GHN chưa cấu hình"); return; }
    const codes = Array.from(st.selected).filter(code => _orders.find(o=>o.code===code)?.ghn_order_code);
    if(!codes.length){ toast("Chưa đơn nào được chọn có vận đơn GHN"); return; }
    const size = $("#bulkPrintSize")?.value || "A5";
    bp.disabled = true; const old = bp.textContent; bp.textContent = "Đang tạo PDF…";
    const tab = window.open("about:blank", "_blank");
    try{
      const r = await GHN.printUrl(codes, size);
      if(tab) tab.location.href = r.url;
      const skipMsg = r.skipped?.length ? ` (bỏ qua ${r.skipped.length} đơn không có GHN)` : "";
      toast(`Đã mở tem ${r.size} cho ${r.count} đơn${skipMsg}`);
    }catch(e){
      if(tab) tab.close();
      toast("Lỗi in: " + (e.message||e));
    }finally{
      bp.disabled = false; bp.textContent = old;
    }
  };
  const bc = $("#bulkClear"); if(bc) bc.onclick = ()=>{ st.selected.clear(); _renderOrdersInner(); };

  // Status select inline + detail
  $$(".ostatus").forEach(sel=> sel.onchange=async()=>{
    const prev = (_orders.find(o=>(o.id||o.code)===sel.dataset.id)||{}).status;
    try{
      await DB.updateOrderStatus(sel.dataset.id, sel.value);
      const o = _orders.find(x=>(x.id||x.code)===sel.dataset.id);
      if(o) o.status = sel.value;
      sel.style.borderColor=STATUS_COLOR[sel.value];
      toast("Đã cập nhật trạng thái");
      // Re-render để stats cập nhật theo
      _renderOrdersInner();
    }catch(e){ toast("Lỗi: "+(e.message||e)); sel.value = prev||"pending"; }
  });
  $$(".odetail").forEach(b=> b.onclick=()=>{ const o=_orders.find(x=>x.code===b.dataset.code); if(o) orderModal(o); });

  // In tem 1 đơn ngay từ row (default A5)
  $$(".oprint").forEach(b=> b.onclick=async()=>{
    if(!window.GHN || !window.GHN.enabled){ toast("GHN chưa cấu hình"); return; }
    const code = b.dataset.code;
    b.disabled = true; const old = b.textContent; b.textContent = "⏳";
    const tab = window.open("about:blank", "_blank");
    try{
      const r = await GHN.printUrl(code, "A5");
      if(tab) tab.location.href = r.url;
    }catch(e){
      if(tab) tab.close();
      toast("Lỗi in: " + (e.message||e));
    }finally{
      b.disabled = false; b.textContent = old;
    }
  });
}

function orderModal(o){
  // Resolve ảnh: ưu tiên snapshot lưu trong đơn (it.image), fallback từ product hiện tại,
  // cuối cùng SVG mockup. Tên màu lookup từ S.COLORS.
  const itemImage = (it)=>{
    if(it.image) return `<img src="${esc(it.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`;
    const p = (S.PRODUCTS||[]).find(x=>x.id===it.id);
    if(p && p.image_url) return `<img src="${esc(p.image_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`;
    if(p) return S.productSVG(p,{color:it.color});
    return S.productSVG({type:"tee",print:it.name||"",collection:"",colors:[it.color||"#ccc"],name:it.name||""},{color:it.color});
  };
  const items=(o.items||[]).map(it=>{
    const colorName = (S.colorName && it.color) ? S.colorName(it.color) : (it.color||"");
    return `<div style="display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
    <div style="width:56px;aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--bg-soft)">${itemImage(it)}</div>
    <div style="min-width:0">
      <h4 style="font-size:14px;font-weight:600;margin-bottom:4px;line-height:1.35">${esc(it.name)}</h4>
      <div class="ci-meta" style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${it.color?`<span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safeColor(it.color)};border:1px solid #ccc"></span>${esc(colorName)}</span> · `:""}
        Size ${esc(it.size||"")} · SL ${it.qty}
      </div>
    </div>
    <div style="text-align:right;font-weight:700;white-space:nowrap">${money(it.price*it.qty)}</div>
  </div>`;
  }).join("");
  openModal(`<h3 class="modal-title">Đơn ${esc(o.code)}</h3>
    <p style="font-size:14px;line-height:1.8;margin-bottom:14px">
      <b>${esc(o.customer_name||"")}</b> · ${esc(o.phone||"")}${o.email?` · <a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`:""}<br>${esc(o.address||"")}
      ${o.note?`<br><span class="muted">Ghi chú: ${esc(o.note)}</span>`:""}</p>
    ${items}
    <div class="ck-summary" style="margin-top:14px">
      <div class="line"><span>Tạm tính</span><span>${money(o.subtotal||0)}</span></div>
      <div class="line"><span>Giao hàng</span><span>${o.shipping?money(o.shipping):"Miễn phí"}</span></div>
      <div class="total"><span>Tổng</span><span>${money(o.total||0)}</span></div>
    </div>
    <div id="ghnBox" style="margin-top:16px"></div>`);

  renderGhnBox(o);
}

/* ---------------- GHN trong order modal ---------------- */
function renderGhnBox(o){
  const box = $("#ghnBox"); if(!box) return;
  if(!window.GHN || !window.GHN.enabled){
    box.innerHTML = `<div class="muted" style="font-size:12.5px;padding:10px;background:#fafafa;border-radius:8px">
      💡 Cấu hình GHN trong Supabase để bật nút "Tạo đơn GHN" (xem SETUP.md §I).
    </div>`;
    return;
  }
  const hasGhn = !!o.ghn_order_code;
  const statusName = ghnStatusName(o.ghn_status);
  const trackingUrl = hasGhn
    ? `https://tracking.ghn.dev/?order_code=${encodeURIComponent(o.ghn_order_code)}`
    : "";

  box.innerHTML = `
  <div style="border:1px solid var(--line);border-radius:10px;padding:14px;background:#fafbff">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <b style="font-size:14px">🚚 Giao Hàng Nhanh</b>
      ${hasGhn ? `<span class="status-pill" style="background:#eaf3ff;color:#1a56b8;padding:3px 10px;border-radius:99px;font-size:12px">${esc(statusName)}</span>` : ""}
    </div>
    ${hasGhn ? `
      <div style="font-size:13px;line-height:1.7">
        <div>Mã vận đơn: <b>${esc(o.ghn_order_code)}</b>
          <a href="${trackingUrl}" target="_blank" rel="noopener" style="margin-left:8px;font-size:12px">↗ Tracking</a></div>
        ${o.ghn_fee ? `<div>Phí GHN thực tế: <b>${money(o.ghn_fee)}</b></div>` : ""}
        ${o.ghn_expected_at ? `<div>Dự kiến giao: <b>${new Date(o.ghn_expected_at).toLocaleDateString("vi-VN")}</b></div>` : ""}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
        <button class="mini" id="ghnTrack">↻ Cập nhật trạng thái</button>
        <div style="display:inline-flex;align-items:center;gap:4px">
          <button class="mini" id="ghnPrint" title="Mở tem dán hàng trong tab mới">🖨 In tem</button>
          <select id="ghnPrintSize" class="mini" style="font-size:11px;padding:5px 4px;cursor:pointer" title="Khổ giấy in">
            <option value="A5" selected>A5</option>
            <option value="A6">A6</option>
            <option value="80x80">80×80mm</option>
            <option value="52x70">52×70mm</option>
          </select>
        </div>
        ${["delivered","cancel","returned"].includes(o.ghn_status) ? "" :
          `<button class="mini danger" id="ghnCancel">Huỷ vận đơn</button>`}
      </div>
    ` : `
      <p class="muted" style="font-size:13px;margin-bottom:10px">Chưa tạo vận đơn. Bấm để gửi đơn này sang GHN — họ sẽ tới lấy hàng.</p>
      <label class="ghn-note-pick">
        <span class="muted" style="font-size:12px;font-weight:600">Cho khách kiểm tra hàng?</span>
        <select id="ghnRequiredNote" class="statusSelect" style="font-size:12.5px">
          <option value="KHONGCHOXEMHANG"     ${(o.requiredNoteOverride||window.CONFIG?.DEFAULT_REQUIRED_NOTE||'KHONGCHOXEMHANG')==='KHONGCHOXEMHANG'?'selected':''}>🚫 Không cho xem hàng</option>
          <option value="CHOXEMHANGKHONGTHU"  ${o.requiredNoteOverride==='CHOXEMHANGKHONGTHU'?'selected':''}>👀 Cho xem, không cho thử</option>
          <option value="CHOTHUHANG"          ${o.requiredNoteOverride==='CHOTHUHANG'?'selected':''}>👕 Cho thử hàng</option>
        </select>
      </label>
      <button class="btn btn-dark" id="ghnCreate" style="padding:10px 18px;margin-top:10px">Tạo đơn GHN</button>
    `}
    <div id="ghnMsg" class="muted" style="font-size:12px;margin-top:10px"></div>
  </div>`;

  const msg = $("#ghnMsg");
  const setMsg = (txt, color="")=>{ msg.textContent = txt; msg.style.color = color || ""; };

  const btnCreate = $("#ghnCreate");
  if(btnCreate) btnCreate.onclick = async ()=>{
    btnCreate.disabled = true; btnCreate.textContent = "Đang tạo…"; setMsg("");
    try{
      const noteSel = $("#ghnRequiredNote");
      const required_note = noteSel ? noteSel.value : undefined;
      const data = await GHN.createOrder(o.code, required_note ? { required_note } : {});
      toast(`Đã tạo vận đơn: ${data.order_code}`);
      // Refresh đơn từ DB và re-render box
      const fresh = await DB.getOrderByCode(o.code);
      if(fresh){ Object.assign(o, fresh); renderGhnBox(o); }
      // Đồng bộ danh sách
      const row = _orders.find(x=>(x.id||x.code)===(o.id||o.code));
      if(row) Object.assign(row, fresh||{});
    }catch(e){
      btnCreate.disabled = false; btnCreate.textContent = "Tạo đơn GHN";
      setMsg("Lỗi: " + e.message, "var(--sale)");
    }
  };

  const btnTrack = $("#ghnTrack");
  if(btnTrack) btnTrack.onclick = async ()=>{
    btnTrack.disabled = true; btnTrack.textContent = "Đang tải…"; setMsg("");
    try{
      const d = await GHN.track(o.code);
      const fresh = await DB.getOrderByCode(o.code);
      if(fresh){ Object.assign(o, fresh); renderGhnBox(o); }
      setMsg(`Trạng thái: ${ghnStatusName(d.status)}`, "var(--muted)");
    }catch(e){
      btnTrack.disabled = false; btnTrack.textContent = "↻ Cập nhật trạng thái";
      setMsg("Lỗi: " + e.message, "var(--sale)");
    }
  };

  const btnPrint = $("#ghnPrint");
  if(btnPrint) btnPrint.onclick = async ()=>{
    const size = $("#ghnPrintSize")?.value || "A5";
    btnPrint.disabled = true; const old = btnPrint.textContent; btnPrint.textContent = "Đang tạo…"; setMsg("");
    // Mở tab trước (trong onclick) để né popup blocker. Sau đó set URL khi có token.
    const tab = window.open("about:blank", "_blank");
    try{
      const r = await GHN.printUrl(o.code, size);
      if(tab) tab.location.href = r.url;
      setMsg(`Đã mở tem ${r.size} (token có hạn ~10 phút)`, "var(--muted)");
    }catch(e){
      if(tab) tab.close();
      setMsg("Lỗi in tem: " + e.message, "var(--sale)");
    }finally{
      btnPrint.disabled = false; btnPrint.textContent = old;
    }
  };

  const btnCancel = $("#ghnCancel");
  if(btnCancel) btnCancel.onclick = async ()=>{
    const ok = await confirmDialog({
      title:"Huỷ vận đơn GHN?",
      body:`Vận đơn <b>${esc(o.ghn_order_code)}</b> sẽ bị huỷ. Không thể hoàn tác bên GHN.`,
      confirmText:"Huỷ vận đơn", danger:true,
    });
    if(!ok) return;
    btnCancel.disabled = true; setMsg("");
    try{
      await GHN.cancel(o.code);
      toast("Đã huỷ vận đơn GHN");
      const fresh = await DB.getOrderByCode(o.code);
      if(fresh){ Object.assign(o, fresh); renderGhnBox(o); }
    }catch(e){
      btnCancel.disabled = false;
      setMsg("Lỗi: " + e.message, "var(--sale)");
    }
  };
}

function ghnStatusName(s){
  const map = {
    ready_to_pick:"Chờ lấy hàng", picking:"Đang lấy hàng", picked:"Đã lấy hàng",
    storing:"Đang ở kho", transporting:"Đang vận chuyển", sorting:"Đang phân loại",
    delivering:"Đang giao", delivered:"Giao thành công", delivery_fail:"Giao thất bại",
    cancel:"Đã huỷ", return:"Trả hàng", returned:"Đã trả hàng",
  };
  return map[s] || s || "—";
}

/* ---------------- SẢN PHẨM ---------------- */
let _products=[];
async function renderProducts(){
  // chỉ fetch khi cần (vào tab lần đầu, hoặc seed/refresh thủ công)
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải sản phẩm…</div>`;
  _products = await DB.listProducts({adminAll:true});
  drawProducts();
}
function productRowHTML(p){
  return `<tr data-pid="${esc(p.id)}">
    <td><div class="pthumb">${thumb(p)}</div></td>
    <td><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc(p.collection||"")}</div></td>
    <td>${esc(p.catName||p.catKey)}</td>
    <td><b>${money(p.price)}</b>${p.compare>p.price?`<div class="muted" style="font-size:11.5px;text-decoration:line-through">${money(p.compare)}</div>`:""}</td>
    <td style="${p.stock<=0?'color:var(--sale);font-weight:700':''}">${p.stock}</td>
    <td style="font-variant-numeric:tabular-nums" title="Đã bán thật (chỉ admin thấy)"><b>${p.sold_real||0}</b><div class="muted" style="font-size:11.5px">ảo: ${p.sold||0}</div></td>
    <td style="font-variant-numeric:tabular-nums">${p.likes||0}</td>
    <td><button type="button" class="switch ptoggle ${p.active!==false?'on':''}" data-id="${esc(p.id)}" aria-label="${p.active!==false?'Đang hiện — bấm để ẩn':'Đang ẩn — bấm để hiện'}">
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span class="switch-label">${p.active!==false?"Hiện":"Ẩn"}</span>
    </button></td>
    <td style="white-space:nowrap">
      <a class="mini" href="../product.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="Xem trang khách">👁 Xem</a>
      <button class="mini pedit" data-id="${esc(p.id)}">Sửa</button>
      <button class="mini danger pdel" data-id="${esc(p.id)}">Xoá</button>
    </td>
  </tr>`;
}
function drawProducts(){
  // Vẽ lại UI từ _products local — không fetch DB. Action ẩn/hiện/xoá/sửa
  // cập nhật _products tại chỗ rồi gọi hàm này để tránh nháy & gọi mạng thừa.
  const c=$("#adminContent");
  c.innerHTML=`
  <div class="admin-head"><h1>Sản phẩm (${_products.length})</h1>
    <div class="admin-actions">
      ${_products.length?"":`<button class="mini" id="seedBtn">⬇ Nhập dữ liệu mẫu</button>`}
      <button class="btn btn-dark" id="addBtn" style="padding:10px 18px">+ Thêm sản phẩm</button>
    </div>
  </div>
  ${_products.length? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Ảnh</th><th>Tên</th><th>Danh mục</th><th>Giá</th><th>Tồn</th><th>Bán thật / ảo</th><th>♥</th><th>Hiện</th><th></th></tr></thead>
    <tbody>${_products.map(productRowHTML).join("")}</tbody></table></div>`
    : `<div class="empty-state">Chưa có sản phẩm.<br><br>Bấm <b>Nhập dữ liệu mẫu</b> để có sẵn 30 sản phẩm demo, hoặc <b>Thêm sản phẩm</b>.</div>`}`;
  bindProductRowActions();
}
function bindProductRowActions(){
  const sb=$("#seedBtn"); if(sb) sb.onclick=async()=>{ sb.disabled=true; sb.textContent="Đang nhập…"; try{ await DB.seedDemo(); _products = await DB.listProducts({adminAll:true}); toast("Đã nhập "+_products.length+" sản phẩm"); drawProducts(); }catch(e){ toast("Lỗi: "+(e.message||e)); sb.disabled=false; sb.textContent="⬇ Nhập dữ liệu mẫu"; } };
  $("#addBtn").onclick=()=>productModal(null);
  $$(".pedit").forEach(b=> b.onclick=()=>productModal(_products.find(p=>p.id===b.dataset.id)));
  $$(".pdel").forEach(b=> b.onclick=async()=>{
    const p=_products.find(x=>x.id===b.dataset.id);
    const ok = await confirmDialog({
      title:"Xoá sản phẩm?",
      body:`Sản phẩm "<b>${esc(p?.name||"")}</b>" sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.`,
      confirmText:"Xoá", cancelText:"Huỷ", danger:true,
    });
    if(!ok) return;
    try{
      await DB.deleteProduct(b.dataset.id);
      // Xoá khỏi mảng local rồi vẽ lại — không refetch toàn bộ
      const idx = _products.findIndex(x=>x.id===b.dataset.id);
      if(idx>=0) _products.splice(idx,1);
      toast("Đã xoá"); drawProducts();
    }catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
  $$(".ptoggle").forEach(sw=> sw.onclick=async()=>{
    const p=_products.find(x=>x.id===sw.dataset.id); if(!p) return;
    const wasActive = p.active!==false;
    const ok = await confirmDialog({
      title: wasActive ? "Ẩn sản phẩm?" : "Hiện sản phẩm?",
      body: wasActive
        ? `Sản phẩm "<b>${esc(p.name)}</b>" sẽ ẩn khỏi cửa hàng. Khách không thấy nữa cho tới khi bạn bật lại.`
        : `Sản phẩm "<b>${esc(p.name)}</b>" sẽ hiện lại trên cửa hàng.`,
      confirmText: wasActive ? "Ẩn" : "Hiện",
      danger: wasActive,
    });
    if(!ok) return;
    sw.disabled=true;
    try{
      const saved = await DB.upsertProduct({...p, active: !wasActive});
      // Merge data trả về (giữ field tính toán như catName từ map) lên item local
      Object.assign(p, saved || {}, {active: !wasActive});
      toast(wasActive ? "Đã ẩn sản phẩm" : "Đã hiện sản phẩm");
      // Chỉ vẽ lại đúng row thay vì cả bảng để tránh nháy
      const tr = $(`tr[data-pid="${CSS.escape(p.id)}"]`);
      if(tr){ tr.outerHTML = productRowHTML(p); bindProductRowActions(); }
      else drawProducts();
    }catch(e){ toast("Lỗi: "+(e.message||e)); sw.disabled=false; }
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
    <form id="pform" novalidate>
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Tên sản phẩm *</span><input name="name" value="${esc(p.name)}" required></label>
      </div>
      <div class="frow">
        <label class="fld" style="grid-column:span 2"><span>Danh mục *</span><select name="catKey">${catOpts}</select></label>
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
        <label class="fld"><span>Đã bán — ẢO (hiển thị khách)</span><input name="sold" type="number" min="0" value="${p.sold||0}" placeholder="VD: 1234"></label>
        <label class="fld"><span>Đã bán — THẬT (nội bộ)</span><input name="sold_real" type="number" min="0" value="${p.sold_real||0}" placeholder="VD: 87"></label>
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
      <div class="modal-foot">
        <button class="btn btn-dark btn-block" type="submit" id="psave">${editing?"Lưu thay đổi":"Thêm sản phẩm"}</button>
      </div>
    </form>`,"wide");

  function drawVariants(){
    const root=$("#variants");
    const palette = (S.COLORS||[]).filter(c=>c.active!==false);
    root.innerHTML = variants.map((v,vi)=>{
      const matched = palette.find(c=>c.hex.toLowerCase()===String(v.color||"").toLowerCase());
      const nameLabel = matched ? matched.name : "(màu tự nhập)";
      const swatches = palette.map(c=>{
        const on = c.hex.toLowerCase()===String(v.color||"").toLowerCase();
        return `<button type="button" class="vswatch ${on?"on":""}" data-vi="${vi}" data-hex="${esc(c.hex)}" style="background:${safeColor(c.hex)}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`;
      }).join("");
      return `
      <div class="variant">
        <div class="variant-head">
          <input type="color" class="vcolor" value="${safeColor(v.color)}" data-vi="${vi}" title="Tự nhập hex">
          <code class="muted" style="font-size:12px">${esc(v.color)}</code>
          <b style="font-size:13px">${esc(nameLabel)}</b>
          <span class="muted" style="font-size:12px">· ${v.imgs.length} ảnh</span>
          <span style="flex:1"></span>
          <button type="button" class="mini danger vdel" data-vi="${vi}" ${variants.length<=1?'disabled':''}>Xoá màu</button>
        </div>
        ${palette.length?`<div class="vpalette" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px">${swatches}</div>`:""}
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
      </div>`;
    }).join("");

    $$(".vswatch",root).forEach(b=> b.onclick=()=>{ variants[+b.dataset.vi].color=b.dataset.hex; drawVariants(); });
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
  $("#addColor").onclick=()=>{
    // Gợi ý màu kế tiếp từ palette mà variant hiện chưa dùng
    const used = new Set(variants.map(v=>String(v.color||"").toLowerCase()));
    const palette = (S.COLORS||[]).filter(c=>c.active!==false);
    const next = palette.find(c=>!used.has(c.hex.toLowerCase())) || palette[0];
    variants.push({color: next?next.hex:"#888888", imgs:[]});
    drawVariants();
  };

  $("#pform").onsubmit=async(e)=>{
    e.preventDefault(); const f=e.target;
    const ok = validateFields([
      {el:f.name,  msg:"Nhập tên sản phẩm"},
      {el:f.price, msg:"Giá bán phải lớn hơn 0", test:v=> (+v)>0},
    ]);
    if(!ok) return;
    const sizes=$$("#sizes input:checked").map(x=>x.value);
    const colors = variants.map(v=>v.color);
    const color_images = {}; variants.forEach(v=>{ if(v.imgs.length) color_images[v.color]=v.imgs.slice(); });
    const images = variants.flatMap(v=>v.imgs);
    const setVariantErr = (msg)=>{
      const block = $("#variants");
      let oe = block && block.parentNode.querySelector(".opt-error.variantErr");
      if(msg){
        if(!oe){ oe=document.createElement("div"); oe.className="opt-error variantErr"; block.parentNode.insertBefore(oe, block.nextSibling); }
        oe.textContent = msg;
        block.scrollIntoView({block:"center",behavior:"smooth"});
      } else if(oe){ oe.remove(); }
    };
    if(!editing){
      if(variants.some(v=>!v.imgs.length)){ setVariantErr("Mỗi màu cần ít nhất 1 ảnh của màu đó"); return; }
      if(images.length<3){ setVariantErr("Cần tối thiểu 3 ảnh khi thêm sản phẩm mới"); return; }
      setVariantErr("");
    }
    const prod={
      ...(editing?{id:p.id, print:p.print||""}:{print:""}),
      name:f.name.value.trim(),
      catKey:f.catKey.value, collection:f.collection.value.trim(),
      price:+f.price.value||0, compare:+f.compare.value||0, stock:+f.stock.value||0,
      sold:+f.sold.value||0, sold_real:+f.sold_real.value||0, likes:+f.likes.value||0,
      colors, sizes:sizes.length?sizes:["Freesize"],
      images, color_images, image_url:images[0]||null, active:f.active.checked,
    };
    const btn=$("#psave"); btn.disabled=true; btn.textContent="Đang lưu…";
    try{
      const saved = await DB.upsertProduct(prod);
      // Cập nhật _products local thay vì refetch — tránh nháy danh sách
      if(editing){
        const idx = _products.findIndex(x=>x.id===p.id);
        if(idx>=0) _products[idx] = saved || {..._products[idx], ...prod};
      } else if(saved){
        _products.unshift(saved);
      }
      toast("Đã lưu sản phẩm"); closeModal(); drawProducts();
    }
    catch(err){ console.error(err); toast("Lỗi: "+(err.message||err)); btn.disabled=false; btn.textContent=editing?"Lưu thay đổi":"Thêm sản phẩm"; }
  };
}

/* ---------------- MODAL CHUNG ---------------- */
function openModal(html, cls=""){
  closeModal();
  const ov=document.createElement("div"); ov.className="modal-overlay"; ov.id="adminModal";
  ov.innerHTML=`<div class="modal ${cls}"><button class="modal-close" id="mClose">×</button>${html}</div>`;
  document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add("show"));
  document.body.style.overflow="hidden";
  // Di chuyển close vào title (cuối) để flex-align center chuẩn
  const mod = ov.querySelector(".modal");
  const close = mod && mod.querySelector(":scope > .modal-close");
  const title = mod && mod.querySelector(":scope > .modal-title");
  if(close && title && !title.contains(close)) title.appendChild(close);
  $("#mClose").onclick=closeModal; ov.addEventListener("click",e=>{ if(e.target===ov) closeModal(); });
}
function closeModal(){ const m=$("#adminModal"); if(m){ m.classList.remove("show"); setTimeout(()=>m.remove(),180); } document.body.style.overflow=""; }
// Escape đóng modal admin (form sửa SP, danh mục, đơn…)
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && $("#adminModal")) closeModal(); });

/* ---------------- VOUCHERS ---------------- */
let _vouchers=[];
const VTYPE_LABEL = { percent:"% theo đơn", fixed:"Số tiền cố định", freeship:"Miễn phí ship" };
async function renderVouchers(){
  const c=$("#adminContent");
  c.innerHTML=`<div class="empty-state">Đang tải voucher…</div>`;
  _vouchers = await DB.listVouchers();
  drawVouchers();
}
function drawVouchers(){
  const c=$("#adminContent");
  const total = _vouchers.length;
  const active = _vouchers.filter(v=>v.active).length;
  const used   = _vouchers.reduce((s,v)=>s+(v.used_count||0),0);
  c.innerHTML=`
  <div class="admin-head">
    <h1>Voucher</h1>
    <div class="admin-actions">
      <button class="btn btn-dark" id="addV" style="padding:9px 18px">+ Tạo voucher</button>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="k">Tổng voucher</div><div class="v">${total}</div></div>
    <div class="stat"><div class="k">Đang bật</div><div class="v green">${active}</div></div>
    <div class="stat"><div class="k">Đã dùng (lượt)</div><div class="v">${used}</div></div>
  </div>
  ${_vouchers.length ? `<div class="tablewrap"><table class="tbl">
    <thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>ĐK tối thiểu</th><th>Đã dùng / Tối đa</th><th>Hiệu lực</th><th>Trạng thái</th><th></th></tr></thead>
    <tbody>${_vouchers.map(v=>{
      const value = v.discount_type === "percent" ? `${v.discount_value}%${v.max_discount?` (max ${money(v.max_discount)})`:""}`
        : v.discount_type === "fixed" ? money(v.discount_value)
        : "Freeship";
      const usage = `${v.used_count||0}${v.max_uses?` / ${v.max_uses}`:" / ∞"}`;
      const period = [
        v.starts_at ? `từ ${new Date(v.starts_at).toLocaleDateString("vi-VN")}` : "",
        v.expires_at ? `→ ${new Date(v.expires_at).toLocaleDateString("vi-VN")}` : "",
      ].filter(Boolean).join(" ") || "Vô hạn";
      return `<tr>
        <td><b style="font-family:var(--font-display);letter-spacing:.05em">${esc(v.code)}</b>${v.description?`<div class="muted" style="font-size:11.5px;margin-top:2px">${esc(v.description)}</div>`:""}</td>
        <td><span class="pill" style="background:${v.discount_type==='freeship'?'#1d9e75':v.discount_type==='percent'?'#7a5cff':'#d8a441'}">${VTYPE_LABEL[v.discount_type]||v.discount_type}</span></td>
        <td><b>${value}</b></td>
        <td>${v.min_order?money(v.min_order):"—"}</td>
        <td>${usage}</td>
        <td style="font-size:12px">${period}</td>
        <td><span class="${v.active?'tag-on':'tag-off'} pill">${v.active?"Bật":"Tắt"}</span></td>
        <td style="white-space:nowrap">
          <button class="mini vedit" data-id="${v.id}">Sửa</button>
          <button class="mini danger vdel" data-id="${v.id}">Xoá</button>
        </td>
      </tr>`;
    }).join("")}</tbody></table></div>` : `<div class="empty-state">Chưa có voucher nào. Bấm "+ Tạo voucher" để thêm.</div>`}`;

  $("#addV").onclick = ()=>voucherModal(null);
  $$(".vedit").forEach(b=>b.onclick=()=>voucherModal(_vouchers.find(x=>x.id===b.dataset.id)));
  $$(".vdel").forEach(b=>b.onclick=async()=>{
    const v = _vouchers.find(x=>x.id===b.dataset.id);
    const ok = await confirmDialog({
      title:"Xoá voucher?", body:`Voucher "<b>${esc(v.code)}</b>" sẽ bị xoá vĩnh viễn.`,
      confirmText:"Xoá", danger:true,
    });
    if(!ok) return;
    try{ await DB.deleteVoucher(v.id); _vouchers = _vouchers.filter(x=>x.id!==v.id); drawVouchers(); toast("Đã xoá"); }
    catch(e){ toast("Lỗi: "+(e.message||e)); }
  });
}
function voucherModal(v){
  const isEdit = !!v;
  v = v || { code:"", description:"", discount_type:"percent", discount_value:10, min_order:0, max_discount:null, max_uses:null, starts_at:null, expires_at:null, active:true };
  openModal(`<h3 class="modal-title">${isEdit?"Sửa":"Tạo"} voucher</h3>
    <form id="vForm" novalidate>
      <div class="frow">
        <label class="fld"><span>Mã (UPPERCASE, không khoảng trắng)</span>
          <input name="code" value="${esc(v.code||"")}" required pattern="[A-Z0-9_]+" placeholder="VD: SALE10, FREESHIP" style="text-transform:uppercase;font-family:var(--font-display);letter-spacing:.04em">
        </label>
        <label class="fld"><span>Loại giảm</span>
          <select name="discount_type">
            <option value="percent"  ${v.discount_type==='percent'?'selected':''}>% theo đơn</option>
            <option value="fixed"    ${v.discount_type==='fixed'?'selected':''}>Số tiền cố định</option>
            <option value="freeship" ${v.discount_type==='freeship'?'selected':''}>Miễn phí ship</option>
          </select>
        </label>
      </div>
      <label class="fld"><span>Mô tả ngắn (cho admin xem)</span>
        <input name="description" value="${esc(v.description||"")}" placeholder="VD: Giảm 10% cho khách mới">
      </label>
      <div class="frow">
        <label class="fld" id="vValueField"><span>Giá trị giảm <span id="vUnit">(%)</span></span>
          <input name="discount_value" type="number" min="0" value="${v.discount_value||0}" required>
        </label>
        <label class="fld" id="vMaxField"><span>Trần giảm tối đa (chỉ áp cho %)</span>
          <input name="max_discount" type="number" min="0" value="${v.max_discount||""}" placeholder="VD 50000 (để trống = không trần)">
        </label>
      </div>
      <div class="frow">
        <label class="fld"><span>Đơn tối thiểu (VND)</span>
          <input name="min_order" type="number" min="0" value="${v.min_order||0}" placeholder="0 = không yêu cầu">
        </label>
        <label class="fld"><span>Số lượt dùng tối đa</span>
          <input name="max_uses" type="number" min="1" value="${v.max_uses||""}" placeholder="Trống = vô hạn">
        </label>
      </div>
      <div class="frow">
        <label class="fld"><span>Bắt đầu</span>
          <input name="starts_at" type="datetime-local" value="${v.starts_at?new Date(v.starts_at).toISOString().slice(0,16):""}">
        </label>
        <label class="fld"><span>Hết hạn</span>
          <input name="expires_at" type="datetime-local" value="${v.expires_at?new Date(v.expires_at).toISOString().slice(0,16):""}">
        </label>
      </div>
      <label class="fld" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input name="active" type="checkbox" ${v.active!==false?"checked":""} style="width:18px;height:18px">
        <span style="font-weight:600">Đang bật</span>
      </label>
      <div class="modal-foot">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Huỷ</button>
        <button class="btn btn-dark" type="submit">Lưu</button>
      </div>
    </form>`);
  const form = $("#vForm");
  // Dynamic label theo loại
  const updateUnit = ()=>{
    const t = form.discount_type.value;
    const valWrap = $("#vValueField"), maxWrap = $("#vMaxField");
    const unit = $("#vUnit");
    if(t === "percent"){ valWrap.style.display=""; unit.textContent="(%)"; maxWrap.style.display=""; }
    else if(t === "fixed"){ valWrap.style.display=""; unit.textContent="(VND)"; maxWrap.style.display="none"; }
    else { valWrap.style.display="none"; maxWrap.style.display="none"; }
  };
  form.discount_type.onchange = updateUnit; updateUnit();
  form.code.oninput = (e)=>{ e.target.value = e.target.value.toUpperCase().replace(/\s+/g,""); };
  form.onsubmit = async(e)=>{
    e.preventDefault();
    const payload = {
      id: v.id, code: form.code.value, description: form.description.value,
      discount_type: form.discount_type.value,
      discount_value: +form.discount_value.value||0,
      min_order: +form.min_order.value||0,
      max_discount: form.max_discount.value ? +form.max_discount.value : null,
      max_uses: form.max_uses.value ? +form.max_uses.value : null,
      starts_at: form.starts_at.value ? new Date(form.starts_at.value).toISOString() : null,
      expires_at: form.expires_at.value ? new Date(form.expires_at.value).toISOString() : null,
      active: form.active.checked,
    };
    try{
      const saved = await DB.saveVoucher(payload);
      if(v.id){ const idx = _vouchers.findIndex(x=>x.id===v.id); if(idx>=0) _vouchers[idx] = saved; }
      else { _vouchers.unshift(saved); }
      closeModal(); drawVouchers(); toast(v.id?"Đã cập nhật":"Đã tạo voucher");
    }catch(e){ toast("Lỗi: "+(e.message||e)); }
  };
}

/* ---------------- START ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  // Guard: chỉ đăng ký auth-listener 1 lần. DB.onAuth (Supabase) firing nhiều lần
  // (token refresh, INITIAL_SESSION) sẽ kéo theo boot() lặp lại — và boot() ghi đè
  // document.body làm mọi listener trong tab cũ vẫn còn nhưng trỏ vào DOM mới.
  if(window.__adminAuthBound) return;
  window.__adminAuthBound = true;
  let lastUserId;   // undefined ⇒ lần callback đầu (kể cả khi user=null) luôn chạy boot()
  if(DB.cloud){
    DB.onAuth((u)=>{
      const uid = u?.id || null;
      if(uid === lastUserId) return;   // bỏ qua event không đổi user (token refresh)
      lastUserId = uid;
      boot();
    });
  } else {
    boot();
  }
});
