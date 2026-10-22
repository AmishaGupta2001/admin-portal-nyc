import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";

export const GET = handle(async () => {
  await requirePermission("panel.access");
  const { data } = await supabaseAdmin.from("images").select("tags");
  const counts: Record<string, number> = {};
  (data ?? []).forEach((r: any) => (r.tags ?? []).forEach((t: string) => { counts[t] = (counts[t] ?? 0) + 1; }));
  return NextResponse.json({ tags: Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count) });
});

/** { action: "rename" | "delete", from/tag, to } — rename onto an existing tag = merge. */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("media.manage");
  const { action, tag, to } = await req.json();
  if (!tag) throw new HttpError(400, "tag is required");

  const { data: rows, error } = await supabaseAdmin.from("images").select("id, tags").contains("tags", [tag]);
  if (error) throw new HttpError(500, error.message);

  let next: string | null = null;
  if (action === "rename") {
    next = String(to ?? "").trim().toLowerCase();
    if (!next) throw new HttpError(400, "New name is required");
  } else if (action !== "delete") throw new HttpError(400, "Unknown action");

  for (const r of rows ?? []) {
    const tags = (r.tags as string[]).filter((t) => t !== tag);
    if (next && !tags.includes(next)) tags.push(next);
    const { error: uErr } = await supabaseAdmin.from("images").update({ tags }).eq("id", r.id);
    if (uErr) throw new HttpError(500, uErr.message);
  }

  await audit(actor, next ? "tag.rename" : "tag.delete", { type: "tag", id: tag }, { to: next, images: rows?.length ?? 0 });
  return NextResponse.json({ ok: true, images_updated: rows?.length ?? 0 });
});
