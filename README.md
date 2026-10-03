# MojApp

Sistem koji biznisu omogućava da za par minuta napravi i isproba demo svoje mobilne aplikacije, a zatim je naruči.
Arhitektura i plan: dokument „MojApp — Arhitektura sistema i plan implementacije“.

## Šta je urađeno (Faza 0 + Faza 1 + jezgro Faze 2)

| Deo | Gde | Status |
| --- | --- | --- |
| Monorepo (pnpm workspaces) | `/` | gotovo |
| Supabase šema, enum tipovi, RLS, storage bucketi | `supabase/migrations/0001_init.sql` | gotovo, testirano |
| Početni podaci: paketi i cene, katalog modula, industrije | `supabase/seed.sql` | gotovo |
| Edge funkcija za prijem leada (validacija, rate limit) | `supabase/functions/lead-submit` | gotovo, čeka deploy |
| Config šema, katalog modula, 12 industrija, interna procena | `packages/core` | gotovo |
| Ikonice i alati za boje (boja iz logoa, kompresija slika) | `packages/ui` | gotovo |
| Demo App Engine: 9 ekrana (početna, meni+korpa, usluge, rezervacija, raspored, loyalty, članstvo, progres, profil) | `packages/app-engine` | gotovo |
| Demo Builder: 6 koraka, telefon uživo, customizer, završni ekran, forma za lead | `apps/builder` | gotovo |

## Pokretanje

```bash
pnpm install
pnpm dev            # builder na http://localhost:5173
pnpm build          # produkcijski build (apps/builder/dist)
pnpm --filter @mojapp/builder build:single   # jedan HTML fajl (za brzo deljenje)
```

Bez `.env` builder radi u demo režimu (lead se ne šalje nigde). Za pravi rad:

```bash
cp .env.example apps/builder/.env      # upisati VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY
supabase link --project-ref <ref>
supabase db push                        # migracija
psql "$DATABASE_URL" -f supabase/seed.sql
supabase functions deploy lead-submit
```

Admin nalog: posle prve prijave u bazi postaviti `update profiles set role = 'admin' where user_id = '<uuid>';`

## Pravila koja se ne krše

- Tajni ključevi samo u Supabase secrets, nikad u `VITE_*` promenljivama.
- Sve što nije sadržaj klijenta nosi `placeholder: true` i u aplikaciji oznaku „Primer“.
- Portfolio stavka tipa `demo` ne može imati rezultate (CHECK u bazi).

## Sledeće (Faza 2 → 3)

1. Netlify sajt za builder + Supabase projekat (`mojapp-prod`), deploy funkcije.
2. Prebacivanje fotografija iz demoa u `demo-assets` bucket; deljivi link `/d/{slug}`.
3. Marketing početna stranica (hero sa živim engine-om).
4. Admin: CRM kanban, procena, Generate Offer + PDF.
