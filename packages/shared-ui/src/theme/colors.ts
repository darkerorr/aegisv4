export const aegisColors = {
  orange: { DEFAULT: "#f87808", light: "#ffad24", dark: "#c94b00" },
  blue: { DEFAULT: "#0879ed", light: "#43c7ff", dark: "#063fa8" },
  white: "#edf4ff",
  background: "#05070d",
  surface: "#0b1220",
  surfaceElevated: "#111c30",
  border: "rgba(237, 244, 255, 0.12)",
  text: "#edf4ff",
  textMuted: "#8fa2bf",
  success: "#36d58a",
  warning: "#f87808",
  error: "#ef5350",
  offline: "#65738a",
} as const;

export const aegisGradients = {
  primary: "linear-gradient(135deg, #0879ed 0%, #f87808 100%)",
  blue: "linear-gradient(135deg, #43c7ff 0%, #063fa8 100%)",
  orange: "linear-gradient(135deg, #ffad24 0%, #c94b00 100%)",
  glow: "radial-gradient(circle, rgba(8, 121, 237, .22), rgba(248, 120, 8, .08), transparent 70%)",
} as const;
