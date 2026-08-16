import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:4000";
const testUser = { id: "u1", email: "design@aegis.local", displayName: "Aegis Studio", emailVerified: true, preferences: {} };
const conversations = { conversations: [{ id: "conv-1", title: "Launch narrative", providerId: "nvidia", model: "deepseek-r1", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [{ id: "m1", role: "user", content: "Sharpen the positioning." }, { id: "m2", role: "assistant", content: "Lead with protected choice, not model count." }] }], hasMore: false };

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route(`${API}/**`, async (route) => {
  const path = new URL(route.request().url()).pathname;
  const headers = { "content-type": "application/json", "access-control-allow-origin": BASE, "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  if (path === "/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: testUser }) });
  if (path === "/models" || path === "/models/refresh") return route.fulfill({ status: 200, headers, body: JSON.stringify({ models: [] }) });
  if (path === "/providers") return route.fulfill({ status: 200, headers, body: JSON.stringify({ providers: [] }) });
  if (path === "/conversations") return route.fulfill({ status: 200, headers, body: JSON.stringify(conversations) });
  if (path === "/conversations/conv-1") return route.fulfill({ status: 200, headers, body: JSON.stringify({ conversation: conversations.conversations[0] }) });
  return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
});

await page.goto(`${BASE}/chat/conv-1`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
try {
  await page.waitForTimeout(0);
  
} catch (e) { console.log("no click"); }
const dump = await page.evaluate(() => {
  const main = document.querySelector("#main");
  const chat = document.querySelector(".v3-chat, .chat-workspace, main, section");
  const out = { url: location.href, mainClasses: main ? main.className : null };
  const all = Array.from(document.querySelectorAll("div,section,article,main")).filter((el) => {
    const t = el.className;
    return typeof t === "string" && /(msg|chat|composer|conversation|scroll|column|bubble|card)/i.test(t);
  }).slice(0, 60).map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, cls: String(el.className).slice(0, 90), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
  });
  return { url: location.href, mainClasses: main ? main.className : null, chat: chat ? chat.className : null, els: all };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();