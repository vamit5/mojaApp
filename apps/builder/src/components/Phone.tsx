import { useEffect, useRef, useState } from "react";
import { AppEngine } from "@mojapp/app-engine";
import type { AppConfig } from "@mojapp/core";

/** Okvir telefona koji se skalira da stane u roditelja.
 *  Telefon je apsolutno pozicioniran, pa njegova puna širina (404px) ne širi stranicu na uskim ekranima. */
export function Phone({ config, introKey }: { config: AppConfig; introKey?: number | string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.height - 8) / 860, (e.contentRect.width - 8) / 404)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="b-phone-wrap" ref={wrap}>
      <div className="b-phone" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="b-phone-screen">
          <AppEngine config={config} introKey={introKey} />
          <div className="b-island" />
        </div>
      </div>
    </div>
  );
}

