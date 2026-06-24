-- =========================================================
-- UPDATE ẢNH cho 71 SP — phiên bản UNSPLASH (apparel-themed)
-- ---------------------------------------------------------
-- Nguồn ảnh: Unsplash (license: free commercial, no attribution required)
--   https://unsplash.com/license
--
-- URL pattern dùng: images.unsplash.com/photo-{ID}?w=600&h=750&fit=crop&q=80&auto=format
--   • &fit=crop  → crop 600×750 thay vì resize fit (giữ aspect 4/5)
--   • &q=80      → JPEG quality, đẹp + nhẹ
--   • &auto=format → tự serve WebP/AVIF cho browser hỗ trợ
--
-- CẢNH BÁO: list URLs này KHÔNG được verify ở thời điểm tạo file (môi trường
-- code không browse được internet). 1-2 photo có thể đã bị Unsplash gỡ xuống
-- → 404. Sau khi chạy SQL, kiểm tra trang web — nếu thấy ảnh xám/broken,
-- swap URL bằng cách:
--   1) Vào https://unsplash.com/s/photos/<tên-category>
--   2) Click vào 1 ảnh, copy URL dạng "https://images.unsplash.com/photo-XXX"
--   3) Paste vào UPDATE statement tương ứng.
-- Hoặc fallback: dùng file update-product-images.sql (Picsum, 100% stable).
--
-- Chạy file này SAU seed-products.sql. UPDATE idempotent — re-run an toàn.
-- =========================================================

-- ============ ÁO THUN RELAXED FIT (15 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Pour Over';
update public.products set image_url = 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Monday Loading';
update public.products set image_url = 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Cà Phê Phin';
update public.products set image_url = 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Espresso Yourself';
update public.products set image_url = 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Sunset 95';
update public.products set image_url = 'https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Faded Polaroid';
update public.products set image_url = 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Lost Tapes 88';
update public.products set image_url = 'https://images.unsplash.com/photo-1565693413579-8a73c7c4a4d3?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Timeless Legacy';
update public.products set image_url = 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Yacht Club';
update public.products set image_url = 'https://images.unsplash.com/photo-1542220698-7f6d4e25be77?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Off The Limits';
update public.products set image_url = 'https://images.unsplash.com/photo-1599054735388-bcb07bcd3aa7?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Hustle Hard';
update public.products set image_url = 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Lost In Space';
update public.products set image_url = 'https://images.unsplash.com/photo-1611312449408-fcece27cdbb7?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Stars Aligned';
update public.products set image_url = 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Lazy Dachshund';
update public.products set image_url = 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Relaxed Fit Cool Cat Club';

-- ============ ÁO BA LỖ (8 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1532009324734-20a7a5813719?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Run Fast';
update public.products set image_url = 'https://images.unsplash.com/photo-1546470427-227df1e3a39e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ We Run The Distance';
update public.products set image_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Marathon Vibe';
update public.products set image_url = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Beach More Worry Less';
update public.products set image_url = 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Let''s Go Beach';
update public.products set image_url = 'https://images.unsplash.com/photo-1583505291317-3c1e63ed6e72?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Salt & Sand';
update public.products set image_url = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ No Off Days';
update public.products set image_url = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Ba Lỗ Wild Soul';

-- ============ ÁO THUN RINGER (5 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Ocean Lovers';
update public.products set image_url = 'https://images.unsplash.com/photo-1606768666853-403c90a981ad?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Crabby Days';
update public.products set image_url = 'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Deep Blue';
update public.products set image_url = 'https://images.unsplash.com/photo-1581087707598-9d0ec7d9b9f2?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Mentally On The Beach';
update public.products set image_url = 'https://images.unsplash.com/photo-1620799139651-3a45a833e54a?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Athletic Club 76';
update public.products set image_url = 'https://images.unsplash.com/photo-1610502123988-a0c19c4f0d3d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Ringer Latte Days';

-- ============ ÁO POLO (7 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Timeless Legacy';
update public.products set image_url = 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Country Club';
update public.products set image_url = 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Heritage Polo';
update public.products set image_url = 'https://images.unsplash.com/photo-1599391398131-cd12dfc6c24e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Red Heart';
update public.products set image_url = 'https://images.unsplash.com/photo-1602810316693-3667c854239a?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Tennis Club';
update public.products set image_url = 'https://images.unsplash.com/photo-1612874740875-94e2d0f87e88?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit POR Dachshund';
update public.products set image_url = 'https://images.unsplash.com/photo-1620891549027-94e8c5fcb09e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Polo Relaxed Fit Executive';

-- ============ ÁO THUN DÀI TAY (5 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Dài Tay Faded Memories';
update public.products set image_url = 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Dài Tay Old School';
update public.products set image_url = 'https://images.unsplash.com/photo-1610288311716-c0c2bf3ae8a7?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Dài Tay Moon Walker';
update public.products set image_url = 'https://images.unsplash.com/photo-1584208632869-05fa2b2a5934?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Dài Tay Cosmic Drift';
update public.products set image_url = 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Thun Dài Tay Outwork Everyone';

-- ============ ÁO HOODIE (10 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Stay Original';
update public.products set image_url = 'https://images.unsplash.com/photo-1614495039944-c0586bda7b7c?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Limitless';
update public.products set image_url = 'https://images.unsplash.com/photo-1542406775-ade58c52d2e4?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Heritage Club';
update public.products set image_url = 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Ivy League';
update public.products set image_url = 'https://images.unsplash.com/photo-1599050751795-2c3aef39b1f9?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Teddy Bear Hug';
update public.products set image_url = 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Cuddle Up';
update public.products set image_url = 'https://images.unsplash.com/photo-1564938966-7d54f0e2f74e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Astronaut Mode';
update public.products set image_url = 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Cafe Hours';
update public.products set image_url = 'https://images.unsplash.com/photo-1601007575076-aa68f5d6e21f?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie Track Day';
update public.products set image_url = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Hoodie 80s Drive';

-- ============ ÁO SWEATER (6 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Country Club';
update public.products set image_url = 'https://images.unsplash.com/photo-1584208632869-05fa2b2a5934?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Cozy Teddy';
update public.products set image_url = 'https://images.unsplash.com/photo-1620891549027-94e8c5fcb09e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Knitwork';
update public.products set image_url = 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Cardigan Days';
update public.products set image_url = 'https://images.unsplash.com/photo-1610288311716-c0c2bf3ae8a7?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Starry Night';
update public.products set image_url = 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Áo Sweater Crewneck Classic';

-- ============ QUẦN JOGGER (6 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Daily Jogger';
update public.products set image_url = 'https://images.unsplash.com/photo-1518109526476-6e5cebbb6f23?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Track Pants';
update public.products set image_url = 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Sport Tech';
update public.products set image_url = 'https://images.unsplash.com/photo-1605408499391-6368c628ef42?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Cargo Pants';
update public.products set image_url = 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Tailored Sweat';
update public.products set image_url = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Quần Jogger Lazy Sunday';

-- ============ TÚI TOTE (8 sp) ============
update public.products set image_url = 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Banana Puppy';
update public.products set image_url = 'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Retro Leopard';
update public.products set image_url = 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Not Lazy';
update public.products set image_url = 'https://images.unsplash.com/photo-1564422170194-896b89110ef8?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Coffee Tote';
update public.products set image_url = 'https://images.unsplash.com/photo-1601007575076-aa68f5d6e21f?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Library';
update public.products set image_url = 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Beach Bag';
update public.products set image_url = 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Moon Bag';
update public.products set image_url = 'https://images.unsplash.com/photo-1564938966-7d54f0e2f74e?w=600&h=750&fit=crop&q=80&auto=format' where name = 'Túi Tote Teddy Tote';

-- =========================================================
-- KIỂM TRA SAU KHI CHẠY
-- =========================================================
-- Mong đợi: 71 dòng có image_url Unsplash.
select count(*) as unsplash_count
  from public.products
  where image_url like 'https://images.unsplash.com/%';

-- Nếu count < 71 → có SP chưa match (do tên DB khác seed).
-- Xem danh sách SP chưa có ảnh:
select name, cat_key
  from public.products
  where image_url is null or image_url not like 'https://images.unsplash.com/%'
  order by sort;

-- =========================================================
-- HƯỚNG DẪN SWAP URL BỊ 404
-- =========================================================
-- Nếu thấy ảnh trắng/broken cho 1 SP:
--   1) https://unsplash.com/s/photos/<keyword> (vd: tshirt, hoodie, polo)
--   2) Click ảnh ưng → URL trên address bar dạng:
--      https://unsplash.com/photos/some-title-XXXXXXXX
--      photo ID nằm sau dấu / cuối: chuỗi XXXXXXXX (~11 ký tự)
--      Hoặc click nút Download → URL ảnh thật bắt đầu bằng
--      https://images.unsplash.com/photo-YYYYYYYY → copy đoạn YYYYYYYY
--   3) Chạy:
--      update public.products
--      set image_url = 'https://images.unsplash.com/photo-YYYYYYYY?w=600&h=750&fit=crop&q=80&auto=format'
--      where name = 'Tên SP';
--
-- Fallback toàn bộ về Picsum (100% stable, nhưng ảnh random):
--   Chạy lại file update-product-images.sql
-- =========================================================
