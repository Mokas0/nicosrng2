-- Roll speed buff: active for X minutes, increases roll speed by Y%
alter table public.profiles
  add column if not exists roll_speed_percent integer not null default 0,
  add column if not exists roll_speed_ends_at timestamptz,
  add column if not exists special_shop_ends_at timestamptz,
  add column if not exists special_shop_last_roll_at timestamptz;

-- Potions: support roll-speed buff (duration + percent) and special-shop-only items
alter table public.potions
  add column if not exists duration_minutes integer,
  add column if not exists roll_speed_percent integer,
  add column if not exists is_special_shop_only boolean not null default false,
  add column if not exists special_shop_price integer;

-- Roll speed potions (normal shop): use from inventory to get buff for X minutes
insert into public.potions (id, name, description, luck_percent, gold_cost, sort_order, duration_minutes, roll_speed_percent) values
  ('potion-speed-minor', 'Minor Roll Speed', '+25% roll speed for 5 minutes.', 0, 150, 20, 5, 25),
  ('potion-speed-standard', 'Standard Roll Speed', '+50% roll speed for 5 minutes.', 0, 400, 21, 5, 50),
  ('potion-speed-greater', 'Greater Roll Speed', '+100% roll speed for 3 minutes.', 0, 1200, 22, 3, 100)
on conflict (id) do nothing;

-- Special shop only: cheap high luck / high roll speed (rarely appearing shop)
insert into public.potions (id, name, description, luck_percent, gold_cost, sort_order, is_special_shop_only, special_shop_price, duration_minutes, roll_speed_percent) values
  ('special-mega-luck', 'Mystery Mega Luck', '+10,000% luck for one roll. Special deal!', 10000, 99999, 100, true, 2500, null, null),
  ('special-turbo-speed', 'Mystery Turbo Speed', '+150% roll speed for 10 minutes.', 0, 99999, 101, true, 3000, 10, 150),
  ('special-super-luck', 'Mystery Super Luck', '+50,000% luck for one roll.', 50000, 99999, 102, true, 8000, null, null)
on conflict (id) do nothing;
