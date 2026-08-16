import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("project chat workflows start, move and remove conversations through the API", async ({ page }) => {
  await mockApi(page);
  let linked = false;
  const project = () => ({ id: "project-1", userId: "u1", name: "Aegis Project", description: "Validation", defaultModel: null, instructions: "", githubRepository: "", conversationCount: linked ? 1 : 0, conversations: linked ? [{ id: "conv-1", title: "Launch narrative", providerId: "nvidia", model: "deepseek-r1", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [] }] : [] });
  await page.route("http://127.0.0.1:4000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/projects/project-1") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ project: project() }) });
    if (url.pathname === "/projects/project-1/conversations/conv-1") {
      linked = route.request().method() === "POST";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.fallback();
  });

  await page.goto("/projects/project-1");
  await expect(page.getByRole("heading", { name: "Aegis Project", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chats", exact: true }).click();
  await expect(page.getByRole("link", { name: /Start chat in project/ })).toHaveAttribute("href", "/chat?projectId=project-1");
  await page.getByLabel("Existing conversation").selectOption("conv-1");
  await page.getByRole("button", { name: "Move to project" }).click();
  await expect(page.getByRole("link", { name: /Launch narrative/ })).toBeVisible();
  await page.getByRole("button", { name: "Remove Launch narrative from project" }).click();
  await expect(page.getByText("No project chats")).toBeVisible();
});