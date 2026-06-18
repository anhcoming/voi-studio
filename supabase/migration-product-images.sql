-- =========================================================
-- MIGRATION — Cho phép sản phẩm có nhiều ảnh, sắp xếp thứ tự
-- ---------------------------------------------------------
-- Chạy 1 lần trên: Supabase ➜ SQL Editor ➜ New query ➜ Run.
-- =========================================================

-- 1) Thêm cột images (mảng URL) vào bảng products ---------
alter table public.products
  add column if not exists images jsonb not null default '[]'::jsonb;

-- 2) Backfill: copy image_url cũ vào images nếu sản phẩm chưa có ảnh
update public.products
   set images = jsonb_build_array(image_url)
 where (images is null or jsonb_array_length(images) = 0)
   and image_url is not null and image_url <> '';

-- XONG. Sau khi chạy, vào trang admin và edit sản phẩm để upload thêm ảnh,
-- ảnh đầu tiên sẽ là ảnh chính hiển thị ngoài cửa hàng & card sản phẩm.
