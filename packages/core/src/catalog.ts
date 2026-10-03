import type { ModuleKey } from "./config";

export interface ModuleMeta {
  key: ModuleKey;
  name: string;
  short: string;       // naziv u donjoj navigaciji
  description: string; // objašnjenje u builderu
  complexity: 1 | 2 | 3 | 4 | 5;
  hours: number;
  tier: "start" | "business";
  inNav: boolean;      // dobija tab u donjoj navigaciji
}

/** Katalog modula. Izvor istine u produkciji je tabela modules_catalog; ovo je lokalna kopija za demo. */
export const MODULES: Record<ModuleKey, ModuleMeta> = {
  home:       { key: "home",       name: "Početna",            short: "Početna",  description: "Naslovna sa vašim fotografijama i najvažnijim akcijama.", complexity: 1, hours: 1, tier: "start",    inNav: true },
  menu:       { key: "menu",       name: "Meni i porudžbine",  short: "Meni",     description: "Kategorije, fotografije jela, cene i korpa.",           complexity: 2, hours: 3, tier: "start",    inNav: true },
  services:   { key: "services",   name: "Usluge",             short: "Usluge",   description: "Cenovnik usluga sa trajanjem i opisom.",                complexity: 2, hours: 2, tier: "start",    inNav: true },
  booking:    { key: "booking",    name: "Rezervacije",        short: "Termin",   description: "Izbor datuma, vremena i potvrda u par dodira.",         complexity: 3, hours: 5, tier: "start",    inNav: true },
  schedule:   { key: "schedule",   name: "Raspored treninga",  short: "Raspored", description: "Nedeljni raspored sa prijavom na termin.",              complexity: 2, hours: 3, tier: "start",    inNav: true },
  loyalty:    { key: "loyalty",    name: "Loyalty program",    short: "Nagrade",  description: "Poeni za svaku posetu i nagrade koje vraćaju klijente.", complexity: 3, hours: 5, tier: "business", inNav: true },
  membership: { key: "membership", name: "Članstvo",           short: "Članstvo", description: "Paketi članarine i digitalna članska karta.",           complexity: 3, hours: 5, tier: "business", inNav: true },
  progress:   { key: "progress",   name: "Progres",            short: "Progres",  description: "Statistika treninga i napredak kroz vreme.",            complexity: 3, hours: 5, tier: "business", inNav: true },
  promotions: { key: "promotions", name: "Promocije i kuponi", short: "Akcije",   description: "Aktuelne ponude i kuponi na početnoj.",                 complexity: 2, hours: 2, tier: "start",    inNav: false },
  gallery:    { key: "gallery",    name: "Galerija",           short: "Galerija", description: "Vaše fotografije u punom ekranu sa swipe-om.",          complexity: 1, hours: 1, tier: "start",    inNav: false },
  profile:    { key: "profile",    name: "Profil",             short: "Profil",   description: "Nalog, istorija rezervacija i podešavanja.",            complexity: 2, hours: 2, tier: "start",    inNav: true },
  contact:    { key: "contact",    name: "Kontakt i mapa",     short: "Kontakt",  description: "Adresa, radno vreme i poziv jednim dodirom.",           complexity: 1, hours: 1, tier: "start",    inNav: false },
};

/** Maksimalno tabova u donjoj navigaciji (ostalo ide na početnu). */
export const MAX_NAV = 5;

export function navModules(modules: ModuleKey[]): ModuleKey[] {
  const nav = modules.filter((m) => MODULES[m].inNav);
  // početna je uvek prva, profil uvek poslednji
  const middle = nav.filter((m) => m !== "home" && m !== "profile").slice(0, MAX_NAV - 2);
  return ["home", ...middle, ...(modules.includes("profile") ? (["profile"] as ModuleKey[]) : [])];
}
