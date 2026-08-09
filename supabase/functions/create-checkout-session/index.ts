import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, redirectOrigin } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required 'userId' parameter" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePriceId = Deno.env.get("STRIPE_PRICE_ID");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment secret is missing");
    }
    if (!stripePriceId) {
      throw new Error("STRIPE_PRICE_ID secret is missing on server. Please set it using 'supabase secrets set STRIPE_PRICE_ID=...'");
    }

    const origin = redirectOrigin || req.headers.get("origin") || "http://localhost:5173";

    // Call Stripe API to create Checkout Session in subscription mode
    const params = new URLSearchParams();
    params.append("payment_method_types[0]", "card");
    params.append("mode", "subscription");
    params.append("line_items[0][price]", stripePriceId);
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[user_id]", userId);
    params.append("success_url", `${origin}/?subscription=success`);
    params.append("cancel_url", `${origin}/?subscription=canceled`);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Stripe Checkout Error:", errText);
      throw new Error(`Stripe Checkout Session creation failed: ${errText}`);
    }

    const session = await res.json();

    return new Response(
      JSON.stringify({ success: true, url: session.url }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in create-checkout-session function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
