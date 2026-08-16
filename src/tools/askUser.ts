import { input } from "@inquirer/prompts";
import type { ToolDefinition, ToolResult } from "./Tool.js";

let questionCounter = 0;

export function createAskUserTool(): ToolDefinition {
  return {
    name: "askUser",
    description:
      "Ask the user a question and get their response. Use this when you need clarification, confirmation, or additional information.",
    parameters: [
      {
        name: "question",
        type: "string",
        description: "The question to ask the user",
        required: true,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const question = String(args.question || "");
      if (!question) {
        return { success: false, output: "Missing required parameter: question" };
      }
      try {
        questionCounter++;
        const answer = await input({ message: question });
        return {
          success: true,
          data: answer,
          output: `User response: ${answer}`,
        };
      } catch (error) {
        return { success: false, output: `Failed to get user input: ${(error as Error).message}` };
      }
    },
  };
}
