import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

function stripEmojis(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const toolsList = [
  {
    name: "send_email",
    description: "Send an email to a recipient with a subject and body content.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: { type: "STRING", description: "Email address of recipient" },
        subject: { type: "STRING", description: "Subject line of email" },
        body: { type: "STRING", description: "Body text of email" }
      },
      required: ["to", "subject"]
    }
  },
  {
    name: "send_sms",
    description: "Send an SMS or text message to a recipient.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: { type: "STRING", description: "Phone number or recipient name" },
        message: { type: "STRING", description: "SMS text content" }
      },
      required: ["to", "message"]
    }
  },
  {
    name: "send_whatsapp",
    description: "Send a WhatsApp message to a recipient.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: { type: "STRING", description: "Phone number or recipient name" },
        message: { type: "STRING", description: "WhatsApp text content" }
      },
      required: ["to", "message"]
    }
  },
  {
    name: "save_contact",
    description: "Save a new contact with a name and phone number.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Name of the contact" },
        phone_number: { type: "STRING", description: "Phone number with country code" }
      },
      required: ["name", "phone_number"]
    }
  },

  {
    name: "create_calendar_event",
    description: "Schedule a calendar event.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Title of calendar event" },
        date: { type: "STRING", description: "Date of event" },
        time: { type: "STRING", description: "Time of event" },
        duration: { type: "STRING", description: "Duration of event" }
      },
      required: ["title"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for information.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "shopping_search",
    description: "Search for products to buy with optional filters for color, size, and price.",
    parameters: {
      type: "OBJECT",
      properties: {
        product_query: { type: "STRING", description: "Product query string (e.g., 'socks', 'shirt')" },
        color: { type: "STRING", description: "Color filter (e.g., 'blue', 'black')" },
        size: { type: "STRING", description: "Size filter (e.g., 'M', 'S', 'L')" },
        max_price: { type: "NUMBER", description: "Maximum price filter in USD (e.g., 15)" },
        quantity: { type: "STRING", description: "Quantity" }
      },
      required: ["product_query"]
    }
  },
  {
    name: "zapier_trigger",
    description: "Trigger an automated Zapier workflow for Discord posts, logging notes/expenses to Google Sheets, or controlling Spotify playlists.",
    parameters: {
      type: "OBJECT",
      properties: {
        action_type: { 
          type: "STRING", 
          enum: ["discord", "sheet", "spotify"],
          description: "Target action type: 'discord' for Discord posts/messages, 'sheet' for logging notes/expenses/reminders (default for generic log/note commands), 'spotify' for music/playlist actions."
        },
        payload: {
          type: "OBJECT",
          description: "Data fields for the chosen action_type.",
          properties: {
            text: { type: "STRING", description: "Discord message text" },
            note: { type: "STRING", description: "Sheet note or expense description" },
            amount: { type: "NUMBER", description: "Numerical amount spent if logging expenses" },
            category: { type: "STRING", description: "Category for expense/note" },
            track_name: { type: "STRING", description: "Spotify track or artist name" },
            playlist_action: { type: "STRING", enum: ["add", "play"], description: "Spotify action: 'add' or 'play'" }
          }
        }
      },
      required: ["action_type"]
    }
  },
  {
    name: "schedule_message",
    description: "Schedule a future email message. Scheduled texts are not supported.",
    parameters: {
      type: "OBJECT",
      properties: {
        channel: { type: "STRING", description: "Channel name (email only)" },
        recipient: { type: "STRING", description: "Recipient" },
        content: { type: "STRING", description: "Content" },
        send_at: { type: "STRING", description: "Execution time" }
      },
      required: ["channel", "recipient", "content", "send_at"]
    }
  },
  {
    name: "ask_clarification",
    description: "Ask the user a clarifying question if a requested action is missing required parameters (e.g. missing recipient, missing subject). Do NOT guess missing parameters.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: { type: "STRING", description: "The specific question to ask the user." }
      },
      required: ["question"]
    }
  }
];

function synthesizeReply(toolName: string | null, params: Record<string, any> | null, defaultText?: string): string {
  if (!toolName || !params || Object.keys(params).length === 0) {
    return defaultText || "I'm VoiceX. How can I assist you today?";
  }

  switch (toolName) {
    case 'send_email':
      return `Got it — I'd send an email to ${params.to || 'recipient'} about "${params.subject || 'no subject'}".`;
    case 'send_sms':
      return `Got it — I'll prepare an SMS to ${params.to || 'recipient'}.`;
    case 'send_whatsapp':
      return `Got it — I'll prepare a WhatsApp to ${params.to || 'recipient'}.`;
    case 'save_contact':
      return `Saving ${params.name || 'contact'} as ${params.phone_number || 'number'}.`;
    case 'make_call':
      return `Got it — I'd place a call to ${params.to || 'recipient'}.`;
    case 'create_calendar_event':
      return `Got it — I'd schedule "${params.title || 'Event'}" for ${params.date || 'today'} at ${params.time || 'scheduled time'}.`;
    case 'web_search':
      return `Searching the web for: "${params.query || ''}".`;
    case 'shopping_search':
      return `Searching products for "${params.product_query || ''}" (Qty: ${params.quantity || '1'}).`;
    case 'zapier_trigger': {
      const type = params.action_type || 'workflow';
      if (type === 'discord') return `Got it — posting to Discord: "${params.payload?.text || ''}".`;
      if (type === 'sheet') return `Got it — logging to Sheets: "${params.payload?.note || ''}"${params.payload?.amount ? ` ($${params.payload.amount})` : ''}.`;
      if (type === 'spotify') return `Got it — ${params.payload?.playlist_action || 'playlist'} on Spotify: "${params.payload?.track_name || ''}".`;
      return `Triggering Zapier workflow "${type}".`;
    }
    case 'schedule_message':
      return `Scheduling message to ${params.recipient || 'recipient'} via ${params.channel || 'channel'} for ${params.send_at || 'later'}.`;
    default:
      return defaultText || `Identified action: ${toolName}.`;
  }
}

async function callGeminiModel(apiKey: string, transcript: string, history: any[] = []) {
  // Use active Google Gemini models with highest availability
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  let lastError = null;

  const contents = history.map((item: any) => ({
    role: item.role === 'user' ? 'user' : 'model',
    parts: [{ text: item.text }]
  }));
  
  contents.push({
    role: "user",
    parts: [{ text: transcript }]
  });

  for (const model of models) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = {
      contents,
      tools: [
        {
          functionDeclarations: toolsList
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: "You are VoiceX, a voice-native AI assistant. Analyze the user prompt and context. If the user wants to take an action matching one of the available functions (send_email, send_sms, send_whatsapp, save_contact, create_calendar_event, web_search, shopping_search, zapier_trigger, schedule_message), invoke that function with appropriate arguments. For zapier_trigger, infer action_type as 'discord' for Discord posts/social messages, 'sheet' for logging notes/expenses/reminders (default for generic 'log/note/remember' commands), or 'spotify' for music/playlist commands. Outbound phone calling is NOT available in this build — if the user asks to make a call or call someone, reply conversationally explaining that phone calling isn't available in this build. IMPORTANT: If the user wants to perform an action but is missing required information (e.g., recipient name, email address, message body), do NOT call the tool and guess the missing parameters. Instead, invoke ask_clarification with a question to ask the user. If it is a general greeting or non-actionable inquiry, reply conversationally without calling any tool."
          }
        ]
      }
    };

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (res.ok) {
      return await res.json();
    } else {
      lastError = await res.text();
    }
  }

  throw new Error(`Gemini API call failed across models: ${lastError}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, userId, conversationId, history = [] } = await req.json();
    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: "Missing 'transcript' field in request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://lfuaxrkukzmzjoljhmvw.supabase.co";

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment secret is missing");
    }
    if (!supabaseServiceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY environment secret is missing");
    }

    // --- TIERED USAGE LIMITS & SUBSCRIPTION LOGIC ---
    let subscriptionInfo = {
      isPremium: false,
      inTrial: true,
      daysRemainingInTrial: 30,
      postTrialPromptsRemaining: 5,
      isLimitReached: false
    };

    if (userId && userId !== 'anonymous') {
      try {
        const subRes = await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
          method: "GET",
          headers: {
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          }
        });

        let subRow = null;
        if (subRes.ok) {
          const subs = await subRes.json();
          if (subs && subs.length > 0) {
            subRow = subs[0];
          }
        }

        // STEP G: If user has no row in user_subscriptions, create one on the fly (treat as trial starting today)
        if (!subRow) {
          const newSubData = {
            user_id: userId,
            trial_started_at: new Date().toISOString(),
            is_premium: false,
            post_trial_prompt_count: 0
          };
          const createSubRes = await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseServiceRoleKey,
              "Authorization": `Bearer ${supabaseServiceRoleKey}`,
              "Prefer": "return=representation"
            },
            body: JSON.stringify(newSubData)
          });
          if (createSubRes.ok) {
            const createdData = await createSubRes.json();
            if (createdData && createdData.length > 0) {
              subRow = createdData[0];
            } else {
              subRow = newSubData;
            }
          } else {
            subRow = newSubData;
          }
        }

        let trialStart = Date.now();
        if (subRow && subRow.trial_started_at) {
          const parsed = new Date(subRow.trial_started_at).getTime();
          if (!isNaN(parsed)) {
            trialStart = parsed;
          }
        }

        const daysSinceTrial = Math.max(0, Math.floor((Date.now() - trialStart) / (1000 * 60 * 60 * 24)));
        const isPremium = Boolean(subRow && subRow.is_premium);
        const inTrial = daysSinceTrial <= 30;
        const daysRemainingInTrial = Math.max(0, 30 - daysSinceTrial);
        const postTrialPromptsUsed = (subRow && subRow.post_trial_prompt_count) || 0;
        const postTrialPromptsRemaining = Math.max(0, 5 - postTrialPromptsUsed);

        subscriptionInfo = {
          isPremium,
          inTrial,
          daysRemainingInTrial,
          postTrialPromptsRemaining,
          isLimitReached: false
        };

        // Enforce Limits:
        // 1. is_premium = true -> unlimited
        // 2. in trial (<= 30 days) -> unlimited
        // 3. post-trial (> 30 days) & not premium:
        if (!isPremium && !inTrial) {
          if (postTrialPromptsUsed >= 5) {
            subscriptionInfo.isLimitReached = true;
            subscriptionInfo.postTrialPromptsRemaining = 0;

            // Reject command immediately, return limit message, skip model & intents
            return new Response(
              JSON.stringify({
                reply: "You've used your 5 free prompts after the trial period. Upgrade to Premium for unlimited access.",
                tool: null,
                params: null,
                commandId: null,
                isLimitReached: true,
                subscriptionInfo
              }),
              { status: 200, headers: corsHeaders }
            );
          } else {
            // Post-trial allowed prompt (under 5): increment post_trial_prompt_count by 1
            const newCount = postTrialPromptsUsed + 1;
            subscriptionInfo.postTrialPromptsRemaining = Math.max(0, 5 - newCount);

            fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "apikey": supabaseServiceRoleKey,
                "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                "Prefer": "return=minimal"
              },
              body: JSON.stringify({ post_trial_prompt_count: newCount })
            }).catch(e => console.warn("Failed to increment post_trial_prompt_count:", e));
          }
        }

      } catch (e) {
        console.warn("Error processing subscription limits:", e);
      }
    }
    // -----------------------------------------------

    // Auto-update conversation title and updated_at timestamp
    if (conversationId && userId) {
      try {
        const convRes = await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
          method: "GET",
          headers: {
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          }
        });
        if (convRes.ok) {
          const convs = await convRes.json();
          const titleText = transcript.length > 50 ? transcript.substring(0, 47) + '...' : transcript;
          if (convs && convs.length > 0) {
            const curTitle = convs[0].title;
            if (curTitle === 'New Conversation' || !curTitle) {
              await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": supabaseServiceRoleKey,
                  "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                  title: titleText,
                  updated_at: new Date().toISOString()
                })
              }).catch(e => console.warn('Failed to update conversation title:', e));
            } else {
              await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": supabaseServiceRoleKey,
                  "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                  "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                  updated_at: new Date().toISOString()
                })
              }).catch(e => console.warn('Failed to update conversation timestamp:', e));
            }
          }
        }
      } catch (e) {
        console.warn('Error handling conversation title update:', e);
      }
    }

    const geminiData = await callGeminiModel(geminiApiKey, transcript, history);
    const candidate = geminiData.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let toolName: string | null = null;
    let toolParams: Record<string, any> | null = null;
    let textContent: string = "";

    for (const part of parts) {
      if (part.functionCall) {
        toolName = part.functionCall.name;
        toolParams = part.functionCall.args || {};
      }
      if (part.text) {
        textContent += part.text;
      }
    }

    let finalReplyText = synthesizeReply(toolName, toolParams, textContent);
    let searchResult = null;
    let citations = null;
    let needsClarification = false;

    if (toolName === 'ask_clarification') {
      needsClarification = true;
      finalReplyText = toolParams?.question || "Could you clarify that?";
      toolName = null;
      toolParams = null;
    }

    // --- CONTACT LOGIC ---
    if (toolName === 'save_contact') {
      const rawName = toolParams?.name || '';
      const cleanName = stripEmojis(rawName);
      const rawPhone = toolParams?.phone_number || '';
      const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

      if (!cleanPhone.startsWith('+')) {
        toolName = null;
        toolParams = null;
        finalReplyText = "Please include the country code (like +1 or +91) when saving a contact.";
      } else if (userId) {
        // Save contact to DB
        const saveRes = await fetch(`${supabaseUrl}/rest/v1/contacts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          },
          body: JSON.stringify({
            user_id: userId,
            name: cleanName || rawName,
            phone_number: cleanPhone
          })
        });
        if (saveRes.ok) {
          finalReplyText = `Saved ${cleanName || rawName} (${cleanPhone}) to your contacts.`;
        } else {
          finalReplyText = "I ran into an issue saving that contact.";
        }
      } else {
        finalReplyText = "I can't save contacts right now because you aren't authenticated.";
      }
    }

    // Handle auto-saving contact and proceeding immediately when user replies with phone number to a contact question
    if (history && history.length > 0 && userId) {
      const lastSystemMsg = history.filter((h: any) => h.role === 'model' || h.role === 'system').slice(-1)[0]?.text || '';
      const pendingMatch = lastSystemMsg.match(/number saved for ([^\.]+)\./i) || lastSystemMsg.match(/What's ([^'s]+)'s number\?/i);

      if (pendingMatch) {
        const pendingName = stripEmojis(pendingMatch[1].trim());
        const extractedPhone = (toolParams?.phone_number || transcript).replace(/[^\d+]/g, '');

        if (extractedPhone.length >= 7 && extractedPhone.startsWith('+')) {
          // Auto-save contact
          await fetch(`${supabaseUrl}/rest/v1/contacts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseServiceRoleKey,
              "Authorization": `Bearer ${supabaseServiceRoleKey}`
            },
            body: JSON.stringify({
              user_id: userId,
              name: pendingName,
              phone_number: extractedPhone
            })
          }).catch(e => console.warn('Failed to auto-save contact:', e));

          // Look back in history for original message text
          const userMsgs = history.filter((h: any) => h.role === 'user');
          const origPrompt = userMsgs.slice(-2)[0]?.text || userMsgs.slice(-1)[0]?.text || transcript;
          let messageBody = "Hello from VoiceX";
          const sayingMatch = origPrompt.match(/saying (.*)$/i) || origPrompt.match(/message (.*)$/i) || origPrompt.match(/text (.*)$/i);
          if (sayingMatch) {
            messageBody = sayingMatch[1].trim();
          }

          toolName = 'send_sms';
          toolParams = { to: extractedPhone, message: messageBody };
          needsClarification = false;
          finalReplyText = `Got it, I'll remember ${pendingName}'s number for next time. Prepared your message to ${pendingName} (${extractedPhone}).`;
        }
      }
    }

    if ((toolName === 'send_sms' || toolName === 'send_whatsapp') && toolParams?.to && userId) {
      const rawTarget = String(toolParams.to).trim();
      const cleanTargetName = stripEmojis(rawTarget);
      const isRawNumber = /^\+?\d[\d\s-]*$/.test(rawTarget) && rawTarget.replace(/\D/g, '').length >= 7;

      if (isRawNumber) {
        toolParams.to = rawTarget.replace(/[^\d+]/g, '');
      } else {
        // Look up by name (emoji-stripped matching)
        const lookupRes = await fetch(`${supabaseUrl}/rest/v1/contacts?user_id=eq.${userId}`, {
          method: "GET",
          headers: {
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          }
        });

        let matchedContact = null;
        if (lookupRes.ok) {
          const contacts = await lookupRes.json();
          if (contacts && Array.isArray(contacts)) {
            matchedContact = contacts.find((c: any) => {
              const dbNameClean = stripEmojis(c.name || '').toLowerCase();
              const targetClean = cleanTargetName.toLowerCase();
              return dbNameClean === targetClean || dbNameClean.includes(targetClean) || targetClean.includes(dbNameClean);
            });
          }
        }

        if (matchedContact) {
          toolParams.to = matchedContact.phone_number;
          finalReplyText = synthesizeReply(toolName, toolParams, textContent);
        } else {
          needsClarification = true;
          finalReplyText = `I don't have a number saved for ${cleanTargetName || rawTarget}. Want to save one? What's ${cleanTargetName || rawTarget}'s number?`;
          toolName = null;
          toolParams = null;
        }
      }
    }
    // -------------------------

    if (toolName === 'web_search' && toolParams?.query) {
      const searchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
      const searchRes = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: toolParams.query }] }],
          tools: [{ googleSearch: {} }]
        })
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const cand = searchData.candidates?.[0];
        searchResult = cand?.content?.parts?.map((p: any) => p.text).join('') || null;
        
        const searchCitations = cand?.groundingMetadata?.groundingChunks
          ?.map((chunk: any) => chunk.web?.uri)
          .filter(Boolean);
        if (searchCitations && searchCitations.length > 0) {
          // Deduplicate citations
          citations = Array.from(new Set(searchCitations));
        }
      }
    }

    if (toolName === 'shopping_search') {
      const q = (toolParams?.product_query || toolParams?.query || '').trim();
      const color = (toolParams?.color || '').trim();
      const size = (toolParams?.size || '').trim();
      const maxPrice = toolParams?.max_price || toolParams?.price;

      let restUrl = `${supabaseUrl}/rest/v1/products?select=*`;
      if (q) restUrl += `&name=ilike.*${encodeURIComponent(q)}*`;
      if (color) restUrl += `&color=ilike.*${encodeURIComponent(color)}*`;
      if (size) restUrl += `&size=ilike.*${encodeURIComponent(size)}*`;
      if (maxPrice) restUrl += `&price=lte.${maxPrice}`;

      const prodRes = await fetch(restUrl, {
        headers: {
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        }
      });

      let products: any[] = [];
      if (prodRes.ok) {
        products = await prodRes.json();
      }

      if ((!products || products.length === 0) && q) {
        const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/products?name=ilike.*${encodeURIComponent(q)}*`, {
          headers: {
            "apikey": supabaseServiceRoleKey,
            "Authorization": `Bearer ${supabaseServiceRoleKey}`
          }
        });
        if (fallbackRes.ok) {
          const allProds = await fallbackRes.json();
          products = allProds.filter((p: any) => {
            let matches = true;
            if (color && p.color && !p.color.toLowerCase().includes(color.toLowerCase())) matches = false;
            if (size && p.size && p.size.toLowerCase() !== size.toLowerCase()) matches = false;
            if (maxPrice && p.price && parseFloat(p.price) > Number(maxPrice)) matches = false;
            return matches;
          });
        }
      }

      searchResult = JSON.stringify(products);

      if (products && products.length > 0) {
        finalReplyText = `Found ${products.length} product${products.length > 1 ? 's' : ''} matching your search:`;
      } else {
        const filterDesc = [
          color ? color : '',
          size ? `size ${size}` : '',
          q ? q : 'products',
          maxPrice ? `under $${maxPrice}` : ''
        ].filter(Boolean).join(' ');
        finalReplyText = `No products found matching ${filterDesc}. Try adjusting your search.`;
      }
    }

    // Insert command row into Supabase `commands` table using service_role key to bypass RLS
    const dbInsertUrl = `${supabaseUrl}/rest/v1/commands`;
    const insertPayload = {
      user_id: userId || 'anonymous',
      conversation_id: conversationId || null,
      transcript,
      intent_tool: toolName,
      intent_params: toolParams,
      status: (toolName === 'web_search' || toolName === 'shopping_search') ? "executed" : "pending",
      result: searchResult,
      created_at: new Date().toISOString()
    };

    console.log('[DB Insert Payload]:', JSON.stringify(insertPayload));

    const dbRes = await fetch(dbInsertUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(insertPayload)
    });

    let commandId = null;
    let dbErrorStr = null;

    if (dbRes.ok) {
      const dbData = await dbRes.json();
      if (dbData && dbData.length > 0) {
        commandId = dbData[0].id;
        console.log('[DB Insert Success] commandId:', commandId);
      }
    } else {
      dbErrorStr = await dbRes.text();
      console.error("[DB Insert Failed]:", dbErrorStr);
    }

    if (toolName === 'web_search' && searchResult) {
      finalReplyText = searchResult;
    }

    return new Response(
      JSON.stringify({
        reply: finalReplyText,
        tool: toolName,
        params: toolParams,
        commandId: commandId,
        citations: citations,
        result: searchResult,
        needsClarification,
        dbError: dbErrorStr,
        subscriptionInfo
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("Error in gemini-intent function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
