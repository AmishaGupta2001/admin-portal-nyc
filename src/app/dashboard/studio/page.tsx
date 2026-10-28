"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Sparkles, Send, Wand2, Tag, RefreshCw, GitMerge, X, Check, Loader2, ImageIcon, Layers } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, inputStyle } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TagEditor } from "@/components/admin/TagEditor";
import { UserPicker, PickerUser } from "@/components/admin/UserPicker";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/url";
import { TONES } from "@/lib/prompts";

interface GalleryImage { id: string; image_url: string; title: string; tags: string[]; owner_id: string | null; generation_count: number }
interface Picked { id?: string; url: string; title: string; tags: string[] }

/* ------------------------- shared bits ------------------------- */

function ToneChips({ tone, onChange }: { tone: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.keys(TONES).map((t) => (
        <button key={t} onClick={() => onChange(tone === t ? "" : t)} className="px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors"
          style={tone === t ? { background: "var(--accent)", color: "var(--accent-fg)" } : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{t}</button>
      ))}
    </div>
  );
}

function Gallery({ images, multi, selected, onPick, loading }: { images: GalleryImage[]; multi?: boolean; selected: Set<string>; onPick: (img: GalleryImage) => void; loading: boolean }) {
  const [q, setQ] = useState("");
  const [userImgs, setUserImgs] = useState(false);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return images.filter((i) => (userImgs || !i.owner_id) && (!s || i.title.toLowerCase().includes(s) || i.tags.some((t) => t.includes(s))));
  }, [images, q, userImgs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or tag…" className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} />
        </div>
        <label className="flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" checked={userImgs} onChange={(e) => setUserImgs(e.target.checked)} /> Include user uploads
        </label>
      </div>
      {loading ? <div className="py-10 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Loading gallery…</div> : list.length === 0 ? (
        <div className="py-10 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>No images. Upload one or add some in Media.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[22rem] overflow-y-auto pr-1">
          {list.map((img) => {
            const on = selected.has(img.id);
            return (
              <button key={img.id} onClick={() => onPick(img)} title={img.title} className="relative rounded-lg overflow-hidden aspect-square group" style={{ border: `2px solid ${on ? "var(--accent)" : "var(--border)"}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveImageUrl(img.image_url)} alt={img.title} className="w-full h-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 text-[10px] px-1.5 py-1 truncate text-left" style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>{img.title}</span>
                {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}><Check size={12} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
      )}
      {multi && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{selected.size} selected</p>}
    </div>
  );
}

/* ------------------------- single post ------------------------- */

function SingleMode({ images, galleryLoading, users, authorId, reloadGallery }: { images: GalleryImage[]; galleryLoading: boolean; users: PickerUser[]; authorId: string; reloadGallery: () => void }) {
  const toast = useToast();
  const sp = useSearchParams();
  const remixId = sp.get("remix");

  const [source, setSource] = useState<"gallery" | "upload">("gallery");
  const [img, setImg] = useState<Picked | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [curated, setCurated] = useState(false);
  const [direction, setDirection] = useState("");
  const [tone, setTone] = useState("");
  const [count, setCount] = useState(3);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [remix, setRemix] = useState<{ id: string; caption: string; creator: string } | null>(null);
  const [busy, setBusy] = useState<"tag" | "caption" | "publish" | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    if (!remixId) return;
    api<any>(`/api/admin/media/generations/${remixId}`).then((g) => {
      setImg({ id: g.image.id, url: g.image.image_url, title: g.image.title, tags: g.image.tags ?? [] });
      setRemix({ id: g.id, caption: g.caption, creator: g.creator_name });
    }).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remixId]);

  const autoTag = useCallback(async (url: string) => {
    setBusy("tag");
    try {
      const r = await api<{ title: string; tags: string[] }>("/api/admin/studio/tag", { method: "POST", body: { image_url: url } });
      setImg((cur) => (cur && cur.url === url ? { ...cur, title: cur.title || r.title, tags: r.tags } : cur));
    } catch (e) { toast.error(`Auto-tag failed: ${e instanceof Error ? e.message : "error"}`); }
    finally { setBusy(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!img) return;
    setBusy("caption");
    try {
      const r = await api<{ captions: string[] }>("/api/admin/studio/caption", { method: "POST", body: { image_url: img.url, tags: img.tags, direction, tone, count, avoid: candidates.slice(0, 5) } });
      setCandidates(r.captions); setCaption(r.captions[0]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation failed"); }
    finally { setBusy(null); }
  }

  async function publish() {
    if (!img) return;
    setBusy("publish");
    try {
      const r = await api<{ generation_id: string; image_id: string }>("/api/admin/studio/publish", {
        method: "POST",
        body: {
          user_id: authorId, caption, prompt: [tone && `[${tone}]`, direction].filter(Boolean).join(" "), remix_of: remix?.id ?? null,
          ...(img.id ? { image_id: img.id } : { new_image: { image_url: img.url, title: img.title || "Untitled", tags: img.tags, curated } }),
        },
      });
      setPublished(r.generation_id);
      toast.success("Published to the app 🎉");
      setImg({ ...img, id: r.image_id }); setIsNew(false); setCaption(""); setCandidates([]);
      if (isNew) reloadGallery();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Publish failed"); }
    finally { setBusy(null); }
  }

  const canPublish = !!img && !!caption.trim() && (!!img.id || !!img.title.trim()) && !busy;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Left: image */}
      <div className="xl:col-span-3 space-y-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}><span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>1</span> Choose an image</h2>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg)" }}>
              {(["gallery", "upload"] as const).map((s) => (
                <button key={s} onClick={() => setSource(s)} className="px-3 py-1 rounded-md text-[12px] font-medium capitalize" style={source === s ? { background: "var(--accent)", color: "var(--accent-fg)" } : { color: "var(--text-muted)" }}>{s}</button>
              ))}
            </div>
          </div>
          {source === "gallery" ? (
            <Gallery images={images} loading={galleryLoading} selected={new Set(img?.id ? [img.id] : [])}
              onPick={(g) => { setImg({ id: g.id, url: g.image_url, title: g.title, tags: g.tags }); setIsNew(false); setCandidates([]); setCaption(""); setPublished(null); }} />
          ) : (
            <>
              <ImageUploader userId={authorId} onUploaded={({ url }) => { setImg({ url, title: "", tags: [] }); setIsNew(true); setCandidates([]); setCaption(""); setPublished(null); autoTag(url); }} />
              <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={curated} onChange={(e) => setCurated(e.target.checked)} />
                Also add to the curated gallery (usable as a template by everyone)
              </label>
            </>
          )}
        </div>

        {img && (
          <div className="card p-5 space-y-4 fade-in">
            <h2 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}><span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>2</span> Tags & title</h2>
            {!img.id && <Field label="Title"><input value={img.title} onChange={(e) => setImg({ ...img, title: e.target.value })} placeholder="Title for the image" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle} /></Field>}
            <Field label="Tags" hint="Gemini uses these as context for the caption.">
              <TagEditor tags={img.tags} onChange={(tags) => setImg({ ...img, tags })} />
            </Field>
            <Button size="sm" disabled={!!busy} onClick={() => autoTag(img.url)}>
              {busy === "tag" ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />} {busy === "tag" ? "Tagging…" : "Auto-tag with Gemini"}
            </Button>
            {img.id && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Tag edits here are used for this caption only — edit saved images in Media.</p>}
          </div>
        )}

        {img && (
          <div className="card p-5 space-y-4 fade-in">
            <h2 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}><span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>3</span> Creative direction</h2>
            <Field label="Optional direction" hint='e.g. "act like a landlord who just raised the rent"'>
              <textarea value={direction} onChange={(e) => setDirection(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={inputStyle} />
            </Field>
            <Field label="Tone"><ToneChips tone={tone} onChange={setTone} /></Field>
            <div className="flex items-center gap-3">
              <Button variant="primary" disabled={!!busy || img.tags.length === 0 && false} onClick={generate}>
                {busy === "caption" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{busy === "caption" ? "Generating…" : candidates.length ? "Regenerate" : "Generate captions"}
              </Button>
              <select value={count} onChange={(e) => setCount(+e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
                {[1, 3, 5].map((n) => <option key={n} value={n}>{n} option{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            {candidates.length > 1 && (
              <div className="space-y-1.5">
                {candidates.map((c) => (
                  <button key={c} onClick={() => setCaption(c)} className="w-full text-left text-[13px] px-3 py-2 rounded-lg flex items-start gap-2"
                    style={{ background: c === caption ? "rgba(180,255,71,0.12)" : "var(--bg)", border: `1px solid ${c === caption ? "var(--accent)" : "var(--border)"}`, color: "var(--text)" }}>
                    {c === caption && <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />}{c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: preview + publish */}
      <div className="xl:col-span-2">
        <div className="card p-5 space-y-4 xl:sticky xl:top-4">
          <h2 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}><span className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>4</span> Preview & publish</h2>
          {remix && (
            <div className="flex items-start gap-2 text-[12px] p-2.5 rounded-lg" style={{ background: "rgba(255,170,51,0.1)", color: "var(--warning)" }}>
              <GitMerge size={14} className="mt-0.5 flex-shrink-0" />
              <span>Remixing <b>{remix.creator}</b>&apos;s post: “{remix.caption.slice(0, 80)}”</span>
              <button onClick={() => setRemix(null)} className="ml-auto" aria-label="Cancel remix"><X size={13} /></button>
            </div>
          )}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg)" }}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(img.url)} alt="" className="w-full max-h-72 object-cover" />
            ) : <div className="h-44 flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}><ImageIcon size={28} /><span className="text-[12px]">Pick an image to start</span></div>}
            <div className="p-3 text-[14px] font-medium min-h-[3rem]" style={{ color: caption ? "var(--text)" : "var(--text-muted)" }}>{caption || "Your caption will appear here"}</div>
          </div>
          <Field label={`Caption (${caption.length}/400)`}>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={400} placeholder="Generate with AI or write your own" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={inputStyle} />
          </Field>
          <Button variant="primary" className="w-full justify-center" disabled={!canPublish} onClick={publish}>
            {busy === "publish" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}{busy === "publish" ? "Publishing…" : "Publish to feed"}
          </Button>
          {published && (
            <div className="text-[12px] flex items-center justify-between" style={{ color: "var(--success)" }}>
              <span>✓ Live in the app</span>
              <Link href={`/dashboard/moderation?user=${authorId}`} className="underline">View in Moderation</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- batch ------------------------- */

type RowState = "idle" | "generating" | "ready" | "error" | "publishing" | "published";
interface Row { img: GalleryImage; caption: string; state: RowState; error?: string }

function BatchMode({ images, galleryLoading, authorId }: { images: GalleryImage[]; galleryLoading: boolean; authorId: string }) {
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [direction, setDirection] = useState("");
  const [tone, setTone] = useState("");
  const [running, setRunning] = useState(false);

  const toggle = (g: GalleryImage) => setSel((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; });
  const patchRow = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.img.id === id ? { ...r, ...p } : r)));

  async function genOne(img: GalleryImage) {
    patchRow(img.id, { state: "generating", error: undefined });
    try {
      const r = await api<{ captions: string[] }>("/api/admin/studio/caption", { method: "POST", body: { image_url: img.image_url, tags: img.tags, direction, tone, count: 1 } });
      patchRow(img.id, { state: "ready", caption: r.captions[0] });
    } catch (e) { patchRow(img.id, { state: "error", error: e instanceof Error ? e.message : "failed" }); }
  }

  async function generateAll() {
    const picked = images.filter((i) => sel.has(i.id));
    if (!picked.length) return;
    setRows(picked.map((img) => ({ img, caption: "", state: "idle" })));
    setRunning(true);
    const queue = [...picked];
    const worker = async () => { for (let g = queue.shift(); g; g = queue.shift()) await genOne(g); };
    await Promise.all([worker(), worker()]); // 2 at a time — friendly to Gemini rate limits
    setRunning(false);
  }

  async function publishAll() {
    setRunning(true);
    let ok = 0;
    for (const r of rows) {
      if (r.state !== "ready" || !r.caption.trim()) continue;
      patchRow(r.img.id, { state: "publishing" });
      try {
        await api("/api/admin/studio/publish", { method: "POST", body: { image_id: r.img.id, user_id: authorId, caption: r.caption, prompt: [tone && `[${tone}]`, direction].filter(Boolean).join(" ") } });
        patchRow(r.img.id, { state: "published" }); ok++;
      } catch (e) { patchRow(r.img.id, { state: "error", error: e instanceof Error ? e.message : "failed" }); }
    }
    setRunning(false);
    if (ok) toast.success(`Published ${ok} post${ok > 1 ? "s" : ""}`);
  }

  const readyCount = rows.filter((r) => r.state === "ready" && r.caption.trim()).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>1 · Pick images</h2>
          <Gallery images={images} loading={galleryLoading} multi selected={sel} onPick={toggle} />
        </div>
        <div className="card p-5 space-y-4">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>2 · Shared direction</h2>
          <Field label="Optional direction"><textarea value={direction} onChange={(e) => setDirection(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none" style={inputStyle} /></Field>
          <Field label="Tone"><ToneChips tone={tone} onChange={setTone} /></Field>
          <Button variant="primary" disabled={running || sel.size === 0} onClick={generateAll}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate {sel.size || ""} caption{sel.size === 1 ? "" : "s"}
          </Button>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Each image gets its own caption. Review and edit them below before anything is published.</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card p-5 space-y-3 fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>3 · Review & publish</h2>
            <Button variant="primary" size="sm" disabled={running || readyCount === 0} onClick={publishAll}><Send size={12} /> Publish {readyCount} ready</Button>
          </div>
          {rows.map((r) => (
            <div key={r.img.id} className="flex items-start gap-3 p-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveImageUrl(r.img.image_url)} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <textarea value={r.caption} disabled={r.state === "published" || r.state === "generating"} rows={2} maxLength={400} onChange={(e) => patchRow(r.img.id, { caption: e.target.value })}
                  placeholder={r.state === "generating" ? "Generating…" : "Caption"} className="w-full px-2.5 py-1.5 rounded-md text-[13px] outline-none resize-none bg-transparent" style={{ border: "1px solid var(--border)", color: "var(--text)" }} />
                {r.error && <div className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>{r.error}</div>}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <Badge variant={r.state === "published" ? "success" : r.state === "error" ? "danger" : r.state === "ready" ? "accent" : "muted"}>{r.state}</Badge>
                {(r.state === "ready" || r.state === "error") && <button onClick={() => genOne(r.img)} className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}><RefreshCw size={10} /> redo</button>}
                {r.state !== "published" && <button onClick={() => setRows((rs) => rs.filter((x) => x.img.id !== r.img.id))} className="text-[11px]" style={{ color: "var(--text-muted)" }}>remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- page ------------------------- */

function StudioInner() {
  const toast = useToast();
  const sp = useSearchParams();
  const { me, can } = useMe();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [authorId, setAuthorId] = useState("");

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try { setImages((await api<{ images: GalleryImage[] }>("/api/admin/media/images")).images); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load gallery"); }
    finally { setGalleryLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGallery(); api<{ users: PickerUser[] }>("/api/admin/users").then((r) => setUsers(r.users)).catch(() => {}); }, [loadGallery]);
  useEffect(() => { if (me && !authorId) setAuthorId(sp.get("user") || me.id); }, [me, sp, authorId]);

  const author = users.find((u) => u.id === authorId);
  const impersonating = !!me && !!authorId && authorId !== me.id;

  return (
    <div className="fade-in">
      <Header title="Studio" subtitle="Create posts with AI captions and publish them straight to the app"
        action={
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-card)" }}>
            {([["single", "Single post", Wand2], ["batch", "Batch", Layers]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setMode(k)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5" style={mode === k ? { background: "var(--accent)", color: "var(--accent-fg)" } : { color: "var(--text-muted)" }}><I size={13} />{l}</button>
            ))}
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Post as</div>
          <div className="w-full max-w-sm"><UserPicker users={users} value={authorId} onChange={setAuthorId} disabled={!can("studio.post_as_other")} /></div>
          {impersonating && <Badge variant="warning">Posting as {author ? [author.first_name, author.last_name].filter(Boolean).join(" ") || author.email : "another user"} · logged in audit log</Badge>}
        </div>
        {!authorId ? null : mode === "single"
          ? <SingleMode images={images} galleryLoading={galleryLoading} users={users} authorId={authorId} reloadGallery={loadGallery} />
          : <BatchMode images={images} galleryLoading={galleryLoading} authorId={authorId} />}
      </div>
    </div>
  );
}

export default function StudioPage() {
  return <Suspense fallback={null}><StudioInner /></Suspense>;
}
