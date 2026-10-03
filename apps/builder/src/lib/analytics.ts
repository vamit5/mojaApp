/** Funnel događaji (sekcija I plana). GA4 i Meta Pixel se pozivaju samo ako su učitani posle saglasnosti. */
type EventName = "page_view" | "cta_click" | "demo_started" | "demo_step" | "demo_completed" | "lead_created" | "want_app_click" | "checkout_started" | "payment_completed";

declare global {
  interface Window { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

const PIXEL: Partial<Record<EventName, string>> = { page_view: "PageView", demo_started: "ViewContent", lead_created: "Lead", want_app_click: "Contact", checkout_started: "InitiateCheckout", payment_completed: "Purchase" };

export function utm(): Record<string, string> {
  const p = new URLSearchParams(location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) { const v = p.get(k); if (v) out[k] = v; }
  return out;
}

export function track(name: EventName, props: Record<string, unknown> = {}) {
  const payload = { ...props, ...utm() };
  window.gtag?.("event", name, payload);
  if (PIXEL[name]) window.fbq?.("track", PIXEL[name], payload);
  (window.dataLayer ??= []).push({ event: name, ...payload });
}
