export interface SlashCommandInfo {
  name: string;
  description: string;
}

export const slashCommands: SlashCommandInfo[] = [
  { name: "/help", description: "Show this command menu" },
  { name: "/model", description: "Change the current model" },
  { name: "/provider", description: "Change the current provider" },
  { name: "/providers", description: "List and inspect configured providers" },
  { name: "/models", description: "List discovered models" },
  { name: "/status", description: "Show session status" },
  { name: "/trust", description: "Show or revoke project trust" },
  { name: "/review", description: "Review the project for bugs, risks, and tests" },
  { name: "/analyze", description: "Analyze project structure and opportunities" },
  { name: "/edit", description: "Propose an edit to a project file" },
  { name: "/diff", description: "Show the pending diff" },
  { name: "/apply", description: "Apply the pending diff after confirmation" },
  { name: "/reject", description: "Reject the pending diff" },
  { name: "/config", description: "Show effective configuration" },
  { name: "/key", description: "Show where to put the current provider API key" },
  { name: "/doctor", description: "Check active providers" },
  { name: "/history", description: "Show session messages" },
  { name: "/clear", description: "Clear session messages" },
  { name: "/search", description: "Search the web" },
  { name: "/run", description: "Run a shell command (with safety checks)" },
  { name: "/exit", description: "Quit Aegis IA" },
];
