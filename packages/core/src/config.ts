import { z } from "zod";

/** Ključevi modula koje engine ume da renderuje. */
export const MODULE_KEYS = [
  "home", "menu", "services", "booking", "schedule", "loyalty", "membership",
  "progress", "promotions", "gallery", "profile", "contact",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const asset = z.string().max(2_000_000); // data URL u demou, storage path u produkciji

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string().max(80),
  description: z.string().max(240).optional(),
  price: z.number().nonnegative().optional(),      // u RSD (demo) — valuta iz brand.currency
  duration: z.number().int().positive().optional(), // minuti (usluge)
  photo: asset.optional(),
  tag: z.string().max(24).optional(),
  placeholder: z.boolean().default(false),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().max(40),
  items: z.array(ItemSchema).max(40),
});

export const AppConfigSchema = z.object({
  version: z.literal(1),
  industry: z.string(),
  brand: z.object({
    name: z.string().min(1).max(40),
    tagline: z.string().max(80).optional(),
    logo: asset.optional(),
    colors: z.object({ primary: hex, secondary: hex }),
    mode: z.enum(["light", "dark"]),
    radius: z.enum(["sharp", "soft", "round"]),
    fonts: z.enum(["modern", "editorial", "bold"]),
    currency: z.string().default("RSD"),
  }),
  modules: z.array(z.enum(MODULE_KEYS)).min(1).max(12),
  content: z.object({
    heroTitle: z.string().max(80),
    heroSubtitle: z.string().max(160),
    about: z.string().max(600).optional(),
    photos: z.array(asset).max(8),
    address: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    hours: z.string().max(80).optional(),
  }),
  catalog: z.array(CategorySchema).max(12), // meni / usluge / časovi
  staff: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), photo: asset.optional(), placeholder: z.boolean().default(false) })).max(12),
  promotions: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), code: z.string().optional(), placeholder: z.boolean().default(false) })).max(8),
  loyalty: z.object({ pointsName: z.string(), target: z.number().int().positive(), reward: z.string() }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type CatalogItem = z.infer<typeof ItemSchema>;
export type Category = z.infer<typeof CategorySchema>;
