-- =========================================================
-- Tối ưu URL Cloudinary đã có trong DB — thêm resize transformations
-- ---------------------------------------------------------
-- Chuyển: .../upload/f_auto,q_auto/...   (chỉ format + quality, KHÔNG resize)
--   sang: .../upload/f_auto,q_auto,w_600,h_750,c_fill,dpr_auto/...
--
-- Giảm size ảnh từ ~1-2MB xuống ~30-80KB. Load nhanh 10-30 lần.
-- Re-run safe — chỉ update URL chưa có w_600 trong path.
-- =========================================================

-- 1) URL đã có f_auto,q_auto nhưng chưa resize → thêm w_600,h_750,c_fill,dpr_auto
update public.products
set image_url = replace(
  image_url,
  '/upload/f_auto,q_auto/',
  '/upload/f_auto,q_auto,w_600,h_750,c_fill,dpr_auto/'
)
where image_url like '%/upload/f_auto,q_auto/%'
  and image_url not like '%w_600%';

-- 2) URL Cloudinary "raw" không có transformations gì → thêm full set
update public.products
set image_url = replace(
  image_url,
  '/upload/',
  '/upload/f_auto,q_auto,w_600,h_750,c_fill,dpr_auto/'
)
where image_url like 'https://res.cloudinary.com/%'
  and image_url not like '%/upload/f_%'
  and image_url not like '%/upload/q_%'
  and image_url not like '%/upload/w_%';

-- 3) Áp dụng cho cột `images` (jsonb array) — gallery có nhiều ảnh
-- Loop qua từng phần tử, replace nếu cần
update public.products
set images = (
  select jsonb_agg(
    case
      when (item ->> 0) like '%/upload/f_auto,q_auto/%' and (item ->> 0) not like '%w_600%' then
        to_jsonb(replace((item ->> 0), '/upload/f_auto,q_auto/', '/upload/f_auto,q_auto,w_600,h_750,c_fill,dpr_auto/'))
      when (item ->> 0) like 'https://res.cloudinary.com/%' and (item ->> 0) not like '%/upload/f_%' and (item ->> 0) not like '%w_600%' then
        to_jsonb(replace((item ->> 0), '/upload/', '/upload/f_auto,q_auto,w_600,h_750,c_fill,dpr_auto/'))
      else item
    end
  )
  from jsonb_array_elements(images) as item
)
where images is not null
  and jsonb_typeof(images) = 'array'
  and jsonb_array_length(images) > 0
  and images::text like '%res.cloudinary.com%';

-- 4) Verify
select
  count(*) filter (where image_url like '%w_600%') as optimized,
  count(*) filter (where image_url like 'https://res.cloudinary.com/%' and image_url not like '%w_600%') as still_unoptimized,
  count(*) as total_cloudinary
from public.products
where image_url like 'https://res.cloudinary.com/%';

-- Mong đợi: optimized = total_cloudinary, still_unoptimized = 0.
-- Nếu still_unoptimized > 0 → có URL pattern lạ, t check riêng:
-- select image_url from public.products
--   where image_url like 'https://res.cloudinary.com/%' and image_url not like '%w_600%' limit 5;
