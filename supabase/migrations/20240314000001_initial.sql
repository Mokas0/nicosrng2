-- Game profiles (linked to auth.users via id)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  gold integer not null default 100,
  has_auto_roll boolean not null default false,
  has_quick_roll boolean not null default false,
  last_passive_gold_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auras catalog (seeded once)
create table if not exists public.auras (
  id text primary key,
  name text not null,
  rarity text not null,
  chance integer not null,
  visual_id text not null,
  description text not null
);

-- User inventory
create table if not exists public.user_auras (
  user_id uuid not null references public.profiles(id) on delete cascade,
  aura_id text not null references public.auras(id) on delete cascade,
  obtained_at timestamptz not null default now(),
  primary key (user_id, aura_id)
);

-- Chat messages for realtime
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.auras enable row level security;
alter table public.user_auras enable row level security;
alter table public.chat_messages enable row level security;

-- Policies (drop if exists so migration is re-runnable)
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Anyone can read auras" on public.auras;
create policy "Anyone can read auras" on public.auras
  for select using (true);

drop policy if exists "Users can read own user_auras" on public.user_auras;
create policy "Users can read own user_auras" on public.user_auras
  for select using (auth.uid() = user_id);

drop policy if exists "Authenticated can insert chat" on public.chat_messages;
drop policy if exists "Anyone can read chat" on public.chat_messages;
create policy "Authenticated can insert chat" on public.chat_messages
  for insert with check (auth.uid() is not null);
create policy "Anyone can read chat" on public.chat_messages
  for select using (true);

-- Seed auras (minimal set; run server seed or SQL for full 150)
insert into public.auras (id, name, rarity, chance, visual_id, description) values
  ('aura-1', 'Ember', 'common', 2, 'common-1', 'A common aura of Ember.'),
  ('aura-2', 'Frost', 'common', 3, 'common-2', 'A common aura of Frost.'),
  ('aura-3', 'Breeze', 'common', 4, 'common-3', 'A common aura of Breeze.'),
  ('aura-4', 'Spark', 'common', 5, 'common-4', 'A common aura of Spark.'),
  ('aura-5', 'Shade', 'common', 6, 'common-5', 'A common aura of Shade.'),
  ('aura-6', 'Silver Veil', 'uncommon', 20, 'uncommon-1', 'An uncommon aura: Silver Veil.'),
  ('aura-7', 'Golden Dust', 'uncommon', 35, 'uncommon-2', 'An uncommon aura: Golden Dust.'),
  ('aura-8', 'Phoenix Ember', 'rare', 150, 'rare-1', 'A rare aura: Phoenix Ember.'),
  ('aura-9', 'Dragon Scale', 'rare', 300, 'rare-2', 'A rare aura: Dragon Scale.'),
  ('aura-10', 'Chrono Shift', 'epic', 5000, 'epic-1', 'An epic aura: Chrono Shift.')
on conflict (id) do nothing;

-- Realtime: add chat_messages to publication (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;
