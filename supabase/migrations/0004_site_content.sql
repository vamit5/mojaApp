-- MojApp 0004 — početni sadržaj: "Ko stoji iza" i pravi projekti.
-- Sve se kasnije menja iz admina (Admin → Sajt). Pokrenuti jednom u SQL Editor-u.

insert into site_settings (key, value) values ('team', jsonb_build_object(
  'name', 'Borislav Kukić',
  'role', 'Osnivač MojApp-a i VAMIT-5',
  'city', 'Beograd',
  'photo', null,
  'bio', 'Ja sam Borislav. Vodim VAMIT-5, trening studio u Skadarliji, i sve digitalne alate za svoj biznis napravio sam sam: aplikaciju za članove sa pretplatom, aplikaciju za praćenje napretka i automatizaciju sadržaja za Instagram.' || chr(10) || chr(10) ||
         'Znam kako izgleda voditi biznis i koliko vredi aplikacija koju klijenti stvarno koriste. Zato MojApp radi drugačije: prvo vidite svoju aplikaciju, pa tek onda odlučujete. Svaku aplikaciju lično vodim od prvog demoa do objave.',
  'highlights', jsonb_build_array(
    '550+ ljudi prošlo je kroz VAMIT-5 aplikaciju',
    'Pretplate i plaćanja preko Stripe-a u mojim aplikacijama',
    'Aplikacije za iPhone i Android'
  ),
  'whatsapp', null,
  'instagram', null,
  'email', null
))
on conflict (key) do nothing;

insert into portfolio_items (slug, kind, title, industry, case_study, results, position, published) values
('vamit5-app', 'client', '{"sr":"VAMIT-5 aplikacija"}', 'fitness', jsonb_build_object(
   'summary', 'Aplikacija za članove VAMIT-5 trening programa: treninzi bilo kad i bilo gde, članstvo sa mesečnom pretplatom i nagrade za redovno treniranje.',
   'problem', 'Članovi su želeli da treniraju i van studija, uz istu motivaciju i praćenje kao na grupnim treninzima.',
   'solution', 'Aplikacija sa treninzima, pretplatom preko Stripe-a, nagradama za svaki odrađen trening i izazovima koji se prate na svim uređajima.',
   'features', jsonb_build_array('Članstvo i mesečna pretplata preko Stripe-a', 'Nagrade za svaki odrađen trening', '28-dnevni izazov, sinhronizovan na svim uređajima', 'Verzije za iPhone i Android'),
   'link', 'https://vamit5-app.com',
   'images', jsonb_build_array('/portfolio/vamit5-app.webp', '/portfolio/vamit5-site.webp')
 ), '{"headline":"550+ korisnika"}', 1, true),
('v5-360-scan', 'client', '{"sr":"V5 360° Scan"}', 'fitness', jsonb_build_object(
   'summary', 'Aplikacija koja prati fizički napredak preko fotografija: telefon prepoznaje položaj tela i upoređuje snimke kroz vreme.',
   'problem', 'Vaga ne pokazuje pravi napredak, a ručno poređenje fotografija je nepouzdano.',
   'solution', 'Kamera telefona prepoznaje položaj tela, fotografije se snimaju uvek na isti način, a podsetnici stižu kao push obaveštenja.',
   'features', jsonb_build_array('Prepoznavanje položaja tela kamerom', 'Praćenje napretka kroz prave fotografije', 'Push obaveštenja i nedeljni podsetnici'),
   'link', 'https://vamit5-360-scan.netlify.app',
   'images', jsonb_build_array('/portfolio/v5-360-scan.webp')
 ), null, 2, true),
('exathleague', 'client', '{"sr":"EXATHLEAGUE"}', 'drugo', jsonb_build_object(
   'summary', 'Igra prognoza za Exatlon Srbija: igrači pogađaju pobednike duela, skupljaju poene i takmiče se na rang listi.',
   'problem', 'Gledaoci su hteli da prate takmičenje aktivno, a ne samo da gledaju.',
   'solution', 'Jednostavna igra na srpskom: prijava, prognoza za svaki duel, dnevna i ukupna rang lista i admin panel za unos rezultata.',
   'features', jsonb_build_array('Nalog i prijava za igrače', 'Dnevna i ukupna rang lista', 'Admin panel za duele i rezultate', 'Podsetnici na email'),
   'link', 'https://exathleague.com',
   'images', jsonb_build_array('/portfolio/exathleague.webp')
 ), null, 3, true)
on conflict (slug) do nothing;
