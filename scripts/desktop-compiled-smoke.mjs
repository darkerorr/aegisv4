import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const debuggingPort = 9334;
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function poll(fn, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await delay(150);
  }
  throw lastError || new Error("Timed out while waiting for Aegis App.");
}

const page = await poll(async () => {
  const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
  const pages = await response.json();
  return pages.find((entry) => entry.type === "page" && entry.title === "Aegis App");
});
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", rejectOpen, { once: true });
});
let id = 0;
const pending = new Map();
const consoleErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const command = pending.get(message.id); pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message)); else command.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") consoleErrors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || "Runtime exception");
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
});
function send(method, params = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const commandId = ++id; pending.set(commandId, { resolve: resolveCommand, reject: rejectCommand });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Desktop evaluation failed.");
  return response.result.value;
}
async function screenshot(name) {
  const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const directory = resolve("artifacts");
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  await writeFile(path, Buffer.from(image.data, "base64"));
  return path;
}
async function clickButtonContaining(label, selector = "button") {
  return evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => (item.textContent || "").trim().includes(${JSON.stringify(label)})); if (!button) return false; button.click(); return true; })()`);
}
async function waitForText(text) {
  return poll(async () => (await evaluate("document.body?.innerText || ''")).includes(text));
}
async function waitForHeading(text) {
  return poll(async () => evaluate(`[...document.querySelectorAll("h1")].some((heading) => heading.textContent?.trim() === ${JSON.stringify(text)})`));
}

try {
  await send("Runtime.enable");
  await send("Page.enable");
  const welcomeText = await poll(async () => {
    const text = await evaluate("document.body?.innerText || ''");
    return text && !text.includes("Restoring your secure workspace") ? text : "";
  });
  console.log(JSON.stringify({ initialDesktopState: welcomeText }, null, 2));
  const welcomeScreenshot = await screenshot("desktop-compiled-welcome.png");
  if (!welcomeText.includes("What can Aegis help you with?")) {
    let enteredLocal = await clickButtonContaining("Continue without account") || await clickButtonContaining("Continue locally");
    if (!enteredLocal) {
      await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))`);
      await poll(async () => await evaluate("Boolean(document.querySelector('.command-palette'))"));
      enteredLocal = await clickButtonContaining("Switch local mode", ".command-results button");
    }
    if (!enteredLocal) throw new Error(`Local mode action was not found in: ${welcomeText}`);
  }
  await evaluate(`(() => { document.querySelector('button[title="Stop"]')?.click(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true, bubbles: true })); return true; })()`);
  await waitForText("What can Aegis help you with?");
  const chatModel = await poll(async () => {
    const state = await evaluate(`(() => { const textarea = document.querySelector('textarea'); const modelButton = [...document.querySelectorAll('button')].find((button) => (button.textContent || '').includes('hf.co/') || (button.textContent || '').includes('Ollama')); return { placeholder: textarea?.getAttribute('placeholder') || '', label: modelButton?.textContent?.trim() || '' }; })()`);
    return state.placeholder.startsWith("Ask Aegis") ? state : false;
  }, 10_000);
  let localGeneration = { attempted: false, succeeded: false, response: "", error: "" };
  if (chatModel.placeholder.startsWith("Ask Aegis")) {
    localGeneration.attempted = true;
    const assistantCount = await evaluate("document.querySelectorAll('.message-bubble.assistant').length");
    const submitted = await evaluate(`(() => { const textarea = document.querySelector('textarea'); const form = textarea?.closest('form'); if (!textarea || !form) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(textarea, 'Respond with exactly: Aegis connection successful.'); textarea.dispatchEvent(new Event('input', { bubbles: true })); form.requestSubmit(); return true; })()`);
    if (!submitted) throw new Error("The local chat composer could not be submitted.");
    const generation = await poll(async () => evaluate(`(() => { const assistants = [...document.querySelectorAll('.message-bubble.assistant .message-content')]; const error = document.querySelector('.message-error')?.textContent?.trim() || ''; return assistants.length > ${assistantCount} ? { response: assistants.at(-1)?.textContent?.trim() || '', error: '' } : error ? { response: '', error } : null; })()`), 180_000);
    localGeneration = { attempted: true, succeeded: Boolean(generation.response), response: generation.response.slice(0, 180), error: generation.error };
    await delay(450);
  }
  const chatScreenshot = await screenshot("desktop-compiled-chat.png");

  await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))`);
  await poll(async () => await evaluate("Boolean(document.querySelector('.command-palette'))"));
  const paletteScreenshot = await screenshot("desktop-command-palette.png");
  await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);

  const pages = [
    ["Projects", "Projects"],
    ["Agents", "Agents"],
    ["Models", "Models"],
    ["Providers", "Connect your AI"],
    ["Security", "Security"],
    ["CLI Sessions", "CLI Sessions"],
  ];
  const navigation = [];
  let localProvidersNoAuthError = false;
  let providerCards = [];
  let providersScreenshot;
  for (const [button, heading] of pages) {
    const clicked = await clickButtonContaining(button, "nav.desktop-sidebar-scroll button");
    if (!clicked) { navigation.push({ page: button, ok: false, reason: "navigation control missing" }); continue; }
    await waitForHeading(heading);
    await delay(260);
    if (button === "Providers") {
      const providerText = await evaluate("document.body?.innerText || ''");
      localProvidersNoAuthError = !providerText.includes("Please sign in to continue");
      providerCards = await evaluate(`[...document.querySelectorAll('.provider-card')].map((card) => card.textContent?.replace(/\\s+/g, ' ').trim())`);
      providersScreenshot = await screenshot("desktop-providers-local.png");
    }
    navigation.push({ page: button, ok: true });
  }
  if (!await clickButtonContaining("Local mode", ".sidebar-account")) throw new Error("Account control was not found.");
  await waitForHeading("Account");
  await delay(260);
  navigation.push({ page: "Account", ok: true });
  const settingsClicked = await evaluate(`(() => { const button = document.querySelector('.sidebar-settings'); if (!button) return false; button.click(); return true; })()`);
  if (!settingsClicked) throw new Error("Settings control was not found.");
  await waitForHeading("Settings");
  await delay(260);
  navigation.push({ page: "Settings", ok: true });
  const appearanceDebug = await evaluate(`({ tabCount: document.querySelectorAll('.settings-tab').length, buttons: [...document.querySelectorAll('button')].map((button) => button.textContent?.trim()).filter(Boolean) })`);
  if (!await clickButtonContaining("Appearance")) throw new Error(`Appearance settings tab was not found: ${JSON.stringify(appearanceDebug)}`);
  await waitForText("Visual effects");
  if (!await clickButtonContaining("Reduced", ".aegis-btn")) throw new Error("Reduced effects control was not found.");
  const effectsMode = await evaluate("document.documentElement.getAttribute('data-aegis-effects')");
  await evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true, bubbles: true }))`);
  await waitForText("What can Aegis help you with?");
  const finalText = await evaluate("document.body?.innerText || ''");
  const result = {
    ok: navigation.every((entry) => entry.ok) && effectsMode === "reduced" && consoleErrors.length === 0 && localProvidersNoAuthError && (!localGeneration.attempted || localGeneration.succeeded),
    origin: page.url,
    welcome: { visible: welcomeText.includes("A simple AI chat"), technicalUrlVisible: welcomeText.includes("Continue without account") && /127\.0\.0\.1:4000|Base URL|endpoint/i.test(welcomeText) },
    localMode: { chatVisible: finalText.includes("What can Aegis help you with?"), accountLabel: finalText.includes("Local mode") },
    chatModel,
    localGeneration,
    commandPalette: { opened: true },
    providers: { localModeWithoutAccountError: localProvidersNoAuthError, cards: providerCards },
    navigation,
    visualEffects: effectsMode,
    consoleErrors,
    screenshots: { welcome: welcomeScreenshot, chat: chatScreenshot, commandPalette: paletteScreenshot, providers: providersScreenshot },
  };
  if (!result.ok || result.welcome.technicalUrlVisible) throw new Error(`Desktop compiled flow incomplete: ${JSON.stringify(result)}`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  socket.close();
}
