-- =========================================================
-- ORIGINALS — Supabase schema
-- Dán toàn bộ file này vào: Supabase ➜ SQL Editor ➜ New query ➜ Run
-- =========================================================

-- 1) BẢNG SẢN PHẨM ----------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  print       text,
  cat_key     text not null,
  collection  text,
  price       int  not null default 0,
  compare     int  not null default 0,
  colors      jsonb default '[]'::jsonb,
  sizes       jsonb default '["S","M","L","XL"]'::jsonb,
  stock       int  not null default 0,
  image_url   text,
  active      boolean not null default true,
  sort        int default 0,
  created_at  timestamptz default now()
);

-- 2) BẢNG ĐƠN HÀNG ----------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  status        text not null default 'pending',  -- pending|confirmed|shipping|completed|cancelled
  customer_name text,
  phone         text,
  address       text,
  note          text,
  items         jsonb not null default '[]'::jsonb,
  subtotal      int default 0,
  shipping      int default 0,
  total         int default 0,
  created_at    timestamptz default now()
);
create index if not exists orders_code_idx on public.orders(code);

-- 3) HÀM KIỂM TRA ADMIN -----------------------------------
-- 👉 SỬA email trong danh sách dưới đây thành email Google admin của bạn.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email','') = any (array[
    'anhcoming@gmail.com'
  ])
$$;

-- 4) BẬT ROW LEVEL SECURITY -------------------------------
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- 5) POLICY CHO SẢN PHẨM ----------------------------------
drop policy if exists "products read"  on public.products;
drop policy if exists "products write" on public.products;
create policy "products read"  on public.products for select using (active = true or public.is_admin());
create policy "products write" on public.products for all    using (public.is_admin()) with check (public.is_admin());

-- 6) POLICY CHO ĐƠN HÀNG ----------------------------------
drop policy if exists "orders insert" on public.orders;
drop policy if exists "orders read"   on public.orders;
drop policy if exists "orders update" on public.orders;
create policy "orders insert" on public.orders for insert with check (true);                 -- khách đặt hàng
create policy "orders read"   on public.orders for select using (public.is_admin());          -- chỉ admin xem tất cả
create policy "orders update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- 7) TRA CỨU ĐƠN THEO MÃ (cho khách, không cần đăng nhập) -
create or replace function public.get_order_by_code(p_code text)
returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where code = upper(trim(p_code)) limit 1
$$;
grant execute on function public.get_order_by_code(text) to anon, authenticated;

-- 8) KHO ẢNH SẢN PHẨM (Storage) ---------------------------
insert into storage.buckets (id, name, public)
values ('product-images','product-images', true)
on conflict (id) do nothing;

drop policy if exists "prod img read"   on storage.objects;
drop policy if exists "prod img write"  on storage.objects;
drop policy if exists "prod img update" on storage.objects;
drop policy if exists "prod img delete" on storage.objects;
create policy "prod img read"   on storage.objects for select using (bucket_id = 'product-images');
create policy "prod img write"  on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "prod img update" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
create policy "prod img delete" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

-- XONG. Sau khi chạy: vào trang admin, bấm "Nhập dữ liệu mẫu" để có sản phẩm demo.
