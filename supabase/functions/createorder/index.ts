import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Allowlist only: only the storefront origins below may read responses.
// A wildcard would let any site read responses, so it is never used.
const PROD_ORIGIN = "https://mixorginalbrand.vercel.app";
const DEV_ORIGIN = "http://localhost:3000"; // port mirrors vite.config.js server.port

function getAllowedOrigins(): string[] {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return [PROD_ORIGIN, DEV_ORIGIN, ...extra];
}

// Computed per request because Access-Control-Allow-Origin must echo the
// caller's Origin exactly when allowed. Vary: Origin is always set so
// caches key responses by Origin.
function corsHeadersFor(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && getAllowedOrigins().includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base;
}

const BUCKET = "payment-screenshots";
// Only paths our own upload code can produce: receipts/<uuid>.<ext>
const RECEIPT_RE =
  /^receipts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHIPPING_CODE_RE = /^[a-z-]{2,40}$/;
const MAX_LINES = 50;
const MAX_QTY = 100;
const RECEIPT_URL_TTL_SECONDS = 600;

// Service-role client: bypasses RLS. Never expose this key outside the function.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Extract client IP behind proxies/CDN. cf-connecting-ip first, then x-forwarded-for.
const getClientIp = (req: Request): string => {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
};

// Non-empty trimmed string, truncated to `max`; null if not a usable string.
const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;

type Line = { product_id: string | number; quantity: number; unit_price: number; name: string };

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };
  const errorResponse = (message: string, status = 400) => json({ error: message }, status);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // IP-based rate limiting: 5 requests per 10 minutes, before any business logic.
  const clientIp = getClientIp(req);
  try {
    const { data: allowed, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
      p_ip: clientIp,
      p_endpoint: "createorder",
      p_max_requests: 5,
      p_window_seconds: 600,
    });
    if (rateLimitError) {
      console.error("check_rate_limit error:", rateLimitError);
    } else if (allowed === false) {
      return errorResponse("Too many orders. Please wait a few minutes and try again.", 429);
    }
  } catch (e) {
    console.error("check_rate_limit error:", e);
  }

  // Stock we have reserved so far, so any later failure can put it back.
  const reserved: Line[] = [];
  let orderCreated = false;
  const releaseStock = async () => {
    // rpc() returns { error } instead of throwing; best effort, but log failures.
    const results = await Promise.all(
      reserved.map((l) =>
        supabase.rpc("release_stock", { p_product_id: l.product_id, p_quantity: l.quantity })
      ),
    );
    results.forEach((r) => r.error && console.error("release_stock failed:", r.error));
    reserved.length = 0;
  };

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body");
    }
    const { items, contactInfo, receipt_path, shipping_code, expected_total } = body ?? {};

    // Shipping governorate code: validated as a format, priced server-side below.
    if (typeof shipping_code !== "string" || !SHIPPING_CODE_RE.test(shipping_code)) {
      return errorResponse("Invalid shipping governorate");
    }
    // expected_total is a check against the server-computed total, never a price.
    if (
      expected_total !== undefined &&
      (typeof expected_total !== "number" || !Number.isFinite(expected_total) || expected_total < 0)
    ) {
      return errorResponse("Invalid expected total");
    }

    // ---- 1. Validate items (and merge duplicate product lines: F4) ----
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) {
      return errorResponse("Order must contain between 1 and 50 items");
    }
    const wanted = new Map<string, number>();
    for (const it of items) {
      const pid = it?.product_id;
      if (typeof pid !== "string" && typeof pid !== "number") {
        return errorResponse("Invalid product in order");
      }
      if (!Number.isInteger(it?.quantity) || it.quantity < 1 || it.quantity > MAX_QTY) {
        return errorResponse("Invalid quantity");
      }
      const key = String(pid);
      wanted.set(key, (wanted.get(key) ?? 0) + it.quantity);
    }
    if ([...wanted.values()].some((q) => q > MAX_QTY)) {
      return errorResponse("Invalid quantity");
    }

    // ---- 2. Validate contact info ----
    const full_name = text(contactInfo?.full_name, 200);
    const email = text(contactInfo?.email, 254)?.toLowerCase() ?? null;
    const phone = text(contactInfo?.phone, 30);
    const address = text(contactInfo?.address, 500);
    if (!full_name || !email || !phone || !address) {
      return errorResponse("Contact information is incomplete");
    }
    if (!EMAIL_RE.test(email)) return errorResponse("Invalid email address");
    // Digit count after stripping separators, so formatted input like
    // "+20 10 1234 5678" is evaluated on its digits, not its length.
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return errorResponse("Invalid phone number");
    }

    // ---- 3. Validate receipt: strict format + file exists (F3) ----
    if (typeof receipt_path !== "string" || !RECEIPT_RE.test(receipt_path)) {
      return errorResponse("Invalid payment receipt");
    }
    const fileName = receipt_path.slice("receipts/".length);
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list("receipts", { limit: 1, search: fileName });
    if (listError || !files?.some((f) => f.name === fileName)) {
      return errorResponse("Payment receipt file not found");
    }

    // ---- 4. Server-side pricing ----
    const ids = [...wanted.keys()].sort(); // stable order
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, name")
      .in("id", ids);
    if (productsError || !products) {
      console.error("Products fetch error:", productsError);
      return errorResponse("Failed to fetch product details", 500);
    }
    const productMap = new Map(products.map((p) => [String(p.id), p]));

    const lines: Line[] = [];
    let totalCents = 0;
    for (const id of ids) {
      const p = productMap.get(id);
      if (!p) return errorResponse("One or more products are no longer available");
      const quantity = wanted.get(id)!;
      const unit_price = Number(p.price);
      totalCents += Math.round(unit_price * 100) * quantity; // integer math, no float drift
      lines.push({ product_id: p.id, quantity, unit_price, name: p.name });
    }

    // ---- 4b. Server-side shipping (before any stock is reserved) ----
    // Looked up before reserve_stock so a shipping/total mismatch returns
    // before anything is reserved and nothing needs releasing.
    const { data: rate, error: rateError } = await supabase
      .from("shipping_rates")
      .select("code, name_en, price")
      .eq("code", shipping_code)
      .eq("is_active", true)
      .maybeSingle();
    if (rateError) {
      console.error("Shipping rate fetch error:", rateError);
      return errorResponse("Failed to fetch shipping rate", 500);
    }
    if (!rate || rate.price == null) {
      return errorResponse("Shipping is not available for the selected governorate");
    }
    const shipping_cents = Math.round(Number(rate.price) * 100);
    totalCents += shipping_cents;
    // total_price stays the grand total (products + shipping).
    const grand_total = totalCents / 100;

    // expected_total is only a race check against the server total, never a price.
    if (expected_total !== undefined && Math.round(expected_total * 100) !== totalCents) {
      return json(
        { error: "Order total has changed", code: "TOTAL_CHANGED", total_price: grand_total },
        409,
      );
    }

    // ---- 5. Reserve stock atomically (F1, F2) ----
    for (const line of lines) {
      const { data: ok, error } = await supabase.rpc("reserve_stock", {
        p_product_id: line.product_id,
        p_quantity: line.quantity,
      });
      if (error) {
        console.error("reserve_stock error:", error);
        await releaseStock();
        return errorResponse("Failed to reserve stock", 500);
      }
      if (ok !== true) {
        await releaseStock();
        return errorResponse(`Insufficient stock for: ${line.name}`);
      }
      reserved.push(line);
    }

    // ---- 6. Insert order ----
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{
        full_name,
        email,
        phone,
        address,
        total_price: grand_total,
        receipt_path,
        status: "pending",
        shipping_code: rate.code,
        shipping_name: rate.name_en,
        shipping_price: shipping_cents / 100,
      }])
      .select("id")
      .single();
    if (orderError || !order) {
      await releaseStock();
      // 23505 = unique violation: receipt already used by another order
      if (orderError?.code === "23505") {
        return errorResponse("This payment receipt has already been used");
      }
      console.error("Order insert error:", orderError);
      return errorResponse("Failed to create order", 500);
    }
    orderCreated = true;

    // ---- 7. Insert order items ----
    const { error: itemsError } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
    );
    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      await releaseStock();
      return errorResponse("Failed to save order items", 500);
    }

    // ---- 8. Short-lived receipt URL for the confirmation screen ----
    // Signed only for a path we just validated and attached to this order,
    // so this endpoint can't be used to sign arbitrary storage objects.
    let receipt_signed_url: string | null = null;
    try {
      const { data } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(receipt_path, RECEIPT_URL_TTL_SECONDS);
      receipt_signed_url = data?.signedUrl ?? null;
    } catch (e) {
      console.error("Signed URL error:", e); // non-fatal: client falls back to local preview
    }

    return json({
      id: order.id,
      total_price: grand_total,
      shipping_price: shipping_cents / 100,
      shipping_name: rate.name_en,
      receipt_signed_url,
    });
  } catch (err) {
    console.error("createorder unhandled error:", err);
    // Don't leave stock reserved for an order that was never created.
    if (!orderCreated) await releaseStock();
    return errorResponse("Internal server error", 500);
  }
});