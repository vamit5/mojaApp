-- 0005: nove redovne cene i lansirna ponuda (−50%) koja se uključuje iz admina.
-- Redovna cena ostaje u pricing_plans; popust i rok su u site_settings.offer.

update pricing_plans set price_once = 690  where key = 'start';
update pricing_plans set price_once = 1390 where key = 'business';
update pricing_plans set price_label = '{"sr":"od 2.900 €"}'::jsonb where key = 'custom';

-- Ponuda važi do kraja današnjeg dana (po beogradskom vremenu) od trenutka pokretanja.
-- Posle toga se rok menja iz Admin → Sajt → Ponuda.
insert into site_settings (key, value) values (
  'offer',
  jsonb_build_object(
    'percent', 50,
    'label', 'Lansirna ponuda',
    'ends_at', to_char(((date_trunc('day', now() at time zone 'Europe/Belgrade') + interval '23 hours 59 minutes 59 seconds') at time zone 'Europe/Belgrade') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
)
on conflict (key) do update set value = excluded.value, updated_at = now();
