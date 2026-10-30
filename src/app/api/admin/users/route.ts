import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { handle, requirePermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { listAllAuthUsers } from "@/lib/users";
import { isRole, ROLES } from "@/lib/roles";

export const GET = handle(async () => {
  await requirePermission("users.view");

  const [authUsers, { data: profiles }, { data: gens }, { data: votes }] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin.from("profiles").select("id, first_name, last_name, avatar_url, is_superadmin, role, is_banned, ban_reason"),
    supabaseAdmin.from("generations").select("user_id"),
    supabaseAdmin.from("votes").select("user_id"),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  const genCount: Record<string, number> = {};
  (gens ?? []).forEach(({ user_id }: any) => { genCount[user_id] = (genCount[user_id] ?? 0) + 1; });
  const voteCount: Record<string, number> = {};
  (votes ?? []).forEach(({ user_id }: any) => { voteCount[user_id] = (voteCount[user_id] ?? 0) + 1; });

  const users = authUsers.map((u) => {
    const p = profileMap[u.id];
    const role = p?.is_superadmin ? "superadmin" : isRole(p?.role) ? p.role : "user";
    return {
      id: u.id,
      email: u.email ?? "",
      first_name: p?.first_name ?? null,
      last_name: p?.last_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      is_superadmin: role === "superadmin",
      role,
      is_banned: !!p?.is_banned,
      ban_reason: p?.ban_reason ?? null,
      provider: (u.app_metadata as any)?.provider ?? null,
      created_at: u.created_at,
      last_seen: u.last_sign_in_at ?? null,
      generation_count: genCount[u.id] ?? 0,
      vote_count: voteCount[u.id] ?? 0,
    };
  });

  return NextResponse.json({ users });
});

/** Pre-provision a user (they sign in later with Google using the same email). */
export const POST = handle(async (req: NextRequest) => {
  const actor = await requirePermission("users.invite");
  const { email, first_name, last_name, role = "user" } = await req.json();
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) throw new HttpError(400, "A valid email is required");
  if (!isRole(role)) throw new HttpError(400, `role must be one of ${ROLES.join(", ")}`);
  if (role !== "user") await requirePermission("users.assign_role");

  // Keep admin pre-provisioning aligned with the main app signup policy.
  // The database trigger remains authoritative and closes races after this check.
  const isColumbia = normalizedEmail.split("@").at(-1) === "columbia.edu";
  if (!isColumbia) {
    const { data: emailMatch, error } = await supabaseAdmin
      .from("whitelisted_emails")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw new HttpError(500, "Unable to validate the signup allowlist");
    if (!emailMatch) {
      throw new HttpError(400, "Add this exact email address to the enabled email allowlist before pre-provisioning the user");
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: { first_name, last_name, created_by_admin: true },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? "Could not create user");

  // The main app may auto-create a profile via trigger — upsert covers both cases.
  const { error: pErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, first_name: first_name || null, last_name: last_name || null, role }, { onConflict: "id" });
  if (pErr) throw new HttpError(500, `User created but profile failed: ${pErr.message}`);

  await audit(actor, "user.create", { type: "user", id: data.user.id }, { email: normalizedEmail, role });
  return NextResponse.json({ user: { id: data.user.id, email: normalizedEmail } });
});
