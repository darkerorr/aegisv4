// == Aegis Web Asset Verifier ==
// After building and starting next start, run this to verify all static assets
// are served with correct Content-Type and HTTP 200.

const http = require("node:http");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const WEB_PORT = process.env.AEGIS_WEB_PORT || 3000;
const WEB_HOST = "127.0.0.1";
const BASE = `http://${WEB_HOST}:${WEB_PORT}`;

// Routes to check — these must exist and return HTML
const ROUTES = ["/", "/chat", "/github", "/connections", "/account"];

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", reject);
    }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("timeout")); });
  });
}

function extractAssets(html) {
  const assets = [];
  // CSS: href="/_next/static/css/...css"
  const cssRe = /\/_next\/static\/css\/[a-z0-9]+\.css/g;
  let m;
  while ((m = cssRe.exec(html)) !== null) assets.push(m[0]);
  // JS: src="/_next/static/chunks/...js"
  const jsRe = /\/_next\/static\/chunks\/[^"']+\.js/g;
  while ((m = jsRe.exec(html)) !== null) assets.push(m[0]);
  // JS: src="/_next/static/...js" (other Next.js chunks)
  const otherJsRe = /\/_next\/static\/[^"']+\/_buildManifest\.js/g;
  while ((m = otherJsRe.exec(html)) !== null) assets.push(m[0]);
  return [...new Set(assets)];
}

async function verifyAssets() {
  console.log("[ASSETS] Aegis Web Asset Verifier");
  console.log(`[ASSETS] Target: ${BASE}`);
  console.log("");

  const allAssetUrls = new Set();
  let routeCount = 0;
  let okCount = 0;
  let failCount = 0;

  for (const route of ROUTES) {
    routeCount++;
    const url = `${BASE}${route}`;
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        const assets = extractAssets(response.body);
        console.log(`[ASSETS] ✓ ${route} — 200 (${assets.length} assets found)`);
        for (const asset of assets) allAssetUrls.add(`${BASE}${asset}`);
        okCount++;
      } else {
        console.log(`[ASSETS] ✗ ${route} — ${response.status} (expected 200)`);
        failCount++;
      }
    } catch (err) {
      console.log(`[ASSETS] ✗ ${route} — fetch error: ${err.message}`);
      failCount++;
    }
  }

  console.log("");
  console.log(`[ASSETS] Checking ${allAssetUrls.size} unique static assets...`);
  let assetOk = 0;
  let assetFail = 0;

  for (const url of allAssetUrls) {
    try {
      const response = await fetch(url);
      const ct = response.headers["content-type"] || "none";
      const isCss = url.endsWith(".css");
      const isJs = url.endsWith(".js");
      const expectedCt = isCss ? "text/css" : isJs ? ["application/javascript", "text/javascript", "application/x-javascript"] : null;
      const ctOk = !expectedCt || (Array.isArray(expectedCt) ? expectedCt.some((e) => ct.startsWith(e)) : ct.startsWith(expectedCt));
      if (response.status === 200 && ctOk) {
        console.log(`  [OK] ${pathLabel(url)} — 200 ${ct}`);
        assetOk++;
      } else if (response.status === 200 && !ctOk) {
        console.log(`  [MIME] ${pathLabel(url)} — 200 but Content-Type "${ct}" is incorrect (expected ${expectedCt})`);
        assetFail++;
      } else {
        console.log(`  [404] ${pathLabel(url)} — ${response.status} ${ct}`);
        assetFail++;
      }
    } catch (err) {
      console.log(`  [ERR] ${pathLabel(url)} — ${err.message}`);
      assetFail++;
    }
  }

  console.log("");
  console.log(`[ASSETS] Routes: ${routeCount}`);
  console.log(`[ASSETS] Assets OK: ${assetOk}`);
  console.log(`[ASSETS] Assets FAILED: ${assetFail}`);
  console.log(`[ASSETS] Result: ${failCount === 0 && assetFail === 0 ? "ALL PASSED" : "FAILURES DETECTED"}`);

  process.exit(failCount === 0 && assetFail === 0 ? 0 : 1);
}

function pathLabel(url) {
  const u = new URL(url);
  return u.pathname.slice(1);
}

const buildIdPath = resolve(__dirname, "../../apps/web/.next/BUILD_ID");
if (existsSync(buildIdPath)) {
  console.log(`[ASSETS] BUILD_ID: ${readFileSync(buildIdPath, "utf8").trim()}`);
}

verifyAssets().catch((err) => {
  console.error("[ASSETS] Fatal error:", err.message);
  process.exit(1);
});
