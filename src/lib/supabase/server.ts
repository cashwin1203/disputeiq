import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes them.
        }
      },
    },
  });
}

export async function exchangeCodeForSession(code: string) {
  const client = await createClient();
  if (!client) return { error: new Error("Supabase is not configured") };
  const { error } = await client.auth.exchangeCodeForSession(code);
  return { error };
}
