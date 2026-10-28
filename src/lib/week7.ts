import { HttpError } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

const RESOURCES: Record<string, { table: string; writable: boolean; required: string[]; fields: string[] }> = {
  "prompt-chains": { table: "prompt_chains", writable: true, required: ["name"], fields: ["name", "description", "enabled"] },
  "prompt-chain-steps": { table: "prompt_chain_steps", writable: true, required: ["chain_id", "step_order", "name", "prompt_template"], fields: ["chain_id", "step_order", "name", "prompt_template", "enabled"] },
  "prompt-chain-mix": { table: "prompt_chain_mix", writable: true, required: ["chain_id", "weight"], fields: ["chain_id", "weight", "enabled"] },
  terms: { table: "terms", writable: true, required: ["term"], fields: ["term", "definition", "category", "enabled"] },
  "generation-requests": { table: "generation_requests", writable: false, required: [], fields: [] },
  "ai-generation-examples": { table: "ai_generation_examples", writable: true, required: ["name", "input_prompt", "expected_output"], fields: ["name", "description", "input_prompt", "input_data", "expected_output", "prompt_chain_id", "enabled"] },
  "llm-providers": { table: "llm_providers", writable: true, required: ["provider_key", "name"], fields: ["provider_key", "name", "endpoint_url", "config", "enabled"] },
  "llm-models": { table: "llm_models", writable: true, required: ["provider_id", "model_key", "display_name"], fields: ["provider_id", "model_key", "display_name", "capabilities", "enabled"] },
  "llm-responses": { table: "llm_responses", writable: false, required: [], fields: [] },
  "allowed-signup-domains": { table: "allowed_signup_domains", writable: true, required: ["domain"], fields: ["domain", "enabled"] },
  "whitelisted-emails": { table: "whitelisted_emails", writable: true, required: ["email"], fields: ["email", "enabled"] },
};

export function getWeek7Resource(resource: string) {
  const entry = RESOURCES[resource];
  if (!entry) throw new HttpError(404, "Unknown admin resource");
  return entry;
}

export function isResourceWritable(resource: string) {
  return !!RESOURCES[resource]?.writable;
}

export function sanitizeWeek7Row(resource: string, value: any): any {
  if (Array.isArray(value)) return value.map((item) => sanitizeWeek7Row(resource, item));
  if (!value || typeof value !== "object") return value;
  const output = { ...value };
  if (resource === "llm-providers" && output.config && typeof output.config === "object") {
    const redact = (input: any): any => Array.isArray(input) ? input.map(redact) : input && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).map(([key, child]) => [key, /api.?key|secret|token|credential|password/i.test(key) ? "[redacted]" : redact(child)]))
      : input;
    output.config = redact(output.config);
  }
  return output;
}

export async function ensureWeek7ConfigurationValid(resource: string, patch: Record<string, unknown>, id?: string) {
  if (resource === "prompt-chains" && patch.enabled === true) {
    if (!id) throw new HttpError(400, "Create the chain disabled, add at least one enabled step, then enable it");
    const { count, error } = await supabaseAdmin.from("prompt_chain_steps").select("id", { count: "exact", head: true }).eq("chain_id", id).eq("enabled", true);
    if (error) throw new HttpError(500, error.message);
    if (!count) throw new HttpError(400, "A chain needs at least one enabled step before it can be enabled");
  }
  if (resource === "prompt-chain-steps" && patch.enabled === false && id) {
    const { data: step, error: stepError } = await supabaseAdmin.from("prompt_chain_steps").select("chain_id").eq("id", id).maybeSingle();
    if (stepError) throw new HttpError(500, stepError.message);
    if (step) {
      const [{ data: chain }, { count, error }] = await Promise.all([
        supabaseAdmin.from("prompt_chains").select("enabled").eq("id", step.chain_id).maybeSingle(),
        supabaseAdmin.from("prompt_chain_steps").select("id", { count: "exact", head: true }).eq("chain_id", step.chain_id).eq("enabled", true),
      ]);
      if (error) throw new HttpError(500, error.message);
      if (chain?.enabled && (count ?? 0) <= 1) throw new HttpError(400, "An enabled chain must keep at least one enabled step");
    }
  }
  if (resource === "prompt-chain-mix" && patch.enabled !== false) {
    let chainId = String(patch.chain_id ?? "");
    if (!chainId && id) {
      const { data, error } = await supabaseAdmin.from("prompt_chain_mix").select("chain_id").eq("id", id).maybeSingle();
      if (error) throw new HttpError(500, error.message);
      chainId = data?.chain_id ?? "";
    }
    if (!chainId) throw new HttpError(400, "chain_id is required");
    const [{ data: chain, error: chainError }, { count, error: stepsError }] = await Promise.all([
      supabaseAdmin.from("prompt_chains").select("id").eq("id", chainId).eq("enabled", true).maybeSingle(),
      supabaseAdmin.from("prompt_chain_steps").select("id", { count: "exact", head: true }).eq("chain_id", chainId).eq("enabled", true),
    ]);
    if (chainError || stepsError) throw new HttpError(500, chainError?.message ?? stepsError?.message ?? "Unable to validate chain");
    if (!chain || !count) throw new HttpError(400, "Chain mix requires an enabled chain with at least one enabled step");
  }
}

export function validateWeek7Resource(resource: string, body: Record<string, unknown>, partial = false) {
  const entry = getWeek7Resource(resource);
  if (!entry.writable) throw new HttpError(405, "This resource is read-only");
  const patch: Record<string, unknown> = {};
  for (const field of entry.fields) if (field in body) patch[field] = body[field];
  if (!Object.keys(patch).length) throw new HttpError(400, "No supported fields were provided");
  if (!partial) for (const field of entry.required) if (patch[field] === undefined || patch[field] === null || patch[field] === "") throw new HttpError(400, `${field} is required`);
  const stringFields = new Set(["name", "description", "term", "definition", "category", "domain", "email", "provider_key", "endpoint_url", "model_key", "display_name", "prompt_template", "input_prompt", "expected_output"]);
  for (const [key, value] of Object.entries(patch)) if (stringFields.has(key) && value !== null) {
    if (typeof value !== "string") throw new HttpError(400, `${key} must be text`);
    const normalized = value.trim();
    if (["name", "term", "domain", "email", "provider_key", "model_key", "display_name", "prompt_template", "input_prompt", "expected_output"].includes(key) && !normalized) throw new HttpError(400, `${key} cannot be empty`);
    if (normalized.length > 10000) throw new HttpError(400, `${key} is too long`);
    patch[key] = normalized;
  }
  if (patch.step_order !== undefined && (!Number.isInteger(patch.step_order) || Number(patch.step_order) < 1)) throw new HttpError(400, "step_order must be a positive integer");
  if (patch.weight !== undefined && (typeof patch.weight !== "number" || !Number.isFinite(patch.weight) || patch.weight <= 0)) throw new HttpError(400, "weight must be greater than zero");
  if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") throw new HttpError(400, "enabled must be a boolean");
  for (const key of ["config", "input_data"]) if (patch[key] !== undefined && (patch[key] === null || typeof patch[key] !== "object" || Array.isArray(patch[key]))) throw new HttpError(400, `${key} must be a JSON object`);
  if (patch.capabilities !== undefined && !Array.isArray(patch.capabilities)) throw new HttpError(400, "capabilities must be a JSON array");
  if (patch.config !== undefined) {
    const hasSecretKey = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return false;
      return Object.entries(value as Record<string, unknown>).some(([key, child]) => /api.?key|secret|token|credential|password/i.test(key) || hasSecretKey(child));
    };
    if (hasSecretKey(patch.config)) throw new HttpError(400, "Provider credentials must stay in server-side secret configuration");
  }
  if (patch.domain !== undefined && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(String(patch.domain))) throw new HttpError(400, "Enter a valid domain without a scheme or path");
  if (patch.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email))) throw new HttpError(400, "Enter a valid email address");
  if (patch.domain !== undefined) patch.domain = String(patch.domain).toLowerCase();
  if (patch.email !== undefined) patch.email = String(patch.email).toLowerCase();
  return patch;
}
