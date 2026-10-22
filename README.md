# NYC Unhinged — Admin Panel

A separate Next.js admin application for the NYC Unhinged meme platform. Deployed independently on Vercel, secured behind Google OAuth + superadmin database check.

---

## What's inside

| Route | Min. role | Description |
|---|---|---|
| `/dashboard` | moderator | Overview — live stats, recent activity, tag cloud |
| `/dashboard/stats` | moderator | Analytics — time-series charts, top creators |
| `/dashboard/studio` | admin | **Create & publish posts**: gallery/upload → Gemini auto-tag → AI captions → publish as any user. Single + Batch modes, remix support |
| `/dashboard/moderation` | moderator | Post grid: hide/unhide, feature, edit caption (AI suggestions), delete, bulk actions |
| `/dashboard/users` | moderator (view) | Search/filter/sort, detail drawer, edit, **role assignment**, ban/unban, add user, delete, CSV export |
| `/dashboard/media` | moderator (view) / admin (edit) | Image CRUD with direct upload + AI auto-tag, force-delete |
| `/dashboard/tags` | moderator (view) / admin (edit) | Rename, merge and delete tags across all images |
| `/dashboard/votes` | moderator | Votes, LOL/NAH breakdown, most controversial |
| `/dashboard/integrity` | moderator | Vote-manipulation detector with one-click vote purge |
| `/dashboard/audit` | admin | Every admin action, who/what/when, with details + CSV export |
| `/dashboard/system` | admin | Setup checker (env, schema, bucket) + Gemini connection test |

Press **Ctrl/⌘ + K** anywhere for the command palette.

### Roles

| Role | Can do |
|---|---|
| `moderator` | Moderate posts, view users/votes, purge abusive votes |
| `admin` | + manage media & tags, use Studio (incl. post-as-user), edit/ban regular users, add users, view audit log + system |
| `superadmin` | + assign roles, ban staff, delete users |

Roles are stored in `profiles.role`. `profiles.is_superadmin` is kept in sync by a trigger, so the old bootstrap SQL still works.
Every API call re-reads the caller's role from the database, so demoting or banning someone takes effect immediately (no waiting for JWT expiry).

---

## Setup order (new features)

1. Run `supabase/migrations/add_superadmin.sql` (if you haven't), then **`supabase/migrations/admin_features.sql`**.
2. Add the new env vars from `.env.local.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_MAIN_APP_URL`).
3. Open `/dashboard/system` — every row should be green.
4. **In the MAIN app**, add `and not is_hidden` to the feed / trending / post queries, otherwise "Hide" in Moderation only flags the post. (Bans already work everywhere: they use Supabase Auth's ban.)
5. For identical captions to the main app, paste its Gemini prompts into `src/lib/prompts.ts`.

### Assumptions worth checking
- `generations` has `user_id, image_id, prompt, caption, remix_of`; `images` has `image_url, title, tags, owner_id`. If your tables have extra NOT NULL columns, add them in `api/admin/studio/publish/route.ts`.
- Uploads go to the `generation-images` bucket at `<user-id>/admin-<uuid>.<ext>` and are displayed via the bucket's public URL (the bucket must be public, as it is for share links).
- A user must have a `profiles` row (i.e. signed in once, or created via *Add user*) before Studio can post as them.

## Architecture

```
Admin Panel (Next.js, Vercel)
  │
  ├── NextAuth.js (Google OAuth)
  │     └── signIn callback → checks profiles.is_superadmin via service_role key
  │
  ├── API Routes (/api/admin/*)
  │     └── All guarded with getServerSession() → 401 if unauthenticated
  │     └── All use supabaseAdmin (service_role key) → bypasses RLS safely
  │
  └── Supabase (same project as main app)
        └── Reads auth.users, profiles, images, generations, votes
```

The admin panel **shares the same Supabase project** as your main app. It uses the `service_role` key server-side only — it never leaks to the browser. The `NEXT_PUBLIC_SUPABASE_*` vars are only used if you need client-side Supabase calls (currently not needed).

---

## Step 1 — Add the `is_superadmin` column

Open the Supabase **SQL editor** and run:

```sql
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;
```

Then grant yourself access (replace with your actual email):

```sql
update public.profiles
set is_superadmin = true
where id = (
  select id from auth.users where email = 'your@email.com'
);
```

> **But wait — how do I run this if I'm locked out?**
> You use the **Supabase SQL editor** directly. The admin panel only blocks access at the application level. You always have direct database access via the Supabase dashboard, so you can bootstrap your own superadmin row from there without going through the app. This is the answer to the assignment's question.

---

## Step 2 — Google OAuth setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable the **Google+ API** / **Google Identity**
4. Create OAuth 2.0 credentials (Web application)
5. Add these **Authorized redirect URIs**:
   - `http://localhost:3001/api/auth/callback/google` (local dev)
   - `https://your-admin-app.vercel.app/api/auth/callback/google` (production)
6. Copy the Client ID and Client Secret

---

## Step 3 — Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (keep secret!) |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in your terminal |
| `NEXTAUTH_URL` | `http://localhost:3001` for local, `https://your-admin.vercel.app` on Vercel |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

---

## Step 4 — Local development

```bash
# Install dependencies
npm install

# Start on port 3001 (to avoid clashing with main app on 3000)
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001)

---

## Step 5 — Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy
vercel
```

Then in the Vercel dashboard:
1. Go to your project → **Settings → Environment Variables**
2. Add all variables from `.env.local` (use the production values)
3. Update `NEXTAUTH_URL` to your Vercel URL (e.g. `https://nyc-unhinged-admin.vercel.app`)
4. Update your Google OAuth redirect URI to match
5. Redeploy

**Disable Deployment Protection:**
Vercel → Project → Settings → Deployment Protection → set to **None** (so you can view in Incognito).

---

## Earlier features

- **Dark / light mode** — toggle in the top-right of every page; persisted in localStorage
- **Analytics charts** — recharts area/bar charts for generation trends, vote sentiment, top creators
- **Tag cloud** — weighted by frequency on the overview page
- **Most Controversial** — algorithm that surfaces generations with high vote counts but near-zero net score
- **Vote approval rate** — LOL/(LOL+Nah) ratio shown prominently
- **Image preview in modals** — live preview when adding/editing image URLs
- **Delete guard** — images with linked generations cannot be deleted (409 conflict with count)
- **Search** — client-side filtering on all list pages
- **Skeleton loading** — pulsing placeholders while data loads
- **All API routes are server-side only** — the service_role key never touches the browser

---

## Security model

| Concern | Solution |
|---|---|
| Who can access the UI? | Only Google accounts where `profiles.is_superadmin = true` |
| How is this checked? | NextAuth `signIn` callback, server-side, using service_role key |
| What if someone bypasses the UI? | Every `/api/admin/*` route calls `getServerSession()` and returns 401 if missing |
| Is service_role key safe? | It's only in `SUPABASE_SERVICE_ROLE_KEY` (server-only env var, not `NEXT_PUBLIC_`) |
| What if my session cookie is stolen? | NextAuth sessions are signed with `NEXTAUTH_SECRET`; rotate it to invalidate all sessions |
# admin-portal-nyc
