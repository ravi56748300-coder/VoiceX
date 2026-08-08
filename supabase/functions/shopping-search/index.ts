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
    const { commandId, userId, product_query, quantity = 1 } = await req.json();

    if (!product_query) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing product_query" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://lfuaxrkukzmzjoljhmvw.supabase.co";

    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
    }
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is missing");
    }

    // 1. Query products table with fuzzy / ilike match
    const cleanQuery = encodeURIComponent(product_query.trim());
    const productRes = await fetch(`${supabaseUrl}/rest/v1/products?name=ilike.*${cleanQuery}*`, {
      headers: {
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`
      }
    });

    let matchedProduct = null;
    if (productRes.ok) {
      const products = await productRes.json();
      if (products.length > 0) {
        matchedProduct = products[0];
      }
    }

    // Handle no match found
    if (!matchedProduct) {
      const errorMsg = "No matching product found in catalog";
      if (commandId) {
        await fetch(`${supabaseUrl}/rest/v1/commands?id=eq.${commandId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          },
          body: JSON.stringify({
            status: "failed",
            error_message: errorMsg
          })
        });
      }
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Call Stripe API to create Checkout Session
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const unitAmountCents = Math.round(parseFloat(matchedProduct.price) * 100);

    const stripeParams = new URLSearchParams();
    stripeParams.append("payment_method_types[0]", "card");
    stripeParams.append("mode", "payment");
    stripeParams.append("line_items[0][price_data][currency]", "usd");
    stripeParams.append("line_items[0][price_data][product_data][name]", matchedProduct.name);
    if (matchedProduct.description) {
      stripeParams.append("line_items[0][price_data][product_data][description]", matchedProduct.description);
    }
    if (matchedProduct.image_url) {
      stripeParams.append("line_items[0][price_data][product_data][images][0]", matchedProduct.image_url);
    }
    stripeParams.append("line_items[0][price_data][unit_amount]", unitAmountCents.toString());
    stripeParams.append("line_items[0][quantity]", qty.toString());
    stripeParams.append("success_url", "https://checkout.stripe.dev/success");
    stripeParams.append("cancel_url", "https://checkout.stripe.dev/cancel");

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: stripeParams.toString()
    });

    if (!stripeRes.ok) {
      const stripeErr = await stripeRes.text();
      console.error("Stripe API Error:", stripeErr);
      throw new Error(`Stripe Checkout Session creation failed: ${stripeErr}`);
    }

    const stripeSession = await stripeRes.json();
    const checkoutUrl = stripeSession.url;

    // 3. Insert order record into `orders`
    await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`
      },
      body: JSON.stringify({
        user_id: userId || 'anonymous',
        product_id: matchedProduct.id,
        quantity: qty,
        stripe_checkout_url: checkoutUrl,
        status: 'pending'
      })
    });

    // 4. Update commands status to 'executed' and result to checkoutUrl
    if (commandId) {
      await fetch(`${supabaseUrl}/rest/v1/commands?id=eq.${commandId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          status: "executed",
          result: checkoutUrl
        })
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          name: matchedProduct.name,
          price: matchedProduct.price,
          image_url: matchedProduct.image_url
        },
        checkoutUrl
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in shopping-search function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
