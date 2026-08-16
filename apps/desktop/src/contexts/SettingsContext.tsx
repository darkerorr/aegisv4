import {
  createContext,
  useEffect,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";
export type VisualEffectsMode = "full" | "reduced" | "off";

export interface SettingsState {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  animations: boolean;
  setAnimations: (v: boolean) => void;
  visualEffects: VisualEffectsMode;
  setVisualEffects: (v: VisualEffectsMode) => void;
  autoStart: boolean;
  setAutoStart: (v: boolean) => void;
  safeMode: boolean;
  setSafeMode: (v: boolean) => void;
  streaming: boolean;
  setStreaming: (v: boolean) => void;
  telemetry: boolean;
  setTelemetry: (v: boolean) => void;
  language: string;
  setLanguage: (v: string) => void;
  fontSize: number;
  setFontSize: (v: number) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

const STORAGE_KEY = "aegis-desktop-settings";

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: Partial<SettingsState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = load();

  const [theme, setThemeState] = useState<ThemeMode>(
    (stored.theme as ThemeMode) || "dark"
  );
  const [visualEffects, setVisualEffectsState] = useState<VisualEffectsMode>(
    (stored.visualEffects as VisualEffectsMode) || (stored.animations === false ? "off" : "full")
  );
  const [autoStart, setAutoStartState] = useState<boolean>(
    stored.autoStart ?? false
  );
  const [safeMode, setSafeModeState] = useState<boolean>(
    stored.safeMode ?? true
  );
  const [streaming, setStreamingState] = useState<boolean>(
    stored.streaming ?? true
  );
  const [telemetry, setTelemetryState] = useState<boolean>(
    stored.telemetry ?? false
  );
  const [language, setLanguageState] = useState<string>(
    (stored.language as string) || "en"
  );
  const [fontSize, setFontSizeState] = useState<number>(
    stored.fontSize ?? 14
  );

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    save({ theme: t });
    document.documentElement.setAttribute(
      "data-aegis-theme",
      t
    );
  }, []);

  const animations = visualEffects !== "off";

  const setVisualEffects = useCallback((v: VisualEffectsMode) => {
    setVisualEffectsState(v);
    save({ visualEffects: v, animations: v !== "off" });
  }, []);

  const setAnimations = useCallback((v: boolean) => {
    setVisualEffects(v ? "full" : "off");
  }, [setVisualEffects]);

  useEffect(() => {
    document.documentElement.setAttribute("data-aegis-theme", theme);
    document.documentElement.setAttribute("data-aegis-effects", visualEffects);
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize, theme, visualEffects]);

  const setAutoStart = useCallback((v: boolean) => {
    setAutoStartState(v);
    save({ autoStart: v });
  }, []);

  const setSafeMode = useCallback((v: boolean) => {
    setSafeModeState(v);
    save({ safeMode: v });
  }, []);

  const setStreaming = useCallback((v: boolean) => {
    setStreamingState(v);
    save({ streaming: v });
  }, []);

  const setTelemetry = useCallback((v: boolean) => {
    setTelemetryState(v);
    save({ telemetry: v });
  }, []);

  const setLanguage = useCallback((v: string) => {
    setLanguageState(v);
    save({ language: v });
  }, []);

  const setFontSize = useCallback((v: number) => {
    setFontSizeState(v);
    save({ fontSize: v });
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        theme,
        setTheme,
        animations,
        setAnimations,
        visualEffects,
        setVisualEffects,
        autoStart,
        setAutoStart,
        safeMode,
        setSafeMode,
        streaming,
        setStreaming,
        telemetry,
        setTelemetry,
        language,
        setLanguage,
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx)
    throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
