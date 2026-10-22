/**
 * Curated gallery images in the main app are often relative (/reactions/x.jpg)
 * and only exist on the main app's domain. Set NEXT_PUBLIC_MAIN_APP_URL so the
 * admin panel can display (and Gemini can fetch) them.
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${url.startsWith("/") ? "" : "/"}${url}` : url;
}
