-- Username change once per week: track last change time
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

-- Usernames are already unique (unique constraint on profiles.username from initial migration).
-- username_changed_at: when set, user can change again 7 days later.
