import { useEffect, useState } from "react";
import { Icon } from "@mojapp/ui";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import "./share.css";
import "./offer.css";

export interface OfferItem { name: string; description?: string; price?: number }
export interface OfferPhase { name: string; duration: string }
interface OfferData {
  number: string; status: string; plan_key: string | null; items: OfferItem[]; phases: OfferPhase[];
  total: number; monthly: number | null; currency: string; deposit_pct: number; valid_until: string | null; created_at: string;
  client_name: string | null; business_name: string | null; industry: string | null; demo_slug: string | null;
}

export const money = (n: number, cur = "EUR") => `${new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)} ${cur === "EUR" ? "€" : cur}`;
const date = (d: string) => new Date(d).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "long", year: "numeric" });

/** Javna ponuda. Klijent je otvara preko tajnog linka, prihvata je i čuva kao PDF. */
export function Offer({ token }: { token: string }) {
  const [offer, setOffer] = useState<OfferData | null | "missing">(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || !/^[a-f0-9]{20,64}$/.test(token)) { setOffer("missing"); return; }
    supabase.rpc("get_offer", { p_token: token }).then(({ data, error }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) setOffer("missing");
      else { setOffer({ ...row, total: Number(row.total), monthly: row.monthly === null ? null : Number(row.monthly) }); document.title = `Ponuda ${row.number} · MojApp`; }
    });
  }, [token]);

  if (offer === null) return <div className="s-center"><div className="s-spinner" aria-label="Učitavanje" /></div>;
  if (offer === "missing") return (
    <div className="s-center s-missing"><h1>Ponuda nije pronađena.</h1><p>Proverite link iz emaila ili nam se javite.</p><Link to="/" className="b-btn">Na početnu</Link></div>
  );

  const deposit = Math.round(offer.total * offer.deposit_pct) / 100;
  const expired = offer.valid_until ? new Date(offer.valid_until + "T23:59:59") < new Date() : false;
  const accepted = offer.status === "prihvacena";

  const accept = async () => {
    if (!supabase) return;
    setAccepting(true); setError("");
    const { data, error } = await supabase.rpc("accept_offer", { p_token: token });
    setAccepting(false);
    if (error || !data) { setError("Prihvatanje nije uspelo. Ponuda je možda istekla. Javite nam se i poslaćemo novu."); return; }
    setOffer({ ...offer, status: "prihvacena" });
  };

  return (
    <div className="o-page">
      <div className="o-toolbar">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" />MojApp</Link>
        <button type="button" className="b-btn is-ghost" onClick={() => window.print()}><Icon name="upload" size={16} /> Sačuvaj kao PDF</button>
      </div>

      <article className="o-doc">
        <header className="o-head">
          <div>
            <div className="o-brand"><span className="b-mark" aria-hidden="true" />MojApp</div>
            <h1>Ponuda za izradu mobilne aplikacije</h1>
          </div>
          <dl className="o-meta">
            <div><dt>Broj</dt><dd>{offer.number}</dd></div>
            <div><dt>Datum</dt><dd>{date(offer.created_at)}</dd></div>
            {offer.valid_until && <div><dt>Važi do</dt><dd>{date(offer.valid_until)}</dd></div>}
          </dl>
        </header>

        <section className="o-block">
          <h2>Klijent</h2>
          <p><strong>{offer.business_name}</strong>{offer.client_name ? `, ${offer.client_name}` : ""}</p>
          <p className="o-muted">Mobilna aplikacija za iOS i Android{offer.plan_key ? `, paket ${offer.plan_key.toUpperCase()}` : ""}, izrađena na osnovu demoa koji ste napravili{offer.demo_slug ? <> (<Link to={`/d/${offer.demo_slug}`}>pogledaj demo</Link>)</> : null}.</p>
        </section>

        <section className="o-block">
          <h2>Šta je uključeno</h2>
          <table className="o-table">
            <tbody>
              {offer.items.map((it, i) => (
                <tr key={i}><td><strong>{it.name}</strong>{it.description && <span>{it.description}</span>}</td><td className="o-num">{it.price ? money(it.price, offer.currency) : "uključeno"}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Ukupno, jednokratno</td><td className="o-num">{money(offer.total, offer.currency)}</td></tr>
              {offer.monthly !== null && <tr className="o-sub"><td>Mesečno (hosting, ažuriranja, podrška)</td><td className="o-num">{money(offer.monthly, offer.currency)}</td></tr>}
            </tfoot>
          </table>
        </section>

        {offer.phases.length > 0 && (
          <section className="o-block">
            <h2>Faze i rokovi</h2>
            <ol className="o-phases">{offer.phases.map((p, i) => <li key={i}><span>{p.name}</span><span className="o-muted">{p.duration}</span></li>)}</ol>
          </section>
        )}

        <section className="o-block">
          <h2>Plaćanje</h2>
          <p>{offer.deposit_pct}% depozita ({money(deposit, offer.currency)}) pri prihvatanju ponude. Ostatak ({money(offer.total - deposit, offer.currency)}) pre predaje aplikacije na App Store i Google Play. Mesečni iznos počinje od objave aplikacije.</p>
        </section>

        <section className="o-block o-note">
          <h2>Važno</h2>
          <p>Rok izrade odnosi se na izradu aplikacije. Objavljivanje na App Store-u i Google Play-u zavisi od procesa pregleda i odobrenja tih platformi. Aplikacija se objavljuje na vaš Apple Developer (99 USD godišnje) i Google Play (25 USD jednom) nalog; te naknade plaćate direktno Apple-u i Google-u.</p>
        </section>

        <footer className="o-actions">
          {accepted ? (
            <div className="o-accepted"><Icon name="check" size={20} /> Ponuda je prihvaćena. Javljamo vam se sa linkom za uplatu depozita.</div>
          ) : expired ? (
            <div className="o-expired">Ponuda je istekla. Javite nam se i poslaćemo novu.</div>
          ) : (
            <>
              <button type="button" className="b-btn is-big" onClick={accept} disabled={accepting}>{accepting ? "Šaljemo…" : "Prihvatam ponudu"}</button>
              <span className="o-muted">Prihvatanjem ponude ne vrši se plaćanje. Link za uplatu depozita stiže posle potvrde.</span>
            </>
          )}
          {error && <p className="b-error" role="alert">{error}</p>}
        </footer>
      </article>
    </div>
  );
}
