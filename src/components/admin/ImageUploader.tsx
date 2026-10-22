"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useToast } from "@/components/ui/Toast";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 8 * 1024 * 1024;

/** Direct-to-Storage upload using a server-issued signed token. */
export function ImageUploader({
  userId, onUploaded, compact,
}: { userId?: string; onUploaded: (r: { url: string; file: File }) => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    if (!TYPES.includes(file.type)) return toast.error("Use a JPG, PNG, WebP or GIF image");
    if (file.size > MAX) return toast.error("Max file size is 8MB");
    setBusy(true);
    try {
      const t = await api<{ bucket: string; path: string; token: string; public_url: string }>("/api/admin/studio/upload-url", {
        method: "POST", body: { content_type: file.type, size: file.size, user_id: userId },
      });
      const { error } = await supabaseBrowser().storage.from(t.bucket).uploadToSignedUrl(t.path, t.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      onUploaded({ url: t.public_url, file });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div
      onClick={() => !busy && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
      className={`rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${compact ? "py-4" : "py-10"}`}
      style={{ border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`, background: drag ? "var(--bg-card-hover)" : "transparent" }}
    >
      <input ref={ref} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {busy ? <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} /> : <UploadCloud size={22} style={{ color: "var(--text-muted)" }} />}
      <p className="text-[13px] mt-2 font-medium" style={{ color: "var(--text)" }}>{busy ? "Uploading…" : "Drop an image or click to upload"}</p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>JPG, PNG, WebP or GIF · up to 8MB</p>
    </div>
  );
}
