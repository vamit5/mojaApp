import type { ModuleKey } from "./config";
import { MODULES } from "./catalog";

export interface Estimate {
  plan: "start" | "business" | "custom";
  complexity: number;   // 1–5, ponderisano
  hours: number;
  priceOnce: number | null;
  priceMonthly: number | null;
  reasons: string[];
}

/** Cene paketa — u produkciji dolaze iz pricing_plans (CMS). */
export const PLANS = {
  start:    { once: 780,  monthly: 0, maxModules: 6 },
  business: { once: 1290, monthly: 0 },
} as const;

/** Interna procena za admina na osnovu izabranih modula. */
export function estimate(modules: ModuleKey[], customRequests = 0): Estimate {
  const metas = modules.map((m) => MODULES[m]);
  const hours = metas.reduce((s, m) => s + m.hours, 0) + customRequests * 16;
  const complexity = metas.length ? Math.round((metas.reduce((s, m) => s + m.complexity, 0) / metas.length) * 10) / 10 : 1;
  const reasons: string[] = [];
  const businessModules = metas.filter((m) => m.tier === "business");

  if (customRequests > 0) {
    reasons.push(`${customRequests} zahtev(a) van kataloga`);
    return { plan: "custom", complexity: Math.max(complexity, 4), hours, priceOnce: null, priceMonthly: null, reasons };
  }
  if (businessModules.length || modules.length > PLANS.start.maxModules) {
    if (businessModules.length) reasons.push(`BUSINESS moduli: ${businessModules.map((m) => m.name).join(", ")}`);
    if (modules.length > PLANS.start.maxModules) reasons.push(`${modules.length} modula (START do ${PLANS.start.maxModules})`);
    return { plan: "business", complexity, hours, priceOnce: PLANS.business.once, priceMonthly: PLANS.business.monthly, reasons };
  }
  reasons.push("Svi moduli su u START paketu");
  return { plan: "start", complexity, hours, priceOnce: PLANS.start.once, priceMonthly: PLANS.start.monthly, reasons };
}
