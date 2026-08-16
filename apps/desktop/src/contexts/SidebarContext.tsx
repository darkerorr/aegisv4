import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type View =
  | "Home"
  | "NewChat"
  | "Chats"
  | "Chat"
  | "Projects"
  | "Agents"
  | "Models"
  | "Providers"
  | "Connections"
  | "CLISessions"
  | "Downloads"
  | "Settings"
  | "Account"
  | "Security"
  | "Diagnostics"
  | "Help"
  | "Login"
  | "Register"
  | "ForgotPassword"
  | "ResetPassword"
  | "Onboarding"
  | "Welcome";

export interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
  view: View;
  navigate: (view: View) => void;
  previousView: View | null;
  goBack: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(() => {
    try { return localStorage.getItem("aegis-sidebar-collapsed") === "1"; } catch { return false; }
  });
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem("aegis-onboarding-complete") === "1" ? "Login" : "Onboarding";
    } catch {
      return "Onboarding";
    }
  });
  const [history, setHistory] = useState<View[]>([]);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try { localStorage.setItem("aegis-sidebar-collapsed", value ? "1" : "0"); } catch { /* optional UI preference */ }
  }, []);
  const toggle = useCallback(() => setCollapsedState((current) => {
    const next = !current;
    try { localStorage.setItem("aegis-sidebar-collapsed", next ? "1" : "0"); } catch { /* optional UI preference */ }
    return next;
  }), []);

  const navigate = useCallback((newView: View) => {
    setHistory((prev) => prev);
    setView((prev) => {
      setHistory((h) => [...h, prev]);
      return newView;
    });
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setView(prev);
      return h.slice(0, -1);
    });
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        setCollapsed,
        view,
        navigate,
        previousView: history.length > 0 ? history[history.length - 1] : null,
        goBack,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
