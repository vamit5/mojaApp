import { animate, AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey } from "@mojapp/core";
import { useEngine } from "./state";

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

/** Industrije za koje postoje primer fotografije (besplatne, Unsplash licenca), 4 po industriji. */
const STOCK = new Set(["restoran", "salon", "fitness", "beauty", "auto", "nekretnine", "shop", "edukacija", "trener", "klub", "booking", "drugo"]);
export const stockPhoto = (industry: string, n: number) => (STOCK.has(industry) ? `/demo-photos/${industry}-${(n % 4) + 1}.jpg` : null);

/** Fotografija klijenta ili jasno označena primer fotografija za njegovu delatnost. */
export function Photo({ src, seed, className = "", label = true, style }: { src?: string; seed: string; className?: string; label?: boolean; style?: React.CSSProperties }) {
  const { config } = useEngine();
  if (src) return <div className={`mja-photo ${className}`} style={{ backgroundImage: `url(${src})`, ...style }} role="img" />;
  const h = hash(seed);
  const stock = stockPhoto(config.industry, seed.endsWith("hero") ? 0 : 1 + (h % 3));
  if (stock) {
    return (
      <div className={`mja-photo is-stock ${className}`} style={{ backgroundImage: `url(${stock})`, ...style }} role="img" aria-label="Primer fotografije">
        {label && <span className="mja-ph-tag">Primer</span>}
      </div>
    );
  }
  const tone = 30 + (h % 45); // procenat mešanja primarne boje sa pozadinom
  return (
    <div className={`mja-photo is-placeholder ${className}`} style={{ background: `color-mix(in srgb, var(--p) ${tone}%, var(--p-soft))`, ...style }} role="img" aria-label="Primer fotografije">
      <Icon name={industryByKey(config.industry).icon} size={44} className="mja-photo-icon" style={{ transform: `rotate(${(h % 30) - 15}deg)` }} />
      {label && <span className="mja-ph-tag">Primer</span>}
    </div>
  );
}

export function PhTag() {
  return <span className="mja-ph-tag is-inline">Primer</span>;
}

export function Btn({ children, variant = "primary", onClick, icon, full, disabled, small }: {
  children: ReactNode; variant?: "primary" | "ghost" | "soft" | "light"; onClick?: () => void; icon?: string; full?: boolean; disabled?: boolean; small?: boolean;
}) {
  return (
    <motion.button type="button" className={`mja-btn is-${variant} ${full ? "is-full" : ""} ${small ? "is-small" : ""}`}
      whileTap={disabled ? undefined : { scale: 0.96 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
      onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={small ? 16 : 18} />}
      <span>{children}</span>
    </motion.button>
  );
}

export function IconBtn({ icon, onClick, label, badge }: { icon: string; onClick?: () => void; label: string; badge?: number }) {
  return (
    <motion.button type="button" className="mja-iconbtn" whileTap={{ scale: 0.88 }} onClick={onClick} aria-label={label}>
      <Icon name={icon} size={20} />
      <AnimatePresence>
        {!!badge && (
          <motion.span key={badge} className="mja-badge" initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 700, damping: 18 }}>{badge}</motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="mja-stepper">
      <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Manje"><Icon name="minus" size={16} /></motion.button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.16 }}>{value}</motion.span>
      </AnimatePresence>
      <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Više"><Icon name="plus" size={16} /></motion.button>
    </div>
  );
}

/** Broj koji se animira do nove vrednosti. */
export function Counter({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => new Intl.NumberFormat("sr-Latn-RS").format(Math.round(v)));
  useEffect(() => { const c = animate(mv, value, { duration, ease: [0.2, 0.8, 0.2, 1] }); return c.stop; }, [value, duration, mv]);
  return <motion.span>{rounded}</motion.span>;
}

/** Donji panel sa prevlačenjem nadole za zatvaranje. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose(); };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="mja-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="mja-sheet" role="dialog" aria-label={title}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}>
            <div className="mja-sheet-grip" />
            {title && <div className="mja-sheet-title">{title}</div>}
            <div className="mja-sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <section className="mja-section">
      <div className="mja-section-head">
        <h2>{title}</h2>
        {action && <button type="button" className="mja-link" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mja-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mja-skel-row"><div className="mja-skel-img" /><div className="mja-skel-lines"><i /><i /></div></div>
      ))}
    </div>
  );
}

/** Kratko učitavanje pri prvom otvaranju ekrana. */
export function useFirstLoad(ms = 380) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}

/** Animirana kvačica za potvrde. */
export function SuccessMark({ size = 72 }: { size?: number }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 72 72" initial="hidden" animate="show" className="mja-success">
      <motion.circle cx="36" cy="36" r="33" fill="var(--p)" variants={{ hidden: { scale: 0 }, show: { scale: 1, transition: { type: "spring", stiffness: 300, damping: 18 } } }} style={{ originX: "50%", originY: "50%" }} />
      <motion.path d="M22 37l9 9 19-20" fill="none" stroke="var(--p-on)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { delay: 0.25, duration: 0.4, ease: "easeOut" } } }} />
    </motion.svg>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={`mja-toggle ${on ? "is-on" : ""}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 35 }} />
    </button>
  );
}

export function Monogram({ name, size = 36 }: { name: string; size?: number }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "M";
  return <div className="mja-monogram" style={{ width: size, height: size, fontSize: size * 0.4 }}>{letters}</div>;
}

export function Logo({ size = 36 }: { size?: number }) {
  const { config } = useEngine();
  return config.brand.logo
    ? <div className="mja-logo" style={{ width: size, height: size, backgroundImage: `url(${config.brand.logo})` }} role="img" aria-label={config.brand.name} />
    : <Monogram name={config.brand.name} size={size} />;
}
