-- MojApp — inicijalna šema (studio baza)
-- Sve tabele imaju RLS. Frontend koristi samo anon ključ; osetljive operacije idu kroz Edge Functions (service role).

create extension if not exists pgcrypto;

-- ───────────────────────── ENUM tipovi ─────────────────────────
create type user_role       as enum ('admin','staff','client');
create type lead_status     as enum ('nov','kontaktiran','poziv_zakazan','ponuda_poslata','pregovori','uplaceno','projekat_u_izradi','zavrseno','odbijeno');
create type project_stage   as enum ('ideja','dizajn','izrada','testiranje','spremno','prodavnice','objavljeno');
create type demo_status     as enum ('draft','saved','claimed','expired');
create type offer_status    as enum ('nacrt','poslata','vidjena','prihvacena','istekla','odbijena');
create type payment_kind    as enum ('deposit','balance','full','subscription');
create type payment_status  as enum ('pending','paid','failed','refunded');
create type portfolio_kind  as enum ('demo','client');
create type post_status     as enum ('ideja','nacrt','zakazano','objavljeno','greska');
create type post_category   as enum ('ideje_za_aplikacije','case_study','pre_after','business_tips','demo','behind_the_scenes','app_features','education');
create type maintenance_mode as enum ('samostalno','mesecno');

-- ───────────────────────── pomoćne funkcije ─────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── korisnici ─────────────────────────
create table profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  role       user_role not null default 'client',
  full_name  text,
  phone      text,
  locale     text not null default 'sr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','staff'));
$$;

-- novi auth korisnik → profil (uvek 'client'; admin se dodeljuje ručno u bazi)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- klijent ne sme sam da promeni ulogu
create or replace function guard_profile_role() returns trigger language plpgsql as $$
begin
  if new.role <> old.role and not is_admin() then raise exception 'role change not allowed'; end if;
  return new;
end $$;
create trigger profiles_role_guard before update on profiles for each row execute function guard_profile_role();

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references auth.users,
  action     text not null,
  entity     text not null,
  entity_id  text,
  diff       jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────── CMS ─────────────────────────
create table site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        jsonb not null default '{}',
  seo          jsonb not null default '{}',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table page_sections (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages on delete cascade,
  type       text not null,                  -- hero, industries, how_it_works, modules, demos, transparency, pricing, faq, testimonials, cta
  position   int  not null default 0,
  enabled    boolean not null default true,
  content    jsonb not null default '{}',    -- objavljeno
  draft      jsonb,                          -- nacrt (null = nema izmena)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on page_sections (page_id, position);

create table media (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  alt        jsonb not null default '{}',
  width      int, height int, blurhash text,
  created_at timestamptz not null default now()
);

create table pricing_plans (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,          -- start, business, custom, odrzavanje
  name        jsonb not null,
  price_once  numeric(10,2),                 -- null = "Na upit"
  price_month numeric(10,2),
  price_label jsonb,                         -- npr. {"sr":"od 2.900 €"}
  build_time  jsonb,
  features    jsonb not null default '[]',
  position    int not null default 0,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question jsonb not null, answer jsonb not null,
  position int not null default 0, enabled boolean not null default true
);

create table portfolio_items (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  kind           portfolio_kind not null,
  title          jsonb not null,
  industry       text not null,
  case_study     jsonb not null default '{}', -- problem, ideja, funkcionalnosti, ui
  demo_config    jsonb,
  results        jsonb,
  position       int not null default 0,
  published      boolean not null default false,
  created_at     timestamptz not null default now(),
  -- rezultati smeju postojati samo za stvarne klijente
  constraint results_only_for_clients check (results is null or kind = 'client')
);

-- ───────────────────────── Demo engine ─────────────────────────
create table industries (
  key             text primary key,
  name            jsonb not null,
  default_modules text[] not null default '{}',
  palette         jsonb not null default '{}',
  sample_content  jsonb not null default '{}',
  position        int not null default 0,
  enabled         boolean not null default true
);

create table modules_catalog (
  key        text primary key,
  name       jsonb not null,
  complexity int not null check (complexity between 1 and 5),
  hours      numeric(5,1) not null,
  base_price numeric(10,2) not null,
  tier       text not null default 'start' check (tier in ('start','business')),
  requires   text[] not null default '{}'
);

-- ───────────────────────── CRM ─────────────────────────
create table leads (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  phone         text,
  business_name text,
  industry      text,
  modules       text[] not null default '{}',
  demo_id       uuid,
  source        text,
  utm           jsonb not null default '{}',
  status        lead_status not null default 'nov',
  priority      boolean not null default false,  -- kliknuo "Želim ovu aplikaciju"
  estimate      jsonb,
  consent_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create index on leads (status, created_at desc);

create table demos (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,10),
  config             jsonb not null,
  status             demo_status not null default 'draft',
  lead_id            uuid references leads on delete set null,
  session_token_hash text not null,
  utm                jsonb not null default '{}',
  expires_at         timestamptz not null default now() + interval '30 days',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint config_size check (pg_column_size(config) < 200000)
);
alter table leads add constraint leads_demo_fk foreign key (demo_id) references demos on delete set null;

create table demo_assets (
  id         uuid primary key default gen_random_uuid(),
  demo_id    uuid not null references demos on delete cascade,
  path       text not null,
  kind       text not null check (kind in ('logo','photo')),
  created_at timestamptz not null default now()
);

create table lead_activities (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads on delete cascade,
  type       text not null check (type in ('napomena','poziv','email','status','podsetnik')),
  body       text,
  due_at     timestamptz,
  done       boolean not null default false,
  author_id  uuid references auth.users,
  created_at timestamptz not null default now()
);

create table offers (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  lead_id      uuid not null references leads on delete cascade,
  plan_key     text references pricing_plans(key),
  items        jsonb not null default '[]',
  phases       jsonb not null default '[]',
  total        numeric(10,2) not null,
  monthly      numeric(10,2),
  currency     text not null default 'EUR',
  deposit_pct  int not null default 50 check (deposit_pct between 0 and 100),
  valid_until  date,
  status       offer_status not null default 'nacrt',
  pdf_path     text,
  public_token text not null unique default encode(gen_random_bytes(18),'hex'),
  viewed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── Projekti ─────────────────────────
create table projects (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references auth.users on delete set null,
  lead_id       uuid references leads on delete set null,
  offer_id      uuid references offers on delete set null,
  demo_id       uuid references demos on delete set null,
  name          text not null,
  config        jsonb not null,
  config_locked boolean not null default false,
  stage         project_stage not null default 'ideja',
  stage_note    text,
  agreed_price  numeric(10,2),
  monthly_price numeric(10,2),
  maintenance   maintenance_mode not null default 'samostalno',
  store_links   jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table project_stage_history (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  stage             project_stage not null,
  note              text,
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now()
);

create table project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  path        text not null,
  category    text not null check (category in ('logo','slike','tekst','dizajn','finalno','ostalo')),
  uploaded_by uuid references auth.users,
  created_at  timestamptz not null default now()
);

create table project_comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  author_id  uuid references auth.users,
  body       text not null check (length(body) between 1 and 5000),
  internal   boolean not null default false,
  created_at timestamptz not null default now()
);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects on delete set null,
  offer_id     uuid references offers on delete set null,
  kind         payment_kind not null,
  amount       numeric(10,2) not null check (amount > 0),
  currency     text not null default 'EUR',
  provider     text not null default 'stripe',
  provider_ref text unique,
  status       payment_status not null default 'pending',
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────────────────── Sadržaj i analitika ─────────────────────────
create table content_posts (
  id           uuid primary key default gen_random_uuid(),
  category     post_category not null,
  title        text not null,
  caption      text,
  hashtags     text[] not null default '{}',
  video_path   text,
  thumb_path   text,
  scheduled_at timestamptz,
  status       post_status not null default 'ideja',
  ig_media_id  text,
  utm_campaign text unique,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table reel_scripts (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null,
  hook       text, voiceover text, on_screen jsonb, cta text, caption text,
  hashtags   text[] not null default '{}',
  post_id    uuid references content_posts on delete set null,
  created_at timestamptz not null default now()
);

create table events (
  id         bigint generated always as identity primary key,
  name       text not null,
  session_id text,
  demo_id    uuid,
  lead_id    uuid,
  utm        jsonb not null default '{}',
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (name, created_at desc);

create table rate_limits (
  bucket       text not null,
  key_hash     text not null,
  count        int  not null default 0,
  window_start timestamptz not null default now(),
  primary key (bucket, key_hash)
);

-- atomarni brojač za Edge funkcije: vraća true ako je zahtev dozvoljen
create or replace function rate_limit_hit(p_bucket text, p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into rate_limits as r (bucket, key_hash, count, window_start)
  values (p_bucket, p_key, 1, now())
  on conflict (bucket, key_hash) do update
    set count = case when r.window_start < now() - p_window then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning count into c;
  return c <= p_max;
end $$;
revoke execute on function rate_limit_hit from anon, authenticated;

-- ───────────────────────── updated_at trigeri ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','pages','page_sections','pricing_plans','leads','demos','offers','projects','payments','content_posts']
  loop execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t); end loop;
end $$;

-- promena faze projekta → istorija
create or replace function log_stage_change() returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into project_stage_history (project_id, stage, note) values (new.id, new.stage, new.stage_note);
  end if;
  return new;
end $$;
create trigger projects_stage_log after update on projects for each row execute function log_stage_change();

-- ───────────────────────── RLS ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','audit_log','site_settings','pages','page_sections','media','pricing_plans','faqs','portfolio_items',
    'industries','modules_catalog','demos','demo_assets','leads','lead_activities','offers','projects','project_stage_history',
    'project_files','project_comments','payments','content_posts','reel_scripts','events','rate_limits']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- javno čitanje objavljenog sadržaja
create policy public_read on site_settings   for select to anon, authenticated using (true);
create policy public_read on pages           for select to anon, authenticated using (published_at is not null);
create policy public_read on page_sections   for select to anon, authenticated using (enabled and exists (select 1 from pages p where p.id = page_id and p.published_at is not null));
create policy public_read on media           for select to anon, authenticated using (true);
create policy public_read on pricing_plans   for select to anon, authenticated using (enabled);
create policy public_read on faqs            for select to anon, authenticated using (enabled);
create policy public_read on portfolio_items for select to anon, authenticated using (published);
create policy public_read on industries      for select to anon, authenticated using (enabled);
create policy public_read on modules_catalog for select to anon, authenticated using (true);

-- demos, leads, events, offers: anon nema direktan pristup — sve kroz Edge Functions (service role zaobilazi RLS)

-- klijent vidi samo svoje
create policy own_profile_read   on profiles for select to authenticated using (user_id = auth.uid());
create policy own_profile_update on profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy client_read on projects for select to authenticated using (client_id = auth.uid());
create policy client_read on project_stage_history for select to authenticated
  using (visible_to_client and exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_read on project_files for select to authenticated
  using (exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_insert on project_files for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_read on project_comments for select to authenticated
  using (not internal and exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_insert on project_comments for insert to authenticated
  with check (not internal and author_id = auth.uid() and exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_read on payments for select to authenticated
  using (exists (select 1 from projects p where p.id = project_id and p.client_id = auth.uid()));
create policy client_read on demos for select to authenticated
  using (exists (select 1 from projects p where p.demo_id = demos.id and p.client_id = auth.uid()));

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true,  8388608, array['image/jpeg','image/png','image/webp','image/svg+xml','video/mp4']),
  ('demo-assets',  'demo-assets',  false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('projects',     'projects',     false, 52428800, null),
  ('offers',       'offers',       false, 10485760, array['application/pdf']),
  ('content',      'content',      false, 209715200, array['video/mp4','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "admin storage" on storage.objects for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "public media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-media');
-- projects/{project_id}/... — klijent čita i dodaje samo u svoj projekat
create policy "client project read" on storage.objects for select to authenticated
  using (bucket_id = 'projects' and exists (select 1 from projects p where p.id::text = (storage.foldername(name))[1] and p.client_id = auth.uid()));
create policy "client project upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'projects' and exists (select 1 from projects p where p.id::text = (storage.foldername(name))[1] and p.client_id = auth.uid()));
-- demo-assets: upload i čitanje isključivo kroz Edge Function (potpisani URL-ovi)

-- ───────────────────────── čišćenje (pg_cron) ─────────────────────────
-- select cron.schedule('expire-demos', '0 3 * * *', $$ update demos set status='expired' where status='draft' and expires_at < now(); delete from demos where status='expired' and expires_at < now() - interval '7 days'; $$);
