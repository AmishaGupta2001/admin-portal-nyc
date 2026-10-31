import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { handle, HttpError, requirePermission } from "@/lib/guard";
import { AI_GENERATION_EXAMPLES_BUCKET, ensureWeek7ConfigurationValid, getAiGenerationExampleImagePath, getWeek7Resource, isResourceWritable, sanitizeWeek7Row, validateWeek7Resource } from "@/lib/week7";

type Ctx = { params: { resource: string; id: string } };

export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requirePermission("system.view");
  const entry = getWeek7Resource(params.resource);
  let query = supabaseAdmin.from(entry.table).select("*").eq("id", params.id);
  if (params.resource === "generation-requests") query = supabaseAdmin.from(entry.table).select("*, images(title,image_url), generations(caption,created_at), llm_providers(name,provider_key), llm_models(display_name,model_key)").eq("id", params.id);
  if (params.resource === "llm-responses") query = supabaseAdmin.from(entry.table).select("*, generation_requests(prompt,status,user_id,direction), llm_models(display_name,model_key), llm_providers(name,provider_key)").eq("id", params.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Record not found");
  return NextResponse.json({ row: sanitizeWeek7Row(params.resource, data) });
});

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("system.view");
  if (!isResourceWritable(params.resource)) throw new HttpError(405, "This resource is read-only");
  const entry = getWeek7Resource(params.resource);
  const patch = validateWeek7Resource(params.resource, await req.json(), true);
  await ensureWeek7ConfigurationValid(params.resource, patch, params.id);
  let previousImagePath: string | null = null;
  if (params.resource === "ai-generation-examples" && patch.input_data !== undefined) {
    const { data: previous, error: previousError } = await supabaseAdmin.from(entry.table).select("input_data").eq("id", params.id).maybeSingle();
    if (previousError) throw new HttpError(500, previousError.message);
    if (!previous) throw new HttpError(404, "Record not found");
    previousImagePath = getAiGenerationExampleImagePath(previous.input_data);
  }
  const { data, error } = await supabaseAdmin.from(entry.table).update(patch).eq("id", params.id).select().maybeSingle();
  if (error) throw new HttpError(400, error.message);
  if (!data) throw new HttpError(404, "Record not found");
  const nextImagePath = params.resource === "ai-generation-examples" ? getAiGenerationExampleImagePath(data.input_data) : null;
  let imageCleanupWarning = false;
  if (previousImagePath && previousImagePath !== nextImagePath) {
    const { error: cleanupError } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).remove([previousImagePath]);
    if (cleanupError) {
      imageCleanupWarning = true;
      console.error("Could not remove replaced AI example image:", cleanupError.message);
    }
  }
  await audit(actor, `week7.${params.resource}.update`, { type: params.resource, id: params.id }, patch);
  return NextResponse.json({ row: sanitizeWeek7Row(params.resource, data), imageCleanupWarning });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("system.view");
  if (!isResourceWritable(params.resource)) throw new HttpError(405, "This resource is read-only");
  const entry = getWeek7Resource(params.resource);
  if (params.resource === "prompt-chain-steps") {
    const { data: step, error: stepError } = await supabaseAdmin.from(entry.table).select("chain_id,enabled").eq("id", params.id).maybeSingle();
    if (stepError) throw new HttpError(500, stepError.message);
    if (step?.enabled) {
      const [{ data: chain }, { count, error }] = await Promise.all([
        supabaseAdmin.from("prompt_chains").select("enabled").eq("id", step.chain_id).maybeSingle(),
        supabaseAdmin.from(entry.table).select("id", { count: "exact", head: true }).eq("chain_id", step.chain_id).eq("enabled", true),
      ]);
      if (error) throw new HttpError(500, error.message);
      if (chain?.enabled && (count ?? 0) <= 1) throw new HttpError(409, "Disable the chain or add another enabled step before deleting its last enabled step");
    }
  }
  let imagePath: string | null = null;
  if (params.resource === "ai-generation-examples") {
    const { data: example, error: exampleError } = await supabaseAdmin.from(entry.table).select("input_data").eq("id", params.id).maybeSingle();
    if (exampleError) throw new HttpError(500, exampleError.message);
    if (!example) throw new HttpError(404, "Record not found");
    imagePath = getAiGenerationExampleImagePath(example.input_data);
  }
  const { error, count } = await supabaseAdmin.from(entry.table).delete({ count: "exact" }).eq("id", params.id);
  if (error) throw new HttpError(409, error.message);
  if (count === 0) throw new HttpError(404, "Record not found");
  let imageCleanupWarning = false;
  if (imagePath) {
    const { error: cleanupError } = await supabaseAdmin.storage.from(AI_GENERATION_EXAMPLES_BUCKET).remove([imagePath]);
    if (cleanupError) {
      imageCleanupWarning = true;
      console.error("Could not remove deleted AI example image:", cleanupError.message);
    }
  }
  await audit(actor, `week7.${params.resource}.delete`, { type: params.resource, id: params.id });
  return NextResponse.json({ ok: true, imageCleanupWarning });
});
