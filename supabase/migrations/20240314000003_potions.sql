-- Luck potions (Sol's RNG style): boost luck for one roll. Rarer auras benefit more from luck.
create table if not exists public.potions (
  id text primary key,
  name text not null,
  description text not null,
  luck_percent integer not null,
  gold_cost integer not null,
  sort_order integer not null default 0
);

-- User potion inventory (quantity per potion)
create table if not exists public.user_potions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  potion_id text not null references public.potions(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  primary key (user_id, potion_id)
);

alter table public.potions enable row level security;
alter table public.user_potions enable row level security;

drop policy if exists "Anyone can read potions" on public.potions;
create policy "Anyone can read potions" on public.potions for select using (true);

drop policy if exists "Users can read own user_potions" on public.user_potions;
drop policy if exists "Users can insert own user_potions" on public.user_potions;
drop policy if exists "Users can update own user_potions" on public.user_potions;
create policy "Users can read own user_potions" on public.user_potions for select using (auth.uid() = user_id);
create policy "Users can insert own user_potions" on public.user_potions for insert with check (auth.uid() = user_id);
create policy "Users can update own user_potions" on public.user_potions for update using (auth.uid() = user_id);

-- Seed potions: basic +5% to cosmic +500000% (one roll each)
insert into public.potions (id, name, description, luck_percent, gold_cost, sort_order) values
  ('potion-basic', 'Basic Luck Potion', '+5% luck for one roll. Slight boost to rarer auras.', 5, 50, 1),
  ('potion-minor', 'Minor Luck Potion', '+25% luck for one roll.', 25, 200, 2),
  ('potion-standard', 'Standard Luck Potion', '+100% luck for one roll.', 100, 800, 3),
  ('potion-greater', 'Greater Luck Potion', '+500% luck for one roll.', 500, 3500, 4),
  ('potion-superior', 'Superior Luck Potion', '+2,500% luck for one roll.', 2500, 15000, 5),
  ('potion-supreme', 'Supreme Luck Potion', '+15,000% luck for one roll.', 15000, 75000, 6),
  ('potion-ultimate', 'Ultimate Luck Potion', '+100,000% luck for one roll.', 100000, 400000, 7),
  ('potion-cosmic', 'Cosmic Luck Potion', '+500,000% luck for one roll. Maximum boost.', 500000, 2000000, 8)
on conflict (id) do nothing;
