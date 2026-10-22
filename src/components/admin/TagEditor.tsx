"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { inputStyle } from "@/components/ui/Modal";

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim().toLowerCase().replace(/,/g, "");
    if (t && !tags.includes(t) && tags.length < 12) onChange([...tags, t]);
    setV("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg" style={inputStyle}>
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px]" style={{ background: "var(--bg-card-hover)", color: "var(--text)" }}>
          {t}<button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={11} /></button>
        </span>
      ))}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } if (e.key === "Backspace" && !v && tags.length) onChange(tags.slice(0, -1)); }}
        onBlur={add} placeholder={tags.length ? "" : "Add tags…"} className="flex-1 min-w-[80px] bg-transparent outline-none text-[12px]" style={{ color: "var(--text)" }} />
    </div>
  );
}
