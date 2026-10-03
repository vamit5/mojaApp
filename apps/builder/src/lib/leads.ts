import type { AppConfig } from "@mojapp/core";
import { estimate } from "@mojapp/core";
import { utm } from "./analytics";

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  intent: "send_demo" | "want_app";
  consent: boolean;
}

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Šalje lead + demo config Edge funkciji `lead-submit`. Bez podešenog Supabase-a radi u demo režimu. */
export async function submitLead(lead: LeadInput, config: AppConfig): Promise<{ ok: true; demoSlug?: string } | { ok: false; error: string }> {
  if (!URL_ || !ANON) {
    await new Promise((r) => setTimeout(r, 700));
    return { ok: true };
  }
  try {
    const res = await fetch(`${URL_}/functions/v1/lead-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ lead, config, estimate: estimate(config.modules), utm: utm() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Slanje nije uspelo. Proverite podatke i pokušajte ponovo." };
    return { ok: true, demoSlug: data.slug };
  } catch {
    return { ok: false, error: "Nema veze sa serverom. Proverite internet i pokušajte ponovo." };
  }
}
