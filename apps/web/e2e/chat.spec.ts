import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("chat empty and streaming", async ({ page }) => {
  await mockApi(page);
  await page.goto("/chat");
  await page.screenshot({ path: "test-results/screenshots/workspace-empty.png" });
  await page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ }).click();
  await page.getByRole("button", { name: /DeepSeek R1/ }).click();
  await page.getByLabel("Message Aegis").fill("Give me a launch line");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("A protected, deliberate answer.")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/workspace-chat.png" });
});
