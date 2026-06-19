-- =========================================================
-- FAKE seed: gán số liệu "đã bán" cho toàn bộ sản phẩm.
-- - sold (ảo, hiển thị cho khách): random 80..5000 — nhìn cho "sống"
-- - sold_real (thật, chỉ admin): random 5..200 — số nhỏ hơn rõ rệt
-- Chỉ ghi đè khi sold đang = 0 (lần đầu seed) để không phá tay admin.
-- Bỏ điều kiện `where sold=0` nếu muốn reset toàn bộ.
-- =========================================================

update public.products
set
  sold      = 80  + floor(random() * 4920)::int,   -- 80..4999
  sold_real = 5   + floor(random() * 195)::int     -- 5..199
where sold = 0;

-- Nếu chỉ muốn gán cho 1 SP cụ thể, dùng:
-- update public.products set sold = 1234, sold_real = 87 where id = '<uuid>';

-- Tăng/giảm sold ảo theo phần trăm (vd: + 20%):
-- update public.products set sold = (sold * 1.2)::int;

-- Đồng bộ sold_real từ orders.completed (chính xác):
-- update public.products p set sold_real = coalesce((
--   select sum((it->>'qty')::int)
--   from public.orders o cross join jsonb_array_elements(o.items) it
--   where o.status = 'completed' and (it->>'id')::uuid = p.id
-- ), 0);
