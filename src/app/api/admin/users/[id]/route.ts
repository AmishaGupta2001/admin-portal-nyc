import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError, Actor } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { can, isRole, ROLE_RANK, Role } from "@/lib/roles";
import { deleteGenerations } from "@/lib/content";

type Ctx = { params: { id: string } };

async function loadTarget(id: string) {
  const { data: authData, error } = await supabaseAdmin.auth.admin.getUserById(id);
  if (error || !authData?.user) throw new HttpError(404, "User not found");
  const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle();
  const role: Role = profile?.is_superadmin ? "superadmin" : isRole(profile?.role) ? profile.role : "user";
  return { auth: authData.user, profile, role };
}

/** Non-superadmins may only act on users ranked strictly below them. */
function assertOutranks(actor: Actor, targetRole: Role) {
  if (actor.role === "superadmin") return;
  if (ROLE_RANK[actor.role] <= ROLE_RANK[targetRole]) throw new HttpError(403, "You can't act on someone of equal or higher role");
}

export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requirePermission("users.view");
  const { auth, profile, role } = await loadTarget(params.id);

  const [{ data: gens }, { data: myVotes }, { data: recentLog }] = await Promise.all([
    supabaseAdmin
      .from("generations")
      .select("id, caption, created_at, is_hidden, images(image_url)")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin.from("votes").select("vote").eq("user_id", params.id),
    supabaseAdmin
      .from("admin_audit_log")
      .select("id, created_at, action, actor_email, metadata")
      .eq("target_id", params.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const ids = (gens ?? []).map((g: any) => g.id);
  let received = { lols: 0, nahs: 0 };
  if (ids.length) {
    const { data: rv } = await supabaseAdmin.from("votes").select("vote").in("generation_id", ids.slice(0, 500));
    (rv ?? []).forEach((v: any) => (v.vote === 1 ? received.lols++ : received.nahs++));
  }

  return NextResponse.json({
    user: {
      id: auth.id,
      email: auth.email,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role,
      is_banned: !!profile?.is_banned,
      ban_reason: profile?.ban_reason ?? null,
      banned_at: profile?.banned_at ?? null,
      provider: (auth.app_metadata as any)?.provider ?? null,
      created_at: auth.created_at,
      last_seen: auth.last_sign_in_at ?? null,
    },
    stats: {
      generations: gens?.length ?? 0,
      hidden: (gens ?? []).filter((g: any) => g.is_hidden).length,
      votes_cast: myVotes?.length ?? 0,
      lols_cast: (myVotes ?? []).filter((v: any) => v.vote === 1).length,
      lols_received: received.lols,
      nahs_received: received.nahs,
    },
    recent_generations: (gens ?? []).slice(0, 8).map((g: any) => ({
      id: g.id, caption: g.caption, created_at: g.created_at, is_hidden: g.is_hidden, image_url: g.images?.image_url ?? "",
    })),
    activity: recentLog ?? [],
  });
});

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("users.view");
  const body = await req.json();
  const target = await loadTarget(params.id);
  const isSelf = actor.id === params.id;
  const changes: Record<string, unknown> = {};
  const profilePatch: Record<string, unknown> = {};

  // --- profile fields -------------------------------------------------
  if ("first_name" in body || "last_name" in body || "avatar_url" in body) {
    if (!can(actor.role, "users.edit") && !isSelf) throw new HttpError(403, "Requires users.edit");
    if (!isSelf) assertOutranks(actor, target.role);
    for (const k of ["first_name", "last_name", "avatar_url"] as const) {
      if (k in body) { profilePatch[k] = String(body[k] ?? "").trim() || null; changes[k] = profilePatch[k]; }
    }
  }

  // --- role -----------------------------------------------------------
  if ("role" in body && body.role !== target.role) {
    if (!can(actor.role, "users.assign_role")) throw new HttpError(403, "Only superadmins can assign roles");
    if (!isRole(body.role)) throw new HttpError(400, "Invalid role");
    if (isSelf) throw new HttpError(400, "You can't change your own role");
    if (target.role === "superadmin") {
      const { count } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "superadmin");
      if ((count ?? 0) <= 1) throw new HttpError(400, "Can't demote the last superadmin");
    }
    profilePatch.role = body.role;
    changes.role = { from: target.role, to: body.role };
  }

  // --- ban / unban -----------------------------------------------------
  if ("banned" in body && !!body.banned !== !!target.profile?.is_banned) {
    if (isSelf) throw new HttpError(400, "You can't ban yourself");
    if (target.role === "superadmin") throw new HttpError(403, "Superadmins can't be banned — demote first");
    const needed = target.role === "user" ? "users.edit" : "users.ban_staff";
    if (!can(actor.role, needed)) throw new HttpError(403, `Requires ${needed}`);
    assertOutranks(actor, target.role);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(params.id, {
      ban_duration: body.banned ? "876000h" : "none", // blocks sign-in in the main app, too
    });
    if (error) throw new HttpError(500, error.message);
    profilePatch.is_banned = !!body.banned;
    profilePatch.banned_at = body.banned ? new Date().toISOString() : null;
    profilePatch.ban_reason = body.banned ? String(body.reason ?? "").slice(0, 300) || null : null;
    changes.banned = !!body.banned;
    if (body.banned && body.reason) changes.reason = profilePatch.ban_reason;
  }

  if (!Object.keys(profilePatch).length) return NextResponse.json({ ok: true, unchanged: true });

  const { error } = await supabaseAdmin.from("profiles").upsert({ id: params.id, ...profilePatch }, { onConflict: "id" });
  if (error) throw new HttpError(500, error.message);

  const action = "role" in profilePatch ? "user.role_change" : "is_banned" in profilePatch ? (profilePatch.is_banned ? "user.ban" : "user.unban") : "user.edit";
  await audit(actor, action, { type: "user", id: params.id }, { email: target.auth.email, ...changes });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: NextRequest, { params }: Ctx) => {
  const actor = await requirePermission("users.delete");
  if (actor.id === params.id) throw new HttpError(400, "You can't delete yourself");
  const target = await loadTarget(params.id);
  if (target.role === "superadmin") throw new HttpError(403, "Demote a superadmin before deleting them");

  // 1. their votes, 2. their generations (and votes on them), 3. images they own, 4. profile, 5. auth user
  await supabaseAdmin.from("votes").delete().eq("user_id", params.id);
  const { data: gens } = await supabaseAdmin.from("generations").select("id").eq("user_id", params.id);
  await deleteGenerations((gens ?? []).map((g: any) => g.id));

  const { data: owned } = await supabaseAdmin.from("images").select("id").eq("owner_id", params.id);
  for (const img of owned ?? []) {
    const { error } = await supabaseAdmin.from("images").delete().eq("id", img.id);
    if (error) await supabaseAdmin.from("images").update({ owner_id: null }).eq("id", img.id); // still used by others
  }

  await supabaseAdmin.from("profiles").delete().eq("id", params.id);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(params.id);
  if (error) throw new HttpError(500, error.message);

  await audit(actor, "user.delete", { type: "user", id: params.id }, { email: target.auth.email, generations_removed: gens?.length ?? 0 });
  return NextResponse.json({ ok: true, generations_removed: gens?.length ?? 0 });
});
