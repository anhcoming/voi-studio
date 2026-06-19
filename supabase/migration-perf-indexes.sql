-- =========================================================
-- PERFORMANCE — thêm index cho bảng orders & products
-- Chạy 1 lần trong Supabase ➜ SQL Editor ➜ New query ➜ Run
-- An toàn chạy lại nhiều lần (IF NOT EXISTS).
-- =========================================================

-- Admin sắp xếp đơn theo thời gian (mới nhất trước)
create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

-- Admin lọc đơn theo trạng thái
create index if not exists orders_status_idx
  on public.orders (status);

-- Lọc + sắp xếp đồng thời (vd: pending + mới nhất)
create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);

-- Tra đơn theo user đăng nhập (chỉ tạo nếu đã chạy migration-user-orders.sql)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id'
  ) then
    execute 'create index if not exists orders_user_id_idx
             on public.orders (user_id) where user_id is not null';
  end if;
end$$;

-- Khách thường chỉ thấy sản phẩm active = true → partial index nhỏ, nhanh
create index if not exists products_active_sort_idx
  on public.products (sort, created_at desc)
  where active = true;
