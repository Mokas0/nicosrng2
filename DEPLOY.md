# Deploying Fame and Fortune

## Netlify (frontend + API functions)

1. **Connect the repo** to Netlify. Build settings are in `netlify.toml`:
   - Build command: `cd client && npm ci && npm run build`
   - Publish directory: `client/dist`
   - Functions: `netlify/functions`

2. **Environment variables** (Netlify → Site configuration → Environment variables):
   - `VITE_SUPABASE_URL` – Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` – Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key (secret; only the serverless function uses it)

   Add all three with whatever scope your plan allows (e.g. “All”). On the **free tier** you can’t limit variables to “Functions” only—that’s fine. The service role key is never used in client code, so it won’t be included in the frontend build; only the function reads it at runtime.

## Supabase (auth, database, realtime)

1. **Create a project** at [supabase.com](https://supabase.com).

2. **Run migrations** (Supabase Dashboard → SQL Editor, or CLI):
   - Run the SQL in `supabase/migrations/20240314000001_initial.sql`.

3. **Enable Realtime** for chat:
   - Dashboard → Database → Replication → enable for table `chat_messages`.

4. **Auth**: Sign up uses **email**, **username** (display name), and **password**. Login uses **email** and **password**.
   - **Resetting / wiping data**: Deleting rows from `profiles` (or truncating tables) does **not** remove the user from Supabase Auth. To let the same email register again, delete the user in **Authentication → Users** in the Supabase dashboard. Otherwise they’ll see “already registered” and should use **Sign in** instead (the API will create a new profile on first login if missing).
   - In Authentication → Providers → Email: turn **off** “Confirm email” if you want immediate sign-in without verifying the email.
   - **“Email rate limit exceeded”**: Supabase limits how many auth emails (sign-up, reset) are sent. To avoid this in dev: turn **off** “Confirm email” (no sign-up email sent). For production you can use custom SMTP (Settings → Auth → SMTP) or wait for the rate limit to reset.

5. **Seed auras** (optional): the migration inserts 3 sample auras. To seed the full set, run the server once with Supabase config, or run the seed script from the server (see server README), or paste the generated seed SQL into the SQL Editor.

## Local dev with Netlify + Supabase

1. Copy `client/.env.example` to `client/.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In the project root, run:
   - `npm install`
   - `npm run dev:client` (Vite dev server; proxy `/api` to Netlify Dev)
3. Run Netlify Dev so `/api` hits the functions:
   - `npx netlify dev`
   This serves the app and runs the serverless functions locally.

## Summary

| Feature        | Where it runs |
|----------------|----------------|
| Static site    | Netlify (from `client/dist`) |
| Roll / Shop / Passive gold API | Netlify Functions (`netlify/functions/api.ts`) |
| Auth (register / login) | Supabase Auth (client uses `@supabase/supabase-js`) |
| Profile & game data | Supabase PostgreSQL (`profiles`, `auras`, `user_auras`) |
| Chat            | Supabase Realtime + `chat_messages` table |
