import { supabase } from "./supabase";
import { track } from "./analytics";

/** Otvara Stripe Checkout za depozit (iz ponude) ili ostatak (iz portala). Vraća poruku greške ili preusmerava. */
export async function startCheckout(args: { offer_token?: string; project_token?: string }): Promise<string | null> {
  if (!supabase) return "Plaćanje trenutno nije dostupno.";
  const { data, error } = await supabase.functions.invoke("offer-checkout", { body: args });
  if (error || !data?.url) {
    let msg = "Plaćanje nije moglo da se otvori. Pokušajte ponovo za minut.";
    try { const body = await (error as { context?: Response })?.context?.json(); if (body?.error) msg = body.error; } catch { /* zadržavamo opštu poruku */ }
    if (data?.error) msg = data.error;
    return msg;
  }
  track("checkout_started", { from: args.project_token ? "portal" : "offer" });
  location.href = data.url;
  return null;
}
