import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const DEFAULT_SUPABASE_URL = "https://nwvixwuktjdiflwqeqkj.supabase.co";
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hBXBx0QICufAzN5wSzj1Mw_7tcvJ5M2";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function resolveSupabaseConfig(): { url: string; key: string } {
  const metaEnv = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<
    string,
    string | undefined
  >;
  const procEnv = (typeof process !== "undefined" ? process.env : {}) as Record<
    string,
    string | undefined
  >;

  const url =
    metaEnv["NEXT_PUBLIC_SUPABASE_URL"] ||
    metaEnv["VITE_SUPABASE_URL"] ||
    procEnv["NEXT_PUBLIC_SUPABASE_URL"] ||
    procEnv["VITE_SUPABASE_URL"] ||
    procEnv["SUPABASE_URL"] ||
    DEFAULT_SUPABASE_URL;

  const key =
    metaEnv["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ||
    metaEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    metaEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    metaEnv["VITE_SUPABASE_ANON_KEY"] ||
    procEnv["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ||
    procEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    procEnv["SUPABASE_PUBLISHABLE_KEY"] ||
    procEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    procEnv["VITE_SUPABASE_ANON_KEY"] ||
    procEnv["SUPABASE_ANON_KEY"] ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return { url: url.replace(/\/+$/, ""), key };
}

function serverSupabaseUrl(publicUrl: string, supabaseKey: string): string | undefined {
  if (typeof window !== "undefined" || typeof process === "undefined") return undefined;
  const { url: serverUrl, key: serverKey } = resolveSupabaseConfig();
  if (!serverUrl || serverUrl === publicUrl || serverKey !== supabaseKey) return undefined;
  return serverUrl;
}

function createSupabaseFetch(supabaseUrl: string, supabaseKey: string): typeof fetch {
  const publicUrl = supabaseUrl.replace(/\/+$/, "");
  const serverUrl = serverSupabaseUrl(publicUrl, supabaseKey);
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
    if (serverUrl) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(`${publicUrl}/`)) {
        const target = serverUrl + url.slice(publicUrl.length);
        const request =
          typeof input === "string" || input instanceof URL ? target : new Request(target, input);
        return fetch(request, { ...init, headers });
      }
    }
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseClient() {
  const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseConfig();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
