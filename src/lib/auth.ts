import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { supabaseAdmin } from "./supabase";
import { can, isRole } from "./roles";
import { listAllAuthUsers } from "./users";

/** email -> Supabase auth user id. Uses the SQL helper when present, else pages through users. */
async function findSupabaseId(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("admin_user_id_by_email", { p_email: email });
  if (!error && typeof data === "string") return data;
  const users = await listAllAuthUsers();
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h admin sessions
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const id = await findSupabaseId(user.email);
      if (!id) return "/auth/not-admin";

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role, is_superadmin, is_banned")
        .eq("id", id)
        .single();

      if (!profile || profile.is_banned) return "/auth/not-admin";
      const role = profile.is_superadmin ? "superadmin" : isRole(profile.role) ? profile.role : "user";
      return can(role, "panel.access") ? true : "/auth/not-admin";
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const id = await findSupabaseId(user.email);
        if (id) token.supabaseId = id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.supabaseId) {
        (session.user as any).supabaseId = token.supabaseId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
