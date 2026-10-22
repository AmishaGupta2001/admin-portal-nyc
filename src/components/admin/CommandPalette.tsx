"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV } from "@/components/layout/Sidebar";
import { useMe } from "./MeProvider";

/** ⌘K / Ctrl+K — jump anywhere in the panel. */
export function CommandPalette() {
  const router = useRouter();
  const { can } = useMe();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const base = NAV.filter((n) => !n.perm || can(n.perm)).map((n) => ({ label: n.label, hint: n.group, href: n.href }));
    const extras = [
      can("studio.use") && { label: "Create a post", hint: "Action", href: "/dashboard/studio" },
      can("users.invite") && { label: "Invite / create a user", hint: "Action", href: "/dashboard/users?invite=1" },
      can("content.moderate") && { label: "Hidden posts", hint: "Moderation", href: "/dashboard/moderation?status=hidden" },
      can("content.moderate") && { label: "Featured posts", hint: "Moderation", href: "/dashboard/moderation?status=featured" },
    ].filter(Boolean) as { label: string; hint: string; href: string }[];
    const all = [...base, ...extras];
    const s = q.trim().toLowerCase();
    return s ? all.filter((i) => i.label.toLowerCase().includes(s) || i.hint.toLowerCase().includes(s)) : all;
  }, [q, can]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => setIdx(0), [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4" style={{ background: "rgba(0,0,0,0.6)" }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="card w-full max-w-lg overflow-hidden fade-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Search size={15} style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter" && items[idx]) go(items[idx].href);
            }}
            placeholder="Jump to a page or action…"
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: "var(--text)" }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && <p className="text-center text-[13px] py-6" style={{ color: "var(--text-muted)" }}>No matches</p>}
          {items.map((it, i) => (
            <button
              key={it.label + it.href}
              onClick={() => go(it.href)}
              onMouseEnter={() => setIdx(i)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] text-left"
              style={{ background: i === idx ? "var(--bg-card-hover)" : "transparent", color: "var(--text)" }}
            >
              <span>{it.label}</span>
              <span className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {it.hint}{i === idx && <CornerDownLeft size={11} />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
