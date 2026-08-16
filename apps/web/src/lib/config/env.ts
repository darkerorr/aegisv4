const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
export const env = { apiUrl: rawApiUrl.replace(/\/$/, "") } as const;
