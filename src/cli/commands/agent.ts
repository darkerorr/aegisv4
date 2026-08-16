import { exec } from "node:child_process";
import { promisify } from "node:util";
import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printInfo, printWarning } from "../../ui/printer.js";

const execAsync = promisify(exec);

function extractShellBlocks(text: string): string[] {
  const matches = text.matchAll(
    /```(?:bash|sh|powershell|pwsh|shell)?\n([\s\S]*?)```/gi,
  );
  return [...matches]
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];
}

export function registerAgentCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("agent")
    .description("Experimental supervised agent mode")
    .option("--model <model>", "Model id")
    .option("--provider <provider>", "Provider id")
    .action(async (options) => {
      const goal = await input({ message: "Agent goal" });
      const response = await context.aiClient.complete({
        model: options.model,
        provider: options.provider,
        messages: [
          {
            role: "user",
            content: [
              "Create a safe step-by-step plan for this task.",
              "If commands are needed, put each command in a separate fenced shell block.",
              "Do not include destructive commands unless strictly necessary.",
              "",
              goal,
            ].join("\n"),
          },
        ],
      });

      console.log(response.content);
      const commands = extractShellBlocks(response.content);
      if (!commands.length) {
        printInfo("No executable command was proposed.");
        return;
      }

      for (const command of commands) {
        const action = await select({
          message: `Handle command: ${command}`,
          choices: [
            { name: "Skip", value: "skip" },
            { name: "Ask confirmation and run", value: "run" },
            { name: "Stop agent", value: "stop" },
          ],
        });

        if (action === "stop") break;
        if (action === "skip") continue;

        if (!(await context.safetyManager.confirmCommand(command))) {
          printWarning("Command skipped.");
          continue;
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: process.cwd(),
        });
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      }
    });
}
