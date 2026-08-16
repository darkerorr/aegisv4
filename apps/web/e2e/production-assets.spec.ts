import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("direct GitHub production route hydrates and every loaded Next asset is valid", async ({ page }) => {
  await mockApi(page);
  await page.route("http://127.0.0.1:4000/integrations/github/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: false, configured: false, status: "not_configured", repositoryCount: 0, permissions: {} }),
  }));
  const pageErrors: string[] = [];
  const chunkFailures: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && response.status() !== 200) chunkFailures.push(`${response.status()} ${response.url()}`);
  });

  const response = await page.goto("/github", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
  await expect(page.getByText(/not configured/i).first()).toBeVisible();
  expect(pageErrors.filter((message) => /ChunkLoadError|Loading chunk/i.test(message))).toEqual([]);
  expect(chunkFailures).toEqual([]);
  expect(await page.locator('link[rel="stylesheet"]').count()).toBeGreaterThan(0);
  expect(await page.locator('script[src*="/_next/static/"]').count()).toBeGreaterThan(0);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "GitHub", exact: true })).toBeVisible();
  expect(pageErrors.filter((message) => /ChunkLoadError|Loading chunk/i.test(message))).toEqual([]);
  expect(chunkFailures).toEqual([]);
});

test("GitHub status failure leaves the workspace styled and exposes retry", async ({ page }) => {
  await mockApi(page);
  await page.route("http://127.0.0.1:4000/integrations/github/status", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "GITHUB_NOT_CONFIGURED", message: "GitHub is unavailable." }),
  }));
  await page.goto("/github");
  await expect(page.getByText("Unable to check GitHub connection.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
});