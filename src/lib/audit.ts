import { supabaseAdmin } from "./supabase";
import type { Actor } from "./guard";

/** Best-effort audit trail. Never throws — a logging failure must not block the action. */
export async function audit(
  actor: Actor,
  action: string,
  target?: { type?: string; id?: string },
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      metadata,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
