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

  let commandId = null;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://lfuaxrkukzmzjoljhmvw.supabase.co";

  try {
    const { commandId: reqCommandId, action_type, payload = {} } = await req.json();
    commandId = reqCommandId;

    if (!action_type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required 'action_type' field" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const zapierWebhookUrl = Deno.env.get("ZAPIER_WEBHOOK_URL");
    if (!zapierWebhookUrl) {
      throw new Error("ZAPIER_WEBHOOK_URL environment secret is missing");
    }

    const webhookPayload = {
      action_type,
      ...(typeof payload === 'object' ? payload : {})
    };

    // POST to Zapier Webhook
    const zapierRes = await fetch(zapierWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!zapierRes.ok) {
      const errorText = await zapierRes.text();
      throw new Error(`Zapier Webhook Error (${zapierRes.status}): ${errorText}`);
    }

    const zapierResultText = await zapierRes.text();

    // Update command status to executed
    if (commandId && supabaseServiceRoleKey) {
      const dbUpdateUrl = `${supabaseUrl}/rest/v1/commands?id=eq.${commandId}`;
      await fetch(dbUpdateUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ status: "executed" })
      }).catch(e => console.error("Database status update error:", e));
    }

    return new Response(
      JSON.stringify({ success: true, result: zapierResultText }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in zapier-trigger function:", err);

    if (commandId && supabaseServiceRoleKey) {
      const dbUpdateUrl = `${supabaseUrl}/rest/v1/commands?id=eq.${commandId}`;
      await fetch(dbUpdateUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ status: "failed", error_message: err.message || "Webhook execution failed" })
      }).catch(e => console.error("Failed to update status to failed:", e));
    }

    return new Response(
      JSON.stringify({ success: false, error: err.message || "Webhook execution failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
