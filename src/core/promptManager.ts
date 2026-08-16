import type { PromptTemplate } from "../types/index.js";
import { readJson, writeJson } from "../utils/fs.js";
import { promptsPath } from "../utils/paths.js";

const defaultPrompts: PromptTemplate[] = [
  {
    id: "developer",
    name: "Developer",
    description: "Practical software engineering assistant.",
    tags: ["code", "dev"],
    content:
      "You are a senior software engineer. Give robust, maintainable, tested solutions.",
  },
  {
    id: "defensive-cyber",
    name: "Defensive Cybersecurity",
    description: "Security review and hardening, defensive use only.",
    tags: ["security", "defensive"],
    content:
      "You are a defensive cybersecurity expert. Focus on risk reduction, detection, hardening, and safe remediation.",
  },
  {
    id: "summarizer",
    name: "Summarizer",
    description: "Concise summaries with key actions.",
    tags: ["writing"],
    content:
      "Summarize clearly. Preserve decisions, risks, and action items. Avoid unnecessary detail.",
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Technical documentation writer.",
    tags: ["docs"],
    content:
      "Write clear technical documentation with examples, assumptions, and operational notes.",
  },
  {
    id: "bugfix",
    name: "Bug Fix",
    description: "Debugging and correction assistant.",
    tags: ["code", "debug"],
    content:
      "Identify the likely bug, explain the cause, propose the minimal fix, and mention tests.",
  },
  {
    id: "simple-explain",
    name: "Simple Explanation",
    description: "Explain complex topics in simple terms.",
    tags: ["student"],
    content:
      "Explain simply and progressively. Use examples and avoid jargon unless it is defined.",
  },
];

export class PromptManager {
  async init(): Promise<PromptTemplate[]> {
    const prompts = await this.list();
    await this.save(prompts);
    return prompts;
  }

  async list(): Promise<PromptTemplate[]> {
    const persisted = await readJson<PromptTemplate[]>(promptsPath(), []);
    const merged = [...defaultPrompts];

    for (const prompt of persisted) {
      const index = merged.findIndex((item) => item.id === prompt.id);
      if (index >= 0) {
        merged[index] = { ...merged[index], ...prompt };
      } else {
        merged.push(prompt);
      }
    }

    return merged;
  }

  async save(prompts: PromptTemplate[]): Promise<void> {
    await writeJson(promptsPath(), prompts);
  }

  async add(prompt: PromptTemplate): Promise<void> {
    const prompts = await this.list();
    await this.save([
      ...prompts.filter((item) => item.id !== prompt.id),
      prompt,
    ]);
  }

  async get(id: string): Promise<PromptTemplate> {
    const prompt = (await this.list()).find(
      (item) => item.id === id || item.name === id,
    );
    if (!prompt) {
      throw new Error(`Prompt not found: ${id}`);
    }
    return prompt;
  }
}
