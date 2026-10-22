"use client";

import { signIn } from "next-auth/react";
import { ShieldX, ArrowLeft } from "lucide-react";

export default function NotAdminPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "#0F1117" }}
    >
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,85,85,0.1)", border: "1px solid rgba(255,85,85,0.2)" }}
          >
            <ShieldX size={26} style={{ color: "#FF5555" }} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold" style={{ color: "#E8E8E3" }}>
            Access Denied
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: "#6B7280" }}>
            Your account doesn't have superadmin access. If you believe this is an error, ask your
            database administrator to set <code className="text-[#B4FF47]">is_superadmin = true</code> on your profile.
          </p>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex items-center gap-2 mx-auto text-[13px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={14} /> Try a different account
        </button>
      </div>
    </div>
  );
}
