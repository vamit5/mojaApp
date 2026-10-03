-- Početni podaci: paketi, katalog modula, industrije, osnovna podešavanja.
-- Cene su predlog i menjaju se iz admin panela.

insert into pricing_plans (key, name, price_once, price_month, price_label, build_time, features, position) values
 ('start',     '{"sr":"START"}',      590,  19, null,                    '{"sr":"24–48h"}',          '["Do 6 modula iz kataloga","Vaš logo, boje i sadržaj","Admin panel za izmene","Priprema i predaja na App Store i Google Play"]', 1),
 ('business',  '{"sr":"BUSINESS"}',   1290, 29, null,                    '{"sr":"5–7 radnih dana"}', '["Svi moduli iz kataloga","Online plaćanje","Loyalty, članstvo, kuponi","Push kampanje i statistika"]', 2),
 ('custom',    '{"sr":"CUSTOM"}',     null, null, '{"sr":"od 2.900 €"}', '{"sr":"po ponudi"}',       '["Funkcije van kataloga","Integracije sa vašim sistemima","Sopstveni backend"]', 3),
 ('odrzavanje','{"sr":"Održavanje"}', null, 39, null,                    null,                       '["MojApp tim menja sadržaj umesto vas","Push kampanje po dogovoru"]', 4);

insert into modules_catalog (key, name, complexity, hours, base_price, tier, requires) values
 ('home',        '{"sr":"Početna"}',               1, 1, 0,   'start', '{}'),
 ('profile',     '{"sr":"Profil i nalog"}',        2, 2, 0,   'start', '{}'),
 ('contact',     '{"sr":"Kontakt i mapa"}',        1, 1, 0,   'start', '{}'),
 ('menu',        '{"sr":"Meni / proizvodi"}',      2, 3, 60,  'start', '{}'),
 ('services',    '{"sr":"Usluge"}',                2, 2, 40,  'start', '{}'),
 ('booking',     '{"sr":"Rezervacije"}',           3, 5, 120, 'start', '{}'),
 ('schedule',    '{"sr":"Raspored"}',              2, 3, 60,  'start', '{}'),
 ('gallery',     '{"sr":"Galerija"}',              1, 1, 20,  'start', '{}'),
 ('promotions',  '{"sr":"Promocije i kuponi"}',    2, 2, 50,  'start', '{}'),
 ('notifications','{"sr":"Push obaveštenja"}',     2, 3, 60,  'start', '{}'),
 ('faq',         '{"sr":"FAQ"}',                   1, 1, 10,  'start', '{}'),
 ('reviews',     '{"sr":"Recenzije"}',             2, 2, 40,  'start', '{}'),
 ('loyalty',     '{"sr":"Loyalty program"}',       3, 5, 150, 'business', '{profile}'),
 ('cart',        '{"sr":"Korpa i online plaćanje"}',4, 8, 250, 'business', '{menu,profile}'),
 ('membership',  '{"sr":"Članstvo"}',              3, 5, 150, 'business', '{profile}'),
 ('progress',    '{"sr":"Progres i statistika"}',  3, 5, 150, 'business', '{profile}'),
 ('video',       '{"sr":"Video sadržaj"}',         2, 3, 80,  'business', '{}'),
 ('chat',        '{"sr":"Chat"}',                  4, 8, 250, 'business', '{profile}'),
 ('blog',        '{"sr":"Blog / vesti"}',          2, 2, 50,  'start', '{}');

insert into industries (key, name, default_modules, palette, position) values
 ('restoran', '{"sr":"Restoran"}', '{home,menu,booking,loyalty,profile}',          '{"primary":"#9E2B25","secondary":"#1F1A17"}', 1),
 ('salon',    '{"sr":"Salon"}',    '{home,services,booking,promotions,profile}',   '{"primary":"#8A5A7A","secondary":"#221B20"}', 2),
 ('fitness',  '{"sr":"Fitness"}',  '{home,schedule,membership,progress,profile}',  '{"primary":"#3F7D3A","secondary":"#141A14"}', 3);

insert into site_settings (key, value) values
 ('brand',     '{"name":"MojApp"}'),
 ('seo',       '{"title":{"sr":"MojApp — mobilna aplikacija za vaš biznis"},"description":{"sr":"Napravite besplatan demo svoje aplikacije za par minuta. Prvo je vidite, zatim je naručite."}}'),
 ('analytics', '{"ga4":null,"meta_pixel":null}'),
 ('contact',   '{"email":null,"phone":null,"instagram":null}');
