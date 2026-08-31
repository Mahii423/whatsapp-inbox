-- Run this in the Supabase SQL editor once.
-- It creates the tables the inbox + webhook need, and RLS so a logged-in
-- owner can read their conversations while the webhook (service role) can write.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'My Workspace',
  created_at timestamptz not null default now()
);

create unique index if not exists workspaces_owner_id_key
  on public.workspaces (owner_id);

create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  phone_number_id text not null unique,
  business_account_id text,
  display_phone text,
  access_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text,
  phone text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts (id) on delete cascade,
  status text not null default 'open',
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  topic text not null default 'whatsapp',
  extension text not null default 'whatsapp',
  sender_type text not null,
  sender_id uuid,
  message_type text not null default 'text',
  content text,
  payload jsonb,
  event text,
  private boolean not null default false,
  whatsapp_message_id text unique,
  status text,
  status_error text,
  inserted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_status_check check (
    status is null
    or status in ('sent', 'delivered', 'read', 'failed')
  )
);

create index if not exists conversations_workspace_last_message_idx
  on public.conversations (workspace_id, last_message_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create or replace function public.is_workspace_owner(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = workspace
      and w.owner_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspaces (owner_id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'My Workspace')
  )
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.workspaces enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists workspaces_owner_all on public.workspaces;
create policy workspaces_owner_all on public.workspaces
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists whatsapp_accounts_owner_all on public.whatsapp_accounts;
create policy whatsapp_accounts_owner_all on public.whatsapp_accounts
  for all using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists contacts_owner_all on public.contacts;
create policy contacts_owner_all on public.contacts
  for all using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists conversations_owner_all on public.conversations;
create policy conversations_owner_all on public.conversations
  for all using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists messages_owner_all on public.messages;
create policy messages_owner_all on public.messages
  for all using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and public.is_workspace_owner(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and public.is_workspace_owner(c.workspace_id)
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

alter table public.whatsapp_accounts
  add column if not exists access_token text;

alter table public.messages
  add column if not exists status text;

alter table public.messages
  add column if not exists status_error text;

alter table public.messages
  drop constraint if exists messages_status_check;

alter table public.messages
  add constraint messages_status_check
  check (
    status is null
    or status in ('sent', 'delivered', 'read', 'failed')
  );

alter table public.messages replica identity full;
alter table public.conversations replica identity full;
