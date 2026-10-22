import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { cleanTags } from "@/lib/gemini";

export const GET = handle(async () => {
  await requirePermission("panel.access");

  const { data: images, error } = await supabaseAdmin.from("images").select("*").order("created_at", { ascending: false });
  if (error) throw new HttpError(500, error.message);

  const { data: genData } = await supabaseAdmin.from("generations").select("image_id");
  const countMap: Record<string, number> = {};
  (genData ?? []).forEach(({ image_id }: any) => { countMap[image_id] = (countMap[image_id] ?? 0) + 1; });

  return NextResponse.json({ images: (images ?? []).map((img) => ({ ...img, generation_count: countMap[img.id] ?? 0 })) });
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("media.manage");
  const { image_url, title, tags, owner_id } = await req.json();
  if (!image_url || !title) throw new HttpError(400, "image_url and title are required");

  const { data, error } = await supabaseAdmin
    .from("images")
    .insert({ image_url, title: String(title).trim(), tags: cleanTags(tags), owner_id: owner_id ?? null })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);

  await audit(actor, "image.create", { type: "image", id: data.id }, { title });
  return NextResponse.json({ image: data });
});
