-- 0006: narudžbina bez plaćanja. Klijent naručuje izradu iz ponude, projekat odmah kreće,
-- a plaća tek kad aplikaciju isproba i kad mu se svidi (iz portala projekta).

create or replace function order_offer(p_token text)
returns text language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_offer offers;
  v_lead leads;
  v_project uuid;
  v_config jsonb;
  v_note text := 'Narudžbina je potvrđena. Počinjemo izradu. Plaćate tek kad aplikaciju isprobate i kad vam se svidi.';
begin
  select * into v_offer from offers where public_token = p_token for update;
  if not found then return null; end if;

  if v_offer.status in ('poslata','vidjena') then
    if v_offer.valid_until is not null and v_offer.valid_until < current_date then return null; end if;
    update offers set status = 'prihvacena' where id = v_offer.id;
  elsif v_offer.status <> 'prihvacena' then
    return null;
  end if;

  select id into v_project from projects where offer_id = v_offer.id order by created_at limit 1;
  if v_project is null then
    select * into v_lead from leads where id = v_offer.lead_id;
    select config into v_config from demos where id = v_lead.demo_id;
    insert into projects (lead_id, offer_id, demo_id, name, config, stage, stage_note, agreed_price, monthly_price)
    values (v_lead.id, v_offer.id, v_lead.demo_id, coalesce(v_lead.business_name, 'Aplikacija'), coalesce(v_config, '{}'::jsonb),
            'dizajn', v_note, v_offer.total, v_offer.monthly)
    returning id into v_project;
    insert into project_stage_history (project_id, stage, note) values
      (v_project, 'ideja', 'Ponuda je prihvaćena.'),
      (v_project, 'dizajn', v_note);
    if v_lead.demo_id is not null then update demos set status = 'claimed' where id = v_lead.demo_id; end if;
    update leads set status = 'projekat_u_izradi' where id = v_lead.id and status not in ('uplaceno','zavrseno');
    insert into lead_activities (lead_id, type, body) values (v_lead.id, 'status', 'Klijent je naručio izradu preko linka (bez plaćanja unapred).');
  end if;

  return (select public_token from projects where id = v_project);
end $$;
revoke all on function order_offer(text) from public;
grant execute on function order_offer(text) to anon, authenticated;

-- Nove ponude podrazumevano bez depozita.
alter table offers alter column deposit_pct set default 0;

-- Kontakt email sajta.
update site_settings set value = jsonb_set(value, '{email}', '"moj.app.support@gmail.com"'::jsonb, true), updated_at = now() where key = 'team';
