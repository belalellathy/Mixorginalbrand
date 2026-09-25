import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert review
    const { data, error } = await supabase
      .from("reviews")
      .insert([{
        product_id,
        full_name: cleanName,
        rating: ratingInt,
        comment: cleanComment,
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
