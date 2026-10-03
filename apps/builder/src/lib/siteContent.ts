import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Sadržaj sajta koji se menja iz admina (Admin → Sajt). */

export interface Team {
  name: string; role?: string; city?: string; photo?: string | null; bio?: string;
  highlights?: string[]; whatsapp?: string | null; instagram?: string | null; email?: string | null;
}

export interface PortfolioItem {
  id: string; slug: string; kind: "demo" | "client"; title: string; industry: string; position: number; published: boolean;
  summary: string; problem?: string; solution?: string; features: string[]; link?: string; images: string[]; headline?: string;
}

// deno-lint-ignore no-explicit-any
export function toPortfolio(r: any): PortfolioItem {
  const cs = r.case_study ?? {};
  return {
    id: r.id, slug: r.slug, kind: r.kind, title: r.title?.sr ?? r.slug, industry: r.industry, position: r.position ?? 0, published: !!r.published,
    summary: cs.summary ?? "", problem: cs.problem, solution: cs.solution, features: cs.features ?? [], link: cs.link, images: cs.images ?? [],
    headline: r.results?.headline,
  };
}

export function fromPortfolio(p: Omit<PortfolioItem, "id"> & { id?: string }) {
  return {
    slug: p.slug, kind: p.kind, title: { sr: p.title }, industry: p.industry, position: p.position, published: p.published,
    case_study: { summary: p.summary, problem: p.problem || undefined, solution: p.solution || undefined, features: p.features, link: p.link || undefined, images: p.images },
    results: p.kind === "client" && p.headline ? { headline: p.headline } : null,
  };
}

export function useSiteContent() {
  const [team, setTeam] = useState<Team | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [contact, setContact] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!supabase) return;
    supabase.from("site_settings").select("key,value").in("key", ["team", "contact"]).then(({ data }) => {
      for (const row of data ?? []) {
        if (row.key === "team") setTeam(row.value as Team);
        if (row.key === "contact") setContact(row.value as Record<string, string | null>);
      }
    });
    supabase.from("portfolio_items").select("*").eq("published", true).order("position").then(({ data }) => setPortfolio((data ?? []).map(toPortfolio)));
  }, []);
  return { team, portfolio, contact };
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
export const waLink = (n?: string | null) => (n ? `https://wa.me/${n.replace(/[^\d]/g, "")}` : null);
export const igLink = (h?: string | null) => (h ? `https://instagram.com/${h.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")}` : null);
