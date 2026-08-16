export const privacyLabels = {
  local: "Local only",
  "remote-provider": "Remote provider",
  synced: "Synced",
  private: "Private session",
} as const;

export const aegisBrand = {
  accent: "#168cff",
  secondary: "#ff7800",
  surface: "#0b1220",
} as const;

export * from "./theme/colors.js";
export * from "./theme/theme.js";
export * from "./components.js";
