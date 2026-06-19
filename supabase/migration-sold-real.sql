-- =========================================================
-- Migration: tách lượt bán thật vs lượt bán ảo
-- - sold       (column cũ): hiển thị cho KHÁCH (admin có thể fake/boost)
-- - sold_real  (mới):       lượt bán thực tế, chỉ admin thấy. Có thể compute
--                           từ orders.completed hoặc admin tự nhập.
-- =========================================================

alter table public.products
  add column if not exists sold_real int not null default 0;

-- (tuỳ chọn) Recompute sold_real từ đơn hoàn thành. Bỏ comment để chạy 1 lần.
-- update public.products p set sold_real = (
--   select coalesce(sum((it->>'qty')::int),0)
--   from public.orders o, jsonb_array_elements(o.items) it
--   where o.status='completed' and (it->>'id')::uuid = p.id
-- );
