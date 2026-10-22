import { createClient } from "@supabase/supabase-js";

// Browser-safe client (anon key only). Used ONLY to upload files with a
// server-issued signed upload token — it has no other privileges.
let client: ReturnType<typeof createClient> | null = null;
export function supabaseBrowser() {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
