-- SULVENT v3 · Supabase schema
-- Run this whole file in Supabase Dashboard > SQL Editor.
-- This MVP creates isolated organization workspaces and persistent events.
-- Never expose the service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','manager','finance','staff','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  event_date date not null,
  venue text,
  status text not null default 'planning' check (status in ('draft','planning','published','live','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists events_organization_date_idx on public.events(organization_id, event_date);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

drop policy if exists "Members can read their organizations" on public.organizations;
create policy "Members can read their organizations"
on public.organizations for select to authenticated
using (public.is_org_member(id));

drop policy if exists "Members can read organization membership" on public.organization_members;
create policy "Members can read organization membership"
on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage members" on public.organization_members;
create policy "Owners and admins can manage members"
on public.organization_members for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']))
with check (public.has_org_role(organization_id, array['owner','admin']));

drop policy if exists "Members can read events" on public.events;
create policy "Members can read events"
on public.events for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Managers can create events" on public.events;
create policy "Managers can create events"
on public.events for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner','admin','manager'])
  and created_by = auth.uid()
);

drop policy if exists "Managers can update events" on public.events;
create policy "Managers can update events"
on public.events for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','manager']))
with check (public.has_org_role(organization_id, array['owner','admin','manager']));

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
on public.events for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']));

create or replace function public.create_organization(org_name text, org_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org public.organizations;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(org_name)) < 2 or char_length(trim(org_name)) > 120 then
    raise exception 'Organization name must be 2-120 characters';
  end if;
  if org_slug !~ '^[a-z0-9-]{2,60}$' then
    raise exception 'Slug must use 2-60 lowercase letters, numbers, or hyphens';
  end if;
  if exists (select 1 from public.organization_members where user_id = current_user_id) then
    raise exception 'This account already belongs to an organization';
  end if;

  insert into public.organizations(name, slug)
  values (trim(org_name), org_slug)
  returning * into new_org;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org.id, current_user_id, 'owner');

  return new_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

grant select on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.events to authenticated;

-- People management: attendees and internal team members.
create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 160),
  organization_name text,
  status text not null default 'registered' check (status in ('registered','checked_in','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  role text not null check (char_length(role) between 2 and 120),
  created_at timestamptz not null default now()
);

create index if not exists attendees_org_created_idx on public.attendees(organization_id, created_at desc);
create index if not exists team_members_org_created_idx on public.team_members(organization_id, created_at);
alter table public.attendees enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Members can read attendees" on public.attendees;
create policy "Members can read attendees" on public.attendees for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists "Operators can manage attendees" on public.attendees;
create policy "Operators can manage attendees" on public.attendees for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','manager','finance','staff'])) with check (public.has_org_role(organization_id, array['owner','admin','manager','finance','staff']));

drop policy if exists "Members can read team members" on public.team_members;
create policy "Members can read team members" on public.team_members for select to authenticated
using (public.is_org_member(organization_id));
drop policy if exists "Operators can manage team members" on public.team_members;
create policy "Operators can manage team members" on public.team_members for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin','manager','finance','staff'])) with check (public.has_org_role(organization_id, array['owner','admin','manager','finance','staff']));

grant select, insert, update, delete on public.attendees to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;

-- Operations modules · all records belong to an organization and may be linked to an event.
-- Run this block after the foundation above. RLS uses the same organization membership boundary.
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  space_name text,
  contract_status text not null default 'lead' check (contract_status in ('lead','pending','confirmed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  tier text,
  commitment_amount numeric(14,2) not null default 0 check (commitment_amount >= 0),
  status text not null default 'lead' check (status in ('lead','negotiation','active','completed','lost')),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  entry_type text not null check (entry_type in ('income','expense')),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft','pending','paid','void')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  target_amount numeric(14,2) not null default 0 check (target_amount >= 0),
  collected_amount numeric(14,2) not null default 0 check (collected_amount >= 0),
  status text not null default 'draft' check (status in ('draft','active','paused','closed')),
  created_at timestamptz not null default now(),
  check (collected_amount <= target_amount or target_amount = 0)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  channel text,
  status text not null default 'draft' check (status in ('draft','scheduled','live','completed','paused')),
  reach integer not null default 0 check (reach >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.logistics_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  vendor text,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'planned' check (status in ('planned','ordered','in_progress','ready','delivered','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists tenants_org_event_idx on public.tenants(organization_id, event_id);
create index if not exists sponsors_org_event_idx on public.sponsors(organization_id, event_id);
create index if not exists finance_entries_org_event_idx on public.finance_entries(organization_id, event_id);
create index if not exists donation_campaigns_org_event_idx on public.donation_campaigns(organization_id, event_id);
create index if not exists marketing_campaigns_org_event_idx on public.marketing_campaigns(organization_id, event_id);
create index if not exists logistics_items_org_event_idx on public.logistics_items(organization_id, event_id);

alter table public.tenants enable row level security;
alter table public.sponsors enable row level security;
alter table public.finance_entries enable row level security;
alter table public.donation_campaigns enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.logistics_items enable row level security;

create or replace function public.org_can_operate(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_role(target_org, array['owner','admin','manager','finance','staff'])
$$;
revoke all on function public.org_can_operate(uuid) from public;
grant execute on function public.org_can_operate(uuid) to authenticated;

-- Organization members can read module data. Operational roles can write it.
do $$
declare table_name text;
begin
  foreach table_name in array array['tenants','sponsors','finance_entries','donation_campaigns','marketing_campaigns','logistics_items']
  loop
    execute format('drop policy if exists "Members can read %1$s" on public.%1$s', table_name);
    execute format('create policy "Members can read %1$s" on public.%1$s for select to authenticated using (public.is_org_member(organization_id))', table_name);
    execute format('drop policy if exists "Operators can manage %1$s" on public.%1$s', table_name);
    execute format('create policy "Operators can manage %1$s" on public.%1$s for all to authenticated using (public.org_can_operate(organization_id)) with check (public.org_can_operate(organization_id))', table_name);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', table_name);
  end loop;
end;
$$;
