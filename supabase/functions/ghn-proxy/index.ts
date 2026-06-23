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

// CORS: chỉ cho phép các origin trong env ALLOWED_ORIGINS (CSV).
// Mặc định "*" — nếu set ALLOWED_ORIGINS="https://voi-studio.vercel.app,https://voistudio.com"
// thì chỉ những origin đó được gọi. Echo lại Origin khi match để tránh leak.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string,string> {
  const origin = req.headers.get("origin") || "";
  let allow = "*";
  if (ALLOWED_ORIGINS.length) {
    allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  }
  return {
    "access-control-allow-origin":  allow,
    "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

function jsonResp(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

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
    throw new Error(
      `GHN[${GHN_ENV}] ${path} → HTTP ${r.status}, code=${data.code}, msg=${data.message || data.code_message_value || "(no msg)"}, body=${text.slice(0, 300)}`
    );
  }
  // KHÔNG throw khi data=null — để caller (resolveAddress) tự xử với diag tốt hơn.
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
  if (!Array.isArray(provinces)) {
    throw new Error(`GHN province list không phải array: ${JSON.stringify(provinces).slice(0,200)}`);
  }
  const provMatch = provinces.find((x: any) =>
    norm(x.ProvinceName) === p ||
    (x.NameExtension || []).some((n: string) => norm(n) === p)
  );
  if (!provMatch) {
    const avail = provinces.slice(0, 5).map((x:any)=>x.ProvinceName).join(", ");
    throw new Error(`Không map được Tỉnh: "${province_name}" (norm="${p}"). Dev env có ${provinces.length} tỉnh, vd: ${avail}...`);
  }
  const ghn_province_id = provMatch.ProvinceID;

  let ghn_district_id: number | null = null, ghn_ward_code: string | null = null;
  if (d) {
    const districts = await ghn("/master-data/district", { province_id: ghn_province_id }, false);
    if (!Array.isArray(districts)) {
      throw new Error(`GHN không trả về district cho province "${provMatch.ProvinceName}" (id=${ghn_province_id}). Dev env có thể chưa có data cho tỉnh này — thử tỉnh khác (xem province list ở action master).`);
    }
    const dm = districts.find((x: any) =>
      norm(x.DistrictName) === d ||
      (x.NameExtension || []).some((n: string) => norm(n) === d)
    );
    if (!dm) {
      const avail = districts.slice(0, 5).map((x:any)=>x.DistrictName).join(", ");
      throw new Error(`Không map được Quận/Huyện: "${district_name}" (norm="${d}") trong tỉnh "${provMatch.ProvinceName}". Có ${districts.length} quận, vd: ${avail}...`);
    }
    ghn_district_id = dm.DistrictID;

    if (w) {
      const wards = await ghn("/master-data/ward", { district_id: ghn_district_id }, false);
      if (!Array.isArray(wards)) {
        throw new Error(`GHN không trả về ward cho district "${dm.DistrictName}" (id=${ghn_district_id}).`);
      }
      const wm = wards.find((x: any) =>
        norm(x.WardName) === w ||
        (x.NameExtension || []).some((n: string) => norm(n) === w)
      );
      if (!wm) {
        const avail = wards.slice(0, 5).map((x:any)=>x.WardName).join(", ");
        throw new Error(`Không map được Phường/Xã: "${ward_name}" (norm="${w}") trong quận "${dm.DistrictName}". Có ${wards.length} phường, vd: ${avail}...`);
      }
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
  // Input: { to_district_id, to_ward_code, weight, length, width, height,
  //          from_district_id, service_type_id, insurance_value }
  // Nhận GHN IDs trực tiếp từ frontend (đã dùng GHN.master() để pick), không
  // cần resolve từ name → ID nữa.
  if (!p.to_district_id || !p.to_ward_code) {
    throw new Error("Thiếu GHN district_id hoặc ward_code");
  }
  const cfg = await getShopCfg(supa);
  const data = await ghn("/v2/shipping-order/fee", {
    from_district_id: p.from_district_id || cfg.from_district_id,
    from_ward_code:   p.from_ward_code   || cfg.from_ward_code,
    service_type_id:  p.service_type_id  || cfg.service_type_id || 2,
    to_district_id:   +p.to_district_id,
    to_ward_code:     String(p.to_ward_code),
    weight:           p.weight || cfg.default_weight || 300,
    length:           p.length || cfg.default_length || 25,
    width:            p.width  || cfg.default_width  || 20,
    height:           p.height || cfg.default_height || 5,
    insurance_value:  p.insurance_value || 0,
  });
  return { total: data.total, service_fee: data.service_fee, insurance_fee: data.insurance_fee };
}

async function handleCreate(supa: SupabaseClient, p: any) {
  // Input: { order_code } — load đơn từ DB rồi push lên GHN.
  const code = String(p.order_code || "").toUpperCase().trim();
  if (!code) throw new Error("Thiếu order_code");
  const { data: o, error } = await supa.from("orders").select("*").eq("code", code).maybeSingle();
  if (error || !o) throw new Error("Không tìm thấy đơn " + code);
  if (o.ghn_order_code) throw new Error(`Đơn ${code} đã có mã GHN: ${o.ghn_order_code}`);

  // Đơn mới: province_code/district_code/ward_code lưu trực tiếp GHN IDs
  // (frontend dùng GHN.master() để pick). Đơn cũ (lưu VN gov code) thì fail
  // ở đây — yêu cầu admin sửa địa chỉ thủ công.
  const to_district_id = parseInt(o.district_code || "");
  const to_ward_code   = o.ward_code ? String(o.ward_code) : "";
  if (!to_district_id || !to_ward_code) {
    throw new Error(
      "Đơn này thiếu GHN district_id / ward_code. " +
      "Có thể là đơn cũ tạo trước khi chuyển sang GHN address — sửa lại địa chỉ trong admin."
    );
  }
  const cfg = await getShopCfg(supa);

  const items = (o.items || []).map((it: any) => ({
    name:     it.name,
    code:     it.id,
    quantity: it.qty,
    price:    it.price,
    weight:   p.item_weight || 200,
  }));

  // Whitelist required_note để chống inject lung tung từ FE
  const NOTE_VALUES = new Set(["KHONGCHOXEMHANG", "CHOXEMHANGKHONGTHU", "CHOTHUHANG"]);
  const requiredNote = NOTE_VALUES.has(p.required_note)
    ? p.required_note
    : (cfg.required_note || "KHONGCHOXEMHANG");

  const payload = {
    payment_type_id:  cfg.payment_type_id || 2,        // 1=shop trả, 2=người nhận trả
    note:             o.note || "",
    required_note:    requiredNote,
    from_name:        cfg.from_name,
    from_phone:       cfg.from_phone,
    from_address:     cfg.from_address,
    from_ward_name:   cfg.from_ward_name  || "",
    from_district_name: cfg.from_district_name || "",
    from_province_name: cfg.from_province_name || "",
    // ID kho lấy hàng — BẮT BUỘC để GHN match đúng địa chỉ đã đăng ký của shop.
    // Thiếu 2 trường này, GHN cố lookup theo tên → có dấu TV → fail "Lỗi lấy thông tin shop".
    from_district_id: cfg.from_district_id,
    from_ward_code:   cfg.from_ward_code,
    to_name:          o.customer_name,
    to_phone:         o.phone,
    to_address:       o.address,
    to_ward_code:     to_ward_code,
    to_district_id:   to_district_id,
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

// Tạo URL in vận đơn GHN — hỗ trợ in 1 hoặc nhiều đơn cùng lúc.
// Input: { order_codes: string[] | order_code: string | ghn_order_codes: string[] | ghn_order_code, size }
// Return: { url, size, token, count, skipped } — admin mở url trong tab mới.
async function handlePrint(supa: SupabaseClient, p: any) {
  let ghnCodes: string[] = [];
  const skipped: string[] = [];

  if (Array.isArray(p.ghn_order_codes) && p.ghn_order_codes.length) {
    ghnCodes = p.ghn_order_codes.filter((x: any) => !!x);
  } else if (Array.isArray(p.order_codes) && p.order_codes.length) {
    const upper = p.order_codes.map((c: string) => String(c).toUpperCase().trim());
    const r = await supa.from("orders").select("code,ghn_order_code").in("code", upper);
    const map = new Map((r.data || []).map((row: any) => [row.code, row.ghn_order_code]));
    for (const c of upper) {
      const g = map.get(c);
      if (g) ghnCodes.push(g); else skipped.push(c);
    }
  } else if (p.ghn_order_code) {
    ghnCodes = [p.ghn_order_code];
  } else if (p.order_code) {
    const r = await supa.from("orders").select("ghn_order_code")
      .eq("code", String(p.order_code).toUpperCase().trim()).maybeSingle();
    if (r.data?.ghn_order_code) ghnCodes = [r.data.ghn_order_code];
  }
  if (!ghnCodes.length) throw new Error("Không có vận đơn GHN nào để in (đơn có thể chưa được push lên GHN)");

  const allowed = new Set(["A5", "A6", "52x70", "80x80"]);
  const size = allowed.has(p.size) ? p.size : "A5";

  // GHN: POST /v2/a5/gen-token — hỗ trợ mảng nhiều mã, in liên tiếp trong 1 PDF.
  const tokenData = await ghn("/v2/a5/gen-token", { order_codes: ghnCodes });
  const token = tokenData?.token;
  if (!token) throw new Error("GHN không trả về token in vận đơn");

  const printBase = GHN_ENV === "dev"
    ? "https://dev-online-gateway.ghn.vn/a5/public-api"
    : "https://online-gateway.ghn.vn/a5/public-api";
  const pathBySize: Record<string, string> = {
    "A5":   `/printA5?token=${token}`,
    "A6":   `/printA6?token=${token}`,
    "52x70":`/print52x70?token=${token}`,
    "80x80":`/print80x80?token=${token}`,
  };
  return { url: `${printBase}${pathBySize[size]}`, size, token, count: ghnCodes.length, skipped };
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST")    return jsonResp(req, { error: "POST only" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    if (!action) return jsonResp(req, { error: "Thiếu action" }, 400);

    // Service-role client để bỏ qua RLS (đã xác thực qua action)
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

    // Admin actions: verify JWT + check admin_emails table.
    // SECURITY: KHÔNG return diag (cũ leak full danh sách admin), KHÔNG bootstrap
    // hardcode email (cũ cho phép 1 email cố định luôn là admin nếu bảng rỗng).
    const adminActions = new Set(["create", "cancel", "print"]);
    if (adminActions.has(action)) {
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) return jsonResp(req, { error: "Cần đăng nhập admin" }, 401);

      // Verify JWT qua Supabase (xác nhận chữ ký + chưa hết hạn)
      const u = await supa.auth.getUser(jwt);
      if (u.error || !u.data?.user?.email) {
        return jsonResp(req, { error: "Token không hợp lệ" }, 401);
      }
      const email = u.data.user.email.toLowerCase();

      const inTable = await supa.from("admin_emails").select("email").ilike("email", email).maybeSingle();
      if (!inTable.data) {
        return jsonResp(req, { error: "Email không có quyền admin" }, 403);
      }
    }

    let data;
    switch (action) {
      case "fee":     data = await handleFee(supa, body);    break;
      case "create":  data = await handleCreate(supa, body); break;
      case "track":   data = await handleTrack(supa, body);  break;
      case "cancel":  data = await handleCancel(supa, body); break;
      case "master":  data = await handleMaster(supa, body); break;
      case "print":   data = await handlePrint(supa, body);  break;
      case "resolve": data = await resolveAddress(
                          supa, body.province_name, body.district_name, body.ward_name); break;
      default: return jsonResp(req, { error: `Action không hợp lệ: ${action}` }, 400);
    }
    return jsonResp(req, { ok: true, data });
  } catch (e) {
    return jsonResp(req, { ok: false, error: (e as Error).message }, 400);
  }
});
