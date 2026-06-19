-- =========================================================
-- Migration: tách địa chỉ thành các trường structured
-- Mục đích: dùng được với shipping API (GHN/GHTK/Viettel Post)
-- + lưu nhiều địa chỉ cho user đã đăng nhập.
-- =========================================================

-- 1) Bổ sung cột structured cho orders (vẫn giữ `address` chuỗi cho legacy)
alter table public.orders
  add column if not exists province_code text,
  add column if not exists province_name text,
  add column if not exists district_code text,
  add column if not exists district_name text,
  add column if not exists ward_code     text,
  add column if not exists ward_name     text,
  add column if not exists street        text;

-- 2) Bảng địa chỉ của user (multi-address cho khách đã login)
create table if not exists public.user_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text default 'Nhà',           -- "Nhà riêng" / "Văn phòng" / tự gõ
  recipient     text not null,
  phone         text not null,
  province_code text, province_name text,
  district_code text, district_name text,
  ward_code     text, ward_name     text,
  street        text not null,
  is_default    boolean not null default false,
  created_at    timestamptz default now()
);

create index if not exists user_addresses_user_idx on public.user_addresses(user_id);

alter table public.user_addresses enable row level security;
drop policy if exists "addr select"  on public.user_addresses;
drop policy if exists "addr insert"  on public.user_addresses;
drop policy if exists "addr update"  on public.user_addresses;
drop policy if exists "addr delete"  on public.user_addresses;
create policy "addr select" on public.user_addresses for select using (auth.uid() = user_id);
create policy "addr insert" on public.user_addresses for insert with check (auth.uid() = user_id);
create policy "addr update" on public.user_addresses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "addr delete" on public.user_addresses for delete using (auth.uid() = user_id);

-- 3) Trigger: chỉ 1 địa chỉ default mỗi user (set is_default=true → các bản ghi khác auto false)
create or replace function public.unique_default_address() returns trigger
language plpgsql as $$
begin
  if new.is_default then
    update public.user_addresses
      set is_default = false
      where user_id = new.user_id and id <> new.id and is_default = true;
  end if;
  return new;
end $$;

drop trigger if exists trg_unique_default_addr on public.user_addresses;
create trigger trg_unique_default_addr
  before insert or update of is_default on public.user_addresses
  for each row execute function public.unique_default_address();
