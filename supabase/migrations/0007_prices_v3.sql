-- 0007: START 780 € (danas −50% = 390 €), BUSINESS 1.290 €, bez obaveznog mesečnog iznosa.
-- Održavanje 39 €/mes je opcionalno. CUSTOM se ne prikazuje.

update pricing_plans set price_once = 780, price_month = null, build_time = '{"sr":"24–48h"}'::jsonb,
  features = '["Kompletna izrada aplikacije za iOS i Android","Tvoj logo, boje i sadržaj","Do 6 funkcija iz kataloga","Priprema i objava na App Store i Google Play"]'::jsonb
where key = 'start';

update pricing_plans set price_once = 1290, price_month = null, build_time = '{"sr":"5–7 radnih dana"}'::jsonb,
  features = '["Sve iz START paketa","Sopstveni backend i baza podataka","Admin panel za upravljanje","Push notifikacije korisnicima","Online plaćanje, loyalty, članstvo i kuponi","Statistika korišćenja"]'::jsonb
where key = 'business';

update pricing_plans set enabled = false where key = 'custom';

update pricing_plans set name = '{"sr":"Održavanje"}'::jsonb, price_once = null, price_month = 39,
  features = '["Hosting i baza podataka","Prilagođavanje novim verzijama iOS-a i Androida","Tehnička podrška i ispravke","Izmene sadržaja po tvom zahtevu","Push kampanje po dogovoru"]'::jsonb
where key = 'odrzavanje';

-- Ponuda: samo danas, −50% na START.
update site_settings
set value = value || jsonb_build_object('label', 'Samo danas', 'percent', 50, 'plans', jsonb_build_array('start')), updated_at = now()
where key = 'offer';
