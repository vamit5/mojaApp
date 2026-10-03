import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@mojapp/ui";
import { industryByKey, type CatalogItem } from "@mojapp/core";
import { allItems, useEngine } from "../state";
import { Btn, PhTag, Photo, Sheet, Skeleton, Stepper, SuccessMark, useFirstLoad } from "../primitives";
import { fmtPrice } from "../theme";

export function Menu() {
  const { config, state, dispatch, toast } = useEngine();
  const loading = useFirstLoad();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(config.catalog[0]?.id);
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const cur = config.brand.currency;

  const items = allItems(config);
  const cartCount = Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(state.cart).reduce((s, [id, n]) => s + (items.find((i) => i.id === id)?.price ?? 0) * n, 0);

  const filtered = useMemo(() => config.catalog.map((c) => ({
    ...c, items: c.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())),
  })).filter((c) => c.items.length), [config.catalog, q]);

  const add = (it: CatalogItem, n = 1) => {
    dispatch({ type: "cart", id: it.id, delta: n });
    toast(`${it.name} je u korpi`, "cart");
  };

  return (
    <div className="mja-screen">
      <div className="mja-page-head">
        <h1>{industryByKey(config.industry).catalogLabel}</h1>
        <label className="mja-search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pretraži" aria-label="Pretraži" />
        </label>
      </div>
      <div className="mja-chips is-sticky">
        {config.catalog.map((c) => (
          <button type="button" key={c.id} className={`mja-chip ${active === c.id ? "is-active" : ""}`}
            onClick={() => { setActive(c.id); refs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {active === c.id && <motion.span layoutId="menu-chip" className="mja-chip-bg" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      {loading ? <Skeleton /> : filtered.length === 0 ? (
        <div className="mja-empty"><p>Nema rezultata za „{q}“.</p><Btn variant="soft" small onClick={() => setQ("")}>Obriši pretragu</Btn></div>
      ) : filtered.map((c) => (
        <div key={c.id} ref={(el) => { refs.current[c.id] = el; }} className="mja-cat">
          <h3>{c.name}</h3>
          {c.items.map((it) => (
            <motion.div key={it.id} className="mja-item" whileTap={{ scale: 0.985 }} onClick={() => { setOpen(it); setQty(1); }} role="button" tabIndex={0}>
              <div className="mja-item-text">
                <div className="mja-item-name">{it.name} {it.tag && <span className="mja-tag">{it.tag}</span>}</div>
                {it.description && <div className="mja-item-desc">{it.description}</div>}
                <div className="mja-item-price">{it.price ? fmtPrice(it.price, cur) : ""} {it.placeholder && <PhTag />}</div>
              </div>
              <div className="mja-item-media">
                <Photo src={it.photo} seed={it.id} className="mja-item-photo" label={false} />
                <motion.button type="button" className="mja-add" whileTap={{ scale: 0.8 }} aria-label={`Dodaj ${it.name}`}
                  onClick={(e) => { e.stopPropagation(); add(it); }}><Icon name="plus" size={18} /></motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      ))}

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button type="button" className="mja-cartbar" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }} onClick={() => setCartOpen(true)}>
            <span className="mja-cartbar-count"><motion.span key={cartCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }}>{cartCount}</motion.span></span>
            <span>Korpa</span>
            <span className="mja-grow" />
            <span>{fmtPrice(cartTotal, cur)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <div className="mja-detail">
            <Photo src={open.photo} seed={open.id} className="mja-detail-photo" />
            <h2>{open.name}</h2>
            {open.description && <p>{open.description}</p>}
            <div className="mja-detail-foot">
              <Stepper value={qty} onChange={setQty} min={1} max={20} />
              <Btn onClick={() => { add(open, qty); setOpen(null); }}>Dodaj · {fmtPrice((open.price ?? 0) * qty, cur)}</Btn>
            </div>
          </div>
        )}
      </Sheet>

      <Cart open={cartOpen} onClose={() => setCartOpen(false)} total={cartTotal} />
    </div>
  );
}

function Cart({ open, onClose, total }: { open: boolean; onClose: () => void; total: number }) {
  const { config, state, dispatch, toast } = useEngine();
  const [step, setStep] = useState<"cart" | "processing" | "done">("cart");
  const [mode, setMode] = useState<"preuzimanje" | "dostava">("preuzimanje");
  const [pay, setPay] = useState<"kartica" | "gotovina">("kartica");
  const items = allItems(config);
  const cur = config.brand.currency;

  const close = () => { onClose(); setTimeout(() => setStep("cart"), 300); };
  const order = () => {
    setStep("processing");
    setTimeout(() => {
      setStep("done");
      dispatch({ type: "cartClear" });
      dispatch({ type: "book", booking: { id: String(Date.now()), title: "Porudžbina", when: new Date().toLocaleString("sr-Latn-RS", { dateStyle: "short", timeStyle: "short" }), detail: fmtPrice(total, cur) } });
      if (config.modules.includes("loyalty")) { dispatch({ type: "points", delta: 1 }); toast(`+1 ${config.loyalty.pointsName}`, "gift"); }
    }, 1100);
  };

  return (
    <Sheet open={open} onClose={close} title={step === "cart" ? "Vaša porudžbina" : undefined}>
      {step === "cart" && (
        <div className="mja-cart">
          {Object.entries(state.cart).map(([id, n]) => {
            const it = items.find((i) => i.id === id);
            if (!it) return null;
            return (
              <motion.div layout key={id} className="mja-cart-row">
                <div className="mja-grow"><div className="mja-row-title">{it.name}</div><div className="mja-muted">{fmtPrice((it.price ?? 0) * n, cur)}</div></div>
                <Stepper value={n} onChange={(v) => dispatch({ type: "cart", id, delta: v - n })} />
              </motion.div>
            );
          })}
          <div className="mja-seg" role="radiogroup" aria-label="Način preuzimanja">
            {(["preuzimanje", "dostava"] as const).map((m) => (
              <button type="button" key={m} role="radio" aria-checked={mode === m} className={mode === m ? "is-active" : ""} onClick={() => setMode(m)}>
                {mode === m && <motion.span layoutId="seg-mode" className="mja-seg-bg" />}<span>{m === "preuzimanje" ? "Preuzimanje" : "Dostava"}</span>
              </button>
            ))}
          </div>
          <div className="mja-seg" role="radiogroup" aria-label="Plaćanje">
            {(["kartica", "gotovina"] as const).map((m) => (
              <button type="button" key={m} role="radio" aria-checked={pay === m} className={pay === m ? "is-active" : ""} onClick={() => setPay(m)}>
                {pay === m && <motion.span layoutId="seg-pay" className="mja-seg-bg" />}<span>{m === "kartica" ? "Kartica" : "Gotovina"}</span>
              </button>
            ))}
          </div>
          <div className="mja-total"><span>Ukupno</span><strong>{fmtPrice(total, cur)}</strong></div>
          <Btn full onClick={order} disabled={!total}>{pay === "kartica" ? "Plati i poruči" : "Poruči"}</Btn>
          <p className="mja-note">Demo: plaćanje je simulirano.</p>
        </div>
      )}
      {step === "processing" && (
        <div className="mja-processing"><div className="mja-spinner" /><p>Šaljemo porudžbinu…</p></div>
      )}
      {step === "done" && (
        <div className="mja-done">
          <SuccessMark />
          <h2>Porudžbina je primljena</h2>
          <p>{mode === "preuzimanje" ? "Javićemo vam kada bude spremna za preuzimanje." : "Pratite dostavu u svom profilu."}</p>
          <Btn variant="soft" full onClick={close}>U redu</Btn>
        </div>
      )}
    </Sheet>
  );
}
