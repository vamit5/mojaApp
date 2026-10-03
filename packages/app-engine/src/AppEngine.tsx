import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey, MODULES, navModules, type AppConfig, type ModuleKey } from "@mojapp/core";
import { EngineProvider, useEngine } from "./state";
import { themeVars } from "./theme";
import { IconBtn, Logo } from "./primitives";
import { Home } from "./modules/Home";
import { Menu } from "./modules/Menu";
import { Services } from "./modules/Services";
import { Booking } from "./modules/Booking";
import { Schedule } from "./modules/Schedule";
import { Loyalty } from "./modules/Loyalty";
import { Membership } from "./modules/Membership";
import { Progress } from "./modules/Progress";
import { Profile } from "./modules/Profile";
import "./engine.css";

const SCREENS: Partial<Record<ModuleKey, ComponentType>> = {
  home: Home, menu: Menu, services: Services, booking: Booking, schedule: Schedule,
  loyalty: Loyalty, membership: Membership, progress: Progress, profile: Profile,
};

export interface AppEngineProps {
  config: AppConfig;
  /** Promena vrednosti ponovo pušta uvodnu animaciju (npr. na ekranu „Vaša aplikacija je spremna“). */
  introKey?: number | string;
  /** Prikaz statusne trake (u okviru telefona u builderu). */
  statusBar?: boolean;
}

export function AppEngine({ config, introKey, statusBar = true }: AppEngineProps) {
  return (
    <MotionConfig reducedMotion="user">
      <EngineProvider config={config}>
        <Shell introKey={introKey} statusBar={statusBar} />
      </EngineProvider>
    </MotionConfig>
  );
}

function navIcon(m: ModuleKey, industry: string) {
  const map: Partial<Record<ModuleKey, string>> = { home: "home", booking: "calendar", schedule: "clock", loyalty: "gift", membership: "card", progress: "chart", profile: "user" };
  return map[m] ?? industryByKey(industry).icon;
}

function Shell({ introKey, statusBar }: { introKey?: number | string; statusBar: boolean }) {
  const { config, state, go, toasts } = useEngine();
  const nav = navModules(config.modules);
  const tabIdx = nav.indexOf(state.tab);
  const prevIdx = useRef(tabIdx);
  const dir = tabIdx >= prevIdx.current ? 1 : -1;
  useEffect(() => { prevIdx.current = tabIdx; }, [tabIdx]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [state.tab]);

  const [intro, setIntro] = useState(true);
  useEffect(() => { setIntro(true); const t = setTimeout(() => setIntro(false), 1300); return () => clearTimeout(t); }, [introKey]);

  const Screen = SCREENS[state.tab] ?? Home;
  const cartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  return (
    <div className="mja" style={themeVars(config.brand, state.modeOverride)} data-mode={state.modeOverride ?? config.brand.mode}>
      {statusBar && (
        <div className="mja-status">
          <span>{now.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="mja-status-icons"><i /><i /><i className="is-batt" /></span>
        </div>
      )}
      <header className="mja-top">
        <Logo size={32} />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={config.brand.name} className="mja-top-name" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}>{config.brand.name}</motion.div>
        </AnimatePresence>
        <div className="mja-grow" />
        {config.modules.includes("menu") && <IconBtn icon="cart" label="Korpa" badge={cartCount} onClick={() => go("menu")} />}
        <IconBtn icon="bell" label="Obaveštenja" />
      </header>

      <div className="mja-scroll" ref={scroller}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={state.tab} custom={dir}
            initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
            <Screen />
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="mja-nav" aria-label="Glavna navigacija">
        {nav.map((m) => {
          const active = state.tab === m;
          return (
            <motion.button type="button" key={m} layout className={`mja-nav-item ${active ? "is-active" : ""}`} whileTap={{ scale: 0.88 }}
              onClick={() => go(m)} aria-current={active ? "page" : undefined}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 32 }}>
              {active && <motion.span layoutId="nav-pill" className="mja-nav-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Icon name={navIcon(m, config.industry)} size={21} />
              <span>{m === "menu" || m === "services" ? industryByKey(config.industry).catalogLabel : MODULES[m].short}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="mja-toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className="mja-toast" initial={{ y: -24, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}>
              {t.icon && <Icon name={t.icon} size={16} />}<span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {intro && (
          <motion.div className="mja-splash" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.35 }}>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
              <Logo size={76} />
            </motion.div>
            <motion.div className="mja-splash-name" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>{config.brand.name}</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
