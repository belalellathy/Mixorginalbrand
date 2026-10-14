CREATE OR REPLACE FUNCTION public.release_stock(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_quantity is null or p_quantity < 1 then
    return;
  end if;
  update public.products set stock = stock + p_quantity where id = p_product_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_stock(p_product_id uuid, p_quantity integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if p_quantity is null or p_quantity < 1 then
    return false;
  end if;
  -- Atomic: the WHERE clause is the stock check, so concurrent orders can't both win.
  update public.products
     set stock = stock - p_quantity
   where id = p_product_id and stock >= p_quantity;
  return found;
end;
$function$;