import { motion } from "framer-motion";
import { Icon } from "@mojapp/ui";
import { useEngine } from "../state";
import { Counter, PhTag } from "../primitives";

const WEEK = [{ d: "Pon", v: 45 }, { d: "Uto", v: 0 }, { d: "Sre", v: 60 }, { d: "Čet", v: 30 }, { d: "Pet", v: 75 }, { d: "Sub", v: 50 }, { d: "Ned", v: 0 }];

export function Progress() {
  const { state } = useEngine();
  const sessions = 11 + state.joined.length;
  const goal = 16;
  const pct = Math.min(1, sessions / goal);
  const max = Math.max(...WEEK.map((w) => w.v));

  return (
    <div className="mja-screen">
      <div className="mja-page-head"><h1>Progres</h1><div className="mja-ph-line"><PhTag /> Primer podataka</div></div>

      <div className="mja-goal">
        <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" strokeWidth="10" />
          <motion.circle cx="60" cy="60" r="50" fill="none" stroke="var(--p)" strokeWidth="10" strokeLinecap="round"
            transform="rotate(-90 60 60)" initial={{ pathLength: 0 }} animate={{ pathLength: pct }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} />
        </svg>
        <div className="mja-goal-text">
          <div className="mja-goal-num"><Counter value={sessions} /><small>/{goal}</small></div>
          <div className="mja-muted">treninga ovog meseca</div>
        </div>
      </div>

      <div className="mja-stats">
        <div className="mja-stat"><Icon name="clock" size={18} /><strong><Counter value={540 + state.joined.length * 60} /></strong><span>minuta</span></div>
        <div className="mja-stat"><Icon name="flame" size={18} /><strong><Counter value={4} /></strong><span>dana zaredom</span></div>
        <div className="mja-stat"><Icon name="chart" size={18} /><strong>+<Counter value={8} />%</strong><span>u odnosu na prošli mesec</span></div>
      </div>

      <div className="mja-section">
        <div className="mja-section-head"><h2>Ova nedelja</h2><span className="mja-muted">minuta treninga</span></div>
        <div className="mja-week-chart">
          {WEEK.map((w, i) => (
            <div key={w.d} className="mja-wc-col">
              <span className="mja-wc-val">{w.v || ""}</span>
              <div className="mja-wc-track">
                <motion.i initial={{ height: 0 }} animate={{ height: `${(w.v / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 160, damping: 20 }} />
              </div>
              <span className="mja-wc-day">{w.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
