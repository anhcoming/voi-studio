-- =========================================================
-- Migration: Mã giảm giá / Voucher
-- Chạy MỘT LẦN trong Supabase ➜ SQL Editor ➜ New query.
-- An toàn re-run (dùng `if not exists`).
-- =========================================================

-- 1) BẢNG VOUCHER -----------------------------------------
create table if not exists public.vouchers (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,                  -- vd "SALE10", "FREESHIP", uppercase
  description     text,                                  -- mô tả ngắn cho admin
  discount_type   text not null check (discount_type in ('percent','fixed','freeship')),
  discount_value  int  not null default 0,               -- percent: 1-100, fixed: VND, freeship: bỏ qua
  min_order       int  not null default 0,               -- đơn tối thiểu (VND)
  max_discount    int,                                   -- trần giảm cho % (vd 50% nhưng tối đa 50k); null=không trần
  max_uses        int,                                   -- tổng số lần dùng được; null = vô hạn
  used_count      int  not null default 0,
  starts_at       timestamptz,                           -- null = từ giờ
  expires_at      timestamptz,                           -- null = vô hạn
  active          boolean not null default true,
  created_at      timestamptz default now()
);

create index if not exists vouchers_code_idx on public.vouchers(code);
create index if not exists vouchers_active_idx on public.vouchers(active, expires_at);

-- 2) BỔ SUNG CỘT VÀO ORDERS để track voucher đã dùng ------
alter table public.orders
  add column if not exists voucher_code     text,
  add column if not exists voucher_discount int default 0;   -- số tiền đã giảm (VND), để báo cáo

-- 3) RLS --------------------------------------------------
alter table public.vouchers enable row level security;
drop policy if exists "vouchers read"  on public.vouchers;
drop policy if exists "vouchers write" on public.vouchers;
-- Khách KHÔNG được list toàn bộ voucher → tránh lộ danh sách. Họ chỉ check qua RPC.
-- Admin được CRUD.
create policy "vouchers read"  on public.vouchers for select using (public.is_admin());
create policy "vouchers write" on public.vouchers for all
  using (public.is_admin()) with check (public.is_admin());

-- 4) RPC: check voucher cho khách (không cần login) -------
-- Input: code + subtotal. Output: object {valid, message, discount, voucher_id, code, type}
-- KHÔNG trừ tồn voucher ở đây — chỉ trừ khi đặt đơn thật (RPC apply_voucher).
create or replace function public.check_voucher(p_code text, p_subtotal int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  d int := 0;
  now_ts timestamptz := now();
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá trống');
  end if;
  select * into v from public.vouchers where code = upper(trim(p_code)) limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Mã giảm giá không tồn tại');
  end if;
  if not v.active then
    return jsonb_build_object('valid', false, 'message', 'Mã đã bị tắt');
  end if;
  if v.starts_at is not null and now_ts < v.starts_at then
    return jsonb_build_object('valid', false, 'message', 'Mã chưa có hiệu lực');
  end if;
  if v.expires_at is not null and now_ts > v.expires_at then
    return jsonb_build_object('valid', false, 'message', 'Mã đã hết hạn');
  end if;
  if v.max_uses is not null and v.used_count >= v.max_uses then
    return jsonb_build_object('valid', false, 'message', 'Mã đã hết lượt dùng');
  end if;
  if p_subtotal < v.min_order then
    return jsonb_build_object('valid', false,
      'message', 'Đơn tối thiểu ' || to_char(v.min_order, 'FM999G999G999') || 'đ để dùng mã này');
  end if;

  -- Tính discount
  if v.discount_type = 'percent' then
    d := floor(p_subtotal * v.discount_value / 100.0);
    if v.max_discount is not null and d > v.max_discount then d := v.max_discount; end if;
  elsif v.discount_type = 'fixed' then
    d := v.discount_value;
    if d > p_subtotal then d := p_subtotal; end if;
  elsif v.discount_type = 'freeship' then
    d := 0;   -- freeship xử lý riêng ở FE (set shipping = 0)
  end if;

  return jsonb_build_object(
    'valid', true,
    'message', coalesce(v.description, 'Áp dụng thành công'),
    'voucher_id', v.id,
    'code', v.code,
    'type', v.discount_type,
    'discount', d
  );
end;
$$;
grant execute on function public.check_voucher(text, int) to anon, authenticated;

-- 5) RPC: increment used_count (gọi từ FE sau khi đặt đơn) -
create or replace function public.consume_voucher(p_code text)
returns void
language sql security definer set search_path = public as $$
  update public.vouchers
  set used_count = used_count + 1
  where code = upper(trim(p_code))
    and active = true
    and (max_uses is null or used_count < max_uses);
$$;
grant execute on function public.consume_voucher(text) to anon, authenticated;

-- 6) SEED 2 VOUCHER MẪU (an toàn re-run, dùng on conflict) -
insert into public.vouchers (code, description, discount_type, discount_value, min_order)
values
  ('WELCOME10', 'Giảm 10% cho khách mới (tối đa 30k)', 'percent', 10, 0),
  ('FREESHIP',  'Miễn phí vận chuyển',                 'freeship', 0, 200000)
on conflict (code) do nothing;

update public.vouchers set max_discount = 30000 where code = 'WELCOME10';
