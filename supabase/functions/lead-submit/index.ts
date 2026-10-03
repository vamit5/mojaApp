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

/** Izvlači data: slike iz configa i ostavlja oznake media:N na njihovom mestu. */
// deno-lint-ignore no-explicit-any
function extractMedia(input: any) {
  const config = structuredClone(input);
  const items: { key: string; dataUrl: string }[] = [];
  const take = (v: unknown) => {
    if (typeof v !== "string" || !v.startsWith("data:image/")) return v;
    const key = `media:${items.length}`;
    items.push({ key, dataUrl: v });
    return key;
  };
  if (config.brand) config.brand.logo = take(config.brand.logo);
  if (config.content?.photos) config.content.photos = config.content.photos.map(take);
  for (const c of config.catalog ?? []) for (const it of c.items ?? []) it.photo = take(it.photo);
  for (const s of config.staff ?? []) s.photo = take(s.photo);
  return { config, items };
}

/** Zamenjuje oznake media:N javnim URL-ovima; neuspele slike se uklanjaju. */
// deno-lint-ignore no-explicit-any
function applyMedia(input: any, urls: Record<string, string>) {
  return JSON.parse(JSON.stringify(input), (_k, v) => (typeof v === "string" && v.startsWith("media:") ? urls[v] : v));
}

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

  // Demo se prvo čuva bez slika (dobija id), zatim se slike prebacuju u Storage i config dobija javne URL-ove.
  const media = extractMedia(config);
  const { data: demo, error: demoErr } = await db.from("demos")
    .insert({ config: media.config, status: "saved", session_token_hash: await sha256(crypto.randomUUID()), utm: utm ?? {} })
    .select("id, slug").single();
  if (demoErr) return json(500, { error: "Čuvanje demoa nije uspelo. Pokušajte ponovo." });

  if (media.items.length) {
    const urls: Record<string, string> = {};
    for (const m of media.items.slice(0, 20)) {
      const match = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(m.dataUrl);
      if (!match) continue;
      const bytes = Uint8Array.from(atob(match[3]), (c) => c.charCodeAt(0));
      if (bytes.length > 8 * 1024 * 1024) continue;
      const path = `${demo.id}/${crypto.randomUUID()}.${match[2] === "jpeg" ? "jpg" : match[2]}`;
      const { error } = await db.storage.from("demo-media").upload(path, bytes, { contentType: match[1], upsert: false });
      if (!error) urls[m.key] = db.storage.from("demo-media").getPublicUrl(path).data.publicUrl;
    }
    await db.from("demos").update({ config: applyMedia(media.config, urls) }).eq("id", demo.id);
  }

  const { data: row, error: leadErr } = await db.from("leads").insert({
    name: lead.name, email: lead.email.toLowerCase(), phone: lead.phone || null,
    business_name: config.brand.name, industry: config.industry, modules: config.modules,
    demo_id: demo.id, source: utm?.utm_source ?? "direct", utm: utm ?? {},
    priority: lead.intent === "want_app", estimate: estimate ?? null, consent_at: new Date().toISOString(),
  }).select("id").single();
  if (leadErr) return json(500, { error: "Slanje nije uspelo. Pokušajte ponovo." });

  await db.from("demos").update({ lead_id: row.id }).eq("id", demo.id);
  await db.from("events").insert({ name: "lead_created", demo_id: demo.id, lead_id: row.id, utm: utm ?? {}, props: { intent: lead.intent } });

  // TODO: Resend — email klijentu sa linkom /d/{slug} i obaveštenje vlasniku.
  return json(200, { ok: true, slug: demo.slug });
});
