"use client";

import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  disabled,
  onClick,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-2 font-medium rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  const sizes = {
    sm: "px-3 py-1.5 text-[12px]",
    md: "px-4 py-2 text-[13px]",
  };

  const variants: Record<Variant, string> = {
    primary: "",
    secondary: "",
    danger: "",
    ghost: "",
  };

  const inlineStyles: Record<Variant, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-fg)",
      border: "1px solid transparent",
    },
    secondary: {
      background: "var(--bg-card)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "rgba(255,85,85,0.1)",
      color: "var(--danger)",
      border: "1px solid rgba(255,85,85,0.2)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-muted)",
      border: "1px solid transparent",
    },
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={inlineStyles[variant]}
      className={clsx(base, sizes[size], className)}
    >
      {children}
    </button>
  );
}
