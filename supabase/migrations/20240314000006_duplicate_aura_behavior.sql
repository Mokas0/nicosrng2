-- Allow multiple copies of same aura per user (for "keep" duplicate behavior)
alter table public.user_auras add column if not exists id uuid default gen_random_uuid();
update public.user_auras set id = gen_random_uuid() where id is null;
alter table public.user_auras alter column id set default gen_random_uuid(), alter column id set not null;
alter table public.user_auras drop constraint if exists user_auras_pkey;
alter table public.user_auras add primary key (id);

-- Duplicate aura behavior: keep (add to inventory), sacrifice (extra gold), auto (game decides)
alter table public.profiles
  add column if not exists duplicate_aura_behavior text not null default 'keep'
    check (duplicate_aura_behavior in ('keep', 'sacrifice', 'auto'));
