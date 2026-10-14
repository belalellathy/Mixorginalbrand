drop trigger if exists trigger_decrement_stock on public.order_items;
drop function if exists public.decrement_stock();