import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DomainError } from "../domain/operations";
import type { Database } from "../domain/types";
import { LocalStorageAdapter, MemoryStorage, type StorageAdapter } from "../storage/adapter";
import { useToast } from "../components/Toast";

function defaultAdapter(): StorageAdapter {
  try {
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return new LocalStorageAdapter(window.localStorage);
  } catch {
    return new LocalStorageAdapter(new MemoryStorage());
  }
}

interface StoreValue {
  db: Database;
  /**
   * Aplica uma operação ao banco e grava imediatamente no aparelho.
   * Retorna o resultado da operação, ou undefined se ela foi recusada (o motivo vira aviso).
   */
  run<T>(op: (db: Database) => { db: Database; value: T }): T | undefined;
  apply(op: (db: Database) => Database): boolean;
  replaceAll(db: Database): void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, adapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const adapterRef = useRef<StorageAdapter>(adapter ?? defaultAdapter());
  const [db, setDb] = useState<Database>(() => adapterRef.current.load());
  const dbRef = useRef(db);
  const toast = useToast();

  const commit = useCallback(
    (next: Database) => {
      try {
        adapterRef.current.save(next);
      } catch {
        toast.show("Não foi possível salvar no aparelho. Verifique o espaço disponível.", "error");
      }
      dbRef.current = next;
      setDb(next);
    },
    [toast],
  );

  const run = useCallback(
    <T,>(op: (db: Database) => { db: Database; value: T }): T | undefined => {
      try {
        const { db: next, value } = op(dbRef.current);
        commit(next);
        return value;
      } catch (e) {
        if (e instanceof DomainError) toast.show(e.message, "error");
        else {
          console.error(e);
          toast.show("Algo deu errado. Os dados anteriores foram mantidos.", "error");
        }
        return undefined;
      }
    },
    [commit, toast],
  );

  const apply = useCallback(
    (op: (db: Database) => Database) => run((d) => ({ db: op(d), value: true })) === true,
    [run],
  );

  // Outra aba do navegador alterou os dados: recarrega para não sobrescrever.
  useEffect(() => {
    const onStorage = () => {
      const fresh = adapterRef.current.load();
      dbRef.current = fresh;
      setDb(fresh);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = db.settings.theme;
    document.title = db.settings.appName;
  }, [db.settings.theme, db.settings.appName]);

  const value = useMemo(() => ({ db, run, apply, replaceAll: commit }), [db, run, apply, commit]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore fora do StoreProvider");
  return ctx;
}

export function useNameOf() {
  const { db } = useStore();
  return useCallback(
    (id: string | null) => (id ? db.players.find((p) => p.id === id)?.name ?? "Jogador removido" : "—"),
    [db.players],
  );
}
