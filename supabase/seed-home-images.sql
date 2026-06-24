-- =========================================================
-- Seed ảnh cho trang chủ — hero + category tiles + feature banners
-- ---------------------------------------------------------
-- Random pick từ pool ảnh đã upload (products.image_url Cloudinary),
-- apply transformation phù hợp aspect ratio mỗi vị trí.
--
-- Vị trí & transformation:
--   - Hero banner   (full width landscape):  w_1600,h_700,c_fill
--   - Category tile (portrait 4:5):          w_500,h_625,c_fill,dpr_auto
--   - Feature block banner (portrait 3:4):   w_700,h_900,c_fill,dpr_auto
--
-- Re-run safe — UPSERT vào key='home' trong site_settings.
-- =========================================================

with random_urls as (
  -- Random pool 10 URL từ products (đã optimize qua Cloudinary)
  select image_url, row_number() over (order by random()) as rn
  from public.products
  where image_url like 'https://res.cloudinary.com/%'
    and active = true
),
picks as (
  select
    max(case when rn = 1  then image_url end) as hero,
    max(case when rn = 2  then image_url end) as tile_aothun,
    max(case when rn = 3  then image_url end) as tile_hoodie,
    max(case when rn = 4  then image_url end) as tile_polo,
    max(case when rn = 5  then image_url end) as tile_tote,
    max(case when rn = 6  then image_url end) as block_aothun,
    max(case when rn = 7  then image_url end) as block_ringer,
    max(case when rn = 8  then image_url end) as block_polo,
    max(case when rn = 9  then image_url end) as block_balo,
    max(case when rn = 10 then image_url end) as block_hoodie
  from random_urls
)
insert into public.site_settings (key, value)
select 'home', jsonb_build_object(
  'heroHeadline',  '',
  'heroSub',       'VOISTUDIO — local brand streetwear cho người trẻ dám thể hiện chất riêng.',
  'heroCta',       'Khám phá bộ sưu tập',
  'heroCtaHref',   'collection.html',
  'heroImage',     regexp_replace(hero, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_1600,h_700,c_fill/'),

  'catTiles', jsonb_build_array(
    jsonb_build_object('key','ao-thun', 'image', regexp_replace(tile_aothun, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_500,h_625,c_fill,dpr_auto/')),
    jsonb_build_object('key','hoodie',  'image', regexp_replace(tile_hoodie, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_500,h_625,c_fill,dpr_auto/')),
    jsonb_build_object('key','polo',    'image', regexp_replace(tile_polo,   '/upload/[^/]*/', '/upload/f_auto,q_auto,w_500,h_625,c_fill,dpr_auto/')),
    jsonb_build_object('key','tote',    'image', regexp_replace(tile_tote,   '/upload/[^/]*/', '/upload/f_auto,q_auto,w_500,h_625,c_fill,dpr_auto/'))
  ),

  'featureBlocks', jsonb_build_array(
    jsonb_build_object(
      'eyebrow','Signature', 'title','Relaxed Fit',      'sub','Bán chạy nhất',
      'cta','Khám phá', 'href','collection.html?cat=ao-thun',
      'image', regexp_replace(block_aothun, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_700,h_900,c_fill,dpr_auto/'),
      'catKey','ao-thun', 'collection','Coffee Club', 'reverse', false
    ),
    jsonb_build_object(
      'eyebrow','Aesthetic', 'title','Ringer Tee',       'sub','Phong cách cổ điển',
      'cta','Mua ngay', 'href','collection.html?cat=ringer',
      'image', regexp_replace(block_ringer, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_700,h_900,c_fill,dpr_auto/'),
      'catKey','ringer', 'collection','Ocean Calling', 'reverse', true
    ),
    jsonb_build_object(
      'eyebrow','Pure comfort', 'title','Polo Relaxed',  'sub','Lịch sự mà thoải mái',
      'cta','Khám phá', 'href','collection.html?cat=polo',
      'image', regexp_replace(block_polo, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_700,h_900,c_fill,dpr_auto/'),
      'catKey','polo', 'collection','Old Money', 'reverse', false
    ),
    jsonb_build_object(
      'eyebrow','New drop', 'title','Tank Top',          'sub','Hè 2026',
      'cta','Khám phá', 'href','collection.html?cat=ba-lo',
      'image', regexp_replace(block_balo, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_700,h_900,c_fill,dpr_auto/'),
      'catKey','ba-lo', 'collection','', 'reverse', true
    ),
    jsonb_build_object(
      'eyebrow','Everyday', 'title','Hoodie & Sweater',  'sub','Ấm áp mỗi ngày',
      'cta','Khám phá', 'href','collection.html?cat=hoodie',
      'image', regexp_replace(block_hoodie, '/upload/[^/]*/', '/upload/f_auto,q_auto,w_700,h_900,c_fill,dpr_auto/'),
      'catKey','hoodie', 'collection','', 'reverse', false
    )
  ),

  -- Phần tĩnh (không liên quan ảnh, giữ cho hoàn chỉnh)
  'tickerHeader', jsonb_build_array(
    '🚚 Miễn phí giao hàng cho đơn từ 500.000₫',
    '⚡ Sale tới 50% toàn bộ sản phẩm',
    '↩ Đổi trả miễn phí trong 7 ngày',
    '✨ Hàng mới về mỗi tuần',
    '💬 Hỗ trợ tư vấn 24/7'
  ),
  'tickerBottom', jsonb_build_array('★ FREESHIP 500K','★ SALE 50%','★ NEW ARRIVALS'),
  'perks', jsonb_build_array(
    jsonb_build_object('icon','🚚', 'title','Freeship 500K',     'desc','Toàn quốc cho đơn từ 500.000₫'),
    jsonb_build_object('icon','↩',  'title','Đổi trả 7 ngày',    'desc','Đổi size, đổi mẫu dễ dàng'),
    jsonb_build_object('icon','✓',  'title','Chất liệu cao cấp', 'desc','Cotton 100% form relaxed'),
    jsonb_build_object('icon','💬', 'title','Hỗ trợ 24/7',       'desc','Nhắn tin là có phản hồi')
  ),
  'newsletterTitle', 'Đăng ký nhận ưu đãi',
  'newsletterSub',   'Nhập email để nhận mã giảm giá, quà tặng và tin sản phẩm mới nhất.'
)
from picks
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Verify
select
  key,
  value->>'heroImage' as hero,
  jsonb_array_length(value->'catTiles') as tile_count,
  jsonb_array_length(value->'featureBlocks') as block_count
from public.site_settings
where key = 'home';
