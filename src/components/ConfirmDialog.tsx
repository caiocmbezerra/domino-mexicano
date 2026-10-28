import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Ask | null>(null);

/** Diálogo de confirmação para ações irreversíveis (substitui o window.confirm nativo). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const ask = useCallback<Ask>(
    (options) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  useEffect(() => {
    if (!state) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="modal animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-xl font-extrabold">
              {state.title}
            </h2>
            {state.message && <div className="mt-2 text-muted">{state.message}</div>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {state.cancelLabel ?? "Cancelar"}
              </button>
              <button
                ref={confirmRef}
                className={`btn ${state.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ask {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm fora do ConfirmProvider");
  return ctx;
}
