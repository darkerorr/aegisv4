import path from "node:path";

export function assertNonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

export function resolveUserPath(
  inputPath: string,
  cwd = process.cwd(),
): string {
  const expanded = inputPath.startsWith("~")
    ? path.join(
        process.env.USERPROFILE || process.env.HOME || cwd,
        inputPath.slice(1),
      )
    : inputPath;
  return path.resolve(cwd, expanded);
}

export function sanitizeFileName(name: string): string {
  return (
    name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "aegis"
  );
}

export function maskSecret(value: string | undefined): string {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}
