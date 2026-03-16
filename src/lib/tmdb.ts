import { SUPABASE_URL } from "@/lib/supabase"

export type TmdbSuggestionKind = "movie" | "show" | "other"

export interface TmdbTitleSuggestion {
  id: number
  title: string
  year: number | null
  kind: TmdbSuggestionKind
}

interface TmdbSearchResponse {
  results?: TmdbTitleSuggestion[]
  error?: string
}

const TMDB_SEARCH_EDGE_URL = `${SUPABASE_URL}/functions/v1/tmdb-search`

export async function searchTmdbTitles({
  query,
  accessToken,
}: {
  query: string
  accessToken?: string
}): Promise<TmdbTitleSuggestion[]> {
  if (!accessToken) {
    return []
  }

  const response = await fetch(TMDB_SEARCH_EDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  })

  const payload = await response.json() as TmdbSearchResponse
  if (!response.ok) {
    throw new Error(payload.error ?? `TMDB search failed (${response.status})`)
  }

  return payload.results ?? []
}
