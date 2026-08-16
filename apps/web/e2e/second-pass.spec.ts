import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("chat research activity remains compact across desktop and mobile widths", async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("aegis.onboarding.v1", "1"); });
  await mockApi(page);
  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    const events = [
      ["message.started", { conversationId: "conv-1", providerId: "nvidia", model: "deepseek-r1" }],
      ["tool.started", { tool: "web.search", label: "Searching", query: "Next.js webpack error", activityId: "search-1" }],
      ["tool.completed", { tool: "web.search", sourceCount: 1, resultCount: 1, label: "Found 1 result", query: "Next.js webpack error", activityId: "search-1" }],
      ["tool.started", { tool: "web.readPage", label: "Reading Next.js docs", activityId: "page-1", url: "https://nextjs.org/docs", title: "Next.js Documentation", domain: "nextjs.org", site: "Next.js" }],
      ["tool.completed", { tool: "web.readPage", sourceCount: 1, label: "Read Next.js docs", activityId: "page-1", url: "https://nextjs.org/docs", title: "Next.js Documentation", domain: "nextjs.org", site: "Next.js" }],
      ["web.results", { query: "Next.js webpack error", results: [{ title: "Next.js Documentation", url: "https://nextjs.org/docs", snippet: "Official Next.js documentation.", rank: 1, domain: "nextjs.org", site: "Next.js", sourceType: "official" }] }],
      ["message.delta", { delta: "Validated source.\n\n```ts\nconst answer = true;\n```" }],
      ["message.completed", { conversationId: "conv-1", messageId: "m3" }],
    ] as const;
    const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });
  await page.goto("/chat/conv-1");
  await page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ }).click();
  await page.getByRole("button", { name: /DeepSeek R1/ }).click();
  await page.getByLabel("Message Aegis").fill("Next.js webpack error");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("nextjs.org", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Validated source.")).toBeVisible();
  await expect(page.locator("pre code").filter({ hasText: "const answer" })).toBeVisible();
  const sourceLink = page.locator("a.v3-source-card__title").first();
  await expect(sourceLink).toHaveAttribute("href", "https://nextjs.org/docs");
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", /noopener/);
  const popupPromise = page.waitForEvent("popup");
  await sourceLink.click();
  const popup = await popupPromise;
  expect(popup.url()).toBe("https://nextjs.org/docs");
  await popup.close();
  for (const width of [1593, 1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.screenshot({ path: `test-results/screenshots/second-pass-chat-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test("workspace path connection opens the real IDE surface", async ({ page }) => {
  await mockApi(page);
  let connected = false;
  const workspace = { id: "workspace-aegis", root: "C:\\Users\\jmmas\\Music\\Aegis", name: "Aegis", mode: "restricted", trustedAt: "2026-08-12T10:00:00Z", projectType: "Next.js", fileCount: 3 };
  const tree = [
    { name: "apps", relativePath: "apps", type: "directory" as const },
    { name: "package.json", relativePath: "package.json", type: "file" as const, size: 120 },
    { name: "README.md", relativePath: "README.md", type: "file" as const, size: 80 },
    { name: "ChatView.tsx", relativePath: "apps/web/ChatView.tsx", type: "file" as const, size: 240 },
  ];
  await page.route("http://127.0.0.1:4000/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (url.pathname === "/work/status") return json({ available: true, service: "aegis-local-agent", health: { service: "aegis-local-agent" }, workspaces: connected ? [workspace] : [] });
    if (url.pathname === "/work/workspaces" && method === "GET") return json({ workspaces: connected ? [workspace] : [] });
    if (url.pathname === "/work/workspaces" && method === "POST") { connected = true; return json({ workspace }, 201); }
    if (url.pathname.endsWith("/tree")) return json({ tree });
    if (url.pathname.endsWith("/file") && method === "GET") return json({ path: url.searchParams.get("path"), content: "{\n  \"name\": \"aegis\"\n}\n", size: 28 });
    if (url.pathname.endsWith("/file") && method === "POST") return json({ ok: true });
    if (url.pathname.endsWith("/undo")) return json({ ok: true, relativePath: "package.json" });
    return route.continue();
  });
  await page.goto("/work");
  await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0);
  await page.getByLabel("Chemin du dossier").fill("C:\\Users\\jmmas\\Music\\Aegis");
  await page.getByRole("button", { name: "Trust" }).click();
  await expect(page.locator(".work-topbar__workspace")).toHaveText("Aegis");
  await page.keyboard.press("Control+P");
  await expect(page.locator(".work-drawer")).toBeVisible();
  await page.locator(".work-drawer .work-tree").getByText("package.json", { exact: true }).click();
  await expect(page.getByLabel("Éditer package.json")).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/second-pass-workspace.png", fullPage: true });
});

test("chat renders media links: youtube card, framed image and external link", async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("aegis.onboarding.v1", "1"); });
  await mockApi(page);
  await page.route("http://127.0.0.1:4000/chat/stream", async (route) => {
    const events = [
      ["message.started", { conversationId: "conv-1", providerId: "nvidia", model: "deepseek-r1" }],
      ["message.delta", { delta: "La bande-annonce : https://youtu.be/dQw4w9WgXcQ\n\n![Affiche](https://example.com/poster.png)\n\nPlus d'infos : [Site officiel](https://example.com)" }],
      ["message.completed", { conversationId: "conv-1", messageId: "m3" }],
    ] as const;
    const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });
  await page.goto("/chat/conv-1");
  await page.getByRole("button", { name: /Select a model|Loading models|Llama 3.2/ }).click();
  await page.getByRole("button", { name: /DeepSeek R1/ }).click();
  await page.getByLabel("Message Aegis").fill("Parle-moi du film");
  await page.getByRole("button", { name: "Send message" }).click();

  // A bare YouTube URL becomes an embed-style card, not just a link.
  const video = page.locator(".v3-md-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("href", "https://youtu.be/dQw4w9WgXcQ");
  await expect(video.locator(".v3-md-video__thumb")).toBeVisible();

  // Markdown images are framed and open in a new tab.
  await expect(page.locator(".v3-md-img img")).toHaveAttribute("src", "https://example.com/poster.png");

  // Regular links keep the external-link styling.
  await expect(page.locator(".v3-md-link").first()).toHaveAttribute("href", "https://example.com");
});
