import { z, type ZodType } from "zod";

export type ToolRisk = "read" | "write" | "destructive";
export type ToolAvailability = "server" | "device" | "both";
export type ToolExecutionContext = { userId: string; requestId: string; signal?: AbortSignal };
export type AegisToolDefinition<TInput = unknown, TOutput = unknown> = {
  id: string; name: string; description: string;
  category: "email" | "files" | "web" | "development" | "calendar" | "productivity" | "local";
  inputSchema: ZodType<TInput>; outputSchema: ZodType<TOutput>;
  requiredIntegration?: string; requiredScopes?: string[];
  risk: ToolRisk; availability: ToolAvailability; implemented: boolean;
};

const emptyInput = z.object({}).passthrough();
const result = z.record(z.unknown());
export const toolRegistry: ReadonlyArray<AegisToolDefinition> = [
  // --- EMAIL ---
  { id: "gmail.getLatestMessage", name: "Gmail", description: "Read the most recent message.", category: "email", inputSchema: emptyInput, outputSchema: result, requiredIntegration: "google", requiredScopes: ["gmail.readonly"], risk: "read", availability: "server", implemented: true },
  // --- FILES ---
  { id: "drive.searchFiles", name: "Google Drive", description: "Search connected Drive metadata.", category: "files", inputSchema: z.object({ query: z.string() }), outputSchema: result, requiredIntegration: "google", risk: "read", availability: "server", implemented: false },
  { id: "attachments.readText", name: "Attachments", description: "Read an uploaded text or code file.", category: "files", inputSchema: z.object({ attachmentIds: z.array(z.string()) }), outputSchema: result, risk: "read", availability: "server", implemented: true },
  // --- WEB ---
  { id: "web.search", name: "Web search", description: "Search current public information online.", category: "web", inputSchema: z.object({ query: z.string(), maxResults: z.number().min(1).max(20).optional(), freshness: z.enum(["day","week","month","year","any"]).optional(), language: z.string().min(2).max(12).optional(), country: z.string().min(2).max(12).optional() }), outputSchema: result, risk: "read", availability: "server", implemented: true },
  { id: "web.readPage", name: "Read web page", description: "Extract text content from a public URL.", category: "web", inputSchema: z.object({ url: z.string().url() }), outputSchema: result, risk: "read", availability: "server", implemented: true },
  // --- DEVELOPMENT ---
  { id: "github.listRepositories", name: "GitHub repos", description: "List accessible GitHub repositories.", category: "development", inputSchema: z.object({ page: z.number().int().min(1).max(100).optional(), perPage: z.number().int().min(1).max(100).optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.getRepository", name: "GitHub repo info", description: "Get details about a specific repository.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.listDirectory", name: "GitHub directory", description: "List files in a repository directory.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), path: z.string(), ref: z.string().optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.getFileContent", name: "GitHub file", description: "Read a file from a repository.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), path: z.string(), ref: z.string().optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.searchCode", name: "GitHub code search", description: "Search code in a repository.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), query: z.string().min(1).max(256), page: z.number().int().min(1).max(100).optional(), perPage: z.number().int().min(1).max(100).optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.listIssues", name: "GitHub issues", description: "List repository issues.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional(), page: z.number().int().min(1).max(100).optional(), perPage: z.number().int().min(1).max(100).optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.getIssue", name: "GitHub issue", description: "Get a specific issue.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), issueNumber: z.number() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.listPullRequests", name: "GitHub PRs", description: "List pull requests.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional(), page: z.number().int().min(1).max(100).optional(), perPage: z.number().int().min(1).max(100).optional() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  { id: "github.getPullRequest", name: "GitHub PR", description: "Get a specific pull request.", category: "development", inputSchema: z.object({ owner: z.string(), repo: z.string(), pullNumber: z.number() }), outputSchema: result, requiredIntegration: "github", risk: "read", availability: "server", implemented: true },
  // --- CALENDAR ---
  { id: "calendar.listUpcomingEvents", name: "Calendar", description: "Read upcoming events.", category: "calendar", inputSchema: emptyInput, outputSchema: result, requiredIntegration: "google", risk: "read", availability: "server", implemented: false },
  // --- LOCAL ---
  { id: "code.inspectWorkspace", name: "Project files", description: "Inspect a trusted project workspace.", category: "development", inputSchema: emptyInput, outputSchema: result, risk: "read", availability: "device", implemented: false },
];

export function getTool(id: string): AegisToolDefinition | undefined { return toolRegistry.find((tool) => tool.id === id); }

// Re-export providers, ssrf and rate-limiter
export { DuckDuckGoProvider, registerWebSearchProvider, getWebSearchProvider, getConfiguredProvider, isWebSearchConfigured, WebSearchError, WEB_SEARCH_ERRORS } from "./providers/index.js";
export type { WebSearchProvider, WebSearchQuery, WebSearchResult } from "./providers/index.js";
export { checkWebSearchRateLimit, resetWebSearchRateLimitsForTests } from "./rate-limiter.js";
export { validateUrl, readPageContent } from "./ssrf.js";
