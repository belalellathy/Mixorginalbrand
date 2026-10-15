import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PROD_ORIGIN = "https://mixorginalbrand.vercel.app";
const DEV_ORIGIN = "http://localhost:3000"; // port mirrors vite.config.js server.port

function getAllowedOrigins(): string[] {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return [PROD_ORIGIN, DEV_ORIGIN, ...extra];
}

// Echo the request Origin only when allowlisted; otherwise omit
// Access-Control-Allow-Origin entirely (never a wildcard) so unlisted
// browsers cannot read responses. Vary: Origin is always set so caches key on it.
function corsHeadersFor(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
  const origin = req.headers.get("origin");
  if (origin && getAllowedOrigins().includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  return base;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Extract client IP behind proxies/CDN. cf-connecting-ip first, then x-forwarded-for.
function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function detectImageType(bytes: Uint8Array): { ext: string; mime: string } | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" };
  }

  // WEBP: RIFF header at byte 0 + WEBP marker at byte 8
  if (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const respond = (body: object, status = 200): Response => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return respond({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // IP-based rate limiting: 8 requests per 10 minutes, before any file validation.
    try {
      const clientIp = getClientIp(req);
      const { data: allowed, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
        p_ip: clientIp,
        p_endpoint: "upload-receipt",
        p_max_requests: 8,
        p_window_seconds: 600,
      });
      if (rateLimitError) {
        console.error("check_rate_limit error:", rateLimitError);
      } else if (allowed === false) {
        return respond({ error: "Too many uploads. Please wait a few minutes and try again." }, 429);
      }
    } catch (e) {
      console.error("check_rate_limit error:", e);
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return respond({ error: "No file provided in 'file' field" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return respond({ error: "File too large. Maximum size is 5MB." }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return respond({ error: "File too large. Maximum size is 5MB." }, 400);
    }

    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectImageType(bytes);

    if (!detected) {
      return respond(
        { error: "Invalid file type. File must be a valid JPEG, PNG, or WebP image." },
        400
      );
    }

    const fileName = `${crypto.randomUUID()}.${detected.ext}`;
    const filePath = `receipts/${fileName}`;

    const { data, error } = await supabase.storage
      .from("payment-screenshots")
      .upload(filePath, bytes, {
        contentType: detected.mime,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return respond({ error: "Failed to upload file to storage" }, 500);
    }

    return respond({ path: data.path }, 200);
  } catch (err) {
    console.error("Unexpected error in upload-receipt:", err);
    return respond({ error: "An unexpected error occurred while processing the upload" }, 500);
  }
});
