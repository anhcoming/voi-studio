-- =========================================================
-- Migration: tích hợp GHN (Giao Hàng Nhanh)
-- Chạy MỘT LẦN trong Supabase ➜ SQL Editor ➜ New query.
-- An toàn re-run (dùng `if not exists`).
-- =========================================================

-- 1) Bổ sung cột GHN vào bảng orders ----------------------
alter table public.orders
  add column if not exists ghn_order_code   text,          -- mã vận đơn GHN trả về
  add column if not exists ghn_status       text,          -- trạng thái mới nhất từ GHN
  add column if not exists ghn_status_at    timestamptz,   -- thời điểm cập nhật status
  add column if not exists ghn_fee          int,           -- phí ship thực tế GHN tính
  add column if not exists ghn_expected_at  timestamptz,   -- ngày dự kiến giao
  add column if not exists ghn_payload      jsonb,         -- snapshot request gửi GHN (debug)
  add column if not exists ghn_response     jsonb;         -- snapshot response gần nhất

create index if not exists orders_ghn_code_idx on public.orders(ghn_order_code);

-- 2) Cache mapping địa chỉ VN ↔ GHN ID ---------------------
-- GHN dùng province_id/district_id/ward_code RIÊNG, không trùng với code
-- của bộ Nội vụ (provinces.open-api.vn). Bảng này cache kết quả mapping
-- để khỏi gọi GHN mỗi lần checkout.
create table if not exists public.ghn_address_map (
  -- province_name là chuẩn hoá: lowercase, bỏ "Tỉnh "/"Thành phố ".
  province_name  text not null,
  district_name  text,
  ward_name      text,
  ghn_province_id int,
  ghn_district_id int,
  ghn_ward_code   text,
  updated_at      timestamptz default now(),
  primary key (province_name, district_name, ward_name)
);

-- 3) Bảng tracking events (mỗi đơn nhiều dòng) ------------
-- Webhook GHN sẽ push từng sự kiện; UI khách hiển thị timeline.
create table if not exists public.ghn_tracking_events (
  id              bigserial primary key,
  order_code      text not null,                -- code đơn nội bộ (= orders.code)
  ghn_order_code  text,
  status          text not null,                -- ready_to_pick / picking / delivering / delivered / ...
  status_name     text,                         -- tên hiển thị Tiếng Việt
  description     text,
  location        text,
  event_at        timestamptz default now(),
  raw             jsonb,
  created_at      timestamptz default now()
);

create index if not exists ghn_events_order_idx
  on public.ghn_tracking_events(order_code, event_at desc);

-- 4) RLS ---------------------------------------------------
alter table public.ghn_address_map     enable row level security;
alter table public.ghn_tracking_events enable row level security;

-- ghn_address_map: chỉ admin viết, mọi người đọc (cache công khai).
drop policy if exists "ghn map read"  on public.ghn_address_map;
drop policy if exists "ghn map write" on public.ghn_address_map;
create policy "ghn map read"  on public.ghn_address_map for select using (true);
create policy "ghn map write" on public.ghn_address_map for all
  using (public.is_admin()) with check (public.is_admin());

-- ghn_tracking_events: admin đọc tất cả; khách đọc qua RPC get_tracking_by_code.
drop policy if exists "ghn ev read"   on public.ghn_tracking_events;
drop policy if exists "ghn ev write"  on public.ghn_tracking_events;
create policy "ghn ev read"  on public.ghn_tracking_events for select using (public.is_admin());
create policy "ghn ev write" on public.ghn_tracking_events for all
  using (public.is_admin()) with check (public.is_admin());

-- 5) RPC: khách tra cứu tracking theo mã đơn nội bộ --------
create or replace function public.get_tracking_by_code(p_code text)
returns setof public.ghn_tracking_events
language sql security definer set search_path = public as $$
  select * from public.ghn_tracking_events
  where order_code = upper(trim(p_code))
  order by event_at asc
$$;
grant execute on function public.get_tracking_by_code(text) to anon, authenticated;

-- 6) Seed site_settings cho GHN (admin sẽ điền) -----------
-- Khoá `ghn_config` lưu: enabled, shop_id, from_district_id, from_ward_code,
-- from_address, from_name, from_phone, default_weight, service_type_id...
insert into public.site_settings(key, value)
values ('ghn_config', '{
  "enabled": false,
  "shop_id": null,
  "from_name": "VOISTUDIO",
  "from_phone": "",
  "from_address": "",
  "from_district_id": null,
  "from_ward_code": null,
  "default_weight": 300,
  "default_length": 25,
  "default_width": 20,
  "default_height": 5,
  "service_type_id": 2,
  "payment_type_id": 2,
  "required_note": "KHONGCHOXEMHANG"
}'::jsonb)
on conflict (key) do nothing;

-- XONG. Tiếp theo: deploy edge function `ghn-proxy` (xem SETUP.md mục I).
