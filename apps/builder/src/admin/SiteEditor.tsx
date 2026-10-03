import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { INDUSTRIES } from "@mojapp/core";
import { compressImage, Icon } from "@mojapp/ui";
import { supabase } from "../lib/supabase";
import { fromPortfolio, toPortfolio, type PortfolioItem, type Team } from "../lib/siteContent";
import { ScreenShot } from "../pages/HomeSections";

const db = supabase!;
const EMPTY_TEAM: Team = { name: "", role: "", city: "", photo: null, bio: "", highlights: [], whatsapp: "", instagram: "", email: "" };

/** Otprema sliku u javni bucket i vraća njen javni URL. */
async function uploadImage(file: File, folder: string, max = 1400): Promise<string> {
  const dataUrl = await compressImage(file, max);
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("public-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return db.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}

export function SiteEditor() {
  return (
    <>
      <div className="a-head"><h1>Sajt</h1><a className="b-btn is-ghost" href="/" target="_blank" rel="noreferrer">Otvori sajt</a></div>
      <TeamEditor />
      <PortfolioEditor />
    </>
  );
}

/* ───────────── O meni ───────────── */

function TeamEditor() {
  const [t, setT] = useState<Team>(EMPTY_TEAM);
  const [highlights, setHighlights] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    db.from("site_settings").select("value").eq("key", "team").maybeSingle().then(({ data }) => {
      const v = { ...EMPTY_TEAM, ...((data?.value as Team) ?? {}) };
      setT(v); setHighlights((v.highlights ?? []).join("\n")); setLoaded(true);
    });
  }, []);

  const set = (k: keyof Team, v: string | null) => setT({ ...t, [k]: v });

  const onPhoto = async (f?: File) => {
    if (!f) return;
    setUploading(true); setMsg("");
    try { const url = await uploadImage(f, "team", 1000); setT((x) => ({ ...x, photo: url })); }
    catch { setMsg("Otpremanje fotografije nije uspelo. Pokušajte ponovo."); }
    setUploading(false);
  };

  const save = async () => {
    if (!t.name.trim()) { setMsg("Upišite ime."); return; }
    setSaving(true); setMsg("");
    const value = { ...t, name: t.name.trim(), highlights: highlights.split("\n").map((s) => s.trim()).filter(Boolean),
      whatsapp: t.whatsapp?.trim() || null, instagram: t.instagram?.trim() || null, email: t.email?.trim() || null };
    const { error } = await db.from("site_settings").upsert({ key: "team", value, updated_at: new Date().toISOString() });
    setSaving(false);
    setMsg(error ? "Čuvanje nije uspelo." : "Sačuvano. Promena je odmah na sajtu.");
  };

  if (!loaded) return <div className="a-empty">Učitavanje…</div>;
  return (
    <section className="a-box a-site-box">
      <div className="a-box-head"><h3>O meni</h3></div>
      <div className="a-team">
        <label className="a-photo-pick">
          {t.photo ? <img src={t.photo} alt="" /> : <span><Icon name="upload" size={22} />Dodaj fotografiju</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          {uploading && <em>Otpremamo…</em>}
        </label>
        <div className="a-team-fields">
          <div className="a-offer-grid a-two">
            <label className="b-field"><span>Ime i prezime</span><input id="team-name" value={t.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="b-field"><span>Uloga</span><input id="team-role" value={t.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Osnivač MojApp-a" /></label>
          </div>
          <label className="b-field"><span>Grad</span><input id="team-city" value={t.city ?? ""} onChange={(e) => set("city", e.target.value)} /></label>
          <label className="b-field"><span>Priča (prazan red = novi pasus)</span><textarea id="team-bio" rows={7} value={t.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></label>
          <label className="b-field"><span>Činjenice koje se ističu (jedna po redu)</span><textarea id="team-highlights" rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} /></label>
          <div className="a-offer-grid a-three">
            <label className="b-field"><span>WhatsApp broj</span><input id="team-wa" value={t.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+381 6x xxx xxxx" /></label>
            <label className="b-field"><span>Instagram</span><input id="team-ig" value={t.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@mojapp" /></label>
            <label className="b-field"><span>Email</span><input id="team-email" type="email" value={t.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
          </div>
          <div className="a-row"><button type="button" className="b-btn" onClick={save} disabled={saving || uploading}>{saving ? "Čuvamo…" : "Sačuvaj"}</button>{msg && <span className="a-sub">{msg}</span>}</div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Portfolio ───────────── */

type Draft = Omit<PortfolioItem, "id"> & { id?: string };
const NEW: Draft = { slug: "", kind: "client", title: "", industry: "fitness", position: 99, published: true, summary: "", problem: "", solution: "", features: [], link: "", images: [], headline: "" };
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `projekat-${Date.now()}`;

function PortfolioEditor() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);
  const load = useCallback(() => {
    db.from("portfolio_items").select("*").order("position").then(({ data }) => setItems((data ?? []).map(toPortfolio)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = async (i: number, dir: -1 | 1) => {
    const a = items[i], b = items[i + dir];
    if (!a || !b) return;
    await Promise.all([
      db.from("portfolio_items").update({ position: b.position }).eq("id", a.id),
      db.from("portfolio_items").update({ position: a.position === b.position ? a.position + dir : a.position }).eq("id", b.id),
    ]);
    load();
  };

  return (
    <section className="a-box a-site-box">
      <div className="a-box-head"><h3>Projekti na sajtu</h3><button type="button" className="b-btn" onClick={() => setEdit({ ...NEW, position: (items.at(-1)?.position ?? 0) + 1 })}>Dodaj projekat</button></div>
      {items.length === 0 ? <p className="a-sub">Još nema projekata. Dodajte aplikacije koje ste napravili.</p> : (
        <ul className="a-portfolio">
          {items.map((p, i) => (
            <li key={p.id}>
              <div className="a-pf-shot"><ScreenShot src={p.images[0]} alt={p.title} /></div>
              <div className="a-pf-text">
                <strong>{p.title}</strong>
                <span className="a-sub">{p.kind === "client" ? "Realizovan projekat" : "DEMO"} · {p.published ? "objavljeno" : "sakriveno"} · {p.images.length} slika</span>
              </div>
              <div className="a-pf-actions">
                <button type="button" className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Pomeri gore"><Icon name="chevronLeft" size={16} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Pomeri dole"><Icon name="chevronRight" size={16} style={{ transform: "rotate(90deg)" }} /></button>
                <button type="button" className="b-btn is-ghost" onClick={() => setEdit(p)}>Izmeni</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{edit && <PortfolioForm draft={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}</AnimatePresence>
    </section>
  );
}

function PortfolioForm({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [features, setFeatures] = useState(draft.features.join("\n"));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].slice(0, 8);
    setUploading(list.length); setError("");
    for (const f of list) {
      try { const url = await uploadImage(f, "portfolio"); setD((x) => ({ ...x, images: [...x.images, url] })); }
      catch { setError("Neke slike nisu otpremljene. Pokušajte ponovo."); }
      setUploading((n) => n - 1);
    }
  };

  const save = async () => {
    if (!d.title.trim()) { setError("Upišite naziv projekta."); return; }
    if (!d.summary.trim()) { setError("Upišite kratak opis."); return; }
    if (d.link && !/^https?:\/\//.test(d.link)) { setError("Link mora da počinje sa https://"); return; }
    setBusy(true); setError("");
    const row = fromPortfolio({ ...d, title: d.title.trim(), slug: d.slug || slugify(d.title), features: features.split("\n").map((s) => s.trim()).filter(Boolean) });
    const res = d.id ? await db.from("portfolio_items").update(row).eq("id", d.id) : await db.from("portfolio_items").insert(row);
    setBusy(false);
    if (res.error) { setError(res.error.message.includes("duplicate") ? "Projekat sa ovim nazivom već postoji." : "Čuvanje nije uspelo."); return; }
    onSaved();
  };

  const remove = async () => {
    if (!d.id) return;
    setBusy(true);
    await db.from("portfolio_items").delete().eq("id", d.id);
    setBusy(false); onSaved();
  };

  return (
    <motion.div className="b-modal-scrim a-offer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="b-modal a-offer-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
        <h2>{d.id ? "Izmena projekta" : "Novi projekat"}</h2>
        <p className="b-hint">Projekat se prikazuje na početnoj stranici u delu „Aplikacije koje sam napravio“.</p>

        <div className="a-offer-grid a-two">
          <label className="b-field"><span>Naziv</span><input id="pf-title" value={d.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label className="b-field"><span>Vrsta</span>
            <select className="a-select" id="pf-kind" value={d.kind} onChange={(e) => set("kind", e.target.value as Draft["kind"])}>
              <option value="client">Realizovan projekat</option>
              <option value="demo">DEMO projekat</option>
            </select>
          </label>
          <label className="b-field"><span>Delatnost</span>
            <select className="a-select" id="pf-industry" value={d.industry} onChange={(e) => set("industry", e.target.value)}>
              {INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
            </select>
          </label>
          <label className="b-field"><span>Link (nije obavezno)</span><input id="pf-link" value={d.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://" /></label>
        </div>
        <label className="b-field"><span>Kratak opis (vidi se na kartici)</span><textarea id="pf-summary" rows={2} value={d.summary} onChange={(e) => set("summary", e.target.value)} /></label>
        <div className="a-offer-grid a-two">
          <label className="b-field"><span>Problem</span><textarea id="pf-problem" rows={3} value={d.problem ?? ""} onChange={(e) => set("problem", e.target.value)} /></label>
          <label className="b-field"><span>Rešenje</span><textarea id="pf-solution" rows={3} value={d.solution ?? ""} onChange={(e) => set("solution", e.target.value)} /></label>
        </div>
        <label className="b-field"><span>Funkcije (jedna po redu)</span><textarea id="pf-features" rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} /></label>
        {d.kind === "client" && <label className="b-field"><span>Rezultat (samo stvaran, npr. „550+ korisnika“)</span><input id="pf-headline" value={d.headline ?? ""} onChange={(e) => set("headline", e.target.value)} /></label>}

        <div className="b-field"><span>Snimci ekrana (prvi je naslovni)</span>
          <div className="a-pf-images">
            {d.images.map((src, i) => (
              <div key={src + i} className="a-pf-img">
                <img src={src} alt="" />
                <div className="a-pf-img-actions">
                  {i > 0 && <button type="button" onClick={() => set("images", [src, ...d.images.filter((_, j) => j !== i)])} aria-label="Postavi kao naslovnu"><Icon name="star" size={14} /></button>}
                  <button type="button" onClick={() => set("images", d.images.filter((_, j) => j !== i))} aria-label="Ukloni sliku"><Icon name="x" size={14} /></button>
                </div>
              </div>
            ))}
            <label className="a-pf-add">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
              <Icon name="upload" size={20} /><span>{uploading ? `Otpremamo (${uploading})…` : "Dodaj"}</span>
            </label>
          </div>
        </div>

        <label className="b-consent"><input type="checkbox" checked={d.published} onChange={(e) => set("published", e.target.checked)} /><span>Prikaži na sajtu</span></label>
        {error && <p className="b-error" role="alert">{error}</p>}

        <div className="b-modal-actions a-pf-foot">
          {d.id && (confirmDelete
            ? <><span className="a-sub">Sigurno brišete projekat?</span><button type="button" className="b-btn is-ghost a-danger" onClick={remove} disabled={busy}>Da, obriši</button></>
            : <button type="button" className="b-btn is-ghost a-danger" onClick={() => setConfirmDelete(true)}>Obriši</button>)}
          <span className="a-spacer" />
          <button type="button" className="b-btn is-ghost" onClick={onClose}>Odustani</button>
          <button type="button" className="b-btn" onClick={save} disabled={busy || uploading > 0}>{busy ? "Čuvamo…" : "Sačuvaj"}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
