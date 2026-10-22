import clsx from "clsx";

type Variant = "default" | "success" | "danger" | "warning" | "accent" | "muted";

const styles: Record<Variant, { bg: string; color: string }> = {
  default: { bg: "var(--bg-card-hover)", color: "var(--text-muted)" },
  success: { bg: "rgba(74,222,128,0.12)", color: "var(--success)" },
  danger: { bg: "rgba(255,85,85,0.12)", color: "var(--danger)" },
  warning: { bg: "rgba(255,170,51,0.12)", color: "var(--warning)" },
  accent: { bg: "rgba(180,255,71,0.15)", color: "var(--accent)" },
  muted: { bg: "transparent", color: "var(--text-muted)" },
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const s = styles[variant];
  return (
    <span
      className={clsx("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold", className)}
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}
