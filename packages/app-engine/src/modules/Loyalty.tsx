import { motion } from "framer-motion";
import { useState } from "react";
import { Icon } from "@mojapp/ui";
import { useEngine } from "../state";
import { Btn, Counter, Logo, Sheet, SuccessMark } from "../primitives";

export function Loyalty() {
  const { config, state, dispatch } = useEngine();
  const { target, pointsName, reward } = config.loyalty;
  const [unlocked, setUnlocked] = useState(false);
  const filled = Math.min(state.points, target);

  const visit = () => {
    if (state.points >= target) return;
    dispatch({ type: "points", delta: 1 });
    if (state.points + 1 >= target) {
      // kartica se prvo popuni, zatim se otvara nagrada i brojanje kreće ispočetka
      setTimeout(() => { setUnlocked(true); dispatch({ type: "points", delta: -target }); }, 700);
    }
  };

  return (
    <div className="mja-screen">
      <div className="mja-page-head"><h1>Nagrade</h1></div>
      <motion.div className="mja-loyalty-card" initial={{ rotateX: 12, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}>
        <div className="mja-lc-top"><Logo size={34} /><span>{config.brand.name}</span></div>
        <div className="mja-lc-points"><Counter value={state.points} /><small>/ {target} {pointsName}</small></div>
        <div className="mja-stamps">
          {Array.from({ length: target }, (_, i) => (
            <motion.span key={i} className={i < filled ? "is-on" : ""} animate={i < filled ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.35, delay: i === filled - 1 ? 0.05 : 0 }}>
              {i < filled && <Icon name="check" size={12} />}
            </motion.span>
          ))}
        </div>
        <div className="mja-lc-reward"><Icon name="gift" size={16} /> {reward}</div>
      </motion.div>

      <div className="mja-section">
        <Btn full icon="qr" onClick={visit}>Probaj: zabeleži posetu</Btn>
        <p className="mja-note">U pravoj aplikaciji poen se dodaje skeniranjem koda na kasi.</p>
      </div>

      <div className="mja-section">
        <div className="mja-section-head"><h2>Kako radi</h2></div>
        <div className="mja-card">
          <div className="mja-info-row"><Icon name="check" size={18} /><span>Svaka poseta ili porudžbina donosi 1 poen</span></div>
          <div className="mja-info-row"><Icon name="gift" size={18} /><span>Na {target} {pointsName}: {reward.toLowerCase()}</span></div>
          <div className="mja-info-row"><Icon name="bell" size={18} /><span>Obaveštenje čim nagrada bude spremna</span></div>
        </div>
      </div>

      <Sheet open={unlocked} onClose={() => setUnlocked(false)}>
        <div className="mja-done">
          <SuccessMark />
          <h2>Nagrada je otključana</h2>
          <p>{reward}. Pokažite ovaj ekran na kasi.</p>
          <div className="mja-code is-big">NAGRADA-{config.brand.name.slice(0, 3).toUpperCase()}</div>
          <Btn variant="soft" full onClick={() => setUnlocked(false)}>Super</Btn>
        </div>
      </Sheet>
    </div>
  );
}
