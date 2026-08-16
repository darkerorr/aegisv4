import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ProviderCommandError } from "./features/providers/providerClient";

const desktopRoot = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(desktopRoot, path), "utf8");

describe("Aegis Desktop acceptance contracts", () => {
  it("builds the release entry as a Windows GUI without startup sidecars", () => {
    const main = source("src-tauri/src/main.rs");
    const native = source("src-tauri/src/lib.rs");
    expect(main).toContain('#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]');
    expect(native).not.toMatch(/start\.bat|next\.js|node\.exe|cmd\.exe|powershell\.exe/i);
    expect(native).toContain("CREATE_NO_WINDOW");
  });

  it("keeps local mode independent from the Aegis API", () => {
    const auth = source("src/contexts/AuthContext.tsx");
    const chat = source("src/contexts/ChatContext.tsx");
    expect(auth).toMatch(/goLocal[\s\S]*setStatus\("local"\)/);
    expect(chat).toContain('authStatus === "local"');
    expect(chat).toContain("streamProviderChat");
  });

  it("normalizes invalid keys, network errors and timeouts without secret data", () => {
    expect(new ProviderCommandError({ category: "invalid-key", message: "Rejected", status: 401 })).toMatchObject({ category: "invalid-key", status: 401 });
    const errors = source("src-tauri/src/providers/error.rs");
    expect(errors).toContain('"invalid-key"');
    expect(errors).toContain('"network-error"');
    expect(errors).toContain('"timeout"');
    expect(errors).not.toMatch(/api_key|apiKey|bearer/i);
  });

  it("implements NVIDIA, OpenRouter, Ollama and LM Studio through Rust adapters", () => {
    const registry = source("src-tauri/src/providers/registry.rs");
    for (const adapter of ["NvidiaAdapter", "OpenRouterAdapter", "OllamaAdapter", "LmStudioAdapter"]) expect(registry).toContain(adapter);
    const providersPage = source("src/pages/ProvidersPage.tsx");
    for (const state of ["idle", "validating", "saving-secret", "testing", "discovering-models", "connected", "invalid-key", "network-error", "provider-error", "no-models", "cancelled"]) expect(providersPage).toContain(`"${state}"`);
  });

  it("validates NVIDIA credentials with an authenticated chat probe, not its public catalogue", () => {
    const nvidia = source("src-tauri/src/providers/nvidia.rs");
    expect(nvidia).toContain('/chat/completions');
    expect(nvidia).toContain('"max_tokens": 1');
    expect(nvidia).toContain('"chat authentication probe"');
    expect(nvidia).toContain('"The NVIDIA API key was rejected."');
  });

  it("keeps the ModelSelector visible and keyboard accessible", () => {
    const selector = source("src/features/models/components/ModelSelector.tsx");
    const chat = source("src/pages/ChatPage.tsx");
    expect(chat).toContain("<ModelSelector />");
    for (const key of ["ArrowUp", "ArrowDown", "Enter", "Escape"]) expect(selector).toContain(`"${key}"`);
    for (const filter of ["All", "Local", "Online", "Coding", "Reasoning", "Vision", "Tools", "Free", "Favorites"]) expect(selector).toContain(`"${filter}"`);
    expect(selector).toContain("filtered.length > 80");
  });

  it("pins the composer inside a flex viewport for long and small-window conversations", () => {
    const css = source("src/styles.css");
    expect(css).toMatch(/\.desktop-shell[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.desktop-content-chat \.chat-messages[^}]*min-height:\s*0[^}]*flex:\s*1[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.desktop-content-chat \.composer-section[^}]*position:\s*relative[^}]*flex:\s*none[^}]*margin-top:\s*auto/);
    expect(css).toContain("@media (max-height: 680px)");
    expect(css).not.toMatch(/\.composer-section[^}]*position:\s*absolute/);
  });

  it("persists only non-sensitive provider references and supports real secret deletion", () => {
    const model = source("src-tauri/src/providers/model.rs");
    const store = source("src-tauri/src/providers/secret_store.rs");
    const registry = source("src-tauri/src/providers/registry.rs");
    expect(model).toContain("secret_ref");
    const persistedConnection = model.slice(model.indexOf("pub struct ProviderConnection"), model.indexOf("pub struct SaveConnectionInput"));
    expect(persistedConnection).not.toMatch(/api_key/);
    expect(store).toContain("delete_credential");
    expect(registry).toContain("known_secret_is_absent_from_every_local_configuration_file");
  });

  it("honors reduced and disabled visual effects", () => {
    const settings = source("src/contexts/SettingsContext.tsx");
    const css = source("src/styles.css");
    expect(settings).toContain('"full" | "reduced" | "off"');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('[data-aegis-effects="off"]');
  });
});
