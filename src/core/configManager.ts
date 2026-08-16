import { readFile } from "node:fs/promises";
import type { AegisConfig } from "../types/index.js";
import { readJson, writeJson, exists } from "../utils/fs.js";
import {
  aegisRcPath,
  configPath,
  historyDir,
  logsDir,
  trustedProjectsPath,
} from "../utils/paths.js";

const defaultConfig: AegisConfig = {
  defaultProvider: "ollama",
  defaultModel: "qwen2.5-coder",
  theme: "aegis-dark",
  conversationsDir: historyDir(),
  historyDir: historyDir(),
  logsDir: logsDir(),
  trustedProjectsFile: trustedProjectsPath(),
  streaming: true,
  stream: true,
  logLevel: "info",
  maxFileBytes: 300 * 1024,
  maxFileSizeKb: 300,
  safeMode: true,
  allowProjectReadAfterTrust: true,
  noColor: false,
};

export class ConfigManager {
  async init(): Promise<AegisConfig> {
    const current = await this.get({ includeProjectConfig: false });
    await this.save(current);
    return current;
  }

  async get(
    options: { includeProjectConfig?: boolean } = {},
  ): Promise<AegisConfig> {
    const persisted = await readJson<Partial<AegisConfig>>(configPath(), {});
    const rc =
      options.includeProjectConfig === false ? {} : await this.readAegisRc();
    return {
      ...defaultConfig,
      ...persisted,
      ...rc,
      streaming:
        rc.streaming ??
        persisted.streaming ??
        persisted.stream ??
        defaultConfig.streaming,
      stream:
        rc.stream ??
        persisted.stream ??
        persisted.streaming ??
        defaultConfig.stream,
      maxFileBytes:
        rc.maxFileBytes ??
        persisted.maxFileBytes ??
        (rc.maxFileSizeKb ??
          persisted.maxFileSizeKb ??
          defaultConfig.maxFileSizeKb) * 1024,
      maxFileSizeKb:
        rc.maxFileSizeKb ??
        persisted.maxFileSizeKb ??
        Math.round(
          (rc.maxFileBytes ??
            persisted.maxFileBytes ??
            defaultConfig.maxFileBytes) / 1024,
        ),
      historyDir:
        rc.historyDir ??
        persisted.historyDir ??
        persisted.conversationsDir ??
        historyDir(),
      conversationsDir:
        rc.conversationsDir ??
        persisted.conversationsDir ??
        persisted.historyDir ??
        historyDir(),
    };
  }

  async save(config: AegisConfig): Promise<void> {
    await writeJson(configPath(), config);
  }

  async set<K extends keyof AegisConfig>(
    key: K,
    value: AegisConfig[K],
  ): Promise<AegisConfig> {
    const config = await this.get({ includeProjectConfig: false });
    const next = { ...config, [key]: value };
    await this.save(next);
    return next;
  }

  getDefaults(): AegisConfig {
    return { ...defaultConfig };
  }

  private async readAegisRc(): Promise<Partial<AegisConfig>> {
    const localPath = aegisRcPath();
    if (!(await exists(localPath))) {
      return {};
    }

    const raw = await readFile(localPath, "utf8");
    return JSON.parse(raw) as Partial<AegisConfig>;
  }
}
