import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isLocalRequest(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  return [origin, referer].some((v) =>
    v.includes("localhost") || v.includes("127.0.0.1")
  );
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { items, contactInfo, receipt_path, turnstile_token } = await req.json();

    // 1. CAPTCHA VERIFICATION
    if (turnstile_token === "dev-bypass") {
      if (!isLocalRequest(req)) {
        return errorResponse("CAPTCHA verification failed");
      }
    } else {
      const verifyRes = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
            response: turnstile_token,
          }),
        }
      );
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return errorResponse("CAPTCHA verification failed");
      }
    }

    // 2. INPUT VALIDATION
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse("Order must contain at least one item");
    }
    if (
      !contactInfo?.full_name ||
      !contactInfo?.email ||
      !contactInfo?.phone ||
      !contactInfo?.address
    ) {
      return errorResponse("Contact information is incomplete");
    }
    if (!receipt_path) {
      return errorResponse("Payment receipt is required");
    }

    // 3. SERVER-SIDE PRICING + STOCK CHECK
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const productIds = items.map((i: { product_id: string }) => i.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, stock, name")
      .in("id", productIds);

    if (productsError || !products) {
      console.error("Products fetch error:", productsError);
      return errorResponse("Failed to fetch product details", 500);
    }

    const productMap = new Map(
      products.map((p: { id: string; price: number; stock: number; name: string }) => [p.id, p])
    );

    let total_price = 0;
    const validatedItems: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return errorResponse(`Product not found: ${item.product_id}`);
      }
      if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        return errorResponse(`Invalid quantity for product: ${product.name}`);
      }
      if (product.stock < item.quantity) {
        return errorResponse(`Insufficient stock for: ${product.name}`);
      }
      total_price += Number(product.price) * item.quantity;
      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(product.price),
      });
    }

    total_price = Math.round(total_price * 100) / 100;

    // 4. INSERT ORDER
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{
        full_name:   contactInfo.full_name.trim().slice(0, 200),
        email:       contactInfo.email.trim().toLowerCase().slice(0, 254),
        phone:       contactInfo.phone.trim().slice(0, 30),
        address:     contactInfo.address.trim().slice(0, 500),
        total_price,
        receipt_path,
        status:      "pending",
      }])
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return errorResponse("Failed to create order", 500);
    }

    // 5. INSERT ORDER ITEMS
    const orderItems = validatedItems.map((item) => ({
      order_id:   order.id,
      product_id: item.product_id,
      quantity:   item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Order items insert error:", itemsError);
      return errorResponse("Failed to save order items", 500);
    }

    // 6. DECREMENT STOCK
    const stockDecrements = validatedItems.map((item) =>
      supabase.rpc("decrement_stock", {
        p_product_id: item.product_id,
        p_quantity:   item.quantity,
      })
    );
    const stockResults = await Promise.allSettled(stockDecrements);
    const stockFailures = stockResults.filter((r) => r.status === "rejected");
    if (stockFailures.length > 0) {
      console.error("Stock decrement partial failure:", stockFailures);
    }

    // 7. RETURN SUCCESS
    return new Response(
      JSON.stringify({ id: order.id, total_price }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("createorder unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
