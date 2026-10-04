import { useEffect, useState } from "react";
import { PLANS } from "@mojapp/core";
import { supabase } from "./supabase";

/** Cene paketa iz baze (Admin → Sajt → Paketi i cene), sa rezervom iz koda. */
export function usePlanPrices() {
  const [prices, setPrices] = useState<Record<string, number>>({ start: PLANS.start.once, business: PLANS.business.once });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!supabase) { setLoaded(true); return; }
    supabase.from("pricing_plans").select("key,price_once").in("key", ["start", "business"]).then(({ data }) => {
      const next: Record<string, number> = {};
      for (const r of data ?? []) if (r.price_once !== null) next[r.key] = Number(r.price_once);
      setPrices((p) => ({ ...p, ...next }));
      setLoaded(true);
    });
  }, []);
  return { prices, loaded, of: (plan: string) => prices[plan] ?? prices.start };
}
