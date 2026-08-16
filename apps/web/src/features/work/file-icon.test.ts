import { describe, expect, it } from "vitest";
import { fileLanguage } from "./file-icon";

describe("fileLanguage", () => {
  const cases: Array<[string, string]> = [
    ["package.json", "npm"],
    ["package-lock.json", "npm"],
    ["yarn.lock", "npm"],
    ["pnpm-lock.yaml", "yaml"],
    ["tsconfig.json", "typescript"],
    ["vite.config.ts", "vite"],
    ["vite.config.js", "vite"],
    ["next.config.mjs", "next"],
    [".eslintrc.json", "eslint"],
    ["eslint.config.mjs", "eslint"],
    [".env", "env"],
    [".env.local", "env"],
    ["Dockerfile", "docker"],
    [".gitignore", "git"],
    ["README.md", "markdown"],
    ["src/App.tsx", "react"],
    ["index.ts", "typescript"],
    ["main.js", "javascript"],
    ["script.py", "python"],
    ["data.json", "json"],
    ["styles.css", "css"],
    ["index.html", "html"],
    ["compose.yml", "yaml"],
    ["schema.sql", "sql"],
    ["Main.java", "java"],
    ["Foo.kt", "kotlin"],
    ["lib.rb", "ruby"],
    ["App.vue", "vue"],
    ["App.svelte", "svelte"],
    ["util.rs", "rust"],
    ["main.go", "go"],
    ["index.php", "php"],
    ["run.ps1", "powershell"],
    ["run.bat", "shell"],
    ["install.sh", "shell"],
    ["build.csproj", "xml"],
    ["Cargo.toml", "toml"],
    ["main.c", "c"],
    ["lib.h", "c"],
    ["widget.cpp", "cpp"],
    ["Program.cs", "csharp"],
    ["unknown.xyz", "text"],
  ];

  it.each(cases)("maps %s to %s", (name, expected) => {
    expect(fileLanguage(name)).toBe(expected);
  });
});