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
    const { commandId: reqCommandId, to, script } = await req.json();
    commandId = reqCommandId;

    if (!to) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required 'to' recipient" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio environment secrets (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are missing from project configuration.");
    }

    const safeScript = script || "Hello from VoiceX.";
    const twimlUrl = `${supabaseUrl}/functions/v1/call-twiml?script=${encodeURIComponent(safeScript)}`;

    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const authHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    const bodyParams = new URLSearchParams();
    bodyParams.append("From", fromNumber);
    bodyParams.append("To", to);
    bodyParams.append("Url", twimlUrl);

    const twilioRes = await fetch(twilioEndpoint, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyParams.toString()
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      const errorMsg = twilioData.message || twilioData.detail || JSON.stringify(twilioData);
      const errorCode = twilioData.code;

      const isUnverified = errorCode === 21215 || errorCode === 21608 || errorMsg.toLowerCase().includes("unverified");

      // Update command status to failed in DB
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
          body: JSON.stringify({ status: "failed", error_message: errorMsg })
        }).catch(e => console.error("Database status update error:", e));
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMsg,
          isUnverified,
          code: errorCode
        }),
        { status: 400, headers: corsHeaders }
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
        body: JSON.stringify({ status: "executed" })
      }).catch(e => console.error("Database status update error:", e));
    }

    return new Response(
      JSON.stringify({ success: true, callSid: twilioData.sid }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in make-call function:", err);

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
        body: JSON.stringify({ status: "failed", error_message: err.message || "Twilio call failed" })
      }).catch(e => console.error("Failed to update status to failed:", e));
    }

    return new Response(
      JSON.stringify({ success: false, error: err.message || "Twilio call failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
