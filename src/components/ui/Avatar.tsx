export function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size / 2.8) };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={style} className="rounded-full object-cover flex-shrink-0" />
  ) : (
    <div style={{ ...style, background: "var(--accent)", color: "var(--accent-fg)" }} className="rounded-full flex items-center justify-center font-bold flex-shrink-0">
      {(name[0] ?? "?").toUpperCase()}
    </div>
  );
}
