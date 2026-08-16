import type { ReactNode } from "react";

/* ============================================================================
   AEGIS LANGUAGE MARKS — original, recognisable geometric sigils for the
   file languages, drawn in the same grammar as the Aegis icon system.
   They deliberately do NOT copy the official language logos.
   ========================================================================== */

export type AegisLang = "ts" | "js" | "python" | "json" | "css" | "html" | "yaml" | "sql" | "md" | "shell" | "powershell" | "git" | "docker" | "env" | "react" | "go" | "rust" | "java" | "cpp" | "csharp" | "text";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const LANG_MARKS: Record<AegisLang, ReactNode> = {
  ts: (
    <>
      <path d="M5.5 6h13M12 6v7" {...S} />
      <path d="M8 14.5l4 4.5 4-4.5" {...S} />
      <path d="M12 15.6l1.3 1.3-1.3 1.3-1.3-1.3z" fill="currentColor" stroke="none" />
    </>
  ),
  js: (
    <>
      <path d="M6 5h12v14H6z" {...S} />
      <path d="M15 5v8a2.5 2.5 0 0 1-2.5 2.5h-.5" {...S} />
      <circle cx="8.5" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  python: (
    <>
      <path d="M9 5L5.5 12 9 19" {...S} />
      <path d="M15 5l3.5 7L15 19" {...S} />
    </>
  ),
  json: (
    <>
      <path d="M10 5c-1.8 1.8-1.8 3.6 0 5.4-1.8 1.8-1.8 3.6 0 5.4" {...S} />
      <path d="M14 5c1.8 1.8 1.8 3.6 0 5.4 1.8 1.8 1.8 3.6 0 5.4" {...S} />
    </>
  ),
  css: (
    <>
      <path d="M7 4h10M7 12h10M7 20h10" {...S} />
      <path d="M6 6.5c-1.2.9-1.2 1.6 0 2.5M18 6.5c1.2.9 1.2 1.6 0 2.5" {...S} />
    </>
  ),
  html: (
    <>
      <path d="M6 5.5l12 6.5-12 6.5" {...S} />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  yaml: (
    <>
      <path d="M6 4.5v7.5a3.2 3.2 0 0 0 3.2 3.2H12" {...S} />
      <circle cx="12" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  sql: (
    <>
      <path d="M12 4.8c3.2 0 5.6 1.7 5.6 3.7S15.2 12.2 12 12.2 6.4 10.5 6.4 8.5 8.8 4.8 12 4.8z" {...S} />
      <path d="M6.4 8.5v6.4c0 2 2.5 3.6 5.6 3.6s5.6-1.6 5.6-3.6V8.5" {...S} />
    </>
  ),
  md: (
    <>
      <path d="M5 5.5h14v13H5z" {...S} />
      <path d="M6 15.5l3-3.5 2 2.5 3-4 4 5" {...S} />
    </>
  ),
  shell: (
    <>
      <path d="M6.5 9l3 3-3 3" {...S} />
      <path d="M12.5 15.5h5" {...S} />
      <path d="M12 10.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  powershell: (
    <>
      <path d="M5.5 8.5L9 12l-3.5 3.5" {...S} />
      <path d="M11 15.5h6" {...S} />
    </>
  ),
  git: (
    <>
      <path d="M6 3.5v8a3.2 3.2 0 0 0 3.2 3.2H11" {...S} />
      <path d="M11 11.5l2.8 2.8L11 17" {...S} />
      <circle cx="6" cy="3.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="20" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  docker: (
    <>
      <path d="M4 13.5h3.5M10.5 13.5H14M7.5 17h3.5M4 10.5h3.5M10.5 10.5H13" {...S} />
      <path d="M14 13.5h2.5a3.5 3.5 0 0 1-2.5 3.4" {...S} />
    </>
  ),
  env: (
    <>
      <path d="M4 7.5h7M13 7.5h7M4 16.5h7M13 16.5h7" {...S} />
      <path d="M12 13.6l1.4 1.4-1.4 1.4-1.4-1.4z" fill="currentColor" stroke="none" />
    </>
  ),
  react: (
    <>
      <path d="M12 5l3.2 5.2h-6.4z" {...S} />
      <path d="M12 19l-3.2-5.2h6.4z" {...S} />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  go: (
    <>
      <circle cx="13" cy="13" r="5.4" {...S} />
      <path d="M12 13V5.5M12 7.6L8 7.6" {...S} />
    </>
  ),
  rust: (
    <>
      <path d="M12 4.2l6 3.5v7L12 18.2l-6-3.5v-7z" {...S} />
      <path d="M12 9l3 3-3 3-3-3z" {...S} />
    </>
  ),
  java: (
    <>
      <path d="M6 4.5h9v6.5a4.5 4.5 0 0 1-9 0z" {...S} />
      <path d="M15 7.5h1.2a2.3 2.3 0 0 1 0 4.6" {...S} />
      <path d="M7.5 2.5h1M9.5 2.5h1" {...S} />
    </>
  ),
  cpp: (
    <>
      <path d="M15 6a6 6 0 1 0 0 12" {...S} />
      <path d="M13 8.5v7M9.5 12h4.5" {...S} />
    </>
  ),
  csharp: (
    <>
      <path d="M15 6a6 6 0 1 0 0 12" {...S} />
      <path d="M14 8.5v7M10.5 11.5h6M13 9.5h-6" {...S} />
    </>
  ),
  text: (
    <>
      <path d="M6 4.5h8.5L19 9v10.5H6z" {...S} />
      <path d="M14.5 4.5V9H19" {...S} />
      <path d="M9 13h6M9 16.5h4" {...S} />
    </>
  ),
};

export function AegisLangMark({ lang, size = 14, className }: { lang: AegisLang; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {LANG_MARKS[lang]}
    </svg>
  );
}

/** Best-effort mapping from the existing file-language label to an Aegis mark. */
export function aegisLangForLabel(label: string): AegisLang | null {
  switch (label) {
    case "react":
      return "react";
    case "typescript":
      return "ts";
    case "javascript":
      return "js";
    case "python":
      return "python";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "markdown":
      return "md";
    case "shell":
    case "env":
      return label === "shell" ? "shell" : "env";
    case "docker":
      return "docker";
    case "git":
      return "git";
    case "go":
      return "go";
    case "rust":
      return "rust";
    case "java":
      return "java";
    case "c":
    case "cpp":
      return "cpp";
    case "csharp":
      return "csharp";
    case "powershell":
      return "powershell";
    default:
      return null;
  }
}