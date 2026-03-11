import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  system?: string;
  context?: string;
  /** User's Claude OAuth token for browser-held modes (`local` / `private`) */
  oauth_token?: string;
  /** Storage mode used by the client; shared mode resolves the token server-side */
  token_storage_mode?: "local" | "shared" | "private";
  model?: string;
  max_tokens?: number;
}

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-20250514",
]);

const MAX_ALLOWED_TOKENS = 4096;
const MAX_THREADS_PER_DAY = 50;

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getSharedOAuthToken(userId: string): Promise<string | null> {
  const serviceRoleKey = Deno.env.get("CHAT_SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    // Service role key not configured; cannot fetch shared token server-side
    return null;
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
  );

  const { data, error } = await admin
    .from("user_settings")
    .select("claude_oauth_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.claude_oauth_token ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const userId = await verifyAuth(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Rate limit: max threads created in the last 24 hours ──
  try {
    const serviceRoleKey = Deno.env.get("CHAT_SUPABASE_SERVICE_ROLE_KEY");
    if (serviceRoleKey) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceRoleKey,
      );
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("chat_threads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);

      if (count !== null && count >= MAX_THREADS_PER_DAY) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. You've created too many conversations today. Try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
  } catch {
    // Rate limit check is best-effort; don't block chat on failure
  }

  try {
    const body = (await req.json()) as ChatRequest;
    const {
      messages,
      system,
      context,
      oauth_token: userOAuthToken,
      token_storage_mode,
      model,
      max_tokens,
    } = body;

    const resolvedModel = model ?? "claude-sonnet-4-20250514";
    if (!ALLOWED_MODELS.has(resolvedModel)) {
      return new Response(
        JSON.stringify({ error: "Unsupported model" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resolvedMaxTokens = Math.min(max_tokens ?? 2048, MAX_ALLOWED_TOKENS);

    let oauthToken: string | null = null;
    if (token_storage_mode === "shared") {
      oauthToken = await getSharedOAuthToken(userId);
    } else {
      oauthToken = userOAuthToken ?? null;
    }

    if (!oauthToken) {
      return new Response(
        JSON.stringify({
          error: "Invalid or missing OAuth token. Update it in Settings → AI Token.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = [
      "You are a helpful AI assistant embedded in a personal tools app. You help the user with their workouts, exercises, plant care, and other life management tasks.",
      "Be concise and friendly. Use markdown formatting when helpful.",
      "The user's data is stored in Supabase — you can discuss their data but you cannot directly query it from this chat.",
      system,
      context,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${oauthToken}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: resolvedMaxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(
        JSON.stringify({
          error: `Anthropic API error: ${response.status}`,
          details: errorBody,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
