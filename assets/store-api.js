/* =========================================================
   STORE API — một lớp dữ liệu, hai chế độ
   • CLOUD: Supabase (đồng bộ thật, nhiều thiết bị)
   • LOCAL: localStorage (demo trên 1 trình duyệt)
   Tự chọn chế độ dựa vào assets/config.js
   ========================================================= */
(function(){
  const CFG = window.CONFIG || {};
  const hasKeys = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const supa = hasKeys ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const MODE = supa ? "cloud" : "local";

  const LS = { products:"originals_products_v1", orders:"originals_orders_v1", admin:"originals_admin_v1", categories:"originals_categories_v1", colors:"originals_colors_v1", settings:"originals_settings_v1" };
  const read  = (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } };
  const write = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  /* ---- chuẩn hoá images: nhận array | string | image_url cũ → trả về array URL ---- */
  function normImages(row){
    let arr = row.images;
    if(typeof arr === "string"){ try{ arr = JSON.parse(arr); }catch(e){ arr = []; } }
    if(!Array.isArray(arr)) arr = [];
    arr = arr.map(x => typeof x === "string" ? x : (x?.url || "")).filter(Boolean);
    // Back-compat: image_url cũ → bổ sung vào đầu nếu chưa có
    if(row.image_url && !arr.includes(row.image_url)) arr.unshift(row.image_url);
    return arr;
  }

  /* ---- chuẩn hoá color_images: { "#hex": [url,...] } ---- */
  function normColorImages(raw){
    if(typeof raw === "string"){ try{ raw = JSON.parse(raw); }catch(e){ raw = {}; } }
    if(!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for(const k of Object.keys(raw)){
      let arr = raw[k];
      if(!Array.isArray(arr)) arr = [];
      arr = arr.map(x => typeof x === "string" ? x : (x?.url || "")).filter(Boolean);
      if(arr.length) out[k] = arr;
    }
    return out;
  }
  /* ảnh chính của SP: ưu tiên ảnh của màu đầu tiên → gallery phẳng → null */
  function pickMainImage(colors, colorImages, flatImages){
    const first = (colors||[])[0];
    if(first && colorImages[first] && colorImages[first].length) return colorImages[first][0];
    return flatImages[0] || null;
  }

  /* ---- map giữa DB row và product dùng ở giao diện ---- */
  function mapProduct(row){
    const cat = (window.STORE.CATEGORIES||[]).find(c=>c.key===row.cat_key) || {name:row.cat_key||"", type:"tee"};
    const images = normImages(row);
    const color_images = normColorImages(row.color_images);
    const colors = row.colors||[];
    return {
      id: row.id, catKey: row.cat_key, type: cat.type, catName: cat.name,
      collection: row.collection||"", name: row.name, shortName: row.print||row.name,
      print: row.print||row.name, price: +row.price||0, compare: +row.compare||0,
      colors, sizes: row.sizes||["S","M","L","XL"],
      stock: row.stock==null?0:+row.stock,
      sold: row.sold==null?0:+row.sold,         // ẢO — hiển thị cho khách
      sold_real: row.sold_real==null?0:+row.sold_real,  // THẬT — chỉ admin
      likes: row.likes==null?0:+row.likes,
      images, color_images, image_url: pickMainImage(colors, color_images, images),
      active: row.active!==false, sort: +row.sort||0,
      sale: (+row.compare||0) > (+row.price||0),
    };
  }
  function toRow(p){
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : normImages(p);
    const color_images = normColorImages(p.color_images);
    const colors = p.colors||[];
    const r = {
      name:p.name, print:p.print||p.shortName||p.name, cat_key:p.catKey,
      collection:p.collection||"", price:+p.price||0, compare:+p.compare||0,
      colors, sizes:p.sizes||["S","M","L","XL"],
      stock:p.stock==null?0:+p.stock,
      sold:p.sold==null?0:+p.sold,
      sold_real:p.sold_real==null?0:+p.sold_real,
      likes:p.likes==null?0:+p.likes,
      images, color_images, image_url: pickMainImage(colors, color_images, images),
      active:p.active!==false, sort:+p.sort||0,
    };
    if(p.id && isUUID(p.id)) r.id = p.id;
    return r;
  }
  const isUUID = (s)=> /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s||"");

  /* chuẩn hoá: chấp nhận cả DB row (cat_key) lẫn shape giao diện (catKey) */
  function normalize(row){
    if(row && row.cat_key !== undefined) return mapProduct(row);
    const cat = (window.STORE.CATEGORIES||[]).find(c=>c.key===row.catKey) || {name:row.catName||"", type:row.type||"tee"};
    const images = normImages(row);
    const color_images = normColorImages(row.color_images);
    const colors = row.colors||[];
    return { ...row, type:row.type||cat.type, catName:row.catName||cat.name,
      colors, sizes:row.sizes||["S","M","L","XL"],
      stock: row.stock==null?0:+row.stock,
      sold: row.sold==null?0:+row.sold,
      likes: row.likes==null?0:+row.likes,
      images, color_images, image_url: pickMainImage(colors, color_images, images) || row.image_url || null,
      active: row.active!==false, sort:+row.sort||0, sale:(+row.compare||0)>(+row.price||0) };
  }

  /* ---- seed local từ dữ liệu demo trong data.js ---- */
  function seedLocal(){
    const seed = (window.STORE.PRODUCTS||[]).map((p,i)=>({
      ...p, id:p.id, active:true, sort:i, stock:p.stock==null?50:p.stock, image_url:p.image_url||null
    }));
    write(LS.products, seed);
    return seed;
  }

  function genCode(){
    return "OR" + Date.now().toString(36).toUpperCase().slice(-5) +
      Math.random().toString(36).toUpperCase().slice(2,4);
  }

  const DB = {
    mode: MODE, cloud: MODE==="cloud",

    /* ============ SẢN PHẨM ============ */
    // PERF: cache catalog 5 phút trong sessionStorage để chuyển trang sub-100ms.
    // Skip cache cho adminAll (admin muốn thấy thay đổi ngay). Invalidate khi
    // upsert/delete sản phẩm hoặc khi đặt đơn (stock thay đổi). Bumped khi đổi schema.
    _catalogCacheKey: "cache:products:v2",
    _catalogTTL: 5 * 60 * 1000,
    _catalogMemo: null,
    _invalidateCatalog(){
      this._catalogMemo = null;
      try{ sessionStorage.removeItem(this._catalogCacheKey); }catch(e){}
    },
    async listProducts({adminAll=false}={}){
      if(this.cloud){
        if(!adminAll){
          // 1) Hot path: in-memory memo trong cùng tab navigation
          if(this._catalogMemo && Date.now()-this._catalogMemo.ts < this._catalogTTL){
            return this._catalogMemo.data;
          }
          // 2) Warm path: sessionStorage (survive page reload trong cùng tab)
          try{
            const cached = sessionStorage.getItem(this._catalogCacheKey);
            if(cached){
              const {data, ts} = JSON.parse(cached);
              if(Date.now()-ts < this._catalogTTL){
                this._catalogMemo = {data, ts};
                return data;
              }
            }
          }catch(e){}
        }
        let q = supa.from("products").select("*").order("sort",{ascending:true}).order("created_at",{ascending:false});
        if(!adminAll) q = q.eq("active", true);
        const {data,error} = await q;
        if(error){ console.warn("listProducts", error.message); return []; }
        const mapped = (data||[]).map(mapProduct);
        if(!adminAll){
          const entry = {data: mapped, ts: Date.now()};
          this._catalogMemo = entry;
          try{ sessionStorage.setItem(this._catalogCacheKey, JSON.stringify(entry)); }catch(e){}
        }
        return mapped;
      }
      let arr = read(LS.products, null);
      if(!arr) arr = seedLocal();
      arr = arr.map(normalize).sort((a,b)=>(a.sort||0)-(b.sort||0));
      return adminAll ? arr : arr.filter(p=>p.active!==false);
    },
    async getProduct(id){
      if(this.cloud){
        // Tránh gọi DB với id không phải UUID (vd slug demo data) → Postgres
        // throw "invalid input syntax for type uuid" log noise.
        if(!isUUID(id)) return null;
        const {data} = await supa.from("products").select("*").eq("id",id).maybeSingle();
        return data? mapProduct(data) : null;
      }
      const arr = read(LS.products, []); const r = arr.find(p=>p.id===id);
      return r? normalize(r) : null;
    },
    async upsertProduct(p){
      if(this.cloud){
        const row = toRow(p);
        let {data,error} = await supa.from("products").upsert(row).select().single();
        // Fallback nếu DB chưa có 1 số column mới (migration chưa chạy)
        // Loại bỏ tuần tự từng column missing đến khi insert thành công.
        let attempt = { ...row };
        // Match cụ thể từng column thay vì loop mù: nếu err báo column khác, nhảy qua.
        const COLS_TO_TRY = ["color_images","images","sold","sold_real","likes"];
        let guard = 0;
        while(error && guard++ < COLS_TO_TRY.length){
          const msg = (error.message||"");
          const hit = COLS_TO_TRY.find(c=> new RegExp(`column[^a-z_]*"?${c}"?`,"i").test(msg) && (c in attempt));
          if(!hit) break;   // err không phải missing column → dừng, không loop mù
          delete attempt[hit];
          ({data,error} = await supa.from("products").upsert(attempt).select().single());
        }
        if(error) throw error;
        this._invalidateCatalog();
        return mapProduct(data);
      }
      const arr = read(LS.products, []);
      const norm = normalize(p);
      if(p.id){ const i=arr.findIndex(x=>x.id===p.id); if(i>=0) arr[i]={...arr[i],...norm}; else arr.push(norm); }
      else { norm.id = "loc-"+Date.now().toString(36); arr.push(norm); }
      write(LS.products, arr); return norm;
    },
    async deleteProduct(id){
      if(this.cloud){
        const {error}=await supa.from("products").delete().eq("id",id);
        if(error) throw error;
        this._invalidateCatalog();
        return;
      }
      write(LS.products, read(LS.products,[]).filter(p=>p.id!==id));
    },
    async seedDemo(){
      const demo = (window.STORE.PRODUCTS||[]);
      if(this.cloud){
        const rows = demo.map((p,i)=>{ const r=toRow(p); delete r.id; r.sort=i; return r; });
        const {error}=await supa.from("products").insert(rows); if(error) throw error;
        this._invalidateCatalog();
        return rows.length;
      }
      seedLocal(); return demo.length;
    },

    /* ============ DANH MỤC ============ */
    async listCategories(){
      if(this.cloud){
        const {data,error}=await supa.from("categories").select("*").order("sort",{ascending:true});
        if(error){ console.warn("listCategories",error.message); return []; }
        return (data||[]).filter(c=>c.active!==false);
      }
      let arr = read(LS.categories, null);
      if(!arr){ arr = (window.STORE.CATEGORIES||[]).map((c,i)=>({...c,sort:i,active:true})); write(LS.categories, arr); }
      return arr.filter(c=>c.active!==false).sort((a,b)=>(a.sort||0)-(b.sort||0));
    },
    async listCategoriesAll(){
      if(this.cloud){
        const {data,error}=await supa.from("categories").select("*").order("sort",{ascending:true});
        if(error){ console.warn("listCategoriesAll",error.message); return []; }
        return data||[];
      }
      let arr = read(LS.categories, null);
      if(!arr){ arr = (window.STORE.CATEGORIES||[]).map((c,i)=>({...c,sort:i,active:true})); write(LS.categories, arr); }
      return arr.slice().sort((a,b)=>(a.sort||0)-(b.sort||0));
    },
    async upsertCategory(cat){
      const row = { key:cat.key, name:cat.name, type:cat.type||"tee", sort:+cat.sort||0, active:cat.active!==false };
      if(this.cloud){
        const {data,error}=await supa.from("categories").upsert(row,{onConflict:"key"}).select().single();
        if(error) throw error; return data;
      }
      const arr = read(LS.categories, []);
      const i = arr.findIndex(c=>c.key===row.key);
      if(i>=0) arr[i]={...arr[i],...row}; else arr.push(row);
      write(LS.categories, arr); return row;
    },
    async deleteCategory(key){
      if(this.cloud){ const {error}=await supa.from("categories").delete().eq("key",key); if(error) throw error; return; }
      write(LS.categories, read(LS.categories,[]).filter(c=>c.key!==key));
    },

    /* ============ MÀU SẮC ============ */
    async listColors(){
      if(this.cloud){
        const {data,error}=await supa.from("colors").select("*").order("sort",{ascending:true});
        if(error){ console.warn("listColors",error.message); return []; }
        return (data||[]).filter(c=>c.active!==false);
      }
      let arr = read(LS.colors, null);
      if(!arr){ arr = (window.STORE.COLORS||[]).map(c=>({...c})); write(LS.colors, arr); }
      return arr.filter(c=>c.active!==false).sort((a,b)=>(a.sort||0)-(b.sort||0));
    },
    async listColorsAll(){
      if(this.cloud){
        const {data,error}=await supa.from("colors").select("*").order("sort",{ascending:true});
        if(error){ console.warn("listColorsAll",error.message); return []; }
        return data||[];
      }
      let arr = read(LS.colors, null);
      if(!arr){ arr = (window.STORE.COLORS||[]).map(c=>({...c})); write(LS.colors, arr); }
      return arr.slice().sort((a,b)=>(a.sort||0)-(b.sort||0));
    },
    async upsertColor(col){
      const row = { key:col.key, name:col.name, hex:col.hex, sort:+col.sort||0, active:col.active!==false };
      if(this.cloud){
        const {data,error}=await supa.from("colors").upsert(row,{onConflict:"key"}).select().single();
        if(error) throw error; return data;
      }
      const arr = read(LS.colors, []);
      const i = arr.findIndex(c=>c.key===row.key);
      if(i>=0) arr[i]={...arr[i],...row}; else arr.push(row);
      write(LS.colors, arr); return row;
    },
    async deleteColor(key){
      if(this.cloud){ const {error}=await supa.from("colors").delete().eq("key",key); if(error) throw error; return; }
      write(LS.colors, read(LS.colors,[]).filter(c=>c.key!==key));
    },

    /* ============ ĐỊA CHỈ ĐÃ LƯU (user_addresses) ============ */
    async listMyAddresses(){
      const user = await this.getUser(); if(!user) return [];
      if(this.cloud){
        const {data,error}=await supa.from("user_addresses").select("*").eq("user_id",user.id).order("is_default",{ascending:false}).order("created_at",{ascending:false});
        // Bảng chưa migrate (relation not exist) → trả mảng rỗng, không lỗi
        if(error){
          if(/relation.*user_addresses|user_addresses.*does not exist|42P01/i.test(error.message||"")){
            return [];
          }
          console.warn("listMyAddresses",error.message); return [];
        }
        return data||[];
      }
      const all = read("originals_user_addresses_v1",{});
      return (all[user.id]||[]).slice().sort((a,b)=> (b.is_default?1:0)-(a.is_default?1:0));
    },
    async upsertAddress(addr){
      const user = await this.getUser(); if(!user) throw new Error("Chưa đăng nhập");
      const row = {
        user_id:user.id,
        label:addr.label||"Nhà",
        recipient:addr.recipient||"", phone:addr.phone||"",
        province_code:addr.province_code||null, province_name:addr.province_name||null,
        district_code:addr.district_code||null, district_name:addr.district_name||null,
        ward_code:addr.ward_code||null,         ward_name:addr.ward_name||null,
        street:addr.street||"",
        is_default:!!addr.is_default,
      };
      if(addr.id) row.id = addr.id;
      if(this.cloud){
        const {data,error}=await supa.from("user_addresses").upsert(row).select().single();
        if(error) throw error; return data;
      }
      const all = read("originals_user_addresses_v1",{});
      const list = all[user.id] || (all[user.id]=[]);
      if(addr.id){
        const i = list.findIndex(x=>x.id===addr.id);
        if(i>=0) list[i] = {...list[i], ...row};
      } else {
        row.id = "addr-"+Date.now().toString(36);
        row.created_at = new Date().toISOString();
        // Nếu set default → bỏ default của các bản khác
        if(row.is_default) list.forEach(x=>x.is_default=false);
        list.push(row);
      }
      write("originals_user_addresses_v1", all);
      return row;
    },
    async deleteAddress(id){
      const user = await this.getUser(); if(!user) return;
      if(this.cloud){
        const {error}=await supa.from("user_addresses").delete().eq("id",id).eq("user_id",user.id);
        if(error) throw error; return;
      }
      const all = read("originals_user_addresses_v1",{});
      if(all[user.id]) all[user.id] = all[user.id].filter(x=>x.id!==id);
      write("originals_user_addresses_v1", all);
    },

    /* ============ SITE SETTINGS (key/value jsonb) ============ */
    async getSettings(key){
      if(this.cloud){
        const {data,error} = await supa.from("site_settings").select("value").eq("key",key).maybeSingle();
        if(error){ console.warn("getSettings",error.message); return null; }
        return data ? data.value : null;
      }
      const all = read(LS.settings, {});
      return all[key] ?? null;
    },
    async saveSettings(key, value){
      if(this.cloud){
        const {error} = await supa.from("site_settings").upsert({key, value}, {onConflict:"key"});
        if(error) throw error; return;
      }
      const all = read(LS.settings, {});
      all[key] = value;
      write(LS.settings, all);
    },

    /* ============ ẢNH ============
       Primary: Supabase Storage (URL lưu vào DB).
       Mirror:  Cloudinary (best-effort, không chặn admin). public_id được
                đặt = đúng path Supabase (bỏ đuôi) ➜ mirrorURL() derive lại
                được khi cần fallback, không phải lưu thêm cột.
    */
    async uploadImage(file){
      if(this.cloud){
        const path = Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
        const bucket = CFG.IMAGE_BUCKET||"product-images";
        const {error}=await supa.storage.from(bucket).upload(path,file,{upsert:true});
        if(error) throw error;
        const {data}=supa.storage.from(bucket).getPublicUrl(path);
        // mirror Cloudinary chạy ngầm — fail không chặn upload chính
        cloudinaryMirror(file, path).catch(e=>console.warn("[mirror] Cloudinary upload failed:", e?.message||e));
        return data.publicUrl;
      }
      return await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
    },

    /* ============ ĐƠN HÀNG ============ */
    // SECURITY: tất cả việc tính giá / trừ stock / consume voucher xảy ra
    // trong RPC `create_order` (security definer) — client KHÔNG được tin
    // để gửi subtotal/total/voucher_discount nữa. Xem migration-security-hardening.sql.
    async createOrder(o){
      if(this.cloud){
        // Filter: chỉ chấp nhận item có UUID id thật. Slug ID (từ demo data
        // data.js) sẽ làm RPC throw "invalid input syntax for type uuid".
        const allItems = o.items || [];
        const itemsIn = allItems
          .filter(it => isUUID(it.id))
          .map(it => ({
            id:    it.id,
            qty:   +it.qty || 0,
            color: it.color || null,
            size:  it.size  || null,
          }));
        if(itemsIn.length === 0){
          throw new Error("Giỏ hàng chứa sản phẩm không hợp lệ (demo data cũ?). Vui lòng xoá giỏ và chọn lại sản phẩm.");
        }
        if(itemsIn.length < allItems.length){
          console.warn("[Order] bỏ qua", allItems.length - itemsIn.length, "item không phải UUID (demo data?)");
        }
        const {data, error} = await supa.rpc("create_order", {
          p_items:         itemsIn,
          p_customer_name: o.customer_name || "",
          p_phone:         o.phone || "",
          p_email:         (o.email||"").trim().toLowerCase() || null,
          p_address:       o.address || "",
          p_note:          o.note || "",
          p_province_code: o.province_code || null,
          p_province_name: o.province_name || null,
          p_district_code: o.district_code || null,
          p_district_name: o.district_name || null,
          p_ward_code:     o.ward_code || null,
          p_ward_name:     o.ward_name || null,
          p_street:        o.street || null,
          p_shipping:      +o.shipping || 0,
          p_voucher_code:  o.voucher_code || null,
        });
        if(error) throw new Error(error.message || "Không tạo được đơn");
        if(!data) throw new Error("Không nhận được phản hồi từ server");
        this._invalidateCatalog();   // stock vừa đổi → bust cache cho trang sau
        // RPC trả jsonb = full row. Đảm bảo có id (= code) cho code cũ.
        return { ...data, id: data.id || data.code };
      }
      // ----- LOCAL DEMO MODE -----
      const code = genCode();
      const u = await this.getUser();
      const row = { code, status:"pending", customer_name:o.customer_name, phone:o.phone,
        email:(o.email||"").trim().toLowerCase()||null,
        address:o.address, note:o.note||"", items:o.items, subtotal:o.subtotal,
        shipping:o.shipping, total:o.total,
        province_code:o.province_code||null, province_name:o.province_name||null,
        district_code:o.district_code||null, district_name:o.district_name||null,
        ward_code:o.ward_code||null,         ward_name:o.ward_name||null,
        street:o.street||null,
        voucher_code: o.voucher_code||null, voucher_discount: o.voucher_discount||0,
        user_id: u?.id || null };
      const arr = read(LS.orders, []);
      const full = {...row, id:code, created_at:new Date().toISOString()};
      arr.push(full); write(LS.orders, arr);
      await this.adjustStock(o.items,-1);
      return full;
    },
    /* Liệt kê đơn của user đang đăng nhập (đồng bộ đa thiết bị qua Supabase) */
    async listMyOrders(){
      const user = await this.getUser();
      if(!user) return [];
      if(this.cloud){
        const {data,error}=await supa.from("orders").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
        if(error){ console.warn("listMyOrders",error.message); return []; }
        return data||[];
      }
      const arr=read(LS.orders,[]).slice().sort((a,b)=>(a.created_at<b.created_at?1:-1));
      return arr.filter(o=>o.user_id===user.id);
    },
    // SECURITY: khách ẩn danh phải cung cấp 4 số cuối SĐT để xem đơn,
    // tránh brute-force order code rồi đọc thông tin PII (tên, đ.thoại, đ.chỉ).
    // Khách đã login đọc được đơn của mình mà không cần phone.
    async getOrderByCode(code, phoneTail){
      code = (code||"").trim().toUpperCase();
      if(this.cloud){
        const tail = (phoneTail||"").replace(/\D/g,"").slice(-4);
        const {data,error}=await supa.rpc("get_order_by_code",{p_code:code, p_phone_tail: tail || null});
        if(error){ console.warn(error.message); return null; }
        return (data&&data[0])||null;
      }
      return read(LS.orders, []).find(o=>o.code===code)||null;
    },
    /* Timeline GHN của 1 đơn (public, không cần login — dùng RPC security definer). */
    async getTracking(code){
      code = (code||"").trim().toUpperCase();
      if(!this.cloud) return [];
      const {data,error}=await supa.rpc("get_tracking_by_code",{p_code:code});
      if(error){ console.warn("getTracking", error.message); return []; }
      return data||[];
    },

    /* ============ VOUCHERS ============ */
    /* Khách check mã giảm giá. Trả object {valid, message, discount, code, type, voucher_id}. */
    async checkVoucher(code, subtotal){
      if(!this.cloud){
        // Local demo — chấp nhận mọi mã, giảm 10%
        const d = Math.floor((subtotal||0) * 0.1);
        return { valid:true, message:"Demo: giảm 10%", code:(code||"").toUpperCase(), type:"percent", discount:d };
      }
      const {data,error}=await supa.rpc("check_voucher",{ p_code:code, p_subtotal:subtotal });
      if(error){ return { valid:false, message: error.message }; }
      return data || { valid:false, message:"Lỗi không xác định" };
    },
    async consumeVoucher(code){
      if(!this.cloud) return;
      try{ await supa.rpc("consume_voucher",{ p_code:code }); }
      catch(e){ console.warn("consumeVoucher", e.message); }
    },
    /* Admin CRUD vouchers */
    async listVouchers(){
      if(!this.cloud) return [];
      const {data,error}=await supa.from("vouchers").select("*").order("created_at",{ascending:false});
      if(error){ console.warn("listVouchers", error.message); return []; }
      return data||[];
    },
    async saveVoucher(v){
      if(!this.cloud) return;
      const row = {
        code: (v.code||"").trim().toUpperCase(),
        description: v.description||"",
        discount_type: v.discount_type,
        discount_value: +v.discount_value||0,
        min_order: +v.min_order||0,
        max_discount: v.max_discount?+v.max_discount:null,
        max_uses: v.max_uses?+v.max_uses:null,
        starts_at: v.starts_at||null,
        expires_at: v.expires_at||null,
        active: v.active!==false,
      };
      if(v.id){
        const {data,error}=await supa.from("vouchers").update(row).eq("id",v.id).select().single();
        if(error) throw error; return data;
      }
      const {data,error}=await supa.from("vouchers").insert(row).select().single();
      if(error) throw error; return data;
    },
    async deleteVoucher(id){
      if(!this.cloud) return;
      const {error}=await supa.from("vouchers").delete().eq("id",id);
      if(error) throw error;
    },
    async listOrders({status=""}={}){
      if(this.cloud){
        let q=supa.from("orders").select("*").order("created_at",{ascending:false});
        if(status) q=q.eq("status",status);
        const {data,error}=await q; if(error){ console.warn(error.message); return []; }
        return data||[];
      }
      let arr = read(LS.orders, []).slice().sort((a,b)=> (a.created_at<b.created_at?1:-1));
      return status? arr.filter(o=>o.status===status) : arr;
    },
    async updateOrderStatus(id, status){
      if(this.cloud){ const {error}=await supa.from("orders").update({status}).eq("id",id); if(error) throw error; return; }
      const arr=read(LS.orders,[]); const o=arr.find(x=>x.id===id||x.code===id); if(o){o.status=status; write(LS.orders,arr);}
    },
    async adjustStock(items, dir){
      try{
        if(this.cloud){
          // RPC atomic: tránh race khi 2 khách cùng mua tồn cuối (xem migration-stock-rpc.sql)
          const payload = (items||[]).map(it=>({id:it.id, qty:+it.qty||0}));
          const {error} = await supa.rpc("apply_stock_delta",{items:payload, dir});
          if(error){
            // Fallback (chưa chạy migration): read-modify-write từng SP. KHÔNG atomic.
            console.warn("apply_stock_delta missing → fallback (race-prone):", error.message);
            for(const it of items){
              const {data}=await supa.from("products").select("stock").eq("id",it.id).maybeSingle();
              if(data) await supa.from("products").update({stock:Math.max(0,(data.stock||0)+dir*it.qty)}).eq("id",it.id);
            }
          }
          this._invalidateCatalog();
        } else {
          const arr=read(LS.products,[]);
          items.forEach(it=>{ const p=arr.find(x=>x.id===it.id); if(p) p.stock=Math.max(0,(p.stock||0)+dir*it.qty); });
          write(LS.products,arr);
        }
      }catch(e){ console.warn("adjustStock",e.message); }
    },

    /* ============ ĐĂNG NHẬP ADMIN ============ */
    // SECURITY: trước đây client gọi list_admin_emails() → trả về toàn bộ
    // danh sách admin email (public) → attacker biết target để phishing.
    // Giờ dùng RPC am_i_admin() chỉ trả về true/false cho user hiện tại.
    // CONFIG.ADMIN_EMAILS chỉ còn dùng làm fallback ở chế độ local demo.
    _amAdminCache: null,        // null = chưa biết, true/false = đã check
    _amAdminPromise: null,      // chống gọi RPC song song
    async isAdminAsync(user){
      if(!user) return false;
      if(!this.cloud){
        return (CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase())
          .includes((user.email||"").toLowerCase());
      }
      if(this._amAdminCache !== null) return this._amAdminCache;
      if(this._amAdminPromise) return this._amAdminPromise;
      this._amAdminPromise = (async()=>{
        try{
          const {data, error} = await supa.rpc("am_i_admin");
          if(error){
            console.warn("am_i_admin error:", error.message);
            // Fallback: nếu RPC chưa được deploy, dùng CONFIG.ADMIN_EMAILS
            return (CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase())
              .includes((user.email||"").toLowerCase());
          }
          return !!data;
        }catch(e){ return false; }
      })();
      this._amAdminCache = await this._amAdminPromise;
      this._amAdminPromise = null;
      return this._amAdminCache;
    },
    // Sync wrapper giữ tương thích: chỉ dùng được sau khi isAdminAsync đã chạy.
    isAdmin(user){
      if(!user) return false;
      if(this._amAdminCache !== null) return this._amAdminCache;
      // Chưa có cache → fallback CONFIG (tránh false positive khi cache miss
      // ở lần đầu render; component nên gọi isAdminAsync trước).
      return (CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase())
        .includes((user.email||"").toLowerCase());
    },
    async getUser(){
      if(this.cloud){
        // getSession() đảm bảo SDK đã parse xong token từ URL hash (OAuth callback)
        // trước khi đọc user. Nếu chỉ gọi getUser() khi callback chưa xử lý xong,
        // ta sẽ thấy null và khách bị coi như chưa đăng nhập tới khi onAuthStateChange bắn.
        try{ await supa.auth.getSession(); }catch(e){}
        const {data}=await supa.auth.getUser();
        return data.user||null;
      }
      return read(LS.admin, null);
    },
    onAuth(cb){
      if(this.cloud){
        supa.auth.getUser().then(({data})=>cb(data.user||null));
        supa.auth.onAuthStateChange((_e,s)=>{
          this._amAdminCache = null;   // user đổi → invalidate admin cache
          cb(s?.user||null);
        });
      } else { cb(read(LS.admin,null)); }
    },
    async signInGoogle({asAdmin=false}={}){
      if(this.cloud){
        return supa.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href.split("#")[0]}});
      }
      // chế độ demo: giả lập đăng nhập Google (admin nếu asAdmin, ngược lại là khách)
      const u = asAdmin
        ? { id:"demo-admin", email:(CFG.ADMIN_EMAILS||["admin@demo"])[0], name:"Demo Admin", demo:true }
        : { id:"demo-customer", email:"khach@demo.com", name:"Khách Demo", demo:true };
      write(LS.admin,u); return u;
    },
    async signInPassword(email, password){
      email=(email||"").trim();
      if(this.cloud){
        const {data,error}=await supa.auth.signInWithPassword({email,password});
        if(error) throw error;
        return data.user;
      }
      // chế độ demo: chấp nhận nếu email nằm trong danh sách admin
      if((CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase()).includes(email.toLowerCase())){
        const u={email, name:"Admin"}; write(LS.admin,u); return u;
      }
      throw new Error("Email không có quyền admin (chế độ demo)");
    },
    async signOut(){
      this._amAdminCache = null;       // clear admin cache khi đổi user
      if(this.cloud){ await supa.auth.signOut(); return; }
      localStorage.removeItem(LS.admin);
    },
  };

  window.DB = DB;

  /* ============ MIRROR ẢNH (Cloudinary) ============
     URL chính (Supabase) lưu trong DB. URL mirror được DERIVE từ URL chính
     theo công thức cố định, không cần lưu cột thứ 2:
       Supabase  : https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
       Cloudinary: https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/<path-bỏ-đuôi>
  */
  async function cloudinaryMirror(file, supabasePath){
    const cn = CFG.CLOUDINARY_CLOUD_NAME, up = CFG.CLOUDINARY_UPLOAD_PRESET;
    if(!cn || !up) return;        // chưa cấu hình → bỏ qua, app chạy như cũ
    const publicId = supabasePath.replace(/\.[^.]+$/, "");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", up);
    fd.append("public_id", publicId);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cn)}/image/upload`, {method:"POST", body:fd});
    if(!r.ok) throw new Error("Cloudinary HTTP " + r.status);
  }

  function mirrorURL(url){
    if(!url || typeof url !== "string") return null;
    const cn = CFG.CLOUDINARY_CLOUD_NAME;
    if(!cn) return null;
    const bucket = CFG.IMAGE_BUCKET || "product-images";
    // bắt path sau /public/<bucket>/
    const marker = "/storage/v1/object/public/" + bucket + "/";
    const i = url.indexOf(marker);
    if(i < 0) return null;
    const path = url.slice(i + marker.length).split("?")[0];
    if(!path) return null;
    const publicId = path.replace(/\.[^.]+$/, "");
    return `https://res.cloudinary.com/${encodeURIComponent(cn)}/image/upload/f_auto,q_auto/${publicId}`;
  }

  // expose để admin/app gọi nếu cần
  if(window.STORE) window.STORE.mirrorURL = mirrorURL;

  /* ---- AUTO-FALLBACK ----
     Bắt sự kiện "error" ở capture phase: img nào load lỗi & src thuộc
     Supabase storage thì tự đổi sang URL Cloudinary. data-mirrored để tránh
     loop nếu mirror cũng lỗi (lúc đó để SVG/alt hiển thị bình thường). */
  document.addEventListener("error", function(e){
    const el = e.target;
    if(!el || el.tagName !== "IMG") return;
    if(el.dataset.mirrored) return;
    const m = mirrorURL(el.src);
    if(m && m !== el.src){
      el.dataset.mirrored = "1";
      el.src = m;
    }
  }, true);
})();
