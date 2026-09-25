// Paste this at the VERY BEGINNING of your existing `createorder`
// Edge Function handler, before any order processing.
// Requires `TURNSTILE_SECRET_KEY` to be set in the function's secrets
// (Supabase Dashboard > Edge Functions > createorder > Secrets).
//
// Expected client body (see src/lib/supabase.js `createOrder`):
//   { items, contactInfo, receipt_path, turnstile_token }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dev-bypass is accepted ONLY for requests originating from localhost.
// NOTE: unlike `origin?.includes('localhost')` gating alone, this checks the
// bypass token AND the origin together — otherwise any production caller
// could send turnstile_token='dev-bypass' and skip CAPTCHA.
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

  const { items, contactInfo, receipt_path, turnstile_token } = await req.json();

  // Dev bypass (localhost only, enabled via VITE_DISABLE_CAPTCHA=true locally).
  // On Vercel/production the env var is unset, the client never sends
  // 'dev-bypass', and every token is verified with Cloudflare.
  if (turnstile_token === "dev-bypass") {
    if (!isLocalRequest(req)) return captchaFailed();
  } else {
    // Verify Turnstile token
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
        response: turnstile_token,
      }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return captchaFailed();
    }
  }

  // ... existing order processing continues here ...
  // (repricing from products.price, atomic order + items insert,
  //  stock decrement, etc.)

  return new Response(JSON.stringify({ error: "Not implemented — merge with existing createorder logic" }), {
    status: 501,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
