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
    const { commandId: reqCommandId, to, subject, body } = await req.json();
    commandId = reqCommandId;
    
    if (!commandId || !to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment secret is missing");
    }
    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY environment secret is missing");
    }

    // Call Resend API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: "VoiceX <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: body
      })
    });

    if (!resendRes.ok) {
      const errorData = await resendRes.text();
      const lowerErr = errorData.toLowerCase();
      const isRestricted = resendRes.status === 403 || 
        resendRes.status === 422 ||
        lowerErr.includes("testing emails") || 
        lowerErr.includes("unverified") ||
        lowerErr.includes("invalid `to` field") ||
        lowerErr.includes("restricted");

      if (isRestricted) {
        // Update command status to handed_off in DB
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
            body: JSON.stringify({ status: "handed_off" })
          }).catch(e => console.error("Failed to update status to handed_off:", e));
        }

        return new Response(
          JSON.stringify({ 
            success: false, 
            fallbackToMailto: true, 
            to, 
            subject, 
            body 
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      throw new Error(`Resend API Error: ${errorData}`);
    }

    const resendData = await resendRes.json();

    // Update command status to executed
    const dbUpdateUrl = `${supabaseUrl}/rest/v1/commands?id=eq.${commandId}`;
    const dbRes = await fetch(dbUpdateUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ status: "executed" })
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("Supabase Database Update Error:", dbErr);
      // Even if DB update fails, email was sent, so we shouldn't throw for the client response, but let's log it.
    }

    return new Response(
      JSON.stringify({ success: true, data: resendData }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in send-email function:", err);
    
    // Update command status to failed with error message
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
          body: JSON.stringify({ status: "failed", error_message: err.message || "Internal server error" })
        }).catch(e => console.error("Failed to update status to failed:", e));
    }

    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
