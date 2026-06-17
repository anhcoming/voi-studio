-- =========================================================
-- MIGRATION — Quản lý danh mục (categories) + Ảnh theo màu (color_images)
-- Dán toàn bộ file này vào: Supabase ➜ SQL Editor ➜ New query ➜ Run
-- Chạy được nhiều lần (idempotent).
-- =========================================================

-- 1) BẢNG DANH MỤC -----------------------------------------
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

-- Seed danh mục mặc định (chỉ thêm nếu chưa có)
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

-- 2) ẢNH THEO MÀU trên SẢN PHẨM ----------------------------
-- color_images: { "#hex": ["url1","url2", ...], ... }
alter table public.products add column if not exists color_images jsonb default '{}'::jsonb;
-- images (gallery phẳng) — có thể đã tồn tại từ migration trước, thêm nếu chưa
alter table public.products add column if not exists images jsonb default '[]'::jsonb;

-- XONG.
