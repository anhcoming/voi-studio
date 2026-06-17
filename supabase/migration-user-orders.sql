-- =========================================================
-- MIGRATION — Gắn đơn hàng với tài khoản Google của khách
-- ---------------------------------------------------------
-- Mục tiêu: khách đăng nhập bằng Google sẽ có "lịch sử đơn hàng"
-- đồng bộ trên mọi thiết bị (không phụ thuộc localStorage / mã đơn).
-- ---------------------------------------------------------
-- Chạy 1 lần trên Supabase ➜ SQL Editor ➜ New query ➜ Run.
-- Schema.sql phải đã chạy trước file này.
-- =========================================================

-- 1) Thêm cột user_id vào bảng orders -----------------------
alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_user_id_idx on public.orders(user_id);

-- 2) Cho user đăng nhập đọc được đơn của chính họ ----------
-- (Policy 'orders read' cũ — chỉ admin xem được tất cả — vẫn giữ.
--  Hai policy permissive được OR với nhau, nên admin vẫn xem hết,
--  còn user thường chỉ xem được đơn có user_id = auth.uid().)
drop policy if exists "orders read self" on public.orders;
create policy "orders read self"
  on public.orders for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- 3) Chống spoof user_id khi insert -------------------------
-- Khách ẩn danh (auth.uid() = null) chỉ được đặt đơn với user_id = null.
-- Khách đăng nhập chỉ được đặt đơn với user_id = chính mình (hoặc null).
drop policy if exists "orders insert" on public.orders;
create policy "orders insert"
  on public.orders for insert
  with check (user_id is null or user_id = auth.uid());

-- XONG. Vào trang chủ → bấm icon user ở header → "Đăng nhập Google".
-- Mọi đơn đặt sau khi login sẽ tự gắn với account và xem được ở mọi thiết bị.
