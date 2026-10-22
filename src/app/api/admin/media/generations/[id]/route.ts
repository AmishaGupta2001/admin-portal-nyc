import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { deleteGenerations } from "@/lib/content";

type Ctx = { params: { id: string } };

/** Single generation with its image + author (used by Studio "remix"). */
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requirePermission("content.moderate");
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, caption, prompt, user_id, image_id, images(id, image_url, title, tags), profiles(first_name, last_name)")
    .eq("id", params.id)
    .single();
  if (error || !data) throw new HttpError(404, "Post not found");
  const g: any = data;
  return NextResponse.json({
    id: g.id, caption: g.caption, prompt: g.prompt, user_id: g.user_id,
    creator_name: [g.profiles?.first_name, g.profiles?.last_name].filter(Boolean).join(" ") || "NYC creator",
    image: g.images,
  });
});

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("content.moderate");
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (typeof body.caption === "string") {
    const c = body.caption.trim();
    if (!c || c.length > 400) throw new HttpError(400, "Caption must be 1-400 characters");
    patch.caption = c;
  }
  if (typeof body.is_hidden === "boolean") {
    patch.is_hidden = body.is_hidden;
    patch.hidden_reason = body.is_hidden ? String(body.reason ?? "").slice(0, 300) || null : null;
  }
  if (typeof body.is_featured === "boolean") patch.is_featured = body.is_featured;
  if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to update");
  patch.moderated_at = new Date().toISOString();

  const { error } = await supabaseAdmin.from("generations").update(patch).eq("id", params.id);
  if (error) throw new HttpError(500, error.message.includes("column") ? `${error.message} — run admin_features.sql` : error.message);

  const action = "caption" in patch ? "post.edit_caption" : "is_hidden" in patch ? (patch.is_hidden ? "post.hide" : "post.unhide") : patch.is_featured ? "post.feature" : "post.unfeature";
  await audit(actor, action, { type: "generation", id: params.id }, patch);
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("content.moderate");
  await deleteGenerations([params.id]);
  await audit(actor, "post.delete", { type: "generation", id: params.id });
  return NextResponse.json({ success: true });
});
