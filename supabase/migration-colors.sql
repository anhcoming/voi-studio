-- =========================================================
-- Migration: bảng màu sắc dùng chung
-- Cho phép admin định nghĩa list màu chuẩn → sản phẩm chỉ chọn từ list này
-- thay vì gõ hex bừa, tránh phân mảnh dữ liệu màu.
-- =========================================================

create table if not exists public.colors (
  key        text primary key,
  name       text not null,
  hex        text not null,
  sort       int default 0,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table public.colors enable row level security;

drop policy if exists "colors read"  on public.colors;
drop policy if exists "colors write" on public.colors;
create policy "colors read"  on public.colors for select using (true);
create policy "colors write" on public.colors for all
  using (public.is_admin()) with check (public.is_admin());

-- Seed list màu mặc định (chạy lần đầu) — admin có thể sửa/xoá/thêm sau.
insert into public.colors(key, name, hex, sort) values
  ('black',   'Đen',          '#1c1c1c', 1),
  ('white',   'Trắng kem',    '#f0ede6', 2),
  ('cream',   'Kem',          '#e7ddca', 3),
  ('sand',    'Be cát',       '#cbb89d', 4),
  ('navy',    'Xanh navy',    '#2c3a4f', 5),
  ('sky',     'Xanh trời',    '#a7c4db', 6),
  ('sage',    'Xanh sage',    '#9fb088', 7),
  ('olive',   'Xanh olive',   '#6f7445', 8),
  ('forest',  'Xanh rừng',    '#3f5c46', 9),
  ('mustard', 'Vàng mù tạt',  '#d8a441', 10),
  ('brick',   'Cam gạch',     '#b5523a', 11),
  ('maroon',  'Đỏ rượu',      '#6e2f33', 12),
  ('pink',    'Hồng pastel',  '#e0b1b6', 13),
  ('grey',    'Xám',          '#b6b6b0', 14)
on conflict (key) do nothing;
