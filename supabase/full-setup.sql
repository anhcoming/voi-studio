-- =========================================================
-- VOISTUDIO — FULL SETUP (toàn bộ DB từ A → Z)
-- Dán TOÀN BỘ file vào: Supabase ➜ SQL Editor ➜ New query ➜ Run
-- An toàn chạy nhiều lần (idempotent). Không xoá dữ liệu sẵn có.
--
-- 👉 NHỚ sửa email admin ở MỤC 4 (hàm is_admin) thành email Google của bạn.
-- =========================================================


-- =========================================================
-- 1) BẢNG SẢN PHẨM
-- =========================================================
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  print        text,
  cat_key      text not null,
  collection   text,
  price        int  not null default 0,
  compare      int  not null default 0,
  colors       jsonb default '[]'::jsonb,
  sizes        jsonb default '["S","M","L","XL"]'::jsonb,
  stock        int  not null default 0,
  sold         int  default 0,
  likes        int  default 0,
  image_url    text,
  images       jsonb default '[]'::jsonb,        -- gallery phẳng (back-compat)
  color_images jsonb default '{}'::jsonb,        -- ảnh theo màu: {"#hex":["url",...]}
  active       boolean not null default true,
  sort         int default 0,
  created_at   timestamptz default now()
);

-- Nâng cấp DB cũ: thêm cột nếu thiếu (an toàn nếu đã có)
alter table public.products add column if not exists sold         int  default 0;
alter table public.products add column if not exists likes        int  default 0;
alter table public.products add column if not exists images       jsonb default '[]'::jsonb;
alter table public.products add column if not exists color_images jsonb default '{}'::jsonb;


-- =========================================================
-- 2) BẢNG ĐƠN HÀNG
-- =========================================================
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  status        text not null default 'pending',   -- pending|confirmed|shipping|completed|cancelled
  customer_name text,
  phone         text,
  address       text,
  note          text,
  items         jsonb not null default '[]'::jsonb,
  subtotal      int default 0,
  shipping      int default 0,
  total         int default 0,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);
-- Nâng cấp DB cũ
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_code_idx    on public.orders(code);
create index if not exists orders_user_id_idx on public.orders(user_id);


-- =========================================================
-- 3) BẢNG DANH MỤC
-- =========================================================
create table if not exists public.categories (
  key        text primary key,
  name       text not null,
  type       text not null default 'tee',  -- tee|tank|ringer|polo|long|hoodie|sweater|pants|tote
  sort       int  default 0,
  active     boolean not null default true,
  created_at timestamptz default now()
);


-- =========================================================
-- 4) HÀM KIỂM TRA ADMIN  👉 SỬA EMAIL TẠI ĐÂY
-- =========================================================
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email','') = any (array[
    'anhcoming@gmail.com'
  ])
$$;


-- =========================================================
-- 5) BẬT ROW LEVEL SECURITY
-- =========================================================
alter table public.products   enable row level security;
alter table public.orders     enable row level security;
alter table public.categories enable row level security;


-- =========================================================
-- 6) POLICY — SẢN PHẨM (khách đọc SP đang hiện, admin toàn quyền)
-- =========================================================
drop policy if exists "products read"  on public.products;
drop policy if exists "products write" on public.products;
create policy "products read"  on public.products for select using (active = true or public.is_admin());
create policy "products write" on public.products for all    using (public.is_admin()) with check (public.is_admin());


-- =========================================================
-- 7) POLICY — DANH MỤC (ai cũng đọc, chỉ admin sửa)
-- =========================================================
drop policy if exists "categories read"  on public.categories;
drop policy if exists "categories write" on public.categories;
create policy "categories read"  on public.categories for select using (true);
create policy "categories write" on public.categories for all    using (public.is_admin()) with check (public.is_admin());


-- =========================================================
-- 8) POLICY — ĐƠN HÀNG
--    • khách (kể cả ẩn danh) được đặt đơn, nhưng không spoof user_id
--    • admin xem/sửa tất cả; user đăng nhập xem được đơn của chính mình
-- =========================================================
drop policy if exists "orders insert"    on public.orders;
drop policy if exists "orders read"      on public.orders;
drop policy if exists "orders read self" on public.orders;
drop policy if exists "orders update"    on public.orders;
create policy "orders insert"    on public.orders for insert with check (user_id is null or user_id = auth.uid());
create policy "orders read"      on public.orders for select using (public.is_admin());
create policy "orders read self" on public.orders for select using (auth.uid() is not null and auth.uid() = user_id);
create policy "orders update"    on public.orders for update using (public.is_admin()) with check (public.is_admin());


-- =========================================================
-- 9) TRA CỨU ĐƠN THEO MÃ (cho khách, không cần đăng nhập)
-- =========================================================
create or replace function public.get_order_by_code(p_code text)
returns setof public.orders
language sql security definer set search_path = public as $$
  select * from public.orders where code = upper(trim(p_code)) limit 1
$$;
grant execute on function public.get_order_by_code(text) to anon, authenticated;


-- =========================================================
-- 10) KHO ẢNH SẢN PHẨM (Storage bucket: product-images)
-- =========================================================
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


-- =========================================================
-- 11) SEED DANH MỤC MẶC ĐỊNH (chỉ thêm nếu chưa có)
-- =========================================================
insert into public.categories(key,name,type,sort) values
  ('ao-thun','Áo Thun Relaxed Fit','tee',0),
  ('ba-lo','Áo Ba Lỗ','tank',1),
  ('ringer','Áo Thun Ringer','ringer',2),
  ('polo','Áo Polo Relaxed Fit','polo',3),
  ('dai-tay','Áo Thun Dài Tay','long',4),
  ('hoodie','Áo Hoodie','hoodie',5),
  ('sweater','Áo Sweater','sweater',6),
  ('jogger','Quần Jogger','pants',7),
  ('tote','Túi Tote','tote',8)
on conflict (key) do nothing;


-- =========================================================
-- 12) ĐỒNG BỘ DANH MỤC THEO SẢN PHẨM
--     Tự thêm mọi cat_key đang dùng trong products mà categories còn thiếu.
--     (tên tạm = key viết hoa, type='tee' — vào admin sửa lại cho đẹp)
-- =========================================================
insert into public.categories(key, name, type, sort)
select d.cat_key,
       initcap(replace(d.cat_key, '-', ' ')),
       'tee',
       100 + (row_number() over (order by d.cat_key))::int
from (
  select distinct cat_key
  from public.products
  where cat_key is not null and cat_key <> ''
) d
where not exists (select 1 from public.categories c where c.key = d.cat_key);


-- =========================================================
-- 13) KIỂM TRA KẾT QUẢ
-- =========================================================
select c.sort, c.key, c.name, c.type, c.active,
       count(p.id) as so_san_pham
from public.categories c
left join public.products p on p.cat_key = c.key
group by c.sort, c.key, c.name, c.type, c.active
order by c.sort;

-- XONG.
-- • Chưa có sản phẩm? Vào trang admin → tab Sản phẩm → "Nhập dữ liệu mẫu"
--   rồi chạy LẠI file này (mục 12) để đồng bộ danh mục theo sản phẩm.
