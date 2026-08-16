const baseUrl = (process.env.AEGIS_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const routes = ["/", "/chat", "/connections", "/github", "/account", "/projects", "/workspace/models"];
const timeoutMs = Number(process.env.AEGIS_ASSET_VERIFY_TIMEOUT_MS) || 10_000;
const acceptedJavaScript = new Set(["application/javascript", "text/javascript", "application/x-javascript"]);

function attribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return match?.[1] || null;
}

function extractAssets(html) {
  const css = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter(([tag]) => /\brel\s*=\s*["'][^"']*stylesheet/i.test(tag))
    .map(([tag]) => attribute(tag, "href"))
    .filter((value) => value?.includes("/_next/static/"));
  const javascript = [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => attribute(tag, "src"))
    .filter((value) => value?.includes("/_next/static/"));
  return { css: [...new Set(css)], javascript: [...new Set(javascript)] };
}

async function request(pathname) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new URL(pathname, baseUrl), {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml,*/*" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function mediaType(response) {
  return (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
}

let failed = false;
const checked = new Map();
console.log(`[ASSETS] Target: ${baseUrl}`);
for (const route of routes) {
  try {
    const response = await request(route);
    const type = mediaType(response);
    if (response.status !== 200 || type !== "text/html") {
      failed = true;
      console.error(`[ASSETS] ROUTE FAIL ${route} status=${response.status} mime=${type || "missing"}`);
      continue;
    }
    const assets = extractAssets(await response.text());
    if (assets.css.length === 0 || assets.javascript.length === 0) {
      failed = true;
      console.error(`[ASSETS] ROUTE FAIL ${route} css=${assets.css.length} js=${assets.javascript.length}`);
      continue;
    }
    console.log(`[ASSETS] ROUTE OK   ${route} status=200 css=${assets.css.length} js=${assets.javascript.length}`);
    for (const asset of [...assets.css.map((url) => ({ url, kind: "css" })), ...assets.javascript.map((url) => ({ url, kind: "js" }))]) {
      if (!checked.has(asset.url)) checked.set(asset.url, asset.kind);
    }
  } catch (error) {
    failed = true;
    console.error(`[ASSETS] ROUTE FAIL ${route} error=${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const [asset, kind] of checked) {
  try {
    const response = await request(asset);
    const type = mediaType(response);
    const mimeOk = kind === "css" ? type === "text/css" : acceptedJavaScript.has(type);
    if (response.status !== 200 || !mimeOk) {
      failed = true;
      console.error(`[ASSETS] ${kind.toUpperCase()} FAIL ${asset} status=${response.status} mime=${type || "missing"}`);
    } else {
      console.log(`[ASSETS] ${kind.toUpperCase()} OK   ${asset} status=200 mime=${type}`);
    }
  } catch (error) {
    failed = true;
    console.error(`[ASSETS] ${kind.toUpperCase()} FAIL ${asset} error=${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`[ASSETS] Result: ${failed ? "FAILED" : "PASSED"}; routes=${routes.length}; uniqueAssets=${checked.size}`);
process.exit(failed ? 1 : 0);
