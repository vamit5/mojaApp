import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppEngine } from "@mojapp/app-engine";
import { createConfig, estimate, INDUSTRIES, industryByKey, MODULE_KEYS, MODULES, PLANS, type AppConfig, type ModuleKey } from "@mojapp/core";
import { compressImage, dominantColor, Icon } from "@mojapp/ui";
import { useOffer } from "./lib/offer";
import { track } from "./lib/analytics";
import { Phone } from "./components/Phone";
import { Link } from "./router";
import { submitLead, type LeadInput } from "./lib/leads";

const STEPS = [
  { key: "industry", title: "Čime se bavite?", hint: "Na osnovu toga sastavljamo aplikaciju. Sve kasnije možete promeniti." },
  { key: "name", title: "Kako se zove vaš biznis?", hint: "Naziv se odmah pojavljuje u aplikaciji." },
  { key: "logo", title: "Dodajte logo", hint: "Iz logoa predlažemo boju aplikacije. Ako ga nemate, koristimo inicijale." },
  { key: "photos", title: "Dodajte fotografije", hint: "Do 8 fotografija. Prva je naslovna." },
  { key: "about", title: "Ukratko o vama", hint: "Kupcima u aplikaciji. Možete preskočiti." },
  { key: "features", title: "Šta aplikacija treba da radi?", hint: "Preporučene funkcije su već uključene." },
] as const;

const STORAGE_KEY = "mojapp-demo-v1";
const eur = (n: number | null) => (n == null ? "po ponudi" : `${new Intl.NumberFormat("sr-Latn-RS").format(n)} €`);
const RESPONSE_TIME = "u toku jednog radnog dana"; // u produkciji iz CMS-a (site_settings)

function loadSaved(): { config: AppConfig; step: number; started: boolean } | null {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function Builder() {
  const saved = useMemo(loadSaved, []);
  const urlIndustry = useMemo(() => new URLSearchParams(location.search).get("industry"), []);
  const [config, setConfig] = useState<AppConfig>(() => (urlIndustry && INDUSTRIES.some((i) => i.key === urlIndustry) ? createConfig(urlIndustry, saved?.config.brand.name ?? "Vaš biznis") : saved?.config ?? createConfig("restoran", "Vaš biznis")));
  const [step, setStep] = useState(saved?.step ?? 0);
  const [started, setStarted] = useState(saved?.started ?? false);
  const [ready, setReady] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const [mobilePreview, setMobilePreview] = useState(false);
  const colorsTouched = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, step, started })); } catch { /* fotografije mogu preći kvotu — demo i dalje radi */ }
  }, [config, step, started]);

  const update = (fn: (c: AppConfig) => AppConfig) => setConfig((c) => fn(structuredClone(c)));

  const chooseIndustry = (key: string) => {
    if (!started) { setStarted(true); track("demo_started", { industry: key }); }
    setConfig((c) => {
      const fresh = createConfig(key, c.brand.name);
      return {
        ...fresh,
        brand: { ...fresh.brand, logo: c.brand.logo, mode: c.brand.mode, radius: c.brand.radius, colors: colorsTouched.current ? c.brand.colors : fresh.brand.colors },
        content: { ...fresh.content, photos: c.content.photos, about: c.content.about !== createConfig(c.industry).content.about ? c.content.about : fresh.content.about },
      };
    });
  };

  const go = (i: number) => { setStep(i); track("demo_step", { step: STEPS[i]?.key }); };
  const finish = () => { setReady(true); setIntroKey((k) => k + 1); track("demo_completed", { industry: config.industry, modules: config.modules.length }); };

  const est = estimate(config.modules);

  return (
    <div className="b-root">
      <header className="b-top">
        <Link to="/" className="b-wordmark"><span className="b-mark" aria-hidden="true" /><span>Moj<em>App</em></span></Link>
        <div className="b-steps" aria-label={`Korak ${step + 1} od ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <button type="button" key={s.key} className={`b-step-dot ${i === step ? "is-current" : ""} ${i < step ? "is-done" : ""}`} onClick={() => go(i)} aria-label={`Korak ${i + 1}: ${s.title}`} />
          ))}
          <span className="b-steps-label">Korak {step + 1} od {STEPS.length}</span>
        </div>
        <div className="b-top-note">Besplatno · bez registracije</div>
      </header>

      <main className="b-main">
        <section className="b-panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className="b-step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <h1 className="b-q">{STEPS[step].title}</h1>
              <p className="b-hint">{STEPS[step].hint}</p>
              {step === 0 && <StepIndustry config={config} onPick={chooseIndustry} />}
              {step === 1 && <StepName config={config} update={update} />}
              {step === 2 && <StepLogo config={config} update={update} onColor={() => { colorsTouched.current = true; }} />}
              {step === 3 && <StepPhotos config={config} update={update} />}
              {step === 4 && <StepAbout config={config} update={update} />}
              {step === 5 && <StepFeatures config={config} update={update} />}
            </motion.div>
          </AnimatePresence>

          <div className="b-panel-foot">
            {step > 0 ? <button type="button" className="b-btn is-ghost" onClick={() => go(step - 1)}>Nazad</button> : <span className="b-foot-spacer" />}
            {step < STEPS.length - 1
              ? <button type="button" className="b-btn" onClick={() => { if (step === 0 && !started) chooseIndustry(config.industry); go(step + 1); }}>{step === 0 ? "Napravite moju aplikaciju" : "Dalje"}</button>
              : <button type="button" className="b-btn" onClick={finish}>Završi aplikaciju</button>}
          </div>
        </section>

        <section className="b-stage" aria-label="Pregled aplikacije uživo">
          <Phone config={config} introKey={introKey} />
          <Customizer config={config} update={update} onColor={() => { colorsTouched.current = true; }} />
          <div className="b-trust"><span>Izrađujemo za</span><img src="/badges/app-store.svg" alt="App Store" /><img src="/badges/google-play.png" alt="Google Play" /></div>
          <button type="button" className="b-stage-open" onClick={() => setMobilePreview(true)} aria-label="Otvori aplikaciju preko celog ekrana">
            <span><Icon name="phone" size={13} /> Otvori</span>
          </button>
        </section>
      </main>

      <AnimatePresence>
        {mobilePreview && (
          <motion.div className="b-mobile-preview" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 40 }}>
            <AppEngine config={config} statusBar={false} />
            <button type="button" className="b-mobile-close" onClick={() => setMobilePreview(false)}><Icon name="sliders" size={16} /> Nazad na uređivanje</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ready && <Ready config={config} plan={est.plan} introKey={introKey} onClose={() => setReady(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── koraci ───────────────────────── */

type StepProps = { config: AppConfig; update: (fn: (c: AppConfig) => AppConfig) => void };

function StepIndustry({ config, onPick }: { config: AppConfig; onPick: (k: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <>
      <div className="b-industries">
        {INDUSTRIES.map((ind) => (
          <motion.button type="button" key={ind.key} whileTap={{ scale: 0.96 }} className={`b-ind ${config.industry === ind.key ? "is-active" : ""}`} onClick={() => onPick(ind.key)}>
            <Icon name={ind.icon} size={22} />
            <span>{ind.name}</span>
          </motion.button>
        ))}
      </div>
      <label className="b-field">
        <span>Ili napišite čime se bavite</span>
        <input value={custom} placeholder="npr. škola stranih jezika, pekara, veterinarska ambulanta"
          onChange={(e) => setCustom(e.target.value)} onBlur={() => custom.trim() && config.industry !== "drugo" && onPick("drugo")} />
      </label>
      {custom.trim() && <p className="b-small">Sastavićemo osnovu od najbližih modula. Na pozivu je prilagođavamo vašem poslu.</p>}
    </>
  );
}

function StepName({ config, update }: StepProps) {
  const isDefault = config.brand.name === "Vaš biznis";
  return (
    <>
      <label className="b-field">
        <span>Naziv</span>
        <input autoFocus value={isDefault ? "" : config.brand.name} placeholder="npr. Trattoria Sole" maxLength={40}
          onChange={(e) => update((c) => { c.brand.name = e.target.value || "Vaš biznis"; return c; })} />
      </label>
      <label className="b-field">
        <span>Naslov na početnoj</span>
        <input value={config.content.heroTitle} maxLength={80} onChange={(e) => update((c) => { c.content.heroTitle = e.target.value; return c; })} />
      </label>
      <label className="b-field">
        <span>Podnaslov</span>
        <input value={config.content.heroSubtitle} maxLength={160} onChange={(e) => update((c) => { c.content.heroSubtitle = e.target.value; return c; })} />
      </label>
    </>
  );
}

function Drop({ onFiles, multiple, children, accept = "image/png,image/jpeg,image/webp" }: { onFiles: (f: File[]) => void; multiple?: boolean; children: ReactNode; accept?: string }) {
  const [over, setOver] = useState(false);
  return (
    <label className={`b-drop ${over ? "is-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"))); }}>
      <input type="file" accept={accept} multiple={multiple} onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {children}
    </label>
  );
}

function StepLogo({ config, update, onColor }: StepProps & { onColor: () => void }) {
  const [suggested, setSuggested] = useState<{ color: string; prev: string } | null>(null);
  const [error, setError] = useState("");
  const onFiles = async ([f]: File[]) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError("Logo je veći od 8 MB. Izaberite manji fajl."); return; }
    setError("");
    const url = await compressImage(f, 512, true);
    const color = await dominantColor(url);
    update((c) => {
      if (color) { setSuggested({ color, prev: c.brand.colors.primary }); c.brand.colors.primary = color; }
      c.brand.logo = url;
      return c;
    });
    if (color) onColor();
  };
  return (
    <>
      <Drop onFiles={onFiles}>
        {config.brand.logo
          ? <div className="b-logo-preview" style={{ backgroundImage: `url(${config.brand.logo})` }} />
          : <><Icon name="upload" size={22} /><strong>Prevucite logo ovde</strong><span>ili kliknite da izaberete · PNG, JPG</span></>}
      </Drop>
      {error && <p className="b-error">{error}</p>}
      {suggested && (
        <div className="b-suggest">
          <span className="b-swatch" style={{ background: suggested.color }} />
          <span>Primarna boja je preuzeta iz logoa.</span>
          <button type="button" className="b-link" onClick={() => { update((c) => { c.brand.colors.primary = suggested.prev; return c; }); setSuggested(null); }}>Vrati prethodnu</button>
        </div>
      )}
      {config.brand.logo && <button type="button" className="b-link" onClick={() => update((c) => { delete c.brand.logo; return c; })}>Ukloni logo i koristi inicijale</button>}
    </>
  );
}

function StepPhotos({ config, update }: StepProps) {
  const [busy, setBusy] = useState(false);
  const photos = config.content.photos;
  const onFiles = async (files: File[]) => {
    setBusy(true);
    const room = 8 - photos.length;
    const urls = await Promise.all(files.slice(0, room).filter((f) => f.size < 15 * 1024 * 1024).map((f) => compressImage(f, 1200)));
    update((c) => { c.content.photos = [...c.content.photos, ...urls].slice(0, 8); return c; });
    setBusy(false);
  };
  return (
    <>
      {photos.length < 8 && (
        <Drop onFiles={onFiles} multiple>
          <Icon name="image" size={22} /><strong>{busy ? "Pripremamo fotografije…" : "Prevucite fotografije ovde"}</strong><span>ili kliknite da izaberete · još {8 - photos.length}</span>
        </Drop>
      )}
      {photos.length > 0 && (
        <div className="b-thumbs">
          <AnimatePresence>
            {photos.map((p, i) => (
              <motion.div layout key={p.slice(-40) + i} className="b-thumb" style={{ backgroundImage: `url(${p})` }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
                {i === 0 && <span className="b-thumb-tag">Naslovna</span>}
                <button type="button" aria-label="Ukloni fotografiju" onClick={() => update((c) => { c.content.photos.splice(i, 1); return c; })}><Icon name="x" size={14} /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {photos.length === 0 && <p className="b-small">Bez fotografija aplikacija koristi površine u vašoj boji, označene kao „Primer“.</p>}
    </>
  );
}

function StepAbout({ config, update }: StepProps) {
  return (
    <>
      <label className="b-field">
        <span>Opis</span>
        <textarea rows={4} maxLength={600} value={config.content.about?.startsWith("Primer opisa") ? "" : config.content.about ?? ""}
          placeholder="Šta vas izdvaja, šta kupci kod vas najviše vole…" onChange={(e) => update((c) => { c.content.about = e.target.value; return c; })} />
      </label>
      <div className="b-row">
        <label className="b-field"><span>Adresa</span><input value={config.content.address?.startsWith("Primer") ? "" : config.content.address ?? ""} placeholder="Ulica i broj, grad" onChange={(e) => update((c) => { c.content.address = e.target.value; return c; })} /></label>
        <label className="b-field"><span>Radno vreme</span><input value={config.content.hours ?? ""} onChange={(e) => update((c) => { c.content.hours = e.target.value; return c; })} /></label>
      </div>
    </>
  );
}

function StepFeatures({ config, update }: StepProps) {
  const ind = industryByKey(config.industry);
  const est = estimate(config.modules);
  const offer = useOffer();
  const order = [...ind.modules, ...MODULE_KEYS.filter((m) => !ind.modules.includes(m))];
  const toggle = (m: ModuleKey) => update((c) => {
    c.modules = c.modules.includes(m) ? c.modules.filter((x) => x !== m) : [...c.modules, m];
    return c;
  });
  return (
    <>
      <div className="b-features">
        {order.filter((m) => m !== "home").map((m) => {
          const meta = MODULES[m];
          const on = config.modules.includes(m);
          return (
            <button type="button" key={m} className={`b-feature ${on ? "is-on" : ""}`} onClick={() => toggle(m)} aria-pressed={on}>
              <span className="b-check">{on && <Icon name="check" size={14} />}</span>
              <span className="b-feature-text">
                <span className="b-feature-name">{meta.name}{ind.modules.includes(m) && <em>Preporučeno</em>}</span>
                <span className="b-feature-desc">{meta.description}</span>
              </span>
              <span className={`b-tier is-${meta.tier}`}>{meta.tier === "start" ? "START" : "BUSINESS"}</span>
            </button>
          );
        })}
      </div>
      <motion.div className="b-plan" layout>
        <span>Vaš izbor: <strong>{est.plan === "start" ? "START" : "BUSINESS"}</strong></span>
        <span>{offer.active && <s className="b-old">{eur(est.priceOnce ?? 0)}</s>} {eur(offer.price(est.priceOnce ?? 0))} + {eur(est.priceMonthly)} mesečno</span>
      </motion.div>
      {est.plan === "business" && <p className="b-small">{est.reasons.join(". ")}. Za START isključite BUSINESS funkcije.</p>}
    </>
  );
}

/* ───────────────────────── telefon i customizer ───────────────────────── */

const SWATCHES = ["#9E2B25", "#C2452D", "#8A5A7A", "#5A4FCF", "#2F5D8A", "#2E6E8E", "#3D6B66", "#3F7D3A", "#A0712B", "#1F1F22"];

function Customizer({ config, update, onColor }: StepProps & { onColor: () => void }) {
  const [open, setOpen] = useState<"color" | null>(null);
  const setPrimary = (hex: string) => { onColor(); update((c) => { c.brand.colors.primary = hex; return c; }); };
  const seg = <T extends string>(label: string, value: T, options: [T, string][], set: (v: T) => void) => (
    <div className="b-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button type="button" key={v} role="radio" aria-checked={value === v} className={value === v ? "is-active" : ""} onClick={() => set(v)}>
          {value === v && <motion.span layoutId={`seg-${label}`} className="b-seg-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="b-custom">
      <div className="b-custom-row">
        <button type="button" className="b-color-btn" onClick={() => setOpen(open ? null : "color")} aria-expanded={open === "color"}>
          <span className="b-swatch" style={{ background: config.brand.colors.primary }} />
          <span className="b-swatch is-sm" style={{ background: config.brand.colors.secondary }} />
          Boje
        </button>
        {seg("Režim", config.brand.mode, [["light", "Svetla"], ["dark", "Tamna"]], (v) => update((c) => { c.brand.mode = v; return c; }))}
        {seg("Oblik", config.brand.radius, [["sharp", "Oštro"], ["soft", "Meko"], ["round", "Oblo"]], (v) => update((c) => { c.brand.radius = v; return c; }))}
        {seg("Font", config.brand.fonts, [["modern", "Moderan"], ["editorial", "Elegantan"], ["bold", "Snažan"]], (v) => update((c) => { c.brand.fonts = v; return c; }))}
      </div>
      <AnimatePresence>
        {open === "color" && (
          <motion.div className="b-colors" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="b-colors-inner">
              <span className="b-colors-label">Primarna</span>
              {SWATCHES.map((s) => (
                <button type="button" key={s} className={`b-swatch-btn ${config.brand.colors.primary.toLowerCase() === s.toLowerCase() ? "is-active" : ""}`} style={{ background: s }} onClick={() => setPrimary(s)} aria-label={`Boja ${s}`} />
              ))}
              <label className="b-swatch-btn is-custom" aria-label="Izaberi svoju boju">
                <input type="color" value={config.brand.colors.primary} onChange={(e) => setPrimary(e.target.value)} /><Icon name="plus" size={14} />
              </label>
              <span className="b-colors-label">Sekundarna</span>
              <label className="b-swatch-btn is-custom" style={{ background: config.brand.colors.secondary }} aria-label="Sekundarna boja">
                <input type="color" value={config.brand.colors.secondary} onChange={(e) => { onColor(); const v = e.target.value; update((c) => { c.brand.colors.secondary = v; return c; }); }} />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── završni ekran ───────────────────────── */

function Ready({ config, plan, introKey, onClose }: { config: AppConfig; plan: "start" | "business" | "custom"; introKey: number; onClose: () => void }) {
  const [form, setForm] = useState<LeadInput["intent"] | null>(null);
  const [done, setDone] = useState<{ intent: LeadInput["intent"]; name: string; slug?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const p = plan === "start" ? PLANS.start : PLANS.business;
  const offer = useOffer();

  return (
    <motion.div className="b-ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" className="b-ready-close" onClick={onClose}><Icon name="arrowLeft" size={16} /> Nastavi uređivanje</button>
      <div className="b-ready-grid">
        <motion.div className="b-ready-text" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          {done ? (
            <>
              <h1 className="b-ready-title">Hvala, {done.name.split(" ")[0]}.</h1>
              <p className="b-ready-lead">{done.intent === "want_app"
                ? `Javljamo vam se ${RESPONSE_TIME} sa ponudom za ${config.brand.name}. Demo ostaje sačuvan tačno ovakav kakav jeste.`
                : "Sačuvali smo vaš demo. Otvorite link na telefonu ili ga pošaljite partneru."}</p>
              {done.slug && (
                <div className="b-share">
                  <span>Link ka vašoj aplikaciji</span>
                  <div className="b-share-row">
                    <input id="share-link" readOnly value={`${location.origin}/d/${done.slug}`} onFocus={(e) => e.target.select()} />
                    <button type="button" className="b-btn" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/d/${done.slug}`); setCopied(true); } catch { /* ručno kopiranje */ } }}>{copied ? "Kopirano" : "Kopiraj"}</button>
                  </div>
                  <a className="b-link" href={`/d/${done.slug}`} target="_blank" rel="noreferrer">Otvori u novom prozoru</a>
                </div>
              )}
              {done.intent === "send_demo" && <button type="button" className="b-btn is-big" onClick={() => { setDone(null); setForm("want_app"); }}>Želim ovu aplikaciju</button>}
            </>
          ) : (
            <>
              <h1 className="b-ready-title">Vaša aplikacija je spremna.</h1>
              <p className="b-ready-lead">Klikćite kroz nju: rezervišite, poručite, otvorite profil. Ovako će izgledati {config.brand.name} na telefonu vaših kupaca.</p>
              <div className="b-ready-actions">
                <button type="button" className="b-btn is-big" onClick={() => { setForm("want_app"); track("want_app_click", { plan }); }}>Želim ovu aplikaciju</button>
                <button type="button" className="b-btn is-ghost is-big" onClick={() => setForm("send_demo")}>Pošalji mi demo na email</button>
              </div>
              <dl className="b-facts">
                <div><dt>Paket</dt><dd>{plan === "start" ? "START" : "BUSINESS"}</dd></div>
                <div><dt>Cena{offer.active ? ` (−${offer.percent}%)` : ""}</dt><dd>{offer.active && <s className="b-old">{eur(p.once)}</s>} {eur(offer.price(p.once))} + {eur(p.monthly)} mesečno</dd></div>
                <div><dt>Izrada</dt><dd>{plan === "start" ? "24–48h*" : "5–7 radnih dana*"}</dd></div>
              </dl>
              <p className="b-footnote">*Rok se odnosi na izradu aplikacije. Objavljivanje na App Store-u i Google Play-u zavisi od procesa pregleda i odobrenja tih platformi. Aplikacija se objavljuje na vaš nalog, pa Apple (99 USD godišnje) i Google (25 USD jednom) svoje naknade naplaćuju direktno vama.</p>
            </>
          )}
        </motion.div>
        <motion.div className="b-ready-phone" initial={{ y: 40, opacity: 0, rotate: -2 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
          <Phone config={config} introKey={introKey} />
        </motion.div>
      </div>

      {!done && (
        <div className="b-ready-sticky">
          <button type="button" className="b-btn is-big" onClick={() => { setForm("want_app"); track("want_app_click", { plan, location: "sticky" }); }}>Želim ovu aplikaciju</button>
        </div>
      )}

      <AnimatePresence>
        {form && <LeadForm intent={form} config={config} onClose={() => setForm(null)} onDone={(name, slug) => { setDone({ intent: form, name, slug }); setForm(null); }} />}
      </AnimatePresence>
    </motion.div>
  );
}

function LeadForm({ intent, config, onClose, onDone }: { intent: LeadInput["intent"]; config: AppConfig; onClose: () => void; onDone: (name: string, slug?: string) => void }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", consent: false });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const needPhone = intent === "want_app";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.name.trim().length < 2) return setError("Upišite ime.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return setError("Email adresa nije ispravna. Proverite da li sadrži @ i domen.");
    if (needPhone && v.phone.replace(/\D/g, "").length < 8) return setError("Upišite broj telefona da bismo vas pozvali sa ponudom.");
    if (!v.consent) return setError("Potrebna je saglasnost da bismo vas kontaktirali.");
    setError(""); setSending(true);
    const res = await submitLead({ ...v, intent }, config);
    setSending(false);
    if (!res.ok) return setError(res.error);
    track("lead_created", { intent, industry: config.industry });
    onDone(v.name.trim(), res.demoSlug);
  };

  return (
    <motion.div className="b-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form className="b-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()} noValidate
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 34 }}>
        <h2>{intent === "want_app" ? `Aplikacija za ${config.brand.name}` : "Pošaljite demo na email"}</h2>
        <p className="b-hint">{intent === "want_app" ? "Šaljemo ponudu sa tačnom cenom i rokom. Bez obaveze." : "Dobićete link ka ovom demou."}</p>
        <label className="b-field"><span>Ime i prezime</span><input autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" /></label>
        <label className="b-field"><span>Email</span><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" /></label>
        <label className="b-field"><span>Telefon{needPhone ? "" : " (nije obavezno)"}</span><input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" placeholder="+381" /></label>
        <label className="b-consent"><input type="checkbox" checked={v.consent} onChange={(e) => setV({ ...v, consent: e.target.checked })} /><span>Slažem se da me MojApp kontaktira povodom ove aplikacije.</span></label>
        {error && <p className="b-error" role="alert">{error}</p>}
        <div className="b-modal-actions">
          <button type="button" className="b-btn is-ghost" onClick={onClose}>Odustani</button>
          <button type="submit" className="b-btn" disabled={sending}>{sending ? "Šaljemo…" : intent === "want_app" ? "Pošalji zahtev" : "Pošalji demo"}</button>
        </div>
      </motion.form>
    </motion.div>
  );
}
