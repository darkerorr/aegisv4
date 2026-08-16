"use client";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export type GlobalWallpaper =
  | "dark-grid"
  | "aurora"
  | "nebula"
  | "blue-glass"
  | "cyber"
  | "minimal"
  | "space"
  | "abstract"
  | "matrix";

export interface WallpaperSpec {
  id: GlobalWallpaper;
  name: string;
  description: string;
  accent: string;
  luminance: number;
  dark: boolean;
}

export const WALLPAPERS: WallpaperSpec[] = [
  { id: "dark-grid", name: "Dark Grid", description: "Deep black with a subtle red blueprint grid.", accent: "#e5342b", luminance: 0.03, dark: true },
  { id: "aurora", name: "Aurora", description: "Soft drifting red light ribbons on near-black.", accent: "#d9473e", luminance: 0.06, dark: true },
  { id: "nebula", name: "Nebula", description: "A dark dust field with a faint red glow.", accent: "#b8231b", luminance: 0.07, dark: true },
  { id: "blue-glass", name: "White Glass", description: "Frosted glass panels with a luminous red core.", accent: "#ff4438", luminance: 0.08, dark: true },
  { id: "cyber", name: "Cyber", description: "Red lattice horizon with subtle highlights.", accent: "#e5342b", luminance: 0.05, dark: true },
  { id: "minimal", name: "Minimal", description: "Pure, distraction-free near-black canvas.", accent: "#ff6b63", luminance: 0.02, dark: true },
  { id: "space", name: "Space", description: "A quiet starfield with a distant red glow.", accent: "#e5342b", luminance: 0.05, dark: true },
  { id: "abstract", name: "Abstract", description: "Sculpted light shapes and organic red gradients.", accent: "#d9473e", luminance: 0.07, dark: true },
  { id: "matrix", name: "Matrix", description: "Digital rain columns on a deep grey-black field.", accent: "#e5342b", luminance: 0.04, dark: true },
];

export interface GlobalTheme {
  wallpaper: GlobalWallpaper;
  accent: string;
  dim: number;
  blur: number;
  grain: boolean;
  vignette: boolean;
  motion: boolean;
}

const DEFAULTS: GlobalTheme = { wallpaper: "dark-grid", accent: "#e5342b", dim: 66, blur: 0, grain: true, vignette: true, motion: true };
const STORAGE_KEY = "aegis.global.theme.v2";

const Context = createContext<{ theme: GlobalTheme; setWallpaper: (id: GlobalWallpaper) => void; setAccent: (hex: string) => void; update: (patch: Partial<GlobalTheme>) => void } | null>(null);

function resolveAccent(wallpaper: GlobalWallpaper, accent: string) {
  const spec = WALLPAPERS.find((w) => w.id === wallpaper);
  return spec ? spec.accent : accent;
}

export function GlobalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<GlobalTheme>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTheme((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-wallpaper", theme.wallpaper);
    root.style.setProperty("--aegis-accent", theme.accent);
    root.style.setProperty("--aegis-dim", String(theme.dim));
    root.style.setProperty("--aegis-blur", `${theme.blur}px`);
    root.classList.toggle("theme-grain", theme.grain);
    root.classList.toggle("theme-vignette", theme.vignette);
    root.classList.toggle("theme-motion", theme.motion);
    root.classList.toggle("theme-no-motion", !theme.motion);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {}
  }, [theme]);

  const setWallpaper = useCallback((wallpaper: GlobalWallpaper) => {
    setTheme((current) => ({ ...current, wallpaper, accent: resolveAccent(wallpaper, current.accent) }));
  }, []);

  const setAccent = useCallback((accent: string) => {
    setTheme((current) => ({ ...current, accent }));
  }, []);

  const update = useCallback((patch: Partial<GlobalTheme>) => {
    setTheme((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(() => ({ theme, setWallpaper, setAccent, update }), [theme, setWallpaper, setAccent, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGlobalTheme() {
  const value = useContext(Context);
  if (!value) throw new Error("useGlobalTheme requires GlobalThemeProvider");
  return value;
}
