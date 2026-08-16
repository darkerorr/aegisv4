import { confirm, input } from "@inquirer/prompts";

const destructivePatterns = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[fsq]/i,
  /\brmdir\b/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  /\bRemove-Item\b.*\b-Recurse\b/i,
  /\bdd\s+if=/i,
];

const sensitivePatterns = [
  /\bcurl\b.*\|\s*(sh|bash|pwsh|powershell)/i,
  /\bwget\b.*\|\s*(sh|bash|pwsh|powershell)/i,
  /\bnpm\s+i\s+-g\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\bnetsh\b/i,
  /\biptables\b/i,
];

export class SafetyManager {
  classifyCommand(command: string): "safe" | "sensitive" | "destructive" {
    if (destructivePatterns.some((pattern) => pattern.test(command))) {
      return "destructive";
    }
    if (sensitivePatterns.some((pattern) => pattern.test(command))) {
      return "sensitive";
    }
    return "safe";
  }

  async confirmCommand(command: string): Promise<boolean> {
    const risk = this.classifyCommand(command);
    console.log(`Command proposed:\n${command}`);

    if (risk === "destructive") {
      const answer = await input({
        message: "Destructive command detected. Type EXECUTE to confirm:",
      });
      return answer === "EXECUTE";
    }

    return confirm({
      message:
        risk === "sensitive"
          ? "Sensitive command detected. Execute it?"
          : "Execute this command?",
      default: false,
    });
  }
}
