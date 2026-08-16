import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

/**
 * Stress test: 30 rapid sends within an existing conversation.
 * Verifies that every Send produces a response, model stays selected,
 * and no message is lost or duplicated.
 */
test("30 rapid sends in existing conversation — model persists, no silent failures", async ({ page }) => {
  await mockApi(page);
  const submissions: Array<{ model: string; providerId: string; clientMessageId: string }> = [];
  let streamCount = 0;

  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    streamCount++;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    submissions.push({
      model: String(body.model),
      providerId: String(body.providerId),
      clientMessageId: String(body.clientMessageId),
    });
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-credentials": "true",
      },
      body: `event: message.started\ndata: {"conversationId":"conv-1","providerId":"${body.providerId}","model":"${body.model}"}\n\nevent: message.delta\ndata: {"delta":"Reply ${streamCount}"}\n\nevent: message.completed\ndata: {"conversationId":"conv-1","messageId":"m${streamCount}"}\n\n`,
    });
  });

  // Start with an existing conversation so no navigation remount occurs
  await page.goto("/chat/conv-1");
  await expect(page.getByText("Launch narrative").first()).toBeVisible();

  // Select model once
  const modelButton = page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ });
  await expect(modelButton).toBeVisible();
  await modelButton.click();
  const modelOption = page.locator(".model-list button").filter({ hasText: "DeepSeek R1" }).first();
  await expect(modelOption).toBeVisible();
  await modelOption.click();

  // Send 30 consecutive messages
  for (let i = 1; i <= 30; i++) {
    const msg = `Follow-up ${i}`;
    const textArea = page.getByLabel("Message Aegis");
    await expect(textArea).toBeEnabled();
    await textArea.fill(msg);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(msg).first()).toBeVisible();
    await expect(page.getByText(`Reply ${i}`).first()).toBeVisible();
  }

  // Verify all 30 submissions were captured via the route interceptor
  expect(submissions.length).toBe(30);

  // Every submission must use the same model
  const uniqueModels = new Set(submissions.map((s) => s.model));
  expect(uniqueModels.size).toBe(1);
  expect(uniqueModels.has("DeepSeek R1")).toBe(true);

  // Every submission must have a clientMessageId
  const missingIds = submissions.filter((s) => !s.clientMessageId);
  expect(missingIds.length).toBe(0);

  // All providerIds must be consistent
  const uniqueProviders = new Set(submissions.map((s) => s.providerId));
  expect(uniqueProviders.size).toBe(1);
  expect(uniqueProviders.has("nvidia")).toBe(true);

  console.log(`\n30-rapid-send stress test:\n30 passed\n0 failed\nModel consistent: ${uniqueModels.size === 1}\nProvider consistent: ${uniqueProviders.size === 1}\n`);
});

test("30 first-message submissions: model stays selected, each produces a response", async ({ page }) => {
  await mockApi(page);

  const submissions: Array<{ model: string; providerId: string; clientMessageId: string }> = [];
  let streamCount = 0;

  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    streamCount++;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    submissions.push({
      model: String(body.model),
      providerId: String(body.providerId),
      clientMessageId: String(body.clientMessageId),
    });
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-credentials": "true",
      },
      body: `event: message.started\ndata: {"conversationId":"conv-1","providerId":"${body.providerId}","model":"${body.model}"}\n\nevent: message.delta\ndata: {"delta":"Response ${streamCount}"}\n\nevent: message.completed\ndata: {"conversationId":"conv-1","messageId":"m${streamCount}"}\n\n`,
    });
  });

  await page.goto("/chat");

  // Select the model once
  const modelButton = page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ });
  await expect(modelButton).toBeVisible();
  await modelButton.click();
  const modelOption = page.locator(".model-list button").filter({ hasText: "DeepSeek R1" }).first();
  await expect(modelOption).toBeVisible();
  await modelOption.click();

  for (let i = 1; i <= 30; i++) {
    const messageText = `First message ${i}`;
    const textArea = page.getByLabel("Message Aegis");
    await expect(textArea).toBeEnabled();
    await textArea.fill(messageText);
    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // The response should appear
    await expect(page.getByText(`Response ${i}`).first()).toBeVisible({ timeout: 15000 });

    // After first message, verify model is still selected (button text changes to model name)
    if (i === 1) {
      await expect(page.locator(".model-trigger").filter({ hasText: /DeepSeek R1/ })).toBeVisible({ timeout: 5000 });
    }
  }

  expect(submissions.length).toBe(30);
  const uniqueModels = new Set(submissions.map((s) => s.model));
  expect(uniqueModels.size).toBe(1);
  const missingIds = submissions.filter((s) => !s.clientMessageId);
  expect(missingIds.length).toBe(0);
  const uniqueProviders = new Set(submissions.map((s) => s.providerId));
  expect(uniqueProviders.size).toBe(1);
  console.log(`\n30-first-message stress test:\n30 attempted\n${submissions.length} responses\n0 lost prompts\n0 deselected models\n`);
});

test("10 rapid sends within existing conversation — no duplicate or silent failure", async ({ page }) => {
  await mockApi(page);
  let streamCount = 0;
  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    streamCount++;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "access-control-allow-origin": "http://127.0.0.1:3000",
        "access-control-allow-credentials": "true",
      },
      body: `event: message.started\ndata: {"conversationId":"conv-1","providerId":"${body.providerId}","model":"${body.model}"}\n\nevent: message.delta\ndata: {"delta":"Reply ${streamCount}"}\n\nevent: message.completed\ndata: {"conversationId":"conv-1","messageId":"m${streamCount}"}\n\n`,
    });
  });

  await page.goto("/chat/conv-1");
  await expect(page.getByText("Launch narrative").first()).toBeVisible();

  const modelButton = page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ });
  await expect(modelButton).toBeVisible();
  await modelButton.click();
  const modelOption = page.locator(".model-list button").filter({ hasText: "Llama 3.2" }).first();
  await expect(modelOption).toBeVisible();
  await modelOption.click();

  for (let i = 1; i <= 10; i++) {
    const msg = `Follow-up ${i}`;
    const textArea = page.getByLabel("Message Aegis");
    await textArea.fill(msg);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(`Reply ${i}`).first()).toBeVisible();
  }

  expect(streamCount).toBe(10);
  console.log(`\n10 rapid sends in existing conversation: ${streamCount} streams (expected 10)\n`);
});
