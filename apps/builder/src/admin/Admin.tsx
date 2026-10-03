import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppConfigSchema, estimate, industryByKey, MODULES, type AppConfig, type ModuleKey } from "@mojapp/core";
import { Icon } from "@mojapp/ui";
import { supabase } from "../lib/supabase";
import { Phone } from "../components/Phone";
import { Link } from "../router";
import { money, type OfferItem, type OfferPhase } from "../pages/Offer";
import { STAGES } from "../pages/Project";
import "../pages/share.css";
import "./admin.css";

/* ───────────────────────── tipovi i oznake ───────────────────────── */

export const STATUSES = [
  ["nov", "Nov"], ["kontaktiran", "Kontaktiran"], ["poziv_zakazan", "Poziv zakazan"], ["ponuda_poslata", "Ponuda poslata"],
  ["pregovori", "Pregovori"], ["uplaceno", "Uplaćeno"], ["projekat_u_izradi", "U izradi"], ["zavrseno", "Završeno"], ["odbijeno", "Odbijeno"],
] as const;
type Status = (typeof STATUSES)[number][0];
const statusLabel = (s: string) => STATUSES.find(([k]) => k === s)?.[1] ?? s;

const OFFER_STATUS: Record<string, string> = { nacrt: "Nacrt", poslata: "Poslata", vidjena: "Viđena", prihvacena: "Prihvaćena", istekla: "Istekla", odbijena: "Odbijena" };

interface Lead {
  id: string; name: string | null; email: string | null; phone: string | null; business_name: string | null; industry: string | null;
  modules: string[]; demo_id: string | null; source: string | null; utm: Record<string, string>; status: Status; priority: boolean;
  estimate: { plan?: string; hours?: number; priceOnce?: number | null; priceMonthly?: number | null } | null; created_at: string;
}
interface Activity { id: string; type: string; body: string | null; created_at: string }
interface OfferRow { id: string; number: string; status: string; total: number; monthly: number | null; public_token: string; created_at: string; lead_id: string; leads?: { business_name: string | null } | null }

interface ProjectRow {
  id: string; name: string; stage: string; stage_note: string | null; store_links: { appstore?: string; play?: string } | null;
  agreed_price: number | null; monthly_price: number | null; maintenance: string; public_token: string; lead_id: string | null; offer_id: string | null;
  created_at: string; updated_at: string; config: unknown;
  leads: { name: string | null; email: string | null; phone: string | null } | null;
  payments: { kind: string; amount: number; status: string }[];
}
interface CommentRow { id: string; body: string; internal: boolean; author_id: string | null; created_at: string }
const stageLabel = (s: string) => STAGES.find(([k]) => k === s)?.[1] ?? s;

const when = (d: string) => new Date(d).toLocaleString("sr-Latn-RS", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const db = supabase!;

/* ───────────────────────── ulaz: prijava i provera uloge ───────────────────────── */

export function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    document.title = "MojApp admin";
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole(null); return; }
    db.from("profiles").select("role").eq("user_id", session.user.id).single().then(({ data }) => setRole(data?.role ?? "client"));
  }, [session]);

  if (!supabase) return <div className="s-center"><p>Supabase nije podešen (VITE_SUPABASE_URL).</p></div>;
  if (session === undefined || (session && role === null)) return <div className="s-center"><div className="s-spinner" aria-label="Učitavanje" /></div>;
  if (!session) return <Login />;
  if (role !== "admin" && role !== "staff") return (
    <div className="s-center s-missing">
      <h1>Ovaj nalog nema pristup adminu.</h1>
      <p>Prijavljeni ste kao {session.user.email}.</p>
      <button type="button" className="b-btn" onClick={() => db.auth.signOut()}>Odjavi se</button>
    </div>
  );
  return <Dashboard email={session.user.email ?? ""} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError("Upišite ispravnu email adresu."); return; }
    if (!password) { setError("Upišite lozinku."); return; }
    setBusy(true); setError("");
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message.toLowerCase().includes("invalid") ? "Pogrešan email ili lozinka." : "Prijava nije uspela. Pokušajte ponovo za minut.");
  };
  return (
    <div className="s-center">
      <form className="a-login" onSubmit={submit} noValidate>
        <div className="b-wordmark"><span className="b-mark" aria-hidden="true" />MojApp admin</div>
        <h1>Prijava</h1>
        <label className="b-field"><span>Email</span><input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        <label className="b-field"><span>Lozinka</span><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="b-error" role="alert">{error}</p>}
        <button type="submit" className="b-btn" disabled={busy}>{busy ? "Prijavljujemo…" : "Prijavi se"}</button>
      </form>
    </div>
  );
}

/* ───────────────────────── glavni ekran ───────────────────────── */

function Dashboard({ email }: { email: string }) {
  const [view, setView] = useState<"leads" | "offers" | "projects">("leads");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [openProject, setOpenProject] = useState<ProjectRow | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [filter, setFilter] = useState<Status | "sve" | "aktivni">("aktivni");
  const [open, setOpen] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // proveri uplate na čekanju kod Stripe-a (ako je klijent zatvorio stranicu posle plaćanja)
    await db.functions.invoke("payment-verify", { body: { sweep: true } }).catch(() => null);
    const [l, o, p] = await Promise.all([
      db.from("leads").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("offers").select("id,number,status,total,monthly,public_token,created_at,lead_id,leads(business_name)").order("created_at", { ascending: false }).limit(200),
      db.from("projects").select("id,name,stage,stage_note,store_links,agreed_price,monthly_price,maintenance,public_token,lead_id,offer_id,created_at,updated_at,config,leads(name,email,phone),payments(kind,amount,status)").order("created_at", { ascending: false }).limit(200),
    ]);
    setProjects((p.data ?? []) as unknown as ProjectRow[]);
    setLeads((l.data ?? []) as Lead[]);
    setOffers(((o.data ?? []) as unknown as OfferRow[]).map((r) => ({ ...r, total: Number(r.total) })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = new Date().toDateString();
  const stats = useMemo(() => ({
    newToday: leads.filter((l) => new Date(l.created_at).toDateString() === today).length,
    open: leads.filter((l) => l.status === "nov").length,
    want: leads.filter((l) => l.priority && ["nov", "kontaktiran", "poziv_zakazan"].includes(l.status)).length,
    offers: offers.filter((o) => ["poslata", "vidjena"].includes(o.status)).length,
    accepted: offers.filter((o) => o.status === "prihvacena").length,
    active: projects.filter((x) => x.stage !== "objavljeno").length,
  }), [leads, offers, projects, today]);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(([k]) => [k, leads.filter((l) => l.status === k).length])), [leads]);
  const shown = leads.filter((l) => filter === "sve" ? true : filter === "aktivni" ? !["zavrseno", "odbijeno"].includes(l.status) : l.status === filter);

  const updateLead = (u: Lead) => { setLeads((ls) => ls.map((l) => (l.id === u.id ? u : l))); setOpen(u); };

  return (
    <div className="a-root">
      <aside className="a-side">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" />MojApp</Link>
        <nav>
          <button type="button" className={view === "leads" ? "is-active" : ""} onClick={() => setView("leads")}><Icon name="users" size={18} /> Leadovi <span>{counts.nov || ""}</span></button>
          <button type="button" className={view === "offers" ? "is-active" : ""} onClick={() => setView("offers")}><Icon name="tag" size={18} /> Ponude <span>{stats.accepted || ""}</span></button>
          <button type="button" className={view === "projects" ? "is-active" : ""} onClick={() => setView("projects")}><Icon name="phone" size={18} /> Projekti <span>{stats.active || ""}</span></button>
        </nav>
        <div className="a-side-foot">
          <span>{email}</span>
          <button type="button" className="b-link" onClick={() => db.auth.signOut()}>Odjavi se</button>
        </div>
      </aside>

      <main className="a-main">
        <div className="a-stats">
          <Stat label="Novi danas" value={stats.newToday} />
          <Stat label="Čekaju kontakt" value={stats.open} />
          <Stat label="Žele aplikaciju" value={stats.want} hot={stats.want > 0} />
          <Stat label="Ponude na čekanju" value={stats.offers} />
          <Stat label="Aktivni projekti" value={stats.active} />
        </div>

        {view === "leads" ? (
          <>
            <div className="a-head"><h1>Leadovi</h1><button type="button" className="b-btn is-ghost" onClick={load}>Osveži</button></div>
            <div className="a-filters" role="tablist">
              {[["aktivni", "Aktivni"], ["sve", "Svi"], ...STATUSES].map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "is-active" : ""} onClick={() => setFilter(k as typeof filter)}>
                  {label}{counts[k] ? <span>{counts[k]}</span> : null}
                </button>
              ))}
            </div>
            {loading ? <div className="a-empty">Učitavanje…</div> : shown.length === 0 ? (
              <div className="a-empty">Nema leadova u ovom prikazu. Novi leadovi stižu kada neko pošalje formu iz demoa.</div>
            ) : (
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead><tr><th>Biznis</th><th>Kontakt</th><th>Delatnost</th><th>Procena</th><th>Status</th><th>Stigao</th></tr></thead>
                  <tbody>
                    {shown.map((l) => (
                      <tr key={l.id} onClick={() => setOpen(l)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(l)}>
                        <td><div className="a-biz">{l.priority && <i className="a-hot" title="Želi aplikaciju" />}<strong>{l.business_name ?? "—"}</strong></div></td>
                        <td>{l.name}<span className="a-sub">{l.email}</span></td>
                        <td>{l.industry ? industryByKey(l.industry).name : "—"}</td>
                        <td>{l.estimate?.plan ? l.estimate.plan.toUpperCase() : "—"}</td>
                        <td><span className={`a-pill is-${l.status}`}>{statusLabel(l.status)}</span></td>
                        <td className="a-num">{when(l.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : view === "offers" ? (
          <OffersList offers={offers} onOpenLead={(id) => { const l = leads.find((x) => x.id === id); if (l) { setView("leads"); setOpen(l); } }} />
        ) : (
          <ProjectsList projects={projects} onOpen={setOpenProject} onRefresh={load} />
        )}
      </main>

      <AnimatePresence>
        {open && <LeadDrawer key={open.id} lead={open} onClose={() => setOpen(null)} onChange={updateLead} onOffer={load} />}
      </AnimatePresence>
      <AnimatePresence>
        {openProject && <ProjectDrawer key={openProject.id} project={openProject} onClose={() => setOpenProject(null)} onChange={(u) => { setProjects((ps) => ps.map((x) => (x.id === u.id ? u : x))); setOpenProject(u); }} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return <div className={`a-stat ${hot ? "is-hot" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function OffersList({ offers, onOpenLead }: { offers: OfferRow[]; onOpenLead: (leadId: string) => void }) {
  return (
    <>
      <div className="a-head"><h1>Ponude</h1></div>
      {offers.length === 0 ? <div className="a-empty">Još nema ponuda. Otvorite lead i kliknite „Generate offer“.</div> : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Broj</th><th>Biznis</th><th>Iznos</th><th>Status</th><th>Napravljena</th><th></th></tr></thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} onClick={() => onOpenLead(o.lead_id)}>
                  <td className="a-num"><strong>{o.number}</strong></td>
                  <td>{o.leads?.business_name ?? "—"}</td>
                  <td className="a-num">{money(o.total)}{o.monthly ? <span className="a-sub">+ {money(o.monthly)} mesečno</span> : null}</td>
                  <td><span className={`a-pill is-offer-${o.status}`}>{OFFER_STATUS[o.status] ?? o.status}</span></td>
                  <td className="a-num">{when(o.created_at)}</td>
                  <td><a href={`/ponuda/${o.public_token}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="b-link">Otvori</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── detalj leada ───────────────────────── */

function LeadDrawer({ lead, onClose, onChange, onOffer }: { lead: Lead; onClose: () => void; onChange: (l: Lead) => void; onOffer: () => void }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [demoSlug, setDemoSlug] = useState<string | null>(null);
  const [acts, setActs] = useState<Activity[]>([]);
  const [note, setNote] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [leadOffers, setLeadOffers] = useState<OfferRow[]>([]);
  const modules = lead.modules.filter((m): m is ModuleKey => m in MODULES);
  const est = estimate(modules);

  const loadActs = useCallback(() => {
    db.from("lead_activities").select("id,type,body,created_at").eq("lead_id", lead.id).order("created_at", { ascending: false }).then(({ data }) => setActs((data ?? []) as Activity[]));
    db.from("offers").select("id,number,status,total,monthly,public_token,created_at,lead_id").eq("lead_id", lead.id).order("created_at", { ascending: false })
      .then(({ data }) => setLeadOffers(((data ?? []) as OfferRow[]).map((r) => ({ ...r, total: Number(r.total) }))));
  }, [lead.id]);

  useEffect(() => {
    loadActs();
    if (lead.demo_id) db.from("demos").select("slug,config").eq("id", lead.demo_id).single().then(({ data }) => {
      if (!data) return;
      setDemoSlug(data.slug);
      const clean = JSON.parse(JSON.stringify(data.config), (_k, v) => (v === null ? undefined : v));
      if (clean?.content?.photos) clean.content.photos = clean.content.photos.filter(Boolean);
      const p = AppConfigSchema.safeParse(clean);
      if (p.success) setConfig(p.data);
    });
  }, [lead.demo_id, loadActs]);

  const setStatus = async (status: Status) => {
    const { error } = await db.from("leads").update({ status }).eq("id", lead.id);
    if (error) return;
    await db.from("lead_activities").insert({ lead_id: lead.id, type: "status", body: `Status: ${statusLabel(status)}` });
    onChange({ ...lead, status });
    loadActs();
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await db.from("lead_activities").insert({ lead_id: lead.id, type: "napomena", body: note.trim() });
    setNote("");
    loadActs();
  };

  return (
    <>
      <motion.div className="a-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside className="a-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }} aria-label="Detalji leada">
        <div className="a-drawer-head">
          <div>
            <h2>{lead.business_name}</h2>
            <span className="a-sub">{lead.industry ? industryByKey(lead.industry).name : ""} · stigao {when(lead.created_at)}{lead.priority ? " · želi aplikaciju" : ""}</span>
          </div>
          <button type="button" className="a-close" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
        </div>

        <div className="a-drawer-body">
          <div className="a-col">
            <section className="a-box">
              <h3>Kontakt</h3>
              <dl className="a-dl">
                <div><dt>Ime</dt><dd>{lead.name ?? "—"}</dd></div>
                <div><dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div>
                <div><dt>Telefon</dt><dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : "—"}</dd></div>
                <div><dt>Izvor</dt><dd>{lead.utm?.utm_campaign ? `${lead.source} · ${lead.utm.utm_campaign}` : lead.source ?? "direktno"}</dd></div>
              </dl>
            </section>

            <section className="a-box">
              <h3>Status</h3>
              <select className="a-select" id="lead-status" value={lead.status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </section>

            <section className="a-box">
              <h3>Interna procena</h3>
              <dl className="a-dl">
                <div><dt>Paket</dt><dd>{est.plan.toUpperCase()}</dd></div>
                <div><dt>Okvirna cena</dt><dd>{est.priceOnce ? `${money(est.priceOnce)} + ${money(est.priceMonthly ?? 0)}/mes` : "po ponudi"}</dd></div>
                <div><dt>Procenjeno vreme</dt><dd>{est.hours} h rada</dd></div>
                <div><dt>Kompleksnost</dt><dd>{est.complexity} / 5</dd></div>
              </dl>
              <p className="a-sub">{est.reasons.join(". ")}</p>
              <div className="a-chips">{modules.map((m) => <span key={m} className={`b-tier is-${MODULES[m].tier}`}>{MODULES[m].name}</span>)}</div>
            </section>

            <section className="a-box">
              <div className="a-box-head"><h3>Ponude</h3><button type="button" className="b-btn" onClick={() => setOfferOpen(true)}>Generate offer</button></div>
              {leadOffers.length === 0 ? <p className="a-sub">Još nema ponude za ovaj lead.</p> : leadOffers.map((o) => (
                <div key={o.id} className="a-offer-row">
                  <span><strong>{o.number}</strong> · {money(o.total)}</span>
                  <span className={`a-pill is-offer-${o.status}`}>{OFFER_STATUS[o.status]}</span>
                  <a className="b-link" href={`/ponuda/${o.public_token}`} target="_blank" rel="noreferrer">Otvori</a>
                </div>
              ))}
            </section>

            <section className="a-box">
              <h3>Beleške i istorija</h3>
              <div className="a-note-form">
                <textarea id="lead-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Npr. pozvao, želi rezervacije za 3 lokala…" />
                <button type="button" className="b-btn" onClick={addNote} disabled={!note.trim()}>Dodaj</button>
              </div>
              <ul className="a-timeline">
                {acts.map((a) => <li key={a.id}><span className="a-sub">{when(a.created_at)}</span>{a.body}</li>)}
                {acts.length === 0 && <li className="a-sub">Još nema beleški.</li>}
              </ul>
            </section>
          </div>

          <div className="a-demo">
            {config ? (
              <>
                <div className="a-demo-phone"><Phone config={config} /></div>
                {demoSlug && <a className="b-link" href={`/d/${demoSlug}`} target="_blank" rel="noreferrer">Otvori deljivi link demoa</a>}
              </>
            ) : <div className="a-empty">Demo nije sačuvan uz ovaj lead.</div>}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {offerOpen && <OfferEditor lead={lead} modules={modules} onClose={() => setOfferOpen(false)} onSaved={(status) => {
          setOfferOpen(false); loadActs(); onOffer();
          if (status === "poslata" && ["nov", "kontaktiran", "poziv_zakazan"].includes(lead.status)) setStatus("ponuda_poslata");
        }} />}
      </AnimatePresence>
    </>
  );
}

/* ───────────────────────── Generate offer ───────────────────────── */

function defaultOffer(modules: ModuleKey[]) {
  const est = estimate(modules);
  const plan = est.plan;
  const items: OfferItem[] = [
    { name: `Mobilna aplikacija za iOS i Android, paket ${plan.toUpperCase()}`, description: "Izrada iz demoa koji ste odobrili, sa vašim logom, bojama i sadržajem" },
    ...modules.map((m) => ({ name: MODULES[m].name, description: MODULES[m].description })),
    { name: "Admin panel", description: "Sami menjate sadržaj, cene, termine i šaljete obaveštenja" },
    { name: "Priprema za App Store i Google Play", description: "Opis, slike ekrana, podaci o privatnosti i predaja na pregled" },
  ];
  const phases: OfferPhase[] = [
    { name: "Dizajn i izrada", duration: plan === "start" ? "24–48h od uplate depozita i materijala" : plan === "business" ? "5–7 radnih dana" : "po dogovoru" },
    { name: "Testiranje sa vama", duration: "1–2 dana" },
    { name: "Predaja na App Store i Google Play", duration: "isti dan posle vaše potvrde" },
    { name: "Pregled Apple-a i Google-a", duration: "određuju platforme, obično od jednog do nekoliko dana" },
  ];
  const valid = new Date(); valid.setDate(valid.getDate() + 14);
  return { plan, items, phases, total: est.priceOnce ?? 2900, monthly: est.priceMonthly ?? 39, deposit: 50, validUntil: valid.toISOString().slice(0, 10) };
}

function OfferEditor({ lead, modules, onClose, onSaved }: { lead: Lead; modules: ModuleKey[]; onClose: () => void; onSaved: (status: "nacrt" | "poslata") => void }) {
  const init = useMemo(() => defaultOffer(modules), [modules]);
  const [items, setItems] = useState(init.items);
  const [total, setTotal] = useState(String(init.total));
  const [monthly, setMonthly] = useState(String(init.monthly));
  const [deposit, setDeposit] = useState(String(init.deposit));
  const [validUntil, setValidUntil] = useState(init.validUntil);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ token: string; number: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const save = async (status: "nacrt" | "poslata") => {
    const t = Number(total.replace(",", ".")), m = monthly ? Number(monthly.replace(",", ".")) : null, d = Number(deposit);
    if (!(t > 0)) return setError("Upišite ukupan iznos veći od nule.");
    if (!(d >= 0 && d <= 100)) return setError("Depozit mora biti između 0 i 100%.");
    setSaving(true); setError("");
    const { data: num } = await db.rpc("next_offer_number");
    const { data, error } = await db.from("offers").insert({
      number: num ?? `MA-${Date.now()}`, lead_id: lead.id, plan_key: init.plan === "custom" ? "custom" : init.plan,
      items: items.filter((i) => i.name.trim()), phases: init.phases, total: t, monthly: m, deposit_pct: d, valid_until: validUntil, status,
    }).select("public_token, number").single();
    setSaving(false);
    if (error || !data) return setError("Čuvanje ponude nije uspelo. Pokušajte ponovo.");
    await db.from("lead_activities").insert({ lead_id: lead.id, type: "status", body: `Ponuda ${data.number} ${status === "poslata" ? "napravljena i spremna za slanje" : "sačuvana kao nacrt"}` });
    if (status === "nacrt") return onSaved("nacrt");
    setDone({ token: data.public_token, number: data.number });
  };

  const link = done ? `${location.origin}/ponuda/${done.token}` : "";

  return (
    <motion.div className="b-modal-scrim a-offer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="b-modal a-offer-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
        {done ? (
          <>
            <h2>Ponuda {done.number} je spremna</h2>
            <p className="b-hint">Pošaljite link klijentu emailom ili porukom. Videćete kada je otvori i prihvati.</p>
            <div className="a-link-row"><input id="offer-link" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button type="button" className="b-btn" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* ručno kopiranje */ } }}>{copied ? "Kopirano" : "Kopiraj"}</button></div>
            <div className="b-modal-actions">
              <a className="b-btn is-ghost" href={link} target="_blank" rel="noreferrer">Otvori ponudu</a>
              <button type="button" className="b-btn" onClick={() => onSaved("poslata")}>Gotovo</button>
            </div>
          </>
        ) : (
          <>
            <h2>Ponuda za {lead.business_name}</h2>
            <p className="b-hint">Stavke su popunjene iz demoa. Izmenite šta treba pre slanja.</p>
            <div className="a-items">
              {items.map((it, i) => (
                <div key={i} className="a-item">
                  <input aria-label="Naziv stavke" value={it.name} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input aria-label="Opis stavke" className="a-item-desc" value={it.description ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  <button type="button" className="a-item-del" aria-label="Ukloni stavku" onClick={() => setItems(items.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
                </div>
              ))}
              <button type="button" className="b-link" onClick={() => setItems([...items, { name: "", description: "" }])}>+ Dodaj stavku</button>
            </div>
            <div className="a-offer-grid">
              <label className="b-field"><span>Ukupno, jednokratno (€)</span><input id="offer-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
              <label className="b-field"><span>Mesečno (€)</span><input id="offer-monthly" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
              <label className="b-field"><span>Depozit (%)</span><input id="offer-deposit" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></label>
              <label className="b-field"><span>Važi do</span><input id="offer-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
            </div>
            {error && <p className="b-error" role="alert">{error}</p>}
            <div className="b-modal-actions">
              <button type="button" className="b-btn is-ghost" onClick={onClose}>Odustani</button>
              <button type="button" className="b-btn is-ghost" onClick={() => save("nacrt")} disabled={saving}>Sačuvaj nacrt</button>
              <button type="button" className="b-btn" onClick={() => save("poslata")} disabled={saving}>{saving ? "Čuvamo…" : "Napravi link za klijenta"}</button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── projekti ───────────────────────── */

function ProjectsList({ projects, onOpen, onRefresh }: { projects: ProjectRow[]; onOpen: (p: ProjectRow) => void; onRefresh: () => void }) {
  return (
    <>
      <div className="a-head"><h1>Projekti</h1><button type="button" className="b-btn is-ghost" onClick={onRefresh}>Osveži</button></div>
      {projects.length === 0 ? <div className="a-empty">Projekat se pravi automatski kada klijent plati depozit.</div> : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Aplikacija</th><th>Klijent</th><th>Faza</th><th>Plaćeno</th><th>Cena</th><th>Ažurirano</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const paid = p.payments.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0);
                return (
                  <tr key={p.id} onClick={() => onOpen(p)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(p)}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.leads?.name ?? "—"}<span className="a-sub">{p.leads?.email}</span></td>
                    <td><span className={`a-pill is-stage-${p.stage}`}>{stageLabel(p.stage)}</span></td>
                    <td className="a-num">{money(paid)}</td>
                    <td className="a-num">{p.agreed_price ? money(Number(p.agreed_price)) : "—"}</td>
                    <td className="a-num">{when(p.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ProjectDrawer({ project, onClose, onChange }: { project: ProjectRow; onClose: () => void; onChange: (p: ProjectRow) => void }) {
  const [stage, setStage] = useState(project.stage);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState({ appstore: project.store_links?.appstore ?? "", play: project.store_links?.play ?? "" });
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [copied, setCopied] = useState(false);
  const portal = `${location.origin}/projekat/${project.public_token}`;
  const paid = project.payments.filter((x) => x.status === "paid");
  const paidSum = paid.reduce((s, x) => s + Number(x.amount), 0);

  const config = useMemo(() => {
    const clean = JSON.parse(JSON.stringify(project.config ?? {}), (_k, v) => (v === null ? undefined : v));
    if (clean?.content?.photos) clean.content.photos = clean.content.photos.filter(Boolean);
    const r = AppConfigSchema.safeParse(clean);
    return r.success ? r.data : null;
  }, [project.config]);

  const loadComments = useCallback(() => {
    db.from("project_comments").select("id,body,internal,author_id,created_at").eq("project_id", project.id).order("created_at")
      .then(({ data }) => setComments((data ?? []) as CommentRow[]));
  }, [project.id]);
  useEffect(() => { loadComments(); }, [loadComments]);

  const saveStage = async () => {
    setSaving(true); setSaved("");
    const def = STAGES.find(([k]) => k === stage)?.[2] ?? null;
    const stage_note = note.trim() || def;
    const store_links = { ...(links.appstore.trim() ? { appstore: links.appstore.trim() } : {}), ...(links.play.trim() ? { play: links.play.trim() } : {}) };
    const { error } = await db.from("projects").update({ stage, stage_note, store_links }).eq("id", project.id);
    setSaving(false);
    if (error) { setSaved("Čuvanje nije uspelo."); return; }
    if (project.lead_id) {
      const leadStatus = stage === "objavljeno" ? "zavrseno" : ["izrada", "testiranje", "spremno", "prodavnice"].includes(stage) ? "projekat_u_izradi" : null;
      if (leadStatus) await db.from("leads").update({ status: leadStatus }).eq("id", project.lead_id);
    }
    setNote(""); setSaved("Sačuvano. Klijent vidi novu fazu u portalu.");
    onChange({ ...project, stage, stage_note, store_links, updated_at: new Date().toISOString() });
  };

  const send = async () => {
    if (!msg.trim()) return;
    const { data: u } = await db.auth.getUser();
    await db.from("project_comments").insert({ project_id: project.id, author_id: u.user?.id, body: msg.trim(), internal });
    setMsg(""); loadComments();
  };

  return (
    <>
      <motion.div className="a-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside className="a-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }} aria-label="Projekat">
        <div className="a-drawer-head">
          <div><h2>{project.name}</h2><span className="a-sub">{project.leads?.name} · {project.leads?.email}{project.leads?.phone ? ` · ${project.leads.phone}` : ""}</span></div>
          <button type="button" className="a-close" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
        </div>
        <div className="a-drawer-body">
          <div className="a-col">
            <section className="a-box">
              <h3>Portal klijenta</h3>
              <div className="a-link-row">
                <input id="portal-link" readOnly value={portal} onFocus={(e) => e.target.select()} />
                <button type="button" className="b-btn" onClick={async () => { try { await navigator.clipboard.writeText(portal); setCopied(true); } catch { /* ručno */ } }}>{copied ? "Kopirano" : "Kopiraj"}</button>
              </div>
              <p className="a-sub">Pošaljite ovaj link klijentu. Preko njega prati fazu, plaća ostatak i piše vam poruke.</p>
            </section>

            <section className="a-box">
              <h3>Faza</h3>
              <select className="a-select" id="project-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <label className="b-field a-mt"><span>Poruka klijentu uz fazu (nije obavezno)</span>
                <input id="stage-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={STAGES.find(([k]) => k === stage)?.[2]} /></label>
              {(stage === "prodavnice" || stage === "objavljeno") && (
                <div className="a-offer-grid a-two">
                  <label className="b-field"><span>App Store link</span><input id="link-appstore" value={links.appstore} onChange={(e) => setLinks({ ...links, appstore: e.target.value })} placeholder="https://apps.apple.com/…" /></label>
                  <label className="b-field"><span>Google Play link</span><input id="link-play" value={links.play} onChange={(e) => setLinks({ ...links, play: e.target.value })} placeholder="https://play.google.com/…" /></label>
                </div>
              )}
              <div className="a-row"><button type="button" className="b-btn" onClick={saveStage} disabled={saving}>{saving ? "Čuvamo…" : "Sačuvaj fazu"}</button>{saved && <span className="a-sub">{saved}</span>}</div>
            </section>

            <section className="a-box">
              <h3>Uplate</h3>
              <dl className="a-dl">
                <div><dt>Cena</dt><dd>{project.agreed_price ? money(Number(project.agreed_price)) : "—"}</dd></div>
                <div><dt>Plaćeno</dt><dd>{money(paidSum)}</dd></div>
                <div><dt>Mesečno</dt><dd>{project.monthly_price ? money(Number(project.monthly_price)) : "—"}</dd></div>
              </dl>
              {paid.map((x, i) => <div key={i} className="a-offer-row"><span>{x.kind === "deposit" ? "Depozit" : x.kind === "balance" ? "Ostatak" : "Ceo iznos"}</span><span className="a-num">{money(Number(x.amount))}</span></div>)}
            </section>

            <section className="a-box">
              <h3>Poruke</h3>
              <ul className="a-thread">
                {comments.length === 0 && <li className="a-sub">Još nema poruka.</li>}
                {comments.map((c) => (
                  <li key={c.id} className={c.internal ? "is-internal" : c.author_id ? "is-team" : "is-client"}>
                    <span className="a-sub">{c.internal ? "Interno" : c.author_id ? "Vi" : "Klijent"} · {when(c.created_at)}</span>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
              <div className="a-note-form">
                <textarea id="project-reply" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={internal ? "Interna beleška, klijent je ne vidi" : "Odgovor klijentu"} />
                <button type="button" className="b-btn" onClick={send} disabled={!msg.trim()}>Pošalji</button>
              </div>
              <label className="b-consent"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /><span>Interna beleška (klijent je ne vidi)</span></label>
            </section>
          </div>
          <div className="a-demo">
            {config ? <div className="a-demo-phone"><Phone config={config} /></div> : <div className="a-empty">Nema sačuvanog demoa.</div>}
            <a className="b-link" href={portal} target="_blank" rel="noreferrer">Otvori portal kao klijent</a>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
