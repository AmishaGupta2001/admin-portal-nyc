import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { cleanTags } from "@/lib/gemini";
import { deleteGenerations } from "@/lib/content";

type Ctx = { params: { id: string } };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("media.manage");
  const { image_url, title, tags } = await req.json();

  const patch: Record<string, unknown> = {};
  if (image_url !== undefined) patch.image_url = image_url;
  if (title !== undefined) patch.title = String(title).trim();
  if (tags !== undefined) patch.tags = cleanTags(tags);
  if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to update");

  const { data, error } = await supabaseAdmin.from("images").update(patch).eq("id", params.id).select().single();
  if (error) throw new HttpError(500, error.message);

  await audit(actor, "image.update", { type: "image", id: params.id }, patch);
  return NextResponse.json({ image: data });
});

/** ?force=1 also deletes every post built on the image (with its votes). */
export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("media.manage");
  const force = req.nextUrl.searchParams.get("force") === "1";

  const { data: gens } = await supabaseAdmin.from("generations").select("id").eq("image_id", params.id);
  const count = gens?.length ?? 0;
  if (count > 0 && !force) {
    throw new HttpError(409, `${count} post(s) use this image. Delete them first, or force-delete.`);
  }
  if (count > 0) await deleteGenerations((gens ?? []).map((g: any) => g.id));

  const { error } = await supabaseAdmin.from("images").delete().eq("id", params.id);
  if (error) throw new HttpError(500, error.message);

  await audit(actor, force && count ? "image.force_delete" : "image.delete", { type: "image", id: params.id }, { posts_removed: count });
  return NextResponse.json({ success: true, posts_removed: count });
});
