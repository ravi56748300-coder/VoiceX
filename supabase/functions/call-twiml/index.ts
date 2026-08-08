import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

serve(async (req) => {
  const url = new URL(req.url);
  let script = url.searchParams.get("script") || "";

  if (!script && req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        script = body.script || "";
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        script = formData.get("script")?.toString() || "";
      }
    } catch (e) {
      // fallback
    }
  }

  const safeScript = escapeXml(script || "Hello from VoiceX.");
  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${safeScript}</Say><Hangup/></Response>`;

  return new Response(xmlResponse, {
    status: 200,
    headers: {
      "Content-Type": "text/xml"
    }
  });
});
