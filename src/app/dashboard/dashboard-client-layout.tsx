"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MeProvider } from "@/components/admin/MeProvider";
import { CommandPalette } from "@/components/admin/CommandPalette";

export default function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg pulse-lime" style={{ background: "var(--accent)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <MeProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </MeProvider>
  );
}
