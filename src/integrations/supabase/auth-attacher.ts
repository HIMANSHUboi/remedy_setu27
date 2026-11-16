import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const DEMO_SESSION_STORAGE_KEY = "remedy_setu_agent_session";

export function createDemoAgentToken(email: string, userId: string): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      email,
      role: "authenticated",
      mode: "demo_agent",
    }),
  );
  return `${header}.${payload}.demo`;
}

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      token = undefined;
    }

    if (!token && typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { access_token?: string };
          token = parsed.access_token;
        }
      } catch {
        token = undefined;
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
