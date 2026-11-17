import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseConfig } from "./client";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function parseDemoTokenClaims(token: string): { sub: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[2] !== "demo" || !parts[1]) return null;
  try {
    const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")) as {
      sub?: unknown;
      email?: unknown;
      mode?: unknown;
    };
    if (decoded.mode === "demo_agent" && typeof decoded.sub === "string" && decoded.sub) {
      return {
        sub: decoded.sub,
        ...(typeof decoded.email === "string" ? { email: decoded.email } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function authenticateBearerRequest(request: Request | undefined): Promise<{
  supabase: SupabaseClient<Database>;
  userId: string;
  isDemoSession: boolean;
}> {
  const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseConfig();
  const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  if (token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const demoClaims = parseDemoTokenClaims(token);
  if (demoClaims) {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY;
    const demoFetch: typeof fetch = SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY)
      : async () =>
          new Response(JSON.stringify({ message: "Demo session uses local owner-scoped memory" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
    const supabase = createClient<Database>(SUPABASE_URL, keyToUse, {
      global: {
        fetch: demoFetch,
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return {
      supabase,
      userId: demoClaims.sub,
      isDemoSession: true,
    };
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("Unauthorized: Invalid token");
  }

  if (!data.claims.sub) {
    throw new Error("Unauthorized: No user ID found in token");
  }

  return {
    supabase,
    userId: data.claims.sub,
    isDemoSession: false,
  };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const { supabase, userId } = await authenticateBearerRequest(request);

    return next({
      context: {
        supabase,
        userId,
      },
    });
  },
);
