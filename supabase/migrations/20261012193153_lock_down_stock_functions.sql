revoke execute on function public.reserve_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_stock(uuid, integer) from public, anon, authenticated;
grant  execute on function public.reserve_stock(uuid, integer) to service_role;
grant  execute on function public.release_stock(uuid, integer) to service_role;