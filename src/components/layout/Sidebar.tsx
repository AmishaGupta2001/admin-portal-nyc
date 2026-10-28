"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, Image, ThumbsUp, BarChart3, Wand2, ShieldAlert, Tags,
  ScanSearch, ScrollText, Activity, LogOut, Zap, ChevronRight, Search, GitBranch,
  ListOrdered, Scale, BookOpen, ClipboardList, FlaskConical, Bot, Cpu, MessageSquareText,
  Globe, MailCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMe } from "@/components/admin/MeProvider";
import { Permission, ROLE_META } from "@/lib/roles";
import clsx from "clsx";

export const NAV: { href: string; label: string; icon: LucideIcon; group: string; perm?: Permission }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "Insights" },
  { href: "/dashboard/stats", label: "Analytics", icon: BarChart3, group: "Insights" },
  { href: "/dashboard/observability", label: "Observability", icon: Activity, group: "Insights", perm: "system.view" },
  { href: "/dashboard/studio", label: "Studio", icon: Wand2, group: "Create", perm: "studio.use" },
  { href: "/dashboard/moderation", label: "Moderation", icon: ShieldAlert, group: "Manage", perm: "content.moderate" },
  { href: "/dashboard/users", label: "Users", icon: Users, group: "Manage", perm: "users.view" },
  { href: "/dashboard/media", label: "Media", icon: Image, group: "Manage" },
  { href: "/dashboard/tags", label: "Tags", icon: Tags, group: "Manage" },
  { href: "/dashboard/observability/prompt-chains", label: "Prompt chains", icon: GitBranch, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/prompt-chain-steps", label: "Chain steps", icon: ListOrdered, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/prompt-chain-mix", label: "Chain mix", icon: Scale, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/terms", label: "Terms", icon: BookOpen, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/generation-requests", label: "Generation requests", icon: ClipboardList, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/ai-generation-examples", label: "AI examples", icon: FlaskConical, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/llm-providers", label: "LLM providers", icon: Bot, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/llm-models", label: "LLM models", icon: Cpu, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/llm-responses", label: "LLM responses", icon: MessageSquareText, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/allowed-signup-domains", label: "Signup domains", icon: Globe, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/observability/whitelisted-emails", label: "Whitelisted emails", icon: MailCheck, group: "AI operations", perm: "system.view" },
  { href: "/dashboard/votes", label: "Votes", icon: ThumbsUp, group: "Trust & Safety" },
  { href: "/dashboard/integrity", label: "Vote integrity", icon: ScanSearch, group: "Trust & Safety", perm: "votes.moderate" },
  { href: "/dashboard/audit", label: "Audit log", icon: ScrollText, group: "Trust & Safety", perm: "audit.view" },
  { href: "/dashboard/system", label: "System", icon: Activity, group: "Trust & Safety", perm: "system.view" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { me, can } = useMe();
  const visible = NAV.filter((n) => !n.perm || can(n.perm));
  const groups = Array.from(new Set(visible.map((n) => n.group)));

  return (
    <aside
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      className="w-56 flex-shrink-0 flex flex-col h-screen sticky top-0 z-30"
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--sidebar-accent)", color: "#0F1117" }}
        >
          <Zap size={14} strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "var(--sidebar-text)" }}>
            NYC Unhinged
          </div>
          <div className="text-[10px]" style={{ color: "var(--sidebar-muted)" }}>
            Admin Panel
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-[12px]"
          style={{ background: "var(--sidebar-hover)", color: "var(--sidebar-muted)" }}
        >
          <Search size={13} /> Quick jump <kbd className="ml-auto text-[10px] opacity-70">Ctrl K</kbd>
        </button>
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-muted)" }}>{group}</div>
            <div className="space-y-0.5">
              {visible.filter((n) => n.group === group).map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx("flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors")}
                    style={active ? { background: "var(--sidebar-accent)", color: "#0F1117" } : { color: "var(--sidebar-muted)" }}
                    onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-hover)"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; } }}
                    onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-muted)"; } }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                    {label}
                    {active && <ChevronRight size={12} className="ml-auto" strokeWidth={2.5} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-white/5">
        {session?.user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt="avatar"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--sidebar-accent)", color: "#0F1117" }}
              >
                {session.user.name?.[0] ?? "A"}
              </div>
            )}
            <div className="min-w-0">
              <div
                className="text-[12px] font-medium truncate"
                style={{ color: "var(--sidebar-text)" }}
              >
                {session.user.name}
              </div>
              <div className="text-[10px] truncate" style={{ color: "var(--sidebar-muted)" }}>
                {me ? ROLE_META[me.role].label : "…"}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
          style={{ color: "var(--sidebar-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,85,85,0.1)";
            (e.currentTarget as HTMLElement).style.color = "#FF5555";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "var(--sidebar-muted)";
          }}
        >
          <LogOut size={16} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
