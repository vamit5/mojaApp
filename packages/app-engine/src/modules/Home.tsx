import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey, type ModuleKey } from "@mojapp/core";
import { allItems, useEngine } from "../state";
import { Btn, PhTag, Photo, Section } from "../primitives";
import { fmtPrice } from "../theme";

export function Home() {
  const { config, state, go, toast } = useEngine();
  const ind = industryByKey(config.industry);
  const has = (m: ModuleKey) => config.modules.includes(m);
  const [viewer, setViewer] = useState<number | null>(null);
  const photos = config.content.photos;
  const featured = allItems(config).filter((i) => i.tag).concat(allItems(config).filter((i) => !i.tag)).slice(0, 4);

  const primaryAction: ModuleKey | null = has("booking") ? "booking" : has("schedule") ? "schedule" : has("menu") ? "menu" : has("services") ? "services" : null;
  const catalogTab: ModuleKey | null = has("menu") ? "menu" : has("services") ? "services" : has("schedule") ? "schedule" : null;

  return (
    <div className="mja-screen">
      <div className="mja-hero">
        <Photo src={photos[0]} seed={config.brand.name + "hero"} className="mja-hero-photo" label={false} />
        <div className="mja-hero-scrim" />
        {!photos[0] && <span className="mja-ph-tag mja-hero-tag">Primer fotografije</span>}
        <div className="mja-hero-text">
          <h1>{config.content.heroTitle}</h1>
          <p>{config.content.heroSubtitle}</p>
          <div className="mja-hero-actions">
            {primaryAction && <Btn onClick={() => go(primaryAction)}>{primaryAction === "booking" || primaryAction === "schedule" ? ind.bookingLabel : "Poruči"}</Btn>}
            {catalogTab && catalogTab !== primaryAction && <Btn variant="light" onClick={() => go(catalogTab)}>Pogledaj {ind.catalogLabel.toLowerCase()}</Btn>}
          </div>
        </div>
      </div>

      {has("loyalty") && (
        <motion.button type="button" className="mja-loyalty-mini" whileTap={{ scale: 0.98 }} onClick={() => go("loyalty")}>
          <Icon name="gift" size={20} />
          <div className="mja-grow">
            <div className="mja-row-title">{state.points} od {config.loyalty.target} {config.loyalty.pointsName}</div>
            <div className="mja-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (state.points / config.loyalty.target) * 100)}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} /></div>
          </div>
          <Icon name="chevronRight" size={18} />
        </motion.button>
      )}

      {has("promotions") && config.promotions.length > 0 && (
        <Section title="Aktuelno">
          <div className="mja-hscroll">
            {config.promotions.map((p) => (
              <motion.div key={p.id} className="mja-promo" whileTap={{ scale: 0.98 }}>
                <div className="mja-promo-title">{p.title}</div>
                <div className="mja-promo-text">{p.text}</div>
                <div className="mja-promo-foot">
                  {p.code ? (
                    <button type="button" className="mja-code" onClick={() => toast(`Kod ${p.code} je kopiran`, "check")}>{p.code}</button>
                  ) : <span />}
                  {p.placeholder && <PhTag />}
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title="Preporučujemo" action={catalogTab ? "Sve" : undefined} onAction={() => catalogTab && go(catalogTab)}>
          <div className="mja-hscroll">
            {featured.map((it, i) => (
              <motion.button type="button" key={it.id} className="mja-feature" whileTap={{ scale: 0.97 }}
                onClick={() => (has("booking") && it.duration && !has("schedule") ? go("booking", it.id) : catalogTab && go(catalogTab))}>
                <Photo src={it.photo ?? photos[(i + 1) % Math.max(1, photos.length)] } seed={it.id} className="mja-feature-photo" label={!it.photo && !photos.length} />
                <div className="mja-feature-name">{it.name}</div>
                <div className="mja-feature-meta">{it.price ? fmtPrice(it.price, config.brand.currency) : it.duration ? `${it.duration} min` : ""}</div>
              </motion.button>
            ))}
          </div>
        </Section>
      )}

      {photos.length > 1 && (
        <Section title="Galerija">
          <div className="mja-gallery">
            {photos.slice(0, 6).map((p, i) => (
              <motion.button type="button" key={i} whileTap={{ scale: 0.96 }} onClick={() => setViewer(i)} aria-label={`Fotografija ${i + 1}`}>
                <Photo src={p} seed={String(i)} className="mja-gallery-photo" />
              </motion.button>
            ))}
          </div>
        </Section>
      )}

      <Section title="O nama">
        <div className="mja-card">
          {config.content.about && <p className="mja-about">{config.content.about}</p>}
          <div className="mja-info-row"><Icon name="clock" size={18} /><span>{config.content.hours}</span></div>
          <div className="mja-info-row"><Icon name="pin" size={18} /><span>{config.content.address}</span></div>
          <div className="mja-info-actions">
            <Btn variant="soft" icon="phone" small onClick={() => toast("U pravoj aplikaciji ovde kreće poziv", "phone")}>Pozovi</Btn>
            <Btn variant="soft" icon="pin" small onClick={() => toast("U pravoj aplikaciji otvara se mapa", "pin")}>Mapa</Btn>
          </div>
        </div>
      </Section>

      <AnimatePresence>
        {viewer !== null && (
          <motion.div className="mja-viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="mja-viewer-close" onClick={() => setViewer(null)} aria-label="Zatvori"><Icon name="x" /></button>
            <motion.div key={viewer} className="mja-viewer-img" style={{ backgroundImage: `url(${photos[viewer]})` }}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} drag="x" dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) setViewer((viewer + 1) % photos.length);
                else if (info.offset.x > 60) setViewer((viewer - 1 + photos.length) % photos.length);
              }} />
            <div className="mja-viewer-count">{viewer + 1} / {photos.length}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
