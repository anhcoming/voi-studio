/* =========================================================
   GHN CLIENT — wrapper gọi Supabase Edge Function `ghn-proxy`.
   ---------------------------------------------------------
   • Frontend KHÔNG bao giờ thấy token GHN — token nằm trong
     secrets của Supabase (xem supabase/functions/ghn-proxy).
   • Tự tắt nếu chưa cấu hình (CONFIG.SUPABASE_URL trống) —
     khi đó cart fallback về phí ship flat 30k như cũ.
   • Có cache 5 phút cho fee theo (province|district|ward) để
     không spam API khi user gõ.
   ========================================================= */
(function(){
  const CFG = window.CONFIG || {};
  const URL = CFG.SUPABASE_URL ? `${CFG.SUPABASE_URL}/functions/v1/ghn-proxy` : "";
  const KEY = CFG.SUPABASE_ANON_KEY || "";
  const enabled = !!(URL && KEY);

  /* Phải đợi auth client init xong rồi mới lấy token được. Truyền cờ
     `auth=true` ➜ gắn Bearer của user hiện tại (cho action admin). */
  async function bearer(){
    try{
      if(window.DB && window.DB.cloud && window.supabase){
        const supa = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
        const { data } = await supa.auth.getSession();
        return data?.session?.access_token || KEY;
      }
    }catch(e){}
    return KEY;
  }

  const _feeCache = new Map();   // key = JSON address → {at, val}
  const FEE_TTL = 5 * 60 * 1000;

  async function call(action, params={}, { auth=false } = {}){
    if(!enabled) throw new Error("GHN chưa được cấu hình (thiếu SUPABASE_URL)");
    const token = auth ? await bearer() : KEY;
    const r = await fetch(URL, {
      method:"POST",
      headers: {
        "content-type":"application/json",
        "authorization": `Bearer ${token}`,
        "apikey": KEY,
      },
      body: JSON.stringify({ action, ...params }),
    });
    const j = await r.json().catch(()=>({ok:false, error:"Phản hồi không phải JSON"}));
    if(!j.ok) throw new Error(j.error || `GHN HTTP ${r.status}`);
    return j.data;
  }

  const GHN = {
    enabled,

    /* Tính phí ship theo địa chỉ. Trả {total, service_fee, ...} hoặc throw.
       Có cache nhẹ để gõ liên tục không spam. */
    async fee({ province_name, district_name, ward_name, weight, insurance_value }){
      if(!province_name || !district_name || !ward_name){
        throw new Error("Cần đủ Tỉnh + Quận/Huyện + Phường/Xã");
      }
      const k = JSON.stringify({ province_name, district_name, ward_name, weight, insurance_value });
      const hit = _feeCache.get(k);
      if(hit && (Date.now() - hit.at) < FEE_TTL) return hit.val;
      const val = await call("fee", {
        to_province_name: province_name,
        to_district_name: district_name,
        to_ward_name:     ward_name,
        weight, insurance_value,
      });
      _feeCache.set(k, { at: Date.now(), val });
      return val;
    },

    /* Push 1 đơn (theo code nội bộ) lên GHN. Chỉ admin. */
    async createOrder(orderCode, opts={}){
      return await call("create", { order_code: orderCode, ...opts }, { auth: true });
    },

    /* Lấy chi tiết + cập nhật status mới nhất từ GHN (admin). */
    async track(orderCode){
      return await call("track", { order_code: orderCode }, { auth: true });
    },

    /* Huỷ vận đơn GHN (admin). */
    async cancel(orderCode){
      return await call("cancel", { order_code: orderCode }, { auth: true });
    },

    /* Master data — admin dùng khi setup shop origin. */
    async master(type, params={}){
      return await call("master", { type, ...params });
    },
  };

  window.GHN = GHN;
})();
