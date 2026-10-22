import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";

const PAGE = 50;

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("audit.view");
  const sp = req.nextUrl.searchParams;
  const page = Math.max(parseInt(sp.get("page") ?? "0", 10) || 0, 0);
  const prefix = sp.get("action"); // e.g. "user", "post", "studio"
  const actor = sp.get("actor");

  let q = supabaseAdmin
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (prefix) q = q.like("action", `${prefix.replace(/[^a-z_]/g, "")}.%`);
  if (actor) q = q.eq("actor_id", actor);

  const { data, count, error } = await q;
  if (error) throw new HttpError(500, error.message.includes("admin_audit_log") ? "admin_audit_log table missing — run supabase/migrations/admin_features.sql" : error.message);
  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, page_size: PAGE });
});
