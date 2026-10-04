import { useEffect, useState } from "react";
import { AppEngine } from "@mojapp/app-engine";
import { AppConfigSchema, type AppConfig } from "@mojapp/core";
import { Icon } from "@mojapp/ui";
import { Phone } from "../components/Phone";
import { Link } from "../router";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";
import "./share.css";

/** Prebacuje ovaj demo u builder (poslednji korak), da posetilac može da ga menja i naruči. */
function openInBuilder(config: AppConfig) {
  try { localStorage.setItem("mojapp-demo-v1", JSON.stringify({ config, step: 5, started: true })); } catch { /* builder kreće od početka */ }
}

type State = { status: "loading" } | { status: "missing" } | { status: "ok"; config: AppConfig };

/** Deljivi demo: na telefonu se otvara preko celog ekrana, na računaru u okviru telefona. */
export function DemoView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia("(max-width: 800px)").matches);
  useEffect(() => {
    const mq = matchMedia("(max-width: 800px)");
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!supabase || !/^[a-z0-9]{6,20}$/.test(slug)) { setState({ status: "missing" }); return; }
    supabase.rpc("get_demo", { p_slug: slug }).then(({ data, error }) => {
      const row = Array.isArray(data) ? data[0] : null;
      // slike koje nisu uspele da se sačuvaju dolaze kao null — uklanjamo ih pre provere
      const clean = row ? JSON.parse(JSON.stringify(row.config), (_k, v) => (v === null ? undefined : v)) : null;
      if (clean?.content?.photos) clean.content.photos = clean.content.photos.filter(Boolean);
      const parsed = clean ? AppConfigSchema.safeParse(clean) : null;
      if (error || !parsed?.success) { setState({ status: "missing" }); return; }
      setState({ status: "ok", config: parsed.data });
      document.title = `${parsed.data.brand.name} · demo aplikacije`;
      track("page_view", { page: "shared_demo" });
    });
  }, [slug]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* korisnik može ručno da kopira iz adrese */ }
  };

  if (state.status === "loading") return <div className="s-center"><div className="s-spinner" aria-label="Učitavanje" /></div>;
  if (state.status === "missing") return (
    <div className="s-center s-missing">
      <h1>Ovaj demo ne postoji ili je istekao.</h1>
      <p>Proverite link ili napravite novi demo za par minuta.</p>
      <Link to="/demo" className="b-btn is-big">Napravi demo – 30 sec</Link>
    </div>
  );

  return (
    <div className="s-root">
      {mobile ? <div className="s-mobile"><AppEngine config={state.config} statusBar={false} /></div> : (
      <div className="s-desktop">
        <div className="s-info">
          <span className="s-kicker">Demo aplikacije</span>
          <h1>{state.config.brand.name}</h1>
          <p>Ovo je interaktivni demo. Klikćite kroz aplikaciju desno ili otvorite ovaj link na telefonu.</p>
          <div className="s-actions">
            <Link to="/demo" className="b-btn is-big" onClick={() => openInBuilder(state.config)}>Uredi i naruči</Link>
            <button type="button" className="b-btn is-ghost is-big" onClick={copy}><Icon name={copied ? "check" : "upload"} size={18} />{copied ? "Link je kopiran" : "Kopiraj link"}</button>
          </div>
          <p className="s-note">Sadržaj označen kao „Primer“ zamenjuje se vašim pre izrade.</p>
          <Link to="/" className="s-brand"><span className="b-mark" aria-hidden="true" />Napravljeno uz MojApp</Link>
        </div>
        <div className="s-phone"><Phone config={state.config} /></div>
      </div>)}
    </div>
  );
}
