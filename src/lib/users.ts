import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase";

/** Pages through auth.users (the default listUsers call only returns 50). */
export async function listAllAuthUsers(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return all;
}

export function displayName(p?: { first_name?: string | null; last_name?: string | null } | null, fallback = "NYC creator") {
  return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || fallback;
}
