import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("Shortcuts/Notifications/Labs cards open a coming-soon toast instead of doing nothing", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  for (const label of ["Shortcuts", "Notifications", "Labs"]) {
    const card = page.locator(`.aegis-settings-grid button`, { hasText: label });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByText(`${label} — coming soon`).last()).toBeVisible();
    await expect(page.getByText(/on the roadmap/i).last()).toBeVisible();
  }
});
