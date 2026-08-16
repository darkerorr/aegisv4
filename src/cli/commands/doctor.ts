import { access, writeFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import {
  printError,
  printInfo,
  printSuccess,
  printWarning,
} from "../../ui/printer.js";
import { ensureDir, exists } from "../../utils/fs.js";
import {
  aegisHome,
  configPath,
  historyDir,
  logsDir,
} from "../../utils/paths.js";

function checkCommand(
  command: string,
  args: string[] = ["--version"],
): string | undefined {
  try {
    const cmdPath = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    const output =
      process.platform === "win32"
        ? execFileSync(
            cmdPath,
            ["/d", "/s", "/c", [command, ...args].join(" ")],
            {
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
              windowsHide: true,
            },
          )
        : execFileSync(command, args, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            windowsHide: true,
          });
    return output.trim();
  } catch {
    return undefined;
  }
}

function checkAegisCommand(): string | undefined {
  try {
    const cmdPath = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    const output =
      process.platform === "win32"
        ? execFileSync(cmdPath, ["/d", "/s", "/c", "where aegis"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            windowsHide: true,
          })
        : execFileSync("which", ["aegis"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            windowsHide: true,
          });
    return output.trim();
  } catch {
    return undefined;
  }
}

async function isWritable(dir: string): Promise<boolean> {
  try {
    await ensureDir(dir);
    const probe = path.join(dir, `.aegis-write-test-${Date.now()}`);
    await writeFile(probe, "ok", "utf8");
    await rm(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function canReadCurrentDirectory(): Promise<boolean> {
  try {
    await access(process.cwd(), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function registerDoctorCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("doctor")
    .description("Check Aegis installation, config, providers, and permissions")
    .action(async () => {
      printInfo("Aegis Doctor");

      const aegisCommand = checkAegisCommand();
      if (aegisCommand) printSuccess("Aegis command available");
      else
        printWarning(
          "Aegis command not found in PATH. Run install.ps1 or npm link.",
        );

      const nodeVersion = checkCommand("node");
      if (nodeVersion) printSuccess(`Node.js detected: ${nodeVersion}`);
      else printError("Node.js not detected");

      const npmVersion = checkCommand("npm");
      if (npmVersion) printSuccess(`npm detected: ${npmVersion}`);
      else printError("npm not detected");

      const gitVersion = checkCommand("git");
      if (gitVersion) printSuccess(`Git detected: ${gitVersion}`);
      else printWarning("Git not detected");

      if (await exists(configPath())) printSuccess("Global config found");
      else printWarning("Global config missing. Run aegis setup.");

      if (await isWritable(aegisHome())) printSuccess("Aegis home writable");
      else printError(`Aegis home is not writable: ${aegisHome()}`);

      if (await isWritable(historyDir()))
        printSuccess("History directory writable");
      else printError(`History directory is not writable: ${historyDir()}`);

      if (await isWritable(logsDir())) printSuccess("Logs directory writable");
      else printError(`Logs directory is not writable: ${logsDir()}`);

      if (await canReadCurrentDirectory())
        printSuccess("Current directory accessible");
      else printError("Current directory is not readable");

      const config = await context.configManager.get({
        includeProjectConfig: false,
      });
      printSuccess(`Default provider: ${config.defaultProvider}`);
      printSuccess(`Default model: ${config.defaultModel}`);
      if (config.safeMode) printSuccess("Safe mode enabled");
      else printWarning("Safe mode disabled");

      const provider = await context.providerManager
        .get(config.defaultProvider)
        .catch(() => undefined);
      if (!provider) {
        printError(
          `Default provider not configured: ${config.defaultProvider}`,
        );
        return;
      }

      const needsKey = Boolean(provider.apiKeyEnv || provider.apiKey);
      if (
        needsKey &&
        provider.apiKeyEnv &&
        !process.env[provider.apiKeyEnv] &&
        !provider.apiKey
      ) {
        printWarning(`API key missing. Set ${provider.apiKeyEnv}.`);
      } else if (needsKey) {
        printSuccess("API key configured");
      }

      try {
        await context.providerManager.getDriver(provider).test?.(provider);
        printSuccess(`${provider.name} reachable at ${provider.baseUrl}`);
      } catch (error) {
        const label =
          provider.kind === "ollama"
            ? `Ollama not reachable at ${provider.baseUrl}`
            : provider.kind === "lmstudio"
              ? `LM Studio not reachable at ${provider.baseUrl}`
              : `${provider.name} not reachable at ${provider.baseUrl}`;
        printWarning(`${label}: ${(error as Error).message}`);
      }
    });
}
