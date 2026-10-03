import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey } from "@mojapp/core";
import { allItems, useEngine } from "../state";
import { Btn, Stepper, SuccessMark } from "../primitives";
import { fmtPrice } from "../theme";

const DAYS = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];
const busy = (seed: string) => { let h = 7; for (const c of seed) h = (h * 33 + c.charCodeAt(0)) % 997; return h % 4 === 0; };

type Step = "service" | "staff" | "date" | "guests" | "confirm" | "done";

export function Booking() {
  const { config, state, dispatch, toast } = useEngine();
  const ind = industryByKey(config.industry);
  const isTable = ind.base === "restoran";
  const items = allItems(config).filter((i) => !isTable && (i.duration || i.price));
  const hasStaff = !isTable && config.staff.length > 0;

  const steps: Step[] = isTable ? ["date", "guests", "confirm"] : [...(items.length ? ["service" as Step] : []), ...(hasStaff ? ["staff" as Step] : []), "date", "confirm"];
  const preset = state.bookingPreset && items.find((i) => i.id === state.bookingPreset) ? state.bookingPreset : undefined;
  const [stepIdx, setStepIdx] = useState(preset ? steps.indexOf("service") + 1 : 0);
  const [dir, setDir] = useState(1);
  const [service, setService] = useState<string | undefined>(preset);
  const [staff, setStaff] = useState<string>("bilo");
  const [day, setDay] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const step = steps[stepIdx] ?? "done";

  const dates = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const slots = useMemo(() => {
    const [from, to] = isTable ? [12, 22] : [9, 20];
    const out: string[] = [];
    for (let h = from; h < to; h++) for (const m of ["00", "30"]) out.push(`${String(h).padStart(2, "0")}:${m}`);
    return out;
  }, [isTable]);

  const next = () => { setDir(1); setStepIdx((i) => i + 1); };
  const back = () => { setDir(-1); setStepIdx((i) => Math.max(0, i - 1)); };
  const svc = items.find((i) => i.id === service);
  const staffName = config.staff.find((s) => s.id === staff)?.name ?? "Bilo ko slobodan";
  const dateLabel = dates[day].toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long" });

  const confirm = () => {
    dispatch({ type: "book", booking: {
      id: String(Date.now()), title: isTable ? `Sto za ${guests}` : svc?.name ?? ind.bookingLabel,
      when: `${dateLabel}, ${time}`, detail: isTable ? undefined : staffName,
    }});
    if (config.modules.includes("loyalty")) dispatch({ type: "points", delta: 1 });
    setDir(1); setStepIdx(steps.length);
  };
  const restart = () => { setStepIdx(0); setService(undefined); setTime(null); };

  const canNext = step === "service" ? !!service : step === "date" ? !!time : true;

  return (
    <div className="mja-screen mja-booking">
      <div className="mja-page-head">
        <div className="mja-booking-top">
          {stepIdx > 0 && step !== "done" && <button type="button" className="mja-back" onClick={back} aria-label="Nazad"><Icon name="arrowLeft" /></button>}
          <h1>{ind.bookingLabel}</h1>
        </div>
        {step !== "done" && (
          <div className="mja-progress" aria-label={`Korak ${stepIdx + 1} od ${steps.length}`}>
            <motion.i animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} transition={{ type: "spring", stiffness: 300, damping: 35 }} />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir} className="mja-step"
          initial={{ x: dir * 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -40, opacity: 0 }} transition={{ duration: 0.2 }}>

          {step === "service" && (
            <>
              <h2 className="mja-step-q">Koja usluga?</h2>
              <div className="mja-options">
                {items.map((it) => (
                  <motion.button type="button" key={it.id} whileTap={{ scale: 0.98 }} className={`mja-option ${service === it.id ? "is-active" : ""}`} onClick={() => setService(it.id)}>
                    <div className="mja-grow"><div className="mja-row-title">{it.name}</div><div className="mja-muted">{[it.duration && `${it.duration} min`, it.price && fmtPrice(it.price, config.brand.currency)].filter(Boolean).join(" · ")}</div></div>
                    <span className="mja-radio">{service === it.id && <motion.i layoutId="svc-dot" />}</span>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          {step === "staff" && (
            <>
              <h2 className="mja-step-q">Kod koga?</h2>
              <div className="mja-staff">
                {[{ id: "bilo", name: "Bilo ko", role: "Prvi slobodan termin" }, ...config.staff].map((s) => (
                  <motion.button type="button" key={s.id} whileTap={{ scale: 0.95 }} className={`mja-staff-card ${staff === s.id ? "is-active" : ""}`} onClick={() => setStaff(s.id)}>
                    <div className="mja-avatar">{s.id === "bilo" ? <Icon name="users" size={22} /> : s.name[0]}</div>
                    <div className="mja-row-title">{s.name}</div>
                    <div className="mja-muted">{s.role}</div>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          {step === "date" && (
            <>
              <h2 className="mja-step-q">Kada?</h2>
              <div className="mja-dates">
                {dates.map((d, i) => (
                  <motion.button type="button" key={i} whileTap={{ scale: 0.92 }} className={`mja-date ${day === i ? "is-active" : ""}`} onClick={() => { setDay(i); setTime(null); }}>
                    {day === i && <motion.span layoutId="date-bg" className="mja-date-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    <span className="mja-date-dow">{i === 0 ? "Danas" : DAYS[d.getDay()]}</span>
                    <span className="mja-date-num">{d.getDate()}</span>
                  </motion.button>
                ))}
              </div>
              <div className="mja-slots">
                {slots.map((s) => {
                  const taken = busy(`${day}-${s}-${service}`);
                  return (
                    <motion.button type="button" key={s} whileTap={taken ? undefined : { scale: 0.92 }} disabled={taken}
                      className={`mja-slot ${time === s ? "is-active" : ""}`} onClick={() => setTime(s)}>{s}</motion.button>
                  );
                })}
              </div>
            </>
          )}

          {step === "guests" && (
            <>
              <h2 className="mja-step-q">Koliko osoba?</h2>
              <div className="mja-guests"><Stepper value={guests} onChange={setGuests} min={1} max={12} /><span className="mja-muted">{guests === 1 ? "osoba" : guests < 5 ? "osobe" : "osoba"}</span></div>
            </>
          )}

          {step === "confirm" && (
            <>
              <h2 className="mja-step-q">Proverite i potvrdite</h2>
              <div className="mja-card mja-summary">
                {svc && <div className="mja-sum-row"><span>Usluga</span><strong>{svc.name}</strong></div>}
                {hasStaff && <div className="mja-sum-row"><span>Kod</span><strong>{staffName}</strong></div>}
                {isTable && <div className="mja-sum-row"><span>Broj osoba</span><strong>{guests}</strong></div>}
                <div className="mja-sum-row"><span>Datum</span><strong>{dateLabel}</strong></div>
                <div className="mja-sum-row"><span>Vreme</span><strong>{time}</strong></div>
                {svc?.price ? <div className="mja-sum-row"><span>Cena</span><strong>{fmtPrice(svc.price, config.brand.currency)}</strong></div> : null}
              </div>
            </>
          )}

          {step === "done" && (
            <div className="mja-done">
              <SuccessMark />
              <h2>{isTable ? "Sto je rezervisan" : "Termin je zakazan"}</h2>
              <p>{dateLabel} u {time}. Podsetnik stiže dan ranije.</p>
              <Btn variant="soft" full icon="calendar" onClick={() => toast("Dodato u kalendar", "check")}>Dodaj u kalendar</Btn>
              <Btn variant="ghost" full onClick={restart}>Nova rezervacija</Btn>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step !== "done" && (
        <div className="mja-bottom-cta">
          <Btn full disabled={!canNext} onClick={step === "confirm" ? confirm : next}>{step === "confirm" ? "Potvrdi rezervaciju" : "Dalje"}</Btn>
        </div>
      )}
    </div>
  );
}
