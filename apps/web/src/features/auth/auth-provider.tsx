"use client";

import type { User } from "@aegis/api-client";
import { AegisApiError } from "@aegis/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useMemo, type ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { normalizeError, type UiError } from "@/lib/api/errors";
import { authQuery, authQueryKey } from "./auth-query";

export type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "authenticated"; user: User; error: null }
  | { status: "anonymous"; user: null; error: null }
  | { status: "session-expired"; user: null; error: UiError }
  | { status: "error"; user: null; error: UiError };

export type AuthContextValue = AuthState & {
  authenticate: (user: User) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery(authQuery);

  const authenticate = useCallback((user: User) => {
    queryClient.setQueryData(authQueryKey, user);
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: authQueryKey });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await authApi.logout();
    queryClient.clear();
    queryClient.setQueryData(authQueryKey, null);
  }, [queryClient]);

  const state = useMemo<AuthState>(() => {
    if (query.data) return { status: "authenticated", user: query.data, error: null };
    if (query.data === null) return { status: "anonymous", user: null, error: null };
    if (query.isPending) return { status: "loading", user: null, error: null };
    if (query.error instanceof AegisApiError && query.error.status === 401) {
      if (query.error.apiError.code === "SESSION_EXPIRED") {
        return { status: "session-expired", user: null, error: normalizeError(query.error) };
      }
      return { status: "anonymous", user: null, error: null };
    }
    return { status: "error", user: null, error: normalizeError(query.error) };
  }, [query.data, query.error, query.isPending]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, authenticate, refresh, signOut }), [state, authenticate, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
