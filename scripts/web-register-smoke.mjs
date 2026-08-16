import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const debuggingPort = 9333;
const profileDir = join(tmpdir(), `aegis-edge-${Date.now()}`);
const targetUrl = "http://127.0.0.1:3000/register";
const email = `browser-${Date.now()}@example.test`;
const password = "AegisBrowser123!";
const edge = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1440,900",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore" });

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function poll(fn, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) { lastError = error; }
    await delay(150);
  }
  throw lastError || new Error("Timed out while waiting for browser state.");
}

let socket;
const pending = new Map();
const listeners = new Set();
let nextId = 0;
function send(method, params = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed.");
  return response.result.value;
}

try {
  const page = await poll(async () => {
    const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
    const pages = await response.json();
    return pages.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
  });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message));
      else command.resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });

  const requestMethods = new Map();
  const network = [];
  const failures = [];
  const browserErrors = [];
  const consoleMessages = [];
  listeners.add((message) => {
    if (message.method === "Network.requestWillBeSent") {
      requestMethods.set(message.params.requestId, message.params.request.method);
      if (message.params.request.url.startsWith("http://127.0.0.1:4000/")) network.push({ stage: "request", method: message.params.request.method, url: message.params.request.url });
    }
    if (message.method === "Network.responseReceived") {
      const { response, requestId } = message.params;
      if (response.url.startsWith("http://127.0.0.1:4000/")) network.push({ stage: "response", method: requestMethods.get(requestId) || "GET", url: response.url, status: response.status });
    }
    if (message.method === "Network.loadingFailed") failures.push({ requestId: message.params.requestId, errorText: message.params.errorText, blockedReason: message.params.blockedReason });
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails?.text || "Runtime exception");
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
    if (message.method === "Runtime.consoleAPICalled") consoleMessages.push({ type: message.params.type, values: message.params.args.map((arg) => arg.value ?? arg.description) });
  });
  await send("Network.enable");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url: targetUrl });
  await poll(async () => (await evaluate("Boolean(document.querySelector('form'))")) === true);
  await delay(2_000);
  const startupState = await evaluate("({ ready: document.readyState, text: document.body?.innerText || '' })");
  const directHealth = await evaluate(`fetch("http://127.0.0.1:4000/health", { credentials: "include" }).then(async response => ({ status: response.status, body: await response.json() })).catch(error => ({ error: String(error) }))`);
  console.log(JSON.stringify({ startup: startupState, directHealth, network, failures, browserErrors, consoleMessages }, null, 2));
  if (!startupState.text.includes("Aegis services connected")) throw new Error("The Register page did not classify /health as connected.");

  const filled = await evaluate(`(() => {
    const setValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const displayName = document.querySelector('input[autocomplete="name"]');
    const emailInput = document.querySelector('input[autocomplete="email"]');
    const passwords = [...document.querySelectorAll('input[autocomplete="new-password"]')];
    if (!displayName || !emailInput || passwords.length !== 2 || !document.querySelector("form")) return false;
    setValue(displayName, "Browser Smoke Test");
    setValue(emailInput, ${JSON.stringify(email)});
    setValue(passwords[0], ${JSON.stringify(password)});
    setValue(passwords[1], ${JSON.stringify(password)});
    document.querySelector("form").requestSubmit();
    return true;
  })()`);
  if (!filled) throw new Error("Register form controls were not found.");

  await poll(async () => (await evaluate("location.pathname")) === "/chat", 30_000);
  await delay(750);
  const me = await evaluate(`fetch("http://127.0.0.1:4000/auth/me", { credentials: "include" }).then(async response => ({ status: response.status, body: await response.json() }))`);
  const createdCookies = (await send("Network.getAllCookies")).cookies;
  const createdSessionCookie = createdCookies.find((entry) => entry.name === "aegis_session" && entry.domain === "127.0.0.1");

  await send("Page.reload", { ignoreCache: true });
  await poll(async () => (await evaluate("location.pathname")) === "/chat");
  await delay(600);
  const meAfterReload = await evaluate(`fetch("http://127.0.0.1:4000/auth/me", { credentials: "include" }).then(async response => ({ status: response.status, body: await response.json() }))`);
  const logout = await evaluate(`fetch("http://127.0.0.1:4000/auth/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } }).then(async response => ({ status: response.status, body: await response.json() }))`);
  const meAfterLogout = await evaluate(`fetch("http://127.0.0.1:4000/auth/me", { credentials: "include" }).then(async response => ({ status: response.status, body: await response.json() }))`);

  await send("Page.navigate", { url: "http://127.0.0.1:3000/login" });
  await poll(async () => {
    const state = await evaluate("({ form: Boolean(document.querySelector('form')), text: document.body?.innerText || '' })");
    return state.form && state.text.includes("Aegis services connected");
  });
  const loginFilled = await evaluate(`(() => {
    const setValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const emailInput = document.querySelector('input[autocomplete="email"]');
    const passwordInput = document.querySelector('input[autocomplete="current-password"]');
    if (!emailInput || !passwordInput || !document.querySelector("form")) return false;
    setValue(emailInput, ${JSON.stringify(email)});
    setValue(passwordInput, ${JSON.stringify(password)});
    document.querySelector("form").requestSubmit();
    return true;
  })()`);
  if (!loginFilled) throw new Error("Login form controls were not found.");
  await poll(async () => (await evaluate("location.pathname")) === "/chat", 30_000);
  await delay(1_500);
  const finalState = await evaluate("({ path: location.pathname, text: document.body?.innerText || '', composer: Boolean(document.querySelector('textarea[placeholder=\"Ask Aegis...\"]')), title: document.title })");
  const meAfterLogin = await evaluate(`fetch("http://127.0.0.1:4000/auth/me", { credentials: "include" }).then(async response => ({ status: response.status, body: await response.json() }))`);
  const settledRequestIndex = network.length;
  await delay(2_500);
  const requestsAfterSettle = network.slice(settledRequestIndex).filter((entry) => entry.stage === "request" && /\/(providers|models|conversations)(?:\/|$)/.test(new URL(entry.url).pathname));
  const reactEffectErrors = [
    ...browserErrors,
    ...consoleMessages.flatMap((entry) => entry.values.map(String)),
  ].filter((message) => /useEffect must not return|must not return anything|maximum update depth|state update on an unmounted|can't perform a react state update/i.test(message));
  const finalCookies = (await send("Network.getAllCookies")).cookies;
  const sessionCookie = finalCookies.find((entry) => entry.name === "aegis_session" && entry.domain === "127.0.0.1");
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const artifactDir = resolve("artifacts");
  await mkdir(artifactDir, { recursive: true });
  const screenshotPath = join(artifactDir, "web-register-smoke.png");
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

  const relevant = network.filter((entry) => /\/(health|auth\/(?:register|login|logout|me))$/.test(new URL(entry.url).pathname));
  const hasHealth = relevant.some((entry) => entry.stage === "response" && entry.url.endsWith("/health") && entry.status === 200);
  const hasRegister = relevant.some((entry) => entry.stage === "response" && entry.method === "POST" && entry.url.endsWith("/auth/register") && entry.status === 201);
  const hasMe = relevant.some((entry) => entry.stage === "response" && entry.url.endsWith("/auth/me") && entry.status === 200);
  const hasLogin = relevant.some((entry) => entry.stage === "response" && entry.method === "POST" && entry.url.endsWith("/auth/login") && entry.status === 200);
  const hasLogout = relevant.some((entry) => entry.stage === "response" && entry.method === "POST" && entry.url.endsWith("/auth/logout") && entry.status === 200);
  if (!hasHealth || !hasRegister || !hasMe || !hasLogin || !hasLogout || me.status !== 200 || meAfterReload.status !== 200 || logout.status !== 200 || meAfterLogout.status !== 401 || meAfterLogin.status !== 200 || !createdSessionCookie || !sessionCookie || !finalState.composer || finalState.text.includes("Console Error") || reactEffectErrors.length || requestsAfterSettle.length) throw new Error(`Browser flow incomplete: ${JSON.stringify({ relevant, meStatus: me.status, reloadStatus: meAfterReload.status, logoutStatus: logout.status, afterLogoutStatus: meAfterLogout.status, loginStatus: meAfterLogin.status, hasCookie: Boolean(sessionCookie), finalState, reactEffectErrors, requestsAfterSettle })}`);
  console.log(JSON.stringify({
    ok: true,
    finalPath: "/chat",
    email,
    network: relevant,
    me: { status: me.status, displayName: me.body?.user?.displayName },
    refresh: { status: meAfterReload.status, remainedAuthenticated: true },
    logout: { status: logout.status, meAfterLogout: meAfterLogout.status },
    login: { status: meAfterLogin.status, redirectedTo: "/chat" },
    finalUi: { path: finalState.path, chatComposerVisible: finalState.composer, errorOverlay: finalState.text.includes("Console Error") },
    effects: { reactErrors: reactEffectErrors, repeatedRequestsAfterSettle: requestsAfterSettle },
    cookie: { domain: sessionCookie.domain, httpOnly: sessionCookie.httpOnly, secure: sessionCookie.secure, sameSite: sessionCookie.sameSite, session: "present" },
    screenshot: screenshotPath,
  }, null, 2));
} finally {
  try { socket?.close(); } catch { /* ignore */ }
  edge.kill();
}
