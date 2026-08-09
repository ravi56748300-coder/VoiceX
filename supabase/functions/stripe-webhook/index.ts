import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://lfuaxrkukzmzjoljhmvw.supabase.co";

    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY environment secret is missing");
    }

    const event = await req.json();
    console.log(`[Stripe Webhook] Event received: ${event.type}`);

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerId = session.customer || null;
      const subscriptionId = session.subscription || null;

      console.log(`[Stripe Webhook] Processing payment completion for userId: ${userId}`);

      if (userId) {
        // Update user_subscriptions table in Supabase
        const updateUrl = `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}`;
        const dbRes = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            is_premium: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId
          })
        });

        if (dbRes.ok) {
          console.log(`[Stripe Webhook] Successfully updated user ${userId} to is_premium = true`);
        } else {
          const dbErr = await dbRes.text();
          console.error(`[Stripe Webhook] DB Update Error:`, dbErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in stripe-webhook function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
