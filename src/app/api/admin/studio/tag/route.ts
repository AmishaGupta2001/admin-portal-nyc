import { NextRequest, NextResponse } from "next/server";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { tagImage, GeminiError } from "@/lib/gemini";

export const maxDuration = 60;

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("studio.use");
  const { image_url } = await req.json();
  if (!image_url) throw new HttpError(400, "image_url is required");
  try {
    return NextResponse.json(await tagImage(image_url));
  } catch (e) {
    if (e instanceof GeminiError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
