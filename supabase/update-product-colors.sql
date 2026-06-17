-- =========================================================
-- CẬP NHẬT MÀU cho TẤT CẢ sản phẩm hiện tại
-- Dán vào: Supabase ➜ SQL Editor ➜ New query ➜ Run
-- Mỗi SP sẽ có 5 màu: ĐEN + TRẮNG (nền) + 3 màu phụ xoay vòng (đa dạng giữa các SP).
-- Bảng màu lấy đúng từ palette vải của shop (assets/data.js → const C).
-- Chạy lại nhiều lần được (idempotent — ghi đè cột colors).
-- =========================================================

with pal(cols) as (
  -- 12 màu phụ (không gồm đen/trắng — 2 màu này luôn đặt làm nền ở đầu)
  values (array[
    '#e7ddca', -- cream
    '#9fb088', -- sage
    '#a7c4db', -- sky
    '#d8a441', -- mustard
    '#b5523a', -- brick
    '#2c3a4f', -- navy
    '#cbb89d', -- sand
    '#6f7445', -- olive
    '#e0b1b6', -- pink
    '#b6b6b0', -- grey
    '#3f5c46', -- forest
    '#6e2f33'  -- maroon
  ])
),
n as (
  select id, (row_number() over (order by sort, created_at))::int as rn
  from public.products
)
update public.products p
set colors = (
  select jsonb_build_array(
    '#1c1c1c',                              -- đen (nền)
    '#f0ede6',                              -- trắng (nền)
    cols[1 + ((n.rn * 3)     % 12)],        -- 3 màu phụ xoay vòng theo từng SP
    cols[1 + ((n.rn * 3 + 1) % 12)],
    cols[1 + ((n.rn * 3 + 5) % 12)]
  )
  from pal
)
from n
where p.id = n.id;

-- =========================================================
-- (TUỲ CHỌN) Chỉ bù màu cho SP đang có ÍT HƠN 3 màu, GIỮ NGUYÊN SP đã đủ màu.
-- Nếu muốn dùng cách này thay vì ghi đè tất cả: thêm điều kiện dưới vào WHERE ở trên:
--   and jsonb_array_length(coalesce(p.colors,'[]'::jsonb)) < 3
-- =========================================================

-- =========================================================
-- KIỂM TRA: xem số màu của vài sản phẩm
-- =========================================================
select name,
       jsonb_array_length(colors) as so_mau,
       colors
from public.products
order by sort, created_at
limit 20;
