import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, HttpError, requirePermission } from "@/lib/guard";
import { AI_GENERATION_EXAMPLES_BUCKET, getAiGenerationExampleImagePath } from "@/lib/week7";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function matchesImageSignature(type: string, bytes: Buffer) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  if (type === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("system.view");
  const body = await req.json().catch(() => null) as { content_type?: unknown; size?: unknown } | null;
  const contentType = typeof body?.content_type === "string" ? body.content_type.toLowerCase() : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  const extension = IMAGE_TYPES[contentType];
  if (!extension) throw new HttpError(400, "Use a JPG, PNG, WebP, or GIF image");
  if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, "Choose a non-empty image file");
  if (size > MAX_IMAGE_BYTES) throw new HttpError(413, "Images must be 2 MB or smaller");

  const path = `examples/${randomUUID()}.${extension}`;
  const { data, error } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, "Could not prepare the example image upload");
  return NextResponse.json({ image_path: path, token: data.token, content_type: contentType });
});

export const PUT = handle(async (req: NextRequest) => {
  await requirePermission("system.view");
  const body = await req.json().catch(() => null) as { image_path?: unknown; size?: unknown } | null;
  const path = getAiGenerationExampleImagePath({ image_path: body?.image_path });
  const claimedSize = typeof body?.size === "number" ? body.size : 0;
  if (!path || !Number.isInteger(claimedSize) || claimedSize <= 0 || claimedSize > MAX_IMAGE_BYTES) throw new HttpError(400, "Invalid uploaded image");

  const { data: image, error } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).download(path);
  if (error || !image) throw new HttpError(400, "The uploaded image could not be verified");
  if (image.size !== claimedSize || image.size > MAX_IMAGE_BYTES) {
    await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).remove([path]);
    throw new HttpError(400, "The uploaded image size did not match");
  }
  const extension = path.split(".").pop() ?? "";
  const type = Object.entries(IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0];
  const bytes = Buffer.from(await image.arrayBuffer());
  if (!type || !matchesImageSignature(type, bytes)) {
    await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).remove([path]);
    throw new HttpError(400, "The file contents do not match a supported image type");
  }
  return NextResponse.json({ image_path: path });
});

export const DELETE = handle(async (req: NextRequest) => {
  await requirePermission("system.view");
  const body = await req.json().catch(() => null) as { image_path?: unknown } | null;
  const path = getAiGenerationExampleImagePath({ image_path: body?.image_path });
  if (!path) throw new HttpError(400, "Invalid example image path");
  const { error } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).remove([path]);
  if (error) throw new HttpError(500, "Could not remove the example image");
  return NextResponse.json({ ok: true });
});
