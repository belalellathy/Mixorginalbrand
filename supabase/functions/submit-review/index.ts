import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REVIEWS_PER_IP_PER_DAY = 3;
const WINDOW_HOURS = 24;

function isLocalRequest(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  return [origin, referer].some((v) =>
    v.includes("localhost") || v.includes("127.0.0.1")
  );
}

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function checkAndIncrementRateLimit(
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<boolean> {
  const { error: cleanupError } = await supabase.rpc("cleanup_rate_limits");
  if (cleanupError) {
    console.error("Rate-limit cleanup failed:", cleanupError);
  }

  const { data: existing } = await supabase
    .from("review_rate_limits")
    .select("count, window_start")
    .eq("ip", ip)
    .maybeSingle();

  if (!existing) {
    await supabase.from("review_rate_limits").insert({ ip, count: 1 });
    return true;
  }

  const windowStart = new Date(existing.window_start);
  const now = new Date();
  const hoursDiff = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);

  if (hoursDiff >= WINDOW_HOURS) {
    await supabase
      .from("review_rate_limits")
      .update({ count: 1, window_start: now.toISOString() })
      .eq("ip", ip);
    return true;
  }

  if (existing.count >= MAX_REVIEWS_PER_IP_PER_DAY) {
    return false;
  }

  await supabase
    .from("review_rate_limits")
    .update({ count: existing.count + 1 })
    .eq("ip", ip);

  return true;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { product_id, name, rating, comment } = await req.json();

    // Server-side input validation
    if (!product_id) {
      return respond({ error: "product_id is required" }, 400);
    }
    const cleanName = (name ?? "").toString().trim().slice(0, 80);
    if (!cleanName) {
      return respond({ error: "Name is required" }, 400);
    }
    const ratingInt = Number(rating);
    if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
      return respond({ error: "Rating must be an integer 1-5" }, 400);
    }
    const cleanComment =
      comment == null || comment === ""
        ? null
        : comment.toString().trim().slice(0, 1000) || null;

    if (cleanComment && cleanComment === cleanComment.toUpperCase() && cleanComment.length > 10) {
      return respond({ error: "Please write your review in normal text." }, 400);
    }

    // IP rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!isLocalRequest(req) && ip !== "unknown") {
      const allowed = await checkAndIncrementRateLimit(supabase, ip);
      if (!allowed) {
        return respond(
          { error: `Too many reviews. You can submit up to ${MAX_REVIEWS_PER_IP_PER_DAY} reviews per day.` },
          429
        );
      }
    }

    // One review per product per IP per window
    const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("product_id", product_id)
      .eq("reviewer_ip", ip)
      .gte("created_at", windowStart)
      .maybeSingle();

    if (existingReview && !isLocalRequest(req)) {
      return respond(
        { error: "You have already reviewed this product recently." },
        429
      );
    }

    // Insert review
    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        product_id,
        full_name: cleanName,
        rating: ratingInt,
        comment: cleanComment,
        reviewer_ip: ip,
      }])
      .select("id, product_id, full_name, rating, comment, created_at")
      .single();

    if (error) throw error;

    return respond(data, 200);

  } catch (err) {
    console.error("submit-review failed:", err);
    return respond(
      { error: "Failed to submit review. Please try again." },
      500
    );
  }
});
