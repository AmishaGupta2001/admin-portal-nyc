"use client";

import { Sun, Moon, RefreshCw } from "lucide-react";
import { useTheme } from "@/components/ui/ThemeProvider";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header
      className="flex items-center justify-between px-8 py-5 border-b"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {action}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
