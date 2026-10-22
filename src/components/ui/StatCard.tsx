import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: boolean;
  trend?: { value: number; label: string };
}

export function StatCard({ label, value, sub, icon: Icon, accent, trend }: StatCardProps) {
  const isUp = trend && trend.value > 0;
  const isDown = trend && trend.value < 0;

  return (
    <div
      className={clsx("card p-5 fade-in", accent && "ring-1")}
      style={accent ? { ringColor: "var(--accent)", borderColor: "var(--accent)" } : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            {label}
          </div>
          <div
            className="stat-number text-3xl"
            style={{ color: accent ? "var(--accent)" : "var(--text)" }}
          >
            {value}
          </div>
          {sub && (
            <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
              {sub}
            </div>
          )}
          {trend && (
            <div
              className="text-[12px] mt-2 font-medium"
              style={{
                color: isUp ? "var(--success)" : isDown ? "var(--danger)" : "var(--text-muted)",
              }}
            >
              {isUp ? "↑" : isDown ? "↓" : "—"} {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: accent ? "var(--accent)" : "var(--bg-card-hover)",
              color: accent ? "var(--accent-fg)" : "var(--text-muted)",
            }}
          >
            <Icon size={17} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
