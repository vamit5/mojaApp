import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Icon } from "@mojapp/ui";
import { useEngine } from "../state";
import { Btn, Toggle } from "../primitives";

export function Profile() {
  const { config, state, dispatch, toast, go } = useEngine();
  const [notif, setNotif] = useState(true);
  const dark = (state.modeOverride ?? config.brand.mode) === "dark";
  const bookable = config.modules.includes("booking") ? "booking" : config.modules.includes("schedule") ? "schedule" : config.modules.includes("menu") ? "menu" : null;

  return (
    <div className="mja-screen">
      <div className="mja-profile-head">
        <div className="mja-avatar is-big"><Icon name="user" size={28} /></div>
        <div className="mja-grow"><div className="mja-profile-name">Gost</div><div className="mja-muted">Prijavite se da sačuvate istoriju</div></div>
        <Btn small variant="soft" onClick={() => toast("U pravoj aplikaciji: prijava emailom ili telefonom", "user")}>Prijava</Btn>
      </div>

      <div className="mja-section">
        <div className="mja-section-head"><h2>Moje aktivnosti</h2></div>
        <AnimatePresence initial={false}>
          {state.bookings.length === 0 ? (
            <motion.div key="empty" className="mja-empty is-card" exit={{ opacity: 0 }}>
              <Icon name="calendar" size={22} />
              <p>Ovde će biti vaše rezervacije i porudžbine.</p>
              {bookable && <Btn small onClick={() => go(bookable)}>Napravi prvu</Btn>}
            </motion.div>
          ) : state.bookings.map((b) => (
            <motion.div key={b.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mja-booking-row">
              <div className="mja-booking-icon"><Icon name="check" size={16} /></div>
              <div className="mja-grow"><div className="mja-row-title">{b.title}</div><div className="mja-muted">{b.when}{b.detail ? ` · ${b.detail}` : ""}</div></div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mja-section">
        <div className="mja-section-head"><h2>Podešavanja</h2></div>
        <div className="mja-card is-list">
          <div className="mja-setting"><Icon name="moon" size={18} /><span className="mja-grow">Tamni režim</span><Toggle on={dark} label="Tamni režim" onChange={(v) => dispatch({ type: "mode", mode: v ? "dark" : "light" })} /></div>
          <div className="mja-setting"><Icon name="bell" size={18} /><span className="mja-grow">Obaveštenja</span><Toggle on={notif} label="Obaveštenja" onChange={(v) => { setNotif(v); toast(v ? "Obaveštenja su uključena" : "Obaveštenja su isključena", "bell"); }} /></div>
          {config.modules.includes("loyalty") && (
            <button type="button" className="mja-setting" onClick={() => go("loyalty")}><Icon name="gift" size={18} /><span className="mja-grow">{state.points} {config.loyalty.pointsName}</span><Icon name="chevronRight" size={18} /></button>
          )}
          <button type="button" className="mja-setting" onClick={() => toast("U pravoj aplikaciji kreće poziv", "phone")}><Icon name="phone" size={18} /><span className="mja-grow">Kontakt</span><Icon name="chevronRight" size={18} /></button>
        </div>
      </div>
      <p className="mja-foot-note">{config.brand.name} · napravljeno uz MojApp</p>
    </div>
  );
}
