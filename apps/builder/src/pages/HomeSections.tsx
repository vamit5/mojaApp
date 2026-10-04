import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey } from "@mojapp/core";
import { igLink, initials, waLink, type PortfolioItem, type Team } from "../lib/siteContent";
import "./shot.css";

/** Fotografija osobe ili inicijali dok fotografija nije postavljena. */
export function Avatar({ team, size }: { team: Team; size: number }) {
  return team.photo
    ? <img className="h-avatar" src={team.photo} alt={team.name} width={size} height={size} style={{ width: size, height: size }} />
    : <span className="h-avatar is-initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials(team.name)}</span>;
}

export function ContactButtons({ team }: { team: Team }) {
  const wa = waLink(team.whatsapp);
  const ig = igLink(team.instagram);
  if (!wa && !ig && !team.email) return null;
  return (
    <div className="h-contact">
      {wa && <a className="b-btn" href={wa} target="_blank" rel="noreferrer"><Icon name="phone" size={18} />WhatsApp</a>}
      {ig && <a className="b-btn is-ghost" href={ig} target="_blank" rel="noreferrer"><Icon name="image" size={18} />Instagram</a>}
      {team.email && <a className="b-btn is-ghost" href={`mailto:${team.email}`}><Icon name="bell" size={18} />{team.email}</a>}
    </div>
  );
}

const TEAM_TEXT = [
  "MojApp je tim koji pravi mobilne aplikacije za male i srednje biznise. Osnovao ga je Borislav Kukić, koji je za svoj biznis napravio VAMIT-5 aplikaciju koju članovi koriste svakog dana.",
  "Ne krećemo od nule. Aplikaciju sastavljamo od proverenih modula i prilagođavamo tvom biznisu, a dizajn, testiranje i objavu na App Store i Google Play radi i proverava naš tim. Zato smo brzi, a ti plaćaš tek kad ti se aplikacija svidi.",
];

export function About({ team }: { team: Team }) {
  const paragraphs = (team.bio ?? "").split(/\n\s*\n/).filter(Boolean);
  return (
    <section className="h-section h-about" id="o-meni" aria-labelledby="o-meni-h">
      <div className="h-about-photo">
        {team.photo ? <img src={team.photo} alt={team.name} loading="lazy" /> : <div className="h-about-ph"><span>{initials(team.name)}</span></div>}
      </div>
      <div className="h-about-text">
        <h2 id="o-meni-h">Ko stoji iza MojApp-a</h2>
        <p className="h-about-name"><strong>{team.name}</strong>{team.role ? `, ${team.role}` : ""}{team.city ? ` · ${team.city}` : ""}</p>
        {(paragraphs.length ? paragraphs : TEAM_TEXT).map((p, i) => <p key={i} className="h-about-p">{p}</p>)}
        {!!team.highlights?.length && (
          <ul className="h-about-list">{team.highlights.map((h) => <li key={h}><Icon name="check" size={16} />{h}</li>)}</ul>
        )}
        <ContactButtons team={team} />
      </div>
    </section>
  );
}

/** Pravi snimak ekrana u okviru telefona (slika, bez skaliranja koje bi širilo stranicu). */
export function ScreenShot({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="h-shot">
      <div className="h-shot-screen">{src ? <img src={src} alt={alt} loading="lazy" /> : <span className="h-shot-empty">{alt}</span>}</div>
    </div>
  );
}

const kindLabel = (k: PortfolioItem["kind"]) => (k === "client" ? "Realizovan projekat" : "DEMO projekat");

export function Projects({ items }: { items: PortfolioItem[] }) {
  const [open, setOpen] = useState<PortfolioItem | null>(null);
  if (!items.length) return null;
  return (
    <section className="h-section" id="projekti" aria-labelledby="projekti-h">
      <h2 id="projekti-h">Aplikacije koje smo napravili</h2>
      <p className="h-lead">Prave aplikacije koje ljudi svakog dana koriste. Klikni na projekat za detalje.</p>
      <div className="h-projects">
        {items.map((p) => (
          <button type="button" key={p.id} className="h-project" onClick={() => setOpen(p)}>
            <ScreenShot src={p.images[0]} alt={p.title} />
            <div className="h-project-body">
              <span className={`h-kind is-${p.kind}`}>{kindLabel(p.kind)}</span>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
              <span className="h-project-foot">{p.headline && <strong>{p.headline}</strong>}<span className="h-project-more">Detalji <Icon name="chevronRight" size={16} /></span></span>
            </div>
          </button>
        ))}
      </div>
      <AnimatePresence>{open && <CaseStudy item={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  );
}

function CaseStudy({ item, onClose }: { item: PortfolioItem; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <motion.div className="h-case-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.article className="h-case" role="dialog" aria-label={item.title} onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
        <button type="button" className="h-case-close" onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
        <div className="h-case-shots">{item.images.map((src, i) => <ScreenShot key={i} src={src} alt={`${item.title}, ekran ${i + 1}`} />)}</div>
        <div className="h-case-body">
          <span className={`h-kind is-${item.kind}`}>{kindLabel(item.kind)}</span>
          <h3>{item.title}</h3>
          <p className="h-case-meta">{industryByKey(item.industry).name}{item.headline ? ` · ${item.headline}` : ""}</p>
          <p>{item.summary}</p>
          {item.problem && <><h4>Problem</h4><p>{item.problem}</p></>}
          {item.solution && <><h4>Rešenje</h4><p>{item.solution}</p></>}
          {item.features.length > 0 && <><h4>Funkcije</h4><ul>{item.features.map((f) => <li key={f}><Icon name="check" size={16} />{f}</li>)}</ul></>}
          {item.link && <a className="b-btn is-big" href={item.link} target="_blank" rel="noreferrer">Otvori aplikaciju</a>}
        </div>
      </motion.article>
    </motion.div>
  );
}
