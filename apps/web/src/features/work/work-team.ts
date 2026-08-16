import type { WorkAgentRole } from "@aegis/api-client";

/* ============================================================================
   WORK MODE TEAM — 5 specialized agents (auto or custom).
   Mirrors the role catalog of the Local Agent (apps/local-agent/src/team.ts).
   ========================================================================== */

export type TeamSelectionMode = "auto" | "custom";

export interface WorkTeamRoleMeta {
  role: WorkAgentRole;
  name: string;
  description: string;
  color: string;
}

export const WORK_TEAM_ROLES: WorkTeamRoleMeta[] = [
  { role: "dev", name: "Développeur", description: "Architecture, code et structure", color: "#4c8dff" },
  { role: "design", name: "Designer UI/UX", description: "Interface, styles et expérience", color: "#ff6ad5" },
  { role: "marketing", name: "Marketeur", description: "Stratégie, copywriting, positionnement", color: "#ffb020" },
  { role: "content", name: "Rédacteur", description: "Documentation et contenus", color: "#3ecf8e" },
  { role: "seo", name: "Spécialiste SEO", description: "Référencement et visibilité", color: "#8b7bff" },
  { role: "qa", name: "QA / Tests", description: "Tests, validation et qualité", color: "#00c2c7" },
  { role: "security", name: "Expert Sécurité", description: "Audit et durcissement", color: "#ff5c5c" },
  { role: "data", name: "Data / Modèles", description: "Données, schémas et API", color: "#7a8bff" },
];

export const DEFAULT_TEAM_ROLES: WorkAgentRole[] = ["dev", "design", "marketing", "content", "qa"];

export function workTeamRoleMeta(role: WorkAgentRole): WorkTeamRoleMeta {
  return WORK_TEAM_ROLES.find((entry) => entry.role === role) ?? WORK_TEAM_ROLES[0];
}

export function teamRequest(
  mode: TeamSelectionMode,
  roles: WorkAgentRole[],
): { enabled: boolean; mode: "auto" | "custom"; roles: WorkAgentRole[] } {
  if (mode === "custom") {
    const unique = roles.length === 0 ? DEFAULT_TEAM_ROLES : (["dev" as WorkAgentRole, ...roles]).filter((role, index, all) => all.indexOf(role) === index).slice(0, 5);
    return { enabled: true, mode, roles: unique };
  }
  return { enabled: true, mode, roles: [] };
}