import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:4000";

const testUser = { id: "u1", email: "design@aegis.local", displayName: "Aegis Studio", emailVerified: true, preferences: {} };
const models = { models: [
  { id: "llama-3.2", providerId: "ollama", name: "Llama 3.2", type: "chat", active: true, providerName: "Ollama", providerKind: "ollama", local: true, favorite: true, visible: true, available: true, contextLength: 131072, capabilities: ["chat", "tools"] },
  { id: "deepseek-r1", providerId: "nvidia", name: "DeepSeek R1", type: "chat", active: true, providerName: "NVIDIA", providerKind: "nvidia-nim", local: false, favorite: false, visible: true, available: true, contextLength: 128000, capabilities: ["reasoning", "tools"] },
] };
const providers = { providers: [
  { id: "ollama", providerKey: "ollama", kind: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434", active: true, hasApiKey: false, defaultModel: "llama-3.2" },
  { id: "nvidia", providerKey: "nvidia-nim", kind: "nvidia-nim", name: "NVIDIA", baseUrl: "https://integrate.api.nvidia.com/v1", active: true, hasApiKey: true, maskedApiKey: "nv••••••01", defaultModel: "deepseek-r1" },
] };
const conversations = { conversations: [{ id: "conv-1", title: "Launch narrative", providerId: "nvidia", model: "deepseek-r1", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [
  { id: "m1", role: "user", content: "Sharpen the positioning.\n\nPlease give me a long response with multiple paragraphs, a list and a code block so the message is wide." },
  { id: "m2", role: "assistant", content: "# Lead with protected choice\n\nParagraph one: Aegis is a private, local-first AI workspace that connects every kind of intelligence, from open-weight local models to leading cloud providers. Paragraph two continues the theme and keeps going to demonstrate text wrapping across the full column.\n\n## Bullet list\n\n- First bullet about privacy\n- Second bullet about choice\n- Third bullet about control\n\n```python\ndef hello():\n    print(\"code block inside the message card\")\n    return 42\n```\n\nClosing paragraph that ends the assistant response." },
] }], hasMore: false };

const job = async (viewport) => {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport });
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const headers = { "content-type": "application/json", "access-control-allow-origin": BASE, "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/me") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: testUser }) });
    if (path === "/models" || path === "/models/refresh") return route.fulfill({ status: 200, headers, body: JSON.stringify(models) });
    if (path === "/providers") return route.fulfill({ status: 200, headers, body: JSON.stringify(providers) });
    if (path === "/conversations") return route.fulfill({ status: 200, headers, body: JSON.stringify(conversations) });
    if (path === "/conversations/conv-1") return route.fulfill({ status: 200, headers, body: JSON.stringify({ conversation: conversations.conversations[0] }) });
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });
  });

  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  try {
    await page.getByText("Launch narrative", { exact: true }).click();
    await page.waitForURL(/conv-1/, { timeout: 15000 });
  } catch (e) {
    console.log("(no history click — going direct)");
  }
  await page.waitForSelector(".v3-msg__card, .v3-chat__column", { timeout: 30000 }).catch(async () => {
    console.log("PAGE URL:", page.url());
    const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 600) : "NO BODY");
    console.log("BODY TEXT:", text.replace(/\n+/g, " | "));
    await page.screenshot({ path: "C:/Users/jmmas/AppData/Local/Temp/opencode/chat-debug.png" });
    throw new Error("selector missing");
  });
  await page.waitForTimeout(900);

  const results = await page.evaluate(() => {
    const sel = (s) => document.querySelector(s);
    const info = (el, label) => {
      if (!el) return { label, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        label,
        left: Math.round(r.left * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        widthCSS: cs.width,
        maxWidth: cs.maxWidth,
        minWidth: cs.minWidth,
        paddingL: cs.paddingLeft,
        paddingR: cs.paddingRight,
        marginL: cs.marginLeft,
        marginR: cs.marginRight,
        position: cs.position,
        leftCSS: cs.left,
        rightCSS: cs.right,
        transform: cs.transform,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
      };
    };
    return [
      info(sel("body"), "body"),
      info(sel(".v3-workspace"), "v3-workspace"),
      info(sel("#main, .v3-main"), "v3-main"),
      info(sel(".v3-chat"), "v3-chat"),
      info(sel(".v3-chat__scroll"), "v3-chat__scroll"),
      info(sel(".v3-chat__column"), "v3-chat__column"),
      info(sel(".v3-msg--assistant"), "v3-msg(assistant row)"),
      info(sel(".v3-msg--assistant .v3-msg__card"), "v3-msg__card"),
      info(sel(".v3-msg--user"), "v3-msg(user row)"),
      info(sel(".v3-msg--user .v3-msg__bubble-group"), "v3-msg__bubble-group"),
      info(sel(".v3-chat__footer"), "v3-chat__footer"),
      info(sel(".v3-composer-dock"), "v3-composer-dock"),
      info(sel(".v3-composer"), "v3-composer"),
      info(sel(".v3-composer__disclaimer"), "v3-composer__disclaimer"),
    ];
  });

  await page.screenshot({ path: "C:/Users/jmmas/AppData/Local/Temp/opencode/chat-measure.png" });
  await browser.close();
  return results;
};

for (const vp of [{ width: 1920, height: 1080 }, { width: 1600, height: 900 }]) {
  console.log(`\n========== VIEWPORT ${vp.width}x${vp.height} ==========`);
  const rows = await job(vp);
  for (const r of rows) console.log(JSON.stringify(r));
}