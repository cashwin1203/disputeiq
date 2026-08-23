"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createClient() {
  const config = supabaseConfig();
  return config ? createBrowserClient(config.url, config.key) : null;
}

export async function signInWithGitHub(redirectTo = `${window.location.origin}/auth/callback`) {
  const client = createClient();
  if (!client) return { error: new Error("Supabase is not configured") };
  const { error } = await client.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
  return { error };
}

export async function signOut() {
  const client = createClient();
  if (!client) return { error: null };
  const { error } = await client.auth.signOut();
  return { error };
}
