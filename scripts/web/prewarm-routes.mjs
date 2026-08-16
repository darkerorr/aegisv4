const baseUrl = (process.env.AEGIS_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const routes = ["/", "/login", "/register", "/chat", "/search", "/projects", "/workspace/models", "/providers", "/connections", "/gmail", "/drive", "/calendar", "/account", "/privacy", "/docs", "/download"];
const concurrency = 3;

async function waitForServer() {
  const started = performance.now();
  while (performance.now() - started < 30_000) {
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`[WEB] Development server did not respond at ${baseUrl} within 30 seconds.`);
}

await waitForServer();
console.log(`[WEB] Prewarming ${routes.length} development routes with concurrency ${concurrency}.`);
let cursor = 0;
async function worker() {
  while (cursor < routes.length) {
    const route = routes[cursor++];
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
      console.log(`[WEB] ${route.padEnd(20)} ${String(response.status).padEnd(3)} ${((performance.now() - started) / 1000).toFixed(2)} s`);
    } catch (error) {
      console.error(`[WEB] ${route.padEnd(20)} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log("[WEB] Development route prewarm completed.");
