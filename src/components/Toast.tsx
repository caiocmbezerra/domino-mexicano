import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Kind = "info" | "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}
interface ToastApi {
  show(message: string, kind?: Kind): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: Kind = "info") => {
    const id = ++seq.current;
    setItems([{ id, message, kind }]); // só o aviso mais recente
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === "error" ? 4500 : 2500);
  }, []);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-area" aria-live="polite" role="status">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind} animate-pop`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return ctx;
}
