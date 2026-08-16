import type { ToolDefinition, ToolResult } from "./Tool.js";

const SEARCH_CACHE = new Map<string, { results: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function searchWeb(query: string): Promise<string> {
  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" +
      encodeURIComponent(query);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();

    const results: string[] = [];
    const resultRegex =
      /<a[^>]+class="result__a"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
      const snippetMatch = html
        .slice(match.index + match[0].length)
        .match(
          /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i,
        );
      const title = (match[2] || "").replace(/<[^>]+>/g, "").trim();
      const snippet = snippetMatch?.[1]
        ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";
      results.push(`- ${title}\n  ${match[1]}\n  ${snippet}`);
    }

    if (results.length === 0) {
      return `No results found for: ${query}`;
    }

    return `Web search results for "${query}":\n\n${results.join("\n\n")}`;
  } catch (error) {
    return `Web search error: ${(error as Error).message}`;
  }
}

export function createWebSearchTool(): ToolDefinition {
  return {
    name: "webSearch",
    description:
      "Search the web for current information. Use this when you need up-to-date data, documentation, API references, or answers to questions beyond your knowledge.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The search query",
        required: true,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const query = String(args.query || "");
      if (!query) {
        return { success: false, output: "Missing required parameter: query" };
      }

      const cached = SEARCH_CACHE.get(query);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { success: true, output: cached.results };
      }

      const results = await searchWeb(query);
      SEARCH_CACHE.set(query, { results, timestamp: Date.now() });
      return { success: true, output: results };
    },
  };
}
