-- =========================================================
-- MIGRATION — Số lượng đã bán + số yêu thích (set ảo ở admin)
-- ---------------------------------------------------------
-- Chạy 1 lần trên: Supabase ➜ SQL Editor ➜ New query ➜ Run.
-- =========================================================

alter table public.products
  add column if not exists sold  int not null default 0,
  add column if not exists likes int not null default 0;

-- XONG. Vào admin → sửa sản phẩm → điền "Đã bán" và "Yêu thích" để hiện ra cửa hàng.
