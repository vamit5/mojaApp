import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createConfig, INDUSTRIES, MODULES, MODULE_KEYS, PLANS } from "@mojapp/core";
import { Icon } from "@mojapp/ui";
import { Phone } from "../components/Phone";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { FAQ, HOW_IT_WORKS } from "../content";
import { useSiteContent, waLink, igLink } from "../lib/siteContent";
import { About, Avatar, Projects } from "./HomeSections";
import "./home.css";

const HERO_APPS = [
  { key: "restoran", name: "Vaš restoran" },
  { key: "salon", name: "Vaš salon" },
  { key: "fitness", name: "Vaša teretana" },
];

interface Plan { key: string; name: string; once: number | null; monthly: number | null; label?: string; time?: string; features: string[] }

const FALLBACK_PLANS: Plan[] = [
  { key: "start", name: "START", once: PLANS.start.once, monthly: PLANS.start.monthly, time: "24–48h", features: ["Do 6 modula iz kataloga", "Vaš logo, boje i sadržaj", "Admin panel za izmene", "Priprema i predaja na App Store i Google Play"] },
  { key: "business", name: "BUSINESS", once: PLANS.business.once, monthly: PLANS.business.monthly, time: "5–7 radnih dana", features: ["Svi moduli iz kataloga", "Online plaćanje", "Loyalty, članstvo, kuponi", "Push kampanje i statistika"] },
  { key: "custom", name: "CUSTOM", once: null, monthly: null, label: "od 2.900 €", time: "po ponudi", features: ["Funkcije van kataloga", "Integracije sa vašim sistemima", "Sopstveni backend"] },
];

const eur = (n: number) => `${new Intl.NumberFormat("sr-Latn-RS").format(n)} €`;

/** Cene iz baze (CMS), sa rezervom ako baza nije dostupna. */
function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [maintenance, setMaintenance] = useState<number>(39);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("pricing_plans").select("key,name,price_once,price_month,price_label,build_time,features").eq("enabled", true).order("position")
      .then(({ data }) => {
        if (!data?.length) return;
        const rows = data.map((r) => ({
          key: r.key, name: r.name?.sr ?? r.key, once: r.price_once === null ? null : Number(r.price_once),
          monthly: r.price_month === null ? null : Number(r.price_month), label: r.price_label?.sr, time: r.build_time?.sr, features: r.features ?? [],
        }));
        const m = rows.find((r) => r.key === "odrzavanje");
        if (m?.monthly) setMaintenance(m.monthly);
        setPlans(rows.filter((r) => r.key !== "odrzavanje"));
      });
  }, []);
  return { plans, maintenance };
}

export function Home() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allModules, setAllModules] = useState(false);
  const [sticky, setSticky] = useState(false);
  useEffect(() => {
    const on = () => setSticky(window.scrollY > 700 && window.innerHeight + window.scrollY < document.body.scrollHeight - 420);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const { plans, maintenance } = usePlans();
  const { team, portfolio } = useSiteContent();
  const heroConfig = useMemo(() => createConfig(HERO_APPS[heroIdx].key, HERO_APPS[heroIdx].name), [heroIdx]);

  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_APPS.length), 7000);
    return () => clearInterval(t);
  }, [paused]);

  const cta = (location: string) => () => track("cta_click", { location });

  return (
    <div className="h-page">
      <header className="h-nav">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" />MojApp</Link>
        <nav aria-label="Glavni meni">
          {portfolio.length > 0 && <a href="#projekti">Projekti</a>}
          {team && <a href="#o-meni">O meni</a>}
          <a href="#kako-radi">Kako radi</a>
          <a href="#cene">Cene</a>
          <a href="#pitanja">Pitanja</a>
        </nav>
        <Link to="/demo" className="b-btn h-nav-cta" onClick={cta("nav")}>Napravite demo</Link>
      </header>

      <section className="h-hero">
        <div className="h-hero-text">
          <h1>Izrađujemo mobilne aplikacije za vaš biznis.</h1>
          <p className="h-hero-sub">Prvo je vidite. Zatim je naručite.</p>
          <p className="h-hero-body">Unesite naziv, logo i fotografije. Za par minuta klikćete kroz svoju aplikaciju, besplatno i bez registracije.</p>
          <div className="h-hero-actions">
            <Link to="/demo" className="b-btn is-big" onClick={cta("hero")}>Napravite besplatan demo</Link>
            <a href="#kako-radi" className="b-btn is-ghost is-big">Pogledajte kako radi</a>
          </div>
          {team && (
            <a href="#o-meni" className="h-who">
              <Avatar team={team} size={44} />
              <span><strong>{team.name}</strong><span>Lično vodim svaki projekat{team.city ? ` · ${team.city}` : ""}</span></span>
              <Icon name="chevronRight" size={18} />
            </a>
          )}
        </div>

        <div className="h-hero-phone" onPointerDown={() => setPaused(true)}>
          <div className="h-phone-box"><Phone config={heroConfig} introKey={heroIdx} /></div>
          <div className="h-switch" role="tablist" aria-label="Primer aplikacije">
            {HERO_APPS.map((a, i) => (
              <button key={a.key} type="button" role="tab" aria-selected={heroIdx === i} className={heroIdx === i ? "is-active" : ""}
                onClick={() => { setHeroIdx(i); setPaused(true); }}>
                {heroIdx === i && <motion.span layoutId="hero-switch" className="h-switch-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span>{INDUSTRIES.find((x) => x.key === a.key)?.name}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={paused ? "p" : "a"} className="h-phone-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {paused ? "Primer aplikacije. Rezervišite, poručite, otvorite profil." : "Primer aplikacije. Dodirnite telefon i klikćite."}
            </motion.p>
          </AnimatePresence>
        </div>

        <dl className="h-facts">
          <div><dt>Demo</dt><dd>oko 3 minuta</dd></div>
          <div><dt>Izrada START aplikacije</dt><dd>24–48h*</dd></div>
          <div><dt>Cena</dt><dd>od {eur(PLANS.start.once)}</dd></div>
        </dl>
      </section>

      {team && <About team={team} />}
      <Projects items={portfolio} />

      <section className="h-section" aria-labelledby="biznis">
        <h2 id="biznis">Čime se bavite?</h2>
        <p className="h-lead">Izaberite svoju delatnost i demo kreće sa funkcijama koje joj odgovaraju.</p>
        <div className="h-industries">
          {INDUSTRIES.map((ind) => (
            <Link key={ind.key} to={`/demo?industry=${ind.key}`} className="h-ind" onClick={cta(`industry_${ind.key}`)}>
              <Icon name={ind.icon} size={20} /><span>{ind.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="h-section" id="kako-radi" aria-labelledby="kako">
        <h2 id="kako">Kako radi</h2>
        <ol className="h-steps">
          {HOW_IT_WORKS.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <span className="h-step-meta">{s.meta}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="h-section" aria-labelledby="funkcije">
        <h2 id="funkcije">Šta aplikacija može</h2>
        <p className="h-lead">Birate funkcije koje vam trebaju. Uz svaku piše u kom paketu je.</p>
        <ul className={`h-modules ${allModules ? "is-open" : ""}`}>
          {MODULE_KEYS.map((m) => (
            <li key={m}>
              <div><strong>{MODULES[m].name}</strong><span>{MODULES[m].description}</span></div>
              <em className={`b-tier is-${MODULES[m].tier}`}>{MODULES[m].tier === "start" ? "START" : "BUSINESS"}</em>
            </li>
          ))}
        </ul>
        {!allModules && <button type="button" className="b-btn is-ghost h-more" onClick={() => setAllModules(true)}>Prikaži sve funkcije ({MODULE_KEYS.length})</button>}
      </section>

      <section className="h-section h-transparent" aria-labelledby="jasno">
        <h2 id="jasno">Sve vidite. Sve znate.</h2>
        <div className="h-split">
          <div>
            <h3>Zavisi od nas</h3>
            <ul>
              <li>Izrada START aplikacije za 24–48h od uplate depozita i dobijenih materijala</li>
              <li>Dizajn po vašim bojama, logu i sadržaju</li>
              <li>Priprema opisa, slika i podataka za App Store i Google Play</li>
              <li>Status projekta koji u svakom trenutku vidite u svom portalu</li>
            </ul>
          </div>
          <div>
            <h3>Zavisi od Apple-a i Google-a</h3>
            <ul>
              <li>Pregled i odobrenje aplikacije, obično od jednog do nekoliko dana</li>
              <li>Developer nalog na vaše ime: Apple 99 USD godišnje, Google 25 USD jednom</li>
              <li>Aplikacija se objavljuje na vaš nalog, pa je i vlasništvo vaše</li>
            </ul>
          </div>
        </div>
        <p className="h-footnote">*Rok od 24–48h odnosi se na izradu aplikacije. Objavljivanje na App Store-u i Google Play-u zavisi od procesa pregleda i odobrenja tih platformi.</p>
      </section>

      <section className="h-section" id="cene" aria-labelledby="cene-h">
        <h2 id="cene-h">Cene</h2>
        <p className="h-lead">Jednokratna izrada i mesečni iznos koji pokriva hosting, prilagođavanje novim verzijama iOS-a i Androida i podršku.</p>
        <div className="h-plans">
          {plans.map((p) => (
            <div key={p.key} className={`h-plan ${p.key === "start" ? "is-main" : ""}`}>
              <div className="h-plan-name">{p.name}</div>
              <div className="h-plan-price">{p.once !== null ? eur(p.once) : p.label ?? "Na upit"}</div>
              <div className="h-plan-month">{p.monthly !== null ? `+ ${eur(p.monthly)} mesečno` : "mesečno po ponudi"}</div>
              {p.time && <div className="h-plan-time">Izrada: {p.time}</div>}
              <ul>{p.features.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="h-plan-extra">Ne želite sami da menjate sadržaj? Održavanje: + {eur(maintenance)} mesečno, i mi menjamo umesto vas.</p>
        <div className="h-center"><Link to="/demo" className="b-btn is-big" onClick={cta("pricing")}>Napravite besplatan demo</Link></div>
      </section>

      <section className="h-section" id="pitanja" aria-labelledby="pitanja-h">
        <h2 id="pitanja-h">Pitanja</h2>
        <div className="h-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}<Icon name="plus" size={18} /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="h-final">
        <h2>Vaš biznis. Vaša aplikacija.</h2>
        <p>Napravite demo za par minuta i odlučite kad je vidite.</p>
        <Link to="/demo" className="b-btn is-big is-light" onClick={cta("final")}>Napravite besplatan demo</Link>
      </section>

      <AnimatePresence>
        {sticky && (
          <motion.div className="h-sticky" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
            <Link to="/demo" className="b-btn is-big" onClick={cta("sticky")}>Napravite besplatan demo</Link>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="h-footer">
        <div className="h-footer-who">
          <strong>MojApp</strong>
          {team && <span>{team.name}{team.city ? `, ${team.city}` : ""}</span>}
        </div>
        <div className="h-footer-links">
          {waLink(team?.whatsapp) && <a href={waLink(team?.whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>}
          {igLink(team?.instagram) && <a href={igLink(team?.instagram)!} target="_blank" rel="noreferrer">Instagram</a>}
          {team?.email && <a href={`mailto:${team.email}`}>{team.email}</a>}
        </div>
        <span className="h-footer-note">© {new Date().getFullYear()} MojApp. Primeri sadržaja u demo aplikacijama označeni su kao „Primer“.</span>
      </footer>
    </div>
  );
}
