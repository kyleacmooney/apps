import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const TMDB_API_URL = "https://api.themoviedb.org/3/search/multi"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
}

interface TmdbSearchResult {
  id: number
  media_type: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}

type TmdbSuggestionKind = "movie" | "show" | "other"

interface TmdbTitleSuggestion {
  id: number
  title: string
  year: number | null
  kind: TmdbSuggestionKind
}

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return null

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

function extractYear(rawDate?: string): number | null {
  if (!rawDate) return null
  const year = Number(rawDate.slice(0, 4))
  return Number.isFinite(year) && year > 1800 ? year : null
}

function normalizeResult(result: TmdbSearchResult): TmdbTitleSuggestion | null {
  const kind: TmdbSuggestionKind =
    result.media_type === "movie" ? "movie" : result.media_type === "tv" ? "show" : "other"

  const title = result.title?.trim() || result.name?.trim() || ""
  if (!title) return null

  return {
    id: result.id,
    title,
    year: extractYear(result.release_date ?? result.first_air_date),
    kind,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const userId = await verifyAuth(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const tmdbApiKey = Deno.env.get("TMDB_API_KEY")
    if (!tmdbApiKey) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { query } = await req.json() as { query?: string }
    const trimmedQuery = query?.trim() ?? ""
    if (trimmedQuery.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const params = new URLSearchParams({
      api_key: tmdbApiKey,
      query: trimmedQuery,
      include_adult: "false",
      language: "en-US",
      page: "1",
    })

    const tmdbResponse = await fetch(`${TMDB_API_URL}?${params.toString()}`)
    if (!tmdbResponse.ok) {
      return new Response(JSON.stringify({ error: `TMDB request failed (${tmdbResponse.status})` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payload = await tmdbResponse.json() as { results?: TmdbSearchResult[] }
    const results = (payload.results ?? [])
      .slice(0, 8)
      .map(normalizeResult)
      .filter((item): item is TmdbTitleSuggestion => item !== null)

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
