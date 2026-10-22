"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  X,
  Save,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/components/admin/MeProvider";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/url";

type Tab = "images" | "generations";

interface ImageRow {
  id: string;
  image_url: string;
  title: string;
  tags: string[];
  owner_id: string | null;
  created_at: string;
  generation_count: number;
}

interface GenerationRow {
  id: string;
  caption: string;
  prompt: string;
  creator_name: string;
  image_title: string;
  image_url: string;
  vote_count: number;
  remix_of: string | null;
  created_at: string;
}

interface ImageFormData {
  image_url: string;
  title: string;
  tags: string;
}

export default function MediaPage() {
  const toast = useToast();
  const { can } = useMe();
  const canManage = can("media.manage");
  const [tagging, setTagging] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [tab, setTab] = useState<Tab>("images");
  const [images, setImages] = useState<ImageRow[]>([]);
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageRow | null>(null);
  const [form, setForm] = useState<ImageFormData>({
    image_url: "",
    title: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [imgRes, genRes] = await Promise.all([
        fetch("/api/admin/media/images"),
        fetch("/api/admin/media/generations"),
      ]);
      const imgData = await imgRes.json();
      const genData = await genRes.json();
      setImages(imgData.images ?? []);
      setGenerations(genData.generations ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingImage(null);
    setForm({ image_url: "", title: "", tags: "" });
    setShowModal(true);
  };

  const openEdit = (img: ImageRow) => {
    setEditingImage(img);
    setForm({
      image_url: img.image_url,
      title: img.title,
      tags: img.tags.join(", "),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        image_url: form.image_url,
        title: form.title,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const url = editingImage
        ? `/api/admin/media/images/${editingImage.id}`
        : "/api/admin/media/images";
      const method = editingImage ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    const res = await fetch(
      `/api/admin/media/images/${id}${forceDelete ? "?force=1" : ""}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setDeleteConfirm(null);
      setForceDelete(false);
      toast.success("Image deleted");
      load();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  };

  const autoTag = async () => {
    if (!form.image_url) return;
    setTagging(true);
    try {
      const r = await api<{ title: string; tags: string[] }>(
        "/api/admin/studio/tag",
        { method: "POST", body: { image_url: form.image_url } },
      );
      setForm((f) => ({
        ...f,
        title: f.title || r.title,
        tags: r.tags.join(", "),
      }));
      toast.success("Tagged with Gemini");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-tag failed");
    } finally {
      setTagging(false);
    }
  };

  const handleDeleteGeneration = async (id: string) => {
    const res = await fetch(`/api/admin/media/generations/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteConfirm(null);
      load();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  };

  const filteredImages = images.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );
  const filteredGenerations = generations.filter(
    (g) =>
      g.caption.toLowerCase().includes(search.toLowerCase()) ||
      g.creator_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fade-in">
      <Header
        title="Media"
        subtitle="Manage image inputs and AI-generated captions"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </Button>
            {tab === "images" && canManage && (
              <Button variant="primary" size="sm" onClick={openCreate}>
                <Plus size={13} />
                Add Image
              </Button>
            )}
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl w-fit"
          style={{ background: "var(--bg-card)" }}
        >
          {(["images", "generations"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSearch("");
              }}
              className="px-4 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-all"
              style={
                tab === t
                  ? { background: "var(--accent)", color: "var(--accent-fg)" }
                  : { color: "var(--text-muted)" }
              }
            >
              {t} ({t === "images" ? images.length : generations.length})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder={
              tab === "images" ? "Search by title or tag…" : "Search captions…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-[13px] outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {/* Images table */}
        {tab === "images" && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Title</th>
                    <th>Tags</th>
                    <th>Generations</th>
                    <th>Type</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : filteredImages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No images found
                      </td>
                    </tr>
                  ) : (
                    filteredImages.map((img) => (
                      <tr key={img.id}>
                        <td>
                          <img
                            src={resolveImageUrl(img.image_url)}
                            alt={img.title}
                            className="w-10 h-10 rounded-lg object-cover"
                            style={{ border: "1px solid var(--border)" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </td>
                        <td style={{ color: "var(--text)", fontWeight: 500 }}>
                          {img.title}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {img.tags.slice(0, 3).map((t) => (
                              <Badge key={t} variant="default">
                                {t}
                              </Badge>
                            ))}
                            {img.tags.length > 3 && (
                              <Badge variant="muted">
                                +{img.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className="stat-number text-[14px]"
                            style={{ color: "var(--text)" }}
                          >
                            {img.generation_count}
                          </span>
                        </td>
                        <td>
                          <Badge variant={img.owner_id ? "warning" : "accent"}>
                            {img.owner_id ? "User" : "Curated"}
                          </Badge>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(img.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {canManage && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(img)}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: "var(--text-muted)" }}
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setForceDelete(false);
                                  setDeleteConfirm(img.id);
                                }}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: "var(--danger)" }}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generations table */}
        {tab === "generations" && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Caption</th>
                    <th>Creator</th>
                    <th>Votes</th>
                    <th>Remix</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : filteredGenerations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No generations found
                      </td>
                    </tr>
                  ) : (
                    filteredGenerations.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <img
                            src={resolveImageUrl(g.image_url)}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                            style={{ border: "1px solid var(--border)" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        </td>
                        <td>
                          <div className="max-w-xs">
                            <div
                              className="text-[13px] font-medium truncate"
                              style={{ color: "var(--text)" }}
                            >
                              {g.caption}
                            </div>
                            <div
                              className="text-[11px] truncate"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {g.prompt}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {g.creator_name}
                        </td>
                        <td>
                          <Badge
                            variant={
                              g.vote_count > 0
                                ? "success"
                                : g.vote_count < 0
                                  ? "danger"
                                  : "muted"
                            }
                          >
                            {g.vote_count > 0 ? "+" : ""}
                            {g.vote_count}
                          </Badge>
                        </td>
                        <td>
                          {g.remix_of ? (
                            <Badge variant="warning">Remix</Badge>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {new Date(g.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            onClick={() => setDeleteConfirm(`gen_${g.id}`)}
                            className="p-1.5 rounded"
                            style={{ color: "var(--danger)" }}
                            title="Delete generation"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}

      {/* Create/Edit Modal */}
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
          >
            <div
              className="card w-full max-w-md max-h-[90dvh] overflow-y-auto p-6 space-y-4"
              style={{ background: "var(--bg-card)" }}
              role="dialog"
              aria-modal="true"
              aria-label={editingImage ? "Edit Image" : "Add Image"}
            >
              <div className="flex items-center justify-between">
                <h2
                  className="text-[16px] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {editingImage ? "Edit Image" : "Add Image"}
                </h2>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <ImageUploader
                  compact
                  onUploaded={({ url }) =>
                    setForm((f) => ({ ...f, image_url: url }))
                  }
                />

                <div>
                  <label
                    className="block text-[12px] font-medium mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Image URL
                  </label>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) =>
                      setForm({ ...form, image_url: e.target.value })
                    }
                    placeholder="https://… or /reactions/…"
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[12px] font-medium mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Blank Stare"
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-[12px] font-medium mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Tags (comma-separated)
                    <button
                      type="button"
                      onClick={autoTag}
                      disabled={tagging || !form.image_url}
                      className="ml-2 inline-flex items-center gap-1 disabled:opacity-40"
                      style={{ color: "var(--accent)" }}
                    >
                      {tagging ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Sparkles size={11} />
                      )}
                      Auto-tag with AI
                    </button>
                  </label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="reaction, nyc, deadpan"
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                {form.image_url && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <img
                      src={resolveImageUrl(form.image_url)}
                      alt="preview"
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={saving || !form.title || !form.image_url}
                  onClick={handleSave}
                >
                  <Save size={13} />
                  {saving
                    ? "Saving…"
                    : editingImage
                      ? "Save Changes"
                      : "Create Image"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete confirm */}

      {/* Delete confirm */}
      {deleteConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setDeleteConfirm(null);
                setForceDelete(false);
              }
            }}
          >
            <div
              className="card w-full max-w-sm max-h-[90dvh] overflow-y-auto p-6 space-y-4"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm Delete"
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: "var(--text)" }}
              >
                Confirm Delete
              </h2>

              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                This action is permanent and cannot be undone.
              </p>

              {(() => {
                const img = images.find((i) => i.id === deleteConfirm);

                return img && img.generation_count > 0 ? (
                  <label
                    className="flex items-start gap-2 text-[12px]"
                    style={{ color: "var(--danger)" }}
                  >
                    <input
                      type="checkbox"
                      checked={forceDelete}
                      onChange={(e) => setForceDelete(e.target.checked)}
                      className="mt-0.5"
                    />
                    Also delete the {img.generation_count} post(s) built on this
                    image (and their votes)
                  </label>
                ) : null;
              })()}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setDeleteConfirm(null);
                    setForceDelete(false);
                  }}
                >
                  Cancel
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    if (deleteConfirm.startsWith("gen_")) {
                      handleDeleteGeneration(deleteConfirm.replace("gen_", ""));
                    } else {
                      handleDeleteImage(deleteConfirm);
                    }
                  }}
                >
                  <Trash2 size={13} />
                  Delete
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
