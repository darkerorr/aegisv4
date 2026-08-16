import type { User } from "@aegis/api-client";
import { AegisApiError } from "@aegis/api-client";
import { queryOptions } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export const authQueryKey = ["auth", "current-user"] as const;

export const authQuery = queryOptions<User | null>({
  queryKey: authQueryKey,
  queryFn: ({ signal }) => getCurrentUser(signal),
  staleTime: 60_000,
  gcTime: 30 * 60_000,
  retry: (attempt, error) => {
    if (error instanceof AegisApiError && error.status === 401) return false;
    return attempt < 1;
  },
  refetchOnWindowFocus: true,
});
