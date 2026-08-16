import { siC, siCplusplus, siCss, siDocker, siDotnet, siEslint, siGit, siGo, siHtml5, siJavascript, siJson, siKotlin, siMarkdown, siMysql, siNextdotjs, siNpm, siOpenjdk, siPhp, siPython, siReact, siRuby, siRust, siShell, siSvelte, siToml, siTypescript, siVite, siVuedotjs, siXml, siYaml, type SimpleIcon } from "simple-icons";
import type { ReactNode } from "react";
import { AegisLangMark, aegisLangForLabel } from "@/components/aegis/aegis-lang";

export type FileLanguage =
  | "react"
  | "typescript"
  | "javascript"
  | "python"
  | "json"
  | "css"
  | "html"
  | "yaml"
  | "sql"
  | "markdown"
  | "docker"
  | "git"
  | "shell"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "rust"
  | "go"
  | "php"
  | "powershell"
  | "xml"
  | "toml"
  | "kotlin"
  | "ruby"
  | "vue"
  | "svelte"
  | "env"
  | "npm"
  | "vite"
  | "next"
  | "eslint"
  | "text";

type LanguageIcon = { color: string } & ({ icon: SimpleIcon } | { render: () => ReactNode });

function PowerShellIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" role="img" aria-label="PowerShell icon">
      <rect x="1.5" y="2.5" width="21" height="19" rx="2.5" fill="#012456" transform="rotate(-12 12 12)" />
      <path d="M6 8.5 9.9 12 6 15.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-12 12 12)" />
      <path d="M11.5 15.8h6.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" transform="rotate(-12 12 12)" />
    </svg>
  );
}

const LANGUAGE_ICONS: Record<Exclude<FileLanguage, "text">, LanguageIcon> = {
  react: { icon: siReact, color: "#61DAFB" },
  typescript: { icon: siTypescript, color: "#3178C6" },
  javascript: { icon: siJavascript, color: "#F7DF1E" },
  python: { icon: siPython, color: "#3776AB" },
  json: { icon: siJson, color: "#E8C84D" },
  css: { icon: siCss, color: "#A66CFF" },
  html: { icon: siHtml5, color: "#E34F26" },
  yaml: { icon: siYaml, color: "#E07B9A" },
  sql: { icon: siMysql, color: "#6BB7D8" },
  markdown: { icon: siMarkdown, color: "#A9A9A9" },
  docker: { icon: siDocker, color: "#2496ED" },
  git: { icon: siGit, color: "#F05032" },
  shell: { icon: siShell, color: "#7ED36D" },
  java: { icon: siOpenjdk, color: "#E76F00" },
  c: { icon: siC, color: "#A8B9CC" },
  cpp: { icon: siCplusplus, color: "#00599C" },
  csharp: { icon: siDotnet, color: "#512BD4" },
  rust: { icon: siRust, color: "#B7410E" },
  go: { icon: siGo, color: "#00ADD8" },
  php: { icon: siPhp, color: "#777BB4" },
  powershell: { render: PowerShellIcon, color: "#012456" },
  xml: { icon: siXml, color: "#FF6600" },
  toml: { icon: siToml, color: "#9C4121" },
  kotlin: { icon: siKotlin, color: "#7F52FF" },
  ruby: { icon: siRuby, color: "#CC342D" },
  vue: { icon: siVuedotjs, color: "#42B883" },
  svelte: { icon: siSvelte, color: "#FF3E00" },
  env: { icon: siShell, color: "#9CD08F" },
  npm: { icon: siNpm, color: "#CB3837" },
  vite: { icon: siVite, color: "#646CFF" },
  next: { icon: siNextdotjs, color: "#D3D3D3" },
  eslint: { icon: siEslint, color: "#4B32C3" },
};

const LANGUAGE_LABELS: Partial<Record<FileLanguage, string>> = {
  cpp: "C++",
  csharp: "C#",
  powershell: "PowerShell",
};

export function fileLanguage(name: string): FileLanguage {
  const lower = (name || "").toLowerCase();
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return "docker";
  if (lower === ".gitignore" || lower === ".gitattributes" || lower === ".gitmodules") return "git";
  if (lower === "package.json" || lower === "package-lock.json" || lower === "yarn.lock") return "npm";
  if (lower === "pnpm-lock.yaml" || lower === "pnpm-workspace.yaml") return "yaml";
  if (lower === "tsconfig.json" || lower === "tsconfig.base.json") return "typescript";
  if (lower.startsWith("vite.config") && /\.(ts|js|mjs|cjs|mts|cts)$/.test(lower)) return "vite";
  if (lower.startsWith("next.config")) return "next";
  if (lower.startsWith(".eslintrc") || lower.startsWith("eslint.config")) return "eslint";
  if (lower === ".env" || lower === ".env.local" || lower.startsWith(".env.")) return "env";
  if (/\.(tsx|jsx)$/.test(lower)) return "react";
  if (/\.tsx?$/.test(lower)) return "typescript";
  if (/\.jsx?$/.test(lower)) return "javascript";
  if (/\.(py|pyw|pyi)$/.test(lower)) return "python";
  if (/\.(json|jsonc|json5)$/.test(lower)) return "json";
  if (/\.(css|scss|sass|less)$/.test(lower)) return "css";
  if (/\.(html?|htm)$/.test(lower)) return "html";
  if (/\.(vue)$/.test(lower)) return "vue";
  if (/\.(svelte)$/.test(lower)) return "svelte";
  if (/\.(ya?ml)$/.test(lower)) return "yaml";
  if (/\.(sql|mysql)$/.test(lower)) return "sql";
  if (/\.(md|mdx|markdown)$/.test(lower)) return "markdown";
  if (/\.(java)$/.test(lower)) return "java";
  if (/\.(kt|kts)$/.test(lower)) return "kotlin";
  if (/\.(rb|rake|gemspec)$/.test(lower)) return "ruby";
  if (/\.(cc|cpp|cxx|hpp|hh|hxx|h\+\+)$/.test(lower)) return "cpp";
  if (/\.(c|h)$/.test(lower)) return "c";
  if (/\.(cs|csx)$/.test(lower)) return "csharp";
  if (/\.rs$/.test(lower)) return "rust";
  if (/\.go$/.test(lower)) return "go";
  if (/\.(php|phtml)$/.test(lower)) return "php";
  if (/\.(ps1|psm1|psd1)$/.test(lower)) return "powershell";
  if (/\.(xml|xsd|xsl|xslt|svg|plist|csproj|fsproj|vbproj|targets|props|config)$/.test(lower)) return "xml";
  if (/\.(toml)$/.test(lower)) return "toml";
  if (/\.(sh|bash|zsh|bat|cmd|fish)$/.test(lower)) return "shell";
  return "text";
}

export function fileLanguageLabel(name: string): string {
  const language = fileLanguage(name);
  if (language === "text") return "text";
  if (language === "sql") return "SQL";
  return LANGUAGE_LABELS[language] ?? language.charAt(0).toUpperCase() + language.slice(1);
}

export function FileTypeIcon({ name, size = 14 }: { name: string; size?: number }) {
  const language = fileLanguage(name);
  const aegis = aegisLangForLabel(language);
  if (aegis) {
    const color = language === "text" ? "#9b9b9b" : LANGUAGE_ICONS[language as Exclude<FileLanguage, "text">]?.color ?? "#9b9b9b";
    return (
      <span className={`work-file-icon work-file-icon--${language}`} aria-hidden="true" style={{ color }}>
        <AegisLangMark lang={aegis} size={size} />
      </span>
    );
  }
  if (language === "text") {
    return (
      <span className="work-file-icon work-file-icon--text" aria-hidden="true" style={{ color: "#9b9b9b" }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
    );
  }
  const entry = LANGUAGE_ICONS[language];
  if ("render" in entry) {
    return (
      <span className={`work-file-icon work-file-icon--${language}`} aria-hidden="true" style={{ color: entry.color }}>
        {entry.render()}
      </span>
    );
  }
  const { icon, color } = entry;
  return (
    <span className={`work-file-icon work-file-icon--${language}`} aria-hidden="true" style={{ color }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={`${language} icon`}>
        <title>{icon.title}</title>
        <path d={icon.path} />
      </svg>
    </span>
  );
}
