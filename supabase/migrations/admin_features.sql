-- =====================================================================
-- NYC Unhinged Admin — feature migration
-- Run in the Supabase SQL editor (safe to re-run).
-- Run AFTER add_superadmin.sql.
-- =====================================================================

-- 1. Roles ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'moderator', 'admin', 'superadmin'));

-- Backfill: existing superadmins keep their access
update public.profiles set role = 'superadmin'
where is_superadmin = true and role = 'user';

-- 2. Guard privileged columns -------------------------------------------
-- Stops a signed-in end user from promoting themselves through the public
-- anon/authenticated API (e.g. supabase.from('profiles').update({role:'admin'})).
-- The SQL editor and the service_role key (used by the admin panel) are allowed.
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
as $$
declare
  caller text := coalesce(auth.role(), '');
begin
  if caller in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'user';
      new.is_superadmin := false;
      new.is_banned := false;
      new.banned_at := null;
      new.ban_reason := null;
    else
      new.role := old.role;
      new.is_superadmin := old.is_superadmin;
      new.is_banned := old.is_banned;
      new.banned_at := old.banned_at;
      new.ban_reason := old.ban_reason;
    end if;
    return new;
  end if;

  -- Keep role and is_superadmin in sync (whichever one was edited wins)
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      new.is_superadmin := (new.role = 'superadmin');
    elsif new.is_superadmin is distinct from old.is_superadmin then
      new.role := case when new.is_superadmin then 'superadmin' else 'user' end;
    end if;
  else
    if new.is_superadmin and new.role = 'user' then new.role := 'superadmin'; end if;
    if new.role = 'superadmin' then new.is_superadmin := true; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- 3. Moderation flags on generations ------------------------------------
alter table public.generations
  add column if not exists is_hidden boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists hidden_reason text,
  add column if not exists moderated_at timestamptz;

create index if not exists generations_hidden_idx on public.generations (is_hidden) where is_hidden;
create index if not exists generations_featured_idx on public.generations (is_featured) where is_featured;

-- 4. Audit log ----------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_action_idx on public.admin_audit_log (action);

-- Locked down: only the service role (admin panel) can touch it.
alter table public.admin_audit_log enable row level security;

-- 5. Fast email -> user id lookup (used at sign-in) ---------------------
create or replace function public.admin_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.admin_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_user_id_by_email(text) to service_role;

-- =====================================================================
-- WIRE-UP FOR THE MAIN APP (do this in the main project's feed query):
--   add   `and not g.is_hidden`   to the feed / trending / post lookups
-- so posts hidden from the admin panel actually disappear from the app.
-- Featured posts are available via `is_featured` if you want a pinned row.
-- =====================================================================
