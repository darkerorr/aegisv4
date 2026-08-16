const TRAILING_POLITE = /\b(s['’]il (te|vous) plaît|svp|stp|merci(?: d'?[\p{L}\p{N}_]+)*|please|thank you(?: very much)?|thanks|thx)\b[^.!?]*$/iu;
const LEADING_POLITE = /^(s['’]il (te|vous) plaît|svp|stp|please|thank you|thanks|thx)[,\s]+/iu;
const WEB_QUALIFIER = /\bsur (le |la |l'|les |la )?(web|internet|réseau)\b/giu;

const WORD = "\\p{L}\\p{N}_";
const WORD_HYPHEN = "\\p{L}\\p{N}_'-";

/** Narrative framing: "ma grand-mère me demande comment faire des pâtes",
 * "my grandma asks me how to make pasta", "mon frère me dit de vérifier X".
 * The owner is 1–3 words, then an optional dative, then the verb phrase. */
const FRAMING_PREFIX =
  new RegExp(
    `^(?:ma|mon|mes|notre|nos|leur|leurs|un|une|le|la|les|my|our|their)\\s+[${WORD}][${WORD_HYPHEN}]+(?:\\s+[${WORD}][${WORD_HYPHEN}]+){0,2}\\s+(?:me|m['’]|nous|vous|t['’]|lui|leur|us|them)?\\s*(?:demande|demandent|demandait|a\\s+demandé|avait\\s+demandé|ont\\s+demandé|demande\\s+de|dit|disent|disait|pose|posent|explique|expliquent|veut|veulent|voudrait|voudraient|aimerait|aimeraient|réclame|réclament|asks?|asked|is asking|tells?|told|wants?|wanted|would like|likes?)\\s+(?:me|m['’]|nous|vous|us|them)?\\s*(?:de\\s+|d['’]\\s*|à\\s+|pour\\s+|for\\s+|to\\s+)?`,
    "iu",
  );

/** Direct commands that should not leak into the query itself. */
const COMMAND_PREFIXES: RegExp[] = [
  /^(?:peux[- ]tu|pouvez[- ]vous|pourriez[- ]vous|tu peux|vous pouvez)\s+(?:me\s+|m['’]\s*)?(?:dire|montrer|donner|trouver|chercher|expliquer|m['’]expliquer|m['’]aider à|expliquer)\s+(?:moi\s+|moi-même\s+)?/iu,
  /^(?:can you|could you|would you)\s+(?:me\s+|us\s+)?(?:tell|show|give|find|search for|look up|help me|explain to me|explain)\s+(?:me\s+)?/iu,
  /^(?:je\s+|j['’])?(?:veux|voudrais|aimerais|souhaite)\s+(?:savoir|connaître|trouver|comprendre)\s+/iu,
  /^(?:i want to know|i['’]d like to know|i need to know|i['’]m trying to find out|i['’]m wondering)\s+/iu,
  /^(?:dis[- ]moi|dites[- ]moi|tell me|explique[- ]moi|expliquez[- ]moi|explain to me)\s+/iu,
  /^(?:trouve|cherche|recherche|search|find|look up|look for|go check|check)\s+/iu,
];

function trimQuery(q: string): string {
  return q.replace(/[?!.]+$/g, "").replace(/[\s,;:]+$/g, "").trim();
}

/**
 * Turn a raw user prompt into a concise, searchable query. Chat messages are
 * often wrapped in conversational framing ("ma grand-mère me demande comment
 * faire des pâtes") or politeness; searching the verbatim sentence wastes the
 * provider's quality and returns worse results. This strips the framing and
 * keeps the actual question core.
 */
export function deriveSearchQuery(input: string): string {
  let q = input.trim().replace(/\s+/g, " ");

  // 1) Politeness and web qualifiers never belong in a query.
  q = q
    .replace(TRAILING_POLITE, "")
    .replace(LEADING_POLITE, "")
    .replace(WEB_QUALIFIER, " ")
    .replace(/[\s,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 2) Narrative framing, when present, keeps only the question core.
  const framed = q.replace(FRAMING_PREFIX, "").trim();
  if (framed !== q && framed.length >= 3) return trimQuery(framed);

  // 3) Direct command prefixes ("dis-moi", "trouve", "je veux savoir", …).
  for (const prefix of COMMAND_PREFIXES) {
    const candidate = q.replace(prefix, "").trim();
    if (candidate !== q && candidate.length >= 3) {
      q = candidate;
      break;
    }
  }

  return trimQuery(q);
}

export type IntentDecision = {
  kind: "general_chat" | "gmail" | "drive" | "github" | "web_search" | "calendar" | "attachment" | "code" | "multi_tool";
  confidence: number;
  tools: string[];
  requiresClarification: boolean;
  clarificationQuestion?: string;
};

const intentPatterns: Array<{ kind: IntentDecision["kind"]; tool: string; patterns: RegExp[] }> = [
  { kind: "gmail", tool: "gmail.getLatestMessage", patterns: [/\b(mail|email|gmail|inbox|boîte de réception)\b/i, /\bdernier message reçu\b/i] },
  { kind: "drive", tool: "drive.searchFiles", patterns: [/\b(google drive|mon drive|fichier.+drive)\b/i] },
  { kind: "github", tool: "github.getFileContent", patterns: [/(?:read|open|lis|lire|ouvre).*(?:readme|file|fichier).*(?:github|repo|repository|dépôt)|(?:readme).*(?:github|repo|repository|dépôt)/i] },
  { kind: "github", tool: "github.searchCode", patterns: [/(?:search|find|cherche|recherche).*(?:code|function|fonction|symbol|symbole).*(?:github|repo|repository|dépôt)/i] },
  { kind: "github", tool: "github.listIssues", patterns: [/\bissues?\b|\btickets? github\b/i] },
  { kind: "github", tool: "github.listPullRequests", patterns: [/\bpull requests?\b|\bPRs?\b/i] },
  { kind: "github", tool: "github.listRepositories", patterns: [/(?:list|show|display|liste|affiche|montre).*(?:repositories|repository|repos|dépôts)|\bmes (?:repos|dépôts)\b/i, /^\s*github\s*[?.!]*\s*$/i] },
  { kind: "web_search", tool: "web.search", patterns: [/\b(sur (le )?web|internet|recherche en ligne|actualités?|cherche.*(web|internet|info)|dernières? (informations?|nouvelles|actualités?|versions?)|trouve.*(information|documentation|tutoriel|article))\b/i, /\b(compare.*prix|météo|quel temps|latest|recent|current (version|release)|search web)\b/i] },
  { kind: "calendar", tool: "calendar.listUpcomingEvents", patterns: [/\b(calendar|calendrier|rendez-vous|prochain événement)\b/i] },
  { kind: "code", tool: "code.inspectWorkspace", patterns: [/\b(workspace|codebase|projet|fichier (typescript|javascript|python))\b/i] },
];

const repositoryTools = new Set(["github.getRepository", "github.listDirectory", "github.getFileContent", "github.searchCode", "github.listIssues", "github.getIssue", "github.listPullRequests", "github.getPullRequest"]);

export function classifyIntent(input: { text: string; attachmentIds?: string[]; explicitlyEnabledTools?: string[] }): IntentDecision {
  const tools = new Set(input.explicitlyEnabledTools ?? []);
  let best: IntentDecision["kind"] = "general_chat";
  let confidence = tools.size ? 1 : 0;
  for (const candidate of intentPatterns) {
    const matched = candidate.patterns.filter((pattern) => pattern.test(input.text)).length;
    const score = matched / candidate.patterns.length;
    if (matched > 0) tools.add(candidate.tool);
    if (score > confidence) { confidence = score; best = candidate.kind; }
  }
  if (input.attachmentIds?.length) {
    tools.add("attachments.readText");
    best = tools.size > 1 ? "multi_tool" : "attachment";
    confidence = Math.max(confidence, 0.98);
  }
  if (tools.size > 1) best = "multi_tool";
  const requiresClarification = [...tools].some((tool) => repositoryTools.has(tool)) && !/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/.test(input.text);
  return {
    kind: best,
    confidence,
    tools: [...tools],
    requiresClarification,
    ...(requiresClarification ? { clarificationQuestion: "Which GitHub repository should I use? Specify owner/repo." } : {}),
  };
}