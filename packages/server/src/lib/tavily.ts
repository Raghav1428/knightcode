export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
}

export async function searchTavily(
  query: string,
  maxResults = 5,
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured on the server");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults, 20),
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search API failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as any;

  // Map to clean format to avoid token bloat
  const cleanResults = (data.results || []).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    content: r.content || "",
    score: r.score || 0,
  }));

  return { results: cleanResults };
}
