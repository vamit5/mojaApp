import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createConfig, INDUSTRIES, PLANS } from "@mojapp/core";
import { Icon } from "@mojapp/ui";
import { Phone } from "../components/Phone";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import { FAQ, HOW_IT_WORKS } from "../content";
import { useSiteContent, waLink, igLink, type Team } from "../lib/siteContent";
import { countdown, eur, useOffer } from "../lib/offer";
import { About, Avatar, Projects } from "./HomeSections";
import "./home.css";

const HERO_APPS = [
  { key: "salon", name: "Vaš salon" },
  { key: "restoran", name: "Vaš restoran" },
  { key: "fitness", name: "Vaša teretana" },
];

/** Dok fotografija nije postavljena u adminu, koristi se ova. */
const FALLBACK_PHOTO = "/team/borislav.jpg";
const SUPPORT_EMAIL = "moj.app.support@gmail.com";
const FALLBACK_TEAM: Team = { name: "Borislav Kukić", role: "osnivač", city: "Beograd", photo: FALLBACK_PHOTO, email: SUPPORT_EMAIL };

interface Plan { key: string; name: string; once: number | null; monthly: number | null; label?: string; time?: string; features: string[] }

const FALLBACK_PLANS: Plan[] = [
  { key: "start", name: "START", once: PLANS.start.once, monthly: PLANS.start.monthly, time: "24–48h", features: ["Do 6 funkcija iz kataloga", "Tvoj logo, boje i sadržaj", "Admin panel za izmene", "Priprema i predaja na App Store i Google Play"] },
  { key: "business", name: "BUSINESS", once: PLANS.business.once, monthly: PLANS.business.monthly, time: "5–7 radnih dana", features: ["Sve funkcije iz kataloga", "Online plaćanje", "Loyalty, članstvo, kuponi", "Push kampanje i statistika"] },
  { key: "custom", name: "CUSTOM", once: null, monthly: null, label: "od 2.900 €", time: "po ponudi", features: ["Funkcije van kataloga", "Integracije sa tvojim sistemima", "Sopstveni backend"] },
];

function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("pricing_plans").select("key,name,price_once,price_month,price_label,build_time,features").eq("enabled", true).order("position")
      .then(({ data }) => {
        if (!data?.length) return;
        setPlans(data.filter((r) => r.key !== "odrzavanje").map((r) => ({
          key: r.key, name: r.name?.sr ?? r.key, once: r.price_once === null ? null : Number(r.price_once),
          monthly: r.price_month === null ? null : Number(r.price_month), label: r.price_label?.sr, time: r.build_time?.sr, features: r.features ?? [],
        })));
      });
  }, []);
  return plans;
}

/** "od 2.900 €" → 2900 */
const labelNumber = (s?: string) => { const m = s?.replace(/\./g, "").match(/\d+/); return m ? Number(m[0]) : null; };

export function Home() {
  const [heroIdx, setHeroIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sticky, setSticky] = useState(false);
  const plans = usePlans();
  const offer = useOffer();
  const site = useSiteContent();
  const team: Team = site.team ? { ...site.team, photo: site.team.photo || FALLBACK_PHOTO, email: site.team.email || SUPPORT_EMAIL } : FALLBACK_TEAM;
  const portfolio = site.portfolio;
  const wa = waLink(team.whatsapp);
  const startOnce = plans.find((p) => p.key === "start")?.once ?? PLANS.start.once;
  const startMonthly = plans.find((p) => p.key === "start")?.monthly ?? PLANS.start.monthly;
  const heroConfig = useMemo(() => createConfig(HERO_APPS[heroIdx].key, HERO_APPS[heroIdx].name), [heroIdx]);

  useEffect(() => {
    const on = () => setSticky(window.scrollY > 600 && window.innerHeight + window.scrollY < document.body.scrollHeight - 380);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_APPS.length), 7000);
    return () => clearInterval(t);
  }, [paused]);

  const cta = (location: string) => () => track("cta_click", { location });
  const timer = offer.active ? countdown(offer.left) : "";

  return (
    <div className="h-page">
      {offer.active && (
        <a href="#cene" className="h-offerbar" onClick={cta("offerbar")}>
          <span className="h-pulse" aria-hidden="true" />
          <strong>−{offer.percent}% na izradu aplikacije</strong>
          <span className="h-offerbar-time">ističe za <b>{timer}</b></span>
        </a>
      )}

      <header className="h-nav">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" /><span>Moj<span className="h-o">App</span></span></Link>
        <nav aria-label="Glavni meni">
          {portfolio.length > 0 && <a href="#projekti">Radovi</a>}
          <a href="#kako-radi">Kako radi</a>
          <a href="#cene">Cene</a>
          <a href="#o-meni">O nama</a>
        </nav>
        <Link to="/demo" className="b-btn h-nav-cta" onClick={cta("nav")}>Napravi demo</Link>
      </header>

      <section className="h-hero">
        <div className="h-hero-text">
          <div className="h-stores" aria-label="Spremna za App Store i Google Play">
            <span>Spremna za objavu na</span>
            <img src="/badges/app-store.svg" alt="App Store" height={40} />
            <img src="/badges/google-play.png" alt="Google Play" height={40} />
          </div>
          <h1>Tvoja aplikacija za <span className="h-o">24–48h.</span><br />Plaćaš tek kad ti se svidi.</h1>
          <p className="h-hero-sub">Pogledaj besplatno kako izgleda. Naruči izradu <strong>bez plaćanja</strong>. Kad je isprobaš i svidi ti se, platiš i objavljujemo je.</p>
          <div className="h-price">
            <div className="h-price-main">
              <span className="h-price-label">START paket{offer.active ? ` · −${offer.percent}%` : ""}</span>
              <span className="h-price-now">{eur(offer.price(startOnce))}</span>
              {offer.active && <s className="h-price-was">{eur(startOnce)}</s>}
            </div>
            <div className="h-price-side">
              <span>jednokratno, + {eur(startMonthly)}/mes.</span>
              {offer.active ? <span className="h-price-timer">popust ističe za <b>{timer}</b></span> : <span>gotova za 24–48h</span>}
            </div>
          </div>
          <div className="h-hero-actions">
            <Link to="/demo" className="b-btn is-big h-btn-o" onClick={cta("hero")}>Pogledaj svoju aplikaciju besplatno <Icon name="chevronRight" size={18} /></Link>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="b-btn is-big is-ghost" onClick={cta("hero_wa")}>Piši nam na WhatsApp</a>}
          </div>
          <a href="#o-meni" className="h-who">
            <Avatar team={team} size={52} />
            <span><strong>{team.name}, osnivač</strong><span>Iza svake aplikacije stoji naš tim{team.city ? ` · ${team.city}` : ""}</span></span>
          </a>
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
          <p className="h-phone-note">Primer demo aplikacije. Dodirni i klikći.</p>
        </div>
      </section>

      <section className="h-pillars" aria-label="Zašto MojApp">
        <div className="h-pillar is-o">
          <b>{offer.active ? `−${offer.percent}%` : eur(startOnce)}</b>
          <span>{offer.active ? <>Važi još <span className="h-tnum">{timer}</span></> : "START paket, jednokratno"}</span>
        </div>
        <div className="h-pillar"><b>24–48h</b><span>od narudžbine do gotove aplikacije*</span></div>
        <div className="h-pillar"><b>0 €</b><span>unapred. Plaćaš tek kad ti se gotova aplikacija svidi</span></div>
      </section>

      <Projects items={portfolio} />

      <section className="h-section" aria-labelledby="razlika">
        <h2 id="razlika">Isto što i agencije. <span className="h-o">Brže i jeftinije.</span></h2>
        <div className="h-vs">
          <div className="h-vs-row h-vs-head"><span /><span>Klasična agencija</span><span>MojApp</span></div>
          <div className="h-vs-row"><span>Izrada</span><span>nedeljama, često mesecima</span><span><b>24–48h</b></span></div>
          <div className="h-vs-row"><span>Pre plaćanja vidiš</span><span>prezentaciju i ponudu</span><span><b>svoju gotovu aplikaciju</b></span></div>
          <div className="h-vs-row"><span>Cena</span><span>na upit</span><span><b>{offer.active ? `−${offer.percent}%, jasna odmah` : "jasna odmah"}</b></span></div>
        </div>
      </section>

      <section className="h-section" id="kako-radi" aria-labelledby="kako">
        <h2 id="kako">Kako radi</h2>
        <ol className="h-steps">
          {HOW_IT_WORKS.map((s) => (
            <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p><span className="h-step-meta">{s.meta}</span></li>
          ))}
        </ol>
        <div className="h-center"><Link to="/demo" className="b-btn is-big h-btn-o" onClick={cta("how")}>Napravi svoj demo</Link></div>
      </section>

      <section className="h-section" id="cene" aria-labelledby="cene-h">
        <h2 id="cene-h">Cene{offer.active && <span className="h-price-flag">−{offer.percent}% još {timer}</span>}</h2>
        <p className="h-lead">Jednokratna izrada + mali mesečni iznos za hosting, nove verzije iOS-a i Androida i podršku. Izradu naručuješ bez plaćanja, plaćaš tek kad ti se gotova aplikacija svidi.</p>
        <div className="h-plans">
          {plans.map((p) => {
            const regular = p.once ?? labelNumber(p.label);
            const now = regular !== null ? offer.price(regular) : null;
            const prefix = p.once === null ? "od " : "";
            return (
              <div key={p.key} className={`h-plan ${p.key === "start" ? "is-main" : ""}`}>
                <div className="h-plan-name">{p.name}{p.key === "start" && <em>Najčešći izbor</em>}</div>
                {offer.active && regular !== null && <div className="h-plan-old">{prefix}{eur(regular)}</div>}
                <div className="h-plan-price">{now !== null ? `${prefix}${eur(now)}` : p.label ?? "Na upit"}</div>
                <div className="h-plan-month">{p.monthly !== null ? `+ ${eur(p.monthly)} mesečno` : "mesečno po ponudi"}</div>
                {p.time && <div className="h-plan-time">Izrada: {p.time}</div>}
                <ul>{p.features.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <div className="h-center"><Link to="/demo" className="b-btn is-big h-btn-o" onClick={cta("pricing")}>Prvo isprobaj, onda odluči</Link></div>
      </section>

      <About team={team} />

      <section className="h-section" id="pitanja" aria-labelledby="pitanja-h">
        <h2 id="pitanja-h">Pitanja</h2>
        <div className="h-faq">
          {FAQ.map((f) => (
            <details key={f.q}><summary>{f.q}<Icon name="plus" size={18} /></summary><p>{f.a}</p></details>
          ))}
        </div>
        <p className="h-footnote">*Rok od 24–48h odnosi se na izradu START aplikacije od narudžbine i dobijenih materijala. Objava na App Store-u i Google Play-u zavisi od pregleda tih platformi, obično od jednog do nekoliko dana.</p>
      </section>

      <section className="h-final">
        <h2>Pogledaj svoju aplikaciju. <span className="h-o">Sada.</span></h2>
        <p>Besplatno i bez obaveze. Izradu naručuješ bez plaćanja.{offer.active ? ` Popust od ${offer.percent}% ističe za ${timer}.` : ""}</p>
        <Link to="/demo" className="b-btn is-big h-btn-o" onClick={cta("final")}>Pogledaj svoju aplikaciju besplatno</Link>
        {wa && <a className="h-final-wa" href={wa} target="_blank" rel="noreferrer">ili nam piši na WhatsApp</a>}
      </section>

      <AnimatePresence>
        {sticky && (
          <motion.div className="h-sticky" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
            <Link to="/demo" className="b-btn is-big h-btn-o" onClick={cta("sticky")}>Napravi demo{offer.active ? ` · −${offer.percent}%` : " besplatno"}</Link>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="h-footer">
        <div className="h-footer-who"><strong>MojApp</strong><span>{team.name}{team.city ? `, ${team.city}` : ""}</span></div>
        <div className="h-footer-links">
          {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
          {igLink(team.instagram) && <a href={igLink(team.instagram)!} target="_blank" rel="noreferrer">Instagram</a>}
          {team.email && <a href={`mailto:${team.email}`}>{team.email}</a>}
        </div>
        <span className="h-footer-note">© {new Date().getFullYear()} MojApp. Sadržaj u demo aplikacijama označen je kao „Primer“.</span>
      </footer>
    </div>
  );
}
