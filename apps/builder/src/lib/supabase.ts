import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Jedan klijent za ceo sajt. Bez env promenljivih (lokalni demo) vrednost je null. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } })
  : null;
