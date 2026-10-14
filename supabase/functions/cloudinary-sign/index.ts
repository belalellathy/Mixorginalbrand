import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  const CLOUD_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;
  const CLOUD_API_KEY    = Deno.env.get("CLOUDINARY_API_KEY")!;
  const CLOUD_NAME       = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = "product-images";

  const stringToSign = `folder=${folder}&timestamp=${timestamp}${CLOUD_API_SECRET}`;

  const msgBuffer  = new TextEncoder().encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const signature  = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return new Response(
    JSON.stringify({ timestamp, signature, api_key: CLOUD_API_KEY, cloud_name: CLOUD_NAME, folder }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});