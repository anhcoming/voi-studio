-- =========================================================
-- Migration: Atomic stock decrement
-- Tránh oversell khi 2 khách cùng mua sản phẩm tồn cuối.
-- Chạy 1 lần trong Supabase SQL Editor.
-- =========================================================

-- items = jsonb mảng [{id:uuid, qty:int}, ...]
-- Trả về số dòng được cập nhật. Dùng update đơn bằng greatest(0, stock-qty)
-- để PostgreSQL tự khoá row, không cần lock thủ công.
create or replace function public.apply_stock_delta(items jsonb, dir int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return;
  end if;
  for it in select * from jsonb_array_elements(items) loop
    update public.products
      set stock = greatest(0, coalesce(stock,0) + dir * coalesce((it->>'qty')::int, 0))
      where id = (it->>'id')::uuid;
  end loop;
end;
$$;

grant execute on function public.apply_stock_delta(jsonb, int) to anon, authenticated;
