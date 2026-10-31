import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { handle, HttpError, requirePermission } from "@/lib/guard";
import { AI_GENERATION_EXAMPLES_BUCKET, ensureWeek7ConfigurationValid, getAiGenerationExampleImagePath, getWeek7Resource, sanitizeWeek7Row, validateWeek7Resource } from "@/lib/week7";

type Ctx = { params: { resource: string } };

export const GET = handle(async (req: NextRequest, { params }: Ctx) => {
  await requirePermission("system.view");
  const entry = getWeek7Resource(params.resource);
  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50));
  const from = page * limit;
  const to = from + limit - 1;
  let query = supabaseAdmin.from(entry.table).select("*", { count: "exact" }).order("created_at", { ascending: false, nullsFirst: false }).range(from, to);
  if (params.resource === "generation-requests") query = supabaseAdmin.from(entry.table).select("*, images(title,image_url), generations(caption)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (params.resource === "llm-responses") query = supabaseAdmin.from(entry.table).select("*, generation_requests(prompt,status,user_id), llm_models(display_name,model_key), llm_providers(name,provider_key)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  const { data, error, count } = await query;
  if (error) throw new HttpError(500, error.message);
  let rows = sanitizeWeek7Row(params.resource, data ?? []) as Record<string, any>[];
  if (params.resource === "ai-generation-examples") {
    const paths = Array.from(new Set(rows.map((row) => getAiGenerationExampleImagePath(row.input_data)).filter((path): path is string => Boolean(path))));
    if (paths.length) {
      const { data: signedUrls, error: signedUrlError } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).createSignedUrls(paths, 60 * 30);
      if (signedUrlError) console.warn("Could not create AI example image previews:", signedUrlError.message);
      const byPath = new Map((signedUrls ?? []).filter((item) => item.path && item.signedUrl).map((item) => [item.path as string, item.signedUrl as string]));
      rows = rows.map((row) => ({ ...row, image_preview_url: byPath.get(getAiGenerationExampleImagePath(row.input_data) ?? "") ?? null }));
    } else {
      rows = rows.map((row) => ({ ...row, image_preview_url: null }));
    }
  }
  return NextResponse.json({ rows, count: count ?? 0, page, limit });
});

export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("system.view");
  const entry = getWeek7Resource(params.resource);
  const patch = validateWeek7Resource(params.resource, await req.json());
  await ensureWeek7ConfigurationValid(params.resource, patch);
  const { data, error } = await supabaseAdmin.from(entry.table).insert(patch).select().single();
  if (error) throw new HttpError(400, error.message);
  await audit(actor, `week7.${params.resource}.create`, { type: params.resource, id: data.id }, patch);
  return NextResponse.json({ row: sanitizeWeek7Row(params.resource, data) }, { status: 201 });
});
