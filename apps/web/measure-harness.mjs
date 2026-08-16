import { chromium } from "@playwright/test";

const fileUrl = "file:///C:/Users/jmmas/Music/Aegis/apps/web/harness.html";

async function measure(viewport) {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport });
  await page.goto(fileUrl);
  await page.waitForTimeout(600);
  const rows = await page.evaluate(() => {
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
        paddingL: cs.paddingLeft,
        paddingR: cs.paddingRight,
        marginL: cs.marginLeft,
        marginR: cs.marginRight,
      };
    };
    const sel = (s) => document.querySelector(s);
    return [
      info(sel(".v3-workspace"), "v3-workspace"),
      info(sel(".v3-sidebar"), "v3-sidebar"),
      info(sel(".v3-rail"), "v3-rail"),
      info(sel("#main, .v3-main"), "v3-main"),
      info(sel(".v3-chat"), "v3-chat"),
      info(sel(".v3-chat__scroll"), "v3-chat__scroll"),
      info(sel(".v3-chat__column"), "v3-chat__column"),
      info(sel(".v3-msg--assistant"), "v3-msg(assistant)"),
      info(sel(".v3-msg__card"), "v3-msg__card"),
      info(sel(".v3-msg--user"), "v3-msg(user)"),
      info(sel(".v3-chat__footer"), "v3-chat__footer"),
      info(sel(".v3-composer-dock"), "v3-composer-dock"),
      info(sel(".v3-composer"), "v3-composer"),
      info(sel(".v3-composer__disclaimer"), "v3-composer__disclaimer"),
    ];
  });
  await browser.close();
  return rows;
}

for (const vp of [{ width: 1920, height: 1080 }, { width: 1600, height: 900 }, { width: 1280, height: 800 }]) {
  console.log(`\n========== VIEWPORT ${vp.width}x${vp.height} ==========`);
  const rows = await measure(vp);
  for (const r of rows) console.log(JSON.stringify(r));
}
