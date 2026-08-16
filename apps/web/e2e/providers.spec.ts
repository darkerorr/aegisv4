import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./helpers";

type CloudId = "nvidia-nim" | "openrouter";

async function mockDisconnectedCloudProviders(page: Page) {
  await mockApi(page);
  const connected: Record<CloudId, boolean> = { "nvidia-nim": false, openrouter: false };
  const names: Record<CloudId, string> = { "nvidia-nim": "NVIDIA NIM", openrouter: "OpenRouter" };
  const models: Record<CloudId, string> = { "nvidia-nim": "nvidia/deepseek-r1", openrouter: "openai/gpt-4.1-mini" };
  await page.route("http://127.0.0.1:4000/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/providers" && request.method() === "GET") {
      const providers = (["nvidia-nim", "openrouter"] as CloudId[]).map((id) => ({ id: `db-${id}`, providerKey: id, kind: id, name: names[id], baseUrl: id === "nvidia-nim" ? "https://integrate.api.nvidia.com/v1" : "https://openrouter.ai/api/v1", active: connected[id], hasApiKey: connected[id], secretConfigured: connected[id], modelsCount: connected[id] ? 1 : 0, defaultModel: connected[id] ? models[id] : undefined }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers }) });
    }
    const connect = path.match(/^\/providers\/(nvidia-nim|openrouter)\/connect$/);
    if (connect && request.method() === "POST") {
      const id = connect[1] as CloudId;
      const input = request.postDataJSON() as { apiKey?: string };
      expect(input.apiKey).toBeTruthy();
      connected[id] = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ connection: { id: `db-${id}`, provider: id, status: "connected", enabled: true, secretConfigured: true }, modelsDiscovered: 1, defaultModelId: models[id], health: { ok: true, latencyMs: 41 } }) });
    }
    if (path === "/models" && request.method() === "GET") {
      const cloudModels = (["nvidia-nim", "openrouter"] as CloudId[]).filter((id) => connected[id]).map((id) => ({ id: models[id], providerId: `db-${id}`, name: models[id], type: "chat", active: true, providerName: names[id], providerKind: id, local: false, favorite: false, visible: true, available: true, capabilities: ["reasoning", "tools"] }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [{ id: "llama-3.2", providerId: "ollama", name: "Llama 3.2", type: "chat", active: true, providerName: "Ollama", providerKind: "ollama", local: true, favorite: true, visible: true, available: true, capabilities: ["chat"] }, ...cloudModels] }) });
    }
    return route.fallback();
  });
}

test("NVIDIA Connect opens a real dialog, stores no browser secret and refreshes models", async ({ page }) => {
  await mockDisconnectedCloudProviders(page);
  await page.goto("/providers");
  const card = page.locator('[data-provider="nvidia-nim"]');
  await expect(card.getByText("No credential", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Test connection" })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Enable" })).toHaveCount(0);
  await card.getByRole("button", { name: "Connect", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "NVIDIA NIM" });
  await expect(dialog).toBeVisible();
  const field = dialog.getByRole("textbox", { name: "API key", exact: true });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("type", "password");
  const secret = "nvapi-e2e-placeholder-not-real";
  await field.fill(secret);
  await dialog.getByRole("button", { name: "Connect NVIDIA" }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText("Credential configured", { exact: true })).toBeVisible();
  await expect(card.getByText("Connected", { exact: true })).toBeVisible();
  const browserState = await page.evaluate(() => JSON.stringify({ local: Object.values(localStorage), session: Object.values(sessionStorage), html: document.documentElement.innerHTML }));
  expect(browserState).not.toContain(secret);
  await page.goto("/chat");
  await page.locator(".model-trigger").first().click();
  await expect(page.getByText("nvidia/deepseek-r1", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/provider-nvidia-connected.png" });
});

test("OpenRouter dialog supports keyboard close and keeps invalid-key errors visible", async ({ page }) => {
  await mockDisconnectedCloudProviders(page);
  await page.route("http://127.0.0.1:4000/providers/openrouter/connect", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ code: "PROVIDER_AUTH_FAILED", message: "OpenRouter rejected this API key." }) }));
  await page.goto("/providers");
  const card = page.locator('[data-provider="openrouter"]');
  await card.getByRole("button", { name: "Connect", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "OpenRouter" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await card.getByRole("button", { name: "Connect", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "OpenRouter" });
  await dialog.getByRole("textbox", { name: "API key", exact: true }).fill("sk-or-invalid-placeholder");
  await dialog.getByRole("textbox", { name: "API key", exact: true }).press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("OpenRouter rejected this API key.");
  await expect(dialog.getByRole("textbox", { name: "API key", exact: true })).toHaveValue("sk-or-invalid-placeholder");
  await page.screenshot({ path: "test-results/screenshots/provider-openrouter-invalid.png" });
});
