import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("connections expose permissions", async ({ page }) => {
  await mockApi(page);
  await page.goto("/connections");
  await expect(page.getByRole("heading", { name: "Google Workspace" }).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/connections.png" });
});
