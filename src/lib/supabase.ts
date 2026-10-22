import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public client — respects RLS (used for reads that match existing policies)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — bypasses RLS (ONLY used server-side in API routes / server components)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean | null;
  created_at?: string;
  email?: string;
};

export type Image = {
  id: string;
  image_url: string;
  title: string;
  tags: string[];
  owner_id: string | null;
  created_at: string;
};

export type Generation = {
  id: string;
  user_id: string;
  image_id: string;
  prompt: string;
  caption: string;
  created_at: string;
  remix_of: string | null;
  image?: Image;
  profile?: Profile;
};

export type Vote = {
  id: string;
  user_id: string;
  generation_id: string;
  vote: 1 | -1;
  created_at: string;
};
