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

    const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    const zapierWebhookUrl = Deno.env.get("ZAPIER_WEBHOOK_URL");

    let resultText = "Webhook executed successfully";

    // 1. Direct Discord Webhook Support
    if (action_type === 'discord' && discordWebhookUrl) {
      const messageText = payload.text || payload.content || "Message from VoiceX";
      const discordRes = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageText,
          username: "VoiceX Assistant"
        })
      });

      if (!discordRes.ok) {
        const errText = await discordRes.text();
        throw new Error(`Discord Webhook Error (${discordRes.status}): ${errText}`);
      }
      resultText = `Posted message to Discord channel: "${messageText}"`;

    } else if (zapierWebhookUrl) {
      // 2. Zapier Webhook Trigger
      const webhookPayload = {
        action_type,
        ...(typeof payload === 'object' ? payload : {})
      };

      const zapierRes = await fetch(zapierWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });

      if (!zapierRes.ok) {
        const errorText = await zapierRes.text();
        if (zapierRes.status === 404 || errorText.includes("please unsubscribe me")) {
          throw new Error("Zapier Webhook is currently paused or turned OFF in your Zapier Dashboard. Please turn ON your Zap (or set DISCORD_WEBHOOK_URL in Supabase secrets for direct Discord posting).");
        }
        throw new Error(`Zapier Webhook Error (${zapierRes.status}): ${errorText}`);
      }

      resultText = await zapierRes.text();

    } else {
      throw new Error(
        action_type === 'discord'
          ? "Neither DISCORD_WEBHOOK_URL nor ZAPIER_WEBHOOK_URL is configured. Set one in Supabase secrets."
          : "ZAPIER_WEBHOOK_URL environment secret is missing."
      );
    }

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
        body: JSON.stringify({ status: "executed", result: resultText })
      }).catch(e => console.error("Database status update error:", e));
    }

    return new Response(
      JSON.stringify({ success: true, result: resultText }),
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
