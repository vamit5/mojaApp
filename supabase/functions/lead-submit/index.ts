// Edge Function: prima lead + demo config iz buildera.
// Deploy: supabase functions deploy lead-submit
// Koristi service role (zaobilazi RLS) — zato su validacija i rate limit ovde obavezni.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  lead: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    intent: z.enum(["send_demo", "want_app"]),
    consent: z.literal(true),
  }),
  config: z.object({ industry: z.string().max(40), modules: z.array(z.string().max(30)).max(20), brand: z.object({ name: z.string().max(40) }).passthrough() }).passthrough(),
  estimate: z.record(z.unknown()).optional(),
  utm: z.record(z.string().max(120)).optional(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const raw = await req.text();
  if (raw.length > 4_000_000) return json(413, { error: "Podaci su preveliki. Smanjite broj ili veličinu fotografija." });

  const parsed = Body.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return json(400, { error: "Podaci nisu ispravni. Proverite ime, email i saglasnost." });
  const { lead, config, estimate, utm } = parsed.data;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { data: allowed } = await db.rpc("rate_limit_hit", { p_bucket: "lead", p_key: await sha256(ip), p_max: 5, p_window: "1 hour" });
  if (allowed === false) return json(429, { error: "Previše zahteva. Pokušajte ponovo za sat vremena." });

  // TODO(faza 2): fotografije iz data URL-ova prebaciti u bucket demo-assets i u config upisati putanje.
  const { data: demo, error: demoErr } = await db.from("demos")
    .insert({ config, status: "saved", session_token_hash: await sha256(crypto.randomUUID()), utm: utm ?? {} })
    .select("id, slug").single();
  if (demoErr) return json(500, { error: "Čuvanje demoa nije uspelo. Pokušajte ponovo." });

  const { data: row, error: leadErr } = await db.from("leads").insert({
    name: lead.name, email: lead.email.toLowerCase(), phone: lead.phone || null,
    business_name: config.brand.name, industry: config.industry, modules: config.modules,
    demo_id: demo.id, source: utm?.utm_source ?? "direct", utm: utm ?? {},
    priority: lead.intent === "want_app", estimate: estimate ?? null, consent_at: new Date().toISOString(),
  }).select("id").single();
  if (leadErr) return json(500, { error: "Slanje nije uspelo. Pokušajte ponovo." });

  await db.from("demos").update({ lead_id: row.id }).eq("id", demo.id);
  await db.from("events").insert({ name: "lead_created", demo_id: demo.id, lead_id: row.id, utm: utm ?? {}, props: { intent: lead.intent } });

  // TODO(faza 2): Resend — email klijentu sa linkom demo.mojapp.rs/d/{slug} i obaveštenje vlasniku.
  return json(200, { ok: true, slug: demo.slug });
});
