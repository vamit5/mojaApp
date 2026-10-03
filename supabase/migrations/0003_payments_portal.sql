-- MojApp 0003 — uplate (Stripe), projekti i klijentski portal preko tajnog linka.
-- Pokrenuti jednom u Supabase SQL Editor-u (posle 0002).

-- ── Tajni link za klijentski portal ──
alter table projects add column if not exists public_token text unique default encode(gen_random_bytes(18), 'hex');
update projects set public_token = encode(gen_random_bytes(18), 'hex') where public_token is null;
alter table projects alter column public_token set not null;

-- ── Ponuda sada vraća i status uplate i link ka projektu ──
drop function if exists get_offer(text);
create function get_offer(p_token text)
returns table (number text, status offer_status, plan_key text, items jsonb, phases jsonb, total numeric, monthly numeric,
               currency text, deposit_pct int, valid_until date, created_at timestamptz,
               client_name text, business_name text, industry text, demo_slug text,
               deposit_paid boolean, project_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update offers set viewed_at = coalesce(viewed_at, now()),
                    status = case when status = 'poslata' then 'vidjena'::offer_status else status end
  where public_token = p_token;
  return query
    select o.number, o.status, o.plan_key, o.items, o.phases, o.total, o.monthly, o.currency, o.deposit_pct, o.valid_until, o.created_at,
           l.name, l.business_name, l.industry, d.slug,
           exists (select 1 from payments y where y.offer_id = o.id and y.kind in ('deposit','full') and y.status = 'paid'),
           (select pr.public_token from projects pr where pr.offer_id = o.id order by pr.created_at limit 1)
    from offers o join leads l on l.id = o.lead_id left join demos d on d.id = l.demo_id
    where o.public_token = p_token and o.status <> 'nacrt';
end $$;
revoke all on function get_offer(text) from public;
grant execute on function get_offer(text) to anon, authenticated;

-- ── Beleženje uplate: poziva je samo Edge funkcija (service role) posle provere kod Stripe-a ──
-- Prva uplata (depozit ili ceo iznos) pravi projekat. Funkcija je idempotentna: ponovni poziv ništa ne duplira.
create or replace function record_payment(p_session text)
returns table (project_token text, newly boolean, kind payment_kind, amount numeric, business_name text, client_email text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_pay payments;
  v_offer offers;
  v_lead leads;
  v_project uuid;
  v_new boolean := false;
  v_config jsonb;
begin
  select * into v_pay from payments where provider_ref = p_session for update;
  if not found then return; end if;
  select * into v_offer from offers where id = v_pay.offer_id;
  select * into v_lead from leads where id = v_offer.lead_id;

  if v_pay.status <> 'paid' then
    update payments set status = 'paid', paid_at = now() where id = v_pay.id;
    v_new := true;
  end if;

  v_project := v_pay.project_id;
  if v_project is null then
    select id into v_project from projects where offer_id = v_offer.id order by created_at limit 1;
  end if;

  if v_project is null and v_pay.kind in ('deposit','full') then
    select config into v_config from demos where id = v_lead.demo_id;
    insert into projects (lead_id, offer_id, demo_id, name, config, stage, stage_note, agreed_price, monthly_price)
    values (v_lead.id, v_offer.id, v_lead.demo_id, coalesce(v_lead.business_name, 'Aplikacija'), coalesce(v_config, '{}'::jsonb),
            'dizajn', 'Depozit je uplaćen. Počinjemo dizajn vaše aplikacije.', v_offer.total, v_offer.monthly)
    returning id into v_project;
    insert into project_stage_history (project_id, stage, note) values
      (v_project, 'ideja', 'Ponuda je prihvaćena.'),
      (v_project, 'dizajn', 'Depozit je uplaćen. Počinjemo dizajn vaše aplikacije.');
    if v_lead.demo_id is not null then update demos set status = 'claimed' where id = v_lead.demo_id; end if;
  end if;

  if v_project is not null and v_pay.project_id is null then
    update payments set project_id = v_project where id = v_pay.id;
  end if;

  if v_new then
    if v_pay.kind in ('deposit','full') then
      update leads set status = 'uplaceno' where id = v_lead.id and status not in ('projekat_u_izradi','zavrseno');
    end if;
    insert into lead_activities (lead_id, type, body)
    values (v_lead.id, 'status', format('Uplata %s: %s %s', case v_pay.kind when 'deposit' then 'depozita' when 'balance' then 'ostatka' else 'celog iznosa' end, v_pay.amount, v_pay.currency));
  end if;

  return query select (select public_token from projects where id = v_project), v_new, v_pay.kind, v_pay.amount, v_lead.business_name, v_lead.email;
end $$;
revoke all on function record_payment(text) from public, anon, authenticated;
grant execute on function record_payment(text) to service_role;

-- ── Klijentski portal: sve što klijent sme da vidi, u jednom pozivu ──
create or replace function get_project(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name, 'stage', p.stage, 'stage_note', p.stage_note, 'store_links', p.store_links,
    'created_at', p.created_at, 'agreed_price', p.agreed_price, 'monthly_price', p.monthly_price, 'config', p.config,
    'client_name', (select l.name from leads l where l.id = p.lead_id),
    'offer', (select jsonb_build_object('number', o.number, 'total', o.total, 'deposit_pct', o.deposit_pct, 'currency', o.currency, 'token', o.public_token)
              from offers o where o.id = p.offer_id),
    'history', coalesce((select jsonb_agg(jsonb_build_object('stage', h.stage, 'note', h.note, 'at', h.created_at) order by h.created_at)
                         from project_stage_history h where h.project_id = p.id and h.visible_to_client), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('kind', y.kind, 'amount', y.amount, 'currency', y.currency, 'paid_at', y.paid_at) order by y.paid_at)
                          from payments y where y.project_id = p.id and y.status = 'paid'), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('body', c.body, 'from', case when c.author_id is null then 'client' else 'team' end, 'at', c.created_at) order by c.created_at)
                          from project_comments c where c.project_id = p.id and not c.internal), '[]'::jsonb)
  )
  from projects p where p.public_token = p_token;
$$;
revoke all on function get_project(text) from public;
grant execute on function get_project(text) to anon, authenticated;

create or replace function add_project_comment(p_token text, p_body text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_recent int;
begin
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 2000 then return false; end if;
  select id into v_id from projects where public_token = p_token;
  if v_id is null then return false; end if;
  select count(*) into v_recent from project_comments where project_id = v_id and author_id is null and created_at > now() - interval '1 hour';
  if v_recent >= 20 then return false; end if;
  insert into project_comments (project_id, author_id, body, internal) values (v_id, null, trim(p_body), false);
  return true;
end $$;
revoke all on function add_project_comment(text, text) from public;
grant execute on function add_project_comment(text, text) to anon, authenticated;
