import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("history: collapse toggle hides list, persists across reload", async ({ page }) => {
  await mockApi(page);
  await page.goto("/chat", { waitUntil: "networkidle" });

  const toggle = page.locator(".v3-rail__collapse");
  await expect(toggle).toBeVisible();
  await expect(page.locator(".v3-rail__search")).toBeVisible();
  await expect(page.locator(".v3-rail__list")).toBeVisible();

  await toggle.click();
  await expect(page.locator(".v3-rail__search")).toBeHidden();
  await expect(page.locator(".v3-rail__list")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".v3-rail__search")).toBeHidden();
  await expect(page.locator(".v3-rail__list")).toBeHidden();
  await expect(page.locator(".v3-rail__collapse")).toHaveAttribute("aria-expanded", "false");

  await page.locator(".v3-rail__collapse").click();
  await expect(page.locator(".v3-rail__search")).toBeVisible();
});

test("history: caps list at 8 and exposes show-all toggle", async ({ page }) => {
  await mockApi(page);
  const extra = Array.from({ length: 11 }, (_, i) => ({
    id: `conv-extra-${i + 1}`,
    title: `Conversation ${i + 1}`,
    providerId: "ollama",
    model: "llama-3.2",
    createdAt: "2026-07-20T10:00:00Z",
    updatedAt: "2026-07-22T10:00:00Z",
    messages: [{ id: `m-${i}`, role: "user", content: "Hello" }],
  }));
  await page.route("http://127.0.0.1:4000/conversations", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ conversations: extra, hasMore: false }) }),
  );

  await page.goto("/chat", { waitUntil: "networkidle" });
  const items = page.locator(".v3-rail__item");
  await expect(items).toHaveCount(8);

  const more = page.locator(".v3-rail__more");
  await expect(more).toBeVisible();
  await expect(more).toHaveText("Show all (11)");
  await more.click();
  await expect(items).toHaveCount(11);
  await expect(page.locator(".v3-rail__more")).toHaveText("Show fewer");
});
