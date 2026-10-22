"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { can, Permission, Role } from "@/lib/roles";

interface Me { id: string; email: string; role: Role }
const MeCtx = createContext<{ me: Me | null; can: (p: Permission) => boolean }>({ me: null, can: () => false });

/** Loads the signed-in admin's CURRENT role from the DB (not the JWT) and exposes can(). */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) return signOut({ callbackUrl: "/auth/not-admin" });
        setMe(await r.json());
      })
      .catch(() => {});
  }, []);

  return <MeCtx.Provider value={{ me, can: (p) => can(me?.role, p) }}>{children}</MeCtx.Provider>;
}

export const useMe = () => useContext(MeCtx);
