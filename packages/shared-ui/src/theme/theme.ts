import { aegisColors, aegisGradients } from "./colors.js";

export type AegisThemeMode = "dark" | "light";
export const aegisTheme = { colors: aegisColors, gradients: aegisGradients, modes: ["dark", "light"] as const };
export function getAegisTheme(mode: AegisThemeMode = "dark") { return { mode, ...aegisTheme }; }
