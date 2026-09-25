import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
      response: token,
    }),
  });
  const verifyData = await verifyRes.json();
  return !!verifyData.success;
}

// Dev-bypass is accepted ONLY for requests originating from localhost.
function isLocalRequest(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  return [origin, referer].some((v) =>
    v.includes("localhost") || v.includes("127.0.0.1")
  );
}

function captchaFailed() {
  return new Response(JSON.stringify({ error: "CAPTCHA verification failed" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { product_id, name, rating, comment, turnstile_token } = await req.json();

    // Dev bypass (localhost only, enabled via VITE_DISABLE_CAPTCHA=true locally).
    // On Vercel/production the env var is unset, the client never sends
    // 'dev-bypass', and every token is verified with Cloudflare.
    if (turnstile_token === "dev-bypass") {
      if (!isLocalRequest(req)) return captchaFailed();
    } else {
      // Verify Turnstile token
      const isHuman = await verifyTurnstile(turnstile_token);
      if (!isHuman) {
        return captchaFailed();
      }
    }

    // --- Server-side validation ---
    if (!product_id) {
      return new Response(JSON.stringify({ error: "product_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanName = (name ?? "").toString().trim().slice(0, 80);
    if (!cleanName) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ratingInt = Number(rating);
    if (!Number.isInteger(ratingInt) || ratingInt < 1 || ratingInt > 5) {
      return new Response(JSON.stringify({ error: "Rating must be an integer 1-5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cleanComment = comment == null || comment === ""
      ? null
      : comment.toString().trim().slice(0, 1000) || null;

    // --- Insert with service role key (bypasses anon RLS) ---
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        product_id,
        full_name: cleanName,
        rating: ratingInt,
        comment: cleanComment,
      }])
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-review failed:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to submit review" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
