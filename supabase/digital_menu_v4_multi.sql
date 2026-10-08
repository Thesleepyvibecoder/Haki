-- HAKI DIGITAL MENU V4
-- Multiple menus per business + independent branding + NFC stand assignment + restaurant manager access.
-- Run ONCE in Supabase SQL Editor after the existing digital-menu and menu_access_mode SQL.

create extension if not exists pgcrypto;

alter table public.businesses
  add column if not exists menu_access_mode text not null default 'image';

alter table public.businesses
  drop constraint if exists businesses_menu_access_mode_check;

alter table public.businesses
  add constraint businesses_menu_access_mode_check
  check (menu_access_mode in ('image','digital','whatsapp'));

alter table public.businesses
  add column if not exists menu_whatsapp_message text default 'Hi, I would like to access your menu.';

create table if not exists public.digital_menus (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null,
  title text not null default 'Menu',
  subtitle text default '',
  logo_url text,
  banner_url text,
  theme jsonb not null default '{"preset":"Cafe Rio"}'::jsonb,
  menu_data jsonb not null default '{"categories":[]}'::jsonb,
  working_hours jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create index if not exists digital_menus_business_id_idx on public.digital_menus(business_id);

create table if not exists public.digital_menu_stands (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  menu_id uuid not null references public.digital_menus(id) on delete cascade,
  stand_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  stand_name text not null default 'NFC Stand',
  location text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists digital_menu_stands_business_id_idx on public.digital_menu_stands(business_id);
create index if not exists digital_menu_stands_menu_id_idx on public.digital_menu_stands(menu_id);

create table if not exists public.restaurant_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'restaurant_manager',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(auth_user_id),
  unique(business_id, email)
);

create index if not exists restaurant_users_business_id_idx on public.restaurant_users(business_id);

alter table public.digital_menus enable row level security;
alter table public.digital_menu_stands enable row level security;
alter table public.restaurant_users enable row level security;

revoke all on public.digital_menus from anon, authenticated;
revoke all on public.digital_menu_stands from anon, authenticated;
revoke all on public.restaurant_users from anon, authenticated;

create or replace function public.get_restaurant_context()
returns table(business_id uuid, auth_user_id uuid)
language sql
security definer
set search_path = public
as $$
  select ru.business_id, ru.auth_user_id
  from public.restaurant_users ru
  where ru.auth_user_id = auth.uid()
    and ru.is_active = true
  limit 1;
$$;

revoke all on function public.get_restaurant_context() from public;
grant execute on function public.get_restaurant_context() to authenticated;

create or replace function public.get_restaurant_menus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_result jsonb;
begin
  select business_id into v_business_id from public.get_restaurant_context();
  if v_business_id is null then
    raise exception 'Restaurant access is not configured.';
  end if;

  select jsonb_build_object(
    'business', (select to_jsonb(b) from public.businesses b where b.id=v_business_id),
    'menus', coalesce((select jsonb_agg(to_jsonb(dm) order by dm.created_at, dm.title) from public.digital_menus dm where dm.business_id=v_business_id), '[]'::jsonb),
    'stands', coalesce((select jsonb_agg(to_jsonb(ds) order by ds.created_at) from public.digital_menu_stands ds where ds.business_id=v_business_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.get_restaurant_menus() to authenticated;

create or replace function public.save_restaurant_menu(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_menu_id uuid;
  v_menu jsonb := coalesce(p_payload->'menu', '{}'::jsonb);
  v_result jsonb;
begin
  select business_id into v_business_id from public.get_restaurant_context();
  if v_business_id is null then raise exception 'Restaurant access is not configured.'; end if;
  v_menu_id := nullif(v_menu->>'id','')::uuid;

  if v_menu_id is null then
    insert into public.digital_menus(business_id,slug,title,subtitle,logo_url,banner_url,theme,menu_data,working_hours,details,is_active)
    values (
      v_business_id,
      coalesce(nullif(v_menu->>'slug',''), lower(regexp_replace(coalesce(v_menu->>'title','menu'), '[^a-zA-Z0-9]+', '-', 'g'))),
      coalesce(nullif(v_menu->>'title',''),'Menu'), coalesce(v_menu->>'subtitle',''), nullif(v_menu->>'logo_url',''), nullif(v_menu->>'banner_url',''),
      coalesce(v_menu->'theme','{"preset":"Cafe Rio"}'::jsonb), coalesce(v_menu->'menu_data','{"categories":[]}'::jsonb), coalesce(v_menu->'working_hours','[]'::jsonb), coalesce(v_menu->'details','{}'::jsonb), coalesce((v_menu->>'is_active')::boolean,true)
    ) returning id into v_menu_id;
  else
    update public.digital_menus set
      slug=coalesce(nullif(v_menu->>'slug',''),slug), title=coalesce(nullif(v_menu->>'title',''),title), subtitle=coalesce(v_menu->>'subtitle',subtitle),
      logo_url=case when v_menu ? 'logo_url' then nullif(v_menu->>'logo_url','') else logo_url end,
      banner_url=case when v_menu ? 'banner_url' then nullif(v_menu->>'banner_url','') else banner_url end,
      theme=coalesce(v_menu->'theme',theme), menu_data=coalesce(v_menu->'menu_data',menu_data), working_hours=coalesce(v_menu->'working_hours',working_hours), details=coalesce(v_menu->'details',details),
      is_active=coalesce((v_menu->>'is_active')::boolean,is_active), updated_at=now()
    where id=v_menu_id and business_id=v_business_id;
    if not found then raise exception 'Menu not found.'; end if;
  end if;

  return (select to_jsonb(dm) from public.digital_menus dm where dm.id=v_menu_id);
end;
$$;

grant execute on function public.save_restaurant_menu(jsonb) to authenticated;

create or replace function public.delete_restaurant_menu(p_menu_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_business_id uuid;
begin
  select business_id into v_business_id from public.get_restaurant_context();
  if v_business_id is null then raise exception 'Restaurant access is not configured.'; end if;
  delete from public.digital_menus where id=p_menu_id and business_id=v_business_id;
end;
$$;

grant execute on function public.delete_restaurant_menu(uuid) to authenticated;

create or replace function public.save_restaurant_stand(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_business_id uuid; v_id uuid; v_result jsonb;
begin
  select business_id into v_business_id from public.get_restaurant_context();
  if v_business_id is null then raise exception 'Restaurant access is not configured.'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  if not exists(select 1 from public.digital_menus where id=(p_payload->>'menu_id')::uuid and business_id=v_business_id) then raise exception 'The selected menu does not belong to this restaurant.'; end if;
  if v_id is null then
    insert into public.digital_menu_stands(business_id,menu_id,stand_name,location,is_active)
    values(v_business_id,(p_payload->>'menu_id')::uuid,coalesce(nullif(p_payload->>'stand_name',''),'NFC Stand'),coalesce(p_payload->>'location',''),coalesce((p_payload->>'is_active')::boolean,true))
    returning id into v_id;
  else
    update public.digital_menu_stands set menu_id=(p_payload->>'menu_id')::uuid,stand_name=coalesce(nullif(p_payload->>'stand_name',''),stand_name),location=coalesce(p_payload->>'location',location),is_active=coalesce((p_payload->>'is_active')::boolean,is_active),updated_at=now()
    where id=v_id and business_id=v_business_id;
  end if;
  return (select to_jsonb(ds) from public.digital_menu_stands ds where ds.id=v_id);
end;
$$;

grant execute on function public.save_restaurant_stand(jsonb) to authenticated;

create or replace function public.get_public_digital_menu(p_business_slug text, p_menu_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'business_name', b.business_name,
    'business_slug', b.slug,
    'business_id', b.id,
    'menu', to_jsonb(dm)
  ) into v_result
  from public.businesses b join public.digital_menus dm on dm.business_id=b.id
  where b.slug=p_business_slug and b.is_active=true and dm.slug=p_menu_slug and dm.is_active=true
  limit 1;
  return v_result;
end;
$$;

grant execute on function public.get_public_digital_menu(text,text) to anon, authenticated;

create or replace function public.get_public_menu_by_stand(p_stand_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'business_name', b.business_name,
    'business_slug', b.slug,
    'business_id', b.id,
    'menu', to_jsonb(dm)
  ) into v_result
  from public.digital_menu_stands ds
  join public.businesses b on b.id=ds.business_id
  join public.digital_menus dm on dm.id=ds.menu_id
  where ds.stand_token=p_stand_token and ds.is_active=true and dm.is_active=true and b.is_active=true
  limit 1;
  return v_result;
end;
$$;

grant execute on function public.get_public_menu_by_stand(text) to anon, authenticated;

-- Optional migration helper: if the earlier single digital_menu JSON exists, create one menu per business.
-- This is safe to run once. It does not delete the old fields.
do $$
declare r record; v_slug text; v_exists boolean;
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='digital_menu') then
    for r in select id,slug,business_name,digital_menu,digital_menu_hours,digital_menu_details,digital_menu_enabled from public.businesses where coalesce(digital_menu_enabled,false)=true loop
      v_slug := lower(regexp_replace(coalesce(nullif(r.digital_menu->>'title',''), 'menu'), '[^a-zA-Z0-9]+','-','g'));
      if v_slug='' then v_slug:='menu'; end if;
      select exists(select 1 from public.digital_menus where business_id=r.id and slug=v_slug) into v_exists;
      if not v_exists then
        insert into public.digital_menus(business_id,slug,title,subtitle,theme,menu_data,working_hours,details,is_active)
        values(r.id,v_slug,coalesce(nullif(r.digital_menu->>'title',''),'Menu'),coalesce(r.digital_menu->>'subtitle',''),jsonb_build_object('preset',coalesce(r.digital_menu_details->>'theme','Cafe Rio')),coalesce(r.digital_menu,'{"categories":[]}'::jsonb),coalesce(r.digital_menu_hours,'[]'::jsonb),coalesce(r.digital_menu_details,'{}'::jsonb),true);
      end if;
    end loop;
  end if;
end $$;

-- Haki owner/admin authorization for menu and stand management.
create table if not exists public.haki_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.haki_admin_users enable row level security;
revoke all on public.haki_admin_users from anon, authenticated;

create or replace function public.is_haki_admin()
returns boolean
language sql
security definer
set search_path = public
as $$ select exists(select 1 from public.haki_admin_users where user_id=auth.uid()); $$;
revoke all on function public.is_haki_admin() from public;
grant execute on function public.is_haki_admin() to authenticated;

create or replace function public.get_admin_digital_menus(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_haki_admin() then raise exception 'Haki admin access required.'; end if;
  return jsonb_build_object(
    'business', (select to_jsonb(b) from public.businesses b where b.id=p_business_id),
    'menus', coalesce((select jsonb_agg(to_jsonb(dm) order by dm.created_at, dm.title) from public.digital_menus dm where dm.business_id=p_business_id),'[]'::jsonb),
    'stands', coalesce((select jsonb_agg(to_jsonb(ds) order by ds.created_at) from public.digital_menu_stands ds where ds.business_id=p_business_id),'[]'::jsonb)
  );
end $$;
grant execute on function public.get_admin_digital_menus(uuid) to authenticated;

create or replace function public.save_admin_digital_menu(p_business_id uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_id uuid; v_menu jsonb:=p_payload; v_result jsonb;
begin
  if not public.is_haki_admin() then raise exception 'Haki admin access required.'; end if;
  v_id:=nullif(v_menu->>'id','')::uuid;
  if v_id is null then
    insert into public.digital_menus(business_id,slug,title,subtitle,logo_url,banner_url,theme,menu_data,working_hours,details,is_active)
    values(p_business_id,coalesce(nullif(v_menu->>'slug',''),lower(regexp_replace(coalesce(v_menu->>'title','menu'),'[^a-zA-Z0-9]+','-','g'))),coalesce(nullif(v_menu->>'title',''),'Menu'),coalesce(v_menu->>'subtitle',''),nullif(v_menu->>'logo_url',''),nullif(v_menu->>'banner_url',''),coalesce(v_menu->'theme','{"preset":"Cafe Rio"}'::jsonb),coalesce(v_menu->'menu_data','{"categories":[]}'::jsonb),coalesce(v_menu->'working_hours','[]'::jsonb),coalesce(v_menu->'details','{}'::jsonb),coalesce((v_menu->>'is_active')::boolean,true)) returning id into v_id;
  else
    update public.digital_menus set slug=coalesce(nullif(v_menu->>'slug',''),slug),title=coalesce(nullif(v_menu->>'title',''),title),subtitle=coalesce(v_menu->>'subtitle',subtitle),logo_url=case when v_menu ? 'logo_url' then nullif(v_menu->>'logo_url','') else logo_url end,banner_url=case when v_menu ? 'banner_url' then nullif(v_menu->>'banner_url','') else banner_url end,theme=coalesce(v_menu->'theme',theme),menu_data=coalesce(v_menu->'menu_data',menu_data),working_hours=coalesce(v_menu->'working_hours',working_hours),details=coalesce(v_menu->'details',details),is_active=coalesce((v_menu->>'is_active')::boolean,is_active),updated_at=now() where id=v_id and business_id=p_business_id;
    if not found then raise exception 'Menu not found.'; end if;
  end if;
  return (select to_jsonb(dm) from public.digital_menus dm where dm.id=v_id);
end $$;
grant execute on function public.save_admin_digital_menu(uuid,jsonb) to authenticated;

create or replace function public.delete_admin_digital_menu(p_business_id uuid,p_menu_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_haki_admin() then raise exception 'Haki admin access required.'; end if;
  delete from public.digital_menus where id=p_menu_id and business_id=p_business_id;
end $$;
grant execute on function public.delete_admin_digital_menu(uuid,uuid) to authenticated;

create or replace function public.save_admin_stand(p_business_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_result jsonb;
begin
  if not public.is_haki_admin() then raise exception 'Haki admin access required.'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if not exists(select 1 from public.digital_menus where id=(p_payload->>'menu_id')::uuid and business_id=p_business_id) then raise exception 'The selected menu does not belong to this business.'; end if;
  if v_id is null then
    insert into public.digital_menu_stands(business_id,menu_id,stand_name,location,is_active) values(p_business_id,(p_payload->>'menu_id')::uuid,coalesce(nullif(p_payload->>'stand_name',''),'NFC Stand'),coalesce(p_payload->>'location',''),coalesce((p_payload->>'is_active')::boolean,true)) returning id into v_id;
  else
    update public.digital_menu_stands set menu_id=(p_payload->>'menu_id')::uuid,stand_name=coalesce(nullif(p_payload->>'stand_name',''),stand_name),location=coalesce(p_payload->>'location',location),is_active=coalesce((p_payload->>'is_active')::boolean,is_active),updated_at=now() where id=v_id and business_id=p_business_id;
  end if;
  return (select to_jsonb(ds) from public.digital_menu_stands ds where ds.id=v_id);
end $$;
grant execute on function public.save_admin_stand(uuid,jsonb) to authenticated;

create or replace function public.delete_admin_stand(p_business_id uuid,p_stand_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_haki_admin() then raise exception 'Haki admin access required.'; end if;
  delete from public.digital_menu_stands where id=p_stand_id and business_id=p_business_id;
end $$;
grant execute on function public.delete_admin_stand(uuid,uuid) to authenticated;

create or replace function public.get_public_digital_menus(p_business_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'business_name',b.business_name,
    'business_slug',b.slug,
    'business_id',b.id,
    'menus',coalesce((select jsonb_agg(jsonb_build_object('id',dm.id,'slug',dm.slug,'title',dm.title,'subtitle',dm.subtitle,'logo_url',dm.logo_url,'banner_url',dm.banner_url,'theme',dm.theme) order by dm.created_at,dm.title) from public.digital_menus dm where dm.business_id=b.id and dm.is_active=true),'[]'::jsonb)
  ) into v_result from public.businesses b where b.slug=p_business_slug and b.is_active=true limit 1;
  return v_result;
end $$;
grant execute on function public.get_public_digital_menus(text) to anon, authenticated;

-- Tighten the old broad authenticated business policies so restaurant managers cannot browse other businesses.
drop policy if exists "Authenticated admins can view businesses" on public.businesses;
drop policy if exists "Authenticated admins can create businesses" on public.businesses;
drop policy if exists "Authenticated admins can update businesses" on public.businesses;

create policy "Haki admins or assigned restaurant managers can view businesses"
on public.businesses for select to authenticated
using (
  public.is_haki_admin()
  or exists(select 1 from public.restaurant_users ru where ru.business_id=businesses.id and ru.auth_user_id=auth.uid() and ru.is_active=true)
);

create policy "Only Haki admins can create businesses"
on public.businesses for insert to authenticated
with check (public.is_haki_admin());

create policy "Only Haki admins can update businesses"
on public.businesses for update to authenticated
using (public.is_haki_admin())
with check (public.is_haki_admin());

-- Storage isolation for restaurant-managed digital-menu branding.
drop policy if exists "Authenticated admins can upload Haki media" on storage.objects;
drop policy if exists "Authenticated admins can update Haki media" on storage.objects;
drop policy if exists "Authenticated admins can delete Haki media" on storage.objects;

create policy "Haki admins or assigned managers can upload Haki media"
on storage.objects for insert to authenticated
with check (
  bucket_id='haki-media' and (
    public.is_haki_admin()
    or exists(
      select 1 from public.restaurant_users ru
      where ru.auth_user_id=auth.uid() and ru.is_active=true
        and split_part(name,'/',1)='digital-menus'
        and split_part(name,'/',2)=ru.business_id::text
    )
  )
);

create policy "Haki admins or assigned managers can update Haki media"
on storage.objects for update to authenticated
using (
  bucket_id='haki-media' and (
    public.is_haki_admin()
    or exists(select 1 from public.restaurant_users ru where ru.auth_user_id=auth.uid() and ru.is_active=true and split_part(name,'/',1)='digital-menus' and split_part(name,'/',2)=ru.business_id::text)
  )
)
with check (
  bucket_id='haki-media' and (
    public.is_haki_admin()
    or exists(select 1 from public.restaurant_users ru where ru.auth_user_id=auth.uid() and ru.is_active=true and split_part(name,'/',1)='digital-menus' and split_part(name,'/',2)=ru.business_id::text)
  )
);

create policy "Haki admins or assigned managers can delete Haki media"
on storage.objects for delete to authenticated
using (
  bucket_id='haki-media' and (
    public.is_haki_admin()
    or exists(select 1 from public.restaurant_users ru where ru.auth_user_id=auth.uid() and ru.is_active=true and split_part(name,'/',1)='digital-menus' and split_part(name,'/',2)=ru.business_id::text)
  )
);
