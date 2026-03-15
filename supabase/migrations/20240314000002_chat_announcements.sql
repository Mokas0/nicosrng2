-- Add announcement flag for legendary+ roll broadcasts
alter table public.chat_messages
  add column if not exists is_announcement boolean not null default false;
