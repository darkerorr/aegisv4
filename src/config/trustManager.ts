import path from "node:path";
import { readJson, writeJson } from "../utils/fs.js";
import { trustedProjectsPath } from "../utils/paths.js";

interface TrustedProject {
  path: string;
  trustedAt: string;
}

export class TrustManager {
  async isTrusted(projectPath: string): Promise<boolean> {
    const normalized = this.normalize(projectPath);
    const trusted = await this.list();
    return trusted.some((project) => project.path === normalized);
  }

  async trust(projectPath: string): Promise<void> {
    const normalized = this.normalize(projectPath);
    const trusted = await this.list();
    const next = trusted.filter((project) => project.path !== normalized);
    next.push({ path: normalized, trustedAt: new Date().toISOString() });
    await writeJson(trustedProjectsPath(), next);
  }

  async revoke(projectPath: string): Promise<void> {
    const normalized = this.normalize(projectPath);
    const trusted = await this.list();
    await writeJson(
      trustedProjectsPath(),
      trusted.filter((project) => project.path !== normalized),
    );
  }

  async list(): Promise<TrustedProject[]> {
    return readJson<TrustedProject[]>(trustedProjectsPath(), []);
  }

  private normalize(projectPath: string): string {
    return path.resolve(projectPath);
  }
}
