import boxen from "boxen";
import pc from "picocolors";

export function printTitle(title: string, subtitle?: string): void {
  const lines = subtitle ? `${pc.bold(title)}\n${subtitle}` : pc.bold(title);
  console.log(
    boxen(lines, {
      padding: 1,
      borderStyle: "round",
      borderColor: "cyan",
    }),
  );
}

export function printInfo(message: string): void {
  console.log(pc.cyan(message));
}

export function printSuccess(message: string): void {
  console.log(pc.green(message));
}

export function printWarning(message: string): void {
  console.log(pc.yellow(message));
}

export function printError(message: string): void {
  console.error(pc.red(message));
}

export function printTable(rows: object[]): void {
  console.table(rows);
}
