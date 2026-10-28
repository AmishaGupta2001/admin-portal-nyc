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

  if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new HttpError(400, "A valid email is required");
  if (!isRole(role)) throw new HttpError(400, `role must be one of ${ROLES.join(", ")}`);
  if (role !== "user") await requirePermission("users.assign_role");

  // Admin pre-provisioning is subject to the same allowlist as Google signup.
  // The database trigger remains authoritative and closes races after this check.
  const [domains, emails] = await Promise.all([
    supabaseAdmin.from("allowed_signup_domains").select("id", { count: "exact", head: true }).eq("enabled", true),
    supabaseAdmin.from("whitelisted_emails").select("id", { count: "exact", head: true }).eq("enabled", true),
  ]);
  if (domains.error || emails.error) throw new HttpError(500, "Unable to validate the signup allowlist");
  if ((domains.count ?? 0) + (emails.count ?? 0) > 0) {
    const domain = normalizedEmail.split("@").at(-1) ?? "";
    const [emailMatch, domainMatch] = await Promise.all([
      supabaseAdmin.from("whitelisted_emails").select("id").eq("email", normalizedEmail).eq("enabled", true).maybeSingle(),
      supabaseAdmin.from("allowed_signup_domains").select("id").eq("domain", domain).eq("enabled", true).maybeSingle(),
    ]);
    if (emailMatch.error || domainMatch.error) throw new HttpError(500, "Unable to validate the signup allowlist");
    if (!emailMatch.data && !domainMatch.data) {
      throw new HttpError(400, "Add this email address or its domain to an enabled signup allowlist before pre-provisioning the user");
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
