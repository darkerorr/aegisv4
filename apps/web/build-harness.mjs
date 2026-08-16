import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(webRoot, "compiled.css"), "utf8");

const body = `
<div class="v3-workspace aegis-canvas" data-collapsed="false" data-nav-open="false">
  <div class="v3-canvas" aria-hidden="true">
    <div class="v3-canvas__grid"></div>
    <div class="v3-canvas__orb v3-canvas__orb--blue"></div>
    <div class="v3-canvas__orb v3-canvas__orb--indigo"></div>
    <div class="v3-canvas__orb v3-canvas__orb--violet"></div>
    <div class="v3-canvas__orb v3-canvas__orb--ember"></div>
    <div class="v3-canvas__vignette"></div>
  </div>
  <aside class="v3-sidebar">
    <div class="v3-sidebar__head">
      <div class="v3-sidebar__brand">
        <span class="v3-sidebar__brand-logo"><span class="aegis-mark">M</span></span>
        <span class="v3-sidebar__brand-text"><strong>Aegis</strong><small>Workspace</small></span>
        <span class="v3-sidebar__version">PREMIUM</span>
      </div>
      <button class="v3-new-chat"><span>New chat</span></button>
      <div class="v3-sidebar__model"><span>Current model</span><b>Llama 3.2</b></div>
    </div>
    <nav class="v3-sidebar__nav">
      <a class="v3-nav-item" href="/chat"><span>Chat</span></a>
      <a class="v3-nav-item" href="/search"><span>Search</span></a>
      <a class="v3-nav-item" href="/projects"><span>Projects</span></a>
      <a class="v3-nav-item" href="/work"><span>Work Mode</span></a>
    </nav>
    <div class="v3-sidebar__foot"><span class="v3-sidebar__user">Aegis Studio</span></div>
  </aside>
  <div class="v3-rail">
    <header class="v3-rail__head"><span>Conversations</span></header>
    <div class="v3-rail__list">
      <a class="v3-rail__item" href="#"><h3>Launch narrative</h3><p>Lead with protected choice.</p></a>
    </div>
  </div>
  <section class="v3-main" id="main">
    <div class="v3-chat" data-wallpaper="none" data-vignette="false" data-grain="false" style="--chat-wallpaper-dominant:#ffffff;--chat-wallpaper-accent:#ffffff;--chat-wallpaper-luminance:0.2;--chat-surface:rgba(8,8,8,0.72);--chat-border:rgba(255,255,255,.13);--chat-text:#fff;--chat-muted:#a5a5a5;--chat-wallpaper-image:none;--chat-wallpaper-blur:0px;--chat-wallpaper-dim:0.62;--chat-wallpaper-contrast:100%;--model-accent:#e5342b;--model-accent-deep:#8a120d;--model-accent-soft:rgba(229,52,43,0.16);--model-accent-soft-2:rgba(229,52,43,0.06);--model-accent-mid:rgba(229,52,43,0.3);--model-accent-strong:rgba(229,52,43,0.5);--model-accent-glow:rgba(229,52,43,0.4);">
      <header class="v3-topbar">
        <button class="v3-nav-toggle" type="button">NAV</button>
        <button class="v3-rail-toggle" type="button">RAIL</button>
        <div class="v3-topbar__title">
          <span class="v3-kicker">Protected workspace</span>
          <h1>New conversation</h1>
          <p class="v3-topbar__meta"><strong>Llama 3.2</strong><em>Ollama</em><i></i>2 messages</p>
        </div>
        <div class="v3-topbar__actions"><span class="v3-badge v3-badge--local">LOCAL</span></div>
      </header>
      <div class="v3-chat__scroll">
        <div class="v3-chat__column">
          <div class="v3-msg v3-msg--user">
            <div class="v3-msg__bubble-group">
              <div class="v3-msg__bubble">Sharpen the positioning. Please give me a long response with multiple paragraphs, a list and a code block so the message is wide and shows wrapping.</div>
              <div class="v3-msg__bubble-meta"><time>10:00</time></div>
            </div>
          </div>
          <div class="v3-msg v3-msg--assistant">
            <article class="v3-msg__card">
              <header class="v3-msg__head">
                <span class="v3-msg__avatar"><span>AI</span></span>
                <span class="v3-msg__identity"><strong class="v3-msg__model">Aegis</strong><span class="v3-msg__provider">Ollama</span></span>
                <div class="v3-msg__actions"><button>COPY</button></div>
              </header>
              <div class="v3-md">
                <h1>Lead with protected choice</h1>
                <p>Paragraph one: Aegis is a private, local-first AI workspace that connects every kind of intelligence, from open-weight local models to leading cloud providers. Paragraph two continues the theme and keeps going to demonstrate text wrapping across the full column width so we can measure it precisely.</p>
                <ul><li>First bullet about privacy</li><li>Second bullet about choice</li><li>Third bullet about control</li></ul>
                <div class="v3-code">
                  <div class="v3-code__bar"><span class="v3-code__dots"><i></i><i></i><i></i></span><span class="v3-code__lang">python</span></div>
                  <pre class="v3-code__pre"><code>def hello():\n    print("code block inside the message card")\n    return 42</code></pre>
                </div>
                <p>Closing paragraph that ends the assistant response and provides a natural ending for the measurement.</p>
              </div>
              <footer class="v3-msg__foot"><span class="v3-msg__foot-model">Llama 3.2</span><time>10:01</time></footer>
            </article>
          </div>
        </div>
      </div>
      <div class="v3-chat__glow" aria-hidden="true"></div>
      <div class="v3-chat__footer">
        <div class="v3-composer-dock">
          <p class="v3-composer__disclaimer">AI can make mistakes. Verify important information and provider boundaries.</p>
          <div class="v3-composer">
            <div class="v3-composer__row">
              <textarea aria-label="Message Aegis" placeholder="Message Aegis..."></textarea>
              <div class="v3-composer__sendbox"><button class="v3-composer__send" type="button">S</button></div>
            </div>
            <div class="v3-composer__toolbar">
              <div class="v3-composer__left"><span>MODEL</span><button class="aegis-icon-button">+</button></div>
              <div class="v3-composer__right"><span class="v3-composer__chip">1 tool</span><span class="v3-composer__mode is-local">LOCAL</span></div>
            </div>
            <div class="v3-composer__meta">
              <span class="v3-composer__hint"><kbd>Enter</kbd> send · <kbd>Shift Enter</kbd> new line</span>
              <span class="v3-composer__context">Context 128k · $0.10 / $0.20 M</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>
`;

const html = `<!DOCTYPE html>
<html lang="en" class="--font-sans">
<head><meta charset="utf-8"><style>${css}</style></head>
<body class="grain">${body}</body>
</html>`;

writeFileSync(join(webRoot, "harness.html"), html, "utf8");
console.log("harness.html written", html.length);
