# Supabase migrations

Run these in order (e.g. in Supabase Dashboard → SQL Editor, or via `supabase db push`).

| File | Purpose |
|------|--------|
| `20240314000001_initial.sql` | Profiles, auras, user_auras, chat_messages, RLS, seed auras |
| `20240314000002_chat_announcements.sql` | Adds `is_announcement` column to chat_messages (legendary+ roll announcements) |
| `20240314000003_potions.sql` | Potions catalog, user_potions inventory, RLS, seed luck potions |
| `20240314000004_username_change.sql` | Adds `username_changed_at` to profiles (username change once per week) |

After running all three, enable **Realtime** for `chat_messages` (Dashboard → Database → Replication).
