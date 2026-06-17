-- =========================================================
-- CẬP NHẬT DB + ĐỒNG BỘ DANH MỤC THEO SẢN PHẨM
-- Dán toàn bộ file vào: Supabase ➜ SQL Editor ➜ New query ➜ Run
-- An toàn chạy nhiều lần (idempotent). Không xoá dữ liệu sẵn có.
-- =========================================================

-- 1) ĐẢM BẢO BẢNG DANH MỤC + CỘT ẢNH-THEO-MÀU TỒN TẠI ------
create table if not exists public.categories (
  key        text primary key,
  name       text not null,
  type       text not null default 'tee',  -- tee|tank|ringer|polo|long|hoodie|sweater|pants|tote
  sort       int  default 0,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;
drop policy if exists "categories read"  on public.categories;
drop policy if exists "categories write" on public.categories;
create policy "categories read"  on public.categories for select using (true);
create policy "categories write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- ảnh theo màu: { "#hex": ["url1","url2", ...] }  +  gallery phẳng (back-compat)
alter table public.products add column if not exists color_images jsonb default '{}'::jsonb;
alter table public.products add column if not exists images       jsonb default '[]'::jsonb;

-- 2) SEED DANH MỤC MẶC ĐỊNH (tên + type chuẩn) — chỉ thêm nếu chưa có
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

-- 3) ĐỒNG BỘ THEO SẢN PHẨM ---------------------------------
-- Tự thêm MỌI cat_key đang được sản phẩm sử dụng nhưng categories còn thiếu.
-- Tên tạm = key (viết hoa chữ đầu), type mặc định 'tee' — vào trang admin sửa lại tên/type cho đẹp.
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

-- 4) KIỂM TRA: mỗi danh mục đang có bao nhiêu sản phẩm
select c.sort, c.key, c.name, c.type, c.active,
       count(p.id) as so_san_pham
from public.categories c
left join public.products p on p.cat_key = c.key
group by c.sort, c.key, c.name, c.type, c.active
order by c.sort;

-- (Tuỳ chọn) Xem danh mục KHÔNG còn sản phẩm nào — cân nhắc ẩn/xoá trong admin:
-- select c.key, c.name from public.categories c
--   left join public.products p on p.cat_key = c.key
--   where p.id is null;

-- (Tuỳ chọn) Ẩn các danh mục rỗng thay vì xoá:
-- update public.categories c set active = false
--   where not exists (select 1 from public.products p where p.cat_key = c.key);
