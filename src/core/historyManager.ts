import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessage, Conversation } from "../types/index.js";
import { ensureDir, exists } from "../utils/fs.js";
import { historyDir } from "../utils/paths.js";
import { sanitizeFileName } from "../utils/validation.js";

export class HistoryManager {
  async saveConversation(input: {
    title: string;
    providerId: string;
    model: string;
    messages: ChatMessage[];
    id?: string;
  }): Promise<Conversation> {
    await ensureDir(historyDir());
    const now = new Date().toISOString();
    const id =
      input.id || `${Date.now()}-${sanitizeFileName(input.title).slice(0, 40)}`;
    const filePath = this.conversationPath(id);
    const previous = await this.load(id).catch(() => undefined);
    const conversation: Conversation = {
      id,
      title: input.title,
      providerId: input.providerId,
      model: input.model,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      messages: input.messages,
    };

    await writeFile(
      filePath,
      `${JSON.stringify(conversation, null, 2)}\n`,
      "utf8",
    );
    return conversation;
  }

  async list(): Promise<Conversation[]> {
    await ensureDir(historyDir());
    const entries = await readdir(historyDir());
    const conversations = await Promise.all(
      entries
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => {
          const content = await readFile(path.join(historyDir(), name), "utf8");
          return JSON.parse(content) as Conversation;
        }),
    );

    return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<Conversation> {
    const normalized = id.endsWith(".json") ? id.slice(0, -5) : id;
    const filePath = this.conversationPath(normalized);
    if (!(await exists(filePath))) {
      throw new Error(`Conversation not found: ${id}`);
    }
    return JSON.parse(await readFile(filePath, "utf8")) as Conversation;
  }

  exportPath(id: string, format: "json" | "md"): string {
    const ext = format === "json" ? "json" : "md";
    return path.join(historyDir(), `${sanitizeFileName(id)}.${ext}`);
  }

  private conversationPath(id: string): string {
    return path.join(historyDir(), `${sanitizeFileName(id)}.json`);
  }
}
