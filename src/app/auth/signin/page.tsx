"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Zap, Chrome } from "lucide-react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#0F1117" }}>
        <div className="w-8 h-8 rounded-lg pulse-lime" style={{ background: "#B4FF47" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "#0F1117" }}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#B4FF47 1px, transparent 1px), linear-gradient(90deg, #B4FF47 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#B4FF47" }}
            >
              <Zap size={26} strokeWidth={2.5} style={{ color: "#0F1117" }} />
            </div>
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#E8E8E3", fontFamily: "var(--font-space)" }}
            >
              NYC Unhinged
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "#6B7280" }}>
              Admin Panel
            </p>
          </div>
        </div>

        {/* Sign in card */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "#1A1D27",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold" style={{ color: "#E8E8E3" }}>
              Sign in to continue
            </h2>
            <p className="text-[12px]" style={{ color: "#6B7280" }}>
              Only verified superadmins can access this panel.
            </p>
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: "#B4FF47",
              color: "#0F1117",
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#C8FF6E"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "#B4FF47"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div
            className="rounded-xl p-3 text-[11px]"
            style={{ background: "rgba(180,255,71,0.06)", border: "1px solid rgba(180,255,71,0.1)", color: "#6B7280" }}
          >
            🔒 Access is restricted to accounts with <code className="text-[#B4FF47]">is_superadmin = true</code> in the database.
          </div>
        </div>
      </div>
    </div>
  );
}
