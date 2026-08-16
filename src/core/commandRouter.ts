import { input, select } from "@inquirer/prompts";
import type { AppContext } from "./appContext.js";
import type { AegisSession } from "./session.js";
import { stripCodeFence } from "./patchManager.js";
import {
  renderCommandPalette,
  renderProviderKeyHelp,
} from "../tui/App.js";
import {
  printInfo,
  printSuccess,
  printTable,
  printWarning,
} from "../ui/printer.js";
import { ThinkingMascot } from "../ui/mascot.js";

export class CommandRouter {
  constructor(private context: AppContext) {}

  async route(
    session: AegisSession,
    rawCommand: string,
  ): Promise<"continue" | "exit"> {
    const [command, ...args] = rawCommand.trim().split(/\s+/);

    switch (command) {
      case "/help":
      case "/":
        console.log(renderCommandPalette());
        return "continue";
      case "/model":
        await this.chooseModel(session);
        return "continue";
      case "/provider":
        await this.chooseProvider(session);
        return "continue";
      case "/providers":
        printTable((await this.context.providerManager.list()).map((provider) => this.context.providerManager.publicView(provider)));
        return "continue";
      case "/models":
        printTable((await this.context.modelManager.list()).filter((model) => model.active));
        return "continue";
      case "/status":
        session.printStatus();
        return "continue";
      case "/trust":
        await this.handleTrust(session);
        return "continue";
      case "/review":
        await session.ask(
          "Review this project. Focus on bugs, risks, architecture, and missing tests.",
        );
        return "continue";
      case "/analyze":
        await session.ask(
          "Analyze this project and identify the most important files and improvement opportunities.",
        );
        return "continue";
      case "/edit":
        await this.editFile(session);
        return "continue";
      case "/diff":
        session.showPendingDiff();
        return "continue";
      case "/apply":
        await session.applyPendingPatch();
        return "continue";
      case "/reject":
        session.rejectPendingPatch();
        return "continue";
      case "/config":
        console.log(JSON.stringify(session.state.config, null, 2));
        return "continue";
      case "/key":
        await this.showProviderKeyHelp(session);
        return "continue";
      case "/doctor":
        await this.doctor();
        return "continue";
      case "/history":
        printTable(
          session.state.messages.map((message, index) => ({
            index,
            role: message.role,
            content: message.content.slice(0, 100),
          })),
        );
        return "continue";
      case "/clear":
        session.state.messages = [];
        printSuccess("Session history cleared.");
        return "continue";
      case "/search":
        await this.webSearch(args.join(" "));
        return "continue";
      case "/run":
        await this.runCommand(args.join(" "));
        return "continue";
      case "/exit":
        return "exit";
      default:
        printWarning(`Unknown command: ${command}. Run /help.`);
        return "continue";
    }
  }

  private async chooseModel(session: AegisSession): Promise<void> {
    const models = (await this.context.modelManager.list()).filter(
      (model) => model.active,
    );
    session.state.model = await select({
      message: "Choose model",
      choices: models.map((model) => ({
        name: `${model.id} (${model.providerId})`,
        value: model.id,
      })),
    });
    printSuccess(`Model set to ${session.state.model}`);
  }

  private async chooseProvider(session: AegisSession): Promise<void> {
    const providers = (await this.context.providerManager.list()).filter(
      (provider) => provider.active,
    );
    session.state.provider = await select({
      message: "Choose provider",
      choices: providers.map((provider) => ({
        name: `${provider.id} (${provider.kind})`,
        value: provider.id,
      })),
    });
    printSuccess(`Provider set to ${session.state.provider}`);
  }

  private async handleTrust(session: AegisSession): Promise<void> {
    printInfo(`Trusted directory: ${session.state.cwd}`);
    const action = await select({
      message: "Trust options",
      choices: [
        { name: "Keep trusted", value: "keep" },
        { name: "Revoke trust for this directory", value: "revoke" },
      ],
    });
    if (action === "revoke") {
      await this.context.trustManager.revoke(session.state.cwd);
      printWarning(
        "Trust revoked. Exit and run aegis again to re-enter safely.",
      );
    }
  }

  private async showProviderKeyHelp(session: AegisSession): Promise<void> {
    const provider = await this.context.providerManager.get(
      session.state.provider,
    );
    if (!provider.apiKeyEnv) {
      printInfo(`${provider.id} does not need an API key.`);
      return;
    }
    console.log(renderProviderKeyHelp(provider.id, provider.apiKeyEnv));
  }

  private async editFile(session: AegisSession): Promise<void> {
    const relativePath = await input({
      message: "File to edit, relative to project",
    });
    const instruction = await input({ message: "What should change?" });
    const current = await this.context.projectFileReader.readProjectFile(
      session.state.cwd,
      relativePath,
      session.state.config.maxFileBytes,
    );

    const thinking = new ThinkingMascot(
      "Aegi prepares the edit",
      current.relativePath,
    );
    thinking.start();

    let response;
    try {
      response = await this.context.aiClient.complete({
        model: session.state.model,
        provider: session.state.provider,
        system: session.systemPrompt(),
        messages: [
          {
            role: "user",
            content: [
              `Rewrite the full file ${current.relativePath}.`,
              "Return only the complete new file content in one code block.",
              "Do not include explanations outside the code block.",
              "",
              `Instruction: ${instruction}`,
              "",
              current.content,
            ].join("\n"),
          },
        ],
        stream: false,
      });
    } catch (error) {
      thinking.stop();
      throw error;
    }

    thinking.stop();

    const patch = await this.context.patchManager.createReplacement({
      root: session.state.cwd,
      relativePath: current.relativePath,
      nextContent: stripCodeFence(response.content),
      maxFileBytes: session.state.config.maxFileBytes,
    });

    session.state.pendingPatch = patch;
    session.showPendingDiff();
    printInfo("Run /apply to write this change or /reject to discard it.");
  }

  private async doctor(): Promise<void> {
    for (const provider of await this.context.providerManager.list()) {
      if (!provider.active) continue;
      const driver = this.context.providerManager.getDriver(provider);
      try {
        await driver.test?.(provider);
        printSuccess(`${provider.id}: reachable`);
      } catch (error) {
        printWarning(`${provider.id}: ${(error as Error).message}`);
      }
    }
  }

  private async webSearch(query: string): Promise<void> {
    const q = query || (await input({ message: "Search for:" }));
    const result = await this.context.toolRegistry.execute("webSearch", { query: q });
    console.log(result.output);
  }

  private async runCommand(cmd: string): Promise<void> {
    const command = cmd || (await input({ message: "Command to run:" }));
    const result = await this.context.toolRegistry.execute("bash", { command });
    if (result.output) console.log(result.output);
  }
}
