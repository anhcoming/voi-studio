// =========================================================
// Supabase Edge Function: ghn-proxy
// Proxy bảo mật cho GHN API. Token GHN ở server (secrets),
// frontend KHÔNG bao giờ thấy token.
//
// Deploy:
//   supabase functions deploy ghn-proxy --no-verify-jwt
//   supabase secrets set GHN_TOKEN=xxx GHN_SHOP_ID=12345 \
//                        GHN_ENV=prod   # hoặc "dev" để dùng sandbox
//
// Các action (POST body: { action, ...params }):
//   - "fee"        : tính phí ship
//   - "create"     : tạo đơn (admin gọi)
//   - "track"      : query trạng thái 1 đơn
//   - "cancel"     : huỷ đơn
//   - "master"     : list province/district/ward GHN (cho admin map)
//   - "resolve"    : tự động map tên VN ➜ GHN IDs (có cache)
// =========================================================
// @ts-ignore - Deno runtime URL import
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const GHN_TOKEN   = Deno.env.get("GHN_TOKEN")   || "";
const GHN_SHOP_ID = Deno.env.get("GHN_SHOP_ID") || "";
const GHN_ENV     = (Deno.env.get("GHN_ENV") || "prod").toLowerCase();
const SUPA_URL    = Deno.env.get("SUPABASE_URL") || "";
const SUPA_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GHN_BASE = GHN_ENV === "dev"
  ? "https://dev-online-gateway.ghn.vn/shiip/public-api"
  : "https://online-gateway.ghn.vn/shiip/public-api";

const CORS = {
  "access-control-allow-origin":  "*",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

// ---------- helper: gọi GHN ----------
type GhnResp = {
  code?: number;
  message?: string;
  code_message_value?: string;
  data?: any;
  raw?: string;
};

async function ghn(path: string, body: unknown, withShopId = true): Promise<any> {
  if (!GHN_TOKEN) throw new Error("GHN_TOKEN secret chưa được set");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Token": GHN_TOKEN,
  };
  if (withShopId && GHN_SHOP_ID) headers["ShopId"] = GHN_SHOP_ID;
  const r = await fetch(`${GHN_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let data: GhnResp;
  try { data = JSON.parse(text) as GhnResp; } catch { data = { raw: text }; }
  if (!r.ok || data.code !== 200) {
    // GHN trả 200 HTTP nhưng code != 200 khi sai input
    throw new Error(data.message || data.code_message_value || `GHN HTTP ${r.status}`);
  }
  return data.data;
}

// ---------- chuẩn hoá tên tỉnh/quận/xã để match cache ----------
function norm(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // bỏ dấu
    .replace(/^(tinh|thanh pho|tp\.?|tp |quan|huyen|thi xa|phuong|xa|thi tran)\s+/i, "")
    .replace(/\s+/g, " ").trim();
}

// ---------- resolve: VN names → GHN IDs (có cache trong DB) ----------
async function resolveAddress(
  supa: SupabaseClient,
  province_name: string,
  district_name?: string,
  ward_name?: string,
) {
  const p = norm(province_name);
  const d = district_name ? norm(district_name) : null;
  const w = ward_name ? norm(ward_name) : null;

  // 1) Hit cache
  let q: any = supa.from("ghn_address_map").select("*")
    .eq("province_name", p);
  q = d ? q.eq("district_name", d) : q.is("district_name", null);
  q = w ? q.eq("ward_name", w)     : q.is("ward_name", null);
  const cached = await q.maybeSingle();
  if (cached.data) return cached.data;

  // 2) Resolve từ GHN
  const provinces = await ghn("/master-data/province", {}, false);
  const provMatch = provinces.find((x: any) =>
    norm(x.ProvinceName) === p ||
    (x.NameExtension || []).some((n: string) => norm(n) === p)
  );
  if (!provMatch) throw new Error(`Không map được Tỉnh: ${province_name}`);
  const ghn_province_id = provMatch.ProvinceID;

  let ghn_district_id: number | null = null, ghn_ward_code: string | null = null;
  if (d) {
    const districts = await ghn("/master-data/district", { province_id: ghn_province_id }, false);
    const dm = districts.find((x: any) =>
      norm(x.DistrictName) === d ||
      (x.NameExtension || []).some((n: string) => norm(n) === d)
    );
    if (!dm) throw new Error(`Không map được Quận/Huyện: ${district_name}`);
    ghn_district_id = dm.DistrictID;

    if (w) {
      const wards = await ghn("/master-data/ward", { district_id: ghn_district_id }, false);
      const wm = wards.find((x: any) =>
        norm(x.WardName) === w ||
        (x.NameExtension || []).some((n: string) => norm(n) === w)
      );
      if (!wm) throw new Error(`Không map được Phường/Xã: ${ward_name}`);
      ghn_ward_code = wm.WardCode;
    }
  }

  // 3) Lưu cache (best-effort)
  const row = {
    province_name: p, district_name: d, ward_name: w,
    ghn_province_id, ghn_district_id, ghn_ward_code,
    updated_at: new Date().toISOString(),
  };
  await supa.from("ghn_address_map").upsert(row).then(() => {}, () => {});
  return row;
}

// ---------- action handlers ----------
async function handleFee(supa: SupabaseClient, p: any) {
  // Input: { to_province_name, to_district_name, to_ward_name, weight, length, width, height,
  //          from_district_id, service_type_id, insurance_value }
  const dst = await resolveAddress(supa, p.to_province_name, p.to_district_name, p.to_ward_name);
  if (!dst.ghn_district_id || !dst.ghn_ward_code) {
    throw new Error("Cần đủ Tỉnh + Quận/Huyện + Phường/Xã để tính phí GHN");
  }
  const cfg = await getShopCfg(supa);
  const data = await ghn("/v2/shipping-order/fee", {
    from_district_id: p.from_district_id || cfg.from_district_id,
    from_ward_code:   p.from_ward_code   || cfg.from_ward_code,
    service_type_id:  p.service_type_id  || cfg.service_type_id || 2,
    to_district_id:   dst.ghn_district_id,
    to_ward_code:     dst.ghn_ward_code,
    weight:           p.weight || cfg.default_weight || 300,
    length:           p.length || cfg.default_length || 25,
    width:            p.width  || cfg.default_width  || 20,
    height:           p.height || cfg.default_height || 5,
    insurance_value:  p.insurance_value || 0,
  });
  return { total: data.total, service_fee: data.service_fee, insurance_fee: data.insurance_fee, resolved: dst };
}

async function handleCreate(supa: SupabaseClient, p: any) {
  // Input: { order_code } — load đơn từ DB rồi push lên GHN.
  const code = String(p.order_code || "").toUpperCase().trim();
  if (!code) throw new Error("Thiếu order_code");
  const { data: o, error } = await supa.from("orders").select("*").eq("code", code).maybeSingle();
  if (error || !o) throw new Error("Không tìm thấy đơn " + code);
  if (o.ghn_order_code) throw new Error(`Đơn ${code} đã có mã GHN: ${o.ghn_order_code}`);

  const dst = await resolveAddress(supa, o.province_name, o.district_name, o.ward_name);
  if (!dst.ghn_district_id || !dst.ghn_ward_code) {
    throw new Error("Địa chỉ đơn không đủ Tỉnh/Huyện/Xã để gửi GHN");
  }
  const cfg = await getShopCfg(supa);

  const items = (o.items || []).map((it: any) => ({
    name:     it.name,
    code:     it.id,
    quantity: it.qty,
    price:    it.price,
    weight:   p.item_weight || 200,
  }));

  const payload = {
    payment_type_id:  cfg.payment_type_id || 2,        // 1=shop trả, 2=người nhận trả
    note:             o.note || "",
    required_note:    cfg.required_note || "KHONGCHOXEMHANG",
    from_name:        cfg.from_name,
    from_phone:       cfg.from_phone,
    from_address:     cfg.from_address,
    from_ward_name:   cfg.from_ward_name  || "",
    from_district_name: cfg.from_district_name || "",
    from_province_name: cfg.from_province_name || "",
    to_name:          o.customer_name,
    to_phone:         o.phone,
    to_address:       o.address,
    to_ward_code:     dst.ghn_ward_code,
    to_district_id:   dst.ghn_district_id,
    cod_amount:       p.cod_amount ?? (o.total || 0),  // COD = tổng đơn
    weight:           p.weight || cfg.default_weight || 300,
    length:           p.length || cfg.default_length || 25,
    width:            p.width  || cfg.default_width  || 20,
    height:           p.height || cfg.default_height || 5,
    service_type_id:  p.service_type_id || cfg.service_type_id || 2,
    items,
    client_order_code: code,
  };

  const data = await ghn("/v2/shipping-order/create", payload);

  // Lưu kết quả vào DB
  await supa.from("orders").update({
    ghn_order_code:  data.order_code,
    ghn_fee:         data.total_fee,
    ghn_expected_at: data.expected_delivery_time,
    ghn_status:      "ready_to_pick",
    ghn_status_at:   new Date().toISOString(),
    ghn_payload:     payload,
    ghn_response:    data,
    status:          "shipping",     // đồng bộ trạng thái nội bộ
  }).eq("code", code);

  // Thêm event đầu tiên
  await supa.from("ghn_tracking_events").insert({
    order_code: code, ghn_order_code: data.order_code,
    status: "ready_to_pick", status_name: "Chờ lấy hàng",
    description: "Đã tạo vận đơn GHN", raw: data,
  });
  return data;
}

async function handleTrack(supa: SupabaseClient, p: any) {
  // Input: { order_code } (nội bộ) hoặc { ghn_order_code } (mã vận đơn)
  let ghnCode = p.ghn_order_code;
  if (!ghnCode && p.order_code) {
    const r = await supa.from("orders").select("ghn_order_code")
      .eq("code", String(p.order_code).toUpperCase().trim()).maybeSingle();
    ghnCode = r.data?.ghn_order_code;
  }
  if (!ghnCode) throw new Error("Chưa có mã vận đơn GHN");
  const data = await ghn("/v2/shipping-order/detail", { order_code: ghnCode });

  // Lưu status mới nhất + push event nếu khác status trước
  if (p.order_code) {
    const code = String(p.order_code).toUpperCase().trim();
    await supa.from("orders").update({
      ghn_status: data.status, ghn_status_at: new Date().toISOString(),
      ghn_response: data,
    }).eq("code", code);
    // Chỉ thêm event nếu status thay đổi (tránh duplicate)
    const last = await supa.from("ghn_tracking_events").select("status")
      .eq("order_code", code).order("event_at", { ascending: false }).limit(1).maybeSingle();
    if (!last.data || last.data.status !== data.status) {
      await supa.from("ghn_tracking_events").insert({
        order_code: code, ghn_order_code: ghnCode,
        status: data.status, status_name: statusName(data.status),
        description: data.log?.[0]?.status || "", raw: data,
      });
    }
  }
  return data;
}

async function handleCancel(supa: SupabaseClient, p: any) {
  let ghnCode = p.ghn_order_code;
  if (!ghnCode && p.order_code) {
    const r = await supa.from("orders").select("ghn_order_code")
      .eq("code", String(p.order_code).toUpperCase().trim()).maybeSingle();
    ghnCode = r.data?.ghn_order_code;
  }
  if (!ghnCode) throw new Error("Chưa có mã vận đơn GHN");
  const data = await ghn("/v2/switch-status/cancel", { order_codes: [ghnCode] });
  if (p.order_code) {
    await supa.from("orders").update({
      ghn_status: "cancel", ghn_status_at: new Date().toISOString(), status: "cancelled",
    }).eq("code", String(p.order_code).toUpperCase().trim());
  }
  return data;
}

async function handleMaster(_supa: SupabaseClient, p: any) {
  // type=province | district (cần province_id) | ward (cần district_id)
  if (p.type === "province") return await ghn("/master-data/province", {}, false);
  if (p.type === "district") return await ghn("/master-data/district", { province_id: p.province_id }, false);
  if (p.type === "ward")     return await ghn("/master-data/ward",     { district_id: p.district_id }, false);
  throw new Error("type phải là province|district|ward");
}

async function getShopCfg(supa: SupabaseClient) {
  const r = await supa.from("site_settings").select("value").eq("key", "ghn_config").maybeSingle();
  return r.data?.value || {};
}

function statusName(s: string): string {
  const map: Record<string, string> = {
    ready_to_pick: "Chờ lấy hàng",
    picking:       "Đang lấy hàng",
    picked:        "Đã lấy hàng",
    storing:       "Đang ở kho",
    transporting:  "Đang vận chuyển",
    sorting:       "Đang phân loại",
    delivering:    "Đang giao hàng",
    delivered:     "Giao thành công",
    delivery_fail: "Giao thất bại",
    cancel:        "Đã huỷ",
    return:        "Trả hàng",
    returned:      "Đã trả hàng",
  };
  return map[s] || s;
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    if (!action) return json({ error: "Thiếu action" }, 400);

    // Service-role client để bỏ qua RLS (đã xác thực qua action)
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

    // Một số action chỉ admin mới được gọi — verify bằng JWT của caller.
    // Verify trực tiếp với JWT (không rely vào session storage của SDK) +
    // check email trong bảng admin_emails qua service-role (không cần auth.jwt()
    // bên SQL — tránh phụ thuộc cách Supabase inject ANON_KEY ở key-system mới).
    const adminActions = new Set(["create", "cancel"]);
    if (adminActions.has(action)) {
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) return json({ error: "Cần đăng nhập admin" }, 401);
      const u = await supa.auth.getUser(jwt);
      const email = (u.data?.user?.email || "").toLowerCase();
      if (!email) return json({ error: "Token không hợp lệ hoặc đã hết hạn" }, 401);
      const inTable = await supa.from("admin_emails").select("email").eq("email", email).maybeSingle();
      const bootstrap = !inTable.data && email === "anhcoming@gmail.com";
      if (!inTable.data && !bootstrap) {
        return json({ error: `Email ${email} không có quyền admin (chưa trong bảng admin_emails)` }, 403);
      }
    }

    let data;
    switch (action) {
      case "fee":     data = await handleFee(supa, body);    break;
      case "create":  data = await handleCreate(supa, body); break;
      case "track":   data = await handleTrack(supa, body);  break;
      case "cancel":  data = await handleCancel(supa, body); break;
      case "master":  data = await handleMaster(supa, body); break;
      case "resolve": data = await resolveAddress(
                          supa, body.province_name, body.district_name, body.ward_name); break;
      default: return json({ error: `Action không hợp lệ: ${action}` }, 400);
    }
    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 400);
  }
});
