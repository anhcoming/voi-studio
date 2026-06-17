-- =========================================================
-- SEED DATA — Sản phẩm VOISTUDIO (~70 SP thật để insert)
-- ---------------------------------------------------------
-- Chạy 1 LẦN: Supabase → SQL Editor → New query → paste → Run.
--
-- 9 danh mục × 10 bộ sưu tập, có biến thể:
--   • Stock 50 mặc định, 80 cho hàng bán chạy, 12-18 cho "sắp hết"
--   • Stock 0 cho "hết hàng" (test badge sold-out)
--   • image_url = NULL → website tự vẽ ảnh SVG theo màu vải
--   • Một số SP active=false (chưa lên kệ) để test toggle ẩn
--
-- ⚠️ Chạy 2 lần sẽ duplicate. Muốn reset trước khi seed,
--    bỏ comment dòng "truncate" ở dưới.
-- =========================================================

-- (Optional) Xóa toàn bộ SP cũ trước khi seed — bỏ comment nếu muốn:
-- truncate table public.products restart identity cascade;

insert into public.products
  (name, print, cat_key, collection, price, compare, colors, sizes, stock, active, sort) values

-- ============ ÁO THUN RELAXED FIT (ao-thun) — 15 SP ============
('Áo Thun Relaxed Fit Pour Over',              'POUR OVER',       'ao-thun', 'Coffee Club',       165000, 318000, '["#1c1c1c","#e7ddca","#9fb088"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 1),
('Áo Thun Relaxed Fit Monday Loading',         'MONDAY LOADING',  'ao-thun', 'Coffee Club',       165000, 318000, '["#f0ede6","#2c3a4f","#d8a441"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 50, true, 2),
('Áo Thun Relaxed Fit Cà Phê Phin',            'CÀ PHÊ PHIN',     'ao-thun', 'Coffee Club',       165000, 318000, '["#1c1c1c","#e7ddca"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 3),
('Áo Thun Relaxed Fit Espresso Yourself',      'ESPRESSO',        'ao-thun', 'Coffee Club',       175000, 318000, '["#e7ddca","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 18, true, 4),
('Áo Thun Relaxed Fit Sunset 95',              'SUNSET ''95',     'ao-thun', 'Vintage Vibes',     165000, 318000, '["#cbb89d","#b5523a","#2c3a4f"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 50, true, 5),
('Áo Thun Relaxed Fit Faded Polaroid',         'POLAROID',        'ao-thun', 'Vintage Vibes',     169000, 318000, '["#e7ddca","#9fb088"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 6),
('Áo Thun Relaxed Fit Lost Tapes 88',          'LOST TAPES',      'ao-thun', 'Vintage Vibes',     169000, 318000, '["#f0ede6","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 0,  true, 7),
('Áo Thun Relaxed Fit Timeless Legacy',        'LEGACY',          'ao-thun', 'Old Money',         189000, 350000, '["#e7ddca","#3f5c46"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 8),
('Áo Thun Relaxed Fit Yacht Club',             'YACHT CLUB',      'ao-thun', 'Old Money',         189000, 350000, '["#f0ede6","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 9),
('Áo Thun Relaxed Fit Off The Limits',         'OFF LIMITS',      'ao-thun', 'Built Different',   165000, 318000, '["#1c1c1c","#6f7445","#f0ede6"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 10),
('Áo Thun Relaxed Fit Hustle Hard',            'HUSTLE',          'ao-thun', 'Built Different',   165000, 318000, '["#1c1c1c","#b6b6b0"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 11),
('Áo Thun Relaxed Fit Lost In Space',          'GALACTIC',        'ao-thun', 'Galactic Odyssey',  179000, 338000, '["#2c3a4f","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 12),
('Áo Thun Relaxed Fit Stars Aligned',          'STARS',           'ao-thun', 'Galactic Odyssey',  179000, 338000, '["#2c3a4f","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 12, true, 13),
('Áo Thun Relaxed Fit Lazy Dachshund',         'LAZY DOG',        'ao-thun', 'Animal Mood',       165000, 318000, '["#d8a441","#e7ddca"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 14),
('Áo Thun Relaxed Fit Cool Cat Club',          'COOL CAT',        'ao-thun', 'Animal Mood',       165000, 318000, '["#9fb088","#f0ede6"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 15),

-- ============ ÁO BA LỖ (ba-lo) — 8 SP ============
('Áo Ba Lỗ Run Fast',                          'RUN FAST',        'ba-lo',   'Racer Core',        165000, 318000, '["#f0ede6","#1c1c1c","#b5523a"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 16),
('Áo Ba Lỗ We Run The Distance',               'DISTANCE',        'ba-lo',   'Racer Core',        165000, 318000, '["#1c1c1c","#9fb088"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 17),
('Áo Ba Lỗ Marathon Vibe',                     'MARATHON',        'ba-lo',   'Racer Core',        169000, 318000, '["#f0ede6","#d8a441"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 18),
('Áo Ba Lỗ Beach More Worry Less',             'BEACH MODE',      'ba-lo',   'Summer Vibes',      165000, 318000, '["#a7c4db","#e7ddca","#d8a441"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 50, true, 19),
('Áo Ba Lỗ Let''s Go Beach',                   'LET''S GO',       'ba-lo',   'Summer Vibes',      165000, 318000, '["#cbb89d","#a7c4db"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 20),
('Áo Ba Lỗ Salt & Sand',                       'SALT SAND',       'ba-lo',   'Summer Vibes',      169000, 318000, '["#e7ddca","#b5523a"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 15, true, 21),
('Áo Ba Lỗ No Off Days',                       'NO OFF DAYS',     'ba-lo',   'Built Different',   169000, 318000, '["#1c1c1c","#6f7445"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 0,  true, 22),
('Áo Ba Lỗ Wild Soul',                         'WILD',            'ba-lo',   'Animal Mood',       165000, 318000, '["#3f5c46","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 23),

-- ============ ÁO THUN RINGER (ringer) — 6 SP ============
('Áo Thun Ringer Ocean Lovers',                'OCEAN LOVERS',    'ringer',  'Ocean Calling',     169000, 338000, '["#f0ede6","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 80, true, 24),
('Áo Thun Ringer Crabby Days',                 'CRABBY DAYS',     'ringer',  'Ocean Calling',     169000, 338000, '["#e7ddca","#b5523a"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 25),
('Áo Thun Ringer Deep Blue',                   'DEEP BLUE',       'ringer',  'Ocean Calling',     175000, 338000, '["#f0ede6","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 26),
('Áo Thun Ringer Mentally On The Beach',       'ON THE BEACH',    'ringer',  'Summer Vibes',      169000, 338000, '["#f0ede6","#a7c4db"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 27),
('Áo Thun Ringer Athletic Club 76',            'ATHLETIC ''76',   'ringer',  'Vintage Vibes',     175000, 338000, '["#e7ddca","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 12, true, 28),
('Áo Thun Ringer Latte Days',                  'LATTE',           'ringer',  'Coffee Club',       169000, 338000, '["#e7ddca","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 29),

-- ============ ÁO POLO RELAXED FIT (polo) — 7 SP ============
('Áo Polo Relaxed Fit Timeless Legacy',        'O.M.',            'polo',    'Old Money',         189000, 350000, '["#e7ddca","#2c3a4f","#3f5c46"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 30),
('Áo Polo Relaxed Fit Country Club',           'COUNTRY CLUB',    'polo',    'Old Money',         189000, 350000, '["#f0ede6","#3f5c46"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 31),
('Áo Polo Relaxed Fit Heritage Polo',          'HERITAGE',        'polo',    'Old Money',         199000, 360000, '["#2c3a4f","#b6b6b0"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 32),
('Áo Polo Relaxed Fit Red Heart',              '♥ VINTAGE',       'polo',    'Vintage Vibes',     179000, 350000, '["#f0ede6","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 0,  true, 33),
('Áo Polo Relaxed Fit Tennis Club',            'TENNIS',          'polo',    'Vintage Vibes',     179000, 350000, '["#f0ede6","#9fb088"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 34),
('Áo Polo Relaxed Fit POR Dachshund',          'DACHSHUND',       'polo',    'Animal Mood',       179000, 350000, '["#9fb088","#e7ddca"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 35),
('Áo Polo Relaxed Fit Executive',              'EXECUTIVE',       'polo',    'Built Different',   199000, 360000, '["#1c1c1c","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 15, true, 36),

-- ============ ÁO THUN DÀI TAY (dai-tay) — 5 SP ============
('Áo Thun Dài Tay Faded Memories',             'FADED',           'dai-tay', 'Vintage Vibes',     199000, 390000, '["#cbb89d","#2c3a4f","#1c1c1c"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 50, true, 37),
('Áo Thun Dài Tay Old School',                 'OLD SCHOOL',      'dai-tay', 'Vintage Vibes',     199000, 390000, '["#e7ddca","#b5523a"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 38),
('Áo Thun Dài Tay Moon Walker',                'MOON WALKER',     'dai-tay', 'Galactic Odyssey',  209000, 410000, '["#1c1c1c","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 80, true, 39),
('Áo Thun Dài Tay Cosmic Drift',               'COSMIC',          'dai-tay', 'Galactic Odyssey',  209000, 410000, '["#2c3a4f","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 18, true, 40),
('Áo Thun Dài Tay Outwork Everyone',           'OUTWORK',         'dai-tay', 'Built Different',   199000, 390000, '["#1c1c1c","#6f7445"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 41),

-- ============ ÁO HOODIE (hoodie) — 10 SP ============
('Áo Hoodie Stay Original',                    'STAY ORIGINAL',   'hoodie',  'Built Different',   359000, 590000, '["#1c1c1c","#e7ddca","#6f7445"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 42),
('Áo Hoodie Limitless',                        'LIMITLESS',       'hoodie',  'Built Different',   369000, 590000, '["#1c1c1c","#b6b6b0"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 43),
('Áo Hoodie Heritage Club',                    'HERITAGE',        'hoodie',  'Old Money',         379000, 620000, '["#2c3a4f","#b6b6b0"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 44),
('Áo Hoodie Ivy League',                       'IVY',             'hoodie',  'Old Money',         379000, 620000, '["#3f5c46","#e7ddca"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 15, true, 45),
('Áo Hoodie Teddy Bear Hug',                   'TEDDY',           'hoodie',  'Teddy Land',        389000, 650000, '["#e7ddca","#b5523a"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 46),
('Áo Hoodie Cuddle Up',                        'CUDDLE',          'hoodie',  'Teddy Land',        389000, 650000, '["#cbb89d","#e0b1b6"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 47),
('Áo Hoodie Astronaut Mode',                   'ASTRONAUT',       'hoodie',  'Galactic Odyssey',  399000, 680000, '["#2c3a4f","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 80, true, 48),
('Áo Hoodie Cafe Hours',                       'CAFE HOURS',      'hoodie',  'Coffee Club',       359000, 590000, '["#e7ddca","#6f7445"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 49),
('Áo Hoodie Track Day',                        'TRACK DAY',       'hoodie',  'Racer Core',        369000, 590000, '["#1c1c1c","#9fb088"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 0,  true, 50),
('Áo Hoodie 80s Drive',                        '80S DRIVE',       'hoodie',  'Vintage Vibes',     379000, 620000, '["#6e2f33","#2c3a4f"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 12, true, 51),

-- ============ ÁO SWEATER (sweater) — 6 SP ============
('Áo Sweater Country Club',                    'COUNTRY CLUB',    'sweater', 'Old Money',         329000, 550000, '["#e7ddca","#3f5c46","#2c3a4f"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 52),
('Áo Sweater Cozy Teddy',                      'COZY',            'sweater', 'Teddy Land',        329000, 550000, '["#cbb89d","#e0b1b6"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 53),
('Áo Sweater Knitwork',                        'KNITWORK',        'sweater', 'Old Money',         349000, 580000, '["#e7ddca","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 18, true, 54),
('Áo Sweater Cardigan Days',                   'CARDIGAN',        'sweater', 'Vintage Vibes',     349000, 580000, '["#3f5c46","#6e2f33"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 55),
('Áo Sweater Starry Night',                    'STARRY',          'sweater', 'Galactic Odyssey',  339000, 560000, '["#2c3a4f","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 56),
('Áo Sweater Crewneck Classic',                'CLASSIC',         'sweater', 'Built Different',   329000, 550000, '["#b6b6b0","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 57),

-- ============ QUẦN JOGGER (jogger) — 6 SP ============
('Quần Jogger Daily Jogger',                   'VOISTUDIO',       'jogger',  'Built Different',   289000, 450000, '["#1c1c1c","#b6b6b0","#6f7445"]'::jsonb, '["S","M","L","XL","2XL"]'::jsonb, 80, true, 58),
('Quần Jogger Track Pants',                    'TRACK',           'jogger',  'Racer Core',        289000, 450000, '["#2c3a4f","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 59),
('Quần Jogger Sport Tech',                     'TECH',            'jogger',  'Racer Core',        299000, 470000, '["#b6b6b0","#1c1c1c"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 0,  true, 60),
('Quần Jogger Cargo Pants',                    'CARGO',           'jogger',  'Built Different',   319000, 490000, '["#6f7445","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 61),
('Quần Jogger Tailored Sweat',                 'TAILORED',        'jogger',  'Old Money',         319000, 490000, '["#2c3a4f","#b6b6b0"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 15, true, 62),
('Quần Jogger Lazy Sunday',                    'LAZY',            'jogger',  'Coffee Club',       289000, 450000, '["#e7ddca","#cbb89d"]'::jsonb,           '["S","M","L","XL","2XL"]'::jsonb, 50, true, 63),

-- ============ TÚI TOTE (tote) — 8 SP ============
('Túi Tote Banana Puppy',                      'BANANA PUPPY',    'tote',    'Animal Mood',       135000, 225000, '["#e7ddca"]'::jsonb,                     '["Freesize"]'::jsonb,             80, true, 64),
('Túi Tote Retro Leopard',                     'RETRO',           'tote',    'Vintage Vibes',     135000, 225000, '["#cbb89d"]'::jsonb,                     '["Freesize"]'::jsonb,             50, true, 65),
('Túi Tote Not Lazy',                          'NOT LAZY',        'tote',    'Built Different',   135000, 225000, '["#f0ede6"]'::jsonb,                     '["Freesize"]'::jsonb,             50, true, 66),
('Túi Tote Coffee Tote',                       'COFFEE TOTE',     'tote',    'Coffee Club',       139000, 225000, '["#e7ddca"]'::jsonb,                     '["Freesize"]'::jsonb,             50, true, 67),
('Túi Tote Library',                           'LIBRARY',         'tote',    'Old Money',         145000, 240000, '["#3f5c46"]'::jsonb,                     '["Freesize"]'::jsonb,             18, true, 68),
('Túi Tote Beach Bag',                         'BEACH',           'tote',    'Summer Vibes',      135000, 225000, '["#a7c4db"]'::jsonb,                     '["Freesize"]'::jsonb,             50, true, 69),
('Túi Tote Moon Bag',                          'MOON BAG',        'tote',    'Galactic Odyssey',  145000, 240000, '["#2c3a4f"]'::jsonb,                     '["Freesize"]'::jsonb,             0,  true, 70),
('Túi Tote Teddy Tote',                        'TEDDY TOTE',      'tote',    'Teddy Land',        139000, 225000, '["#e0b1b6"]'::jsonb,                     '["Freesize"]'::jsonb,             50, true, 71);

-- ============ KẾT QUẢ ============
-- Tổng: 71 sản phẩm
-- Bán chạy (stock 80): 11 SP
-- Stock 50 mặc định: 47 SP
-- Sắp hết (12-18): 9 SP
-- Hết hàng (0): 4 SP — để test badge "Hết hàng"
-- Tất cả active=true; image_url=NULL nên web tự vẽ ảnh SVG.
--
-- Sau khi chạy: vào trang chủ → thấy đầy đủ SP. Admin → tab
-- Sản phẩm → có thể sửa giá, tồn kho, upload ảnh thật, v.v.
