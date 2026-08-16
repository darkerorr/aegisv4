import { afterEach, describe, expect, it } from "vitest";
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGitHubAPI, getGitHubConfigurationStatus, getInstallationInfo, GitHubIntegrationError, hashGitHubState, resolvePrivateKeyPath } from "./index.js";
import { workspaceRoot } from "../../config/environment.js";

const original = { ...process.env };
const temporary: string[] = [];
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  while (temporary.length) rmSync(temporary.pop()!, { recursive: true, force: true });
});

function baseConfiguration(privateKeyPath: string) {
  process.env.GITHUB_APP_ID = "12345";
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_PRIVATE_KEY_PATH = privateKeyPath;
}

describe("GitHub App configuration", () => {
  it("reports missing configuration without exposing values", () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    const status = getGitHubConfigurationStatus();
    expect(status).toMatchObject({ configured: false, appIdConfigured: false, clientIdConfigured: false, clientSecretConfigured: false });
    expect(JSON.stringify(status)).not.toContain("test-client-secret");
  });

  it("returns GITHUB_PRIVATE_KEY_NOT_FOUND for a missing PEM", () => {
    baseConfiguration(path.join(tmpdir(), "aegis-missing-private-key.pem"));
    expect(() => createGitHubAPI("http://127.0.0.1:3000", "http://127.0.0.1:4000")).toThrowError(expect.objectContaining({ code: "GITHUB_PRIVATE_KEY_NOT_FOUND", status: 503 }));
  });

  it("returns GITHUB_PRIVATE_KEY_INVALID for malformed PEM", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "aegis-github-invalid-"));
    temporary.push(directory);
    const file = path.join(directory, "invalid.pem");
    writeFileSync(file, "not a private key", "utf8");
    baseConfiguration(file);
    expect(() => createGitHubAPI("http://127.0.0.1:3000", "http://127.0.0.1:4000")).toThrowError(expect.objectContaining({ code: "GITHUB_PRIVATE_KEY_INVALID", status: 503 }));
  });

  it("accepts a valid private key without returning it in diagnostics", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "aegis-github-valid-"));
    temporary.push(directory);
    const file = path.join(directory, "valid.pem");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    writeFileSync(file, privateKey.export({ type: "pkcs8", format: "pem" }), "utf8");
    baseConfiguration(file);
    const status = getGitHubConfigurationStatus();
    expect(status).toMatchObject({ configured: true, privateKeyExists: true, privateKeyReadable: true, privateKeyValid: true });
    expect(JSON.stringify(status)).not.toContain("PRIVATE KEY");
    expect(() => createPrivateKey(readFileSync(file, "utf8"))).not.toThrow();
  });

  it("resolves relative PEM paths against the monorepo root", () => {
    const resolved = resolvePrivateKeyPath("keys/app.pem");
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved).toBe(path.join(workspaceRoot, "keys", "app.pem"));
  });

  it("hashes OAuth state without storing the raw state", () => {
    const state = "one-time-state-value";
    expect(hashGitHubState(state)).toHaveLength(64);
    expect(hashGitHubState(state)).not.toContain(state);
    expect(hashGitHubState(state)).toBe(hashGitHubState(state));
  });
});

describe("GitHub installation metadata", () => {
  it("normalizes account and permissions", async () => {
    const octokit = {
      rest: {
        apps: {
          getInstallation: async () => ({
            data: {
              id: 42,
              account: { login: "aegis", type: "Organization", id: 7, avatar_url: "https://example.test/avatar" },
              repository_selection: "selected",
              permissions: { contents: "read", issues: "read", pull_requests: "read" },
            },
          }),
        },
      },
    };
    await expect(getInstallationInfo(octokit, 42)).resolves.toMatchObject({ installationId: 42, accountLogin: "aegis", accountType: "Organization", repositorySelection: "selected", permissions: { contents: "read" } });
  });

  it("rejects an installation without an account", async () => {
    const octokit = {
      rest: {
        apps: {
          getInstallation: async () => ({
            data: {
              id: 42,
              account: null,
              repository_selection: "selected",
              permissions: {},
            },
          }),
        },
      },
    };
    await expect(getInstallationInfo(octokit, 42)).rejects.toBeInstanceOf(GitHubIntegrationError);
  });
});