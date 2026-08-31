-- Run this in the Supabase SQL editor if the inbox tables already exist.
-- Adds per-message WhatsApp delivery status and per-workspace access tokens.

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

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
end $$;
