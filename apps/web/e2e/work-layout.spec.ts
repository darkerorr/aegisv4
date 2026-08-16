import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

const workspace = { id: "workspace-aegis", root: "C:\\Users\\jmmas\\Music\\Aegis", name: "Aegis", mode: "restricted", trustedAt: "2026-08-12T10:00:00Z", projectType: "Next.js", fileCount: 4 };
const emptyWorkspace = { id: "workspace-empty", root: "C:\\tmp\\empty", name: "Empty", mode: "restricted", trustedAt: "2026-08-12T11:00:00Z", projectType: "Unknown", fileCount: 0 };
const tree = [
  { name: "apps", relativePath: "apps", type: "directory" as const },
  { name: "package.json", relativePath: "package.json", type: "file" as const, size: 120 },
  { name: "README.md", relativePath: "README.md", type: "file" as const, size: 80 },
  { name: "ChatView.tsx", relativePath: "apps/web/ChatView.tsx", type: "file" as const, size: 240 },
];

function statusBody(connected: boolean) {
  return {
    available: true,
    service: "aegis-local-agent",
    health: { service: "aegis-local-agent", version: "0.1.0", port: 4150 },
    workspaces: connected ? [workspace, emptyWorkspace] : [],
    agent: {
      process: "online",
      connection: "connected",
      authentication: "authenticated",
      version: "0.1.0",
      port: 4150,
      lastHeartbeat: new Date().toISOString(),
    },
    providers: {
      status: "ready",
      configured: 2,
      enabled: 2,
      ready: true,
      list: [
        { id: "ollama", providerKey: "ollama", kind: "ollama", name: "Ollama", enabled: true, configured: true, defaultModel: "llama-3.2" },
        { id: "nvidia", providerKey: "nvidia-nim", kind: "nvidia-nim", name: "NVIDIA", enabled: true, configured: true, defaultModel: "deepseek-r1" },
      ],
    },
  };
}

async function mockWorkApi(page: import("@playwright/test").Page) {
  await mockApi(page);
  let connected = false;
  await page.route("http://127.0.0.1:4000/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (url.pathname === "/work/status") return json(statusBody(connected));
    if (url.pathname === "/work/workspaces" && method === "GET") return json({ workspaces: connected ? [workspace, emptyWorkspace] : [] });
    if (url.pathname === "/work/workspaces" && method === "POST") { connected = true; return json({ workspace }, 201); }
    if (url.pathname.endsWith("/tree")) return json({ tree: url.pathname.includes("workspace-empty") ? [] : tree });
    if (url.pathname.endsWith("/file") && method === "GET") return json({ path: url.searchParams.get("path"), content: "{\n  \"name\": \"aegis\"\n}\n", size: 28 });
    if (url.pathname.endsWith("/file") && method === "POST") return json({ ok: true });
    if (url.pathname.endsWith("/command") && method === "POST") return json({ command: "git status --short", risk: "safe", exitCode: 0, stdout: " M package.json", stderr: "" });
    if (url.pathname.endsWith("/undo")) return json({ ok: true, relativePath: "package.json" });
    return route.continue();
  });
}

async function settleWorkPage(page: import("@playwright/test").Page) {
  // /work is SSR-streamed under the (workspace) loading.tsx Suspense boundary
  // (#S:0 streaming template). React hydration transiently duplicates the page
  // DOM; wait for the template to be removed so strict locators see the settled tree.
  await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0);
}

async function openWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/work");
  await settleWorkPage(page);
  await expect(page.locator(".work-setup-card")).toHaveCount(1);
  await expect(page.locator(".work-setup-card")).toBeVisible();
  await page.getByLabel("Chemin du dossier").fill("C:\\Users\\jmmas\\Music\\Aegis");
  await page.getByRole("button", { name: "Trust" }).click();
  await expect(page.locator(".work-topbar__workspace")).toHaveText("Aegis");
  await expect(page.locator(".work-hero")).toBeVisible();
}

test("chat-first: single centered column, no IDE panels, no overflow at any width", async ({ page }) => {
  await mockWorkApi(page);
  await openWorkspace(page);

  // The IDE is gone: no sidebar, editor, chat panel, bottom panel or status bar.
  await expect(page.locator(".work-sidebar, .work-center, .work-chat, .work-bottom, .work-statusbar")).toHaveCount(0);
  await expect(page.locator(".work-resizer")).toHaveCount(0);

  // One chat column + one giant composer, minimal header.
  await expect(page.locator(".work-column")).toBeVisible();
  await expect(page.locator(".work-composer-dock .v3-composer")).toBeVisible();
  await expect(page.locator(".work-topbar__brand")).toHaveText("AEGIS");
  await expect(page.getByRole("button", { name: "Files" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.locator(".work-topbar__workspace")).toHaveText("Aegis");
  await expect(page.locator("[data-testid='agent-status']")).toHaveText("Agent online");
  await expect(page.locator(".aegis-model-pill")).toBeVisible();

  for (const width of [1280, 1920, 2560]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : width === 1920 ? 1080 : 1440 });
    await page.waitForTimeout(150);
    const box = await page.evaluate(() => {
      const column = document.querySelector(".work-column");
      const composer = document.querySelector(".work-composer");
      const root = document.querySelector(".work-root");
      if (!column || !composer || !root) return null;
      const c = column.getBoundingClientRect();
      const m = composer.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      return {
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        columnWidth: c.width,
        columnCenter: (c.left + c.right) / 2,
        rootCenter: (r.left + r.right) / 2,
        composerWidth: m.width,
      };
    });
    expect(box!.docOverflow, `document horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(box!.columnWidth, `column constrained at ${width}px`).toBeLessThan(1100);
    expect(Math.abs(box!.columnCenter - box!.rootCenter), `column centered at ${width}px`).toBeLessThan(2);
    expect(box!.composerWidth, `composer aligned with column at ${width}px`).toBeLessThanOrEqual(box!.columnWidth + 2);
    await page.screenshot({ path: `test-results/screenshots/work-chat-${width}.png` });
  }
});

test("files drawer via Ctrl+P opens the live tree, files open in the preview modal", async ({ page }) => {
  await mockWorkApi(page);
  await openWorkspace(page);

  // Drawer is hidden by default.
  await expect(page.locator(".work-drawer")).toHaveCount(0);

  await page.keyboard.press("Control+p");
  await expect(page.locator(".work-drawer")).toBeVisible();
  await expect(page.locator(".work-drawer .work-tree").getByText("package.json", { exact: true })).toBeVisible();

  await page.locator(".work-drawer .work-tree").getByText("package.json", { exact: true }).click();
  await expect(page.locator(".work-preview")).toBeVisible();
  await expect(page.getByLabel("Éditer package.json")).toBeVisible();

  // Escape closes the preview modal.
  await page.keyboard.press("Escape");
  await expect(page.locator(".work-preview")).toHaveCount(0);
});

test("files drawer lets the user switch to an empty workspace and back without getting stuck", async ({ page }) => {
  await mockWorkApi(page);
  await openWorkspace(page);

  await page.keyboard.press("Control+p");
  await expect(page.locator(".work-drawer")).toBeVisible();

  // Both trusted workspaces are offered in the switcher.
  const select = page.locator(".work-drawer__select");
  await expect(select).toBeVisible();
  await expect(select.locator("option")).toHaveCount(2);

  // Switching to the empty workspace shows the actionable empty state.
  await select.selectOption("workspace-empty");
  await expect(page.locator(".work-drawer__body")).toContainText("Ce dossier est vide.");

  // Switching back restores the file tree.
  await select.selectOption("workspace-aegis");
  await expect(page.locator(".work-drawer .work-tree").getByText("package.json", { exact: true })).toBeVisible();
});

test("file preview: light editing, save clears the dirty badge", async ({ page }) => {
  await mockWorkApi(page);
  await openWorkspace(page);

  await page.keyboard.press("Control+p");
  await page.locator(".work-drawer .work-tree").getByText("package.json", { exact: true }).click();
  const textarea = page.getByLabel("Éditer package.json");
  await expect(textarea).toBeVisible();
  await textarea.fill('{\n  "name": "aegis-edited"\n}\n');
  await expect(page.getByText("Non sauvegardé")).toBeVisible();

  await page.getByRole("button", { name: "Sauvegarder" }).click();
  await expect(page.getByText("Non sauvegardé")).toHaveCount(0);
});

test("persisted session restores the chat runs", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("aegis.work.session", JSON.stringify({
      workspaceId: "workspace-aegis",
      openFiles: ["package.json"],
      runs: [{
        prompt: "Lance le build",
        delta: "C'est fait.",
        reasoning: "",
        reasoningOpen: false,
        activity: [{ kind: "file", relativePath: "package.json" }],
        changedFiles: ["package.json"],
        error: null,
        done: true,
        thinking: false,
        startedAt: Date.now(),
        durationMs: 18400,
      }],
      drafts: { "package.json": "{\n  \"name\": \"aegis\"\n}\n" },
      dirtyFiles: [],
    }));
  });
  await mockWorkApi(page);
  await page.goto("/work");
  await settleWorkPage(page);

  // The persisted workspaceId is already trusted, so the chat restores directly
  // without the setup card.
  await expect(page.getByText("Lance le build", { exact: true })).toBeVisible();
  await expect(page.getByText(/Terminé en 18\.4s/)).toBeVisible();
  await expect(page.locator(".work-action--file").getByText("package.json", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/screenshots/work-chat-persisted.png" });
});

test("persisted run renders the file card above the chat text with a red/green diff", async ({ page }) => {
  const before = ["const a = 1;", "const b = 2;", 'console.log("old");'].join("\n");
  const after = ["const a = 1;", "const c = 3;", 'console.log("new");'].join("\n");
  await page.addInitScript(({ before, after }) => {
    localStorage.setItem("aegis.work.session", JSON.stringify({
      workspaceId: "workspace-aegis",
      openFiles: [],
      runs: [{
        prompt: "Corrige l'initialisation",
        delta: "Fichier mis à jour.",
        reasoning: "Je remplace les constantes obsolètes.",
        reasoningOpen: true,
        activity: [{ kind: "file", relativePath: "apps/web/ChatView.tsx", action: "edit", patch: { before, after } }],
        changedFiles: ["apps/web/ChatView.tsx"],
        error: null,
        done: true,
        thinking: false,
        startedAt: Date.now(),
        durationMs: 9200,
      }],
      drafts: {},
      dirtyFiles: [],
    }));
  }, { before, after });
  await mockWorkApi(page);
  await page.goto("/work");
  await settleWorkPage(page);

  // The file card is present, shows the file name, the folder and the stats.
  const card = page.locator(".work-action--file[data-action='edit']");
  await expect(card).toBeVisible();
  await expect(card.locator(".work-action__path")).toHaveText("ChatView.tsx");
  await expect(card.locator(".work-action__dir")).toHaveText("apps/web");
  await expect(card.locator(".work-action__stats").getByText("+2", { exact: true })).toBeVisible();
  await expect(card.locator(".work-action__stats").getByText("−2", { exact: true })).toBeVisible();

  // The diff exposes green added lines and red deleted lines.
  await expect(card.locator(".work-diff__line.is-add")).toHaveCount(2);
  await expect(card.locator(".work-diff__line.is-del")).toHaveCount(2);
  await expect(card.locator(".work-diff__line.is-add").filter({ hasText: "const c = 3;" })).toHaveCount(1);
  await expect(card.locator(".work-diff__line.is-del").filter({ hasText: "const b = 2;" })).toHaveCount(1);
  await expect(card.locator(".work-diff__hunk").first()).toContainText("@@");

  // The card sits ABOVE the reasoning block and the chat text, not below.
  const actionsBox = await page.locator(".work-run__actions").boundingBox();
  const reasonBox = await page.locator(".work-reason").boundingBox();
  const outputBox = await page.locator(".work-run__output").boundingBox();
  expect(actionsBox!.y).toBeLessThan(reasonBox!.y);
  expect(reasonBox!.y).toBeLessThan(outputBox!.y);

  // "Voir" opens the file in the preview modal.
  await card.getByRole("button", { name: "Voir" }).click();
  await expect(page.locator(".work-preview")).toBeVisible();
  await expect(page.getByLabel("Éditer apps/web/ChatView.tsx")).toBeVisible();
});

test("header reports agent offline and shows the offline banner", async ({ page }) => {
  await mockWorkApi(page);
  await page.route("http://127.0.0.1:4000/work/status", async (route) => {
    const body = { ...statusBody(false), agent: { process: "offline", connection: "unreachable", authentication: "none", version: "0.1.0", port: 4150, lastHeartbeat: "" } };
    await route.fulfill({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  });
  await page.goto("/work");
  await settleWorkPage(page);
  await expect(page.locator("[data-testid='agent-status']")).toHaveText("Agent offline");
  await expect(page.getByText(/Local Agent hors ligne/)).toBeVisible();
});