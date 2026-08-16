import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:4000";

async function register() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `settings-${suffix}@example.test`;
  const password = "Settings-password-123!";
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3000" },
    body: JSON.stringify({ email, password, displayName: "Settings test" }),
  });
  expect(res.status).toBe(201);
  const setCookie = res.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  return { email, cookie };
}

test("profile settings persist language after save and reload", async ({ page, context }) => {
  const { cookie } = await register();
  await context.addCookies([
    { name: cookie.split("=")[0], value: cookie.split("=").slice(1).join("="), domain: "127.0.0.1", path: "/", httpOnly: true },
  ]);

  await page.goto("/account", { waitUntil: "networkidle" });
  const select = page.locator('select[name="language"]');
  await expect(select).toBeVisible();
  expect(await select.inputValue()).toBe("en");

  await select.selectOption("fr");
  await page.getByRole("button", { name: /Save profile/i }).click();
  await expect(page.getByRole("button", { name: /Saved/i })).toBeVisible({ timeout: 10_000 });
  await expect(select).toHaveValue("fr", { timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await expect(select).toHaveValue("fr", { timeout: 10_000 });
});
