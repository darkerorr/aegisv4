import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./helpers";

const screenshots = "test-results/screenshots";

async function assertCleanPage(page: Page, path: string) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("401")) problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page: ${error.message}`));
  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response?.status()).toBeLessThan(400);
  expect(problems).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
});

test("download exposes real artifacts, integrity and copyable CLI", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await assertCleanPage(page, "/download");
  await expect(page.getByRole("heading", { name: /Aegis on your machine/i })).toBeVisible();
  const manifest = await page.request.get("/releases/release-manifest.json");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.current.version).toBe("0.3.0");
  expect(body.current.platforms["windows-x64"].artifacts.nsis.sha256).toMatch(/^[a-f0-9]{64}$/);
  const download = page.getByRole("link", { name: /Download for Windows/i });
  await expect(download).toHaveAttribute("href", /Aegis%20App_0\.3\.0_x64-setup\.exe/);
  await expect(page.getByText("Not code-signed", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${screenshots}/download-hero.png`, fullPage: false });
  await page.locator("#installers").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshots}/download-installers.png`, fullPage: false });
  await page.locator("#cli").scrollIntoViewIfNeeded();
  const cli = page.locator("#cli");
  await expect(cli.getByText("npm install -g @aegis/cli", { exact: false }).first()).toBeVisible();
  await cli.getByRole("button", { name: /Copy: npm install/i }).click();
  await expect(cli.getByRole("button", { name: /Copy: npm install/i })).toContainText("Copied");
  await page.screenshot({ path: `${screenshots}/download-cli.png`, fullPage: false });
});

test("download remains actionable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCleanPage(page, "/download");
  await expect(page.getByRole("link", { name: /Download for Windows/i })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/download-mobile.png`, fullPage: false });
});

test("docs provides indexed search, articles, TOC and code copy", async ({ page }) => {
  await assertCleanPage(page, "/docs");
  await expect(page.getByRole("heading", { name: /Build confidently/i })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/docs-home.png`, fullPage: false });
  await page.getByRole("button", { name: /Search docs/i }).click();
  const search = page.getByRole("dialog", { name: "Search documentation" });
  await search.getByRole("textbox").fill("Gmail permission");
  await expect(search.getByRole("link", { name: /Gmail/i })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/docs-search.png`, fullPage: false });
  await search.getByRole("link", { name: /Gmail/i }).click();
  await expect(page).toHaveURL(/\/docs\/integrations\/gmail/);
  await expect(page.getByRole("heading", { name: "Gmail access", exact: true })).toBeVisible();
  await expect(page.getByText("On this page", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/docs-article.png`, fullPage: false });
});

test("docs mobile exposes its navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCleanPage(page, "/docs");
  await page.getByRole("button", { name: /Browse docs/i }).click();
  await expect(page.getByRole("navigation", { name: "Documentation" }).last()).toBeVisible();
  await page.screenshot({ path: `${screenshots}/docs-mobile.png`, fullPage: false });
});

test("privacy shows explicit data paths and a structured policy", async ({ page }) => {
  await assertCleanPage(page, "/privacy");
  await expect(page.getByRole("heading", { name: /Clear boundaries/i })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/privacy-hero.png`, fullPage: false });
  await page.getByRole("tab", { name: "Gmail" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Selected email data");
  await expect(page.getByRole("tabpanel")).toContainText("selected model");
  await page.screenshot({ path: `${screenshots}/privacy-data-flow.png`, fullPage: false });
  await page.locator("#policy").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
  await expect(page.getByText("Legal information not configured.", { exact: false })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/privacy-policy.png`, fullPage: false });
});

test("privacy and every legal disclosure are responsive and honest", async ({ page }) => {
  for (const route of ["/legal", "/terms", "/cookies", "/subprocessors", "/security"]) {
    await assertCleanPage(page, route);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCleanPage(page, "/privacy");
  await expect(page.getByRole("heading", { name: /Clear boundaries/i })).toBeVisible();
  await page.screenshot({ path: `${screenshots}/privacy-mobile.png`, fullPage: false });
});
