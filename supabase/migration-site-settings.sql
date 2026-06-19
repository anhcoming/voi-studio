-- =========================================================
-- Migration: site_settings (key/value jsonb)
-- Dùng để admin customize trang chủ: ticker text, hero banner,
-- category tiles, feature blocks… mà không cần đụng code.
-- =========================================================

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "settings read"  on public.site_settings;
drop policy if exists "settings write" on public.site_settings;
create policy "settings read"  on public.site_settings for select using (true);
create policy "settings write" on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Auto-update updated_at
create or replace function public.touch_site_settings() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_site_settings();
