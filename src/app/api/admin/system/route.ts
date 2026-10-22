import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission } from "@/lib/guard";
import { ping } from "@/lib/gemini";

const COLUMN_CHECKS: [string, string][] = [
  ["profiles", "role"], ["profiles", "is_banned"], ["profiles", "ban_reason"],
  ["generations", "is_hidden"], ["generations", "is_featured"], ["generations", "hidden_reason"],
  ["admin_audit_log", "action"],
];

export const GET = handle(async () => {
  await requirePermission("system.view");

  const env = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    GOOGLE_OAUTH: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    NEXT_PUBLIC_MAIN_APP_URL: !!process.env.NEXT_PUBLIC_MAIN_APP_URL,
  };

  const schema = await Promise.all(
    COLUMN_CHECKS.map(async ([table, column]) => {
      const { error } = await supabaseAdmin.from(table).select(column).limit(1);
      return { table, column, ok: !error, error: error?.message };
    })
  );

  const rpc = await supabaseAdmin.rpc("admin_user_id_by_email", { p_email: "nobody@example.invalid" });
  const { data: bucket, error: bucketErr } = await supabaseAdmin.storage.getBucket("generation-images");

  const counts: Record<string, number | null> = {};
  await Promise.all(
    ["profiles", "images", "generations", "votes", "admin_audit_log"].map(async (t) => {
      const { count, error } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? null : count ?? 0;
    })
  );

  return NextResponse.json({
    env,
    schema,
    rpc_email_lookup: !rpc.error,
    bucket: bucketErr ? { ok: false, error: bucketErr.message } : { ok: true, public: bucket?.public },
    counts,
    gemini_model: process.env.GEMINI_MODEL || "gemini-3.8-flash (default)",
    node_env: process.env.NODE_ENV,
  });
});

export const POST = handle(async () => {
  await requirePermission("system.view");
  const t0 = Date.now();
  try {
    return NextResponse.json({ ok: true, result: await ping(), ms: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed", ms: Date.now() - t0 });
  }
});
