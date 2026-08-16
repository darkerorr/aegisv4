import type { AegisIconName } from "@/components/aegis/aegis-icons";

/* ============================================================================
   WORK AGENT MODES — Plan / Auto / Review / Debug.
   Each mode carries instructions injected into the agent request, so the same
   provider/model behaves differently without any hard-wired backend change.
   ========================================================================== */

export type WorkAgentMode = "auto" | "plan" | "review" | "debug";

export interface WorkModeMeta {
  id: WorkAgentMode;
  label: string;
  icon: AegisIconName;
  hint: string;
  instructions: string;
}

export const WORK_MODES: WorkModeMeta[] = [
  {
    id: "auto",
    label: "Auto",
    icon: "agent",
    hint: "Travail autonome",
    instructions:
      "Travaille de manière autonome : analyse le workspace, modifie les fichiers nécessaires, lance les tests, le typecheck, le lint et le build, corrige les erreurs puis résume exactement ce qui a changé. Continue jusqu'à un résultat vérifié, sauf si une action dangereuse exige une approbation.",
  },
  {
    id: "plan",
    label: "Plan",
    icon: "plan",
    hint: "Planifie avant d'agir",
    instructions:
      "Commence par produire un plan structuré sans rien modifier : OBJECTIF, FICHIERS, CHANGEMENTS, RISQUES, PLAN DE TEST. Présente ce plan et attends l'approbation de l'utilisateur avant d'exécuter la moindre modification.",
  },
  {
    id: "review",
    label: "Review",
    icon: "search",
    hint: "Revue de code",
    instructions:
      "Fais une revue de code du workspace : bugs, sécurité, performance, architecture, duplication, types, erreurs potentielles et tests manquants. Fournis les corrections proposées sans rien modifier sans approbation.",
  },
  {
    id: "debug",
    label: "Debug",
    icon: "debug",
    hint: "Diagnostic et correction",
    instructions:
      "Diagnostique l'erreur signalée : récupère les logs, les stack traces, les fichiers concernés et les dernières commandes. Formule des hypothèses, propose puis applique les corrections, et relance les validations jusqu'à résolution.",
  },
];

export function workModeById(id: WorkAgentMode): WorkModeMeta {
  return WORK_MODES.find((mode) => mode.id === id) ?? WORK_MODES[0];
}

export const DEFAULT_WORK_MODE: WorkAgentMode = "auto";
