"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const messages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to access this panel.",
    Verification: "The sign-in link has expired or already been used.",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "#0F1117" }}
    >
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,170,51,0.1)", border: "1px solid rgba(255,170,51,0.2)" }}
          >
            <AlertTriangle size={26} style={{ color: "#FFAA33" }} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold" style={{ color: "#E8E8E3" }}>
            Authentication Error
          </h1>
          <p className="text-[13px]" style={{ color: "#6B7280" }}>
            {messages[error ?? ""] ?? "An unexpected error occurred during sign-in."}
          </p>
          {error === "AccessDenied" && (
            <p className="text-[12px]" style={{ color: "#6B7280" }}>
              Your account needs <code className="text-[#B4FF47]">is_superadmin = true</code> to access this panel.
            </p>
          )}
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
          style={{ background: "#B4FF47", color: "#0F1117" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div style={{ background: "#0F1117" }} className="min-h-screen" />}>
      <ErrorContent />
    </Suspense>
  );
}
