-- Run this AFTER the original Haki tables have been created.

alter table public.businesses
  add column if not exists analytics_token uuid unique default gen_random_uuid();

update public.businesses
set analytics_token = gen_random_uuid()
where analytics_token is null;

create or replace function public.get_business_analytics(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_business_name text;
  v_counts jsonb;
  v_total bigint;
  v_daily jsonb;
begin
  select id, business_name
    into v_business_id, v_business_name
  from public.businesses
  where analytics_token = p_token
    and is_active = true
  limit 1;

  if v_business_id is null then
    raise exception 'Invalid analytics link';
  end if;

  select coalesce(jsonb_object_agg(event_type, event_count), '{}'::jsonb),
         coalesce(sum(event_count), 0)
    into v_counts, v_total
  from (
    select event_type, count(*) as event_count
    from public.analytics_events
    where business_id = v_business_id
    group by event_type
  ) counts;

  select coalesce(jsonb_agg(day_data order by day_data->>'day'), '[]'::jsonb)
    into v_daily
  from (
    select jsonb_build_object(
      'day', d::date,
      'label', to_char(d, 'DD Mon'),
      'views', (select count(*) from public.analytics_events e where e.business_id = v_business_id and e.event_type = 'profile_view' and e.created_at >= d and e.created_at < d + interval '1 day'),
      'interactions', (select count(*) from public.analytics_events e where e.business_id = v_business_id and e.event_type <> 'profile_view' and e.created_at >= d and e.created_at < d + interval '1 day')
    ) as day_data
    from generate_series(current_date - interval '6 days', current_date, interval '1 day') d
  ) days;

  return jsonb_build_object(
    'business_name', v_business_name,
    'counts', v_counts,
    'total_interactions', v_total,
    'daily', v_daily
  );
end;
$$;

revoke all on function public.get_business_analytics(uuid) from public;
grant execute on function public.get_business_analytics(uuid) to anon, authenticated;


-- Allows the signed-in Haki admin to permanently delete a business.
-- Analytics rows are deleted automatically because analytics_events references
-- businesses with ON DELETE CASCADE.
create or replace function public.delete_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  delete from public.businesses
  where id = p_business_id;
end;
$$;

revoke all on function public.delete_business(uuid) from public;
grant execute on function public.delete_business(uuid) to authenticated;
