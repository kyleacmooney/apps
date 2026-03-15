export type TmdbSuggestionKind = "movie" | "show" | "other"

export interface TmdbTitleSuggestion {
  id: number
  title: string
  year: number | null
  kind: TmdbSuggestionKind
}

interface TmdbSearchResult {
  id: number
  media_type: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}

function extractYear(rawDate?: string): number | null {
  if (!rawDate) return null
  const year = Number(rawDate.slice(0, 4))
  return Number.isFinite(year) && year > 1800 ? year : null
}

export async function searchTmdbTitles(query: string): Promise<TmdbTitleSuggestion[]> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (!apiKey) {
    return []
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  })

  const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`)
  }

  const payload = await response.json() as { results?: TmdbSearchResult[] }
  return (payload.results ?? [])
    .slice(0, 8)
    .map((result): TmdbTitleSuggestion | null => {
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
    })
    .filter((item): item is TmdbTitleSuggestion => item !== null)
}
