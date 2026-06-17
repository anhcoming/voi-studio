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

  const LS = { products:"originals_products_v1", orders:"originals_orders_v1", admin:"originals_admin_v1" };
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

  /* ---- map giữa DB row và product dùng ở giao diện ---- */
  function mapProduct(row){
    const cat = (window.STORE.CATEGORIES||[]).find(c=>c.key===row.cat_key) || {name:row.cat_key||"", type:"tee"};
    const images = normImages(row);
    return {
      id: row.id, catKey: row.cat_key, type: cat.type, catName: cat.name,
      collection: row.collection||"", name: row.name, shortName: row.print||row.name,
      print: row.print||row.name, price: +row.price||0, compare: +row.compare||0,
      colors: row.colors||[], sizes: row.sizes||["S","M","L","XL"],
      stock: row.stock==null?0:+row.stock,
      sold: row.sold==null?0:+row.sold,
      likes: row.likes==null?0:+row.likes,
      images, image_url: images[0] || null,
      active: row.active!==false, sort: +row.sort||0,
      sale: (+row.compare||0) > (+row.price||0),
    };
  }
  function toRow(p){
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : normImages(p);
    const r = {
      name:p.name, print:p.print||p.shortName||p.name, cat_key:p.catKey,
      collection:p.collection||"", price:+p.price||0, compare:+p.compare||0,
      colors:p.colors||[], sizes:p.sizes||["S","M","L","XL"],
      stock:p.stock==null?0:+p.stock,
      sold:p.sold==null?0:+p.sold,
      likes:p.likes==null?0:+p.likes,
      images, image_url: images[0] || null,
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
    return { ...row, type:row.type||cat.type, catName:row.catName||cat.name,
      colors:row.colors||[], sizes:row.sizes||["S","M","L","XL"],
      stock: row.stock==null?0:+row.stock,
      sold: row.sold==null?0:+row.sold,
      likes: row.likes==null?0:+row.likes,
      images, image_url: images[0] || row.image_url || null,
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
    async listProducts({adminAll=false}={}){
      if(this.cloud){
        let q = supa.from("products").select("*").order("sort",{ascending:true}).order("created_at",{ascending:false});
        if(!adminAll) q = q.eq("active", true);
        const {data,error} = await q;
        if(error){ console.warn("listProducts", error.message); return []; }
        return (data||[]).map(mapProduct);
      }
      let arr = read(LS.products, null);
      if(!arr) arr = seedLocal();
      arr = arr.map(normalize).sort((a,b)=>(a.sort||0)-(b.sort||0));
      return adminAll ? arr : arr.filter(p=>p.active!==false);
    },
    async getProduct(id){
      if(this.cloud){
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
        for(const col of ["images","sold","likes"]){
          if(error && new RegExp(`column.*${col}`,"i").test(error.message||"")){
            delete attempt[col];
            ({data,error} = await supa.from("products").upsert(attempt).select().single());
          }
        }
        if(error) throw error; return mapProduct(data);
      }
      const arr = read(LS.products, []);
      const norm = normalize(p);
      if(p.id){ const i=arr.findIndex(x=>x.id===p.id); if(i>=0) arr[i]={...arr[i],...norm}; else arr.push(norm); }
      else { norm.id = "loc-"+Date.now().toString(36); arr.push(norm); }
      write(LS.products, arr); return norm;
    },
    async deleteProduct(id){
      if(this.cloud){ const {error}=await supa.from("products").delete().eq("id",id); if(error) throw error; return; }
      write(LS.products, read(LS.products,[]).filter(p=>p.id!==id));
    },
    async seedDemo(){
      const demo = (window.STORE.PRODUCTS||[]);
      if(this.cloud){
        const rows = demo.map((p,i)=>{ const r=toRow(p); delete r.id; r.sort=i; return r; });
        const {error}=await supa.from("products").insert(rows); if(error) throw error;
        return rows.length;
      }
      seedLocal(); return demo.length;
    },

    /* ============ ẢNH ============ */
    async uploadImage(file){
      if(this.cloud){
        const path = Date.now()+"-"+file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_");
        const {error}=await supa.storage.from(CFG.IMAGE_BUCKET||"product-images").upload(path,file,{upsert:true});
        if(error) throw error;
        const {data}=supa.storage.from(CFG.IMAGE_BUCKET||"product-images").getPublicUrl(path);
        return data.publicUrl;
      }
      return await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
    },

    /* ============ ĐƠN HÀNG ============ */
    async createOrder(o){
      const code = genCode();
      const user = await this.getUser();
      const row = { code, status:"pending", customer_name:o.customer_name, phone:o.phone,
        address:o.address, note:o.note||"", items:o.items, subtotal:o.subtotal,
        shipping:o.shipping, total:o.total, user_id: user?.id || null };
      if(this.cloud){
        const {data,error}=await supa.from("orders").insert(row).select().single();
        if(error) throw error;
        await this.adjustStock(o.items,-1);
        return data;
      }
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
    async getOrderByCode(code){
      code = (code||"").trim().toUpperCase();
      if(this.cloud){
        const {data,error}=await supa.rpc("get_order_by_code",{p_code:code});
        if(error){ console.warn(error.message); return null; }
        return (data&&data[0])||null;
      }
      return read(LS.orders, []).find(o=>o.code===code)||null;
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
          for(const it of items){
            const {data}=await supa.from("products").select("stock").eq("id",it.id).maybeSingle();
            if(data) await supa.from("products").update({stock:Math.max(0,(data.stock||0)+dir*it.qty)}).eq("id",it.id);
          }
        } else {
          const arr=read(LS.products,[]);
          items.forEach(it=>{ const p=arr.find(x=>x.id===it.id); if(p) p.stock=Math.max(0,(p.stock||0)+dir*it.qty); });
          write(LS.products,arr);
        }
      }catch(e){ console.warn("adjustStock",e.message); }
    },

    /* ============ ĐĂNG NHẬP ADMIN ============ */
    isAdmin(user){ return !!user && (CFG.ADMIN_EMAILS||[]).map(e=>e.toLowerCase()).includes((user.email||"").toLowerCase()); },
    async getUser(){
      if(this.cloud){ const {data}=await supa.auth.getUser(); return data.user||null; }
      return read(LS.admin, null);
    },
    onAuth(cb){
      if(this.cloud){
        supa.auth.getUser().then(({data})=>cb(data.user||null));
        supa.auth.onAuthStateChange((_e,s)=>cb(s?.user||null));
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
      if(this.cloud){ await supa.auth.signOut(); return; }
      localStorage.removeItem(LS.admin);
    },
  };

  window.DB = DB;
})();
