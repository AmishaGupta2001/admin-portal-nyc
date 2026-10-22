import { captionPrompt, TAG_PROMPT } from "./prompts";
import { resolveImageUrl } from "./url";

const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function assertPublicHttpUrl(raw: string) {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new GeminiError(400, "Only http(s) image URLs are allowed");
  const h = u.hostname;
  const isLocal = process.env.NODE_ENV !== "production" && (h === "localhost" || h === "127.0.0.1");
  if (!isLocal && (h === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.endsWith(".internal"))) {
    throw new GeminiError(400, "Private network URLs are not allowed");
  }
}

/** Fetch an image (absolute URL, or relative to the main app) and return base64 + mime. */
export async function loadImage(url: string): Promise<{ mime: string; data: string }> {
  const absolute = resolveImageUrl(url);
  if (!/^https?:/i.test(absolute)) {
    throw new GeminiError(400, "Relative image URL — set NEXT_PUBLIC_MAIN_APP_URL to your main app's origin.");
  }
  assertPublicHttpUrl(absolute);
  const res = await fetch(absolute, { cache: "no-store" });
  if (!res.ok) throw new GeminiError(400, `Could not fetch image (${res.status})`);
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED.includes(mime)) throw new GeminiError(400, `Unsupported image type: ${mime || "unknown"}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new GeminiError(400, "Image is larger than 12MB");
  return { mime, data: buf.toString("base64") };
}

async function callGemini(parts: unknown[]): Promise<any> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError(500, "GEMINI_API_KEY is not set on the admin server");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 1 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(res.status === 429 ? 429 : 502, json?.error?.message ?? `Gemini error ${res.status}`);
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (!text) throw new GeminiError(502, json?.promptFeedback?.blockReason ? `Blocked by Gemini: ${json.promptFeedback.blockReason}` : "Gemini returned no content");
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new GeminiError(502, "Gemini returned invalid JSON");
  }
}

export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 12);
}

export async function tagImage(url: string): Promise<{ title: string; tags: string[] }> {
  const img = await loadImage(url);
  const out = await callGemini([{ inline_data: { mime_type: img.mime, data: img.data } }, { text: TAG_PROMPT }]);
  return { title: String(out.title ?? "").trim().slice(0, 80), tags: cleanTags(out.tags) };
}

export async function generateCaptions(opts: {
  url: string;
  tags: string[];
  direction?: string;
  tone?: string;
  count?: number;
  avoid?: string[];
}): Promise<string[]> {
  const count = Math.min(Math.max(opts.count ?? 1, 1), 5);
  const img = await loadImage(opts.url);
  const out = await callGemini([
    { inline_data: { mime_type: img.mime, data: img.data } },
    { text: captionPrompt({ ...opts, count }) },
  ]);
  const caps: string[] = (Array.isArray(out.captions) ? out.captions : [])
    .map((c: unknown) => String(c).trim())
    .filter(Boolean);
  if (!caps.length) throw new GeminiError(502, "No captions returned");
  return caps.slice(0, count);
}

export async function ping(): Promise<string> {
  const out = await callGemini([{ text: 'Reply with JSON {"ok": true}' }]);
  return out?.ok ? "ok" : "unexpected response";
}
