import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

test("first prompt keeps its immutable selected model", async ({ page }) => {
  await mockApi(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "http://127.0.0.1:3000", "access-control-allow-credentials": "true" }, body: 'event: message.started\ndata: {"conversationId":"first-conversation","providerId":"nvidia","model":"DeepSeek R1"}\n\nevent: message.delta\ndata: {"delta":"Immediate answer"}\n\nevent: message.completed\ndata: {"conversationId":"first-conversation","messageId":"answer-1"}\n\n' });
  });
  await page.goto("/chat");
  // Open model selector popover
  await page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ }).click();
  // Pick DeepSeek R1 from the popover list (not the trigger button)
  await page.locator(".model-list button").filter({ hasText: "DeepSeek R1" }).first().click();
  await page.getByLabel("Message Aegis").fill("Immediate first prompt");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Immediate first prompt")).toBeVisible();
  await expect.poll(() => submitted?.model).toBe("DeepSeek R1");
  expect(submitted?.providerId).toBe("nvidia");
  expect(submitted?.clientMessageId).toBeTruthy();
  await expect(page.getByText("Immediate answer")).toBeVisible();
});

test("tools and attachment controls are functional", async ({ page }) => {
  await mockApi(page);
  await page.route("http://127.0.0.1:4000/attachments", async (route) => {
    const input = route.request().postDataJSON() as { name: string; mimeType: string; size: number };
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ attachment: { id: "attachment-1", name: input.name, mimeType: input.mimeType, size: input.size, status: "ready", createdAt: "2026-07-23" } }) });
  });
  await page.goto("/chat");
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page.getByRole("radiogroup", { name: "Tool mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gmail/ })).toBeEnabled();
  await page.keyboard.press("Escape");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach file" }).click();
  const fileChooser = await chooser;
  await fileChooser.setFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Aegis attachment") });
  await expect(page.getByText("notes.txt")).toBeVisible();
  await expect(page.getByText(/Ready/)).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/attachment-preview.png" });
});

test("projects can be created and NVIDIA filtering stays explicit", async ({ page }) => {
  await mockApi(page);
  let projects: Array<Record<string, unknown>> = [];
  await page.route("http://127.0.0.1:4000/projects", async (route) => {
    if (route.request().method() === "POST") { const input=route.request().postDataJSON() as Record<string,unknown>;projects=[{id:"project-1",...input,color:"neutral",tools:[],conversationCount:0,createdAt:"2026-07-23",updatedAt:"2026-07-23"}];return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({project:projects[0]})}); }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projects }) });
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Aegis release");
  await page.getByRole("button", { name: /Create project/ }).click();
  await expect(page.getByRole("heading", { name: "Aegis release" })).toBeVisible();
  await page.goto("/workspace/models");
  await page.getByRole("button", { name: "NVIDIA NIM" }).click();
  await expect(page.getByText("DeepSeek R1")).toBeVisible();
  await expect(page.getByText("Pricing unavailable")).toBeVisible();
});

test("chat wallpaper settings persist readable presets", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: /Soft Grid/ }).click();
  await page.goto("/chat");
  await expect(page.locator(".chat-workspace:visible")).toHaveAttribute("data-wallpaper", "grid");
});
