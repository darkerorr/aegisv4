import type { LogLevel } from "../types/index.js";
import { maskSecret } from "../utils/validation.js";

const order: LogLevel[] = ["silent", "error", "warn", "info", "debug"];

export class Logger {
  constructor(private level: LogLevel = "info") {}

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string): void {
    if (this.canLog("error")) console.error(this.redact(message));
  }

  warn(message: string): void {
    if (this.canLog("warn")) console.warn(this.redact(message));
  }

  info(message: string): void {
    if (this.canLog("info")) console.log(this.redact(message));
  }

  debug(message: string): void {
    if (this.canLog("debug")) console.debug(this.redact(message));
  }

  private canLog(level: LogLevel): boolean {
    return order.indexOf(this.level) >= order.indexOf(level);
  }

  private redact(message: string): string {
    const secrets = Object.entries(process.env)
      .filter(
        ([key]) =>
          key.includes("KEY") ||
          key.includes("TOKEN") ||
          key.includes("SECRET"),
      )
      .map(([, value]) => value)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 3,
      );

    return secrets.reduce(
      (text, secret) => text.replaceAll(secret, maskSecret(secret)),
      message,
    );
  }
}
