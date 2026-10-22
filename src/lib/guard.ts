import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { supabaseAdmin } from "./supabase";
import { can, isRole, Permission, Role } from "./roles";

export interface Actor {
  id: string;
  email: string;
  role: Role;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Authenticates the request AND re-reads the role from the database, so a
 * demoted/banned admin loses access immediately instead of at JWT expiry.
 */
export async function requirePermission(perm: Permission): Promise<Actor> {
  const session = await getServerSession(authOptions);
  const supabaseId = (session?.user as any)?.supabaseId as string | undefined;
  if (!session?.user?.email || !supabaseId) throw new HttpError(401, "Unauthorized");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, is_superadmin, is_banned")
    .eq("id", supabaseId)
    .single();

  if (!profile || profile.is_banned) throw new HttpError(403, "Account disabled");
  const role: Role = profile.is_superadmin ? "superadmin" : isRole(profile.role) ? profile.role : "user";
  if (!can(role, "panel.access")) throw new HttpError(403, "Not an admin");
  if (!can(role, perm)) throw new HttpError(403, `Requires ${perm}`);
  return { id: supabaseId, email: session.user.email, role };
}

/** Wrap a route handler: converts HttpError into JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
    }
  };
}

/** For legacy handlers that use try/catch instead of handle(). */
export function errRes(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
}
