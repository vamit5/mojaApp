import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Icon } from "@mojapp/ui";
import { useEngine } from "../state";
import { Btn, Logo, PhTag } from "../primitives";
import { fmtPrice } from "../theme";

const PLANS = [
  { id: "mesec", name: "Mesečna", price: 3900, note: "Neograničeni grupni treninzi" },
  { id: "tri", name: "Tri meseca", price: 10500, note: "Ušteda 1.200 RSD", tag: "Najčešći izbor" },
  { id: "godina", name: "Godišnja", price: 36000, note: "2 meseca gratis" },
];

/** Deterministički „QR“ uzorak za člansku kartu (vizuelni primer, nije pravi kod). */
function Pattern({ seed }: { seed: string }) {
  let h = 17; for (const c of seed) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  const cells = Array.from({ length: 121 }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; const x = i % 11, y = Math.floor(i / 11); const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); return corner || (h >> 16) % 2 === 0; });
  return <div className="mja-pattern">{cells.map((on, i) => <i key={i} className={on ? "is-on" : ""} />)}</div>;
}

export function Membership() {
  const { config, state, dispatch, toast } = useEngine();
  const [sel, setSel] = useState("tri");
  const active = PLANS.find((p) => p.id === state.membership);
  const until = new Date(); until.setMonth(until.getMonth() + (active?.id === "godina" ? 12 : active?.id === "tri" ? 3 : 1));

  return (
    <div className="mja-screen">
      <div className="mja-page-head"><h1>Članstvo</h1></div>
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div key="card" initial={{ opacity: 0, scale: 0.94, rotateY: -25 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ type: "spring", stiffness: 180, damping: 20 }} className="mja-section">
            <div className="mja-member-card">
              <div className="mja-lc-top"><Logo size={30} /><span>{config.brand.name}</span></div>
              <div className="mja-member-mid">
                <div><div className="mja-member-label">Član</div><div className="mja-member-name">Gost</div><div className="mja-member-label">Važi do {until.toLocaleDateString("sr-Latn-RS")}</div></div>
                <Pattern seed={config.brand.name + active.id} />
              </div>
              <div className="mja-member-plan">{active.name} članarina</div>
            </div>
            <p className="mja-note">Pokažite kartu na ulazu. U pravoj aplikaciji kod je jedinstven za svakog člana.</p>
            <Btn variant="ghost" full onClick={() => dispatch({ type: "membership", plan: null })}>Promeni paket</Btn>
          </motion.div>
        ) : (
          <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mja-section">
            <div className="mja-plans">
              {PLANS.map((p) => (
                <motion.button type="button" key={p.id} whileTap={{ scale: 0.98 }} className={`mja-plan ${sel === p.id ? "is-active" : ""}`} onClick={() => setSel(p.id)}>
                  <div className="mja-grow">
                    <div className="mja-row-title">{p.name} {p.tag && <span className="mja-tag">{p.tag}</span>}</div>
                    <div className="mja-muted">{p.note}</div>
                  </div>
                  <div className="mja-plan-price">{fmtPrice(p.price, config.brand.currency)}</div>
                  <span className="mja-radio">{sel === p.id && <motion.i layoutId="plan-dot" />}</span>
                </motion.button>
              ))}
            </div>
            <div className="mja-ph-line"><PhTag /> Cene paketa su primer</div>
            <Btn full icon="card" onClick={() => { dispatch({ type: "membership", plan: sel }); toast("Članstvo je aktivirano", "check"); }}>Aktiviraj članstvo</Btn>
            <p className="mja-note"><Icon name="check" size={14} /> Demo: plaćanje je simulirano.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
