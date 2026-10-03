// Edge Function: pravi Stripe Checkout za depozit (iz ponude) ili ostatak (iz portala).
// Secrets: STRIPE_SECRET_KEY (rk_live_… ili sk_…). SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY Supabase daje sam.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const SITE = Deno.env.get("SITE_URL") ?? "https://moj-app.netlify.app";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Stripe error");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return json(500, { error: "Plaćanje još nije podešeno." });

  let body: { offer_token?: string; project_token?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Neispravan zahtev." }); }
  const isHex = (s?: string) => !!s && /^[a-f0-9]{20,64}$/.test(s);
  if (!isHex(body.offer_token) && !isHex(body.project_token)) return json(400, { error: "Neispravan link." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { data: allowed } = await db.rpc("rate_limit_hit", { p_bucket: "checkout", p_key: await sha256(ip), p_max: 20, p_window: "1 hour" });
  if (allowed === false) return json(429, { error: "Previše pokušaja. Pokušajte ponovo kasnije." });

  // Pronađi ponudu (i projekat, ako je zahtev iz portala)
  let projectId: string | null = null;
  let projectToken: string | null = null;
  let offerQuery = db.from("offers").select("id, number, status, total, deposit_pct, currency, public_token, leads(email, business_name)");
  if (body.project_token) {
    const { data: pr } = await db.from("projects").select("id, offer_id, public_token").eq("public_token", body.project_token).single();
    if (!pr?.offer_id) return json(404, { error: "Projekat nije pronađen." });
    projectId = pr.id; projectToken = pr.public_token;
    offerQuery = offerQuery.eq("id", pr.offer_id);
  } else {
    offerQuery = offerQuery.eq("public_token", body.offer_token!);
  }
  const { data: offer } = await offerQuery.single();
  if (!offer) return json(404, { error: "Ponuda nije pronađena." });
  if (offer.status !== "prihvacena") return json(400, { error: "Ponuda prvo mora biti prihvaćena." });

  const { data: paid } = await db.from("payments").select("kind").eq("offer_id", offer.id).eq("status", "paid");
  const paidKinds = new Set((paid ?? []).map((p) => p.kind));
  const total = Number(offer.total);
  const deposit = Math.round(total * offer.deposit_pct) / 100;

  let kind: "deposit" | "full" | "balance";
  let amount: number;
  if (body.project_token) {
    if (paidKinds.has("full") || paidKinds.has("balance")) return json(400, { error: "Ceo iznos je već plaćen." });
    if (!paidKinds.has("deposit")) return json(400, { error: "Depozit još nije plaćen." });
    kind = "balance"; amount = Math.round((total - deposit) * 100) / 100;
  } else {
    if (paidKinds.has("deposit") || paidKinds.has("full")) return json(400, { error: "Depozit je već plaćen." });
    kind = offer.deposit_pct >= 100 ? "full" : "deposit"; amount = offer.deposit_pct >= 100 ? total : deposit;
  }
  if (!(amount > 0)) return json(400, { error: "Iznos za plaćanje nije ispravan." });

  // deno-lint-ignore no-explicit-any
  const lead = (offer as any).leads as { email: string | null; business_name: string | null } | null;
  const label = kind === "balance" ? "ostatak" : kind === "full" ? "ceo iznos" : "depozit";
  const back = projectToken ? `${SITE}/projekat/${projectToken}` : `${SITE}/ponuda/${offer.public_token}`;

  try {
    const session = await stripe("checkout/sessions", {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": (offer.currency ?? "EUR").toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": `Mobilna aplikacija ${lead?.business_name ?? ""}: ${label}`.trim(),
      "line_items[0][price_data][product_data][description]": `Ponuda ${offer.number}`,
      success_url: `${SITE}/placanje?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      locale: "auto",
      "metadata[offer_id]": offer.id,
      "metadata[kind]": kind,
      ...(lead?.email ? { customer_email: lead.email } : {}),
    });
    const { error } = await db.from("payments").insert({
      offer_id: offer.id, project_id: projectId, kind, amount, currency: offer.currency ?? "EUR", provider: "stripe", provider_ref: session.id, status: "pending",
    });
    if (error) return json(500, { error: "Plaćanje nije moglo da se pripremi. Pokušajte ponovo." });
    return json(200, { url: session.url });
  } catch (e) {
    console.error(e);
    return json(502, { error: "Stripe trenutno ne odgovara. Pokušajte ponovo za minut." });
  }
});
