-- Add is_superadmin flag to profiles table.
-- Run this in the Supabase SQL editor BEFORE deploying the admin panel.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- IMPORTANT: To give yourself superadmin access, run this after finding your
-- user ID from Authentication > Users in the Supabase dashboard:
--
--   update public.profiles set is_superadmin = true where id = '<your-user-uuid>';
--
-- Or if you know your email address, use this helper:
--   update public.profiles
--   set is_superadmin = true
--   where id = (
--     select id from auth.users where email = 'your@email.com'
--   );

-- RLS: superadmin status is read-only to the admin panel (it uses service role key).
-- The existing "Users can read their own profile" policy will expose this field
-- to the user in your main app — that's fine; they can see their own flag.
-- You may want to add a read-all policy for profiles so the admin panel's
-- anon/authenticated client can list profiles if needed. The admin panel uses
-- service_role, so existing RLS is bypassed server-side.
