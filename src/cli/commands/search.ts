import { input } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";

export function registerSearchCommand(program: Command, context: AppContext): void {
  program
    .command("search")
    .description("Search the web for information")
    .argument("[query]", "What to search for")
    .action(async (query: string | undefined) => {
      const q = query || (await input({ message: "Search for:" }));
      const result = await context.toolRegistry.execute("webSearch", { query: q });
      console.log(result.output);
    });
}
