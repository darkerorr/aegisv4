import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("http://127.0.0.1:3000/product", { waitUntil: "networkidle" });
const out = await page.evaluate(() => {
  const rules = [];
  for (const sheet of document.styleSheets) {
    let cssRules;
    try { cssRules = sheet.cssRules; } catch { continue; }
    if (!cssRules) continue;
    for (const rule of cssRules) {
      if (rule.selectorText && /\.v3-chat__column|\.v3-chat__scroll|\.v3-composer|\.v3-composer-dock|\.v3-composer__disclaimer|\.v3-composer__error|\.v3-workspace|\.v3-main/.test(rule.selectorText)) {
        rules.push(rule.cssText);
      }
    }
  }
  return rules;
});
console.log(out.join("\n-----\n"));
await browser.close();