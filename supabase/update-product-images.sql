-- =========================================================
-- UPDATE ẢNH cho 71 SP — phiên bản PICSUM (reliable)
-- ---------------------------------------------------------
-- Nguồn ảnh: https://picsum.photos (Lorem Picsum)
--   • CDN siêu nhanh, không bị rate-limit, không cần API key
--   • Mỗi SP có ?seed riêng → ảnh khác nhau, stable (không đổi khi reload)
--   • Trade-off: ảnh là random (phong cảnh / object / người),
--     không phải apparel-themed. Để có ảnh đúng chủ đề, upload thật
--     qua trang admin (Sửa → chọn file) hoặc thay seed.
--
-- Lý do switch từ LoremFlickr → Picsum:
--   LoremFlickr ko stable từ phía Flickr (bị block API định kỳ).
--   Picsum không phụ thuộc Flickr, dùng CDN riêng, ổn định nhiều năm.
--
-- Chạy file này SAU seed-products.sql. Có thể chạy nhiều lần
-- (UPDATE idempotent — overwrite image_url cũ).
-- =========================================================

-- ============ ÁO THUN RELAXED FIT ============
update public.products set image_url = 'https://picsum.photos/seed/voi-1/600/750'  where name = 'Áo Thun Relaxed Fit Pour Over';
update public.products set image_url = 'https://picsum.photos/seed/voi-2/600/750'  where name = 'Áo Thun Relaxed Fit Monday Loading';
update public.products set image_url = 'https://picsum.photos/seed/voi-3/600/750'  where name = 'Áo Thun Relaxed Fit Cà Phê Phin';
update public.products set image_url = 'https://picsum.photos/seed/voi-4/600/750'  where name = 'Áo Thun Relaxed Fit Espresso Yourself';
update public.products set image_url = 'https://picsum.photos/seed/voi-5/600/750'  where name = 'Áo Thun Relaxed Fit Sunset 95';
update public.products set image_url = 'https://picsum.photos/seed/voi-6/600/750'  where name = 'Áo Thun Relaxed Fit Faded Polaroid';
update public.products set image_url = 'https://picsum.photos/seed/voi-7/600/750'  where name = 'Áo Thun Relaxed Fit Lost Tapes 88';
update public.products set image_url = 'https://picsum.photos/seed/voi-8/600/750'  where name = 'Áo Thun Relaxed Fit Timeless Legacy';
update public.products set image_url = 'https://picsum.photos/seed/voi-9/600/750'  where name = 'Áo Thun Relaxed Fit Yacht Club';
update public.products set image_url = 'https://picsum.photos/seed/voi-10/600/750' where name = 'Áo Thun Relaxed Fit Off The Limits';
update public.products set image_url = 'https://picsum.photos/seed/voi-11/600/750' where name = 'Áo Thun Relaxed Fit Hustle Hard';
update public.products set image_url = 'https://picsum.photos/seed/voi-12/600/750' where name = 'Áo Thun Relaxed Fit Lost In Space';
update public.products set image_url = 'https://picsum.photos/seed/voi-13/600/750' where name = 'Áo Thun Relaxed Fit Stars Aligned';
update public.products set image_url = 'https://picsum.photos/seed/voi-14/600/750' where name = 'Áo Thun Relaxed Fit Lazy Dachshund';
update public.products set image_url = 'https://picsum.photos/seed/voi-15/600/750' where name = 'Áo Thun Relaxed Fit Cool Cat Club';

-- ============ ÁO BA LỖ ============
update public.products set image_url = 'https://picsum.photos/seed/voi-16/600/750' where name = 'Áo Ba Lỗ Run Fast';
update public.products set image_url = 'https://picsum.photos/seed/voi-17/600/750' where name = 'Áo Ba Lỗ We Run The Distance';
update public.products set image_url = 'https://picsum.photos/seed/voi-18/600/750' where name = 'Áo Ba Lỗ Marathon Vibe';
update public.products set image_url = 'https://picsum.photos/seed/voi-19/600/750' where name = 'Áo Ba Lỗ Beach More Worry Less';
update public.products set image_url = 'https://picsum.photos/seed/voi-20/600/750' where name = 'Áo Ba Lỗ Let''s Go Beach';
update public.products set image_url = 'https://picsum.photos/seed/voi-21/600/750' where name = 'Áo Ba Lỗ Salt & Sand';
update public.products set image_url = 'https://picsum.photos/seed/voi-22/600/750' where name = 'Áo Ba Lỗ No Off Days';
update public.products set image_url = 'https://picsum.photos/seed/voi-23/600/750' where name = 'Áo Ba Lỗ Wild Soul';

-- ============ ÁO THUN RINGER ============
update public.products set image_url = 'https://picsum.photos/seed/voi-24/600/750' where name = 'Áo Thun Ringer Ocean Lovers';
update public.products set image_url = 'https://picsum.photos/seed/voi-25/600/750' where name = 'Áo Thun Ringer Crabby Days';
update public.products set image_url = 'https://picsum.photos/seed/voi-26/600/750' where name = 'Áo Thun Ringer Deep Blue';
update public.products set image_url = 'https://picsum.photos/seed/voi-27/600/750' where name = 'Áo Thun Ringer Mentally On The Beach';
update public.products set image_url = 'https://picsum.photos/seed/voi-28/600/750' where name = 'Áo Thun Ringer Athletic Club 76';
update public.products set image_url = 'https://picsum.photos/seed/voi-29/600/750' where name = 'Áo Thun Ringer Latte Days';

-- ============ ÁO POLO ============
update public.products set image_url = 'https://picsum.photos/seed/voi-30/600/750' where name = 'Áo Polo Relaxed Fit Timeless Legacy';
update public.products set image_url = 'https://picsum.photos/seed/voi-31/600/750' where name = 'Áo Polo Relaxed Fit Country Club';
update public.products set image_url = 'https://picsum.photos/seed/voi-32/600/750' where name = 'Áo Polo Relaxed Fit Heritage Polo';
update public.products set image_url = 'https://picsum.photos/seed/voi-33/600/750' where name = 'Áo Polo Relaxed Fit Red Heart';
update public.products set image_url = 'https://picsum.photos/seed/voi-34/600/750' where name = 'Áo Polo Relaxed Fit Tennis Club';
update public.products set image_url = 'https://picsum.photos/seed/voi-35/600/750' where name = 'Áo Polo Relaxed Fit POR Dachshund';
update public.products set image_url = 'https://picsum.photos/seed/voi-36/600/750' where name = 'Áo Polo Relaxed Fit Executive';

-- ============ ÁO THUN DÀI TAY ============
update public.products set image_url = 'https://picsum.photos/seed/voi-37/600/750' where name = 'Áo Thun Dài Tay Faded Memories';
update public.products set image_url = 'https://picsum.photos/seed/voi-38/600/750' where name = 'Áo Thun Dài Tay Old School';
update public.products set image_url = 'https://picsum.photos/seed/voi-39/600/750' where name = 'Áo Thun Dài Tay Moon Walker';
update public.products set image_url = 'https://picsum.photos/seed/voi-40/600/750' where name = 'Áo Thun Dài Tay Cosmic Drift';
update public.products set image_url = 'https://picsum.photos/seed/voi-41/600/750' where name = 'Áo Thun Dài Tay Outwork Everyone';

-- ============ ÁO HOODIE ============
update public.products set image_url = 'https://picsum.photos/seed/voi-42/600/750' where name = 'Áo Hoodie Stay Original';
update public.products set image_url = 'https://picsum.photos/seed/voi-43/600/750' where name = 'Áo Hoodie Limitless';
update public.products set image_url = 'https://picsum.photos/seed/voi-44/600/750' where name = 'Áo Hoodie Heritage Club';
update public.products set image_url = 'https://picsum.photos/seed/voi-45/600/750' where name = 'Áo Hoodie Ivy League';
update public.products set image_url = 'https://picsum.photos/seed/voi-46/600/750' where name = 'Áo Hoodie Teddy Bear Hug';
update public.products set image_url = 'https://picsum.photos/seed/voi-47/600/750' where name = 'Áo Hoodie Cuddle Up';
update public.products set image_url = 'https://picsum.photos/seed/voi-48/600/750' where name = 'Áo Hoodie Astronaut Mode';
update public.products set image_url = 'https://picsum.photos/seed/voi-49/600/750' where name = 'Áo Hoodie Cafe Hours';
update public.products set image_url = 'https://picsum.photos/seed/voi-50/600/750' where name = 'Áo Hoodie Track Day';
update public.products set image_url = 'https://picsum.photos/seed/voi-51/600/750' where name = 'Áo Hoodie 80s Drive';

-- ============ ÁO SWEATER ============
update public.products set image_url = 'https://picsum.photos/seed/voi-52/600/750' where name = 'Áo Sweater Country Club';
update public.products set image_url = 'https://picsum.photos/seed/voi-53/600/750' where name = 'Áo Sweater Cozy Teddy';
update public.products set image_url = 'https://picsum.photos/seed/voi-54/600/750' where name = 'Áo Sweater Knitwork';
update public.products set image_url = 'https://picsum.photos/seed/voi-55/600/750' where name = 'Áo Sweater Cardigan Days';
update public.products set image_url = 'https://picsum.photos/seed/voi-56/600/750' where name = 'Áo Sweater Starry Night';
update public.products set image_url = 'https://picsum.photos/seed/voi-57/600/750' where name = 'Áo Sweater Crewneck Classic';

-- ============ QUẦN JOGGER ============
update public.products set image_url = 'https://picsum.photos/seed/voi-58/600/750' where name = 'Quần Jogger Daily Jogger';
update public.products set image_url = 'https://picsum.photos/seed/voi-59/600/750' where name = 'Quần Jogger Track Pants';
update public.products set image_url = 'https://picsum.photos/seed/voi-60/600/750' where name = 'Quần Jogger Sport Tech';
update public.products set image_url = 'https://picsum.photos/seed/voi-61/600/750' where name = 'Quần Jogger Cargo Pants';
update public.products set image_url = 'https://picsum.photos/seed/voi-62/600/750' where name = 'Quần Jogger Tailored Sweat';
update public.products set image_url = 'https://picsum.photos/seed/voi-63/600/750' where name = 'Quần Jogger Lazy Sunday';

-- ============ TÚI TOTE ============
update public.products set image_url = 'https://picsum.photos/seed/voi-64/600/750' where name = 'Túi Tote Banana Puppy';
update public.products set image_url = 'https://picsum.photos/seed/voi-65/600/750' where name = 'Túi Tote Retro Leopard';
update public.products set image_url = 'https://picsum.photos/seed/voi-66/600/750' where name = 'Túi Tote Not Lazy';
update public.products set image_url = 'https://picsum.photos/seed/voi-67/600/750' where name = 'Túi Tote Coffee Tote';
update public.products set image_url = 'https://picsum.photos/seed/voi-68/600/750' where name = 'Túi Tote Library';
update public.products set image_url = 'https://picsum.photos/seed/voi-69/600/750' where name = 'Túi Tote Beach Bag';
update public.products set image_url = 'https://picsum.photos/seed/voi-70/600/750' where name = 'Túi Tote Moon Bag';
update public.products set image_url = 'https://picsum.photos/seed/voi-71/600/750' where name = 'Túi Tote Teddy Tote';

-- ============ KIỂM TRA ============
-- Sau khi chạy, kết quả mong đợi: 71
select count(*) as updated_count
  from public.products
  where image_url like 'https://picsum.photos/%';

-- Debug: nếu count < 71, có thể tên SP trong DB khác với UPDATE
-- (do chạy "Nhập dữ liệu mẫu" admin trước seed-products.sql).
-- Xem các SP CHƯA có ảnh:
-- select name, cat_key from public.products where image_url is null order by sort;
