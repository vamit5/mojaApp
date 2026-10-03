-- MojApp 0002 — deljivi demo, javne ponude, admin uloga, javne slike demoa.
-- Pokrenuti jednom u Supabase SQL Editor-u (posle 0001).

-- ── Admin: vlasnički email automatski dobija admin ulogu pri prvoj prijavi ──
-- Magic link potvrđuje da osoba stvarno ima pristup tom emailu.
create table if not exists admin_emails (email text primary key);
alter table admin_emails enable row level security;  -- bez politika: niko ga ne čita preko API-ja
insert into admin_emails (email) values ('vamit5.team@gmail.com') on conflict do nothing;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    case when exists (select 1 from admin_emails a where lower(a.email) = lower(new.email)) then 'admin'::user_role else 'client'::user_role end
  );
  return new;
end $$;

-- ako je nalog već postojao pre ove migracije
update profiles p set role = 'admin'
from auth.users u
where u.id = p.user_id and lower(u.email) in (select lower(email) from admin_emails);

-- ── Javne slike demoa (logo i fotografije koje je klijent sam poslao) ──
-- Putanje su {demo_id}/{nasumičan_id}.jpg, pa se ne mogu pogađati.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demo-media', 'demo-media', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ── Deljivi demo: javno čitanje samo po tačnom slug-u i samo sačuvanih demoa ──
create or replace function get_demo(p_slug text)
returns table (slug text, config jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.slug, d.config, d.created_at from demos d
  where d.slug = p_slug and d.status in ('saved','claimed');
$$;
revoke all on function get_demo(text) from public;
grant execute on function get_demo(text) to anon, authenticated;

-- ── Javna ponuda po tajnom tokenu ──
create or replace function get_offer(p_token text)
returns table (number text, status offer_status, plan_key text, items jsonb, phases jsonb, total numeric, monthly numeric,
               currency text, deposit_pct int, valid_until date, created_at timestamptz,
               client_name text, business_name text, industry text, demo_slug text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update offers set viewed_at = coalesce(viewed_at, now()),
                    status = case when status = 'poslata' then 'vidjena'::offer_status else status end
  where public_token = p_token;
  return query
    select o.number, o.status, o.plan_key, o.items, o.phases, o.total, o.monthly, o.currency, o.deposit_pct, o.valid_until, o.created_at,
           l.name, l.business_name, l.industry, d.slug
    from offers o join leads l on l.id = o.lead_id left join demos d on d.id = l.demo_id
    where o.public_token = p_token and o.status <> 'nacrt';
end $$;
revoke all on function get_offer(text) from public;
grant execute on function get_offer(text) to anon, authenticated;

create or replace function accept_offer(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_lead uuid;
begin
  update offers set status = 'prihvacena'
  where public_token = p_token and status in ('poslata','vidjena') and (valid_until is null or valid_until >= current_date)
  returning lead_id into v_lead;
  if v_lead is null then return false; end if;
  update leads set status = 'pregovori' where id = v_lead and status in ('nov','kontaktiran','poziv_zakazan','ponuda_poslata');
  insert into lead_activities (lead_id, type, body) values (v_lead, 'status', 'Klijent je prihvatio ponudu preko linka.');
  return true;
end $$;
revoke all on function accept_offer(text) from public;
grant execute on function accept_offer(text) to anon, authenticated;

-- ── Broj ponude: MA-2026-0001 ──
create sequence if not exists offer_seq;
create or replace function next_offer_number() returns text
language sql volatile security definer set search_path = public as $$
  select 'MA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('offer_seq')::text, 4, '0');
$$;
revoke all on function next_offer_number() from public;
grant execute on function next_offer_number() to authenticated;
