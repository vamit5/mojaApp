import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Icon } from "@mojapp/ui";
import { allItems, useEngine } from "../state";
import { PhTag, Skeleton, useFirstLoad } from "../primitives";

const DOW = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const TIMES = ["07:00", "09:00", "12:00", "17:00", "18:30", "20:00"];

export function Schedule() {
  const { config, state, dispatch, toast } = useEngine();
  const loading = useFirstLoad();
  const today = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(today);
  const classes = allItems(config);

  const list = useMemo(() => TIMES.slice(0, day === 5 ? 3 : day === 6 ? 2 : 6).map((t, i) => {
    const c = classes[(i + day) % Math.max(1, classes.length)];
    const coach = config.staff[(i + day) % Math.max(1, config.staff.length)];
    const total = 12 + ((i * 3 + day) % 3) * 4;
    const taken = Math.min(total - 1, 4 + ((i * 7 + day * 5) % (total - 3)));
    return { id: `${day}-${t}`, time: t, cls: c, coach, total, taken };
  }), [day, classes, config.staff]);

  return (
    <div className="mja-screen">
      <div className="mja-page-head"><h1>Raspored</h1></div>
      <div className="mja-week">
        {DOW.map((d, i) => (
          <button type="button" key={d} className={`mja-weekday ${day === i ? "is-active" : ""}`} onClick={() => setDay(i)}>
            {day === i && <motion.span layoutId="week-bg" className="mja-date-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span>{d}</span>{i === today && <i className="mja-dot" />}
          </button>
        ))}
      </div>

      {loading ? <Skeleton rows={4} /> : (
        <AnimatePresence mode="wait">
          <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {list.map((row) => {
              if (!row.cls) return null;
              const joined = state.joined.includes(row.id);
              const taken = row.taken + (joined ? 1 : 0);
              return (
                <div key={row.id} className="mja-class">
                  <div className="mja-class-time">{row.time}<span>{row.cls.duration ?? 60} min</span></div>
                  <div className="mja-grow">
                    <div className="mja-row-title">{row.cls.name} {row.cls.placeholder && <PhTag />}</div>
                    {row.coach && <div className="mja-muted">{row.coach.name}</div>}
                    <div className="mja-spots">
                      <div className="mja-bar"><motion.i animate={{ width: `${(taken / row.total) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} /></div>
                      <span>{row.total - taken} mesta</span>
                    </div>
                  </div>
                  <motion.button type="button" whileTap={{ scale: 0.9 }} className={`mja-pill-btn ${joined ? "is-done" : ""}`}
                    onClick={() => { dispatch({ type: "join", id: row.id }); toast(joined ? "Prijava je otkazana" : `Prijavljeni ste: ${row.cls.name}, ${row.time}`, joined ? "x" : "check"); }}>
                    {joined ? <><Icon name="check" size={16} /> Prijavljen</> : "Prijavi se"}
                  </motion.button>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
