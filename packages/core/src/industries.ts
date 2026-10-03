import type { AppConfig, ModuleKey } from "./config";

export interface IndustryPreset {
  key: string;
  name: string;
  icon: string;           // naziv ikone iz @mojapp/ui
  base: "restoran" | "salon" | "fitness";
  modules: ModuleKey[];   // preporučeni
  primary: string;
  secondary: string;
  fonts: AppConfig["brand"]["fonts"];
  catalogLabel: string;   // kako se zove katalog u ovoj industriji
  bookingLabel: string;
}

/** 12 izbora iz koraka 1. Tri imaju kompletan demo sadržaj; ostali koriste najbliži osnovni preset. */
export const INDUSTRIES: IndustryPreset[] = [
  { key: "restoran", name: "Restoran",          icon: "utensils", base: "restoran", modules: ["home", "menu", "booking", "loyalty", "promotions", "profile"],  primary: "#9E2B25", secondary: "#1F1A17", fonts: "editorial", catalogLabel: "Meni",     bookingLabel: "Rezerviši sto" },
  { key: "salon",    name: "Salon",             icon: "scissors", base: "salon",    modules: ["home", "services", "booking", "promotions", "loyalty", "profile"], primary: "#8A5A7A", secondary: "#221B20", fonts: "editorial", catalogLabel: "Usluge",   bookingLabel: "Zakaži termin" },
  { key: "fitness",  name: "Fitness",           icon: "dumbbell", base: "fitness",  modules: ["home", "schedule", "membership", "progress", "profile"],       primary: "#3F7D3A", secondary: "#141A14", fonts: "bold",      catalogLabel: "Treninzi", bookingLabel: "Prijavi se" },
  { key: "beauty",   name: "Beauty",            icon: "sparkle",  base: "salon",    modules: ["home", "services", "booking", "loyalty", "profile"],           primary: "#B0607A", secondary: "#24191D", fonts: "editorial", catalogLabel: "Tretmani", bookingLabel: "Zakaži tretman" },
  { key: "auto",     name: "Auto servis",       icon: "wrench",   base: "salon",    modules: ["home", "services", "booking", "contact", "profile"],           primary: "#2F5D8A", secondary: "#141A21", fonts: "modern",    catalogLabel: "Usluge",   bookingLabel: "Zakaži servis" },
  { key: "nekretnine", name: "Nekretnine",      icon: "home",     base: "restoran", modules: ["home", "menu", "booking", "contact", "profile"],               primary: "#3D6B66", secondary: "#151C1B", fonts: "modern",    catalogLabel: "Ponuda",   bookingLabel: "Zakaži razgledanje" },
  { key: "shop",     name: "Online prodavnica", icon: "bag",      base: "restoran", modules: ["home", "menu", "promotions", "loyalty", "profile"],            primary: "#5A4FCF", secondary: "#17152A", fonts: "modern",    catalogLabel: "Proizvodi", bookingLabel: "Poruči" },
  { key: "edukacija", name: "Edukacija",        icon: "book",     base: "fitness",  modules: ["home", "schedule", "membership", "progress", "profile"],       primary: "#A0712B", secondary: "#1E1912", fonts: "editorial", catalogLabel: "Kursevi",  bookingLabel: "Upiši se" },
  { key: "trener",   name: "Trener",            icon: "stopwatch", base: "fitness", modules: ["home", "schedule", "membership", "progress", "profile"],       primary: "#C2452D", secondary: "#1C1412", fonts: "bold",      catalogLabel: "Treninzi", bookingLabel: "Zakaži trening" },
  { key: "klub",     name: "Klub / zajednica",  icon: "users",    base: "fitness",  modules: ["home", "schedule", "membership", "promotions", "profile"],     primary: "#2E6E8E", secondary: "#121A1F", fonts: "modern",    catalogLabel: "Događaji", bookingLabel: "Prijavi se" },
  { key: "booking",  name: "Booking biznis",    icon: "calendar", base: "salon",    modules: ["home", "services", "booking", "promotions", "profile"],        primary: "#4C6A3D", secondary: "#161C13", fonts: "modern",    catalogLabel: "Usluge",   bookingLabel: "Rezerviši" },
  { key: "drugo",    name: "Drugo",             icon: "plus",     base: "salon",    modules: ["home", "services", "booking", "contact", "profile"],           primary: "#3A3A3A", secondary: "#151515", fonts: "modern",    catalogLabel: "Ponuda",   bookingLabel: "Zakaži" },
];

export const industryByKey = (k: string) => INDUSTRIES.find((i) => i.key === k) ?? INDUSTRIES[0];

const id = (() => { let n = 0; return (p: string) => `${p}${++n}`; })();
const P = true; // placeholder — demo sadržaj uvek je označen

/** Demo sadržaj po osnovnom presetu. Svaka stavka nosi placeholder: true. */
function sample(base: IndustryPreset["base"]): Pick<AppConfig, "catalog" | "staff" | "promotions" | "loyalty"> & { heroTitle: string; heroSubtitle: string; about: string; hours: string } {
  if (base === "restoran") return {
    heroTitle: "Sveže, sezonski, iz naše kuhinje",
    heroSubtitle: "Rezervišite sto ili poručite za par sekundi.",
    about: "Primer opisa: porodična kuhinja sa domaćim testeninama i sezonskim namirnicama.",
    hours: "Pon–Ned 12:00–23:00",
    catalog: [
      { id: id("c"), name: "Predjela", items: [
        { id: id("i"), name: "Bruskete sa paradajzom", description: "Hleb iz naše peći, paradajz, bosiljak", price: 520, tag: "Vegan", placeholder: P },
        { id: id("i"), name: "Domaći sirevi", description: "Izbor tri sira sa medom i orasima", price: 890, placeholder: P },
      ]},
      { id: id("c"), name: "Glavna jela", items: [
        { id: id("i"), name: "Tagliatelle sa vrganjima", description: "Sveža testenina, vrganji, parmezan", price: 1240, tag: "Preporuka", placeholder: P },
        { id: id("i"), name: "Pileći file na žaru", description: "Pečeno povrće, sos od limuna", price: 1180, placeholder: P },
        { id: id("i"), name: "Rižoto sa šafranom", description: "Arborio pirinač, šafran, puter", price: 1090, placeholder: P },
      ]},
      { id: id("c"), name: "Dezerti", items: [
        { id: id("i"), name: "Tiramisu", description: "Po receptu kuće", price: 560, placeholder: P },
        { id: id("i"), name: "Čokoladni sufle", description: "Sa sladoledom od vanile", price: 620, tag: "Novo", placeholder: P },
      ]},
    ],
    staff: [],
    promotions: [
      { id: id("p"), title: "Ručak radnim danima", text: "−15% na glavna jela od 12 do 15h", code: "RUCAK15", placeholder: P },
      { id: id("p"), title: "Dezert gratis", text: "Uz svaku petu porudžbinu kroz aplikaciju", placeholder: P },
    ],
    loyalty: { pointsName: "poena", target: 10, reward: "Besplatan dezert" },
  };
  if (base === "salon") return {
    heroTitle: "Vaš termin, bez čekanja na telefonu",
    heroSubtitle: "Izaberite uslugu, osobu i vreme koje vam odgovara.",
    about: "Primer opisa: salon sa iskusnim timom i fokusom na detalje.",
    hours: "Pon–Sub 09:00–20:00",
    catalog: [
      { id: id("c"), name: "Kosa", items: [
        { id: id("i"), name: "Šišanje i feniranje", description: "Konsultacija, pranje, šišanje, stilizovanje", price: 2400, duration: 60, placeholder: P },
        { id: id("i"), name: "Farbanje", description: "Jednobojno farbanje sa negom", price: 4800, duration: 120, tag: "Popularno", placeholder: P },
        { id: id("i"), name: "Balayage", description: "Prirodno prelivanje tonova", price: 8900, duration: 180, placeholder: P },
      ]},
      { id: id("c"), name: "Nega", items: [
        { id: id("i"), name: "Tretman dubinske nege", description: "Za oštećenu i suvu kosu", price: 2200, duration: 45, placeholder: P },
        { id: id("i"), name: "Manikir", description: "Klasičan manikir sa lakiranjem", price: 1800, duration: 45, placeholder: P },
      ]},
    ],
    staff: [
      { id: id("s"), name: "Ana", role: "Stilista", placeholder: P },
      { id: id("s"), name: "Milica", role: "Kolorista", placeholder: P },
      { id: id("s"), name: "Jovana", role: "Nega i manikir", placeholder: P },
    ],
    promotions: [
      { id: id("p"), title: "Prva poseta", text: "−20% na prvu uslugu zakazanu kroz aplikaciju", code: "DOBRODOSLI", placeholder: P },
    ],
    loyalty: { pointsName: "pečata", target: 8, reward: "Tretman nege gratis" },
  };
  return {
    heroTitle: "Trening koji se uklapa u vaš dan",
    heroSubtitle: "Raspored, članarina i vaš napredak na jednom mestu.",
    about: "Primer opisa: grupni i individualni treninzi za sve nivoe.",
    hours: "Pon–Pet 07:00–22:00 · Sub 09:00–15:00",
    catalog: [
      { id: id("c"), name: "Grupni treninzi", items: [
        { id: id("i"), name: "Funkcionalni trening", description: "Snaga i kondicija, svi nivoi", duration: 60, tag: "Popularno", placeholder: P },
        { id: id("i"), name: "Mobilnost", description: "Istezanje i pokretljivost zglobova", duration: 45, placeholder: P },
        { id: id("i"), name: "HIIT", description: "Kratko i intenzivno", duration: 30, placeholder: P },
        { id: id("i"), name: "Snaga", description: "Tehnika osnovnih vežbi sa tegovima", duration: 60, placeholder: P },
      ]},
    ],
    staff: [
      { id: id("s"), name: "Marko", role: "Trener snage", placeholder: P },
      { id: id("s"), name: "Nina", role: "Trener mobilnosti", placeholder: P },
    ],
    promotions: [
      { id: id("p"), title: "Probni trening", text: "Prvi grupni trening je besplatan", placeholder: P },
    ],
    loyalty: { pointsName: "dolazaka", target: 12, reward: "Personalni trening gratis" },
  };
}

/** Polazni config za izabranu industriju. */
export function createConfig(industryKey: string, name = ""): AppConfig {
  const ind = industryByKey(industryKey);
  const s = sample(ind.base);
  const catalog = ind.key === ind.base ? s.catalog : s.catalog.map((c, i) => (i === 0 ? { ...c, name: ind.catalogLabel } : c));
  return {
    version: 1,
    industry: ind.key,
    brand: {
      name: name || ind.name,
      colors: { primary: ind.primary, secondary: ind.secondary },
      mode: "light",
      radius: "soft",
      fonts: ind.fonts,
      currency: "RSD",
    },
    modules: ind.modules,
    content: { heroTitle: s.heroTitle, heroSubtitle: s.heroSubtitle, about: s.about, photos: [], hours: s.hours, address: "Primer adrese 12, Beograd", phone: "+381 60 000 0000" },
    catalog,
    staff: s.staff,
    promotions: s.promotions,
    loyalty: s.loyalty,
  };
}
