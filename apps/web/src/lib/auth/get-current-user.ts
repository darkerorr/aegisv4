import type { User } from "@aegis/api-client";
import { authApi } from "@/lib/api/auth";

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  const response = await authApi.me(signal);
  return response.user;
}
