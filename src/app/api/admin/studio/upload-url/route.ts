import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";

const BUCKET = "generation-images";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX = 8 * 1024 * 1024;

/**
 * Issues a one-time signed upload token so the browser uploads straight to
 * Supabase Storage (avoids Vercel's ~4.5MB request-body limit).
 */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("studio.use");
  const { content_type, size, user_id } = await req.json();
  const ext = EXT[content_type];
  if (!ext) throw new HttpError(400, "Only JPG, PNG, WebP or GIF images are allowed");
  if (typeof size === "number" && size > MAX) throw new HttpError(400, "Max file size is 8MB");

  const owner = user_id || actor.id;
  const path = `${owner}/admin-${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, error?.message ?? "Could not create upload URL");

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ bucket: BUCKET, path, token: data.token, public_url: pub.publicUrl });
});
