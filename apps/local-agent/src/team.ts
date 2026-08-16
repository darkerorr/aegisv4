import type { ChatRequest, WorkAgentEvent, WorkAgentRequest, WorkAgentRole, WorkTeamConfig, WorkTeamMember } from "@aegis/types";
import { createProvider } from "@aegis/providers";
import { runAgent } from "./agent.js";
import type { AgentRuntime } from "./agent.js";

/** Specialized agents available to Work Mode teams. Each role carries a French
 * label, a brand color and purpose-built instructions injected into the member
 * request so the same provider/model behaves differently per discipline. */
export interface WorkRoleMeta {
  role: WorkAgentRole;
  name: string;
  description: string;
  color: string;
  instructions: string;
}

export const WORK_ROLES: WorkRoleMeta[] = [
  {
    role: "dev",
    name: "Développeur",
    description: "Architecture, code et structure du projet.",
    color: "#4c8dff",
    instructions:
      "Tu es l'architecte et le développeur principal de l'équipe. Analyse le workspace, structure le projet, écris un code propre, modulaire et commenté. Vérifie que tout compile et fonctionne avant de conclure. Corrige les erreurs, lance le lint/typecheck/build quand c'est pertinent et résume précisément ce que tu as créé ou modifié.",
  },
  {
    role: "design",
    name: "Designer UI/UX",
    description: "Interface, styles et expérience utilisateur.",
    color: "#ff6ad5",
    instructions:
      "Tu es le designer UI/UX de l'équipe. Crée ou améliore l'interface : styles CSS, composants, couleurs, typographie, espacements, responsive. Soigne l'esthétique et l'expérience utilisateur. Modifie les fichiers de styles et de composants. Décris les choix de design que tu as faits.",
  },
  {
    role: "marketing",
    name: "Marketeur",
    description: "Stratégie, copywriting et positionnement.",
    color: "#ffb020",
    instructions:
      "Tu es le stratège marketing de l'équipe. Produis les contenus marketing du projet : description produit, proposition de valeur, arguments de vente, slogans, landing page. Optimise la communication et le positionnement. Crée ou améliore les fichiers de contenu marketing (README, copy, pitch).",
  },
  {
    role: "content",
    name: "Rédacteur",
    description: "Documentation et contenus.",
    color: "#3ecf8e",
    instructions:
      "Tu es le rédacteur de l'équipe. Rédige une documentation complète et claire : README, guides d'installation, exemples d'utilisation, explications du code. Crée ou améliore les fichiers markdown et textes du projet. Relis et corrige les contenus existants.",
  },
  {
    role: "seo",
    name: "Spécialiste SEO",
    description: "Référencement, performance et accessibilité.",
    color: "#8b7bff",
    instructions:
      "Tu es le spécialiste SEO de l'équipe. Optimise le référencement et la visibilité : balises meta, titres, structure, performance, accessibilité. Améliore les fichiers HTML, la config et les textes pour un meilleur classement. Liste les optimisations appliquées.",
  },
  {
    role: "qa",
    name: "QA / Tests",
    description: "Tests, validation et qualité.",
    color: "#00c2c7",
    instructions:
      "Tu es le QA de l'équipe. Écris et exécute les tests, vérifie le typecheck et le lint, détecte les bugs et les cas limites. Corrige les problèmes trouvés. Assure-toi que le projet est robuste et validé avant de conclure. Résume les tests effectués.",
  },
  {
    role: "security",
    name: "Expert Sécurité",
    description: "Audit et durcissement de sécurité.",
    color: "#ff5c5c",
    instructions:
      "Tu es l'expert sécurité de l'équipe. Audite le projet : secrets exposés, injections, permissions, dépendances risquées, bonnes pratiques de sécurité. Corrige les vulnérabilités identifiées et documente les durcissements appliqués. Ne crée jamais de fichier contenant des secrets.",
  },
  {
    role: "data",
    name: "Data / Modèles",
    description: "Données, schémas et API.",
    color: "#7a8bff",
    instructions:
      "Tu es le spécialiste data de l'équipe. Conçois les modèles de données, schémas, migrations et endpoints API. Analyse et structure les données du projet. Crée ou modifie les fichiers de données et d'API avec des exemples clairs.",
  },
];

export const DEFAULT_TEAM_ROLES: WorkAgentRole[] = ["dev", "design", "marketing", "content", "qa"];

export function workRoleById(role: WorkAgentRole): WorkRoleMeta {
  return WORK_ROLES.find((entry) => entry.role === role) ?? WORK_ROLES[0];
}

function buildMember(role: WorkAgentRole): WorkTeamMember {
  const meta = workRoleById(role);
  return { id: `member-${role}`, role, name: meta.name, description: meta.description, color: meta.color };
}

/** Emit one synthetic orchestrator chat request and parse a JSON list of roles
 * out of it. Falls back to heuristics when the model is unreachable or returns
 * unusable output, so the team never blocks on the selection step. */
async function selectAutoRoles(request: WorkAgentRequest, runtime: AgentRuntime): Promise<WorkTeamMember[]> {
  const provider = createProvider(request.provider);
  const lastUserContent = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const catalog = WORK_ROLES.map((entry) => `- ${entry.role}: ${entry.description}`).join("\n");
  const selectionRequest: ChatRequest = {
    providerId: request.provider.id,
    model: request.model,
    privacyMode: "local",
    attachmentIds: [],
    toolMode: "manual",
    enabledTools: [],
    messages: [
      {
        role: "system",
        content:
          `You are the lead orchestrator. You pick up to 4 specialized agents (besides yourself, dev) to work on a user request. ` +
          `Available roles:\n${catalog}\n\n` +
          `Answer with STRICT JSON only, no markdown, in the exact shape: {"roles":["role1","role2",...]} — ` +
          `an array of role ids from the list above, between 1 and 4 items, most relevant to the request.`,
      },
      { role: "user", content: lastUserContent },
    ],
  };
  let chosen: WorkAgentRole[] = [];
  try {
    const response = await provider.chat(selectionRequest);
    const match = response.content.match(/\{[\s\S]*"roles"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { roles?: unknown };
      if (Array.isArray(parsed.roles)) {
        chosen = parsed.roles
          .map((value) => String(value).trim() as WorkAgentRole)
          .filter((role) => WORK_ROLES.some((entry) => entry.role === role));
      }
    }
  } catch {
    // heuristic fallback below
  }
  if (chosen.length === 0) {
    const haystack = lastUserContent.toLowerCase();
    const keywords: Array<{ role: WorkAgentRole; tokens: string[] }> = [
      { role: "marketing", tokens: ["marketing", "market", "landing", "pub", "slogan", "client", "vente", "promo", "cible"] },
      { role: "design", tokens: ["design", "ui", "ux", "interface", "style", "css", "thème", "theme", "violet", "couleur", "apparence"] },
      { role: "content", tokens: ["doc", "readme", "guide", "tutoriel", "manuel", "rédige", "contenu", "explication"] },
      { role: "seo", tokens: ["seo", "référencement", "meta", "classement", "google"] },
      { role: "qa", tokens: ["test", "qa", "qualité", "bug", "validation", "typecheck", "lint", "corrige les"] },
      { role: "security", tokens: ["sécurité", "security", "vulnérabil", "audit", "injection", "secret"] },
      { role: "data", tokens: ["data", "donnée", "schema", "bdd", "base de données", "api", "migration", "modèle"] },
    ];
    const ranked = keywords
      .map(({ role, tokens }) => ({ role, score: tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    chosen = ranked.slice(0, 4).map((entry) => entry.role);
  }
  const roles: WorkAgentRole[] = (["dev" as WorkAgentRole, ...chosen]).filter((role, index, all) => all.indexOf(role) === index).slice(0, 5);
  return roles.map(buildMember);
}

function resolveMembers(team: WorkTeamConfig, request: WorkAgentRequest, runtime: AgentRuntime): Promise<WorkTeamMember[]> {
  if (!team.enabled) return Promise.resolve([buildMember("dev")]);
  if (team.mode === "custom" && team.roles.length > 0) {
    const roles: WorkAgentRole[] = (["dev" as WorkAgentRole, ...team.roles]).filter((role, index, all) => all.indexOf(role) === index).slice(0, 5);
    return Promise.resolve(roles.map(buildMember));
  }
  return selectAutoRoles(request, runtime);
}

/** Run a Work Mode request as a team of up to 5 specialized agents. Members run
 * sequentially: each one sees the previous members' work (final message +
 * changed files) so the project is built coherently. Events are tagged with
 * memberId/memberName so the frontend can route them to the right panel. */
export async function runTeamAgent(request: WorkAgentRequest, runtime: AgentRuntime): Promise<void> {
  const team = request.team ?? { enabled: false, mode: "auto", roles: [] };
  const members = await resolveMembers(team, request, runtime);
  if (members.length === 1) {
    await runAgent(request, runtime);
    return;
  }
  await runtime.onEvent({ type: "agent.team.plan", members });
  let teamContext = "";

  for (const [memberIndex, member] of members.entries()) {
    if (runtime.getAborted?.()) return;
    await runtime.onEvent({ type: "agent.member.started", member });
    const memberDelta: string[] = [];
    const changedFiles: string[] = [];
    let memberReport = "";

    const taggedRuntime: AgentRuntime = {
      ...runtime,
      onEvent: (event: WorkAgentEvent) => {
        if (event.type === "agent.delta") memberDelta.push(event.delta);
        if (event.type === "agent.file.change" && !changedFiles.includes(event.relativePath)) changedFiles.push(event.relativePath);
        if (event.type === "agent.completed") memberReport = event.message;
        const tagged = { ...event, memberId: member.id, memberName: member.name } as WorkAgentEvent;
        return runtime.onEvent(tagged);
      },
    };

    const meta = workRoleById(member.role);
    const memberInstructions = [
      meta.instructions,
      teamContext ? `\n\n=== Travail déjà réalisé par l'équipe ===\n${teamContext}` : "",
      `\n\nTu es ${member.name}. Ta mission doit être menée à bien et s'intégrer au projet existant.`,
    ].join("");

    const memberRequest: WorkAgentRequest = {
      ...request,
      instructions: memberInstructions,
      // Resume only the first member from a saved checkpoint; the following
      // members rebuild their context from the team context that accumulates.
      ...(memberIndex > 0 ? { resume: undefined } : {}),
    };

    try {
      await runAgent(memberRequest, taggedRuntime);
    } catch (error) {
      await runtime.onEvent({ type: "agent.error", error: { code: "AGENT_FAILED", message: (error as Error).message }, memberId: member.id, memberName: member.name });
    }

    const contextBits = [
      `Membre: ${member.name}`,
      memberReport ? `Rapport final:\n${memberReport.slice(0, 4000)}` : `Contenu produit:\n${memberDelta.join("").slice(-6000)}`,
      changedFiles.length ? `Fichiers modifiés:\n${changedFiles.join("\n")}` : "",
    ].filter(Boolean);
    teamContext = [...contextBits, teamContext ? "---" : ""].join("\n\n");
  }

  await runtime.onEvent({
    type: "agent.completed",
    message: `Équipe terminée — ${members.length} agents spécialisés ont travaillé en séquence sur la demande.`,
    steps: [],
  });
}