import { useCallback, useEffect, useState } from "react";
import { AppConfigSchema, type AppConfig } from "@mojapp/core";
import { Icon } from "@mojapp/ui";
import { Phone } from "../components/Phone";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import { startCheckout } from "../lib/payments";
import { money } from "./Offer";
import "./share.css";
import "./project.css";

export const STAGES = [
  ["ideja", "Ideja", "Ponuda je prihvaćena."],
  ["dizajn", "Dizajn", "Prilagođavamo izgled vašem brendu."],
  ["izrada", "Izrada", "Pravimo aplikaciju i povezujemo funkcije."],
  ["testiranje", "Testiranje", "Probate aplikaciju na svom telefonu i javite nam izmene."],
  ["spremno", "Spremno", "Aplikacija je gotova i čeka objavu."],
  ["prodavnice", "App Store / Google Play", "Apple i Google pregledaju aplikaciju."],
  ["objavljeno", "Objavljeno", "Aplikacija je dostupna u prodavnicama."],
] as const;

interface ProjectData {
  name: string; stage: string; stage_note: string | null; store_links: { appstore?: string; play?: string };
  created_at: string; agreed_price: number | null; monthly_price: number | null; config: unknown; client_name: string | null;
  offer: { number: string; total: number; deposit_pct: number; currency: string; token: string } | null;
  history: { stage: string; note: string | null; at: string }[];
  payments: { kind: string; amount: number; currency: string; paid_at: string }[];
  comments: { body: string; from: "client" | "team"; at: string }[];
}

const when = (d: string) => new Date(d).toLocaleString("sr-Latn-RS", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const kindLabel: Record<string, string> = { deposit: "Depozit", balance: "Ostatak", full: "Ceo iznos", subscription: "Mesečno" };

/** Klijentski portal: status izrade, aplikacija, uplate i poruke. Pristup preko tajnog linka, bez lozinke. */
export function Project({ token }: { token: string }) {
  const [p, setP] = useState<ProjectData | null | "missing">(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !/^[a-f0-9]{20,64}$/.test(token)) { setP("missing"); return; }
    const { data, error } = await supabase.rpc("get_project", { p_token: token });
    if (error || !data) { setP("missing"); return; }
    const d = data as ProjectData;
    setP(d);
    document.title = `${d.name} · izrada aplikacije`;
    const clean = JSON.parse(JSON.stringify(d.config ?? {}), (_k, v) => (v === null ? undefined : v));
    if (clean?.content?.photos) clean.content.photos = clean.content.photos.filter(Boolean);
    const parsed = AppConfigSchema.safeParse(clean);
    setConfig(parsed.success ? parsed.data : null);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  if (p === null) return <div className="s-center"><div className="s-spinner" aria-label="Učitavanje" /></div>;
  if (p === "missing") return <div className="s-center s-missing"><h1>Projekat nije pronađen.</h1><p>Proverite link koji ste dobili posle uplate.</p><Link to="/" className="b-btn">Na početnu</Link></div>;

  const idx = Math.max(0, STAGES.findIndex(([k]) => k === p.stage));
  const paidTotal = p.payments.reduce((s, x) => s + Number(x.amount), 0);
  const total = Number(p.offer?.total ?? p.agreed_price ?? 0);
  const remaining = Math.max(0, Math.round((total - paidTotal) * 100) / 100);
  const canPayBalance = remaining > 0 && p.payments.some((x) => x.kind === "deposit") && idx >= 3;
  const lastNote = p.stage_note ?? [...p.history].reverse().find((h) => h.stage === p.stage)?.note ?? STAGES[idx][2];

  const send = async () => {
    if (!msg.trim() || !supabase) return;
    setSending(true); setError("");
    const { data } = await supabase.rpc("add_project_comment", { p_token: token, p_body: msg.trim() });
    setSending(false);
    if (!data) { setError("Poruka nije poslata. Pokušajte ponovo za par minuta."); return; }
    setMsg(""); load();
  };
  const payBalance = async () => {
    setPaying(true); setError("");
    const err = await startCheckout({ project_token: token });
    if (err) { setPaying(false); setError(err); }
  };

  return (
    <div className="pr-page">
      <header className="pr-top">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" />MojApp</Link>
        <span className="pr-top-note">Portal projekta</span>
      </header>

      <main className="pr-main">
        <section className="pr-head">
          <span className="pr-kicker">{p.client_name ? `${p.client_name}, ovo je vaša aplikacija` : "Vaša aplikacija"}</span>
          <h1>{p.name}</h1>
          <div className="pr-now">
            <span className="pr-now-label">Trenutno</span>
            <strong>{STAGES[idx][1]}</strong>
            <p>{lastNote}</p>
          </div>
        </section>

        <ol className="pr-stages" aria-label="Faze projekta">
          {STAGES.map(([k, label], i) => (
            <li key={k} className={i < idx ? "is-done" : i === idx ? "is-now" : ""}>
              <span className="pr-dot">{i < idx ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className="pr-stage-label">{label}</span>
            </li>
          ))}
        </ol>

        {(p.store_links?.appstore || p.store_links?.play) && (
          <section className="pr-card pr-stores">
            <h2>Aplikacija je u prodavnicama</h2>
            <div className="pr-store-links">
              {p.store_links.appstore && <a className="b-btn" href={p.store_links.appstore} target="_blank" rel="noreferrer">App Store</a>}
              {p.store_links.play && <a className="b-btn" href={p.store_links.play} target="_blank" rel="noreferrer">Google Play</a>}
            </div>
          </section>
        )}

        <div className="pr-grid">
          <div className="pr-col">
            <section className="pr-card">
              <h2>Plaćanje</h2>
              <dl className="pr-dl">
                <div><dt>Dogovorena cena</dt><dd>{money(total)}</dd></div>
                {p.monthly_price ? <div><dt>Mesečno, od objave</dt><dd>{money(Number(p.monthly_price))}</dd></div> : null}
                <div><dt>Plaćeno</dt><dd>{money(paidTotal)}</dd></div>
                <div><dt>Preostalo</dt><dd>{money(remaining)}</dd></div>
              </dl>
              {p.payments.length > 0 && (
                <ul className="pr-payments">{p.payments.map((x, i) => <li key={i}><Icon name="check" size={15} /><span>{kindLabel[x.kind] ?? x.kind}</span><span>{money(Number(x.amount))}</span><span className="pr-muted">{new Date(x.paid_at).toLocaleDateString("sr-Latn-RS")}</span></li>)}</ul>
              )}
              {canPayBalance && <button type="button" className="b-btn is-big pr-pay" onClick={payBalance} disabled={paying}><Icon name="card" size={18} />{paying ? "Otvaramo plaćanje…" : `Plati ostatak ${money(remaining)}`}</button>}
              {remaining > 0 && !canPayBalance && <p className="pr-muted">Ostatak plaćate kada aplikacija bude spremna za testiranje.</p>}
              {p.offer && <Link to={`/ponuda/${p.offer.token}`} className="b-link">Ponuda {p.offer.number}</Link>}
            </section>

            <section className="pr-card">
              <h2>Poruke</h2>
              <ul className="pr-thread">
                {p.comments.length === 0 && <li className="pr-muted">Ovde nam pišete izmene, šaljete tekstove ili pitate šta god vas zanima.</li>}
                {p.comments.map((c, i) => (
                  <li key={i} className={c.from === "team" ? "is-team" : "is-client"}>
                    <span className="pr-who">{c.from === "team" ? "MojApp" : "Vi"} · {when(c.at)}</span>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>
              <div className="pr-compose">
                <textarea id="project-message" rows={3} value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} placeholder="Npr. promenite cenu šišanja na 2.600 RSD" />
                <button type="button" className="b-btn" onClick={send} disabled={!msg.trim() || sending}>{sending ? "Šaljemo…" : "Pošalji poruku"}</button>
              </div>
              {error && <p className="b-error" role="alert">{error}</p>}
            </section>

            <section className="pr-card">
              <h2>Istorija</h2>
              <ul className="pr-history">
                {[...p.history].reverse().map((h, i) => (
                  <li key={i}><span className="pr-muted">{when(h.at)}</span><strong>{STAGES.find(([k]) => k === h.stage)?.[1] ?? h.stage}</strong>{h.note && <span>{h.note}</span>}</li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="pr-app">
            {config ? <div className="pr-phone"><Phone config={config} /></div> : <div className="pr-card pr-muted">Prikaz aplikacije stiže uskoro.</div>}
            <p className="pr-muted">Ovo je trenutna verzija vaše aplikacije. Menja se kako napredujemo.</p>
          </aside>
        </div>

        <p className="pr-footnote">Objavljivanje na App Store-u i Google Play-u zavisi od procesa pregleda i odobrenja tih platformi.</p>
      </main>
    </div>
  );
}
