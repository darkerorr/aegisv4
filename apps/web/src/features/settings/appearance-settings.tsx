"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Palette, Trash2 } from "lucide-react";
import { prepareWallpaper, useChatAppearance, type ChatWallpaper } from "./chat-appearance-store";
import { WALLPAPERS, useGlobalTheme, type GlobalWallpaper } from "./global-theme-store";

type Motion = "full" | "reduced" | "off";

const wallpapers: Array<[ChatWallpaper, string, string]> = [
  ["none", "None", "Pure workspace surface."],
  ["black", "Aegis Black", "Deep monochrome light."],
  ["grid", "Soft Grid", "Technical lines behind the conversation."],
  ["orbital", "Orbital", "A quiet Aegis ring composition."],
  ["network", "Global Network", "Connected nodes and subtle paths."],
];

const gallery: Array<{ id: ChatWallpaper; name: string; copy: string; accent: string; css: React.CSSProperties }> = [
  { id: "dark-grid", name: "Dark Grid", copy: "Discreet technical lines.", accent: "#ffffff", css: { backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "26px 26px" } },
  { id: "aurora", name: "Aurora", copy: "Soft drifting monochrome light.", accent: "#ffffff", css: { background: "radial-gradient(120% 90% at 20% 10%, rgba(255,255,255,.28), transparent 55%), radial-gradient(120% 90% at 90% 80%, rgba(160,160,160,.18), transparent 55%)" } },
  { id: "nebula", name: "Nebula", copy: "Deep grey interstellar cloud.", accent: "#e0e0e0", css: { background: "radial-gradient(130% 100% at 30% 20%, rgba(200,200,200,.26), transparent 55%), radial-gradient(120% 90% at 80% 90%, rgba(110,110,110,.22), transparent 55%)" } },
  { id: "blue-glass", name: "White Glass", copy: "Refractive Aegis glass.", accent: "#ffffff", css: { background: "radial-gradient(90% 70% at 50% 0%, rgba(255,255,255,.22), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.05), transparent)" } },
  { id: "cyber", name: "Cyber", copy: "Sharp monochrome lattice.", accent: "#ffffff", css: { background: "linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)", backgroundSize: "34px 34px" } },
  { id: "minimal", name: "Minimal", copy: "Calm, uncluttered space.", accent: "#ffffff", css: { background: "linear-gradient(180deg, rgba(255,255,255,.035), transparent 45%)" } },
  { id: "space", name: "Space", copy: "Starfield and dust.", accent: "#ffffff", css: { background: "radial-gradient(circle at 25% 20%, rgba(255,255,255,.22) 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.28) 0 1px, transparent 2px), radial-gradient(circle at 85% 25%, rgba(255,255,255,.18) 0 1px, transparent 2px), linear-gradient(180deg,#0a0a0a,#030303)" } },
  { id: "abstract", name: "Abstract", copy: "Composed radial geometry.", accent: "#e8e8e8", css: { background: "radial-gradient(circle at 20% 30%, rgba(255,255,255,.16), transparent 45%), radial-gradient(circle at 80% 70%, rgba(200,200,200,.2), transparent 50%)" } },
  { id: "matrix", name: "Matrix", copy: "Falling data streams.", accent: "#ffffff", css: { backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,.08) 0 1px, transparent 1px 14px)", backgroundSize: "100% 100%" } },
];

export function AppearanceSettings() {
  const [motion, setMotion] = useState<Motion>("full");
  const { appearance, update } = useChatAppearance();
  const { theme: globalTheme, setWallpaper, setAccent, update: updateGlobal } = useGlobalTheme();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("aegis-motion") as Motion | null;
    const initial = stored || (matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full");
    setMotion(initial);
    document.documentElement.dataset.motion = initial;
  }, []);

  function choose(value: Motion) {
    setMotion(value);
    localStorage.setItem("aegis-motion", value);
    document.documentElement.dataset.motion = value;
  }

  async function image(file?: File) {
    if (!file) return;
    const prepared = await prepareWallpaper(file);
    update({ ...prepared, wallpaper: "custom" });
  }

  function pickGallery(id: ChatWallpaper) {
    const found = gallery.find((item) => item.id === id);
    update({ wallpaper: id, customImage: undefined, accent: found?.accent || "#ffffff", dominant: "#08090c", luminance: 0.04 });
  }

  return (
    <div className="aegis-settings-stack">
      <section className="aegis-settings-panel">
        <header><Palette size={18} /><div><h2>Workspace theme</h2><p>Applied to the entire workspace - sidebar, pages and ambient canvas. Wallpapers never leave this device.</p></div></header>
        <div className="aegis-wallpaper-grid">
          {WALLPAPERS.map((item) => (
            <button key={item.id} className="aegis-wallpaper-thumb" data-active={globalTheme.wallpaper === item.id} onClick={() => setWallpaper(item.id as GlobalWallpaper)}>
              <i style={{ background: `radial-gradient(120% 90% at 30% 20%, ${item.accent}33, transparent 60%), linear-gradient(180deg, #07080a, #050505)` }} />
              <strong>{item.name}</strong>
              <small>{item.description}</small>
              {globalTheme.wallpaper === item.id && <Check size={13} style={{ position: "absolute", right: 9, top: 9, color: "#ffffff" }} />}
            </button>
          ))}
        </div>
        <div className="wallpaper-controls">
          <label>Accent
            <span className="aegis-accent-row">
              <input type="color" value={globalTheme.accent} onChange={(event) => setAccent(event.target.value)} aria-label="Accent color" />
              <code>{globalTheme.accent}</code>
            </span>
          </label>
          <label>Ambient intensity<input type="range" min={30} max={95} value={globalTheme.dim} onChange={(event) => updateGlobal({ dim: Number(event.target.value) })} /></label>
        </div>
        <div className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="aegis-btn" data-active={globalTheme.vignette} onClick={() => updateGlobal({ vignette: !globalTheme.vignette })}>{globalTheme.vignette ? <Check size={14} /> : <Palette size={14} />}Vignette {globalTheme.vignette ? "on" : "off"}</button>
          <button className="aegis-btn" data-active={globalTheme.grain} onClick={() => updateGlobal({ grain: !globalTheme.grain })}>{globalTheme.grain ? <Check size={14} /> : <ImagePlus size={14} />}Grain {globalTheme.grain ? "on" : "off"}</button>
          <button className="aegis-btn" data-active={globalTheme.motion} onClick={() => updateGlobal({ motion: !globalTheme.motion })}>{globalTheme.motion ? <Check size={14} /> : <Palette size={14} />}Ambient motion {globalTheme.motion ? "on" : "off"}</button>
        </div>
      </section>
      <section className="aegis-settings-panel">
        <header><Palette size={18} /><div><h2>Motion</h2><p>Control movement throughout Aegis. System reduced-motion is honored by default.</p></div></header>
        <div className="choice-grid">
          {([["full", "Full", "Cinematic transitions and subtle depth."], ["reduced", "Reduced", "Short fades with minimal displacement."], ["off", "Off", "Remove non-essential motion."]] as const).map(([value, label, copy]) => (
            <button key={value} data-active={motion === value} onClick={() => choose(value)}><span>{label}{motion === value && <Check size={15} />}</span><small>{copy}</small></button>
          ))}
        </div>
      </section>
      <section className="aegis-settings-panel">
        <header><ImagePlus size={18} /><div><h2>Wallpaper library</h2><p>Nine curated scenes. Appearance only - wallpapers are never sent to a model.</p></div></header>
        <div className="aegis-wallpaper-grid">
          {gallery.map((item) => (
            <button key={item.id} className="aegis-wallpaper-thumb" data-active={appearance.wallpaper === item.id} onClick={() => pickGallery(item.id)}>
              <i style={item.css} />
              <strong>{item.name}</strong>
              <small>{item.copy}</small>
              {appearance.wallpaper === item.id && <Check size={13} style={{ position: "absolute", right: 9, top: 9, color: "#ffffff" }} />}
            </button>
          ))}
        </div>
        <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void image(event.target.files?.[0])} />
        <div className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="aegis-btn" onClick={() => input.current?.click()}><ImagePlus size={14} />Upload custom image</button>
          {appearance.wallpaper === "custom" && <button className="aegis-btn" onClick={() => update({ wallpaper: "black", customImage: undefined })}><Trash2 size={14} />Reset</button>}
        </div>
      </section>
      <section className="aegis-settings-panel">
        <header><Palette size={18} /><div><h2>Chat background</h2><p>Base wallpapers plus your uploaded image.</p></div></header>
        <div className="wallpaper-grid">
          {wallpapers.map(([value, label, copy]) => (
            <button key={value} data-wallpaper={value} data-active={appearance.wallpaper === value} onClick={() => update({ wallpaper: value })}><i /><strong>{label}</strong><small>{copy}</small>{appearance.wallpaper === value && <Check size={14} />}</button>
          ))}
        </div>
        <div className="wallpaper-controls">
          <label>Blur<input type="range" min={0} max={24} value={appearance.blur} onChange={(e) => update({ blur: Number(e.target.value) })} /></label>
          <label>Dim<input type="range" min={20} max={90} value={appearance.dim} onChange={(e) => update({ dim: Number(e.target.value) })} /></label>
          <label>Contrast<input type="range" min={70} max={130} value={appearance.contrast} onChange={(e) => update({ contrast: Number(e.target.value) })} /></label>
        </div>
        <div className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="aegis-btn" data-active={appearance.vignette} onClick={() => update({ vignette: !appearance.vignette })}>{appearance.vignette ? <Check size={14} /> : <Palette size={14} />}Vignette {appearance.vignette ? "on" : "off"}</button>
          <button className="aegis-btn" data-active={appearance.grain} onClick={() => update({ grain: !appearance.grain })}>{appearance.grain ? <Check size={14} /> : <ImagePlus size={14} />}Grain {appearance.grain ? "on" : "off"}</button>
        </div>
      </section>
    </div>
  );
}
