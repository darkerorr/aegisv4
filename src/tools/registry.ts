import type { ToolDefinition } from "./Tool.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ success: boolean; output: string; data?: unknown }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: `Unknown tool: ${name}` };
    }
    try {
      const result = await tool.execute(args);
      return result;
    } catch (error) {
      return {
        success: false,
        output: `Tool ${name} error: ${(error as Error).message}`,
      };
    }
  }

  toolsDescription(): string {
    return [...this.tools.values()]
      .map((tool) => {
        const params = tool.parameters
          .map(
            (p: { name: string; type: string; required?: boolean; description: string }) =>
              `  - ${p.name} (${p.type})${p.required ? " [required]" : ""}: ${p.description}`,
          )
          .join("\n");
        return `## ${tool.name}\n${tool.description}\nParameters:\n${params}`;
      })
      .join("\n\n");
  }
}
