import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("an authenticated session is shared by workspace and landing", async ({ page }) => {
  await mockApi(page, { auth: "authenticated" });
  await page.goto("/chat");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await expect(nav.getByRole("button", { name: /Open account menu for Aegis Studio/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open your workspace/ })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/home-authenticated.png" });

  await page.reload();
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await page.goto("/chat");
  await page.goBack();
  await expect(nav.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await page.goto("/login");
  await page.goBack();
  await expect(nav.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/login/);
  await page.goBack();
  await expect(nav.getByRole("link", { name: "Open workspace" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/hero-after-back-navigation.png" });

  const newTab = await page.context().newPage();
  await mockApi(newTab, { auth: "authenticated" });
  await newTab.goto("/");
  await expect(newTab.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Open workspace" })).toBeVisible();
  await newTab.close();
});

test("an anonymous landing exposes sign-in without layout shift", async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Start free" })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/home-anonymous.png" });
});

test("a network failure does not masquerade as a signed-out session", async ({ page }) => {
  await mockApi(page, { auth: "error" });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("button", { name: /Session unavailable/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("the Hero owns stable dimensions and survives repeated reloads", async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const missingAssets: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    const isExpectedAnonymousProbe = message.text().includes("401 (Unauthorized)");
    if (message.type() === "error" && !isExpectedAnonymousProbe) consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === "http://127.0.0.1:3000" && response.status() === 404) missingAssets.push(url.pathname);
  });
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.goto("/");
    const container = page.getByTestId("hero-3d-container").filter({ visible: true });
    await expect(container).toBeVisible();
    await expect.poll(async () => container.getAttribute("data-scene-state")).toMatch(/ready|fallback/);
    const box = await container.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(300);
  }
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(missingAssets).toEqual([]);
  await page.screenshot({ path: "test-results/screenshots/hero-3d-loaded.png" });
});

test("a lost WebGL context falls back and restores without a blank region", async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
  await page.goto("/");
  const container = page.getByTestId("hero-3d-container").filter({ visible: true });
  await expect(container).toHaveAttribute("data-scene-state", "ready");
  const canvas = page.getByTestId("hero-3d-canvas").filter({ visible: true }).locator("canvas");
  await canvas.dispatchEvent("webglcontextlost");
  await expect(container).toHaveAttribute("data-scene-state", "fallback");
  await expect(page.getByTestId("hero-3d-fallback").filter({ visible: true })).toBeVisible();
  await canvas.dispatchEvent("webglcontextrestored");
  await expect(container).toHaveAttribute("data-scene-state", "ready");
});

test("reduced motion retains the full static Aegis visual", async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("hero-3d-container").filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId("hero-3d-fallback").or(page.getByTestId("hero-3d-canvas")).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/hero-reduced-motion.png" });
});

test("WebGL unavailable keeps a branded fallback instead of an empty Hero", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await mockApi(page, { auth: "anonymous" });
  await page.goto("/");
  await expect(page.getByTestId("hero-3d-fallback").filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId("hero-3d-canvas")).toHaveCount(0);
  await page.screenshot({ path: "test-results/screenshots/hero-3d-fallback.png" });
});

test("mobile keeps a dimensioned Aegis visual", async ({ page }) => {
  await mockApi(page, { auth: "anonymous" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const container = page.getByTestId("hero-3d-container").filter({ visible: true });
  await expect(container).toBeVisible();
  const box = await container.boundingBox();
  expect(box?.height).toBeGreaterThan(300);
  await expect(page.getByTestId("hero-3d-fallback").or(page.getByTestId("hero-3d-canvas")).filter({ visible: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/hero-mobile.png" });
});
