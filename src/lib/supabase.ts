"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client — dormant until BOTH public env vars exist.
 * With them set, sign-in/sign-up/OAuth go through Supabase Auth and the
 * app sends real access tokens; without them, the V0 preview session
 * keeps working exactly as before. NEXT_PUBLIC_ values are inlined at
 * build time, so this check is a constant on both server and client.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(url && key);
}

export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    client = url && key ? createClient(url, key) : null;
  }
  return client;
}

/** Authorization header for mutating API calls — {} while auth is
 * dormant or signed out, so every fetch can spread it unconditionally. */
export async function authHeaders(): Promise<Record<string, string>> {
  const c = getSupabase();
  if (!c) return {};
  const { data } = await c.auth.getSession();
  return data.session
    ? { authorization: `Bearer ${data.session.access_token}` }
    : {};
}
