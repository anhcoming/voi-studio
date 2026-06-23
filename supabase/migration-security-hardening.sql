-- =========================================================
-- SECURITY HARDENING — fix price tampering, stock drain, voucher abuse,
-- admin email leak, PII leak qua order code.
-- ---------------------------------------------------------
-- Chạy 1 lần trên Supabase ➜ SQL Editor ➜ New query ➜ Run.
-- An toàn re-run.
-- =========================================================

-- =========================================================
-- 1) RPC create_order — TÍNH GIÁ + TRỪ STOCK + DÙNG VOUCHER
--    TOÀN BỘ TRÊN SERVER, atomic trong 1 transaction.
-- =========================================================
-- Tại sao: trước đây client gửi thẳng subtotal/total/voucher_discount/items
-- vào INSERT orders → khách mở DevTools sửa total = 0 cũng được, COD theo
-- giá fake. Sau migration này, chỉ có RPC này tạo được đơn; INSERT trực
-- tiếp bị RLS chặn (with check false). RPC chạy security definer, tự load
-- giá từ bảng products, lock row để trừ stock không race, tự verify
-- voucher, tự increment used_count.
-- =========================================================
create or replace function public.create_order(
  p_items           jsonb,     -- [{id:uuid, qty:int, color?, size?}, ...]
  p_customer_name   text,
  p_phone           text,
  p_email           text,
  p_address         text,
  p_note            text,
  p_province_code   text,
  p_province_name   text,
  p_district_code   text,
  p_district_name   text,
  p_ward_code       text,
  p_ward_name       text,
  p_street          text,
  p_shipping        int,
  p_voucher_code    text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code      text;
  v_user_id   uuid;
  v_subtotal  int := 0;
  v_discount  int := 0;
  v_total     int;
  v_items_out jsonb := '[]'::jsonb;
  v_voucher   record;
  v_v_id      uuid := null;
  v_v_code    text := null;
  v_v_type    text := null;
  it          jsonb;
  v_qty       int;
  v_product   record;
  v_now       timestamptz := now();
  v_order     record;
  v_recent    int;
begin
  v_user_id := auth.uid();   -- nullable (guest)

  ---------- input checks ----------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Quá nhiều sản phẩm trong 1 đơn';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) < 1 then
    raise exception 'Thiếu tên khách hàng';
  end if;
  if p_phone is null or length(regexp_replace(p_phone, '\D', '', 'g')) < 9 then
    raise exception 'Số điện thoại không hợp lệ';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'Địa chỉ không hợp lệ';
  end if;
  if p_shipping is null or p_shipping < 0 or p_shipping > 5000000 then
    raise exception 'Phí ship không hợp lệ';
  end if;

  ---------- soft rate-limit: 1 đơn / 20s / cùng SĐT ----------
  -- Chống spam đơn rác (đặc biệt với SĐT giả). Admin có thể tạm thời
  -- bỏ qua bằng update site_settings nếu cần. Không tính đơn cancelled
  -- để tránh false positive khi khách thử lại sau lỗi.
  select count(*)::int into v_recent
    from public.orders
    where phone = regexp_replace(p_phone, '\D', '', 'g')
      and created_at > v_now - interval '20 seconds'
      and status <> 'cancelled';
  if v_recent > 0 then
    raise exception 'Bạn vừa đặt đơn, vui lòng thử lại sau 20 giây';
  end if;

  ---------- walk items: lock row, verify, trừ stock, tính subtotal ----------
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((it->>'qty')::int, 0);
    if v_qty <= 0 or v_qty > 50 then
      raise exception 'Số lượng không hợp lệ: %', v_qty;
    end if;

    select id, name, price, stock, active, image_url
      into v_product
      from public.products
      where id = (it->>'id')::uuid
      for update;     -- lock row để chống oversell

    if not found then
      raise exception 'Sản phẩm không tồn tại: %', it->>'id';
    end if;
    if not v_product.active then
      raise exception 'Sản phẩm "%" đang tạm ngưng bán', v_product.name;
    end if;
    if coalesce(v_product.stock, 0) < v_qty then
      raise exception 'Sản phẩm "%" không đủ tồn (còn %, cần %)',
        v_product.name, coalesce(v_product.stock, 0), v_qty;
    end if;

    -- subtotal lấy GIÁ TỪ DB, KHÔNG tin client
    v_subtotal := v_subtotal + v_product.price * v_qty;

    -- snapshot item lưu vào đơn — dùng giá/tên server-side
    v_items_out := v_items_out || jsonb_build_object(
      'id',    v_product.id,
      'name',  v_product.name,
      'price', v_product.price,
      'qty',   v_qty,
      'color', it->>'color',
      'size',  it->>'size',
      'image', v_product.image_url
    );

    -- trừ tồn ngay trong transaction (row đã lock)
    update public.products
      set stock = greatest(0, stock - v_qty)
      where id = v_product.id;
  end loop;

  ---------- voucher (nếu có) — verify server-side ----------
  if p_voucher_code is not null and length(trim(p_voucher_code)) > 0 then
    select * into v_voucher
      from public.vouchers
      where code = upper(trim(p_voucher_code))
      for update;
    if not found then            raise exception 'Mã giảm giá không tồn tại'; end if;
    if not v_voucher.active then  raise exception 'Mã giảm giá đã bị tắt';   end if;
    if v_voucher.starts_at is not null and v_now < v_voucher.starts_at then
      raise exception 'Mã chưa có hiệu lực';
    end if;
    if v_voucher.expires_at is not null and v_now > v_voucher.expires_at then
      raise exception 'Mã đã hết hạn';
    end if;
    if v_voucher.max_uses is not null and v_voucher.used_count >= v_voucher.max_uses then
      raise exception 'Mã đã hết lượt dùng';
    end if;
    if v_subtotal < v_voucher.min_order then
      raise exception 'Đơn tối thiểu % để dùng mã này', v_voucher.min_order;
    end if;

    if v_voucher.discount_type = 'percent' then
      v_discount := floor(v_subtotal * v_voucher.discount_value / 100.0);
      if v_voucher.max_discount is not null and v_discount > v_voucher.max_discount then
        v_discount := v_voucher.max_discount;
      end if;
    elsif v_voucher.discount_type = 'fixed' then
      v_discount := least(v_voucher.discount_value, v_subtotal);
    elsif v_voucher.discount_type = 'freeship' then
      v_discount := 0;   -- xử lý bằng shipping=0 ở dưới
    end if;

    update public.vouchers set used_count = used_count + 1 where id = v_voucher.id;
    v_v_id   := v_voucher.id;
    v_v_code := v_voucher.code;
    v_v_type := v_voucher.discount_type;
  end if;

  ---------- total ----------
  if v_v_type = 'freeship' then
    v_total := v_subtotal;
  else
    v_total := v_subtotal + p_shipping - v_discount;
  end if;
  if v_total < 0 then v_total := 0; end if;

  ---------- generate unique order code ----------
  loop
    v_code := 'OR' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  ---------- insert order ----------
  insert into public.orders (
    code, status, user_id,
    customer_name, phone, email, address, note,
    items, subtotal, shipping, total,
    province_code, province_name,
    district_code, district_name,
    ward_code, ward_name, street,
    voucher_code, voucher_discount
  ) values (
    v_code, 'pending', v_user_id,
    trim(p_customer_name),
    regexp_replace(p_phone, '\D', '', 'g'),
    case when p_email is null or length(trim(p_email)) = 0 then null else lower(trim(p_email)) end,
    trim(p_address),
    coalesce(p_note, ''),
    v_items_out, v_subtotal,
    case when v_v_type = 'freeship' then 0 else p_shipping end,
    v_total,
    p_province_code, p_province_name,
    p_district_code, p_district_name,
    p_ward_code, p_ward_name, p_street,
    v_v_code, v_discount
  ) returning * into v_order;

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.create_order(jsonb,text,text,text,text,text,text,text,text,text,text,text,text,int,text) from public;
grant execute on function public.create_order(jsonb,text,text,text,text,text,text,text,text,text,text,text,text,int,text)
  to anon, authenticated;

-- =========================================================
-- 2) CHẶN INSERT TRỰC TIẾP vào orders
--    Tất cả đơn phải đi qua create_order RPC.
-- =========================================================
drop policy if exists "orders insert" on public.orders;
create policy "orders insert"
  on public.orders for insert
  with check (false);          -- chỉ RPC (security definer) bypass được

-- =========================================================
-- 3) REVOKE apply_stock_delta khỏi anon
--    Trước đây ai cũng gọi được → drain stock toàn shop.
--    Admin (authenticated) vẫn dùng được để chỉnh tồn thủ công.
-- =========================================================
revoke execute on function public.apply_stock_delta(jsonb, int) from anon, public;
-- Giữ grant cho authenticated để admin restore/chỉnh stock từ UI
do $$ begin
  begin
    grant execute on function public.apply_stock_delta(jsonb, int) to authenticated;
  exception when undefined_function then null;
  end;
end $$;

-- =========================================================
-- 4) REVOKE consume_voucher khỏi anon + authenticated
--    Trước đây client tự gọi → khách spam burn voucher đối thủ.
--    Logic consume giờ nằm trong create_order RPC.
-- =========================================================
do $$ begin
  begin
    revoke execute on function public.consume_voucher(text) from anon, authenticated, public;
  exception when undefined_function then null;
  end;
end $$;

-- =========================================================
-- 5) SIẾT admin_emails — KHÔNG lộ danh sách admin ra public
-- =========================================================
-- CRITICAL: is_admin() phải SECURITY DEFINER, nếu không sẽ recursion:
--   products SELECT policy → is_admin() → SELECT admin_emails → RLS check
--   → is_admin() → SELECT admin_emails → ... → 500 Internal Server Error.
-- Khi là security definer, hàm chạy với quyền owner (postgres) → bypass RLS
-- trên admin_emails khi đọc bên trong hàm. Bên ngoài hàm RLS vẫn áp dụng.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
  or (
    -- Bootstrap: bảng trống → cho email mặc định để khỏi tự khoá khi setup lần đầu.
    -- Sau khi đã insert ít nhất 1 row vào admin_emails, nhánh này bất hoạt.
    not exists(select 1 from public.admin_emails)
    and coalesce(auth.jwt() ->> 'email','') = 'anhcoming@gmail.com'
  )
$$;

drop policy if exists "admin emails read" on public.admin_emails;
create policy "admin emails read"
  on public.admin_emails for select using (public.is_admin());

-- RPC list_admin_emails: chỉ admin gọi được. Khách không cần biết list.
revoke execute on function public.list_admin_emails() from anon, public;
grant execute on function public.list_admin_emails() to authenticated;
-- (Authenticated user không phải admin vẫn không SELECT được do RLS,
--  hàm trả 0 dòng → tiết lộ "có / không là admin" nhưng không lộ email.)

-- RPC mới: "tôi có phải admin không?" — client dùng cái này thay vì list.
create or replace function public.am_i_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(
      select 1 from public.admin_emails
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ),
    false
  )
$$;
grant execute on function public.am_i_admin() to anon, authenticated;

-- =========================================================
-- 6) get_order_by_code — yêu cầu SĐT khi khách chưa đăng nhập
--    Khách đã login đọc đơn của mình qua RLS bình thường.
--    Khách ẩn danh phải biết CẢ code lẫn 4 số cuối SĐT.
-- =========================================================
create or replace function public.get_order_by_code(p_code text, p_phone_tail text default null)
returns setof public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_tail text;
  v_user uuid;
begin
  v_user := auth.uid();
  v_tail := regexp_replace(coalesce(p_phone_tail, ''), '\D', '', 'g');

  -- Admin: xem mọi đơn không cần phone
  if public.is_admin() then
    return query select * from public.orders
      where code = upper(trim(p_code)) limit 1;
    return;
  end if;

  -- Khách đã login: nếu đơn thuộc về họ, cho xem không cần phone
  if v_user is not null then
    return query select * from public.orders
      where code = upper(trim(p_code)) and user_id = v_user
      limit 1;
    if found then return; end if;
  end if;

  -- Khách ẩn danh hoặc đơn không thuộc về user đang login:
  -- bắt buộc khớp 4 số cuối SĐT
  if length(v_tail) < 4 then
    return;  -- không có phone tail → từ chối lặng (tránh leak "đơn tồn tại")
  end if;

  return query select * from public.orders
    where code = upper(trim(p_code))
      and right(regexp_replace(phone, '\D', '', 'g'), 4) = right(v_tail, 4)
    limit 1;
end;
$$;
-- Drop chữ ký cũ (1 param) nếu tồn tại, rồi grant chữ ký mới
do $$ begin
  begin
    drop function if exists public.get_order_by_code(text);
  exception when others then null;
  end;
end $$;
grant execute on function public.get_order_by_code(text, text) to anon, authenticated;

-- =========================================================
-- 7) TỐI ƯU INDEX cho rate-limit query (count by phone + created_at)
-- =========================================================
create index if not exists orders_phone_created_idx
  on public.orders (phone, created_at desc);

-- XONG.
-- Sau khi chạy:
--   • Web không còn tạo đơn được nếu chưa redeploy assets/store-api.js mới.
--   • Khách tra cứu đơn ẩn danh cần thêm 4 số cuối SĐT (UI đã update).
--   • Admin login bằng Google vẫn hoạt động (qua am_i_admin).
