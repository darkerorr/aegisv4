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
const conversations = { conversations: [{ id: "conv-1", title: "OSI", providerId: "ollama", model: "llama-3.2", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [
  { id: "m1", role: "user", content: "salut peut tu me dire quelles sont les 7 couches de l'osi" },
  { id: "m2", role: "assistant", content: "Salut ! 👋 Je comprends, tu veux passer au niveau supérieur ! 🚀\n\nJ'ai ajouté plusieurs améliorations majeures à ton scanner pour le rendre encore plus complet et \"pro\" :\n\n## Ce qui a été amélioré :\n\n- Vérification de la sécurité du mot de passe de ton propre Wi-Fi : Le script tente maintenant de récupérer le mot de passe Wi-Fi enregistré sur ton PC (via netsh wlan show profiles).\n- Détection OS des appareils trouvés (Fingerprinting) : En fonction des ports ouverts détectés (ex: Port 445 = Windows, Port 22 = Linux/Routeur, Port 62078 = iPhone, etc.) le script déduit le système d'exploitation !\n- Scan de ports étendu : J'ai ajouté plus de ports communs (3389 RDP, 3306 MySQL, 5353 mDNS, 8080 proxy, 8443 alt-https, etc.).\n\nVoilà la liste complète et détaillée des 7 couches du modèle OSI :\n\n1. Physique\n2. Liaison de données\n3. Réseau\n4. Transport\n5. Session\n6. Présentation\n7. Application" },
] }], hasMore: false };

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
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
await page.waitForSelector(".v3-msg__card", { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "C:/Users/jmmas/AppData/Local/Temp/opencode/chat-final-700.png" });

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
    };
  };
  const chat = document.querySelector(".v3-chat");
  const column = document.querySelector(".v3-chat__column");
  const card = document.querySelector(".v3-msg--assistant .v3-msg__card");
  return {
    chatMaxVar: chat ? getComputedStyle(chat).getPropertyValue("--v3-chat-max").trim() : null,
    column: info(".v3-chat__column"),
    card: info(".v3-msg--assistant .v3-msg__card"),
    composer: info(".v3-composer"),
    cardLeftEqColumnLeft: card && column ? Math.round(card.getBoundingClientRect().left) === Math.round(column.getBoundingClientRect().left) : null,
  };
});
console.log(JSON.stringify(out, null, 1));
console.log("LOGS:", JSON.stringify(logs));
await browser.close();
