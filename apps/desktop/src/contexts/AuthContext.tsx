import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, describeApiError, AegisApiError, type User } from "../api/client";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "local";

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ message: string; verificationRequired: boolean }>;
  logout: () => Promise<void>;
  goLocal: () => void;
  checkSession: () => Promise<void>;
  setUser: (user: User) => void;
  connectionError: string | null;
  retryConnection: () => Promise<void>;
  apiAvailable: boolean;
  sessionExpired: boolean;
  apiUrl: string;
  setApiUrl: (url: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const checkSession = useCallback(async () => {
    setStatus("loading");
    setConnectionError(null);
    try {
      await api.health();
      setApiAvailable(true);
    } catch (error) {
      setApiAvailable(false);
      setUser(null);
      setStatus("unauthenticated");
      setConnectionError(describeApiError(error));
      return;
    }
    try {
      const { user: u } = await api.me();
      setUser(u);
      setStatus("authenticated");
      setSessionExpired(false);
      try { localStorage.setItem("aegis-had-session", "1"); } catch { /* unavailable in restricted WebViews */ }
    } catch (error) {
      setUser(null);
      setStatus("unauthenticated");
      const authError = error instanceof AegisApiError && (error.status === 401 || error.apiError.code === "AUTH_REQUIRED");
      setSessionExpired(authError && (() => { try { return localStorage.getItem("aegis-had-session") === "1"; } catch { return false; } })());
      setConnectionError(authError ? null : describeApiError(error));
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await api.login({ email, password });
    setUser(u);
    setStatus("authenticated");
    setConnectionError(null);
    setApiAvailable(true);
    setSessionExpired(false);
    try { localStorage.setItem("aegis-had-session", "1"); } catch { /* ignore */ }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const response = await api.register({ email, password, displayName });
      const verificationRequired = response.emailVerificationRequired === true;
      if (!verificationRequired) {
        setUser(response.user);
        setStatus("authenticated");
        setConnectionError(null);
        setApiAvailable(true);
        setSessionExpired(false);
        try { localStorage.setItem("aegis-had-session", "1"); } catch { /* ignore */ }
      }
      return {
        message: response.message || "Account created.",
        verificationRequired,
      };
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setStatus("unauthenticated");
    setSessionExpired(false);
    try { localStorage.removeItem("aegis-had-session"); } catch { /* ignore */ }
  }, []);

  const goLocal = useCallback(() => {
    setUser(null);
    setStatus("local");
    setConnectionError(null);
  }, []);

  const setApiUrl = useCallback((url: string) => { api.setServerUrl(url); setConnectionError(null); }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        login,
        register,
        logout,
        goLocal,
        checkSession,
        setUser,
        connectionError,
        apiAvailable,
        sessionExpired,
        retryConnection: checkSession,
        apiUrl: api.getServerUrl(),
        setApiUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
