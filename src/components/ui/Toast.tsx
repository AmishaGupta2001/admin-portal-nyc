"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
interface ToastItem { id: number; kind: Kind; message: string }
const ToastCtx = createContext<{ toast: (kind: Kind, message: string) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = (id: number) => setItems((l) => l.filter((t) => t.id !== id));
  const toast = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  }, []);

  const color = { success: "var(--success)", error: "var(--danger)", info: "var(--accent)" };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className="card fade-in flex items-start gap-2.5 p-3 shadow-lg" style={{ borderColor: color[t.kind] }}>
              <I size={16} style={{ color: color[t.kind], marginTop: 1 }} className="flex-shrink-0" />
              <p className="text-[13px] flex-1 break-words" style={{ color: "var(--text)" }}>{t.message}</p>
              <button onClick={() => dismiss(t.id)} style={{ color: "var(--text-muted)" }} aria-label="Dismiss"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const { toast } = useContext(ToastCtx);
  return {
    success: (m: string) => toast("success", m),
    error: (m: string) => toast("error", m),
    info: (m: string) => toast("info", m),
  };
}
