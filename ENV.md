# Environment variables

## Quick reference

| Variable | Where | Required | Description |
|----------|--------|----------|-------------|
| `VITE_SUPABASE_URL` | Client (build) + Netlify | Yes (Netlify) | Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Client (build) + Netlify | Yes (Netlify) | Supabase anon/public key (safe in frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify Functions only | Yes (Netlify) | Supabase service role key (**secret**, server-side only) |
| `JWT_SECRET` | Server (Express) | No (dev default) | Only for local Express server; not used when using Netlify + Supabase |
| `PORT` | Server (Express) | No (default 3001) | Only for local Express server |

---

## Where to set them

### Local dev (client + Supabase)

Create **`client/.env`** (copy from `client/.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get the values from [Supabase](https://supabase.com) → your project → **Settings → API**:  
- **Project URL** → `VITE_SUPABASE_URL`  
- **anon public** key → `VITE_SUPABASE_ANON_KEY`

### Local dev (Netlify Dev – client + functions)

Same as above. When you run `npx netlify dev`, Netlify reads env from the **Netlify UI** or from a **`.env`** file in the project root (optional). For local functions to work, create a root **`.env`**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get **service_role** from Supabase → Settings → API → **service_role** (keep it secret).

### Netlify (production)

In **Netlify** → your site → **Site configuration** → **Environment variables**, add:

| Key | Value | Scopes |
|-----|--------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | All (build + functions) |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | All (or “Functions” only) |

`VITE_*` are used at **build time** for the client and at **runtime** for the serverless function.  
Never commit `.env` or put the service role key in the client.

---

## Summary

- **Client (browser):** only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from build).
- **Netlify Function:** needs all three; uses service role for DB writes (roll, shop, etc.).
- **Express server** (optional, local): `PORT`, `JWT_SECRET`; no Supabase keys unless you add Supabase there.
