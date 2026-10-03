import { motion } from "framer-motion";
import { industryByKey } from "@mojapp/core";
import { useEngine } from "../state";
import { PhTag, Skeleton, useFirstLoad } from "../primitives";
import { fmtPrice } from "../theme";

export function Services() {
  const { config, go, toast } = useEngine();
  const ind = industryByKey(config.industry);
  const loading = useFirstLoad();
  const canBook = config.modules.includes("booking");

  return (
    <div className="mja-screen">
      <div className="mja-page-head"><h1>{ind.catalogLabel}</h1></div>
      {loading ? <Skeleton rows={5} /> : config.catalog.map((c) => (
        <div key={c.id} className="mja-cat">
          <h3>{c.name}</h3>
          {c.items.map((it) => (
            <motion.div key={it.id} className="mja-service" whileTap={{ scale: 0.985 }}>
              <div className="mja-grow">
                <div className="mja-item-name">{it.name} {it.tag && <span className="mja-tag">{it.tag}</span>}</div>
                {it.description && <div className="mja-item-desc">{it.description}</div>}
                <div className="mja-service-meta">
                  {it.duration && <span>{it.duration} min</span>}
                  {it.price ? <span>{fmtPrice(it.price, config.brand.currency)}</span> : null}
                  {it.placeholder && <PhTag />}
                </div>
              </div>
              <motion.button type="button" className="mja-pill-btn" whileTap={{ scale: 0.92 }}
                onClick={() => (canBook ? go("booking", it.id) : toast("Uključite modul Rezervacije za zakazivanje", "calendar"))}>
                Zakaži
              </motion.button>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}
