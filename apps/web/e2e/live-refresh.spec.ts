import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4000";

function sseChunk(content: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

test("real browser refresh keeps a live generation and receives its final answer", async ({ page }) => {
  let provider: Server | undefined;
  provider = createServer((request, response) => {
    if (request.url?.endsWith("/models")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "live-model" }] }));
      return;
    }
    if (request.url?.endsWith("/chat/completions")) {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      setTimeout(() => response.write(sseChunk("LIVE_PARTIAL")), 450);
      setTimeout(() => response.write(sseChunk("_ANSWER")), 1_200);
      setTimeout(() => { response.write("data: [DONE]\n\n"); response.end(); }, 1_500);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve) => provider!.listen(0, "127.0.0.1", () => resolve()));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Could not start the live provider fixture.");

  const suffix = randomUUID();
  const registration = await page.request.post(`${apiUrl}/auth/register`, {
    data: { email: `browser-refresh-${suffix}@example.test`, password: "Browser-refresh-123!", displayName: "Browser refresh" },
  });
  expect(registration.status()).toBe(201);
  const cookieHeader = registration.headers()["set-cookie"]?.split(";")[0];
  expect(cookieHeader).toBeTruthy();
  const [cookieName, cookieValue] = cookieHeader!.split("=");
  await page.context().addCookies([{ name: cookieName, value: cookieValue, domain: "127.0.0.1", path: "/" }]);

  const connected = await page.request.post(`${apiUrl}/providers`, {
    headers: { Cookie: cookieHeader! },
    data: { type: "openai-compatible", name: "Browser live fixture", baseUrl: `http://127.0.0.1:${address.port}/v1`, defaultModel: "live-model" },
  });
  expect(connected.status()).toBe(201);
  await connected.json();
  const refreshedModels = await page.request.post(`${apiUrl}/models/refresh`, { headers: { Cookie: cookieHeader! } });
  expect(refreshedModels.status()).toBe(200);

  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("aegis.onboarding.v1", "1"); });
  await page.goto("/chat");
  const modelButton = page.getByRole("button", { name: /Select a model|Loading models|live-model/i }).first();
  await expect(modelButton).toBeVisible({ timeout: 15_000 });
  await modelButton.click();
  await page.locator("button.aegis-model-option").filter({ hasText: "live-model" }).click();
  await page.getByLabel("Message Aegis").fill("Refresh during this live generation");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("LIVE_PARTIAL", { exact: false })).toBeVisible({ timeout: 15_000 });
  const conversationUrl = page.url();
  expect(conversationUrl).toMatch(/\/chat\//);
  await page.keyboard.press("F5");
  await page.waitForLoadState("domcontentloaded");

  await expect(page.getByText("LIVE_PARTIAL", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("LIVE_PARTIAL_ANSWER", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".v3-msg--user .v3-msg__bubble").filter({ hasText: "Refresh during this live generation" })).toHaveCount(1);
  await expect(page.locator(".v3-msg--assistant")).toHaveCount(1);

  await new Promise<void>((resolve) => provider!.close(() => resolve()));
});
