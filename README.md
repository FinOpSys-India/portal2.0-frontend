# Portal 2.0 — frontend

The customer, accounting-manager, specialist and admin portals, as one Next.js
app. It holds no data of its own: every screen reads the Portal backend through
the same-origin proxy in `src/proxy.ts`, which attaches the session.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run check` is the gate — lint, typecheck, production build and tests, in
that order. Nothing should be pushed that does not pass it.

## Environment

Four variables, all set in Vercel (Project → Settings → Environment Variables).
There is no tracked `.env.example`: `.gitignore` excludes `.env*`, so this table
is the only record of what the app needs.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Origin of the Portal backend. `src/lib/backend.ts` builds every API URL from it. |
| `BACKEND_API_PREFIX` | Path the backend mounts its routes under. Defaults to `/api`; the backend's own default disagrees with its README, so it is set explicitly rather than guessed. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project the browser opens its chat socket against. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's publishable key. Public by design — RLS is what restricts it (`db/schema/21_add_chat_realtime.sql` on the backend: SELECT only, scoped by the token's `app_user_id`). |

### `NEXT_PUBLIC_*` is baked in at build time

Next inlines these into the browser bundle when it compiles. **Changing one in
Vercel does nothing until the app is rebuilt** — there is no restart that picks
it up, and a redeploy that reuses the build cache can carry the old value
forward. After changing one, deploy with a fresh build and confirm the result
rather than assuming.

### Switching Supabase projects

The two `NEXT_PUBLIC_SUPABASE_*` values are only the browser's half. The backend
holds the other half and both must name the **same** project:

- `DATABASE_URL` — the project's Postgres. Use the **pooler** connection string
  (`…pooler.supabase.com`), not the direct `db.<ref>.supabase.co` one, which is
  IPv6-only and unreachable from most hosts. The password is per project.
- `SUPABASE_JWT_SECRET` — the project's JWT secret, which signs the realtime
  token. A wrong one fails at the socket and reads as a network fault.
- The schema has to exist in the new project. A fresh one is empty.

Split across two projects, the app looks healthy and is not: sign-in works
against one database while chat subscribes to another and silently shows
nothing.

One caveat worth knowing: `src/lib/chat-realtime.ts` reads
`ticket.url ?? NEXT_PUBLIC_SUPABASE_URL`, so a backend that returns a URL with
the realtime token **overrides** the variable set here.

## Deploying

Pushing to `main` is the deploy. The Vercel git integration builds it and
promotes it to production.

Deploying the same commit from the CLI as well produces a second production
deployment seconds after the first, and the two disagree about which is current
— the dashboard marks the git one, the domain follows whichever aliased last.
Push, and let the integration do it.
