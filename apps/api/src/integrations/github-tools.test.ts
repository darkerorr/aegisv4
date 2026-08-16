import { describe, expect, it } from "vitest";
import { githubToolTestExports } from "./github-tools.js";

const { binaryContent, issueView, pullRequestView, repositoryView } = githubToolTestExports;

describe("GitHub tool bounds", () => {
  it("accepts text and rejects null-byte or control-heavy binary buffers", () => {
    expect(binaryContent(Buffer.from("hello\nworld", "utf8"))).toBe(false);
    expect(binaryContent(Buffer.from([0, 1, 2, 3]))).toBe(true);
    expect(binaryContent(Buffer.from([1, 2, 3, 4, 5, 65]))).toBe(true);
  });

  it("returns bounded issue fields", () => {
    expect(issueView({ number: 2, title: "Bug", state: "open", user: { login: "dev" }, labels: [{ name: "bug" }], created_at: "a", updated_at: "b", body: "x".repeat(800), html_url: "https://github.test/issue" })).toMatchObject({ number: 2, author: "dev", labels: ["bug"], snippet: expect.stringMatching(/^x{500}$/), htmlUrl: "https://github.test/issue" });
  });

  it("returns pull request branches and draft state", () => {
    expect(pullRequestView({ number: 3, title: "PR", state: "open", user: { login: "dev" }, draft: true, base: { ref: "main" }, head: { ref: "feature" }, created_at: "a", updated_at: "b", html_url: "https://github.test/pr" })).toMatchObject({ number: 3, draft: true, base: "main", head: "feature" });
  });

  it("never includes token fields in repository output", () => {
    const view = repositoryView({ owner: { login: "owner" }, name: "repo", full_name: "owner/repo", private: true, description: null, default_branch: "main", language: "TypeScript", updated_at: "now", html_url: "https://github.test/repo", token: "secret" });
    expect(view).toMatchObject({ owner: "owner", name: "repo", private: true });
    expect(JSON.stringify(view)).not.toContain("secret");
  });
});