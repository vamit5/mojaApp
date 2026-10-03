// Edge Function: potvrđuje uplatu kod Stripe-a i beleži je u bazi.
// 1) { session_id } — poziva stranica /placanje posle povratka sa Stripe-a (javno, ali proverava kod Stripe-a).
// 2) { sweep: true } — poziva admin panel; proverava sve nedavne uplate na čekanju (za slučaj da je klijent zatvorio stranicu).
// Secrets: STRIPE_SECRET_KEY, opciono RESEND_API_KEY i OWNER_EMAIL za obaveštenje vlasniku.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const SITE = Deno.env.get("SITE_URL") ?? "https://moj-app.netlify.app";

async function getSession(id: string) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, { headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` } });
  if (!res.ok) return null;
  return await res.json() as { id: string; payment_status: string; amount_total: number };
}

async function notifyOwner(subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") ?? "MojApp <onboarding@resend.dev>", to: [Deno.env.get("OWNER_EMAIL") ?? "vamit5.team@gmail.com"], subject, html }),
  }).catch(() => {});
}

// deno-lint-ignore no-explicit-any
async function confirm(db: any, sessionId: string) {
  const s = await getSession(sessionId);
  if (!s || s.payment_status !== "paid") return { paid: false };
  const { data } = await db.rpc("record_payment", { p_session: sessionId });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { paid: false };
  if (row.newly) {
    const label = row.kind === "balance" ? "ostatak" : row.kind === "full" ? "ceo iznos" : "depozit";
    await notifyOwner(`Uplata: ${row.business_name ?? "klijent"}, ${label} ${row.amount} €`,
      `<p><strong>${row.business_name ?? "Klijent"}</strong> je platio ${label}: <strong>${row.amount} €</strong>.</p>
       <p>Email klijenta: ${row.client_email ?? "nema"}</p>
       <p><a href="${SITE}/admin">Otvori admin</a> · <a href="${SITE}/projekat/${row.project_token}">Portal klijenta</a></p>`);
  }
  return { paid: true, project_token: row.project_token, kind: row.kind, amount: row.amount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!Deno.env.get("STRIPE_SECRET_KEY")) return json(500, { error: "Plaćanje još nije podešeno." });

  let body: { session_id?: string; sweep?: boolean };
  try { body = await req.json(); } catch { return json(400, { error: "Neispravan zahtev." }); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (body.session_id) {
    if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(body.session_id)) return json(400, { error: "Neispravan broj plaćanja." });
    return json(200, await confirm(db, body.session_id));
  }

  if (body.sweep) {
    // samo admin
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json(401, { error: "Prijavite se." });
    const { data: prof } = await db.from("profiles").select("role").eq("user_id", u.user.id).single();
    if (!prof || !["admin", "staff"].includes(prof.role)) return json(403, { error: "Nemate pristup." });

    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const { data: pending } = await db.from("payments").select("provider_ref").eq("status", "pending").gte("created_at", since).limit(30);
    let confirmed = 0;
    for (const p of pending ?? []) {
      if (!p.provider_ref) continue;
      const r = await confirm(db, p.provider_ref);
      if (r.paid) confirmed++;
    }
    return json(200, { checked: pending?.length ?? 0, confirmed });
  }

  return json(400, { error: "Neispravan zahtev." });
});
