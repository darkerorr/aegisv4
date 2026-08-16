import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:4000";
const testUser = { id: "u1", email: "design@aegis.local", displayName: "Aegis Studio", emailVerified: true, preferences: {} };
const models = { models: [
  { id: "llama-3.2", providerId: "ollama", name: "Llama 3.2", type: "chat", active: true, providerName: "Ollama", providerKind: "ollama", local: true, favorite: true, visible: true, available: true, contextLength: 131072, capabilities: ["chat", "tools"] },
] };
const providers = { providers: [
  { id: "ollama", providerKey: "ollama", kind: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434", active: true, hasApiKey: false, defaultModel: "llama-3.2", modelsCount: 1 },
] };
const conversations = { conversations: [{ id: "conv-1", title: "Launch narrative", providerId: "ollama", model: "llama-3.2", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [
  { id: "m1", role: "user", content: "Sharpen the positioning." },
  { id: "m2", role: "assistant", content: "# Lead with protected choice\n\nParagraph one: Aegis is a private, local-first AI workspace that connects every kind of intelligence.\n\n```js\nconst x = 1;\n```" },
] }], hasMore: false };

const browser = await chromium.launch({ channel: "msedge" });

async function measure(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const logs = [];
  page.on("pageerror", (e) => logs.push("PAGEERROR " + String(e).slice(0, 200)));
  await page.addInitScript(() => { localStorage.setItem("aegis.onboarding.v1", "1"); });
  await page.route(`${API}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = { "content-type": "application/json", "access-control-allow-origin": BASE, "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const B = (obj) => route.fulfill({ status: 200, headers, body: JSON.stringify(obj) });
    if (path === "/auth/me") return B({ user: testUser });
    if (path === "/models" || path === "/models/refresh") return B(models);
    if (path === "/providers") return B(providers);
    if (path === "/conversations") return B(conversations);
    if (path === "/conversations/conv-1") return B({ conversation: conversations.conversations[0] });
    return B({ conversations: [], projects: [], integrations: [], providers: [], ok: true });
  });
  await page.goto(`${BASE}/chat/conv-1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const out = await page.evaluate(() => {
    const info = (s) => {
      const el = document.querySelector(s);
      if (!el) return { sel: s, missing: true };
      const b = el.getBoundingClientRect();
      return {
        sel: s,
        left: Math.round(b.left * 10) / 10,
        right: Math.round(b.right * 10) / 10,
        width: Math.round(b.width * 10) / 10,
        center: Math.round((b.left + b.width / 2) * 10) / 10,
      };
    };
    const infoCs = (s) => {
      const el = document.querySelector(s);
      if (!el) return { sel: s, missing: true };
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return {
        sel: s,
        left: Math.round(b.left * 10) / 10,
        right: Math.round(b.right * 10) / 10,
        width: Math.round(b.width * 10) / 10,
        center: Math.round((b.left + b.width / 2) * 10) / 10,
        justifyContent: cs.justifyContent,
        alignSelf: cs.alignSelf,
        widthCSS: cs.width,
        maxWidth: cs.maxWidth,
        marginLeft: cs.marginLeft,
        marginRight: cs.marginRight,
      };
    };
    const lastAssistant = document.querySelector(".v3-msg--assistant:last-of-type .v3-msg__card");
    const lastRow = lastAssistant ? lastAssistant.closest(".v3-msg") : null;
    const column = document.querySelector(".v3-chat__column");
    const lb = lastAssistant ? lastAssistant.getBoundingClientRect() : null;
    const cb = column ? column.getBoundingClientRect() : null;
    const card = document.querySelector(".v3-msg__card");
    return {
      chatMaxVar: getComputedStyle(document.querySelector(".v3-chat")).getPropertyValue("--v3-chat-max").trim(),
      scrollPad: getComputedStyle(document.querySelector(".v3-chat__scroll")).paddingInline,
      dockPad: getComputedStyle(document.querySelector(".v3-composer-dock")).paddingInline,
      cardParent: card ? card.parentElement.className : null,
      lastAssistantLeftEqualsColumnLeft: lb && cb ? Math.round(lb.left * 10) / 10 === Math.round(cb.left * 10) / 10 : null,
      lastAssistantRightEqualsColumnRight: lb && cb ? Math.round(lb.right * 10) / 10 === Math.round(cb.right * 10) / 10 : null,
      columnLeft: cb ? Math.round(cb.left * 10) / 10 : null,
      columnRight: cb ? Math.round(cb.right * 10) / 10 : null,
      lastCardLeft: lb ? Math.round(lb.left * 10) / 10 : null,
      lastCardRight: lb ? Math.round(lb.right * 10) / 10 : null,
      rows: [
        infoCs(".v3-chat__column"),
        infoCs(".v3-msg--assistant:last-of-type"),
        infoCs(".v3-msg--assistant:last-of-type .v3-msg__card"),
        info(".v3-chat"),
        info(".v3-chat__scroll"),
        info(".v3-chat__footer"),
        info(".v3-composer-dock"),
        info(".v3-composer"),
      ],
    };
  });
  console.log(`\n===== VIEWPORT ${width}x${height} =====`);
  console.log(JSON.stringify(out, null, 1));
  console.log("LOGS:", JSON.stringify(logs));
  await page.close();
}

await measure(1593, 900);
await measure(1920, 1080);
await browser.close();
