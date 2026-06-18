-- =========================================================
-- MIGRATION — Lưu email người mua vào đơn hàng
-- ---------------------------------------------------------
-- Mục tiêu: khi đặt hàng, lưu email của khách để gửi xác nhận
-- (qua EmailJS — xem assets/config.js mục EMAILJS_*).
-- ---------------------------------------------------------
-- Chạy 1 lần trên Supabase ➜ SQL Editor ➜ New query ➜ Run.
-- Schema.sql phải đã chạy trước file này.
-- =========================================================

alter table public.orders
  add column if not exists email text;

create index if not exists orders_email_idx on public.orders(email);

-- XONG. Sau khi chạy: cấu hình EmailJS trong assets/config.js để
-- web tự gửi email xác nhận cho khách ngay khi đặt hàng.
