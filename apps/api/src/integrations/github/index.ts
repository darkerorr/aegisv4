import { createHash, createPrivateKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { workspaceRoot } from "../../config/environment.js";

export interface GitHubConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webUrl: string;
  apiUrl: string;
  callbackUrl: string;
  setupUrl: string;
  appSlug: string;
}

export type GitHubConfigurationStatus = {
  configured: boolean;
  appIdConfigured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  privateKeyPathConfigured: boolean;
  privateKeyExists: boolean;
  privateKeyReadable: boolean;
  privateKeyValid: boolean;
  errorCode?: string;
};

export class GitHubIntegrationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number = 400) {
    super(message);
    this.name = "GitHubIntegrationError";
  }
}

function configuredValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function resolvePrivateKeyPath(rawValue = configuredValue("GITHUB_PRIVATE_KEY_PATH") || "aegis-app-account-check.2026-07-28.private-key.pem"): string {
  return path.isAbsolute(rawValue) ? path.normalize(rawValue) : path.resolve(workspaceRoot, rawValue);
}

function readPrivateKey(): string {
  const keyPath = resolvePrivateKeyPath();
  if (!existsSync(keyPath)) throw new GitHubIntegrationError("GITHUB_PRIVATE_KEY_NOT_FOUND", "The GitHub App private key file was not found.", 503);
  let privateKey: string;
  try { privateKey = readFileSync(keyPath, "utf8"); }
  catch { throw new GitHubIntegrationError("GITHUB_PRIVATE_KEY_UNREADABLE", "The GitHub App private key file could not be read.", 503); }
  try { createPrivateKey(privateKey); }
  catch { throw new GitHubIntegrationError("GITHUB_PRIVATE_KEY_INVALID", "The GitHub App private key is not a valid PEM private key.", 503); }
  return privateKey;
}

export function getGitHubConfigurationStatus(): GitHubConfigurationStatus {
  const status: GitHubConfigurationStatus = {
    configured: false,
    appIdConfigured: Boolean(configuredValue("GITHUB_APP_ID")),
    clientIdConfigured: Boolean(configuredValue("GITHUB_CLIENT_ID")),
    clientSecretConfigured: Boolean(configuredValue("GITHUB_CLIENT_SECRET")),
    privateKeyPathConfigured: Boolean(configuredValue("GITHUB_PRIVATE_KEY_PATH")),
    privateKeyExists: false,
    privateKeyReadable: false,
    privateKeyValid: false,
  };
  const keyPath = resolvePrivateKeyPath();
  status.privateKeyExists = existsSync(keyPath);
  if (status.privateKeyExists) {
    try {
      const key = readFileSync(keyPath, "utf8");
      status.privateKeyReadable = true;
      createPrivateKey(key);
      status.privateKeyValid = true;
    } catch {
      status.errorCode = status.privateKeyReadable ? "GITHUB_PRIVATE_KEY_INVALID" : "GITHUB_PRIVATE_KEY_UNREADABLE";
    }
  } else {
    status.errorCode = "GITHUB_PRIVATE_KEY_NOT_FOUND";
  }
  status.configured = status.appIdConfigured && status.clientIdConfigured && status.clientSecretConfigured && status.privateKeyValid;
  if (!status.configured && !status.errorCode) status.errorCode = "GITHUB_NOT_CONFIGURED";
  return status;
}

function loadGitHubConfig(webUrl: string, apiUrl: string): GitHubConfig {
  const appId = configuredValue("GITHUB_APP_ID");
  const clientId = configuredValue("GITHUB_CLIENT_ID");
  const clientSecret = configuredValue("GITHUB_CLIENT_SECRET");
  if (!appId || !clientId || !clientSecret) {
    throw new GitHubIntegrationError("GITHUB_NOT_CONFIGURED", "The GitHub App configuration is incomplete.", 503);
  }
  return {
    appId,
    clientId,
    clientSecret,
    privateKey: readPrivateKey(),
    webUrl,
    apiUrl,
    callbackUrl: configuredValue("GITHUB_CALLBACK_URL") || `${apiUrl}/integrations/github/callback`,
    setupUrl: configuredValue("GITHUB_SETUP_URL") || `${apiUrl}/integrations/github/setup`,
    appSlug: configuredValue("GITHUB_APP_SLUG") || "aegis-app-account-check",
  };
}

let cachedSignature = "";
let cachedConfig: GitHubConfig | null = null;
let cachedApp: App | null = null;

function getApp(config: GitHubConfig): App {
  const signature = createHash("sha256").update(`${config.appId}\0${config.clientId}\0${config.privateKey}`).digest("hex");
  if (cachedApp && cachedConfig && cachedSignature === signature) return cachedApp;
  cachedApp = new App({ appId: config.appId, privateKey: config.privateKey, oauth: { clientId: config.clientId, clientSecret: config.clientSecret } });
  cachedConfig = config;
  cachedSignature = signature;
  return cachedApp;
}

export interface GitHubInstallationInfo {
  installationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  accountId: number;
  avatarUrl: string;
  repositorySelection: "all" | "selected";
  permissions: Record<string, string>;
}

type GitHubOctokit = any;

export async function getInstallationInfo(octokit: GitHubOctokit, installationId: number): Promise<GitHubInstallationInfo> {
  const { data } = await octokit.rest.apps.getInstallation({ installation_id: installationId });
  const account = data.account as { login?: string; type?: string; id?: number; avatar_url?: string } | null;
  if (!account?.login || !account.id) throw new GitHubIntegrationError("GITHUB_INSTALLATION_INVALID", "The GitHub installation has no usable account.", 502);
  return {
    installationId: data.id,
    accountLogin: account.login,
    accountType: account.type === "Organization" ? "Organization" : "User",
    accountId: account.id,
    avatarUrl: account.avatar_url || "",
    repositorySelection: data.repository_selection === "all" ? "all" : "selected",
    permissions: data.permissions as Record<string, string>,
  };
}

export function createGitHubAPI(webUrl: string, apiUrl: string): GitHubAPI {
  const config = loadGitHubConfig(webUrl, apiUrl);
  const app = getApp(config);
  return {
    config,
    getAuthorizationUrl(state: string): string {
      return `https://github.com/apps/${encodeURIComponent(config.appSlug)}/installations/new?state=${encodeURIComponent(state)}`;
    },
    async getInstallationOctokit(installationId: number): Promise<GitHubOctokit> {
      return app.getInstallationOctokit(installationId) as unknown as GitHubOctokit;
    },
    async getUserOctokit(code: string): Promise<{ octokit: Octokit; token: string }> {
      const { authentication } = await app.oauth.createToken({ code });
      return { octokit: new Octokit({ auth: authentication.token }), token: authentication.token };
    },
    async getInstallationInfo(installationId: number): Promise<GitHubInstallationInfo> {
      if (!Number.isSafeInteger(installationId) || installationId <= 0) throw new GitHubIntegrationError("GITHUB_INSTALLATION_INVALID", "The GitHub installation identifier is invalid.", 400);
      const octokit = await app.getInstallationOctokit(installationId);
      return getInstallationInfo(octokit, installationId);
    },
    async testInstallation(installationId: number): Promise<GitHubInstallationInfo> {
      return this.getInstallationInfo(installationId);
    },
  };
}

export interface GitHubAPI {
  config: GitHubConfig;
  getAuthorizationUrl(state: string): string;
  getInstallationOctokit(installationId: number): Promise<Octokit>;
  getUserOctokit(code: string): Promise<{ octokit: Octokit; token: string }>;
  getInstallationInfo(installationId: number): Promise<GitHubInstallationInfo>;
  testInstallation(installationId: number): Promise<GitHubInstallationInfo>;
}

export async function retryGitHubOperation<T>(operation: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (attempt < maxRetries && (error as { status?: number }).status === 401) continue;
      throw error;
    }
  }
  throw lastError;
}

export function hashGitHubState(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
