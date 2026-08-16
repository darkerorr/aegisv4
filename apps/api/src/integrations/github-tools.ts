import type { PrismaClient } from "@prisma/client";
import { getTool } from "@aegis/tools";
import { getGitHubOctokitForAgent } from "./github-integration.js";
import { GitHubIntegrationError, retryGitHubOperation } from "./github/index.js";

const MAX_FILE_BYTES = 256 * 1024;

type ToolInput = Record<string, unknown>;

function pagination(input: ToolInput): { page: number; per_page: number } {
  return { page: Math.max(1, Math.min(Number(input.page) || 1, 100)), per_page: Math.max(1, Math.min(Number(input.perPage) || 50, 100)) };
}

function requirePermission(permissions: Record<string, string>, permission: "contents" | "issues" | "pullRequests"): void {
  const value = permissions[permission];
  if (!value || value === "none") throw new GitHubIntegrationError("GITHUB_PERMISSION_REQUIRED", `The GitHub installation does not grant ${permission} read access.`, 403);
}

function normalizeToolError(cause: unknown): never {
  if (cause instanceof GitHubIntegrationError) throw cause;
  const status = typeof cause === "object" && cause !== null && "status" in cause ? Number((cause as { status?: number }).status) : undefined;
  if (status === 404) throw new GitHubIntegrationError("GITHUB_REPOSITORY_NOT_ACCESSIBLE", "The repository is not accessible to this GitHub installation.", 404);
  if (status === 403 || status === 429) throw new GitHubIntegrationError("GITHUB_RATE_LIMITED", "GitHub denied the request because of a permission or rate limit.", 429);
  throw new GitHubIntegrationError("GITHUB_TOOL_FAILED", "The GitHub tool could not complete the request.", 502);
}

function repositoryView(repository: any) {
  return { owner: repository.owner?.login, name: repository.name, fullName: repository.full_name, private: repository.private, description: repository.description, defaultBranch: repository.default_branch, language: repository.language, updatedAt: repository.updated_at, htmlUrl: repository.html_url };
}

function issueView(issue: any) {
  return { number: issue.number, title: issue.title, state: issue.state, author: issue.user?.login || null, labels: (issue.labels || []).map((label: any) => typeof label === "string" ? label : label.name).filter(Boolean), createdAt: issue.created_at, updatedAt: issue.updated_at, body: issue.body || null, snippet: (issue.body || "").slice(0, 500), htmlUrl: issue.html_url };
}

function pullRequestView(pull: any) {
  return { number: pull.number, title: pull.title, state: pull.state, author: pull.user?.login || null, draft: Boolean(pull.draft), base: pull.base?.ref, head: pull.head?.ref, createdAt: pull.created_at, updatedAt: pull.updated_at, body: pull.body || null, htmlUrl: pull.html_url };
}

function binaryContent(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (!sample.length) return false;
  let suspicious = 0;
  for (const byte of sample) if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
  return suspicious / sample.length > 0.1;
}

async function repository(octokit: any, owner: string, repo: string): Promise<any> {
  return ((await retryGitHubOperation(() => octokit.rest.repos.get({ owner, repo }))) as any).data;
}

export async function executeGitHubTool(prisma: PrismaClient, userId: string, toolId: string, rawInput: ToolInput): Promise<Record<string, unknown>> {
  const definition = getTool(toolId);
  if (!definition || !definition.implemented || definition.requiredIntegration !== "github") throw new GitHubIntegrationError("GITHUB_TOOL_NOT_IMPLEMENTED", "This GitHub tool is not implemented.", 501);
  const parsed = definition.inputSchema.safeParse(rawInput);
  if (!parsed.success) throw new GitHubIntegrationError("GITHUB_TOOL_INPUT_INVALID", "The GitHub tool input is invalid.", 400);
  const input = parsed.data as ToolInput;
  const { octokit, accountLogin, permissions } = await getGitHubOctokitForAgent(prisma, userId);

  try {
    if (toolId === "github.listRepositories") {
      const { page, per_page } = pagination(input);
      const response: any = await retryGitHubOperation(() => octokit.rest.apps.listReposAccessibleToInstallation({ page, per_page }));
      return { account: accountLogin, repositories: (response.data.repositories || []).map(repositoryView), totalCount: response.data.total_count, page, perPage: per_page };
    }

    const owner = String(input.owner || "");
    const repo = String(input.repo || "");
    const accessible = await repository(octokit, owner, repo);

    if (toolId === "github.getRepository") return { repository: repositoryView(accessible) };
    if (toolId === "github.listDirectory") {
      requirePermission(permissions, "contents");
      const response: any = await retryGitHubOperation(() => octokit.rest.repos.getContent({ owner, repo, path: String(input.path || ""), ...(input.ref ? { ref: String(input.ref) } : {}) }));
      if (!Array.isArray(response.data)) throw new GitHubIntegrationError("GITHUB_NOT_A_DIRECTORY", "The requested path is not a directory.", 422);
      return { repository: `${owner}/${repo}`, path: String(input.path || ""), entries: response.data.slice(0, 500).map((entry: any) => ({ name: entry.name, path: entry.path, type: entry.type, size: entry.size, sha: entry.sha, htmlUrl: entry.html_url })) };
    }
    if (toolId === "github.getFileContent") {
      requirePermission(permissions, "contents");
      const response: any = await retryGitHubOperation(() => octokit.rest.repos.getContent({ owner, repo, path: String(input.path), ...(input.ref ? { ref: String(input.ref) } : {}) }));
      if (Array.isArray(response.data) || response.data.type !== "file") throw new GitHubIntegrationError("GITHUB_NOT_A_FILE", "The requested path is not a file.", 422);
      if (!response.data.content || response.data.encoding !== "base64") throw new GitHubIntegrationError("GITHUB_FILE_CONTENT_UNAVAILABLE", "GitHub did not return inline file content.", 422);
      const buffer = Buffer.from(response.data.content.replace(/\s/g, ""), "base64");
      if (binaryContent(buffer)) throw new GitHubIntegrationError("GITHUB_BINARY_FILE", "Binary GitHub files cannot be sent to the model.", 415);
      const truncated = buffer.byteLength > MAX_FILE_BYTES;
      return { repository: `${owner}/${repo}`, path: response.data.path, ref: input.ref || accessible.default_branch, content: buffer.subarray(0, MAX_FILE_BYTES).toString("utf8"), size: buffer.byteLength, truncated, maxBytes: MAX_FILE_BYTES, htmlUrl: response.data.html_url };
    }
    if (toolId === "github.searchCode") {
      requirePermission(permissions, "contents");
      const { page, per_page } = pagination(input);
      const response: any = await retryGitHubOperation(() => octokit.rest.search.code({ q: `${String(input.query)} repo:${owner}/${repo}`, page, per_page }));
      return { repository: `${owner}/${repo}`, query: input.query, totalCount: response.data.total_count, page, perPage: per_page, matches: (response.data.items || []).map((item: any) => ({ name: item.name, path: item.path, sha: item.sha, htmlUrl: item.html_url })) };
    }
    if (toolId === "github.listIssues") {
      requirePermission(permissions, "issues");
      const { page, per_page } = pagination(input);
      const response: any = await retryGitHubOperation(() => octokit.rest.issues.listForRepo({ owner, repo, state: String(input.state || "open"), page, per_page }));
      return { repository: `${owner}/${repo}`, page, perPage: per_page, issues: response.data.filter((issue: any) => !issue.pull_request).map(issueView) };
    }
    if (toolId === "github.getIssue") {
      requirePermission(permissions, "issues");
      const response: any = await retryGitHubOperation(() => octokit.rest.issues.get({ owner, repo, issue_number: Number(input.issueNumber) }));
      return { repository: `${owner}/${repo}`, issue: issueView(response.data) };
    }
    if (toolId === "github.listPullRequests") {
      requirePermission(permissions, "pullRequests");
      const { page, per_page } = pagination(input);
      const response: any = await retryGitHubOperation(() => octokit.rest.pulls.list({ owner, repo, state: String(input.state || "open"), page, per_page }));
      return { repository: `${owner}/${repo}`, page, perPage: per_page, pullRequests: response.data.map(pullRequestView) };
    }
    if (toolId === "github.getPullRequest") {
      requirePermission(permissions, "pullRequests");
      const response: any = await retryGitHubOperation(() => octokit.rest.pulls.get({ owner, repo, pull_number: Number(input.pullNumber) }));
      return { repository: `${owner}/${repo}`, pullRequest: pullRequestView(response.data) };
    }
    throw new GitHubIntegrationError("GITHUB_TOOL_NOT_IMPLEMENTED", "This GitHub tool is not implemented.", 501);
  } catch (cause) { normalizeToolError(cause); }
}

export const githubToolTestExports = { binaryContent, issueView, pullRequestView, repositoryView };