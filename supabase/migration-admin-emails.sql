-- =========================================================
-- Migration: Centralize admin email list in one place
-- Trước migration: phải hardcode email cả 2 chỗ (CONFIG.ADMIN_EMAILS client
-- + is_admin() SQL). Lỡ quên đồng bộ → UI cho vào nhưng DB chặn im lặng.
-- Sau migration: chỉ chèn email vào bảng admin_emails là xong.
-- =========================================================

create table if not exists public.admin_emails (
  email      text primary key,
  added_at   timestamptz default now()
);

alter table public.admin_emails enable row level security;
-- Chỉ admin hiện tại được sửa danh sách admin (bootstrap: insert thủ công email đầu)
drop policy if exists "admin emails read"  on public.admin_emails;
drop policy if exists "admin emails write" on public.admin_emails;
create policy "admin emails read"  on public.admin_emails for select using (true);
create policy "admin emails write" on public.admin_emails for all
  using (public.is_admin()) with check (public.is_admin());

-- Cập nhật is_admin() đọc từ bảng. Fallback: nếu bảng rỗng, dùng email cũ
-- để không khoá mình ra ngoài lần đầu chạy.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
  or (
    -- bootstrap: bảng chưa có dòng nào → cho email default
    not exists(select 1 from public.admin_emails)
    and coalesce(auth.jwt() ->> 'email','') = 'anhcoming@gmail.com'
  )
$$;

-- 👉 Sau khi chạy migration, vào SQL Editor chạy:
--    insert into public.admin_emails(email) values ('anhcoming@gmail.com');
-- Sau đó UI admin có thể thêm/xoá email khác (cần migration UI tương ứng).

-- RPC trả về danh sách admin email cho client (không lộ thông tin nhạy cảm).
create or replace function public.list_admin_emails()
returns setof text language sql stable security definer set search_path = public as $$
  select email from public.admin_emails order by added_at
$$;
grant execute on function public.list_admin_emails() to anon, authenticated;
