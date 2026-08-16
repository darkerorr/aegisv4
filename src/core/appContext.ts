import { AIClient } from "./aiClient.js";
import { ConfigManager } from "./configManager.js";
import { ContextBuilder } from "./contextBuilder.js";
import { FileManager } from "./fileManager.js";
import { HistoryManager } from "./historyManager.js";
import { ModelManager } from "./modelManager.js";
import { PatchManager } from "./patchManager.js";
import { PromptManager } from "./promptManager.js";
import { ProjectFileReader } from "./fileReader.js";
import { ProjectScanner } from "./projectScanner.js";
import { ProviderManager } from "./providerManager.js";
import { SafetyManager } from "./safetyManager.js";
import { TrustManager } from "../config/trustManager.js";
import { ToolRegistry } from "../tools/registry.js";
import { createReadTool } from "../tools/read.js";
import { createWriteTool } from "../tools/write.js";
import { createEditTool } from "../tools/edit.js";
import { createGlobTool } from "../tools/glob.js";
import { createGrepTool } from "../tools/grep.js";
import { createBashTool } from "../tools/bash.js";
import { createWebSearchTool } from "../tools/webSearch.js";
import { createAskUserTool } from "../tools/askUser.js";
import { printInfo, printSuccess, printWarning } from "../ui/printer.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PendingPatch } from "./patchManager.js";

export interface AppContext {
  aiClient: AIClient;
  configManager: ConfigManager;
  fileManager: FileManager;
  historyManager: HistoryManager;
  modelManager: ModelManager;
  contextBuilder: ContextBuilder;
  patchManager: PatchManager;
  promptManager: PromptManager;
  projectFileReader: ProjectFileReader;
  projectScanner: ProjectScanner;
  providerManager: ProviderManager;
  safetyManager: SafetyManager;
  trustManager: TrustManager;
  toolRegistry: ToolRegistry;
  sessionCwd: string;
  setSessionCwd(cwd: string): void;
}

function getIgnoredDirs(): string[] {
  return [
    ".git", "node_modules", "dist", "build", "coverage",
    ".next", ".nuxt", ".turbo", ".pnpm-store", ".aegis",
  ];
}

export function createAppContext(): AppContext {
  const configManager = new ConfigManager();
  const providerManager = new ProviderManager();
  const modelManager = new ModelManager();
  const safetyManager = new SafetyManager();
  const toolRegistry = new ToolRegistry();
  let cwd = process.cwd();

  const applyToolWrite = async (relativePath: string, after: string): Promise<boolean> => {
    const filePath = path.resolve(cwd, relativePath);
    const resolved = path.relative(cwd, filePath);
    if (resolved.startsWith("..") || path.isAbsolute(resolved)) return false;
    const before = await readFile(filePath, "utf8").catch(() => "");
    const patch: PendingPatch = { filePath, relativePath: resolved, before, after };
    console.log(context.patchManager.showDiff(patch));
    return context.patchManager.apply(patch);
  };

  const context: AppContext = {
    aiClient: new AIClient(configManager, providerManager, modelManager),
    configManager,
    contextBuilder: new ContextBuilder(),
    fileManager: new FileManager(),
    historyManager: new HistoryManager(),
    modelManager,
    patchManager: new PatchManager(),
    promptManager: new PromptManager(),
    projectFileReader: new ProjectFileReader(),
    projectScanner: new ProjectScanner(),
    providerManager,
    safetyManager,
    trustManager: new TrustManager(),
    toolRegistry,
    sessionCwd: cwd,
    setSessionCwd(newCwd: string) {
      cwd = newCwd;
      context.sessionCwd = newCwd;
    },
  };

  toolRegistry.register(
    createReadTool(() => context.sessionCwd),
  );
  toolRegistry.register(
    createWriteTool(() => context.sessionCwd, applyToolWrite, (relativePath) => printSuccess(`Written: ${relativePath}`)),
  );
  toolRegistry.register(createEditTool(() => context.sessionCwd, applyToolWrite));
  toolRegistry.register(
    createGlobTool(() => context.sessionCwd, getIgnoredDirs),
  );
  toolRegistry.register(
    createGrepTool(
      () => context.sessionCwd,
      getIgnoredDirs,
      () => 300 * 1024,
    ),
  );
  toolRegistry.register(
    createBashTool(() => context.sessionCwd, async (command: string) => safetyManager.confirmCommand(command)),
  );
  toolRegistry.register(createWebSearchTool());
  toolRegistry.register(createAskUserTool());

  return context;
}
