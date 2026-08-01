create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.share_records (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_ciphertext text not null,
  token_hint text not null check (char_length(token_hint) between 4 and 12),
  kind text not null default 'personal' check (kind in ('personal', 'general')),
  label text not null default '',
  client_name text not null default '',
  client_phone text,
  client_email text,
  event_type text,
  event_date date,
  event_venue text,
  internal_note text not null default '',
  message text not null default '',
  status text not null default 'active'
    check (status in ('draft', 'active', 'revoked', 'archived')),
  expires_at timestamptz,
  current_version integer not null default 1 check (current_version > 0),
  access_count bigint not null default 0 check (access_count >= 0),
  last_opened_at timestamptz,
  archived_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  share_id uuid not null references public.share_records(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  resolved_config jsonb not null check (jsonb_typeof(resolved_config) = 'object'),
  pricing_snapshot jsonb not null default '{}'::jsonb,
  pricing_summary jsonb not null default '{}'::jsonb,
  message_snapshot jsonb not null default '{"includeText":true,"text":""}'::jsonb,
  change_note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (share_id, version_number)
);

create index if not exists share_records_owner_event_date_idx
  on public.share_records (owner_id, event_date asc nulls last);
create index if not exists share_records_owner_created_at_idx
  on public.share_records (owner_id, created_at desc);
create index if not exists share_records_owner_status_idx
  on public.share_records (owner_id, status);
create unique index if not exists share_records_owner_general_unique_idx
  on public.share_records (owner_id) where kind = 'general';
create index if not exists share_records_client_name_trgm_idx
  on public.share_records using gin (client_name extensions.gin_trgm_ops);
create index if not exists share_records_event_venue_trgm_idx
  on public.share_records using gin (event_venue extensions.gin_trgm_ops);
create index if not exists share_versions_share_idx
  on public.share_versions (share_id, version_number desc);

create or replace function public.set_share_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_share_records_updated_at on public.share_records;
create trigger set_share_records_updated_at
before update on public.share_records
for each row execute function public.set_share_updated_at();

alter table public.share_records enable row level security;
alter table public.share_versions enable row level security;

create or replace function public.is_share_owner()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'share_owner', 'false') = 'true';
$$;

drop policy if exists "Owners can read their shares" on public.share_records;
create policy "Owners can read their shares"
on public.share_records for select
to authenticated
using (public.is_share_owner() and owner_id = auth.uid());

drop policy if exists "Owners can create their shares" on public.share_records;
create policy "Owners can create their shares"
on public.share_records for insert
to authenticated
with check (public.is_share_owner() and owner_id = auth.uid());

drop policy if exists "Owners can update their shares" on public.share_records;
create policy "Owners can update their shares"
on public.share_records for update
to authenticated
using (public.is_share_owner() and owner_id = auth.uid())
with check (public.is_share_owner() and owner_id = auth.uid());

drop policy if exists "Owners can delete their shares" on public.share_records;

drop policy if exists "Owners can read their share versions" on public.share_versions;
create policy "Owners can read their share versions"
on public.share_versions for select
to authenticated
using (
  public.is_share_owner() and exists (
    select 1 from public.share_records record
    where record.id = share_versions.share_id
      and record.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can create their share versions" on public.share_versions;
create policy "Owners can create their share versions"
on public.share_versions for insert
to authenticated
with check (
  public.is_share_owner() and exists (
    select 1 from public.share_records record
    where record.id = share_versions.share_id
      and record.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can delete their share versions" on public.share_versions;

create or replace function public.create_share_with_version(
  p_token_hash text,
  p_token_ciphertext text,
  p_token_hint text,
  p_kind text,
  p_label text,
  p_client jsonb,
  p_event jsonb,
  p_internal_note text,
  p_message text,
  p_status text,
  p_expires_at timestamptz,
  p_resolved_config jsonb,
  p_pricing_snapshot jsonb,
  p_pricing_summary jsonb,
  p_message_snapshot jsonb,
  p_change_note text
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  new_share_id uuid;
begin
  if auth.uid() is null or not public.is_share_owner() then
    raise exception 'Authentication required';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid token hash';
  end if;
  if jsonb_typeof(p_resolved_config) <> 'object' then
    raise exception 'Resolved configuration must be an object';
  end if;
  if coalesce(p_status, 'active') not in ('draft', 'active') then
    raise exception 'Invalid initial status';
  end if;
  if coalesce(p_kind, 'personal') not in ('personal', 'general') then
    raise exception 'Invalid share kind';
  end if;

  insert into public.share_records (
    owner_id,
    token_hash,
    token_ciphertext,
    token_hint,
    kind,
    label,
    client_name,
    client_phone,
    client_email,
    event_type,
    event_date,
    event_venue,
    internal_note,
    message,
    status,
    expires_at
  ) values (
    auth.uid(),
    p_token_hash,
    p_token_ciphertext,
    p_token_hint,
    coalesce(p_kind, 'personal'),
    coalesce(p_label, ''),
    coalesce(p_client ->> 'name', ''),
    nullif(p_client ->> 'phone', ''),
    nullif(p_client ->> 'email', ''),
    nullif(p_event ->> 'type', ''),
    nullif(p_event ->> 'date', '')::date,
    nullif(p_event ->> 'venue', ''),
    coalesce(p_internal_note, ''),
    coalesce(p_message, ''),
    coalesce(p_status, 'active'),
    p_expires_at
  ) returning id into new_share_id;

  insert into public.share_versions (
    share_id,
    version_number,
    resolved_config,
    pricing_snapshot,
    pricing_summary,
    message_snapshot,
    change_note,
    created_by
  ) values (
    new_share_id,
    1,
    p_resolved_config,
    coalesce(p_pricing_snapshot, '{}'::jsonb),
    coalesce(p_pricing_summary, '{}'::jsonb),
    coalesce(p_message_snapshot, jsonb_build_object('includeText', true, 'text', coalesce(p_message, ''))),
    p_change_note,
    auth.uid()
  );

  return new_share_id;
end;
$$;

create or replace function public.create_share_version(
  p_share_id uuid,
  p_resolved_config jsonb,
  p_pricing_snapshot jsonb,
  p_pricing_summary jsonb,
  p_message text,
  p_message_snapshot jsonb,
  p_change_note text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_version integer;
  version_message text;
  previous_message_snapshot jsonb;
begin
  if auth.uid() is null or not public.is_share_owner() then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_resolved_config) <> 'object' then
    raise exception 'Resolved configuration must be an object';
  end if;

  select version.message_snapshot
  into previous_message_snapshot
  from public.share_versions version
  join public.share_records record on record.id = version.share_id
  where version.share_id = p_share_id
    and version.version_number = record.current_version
    and record.owner_id = auth.uid();

  update public.share_records
  set current_version = current_version + 1,
      message = coalesce(p_message, message)
  where id = p_share_id
    and owner_id = auth.uid()
  returning current_version, message into next_version, version_message;

  if next_version is null then
    raise exception 'Share not found';
  end if;

  insert into public.share_versions (
    share_id,
    version_number,
    resolved_config,
    pricing_snapshot,
    pricing_summary,
    message_snapshot,
    change_note,
    created_by
  ) values (
    p_share_id,
    next_version,
    p_resolved_config,
    coalesce(p_pricing_snapshot, '{}'::jsonb),
    coalesce(p_pricing_summary, '{}'::jsonb),
    coalesce(
      p_message_snapshot,
      previous_message_snapshot,
      jsonb_build_object('includeText', true, 'text', coalesce(version_message, ''))
    ),
    p_change_note,
    auth.uid()
  );

  return next_version;
end;
$$;

create or replace function public.record_share_open(p_share_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_records
  set access_count = access_count + 1,
      last_opened_at = now()
  where id = p_share_id;
$$;

revoke all on function public.set_share_updated_at() from public;
revoke all on function public.is_share_owner() from public, anon;
revoke all on function public.create_share_with_version(
  text, text, text, text, text, jsonb, jsonb, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, text
) from public, anon;
revoke all on function public.create_share_version(
  uuid, jsonb, jsonb, jsonb, text, jsonb, text
) from public, anon;
revoke all on function public.record_share_open(uuid) from public, anon, authenticated;

grant execute on function public.create_share_with_version(
  text, text, text, text, text, jsonb, jsonb, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, text
) to authenticated;
grant execute on function public.is_share_owner() to authenticated;
grant execute on function public.create_share_version(
  uuid, jsonb, jsonb, jsonb, text, jsonb, text
) to authenticated;
grant execute on function public.record_share_open(uuid) to service_role;

grant select, insert, update on public.share_records to authenticated;
grant select, insert on public.share_versions to authenticated;
grant all on public.share_records to service_role;
grant all on public.share_versions to service_role;
