import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:4000";
const testUser = { id: "u1", email: "design@aegis.local", displayName: "Aegis Studio", emailVerified: true, preferences: {} };
const models = { models: [{ id: "llama-3.2", providerId: "ollama", name: "Llama 3.2", type: "chat", active: true, providerName: "Ollama", providerKind: "ollama", local: true, favorite: true, visible: true, available: true, contextLength: 131072, capabilities: ["chat", "tools"] }] };
const providers = { providers: [{ id: "ollama", providerKey: "ollama", kind: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434", active: true, hasApiKey: false, defaultModel: "llama-3.2" }] };
const conversations = { conversations: [{ id: "conv-1", title: "Launch narrative", providerId: "ollama", model: "llama-3.2", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [{ id: "m1", role: "user", content: "Sharpen the positioning." }, { id: "m2", role: "assistant", content: "Lead with protected choice, not model count.\n\n```js\nconst x = 1;\n```" }] }], hasMore: false };

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => { localStorage.setItem("aegis.onboarding.v1", "1"); });
await page.route(`${API}/**`, async (route) => {
  const path = new URL(route.request().url()).pathname;
  const headers = { "content-type": "application/json", "access-control-allow-origin": BASE, "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  if (path === "/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: testUser }) });
  if (path === "/models" || path === "/models/refresh") return route.fulfill({ status: 200, headers, body: JSON.stringify(models) });
  if (path === "/providers") return route.fulfill({ status: 200, headers, body: JSON.stringify(providers) });
  if (path === "/conversations") return route.fulfill({ status: 200, headers, body: JSON.stringify(conversations) });
  if (path === "/conversations/conv-1") return route.fulfill({ status: 200, headers, body: JSON.stringify({ conversation: conversations.conversations[0] }) });
  return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
});

await page.goto(`${BASE}/chat/conv-1`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const body = await page.evaluate(() => ({ text: document.body ? document.body.innerText.slice(0, 800) : "NO BODY", html: document.querySelector("#main") ? document.querySelector("#main").outerHTML.slice(0, 1500) : "no #main" })); console.log("BODY:", body.text.replace(/\n+/g," | ")); console.log("MAIN HTML:", body.html); const dump = await page.evaluate(() => {
  const out = { url: location.href };
  out.els = Array.from(document.querySelectorAll("*")).filter((el) => {
    const t = el.className;
    return typeof t === "string" && /(v3-msg|v3-chat|v3-composer|message|composer)/i.test(t);
  }).slice(0, 90).map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, cls: String(el.className).slice(0, 110), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: "C:/Users/jmmas/AppData/Local/Temp/opencode/chat-conv1.png" });
await browser.close();