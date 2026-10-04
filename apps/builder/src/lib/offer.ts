import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Lansirna ponuda iz Admin → Sajt → Ponuda. Važi samo dok rok nije prošao. */
export interface Offer { percent: number; label?: string; ends_at?: string | null }

export function useOffer() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!supabase) return;
    supabase.from("site_settings").select("value").eq("key", "offer").maybeSingle().then(({ data }) => setOffer((data?.value as Offer) ?? null));
  }, []);
  const end = offer?.ends_at ? Date.parse(offer.ends_at) : NaN;
  const active = !!offer && offer.percent > 0 && Number.isFinite(end) && end > now;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const left = active ? Math.max(0, end - now) : 0;
  return {
    active,
    percent: active ? offer!.percent : 0,
    label: offer?.label || "Lansirna ponuda",
    left,
    price: (regular: number) => (active ? Math.round((regular * (100 - offer!.percent)) / 100) : regular),
  };
}

export function countdown(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export const eur = (n: number) => `${new Intl.NumberFormat("sr-Latn-RS").format(n)} €`;
