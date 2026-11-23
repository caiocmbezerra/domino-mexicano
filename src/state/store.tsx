import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { APP_CONFIG } from "../config";
import { DomainError } from "../domain/operations";
import type { Database } from "../domain/types";
import { LocalStorageAdapter, MemoryStorage, type KeyValueStorage } from "../storage/adapter";
import { useToast } from "../components/Toast";
import {
  criarTurmaRemota,
  ErroTurma,
  gravarTurmaRemota,
  lerTurmaRemota,
  mesclarRemoto,
  reaplicar,
  type Espaco,
  type StatusSync,
} from "../sync/turma";

function armazenamentoDoAparelho(): KeyValueStorage & { removeItem?(k: string): void } {
  try {
    const probe = "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

const CHAVE_ESPACO = `${APP_CONFIG.storageKey}:espaco`;
const chaveTurma = (id: string) => `${APP_CONFIG.storageKey}:turma:${id}`;
const chaveMeta = (id: string) => `${APP_CONFIG.storageKey}:turma:${id}:meta`;

interface MetaTurma {
  versao: number;
  /** Há mudanças deste aparelho ainda não gravadas na turma. */
  pendente: boolean;
}

/** Intervalos de atualização (ms). */
const ESPIAR_ESPECTADOR = 4000;
const ESPIAR_ANOTADOR = 20000;
const REENVIAR_OFFLINE = 5000;

interface StoreValue {
  db: Database;
  /**
   * Aplica uma operação ao banco e grava imediatamente no aparelho (e na turma, se for o anotador).
   * Retorna o resultado da operação, ou undefined se ela foi recusada (o motivo vira aviso).
   */
  run<T>(op: (db: Database) => { db: Database; value: T }): T | undefined;
  apply(op: (db: Database) => Database): boolean;
  /** Preferência só deste aparelho (tema, câmera, ordem da planilha): vale também para quem só acompanha. */
  applyDevice(op: (db: Database) => Database): boolean;
  replaceAll(db: Database): void;

  espaco: Espaco;
  /** Este aparelho só acompanha a turma: nada de lançar ou alterar. */
  somenteLeitura: boolean;
  status: StatusSync;
  compartilharTurma(): Promise<boolean>;
  entrarNaTurma(id: string): Promise<boolean>;
  anotarTurma(id: string, chave: string): Promise<boolean>;
  sairDaTurma(): void;
}

const StoreContext = createContext<StoreValue | null>(null);

function lerEspaco(kv: KeyValueStorage): Espaco {
  try {
    const e = JSON.parse(kv.getItem(CHAVE_ESPACO) ?? "null");
    if (e?.tipo === "turma" && typeof e.id === "string") {
      if (e.papel === "anotador" && typeof e.chave === "string") return e;
      if (e.papel === "espectador") return { tipo: "turma", id: e.id, papel: "espectador" };
    }
  } catch {
    /* ignora */
  }
  return { tipo: "local" };
}

function lerMeta(kv: KeyValueStorage, id: string): MetaTurma {
  try {
    const m = JSON.parse(kv.getItem(chaveMeta(id)) ?? "null");
    if (m && Number.isInteger(m.versao)) return { versao: m.versao, pendente: Boolean(m.pendente) };
  } catch {
    /* ignora */
  }
  return { versao: 0, pendente: false };
}

export function StoreProvider({ children, storage }: { children: ReactNode; storage?: KeyValueStorage }) {
  const kv = useRef(storage ?? armazenamentoDoAparelho()).current;
  const toast = useToast();

  const [espaco, setEspaco] = useState<Espaco>(() => lerEspaco(kv));
  const espacoRef = useRef(espaco);
  const adapterDe = (e: Espaco) => new LocalStorageAdapter(kv, e.tipo === "turma" ? chaveTurma(e.id) : APP_CONFIG.storageKey);
  const adapterRef = useRef(adapterDe(espaco));
  const [db, setDb] = useState<Database>(() => adapterRef.current.load());
  const dbRef = useRef(db);
  const metaRef = useRef<MetaTurma>(espaco.tipo === "turma" ? lerMeta(kv, espaco.id) : { versao: 0, pendente: false });
  const [status, setStatus] = useState<StatusSync>(espaco.tipo === "local" ? "local" : "sincronizado");

  /** Ações do anotador ainda não confirmadas pela turma (para refazer num conflito). */
  const pendentesRef = useRef<((db: Database) => Database)[]>([]);
  const envioRef = useRef<{ timer?: number; emAndamento: boolean }>({ emAndamento: false });

  const salvarMeta = useCallback(
    (m: MetaTurma) => {
      metaRef.current = m;
      const e = espacoRef.current;
      if (e.tipo === "turma") kv.setItem(chaveMeta(e.id), JSON.stringify(m));
    },
    [kv],
  );

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

  const trocarEspaco = useCallback(
    (e: Espaco, dados?: Database, meta?: MetaTurma) => {
      espacoRef.current = e;
      kv.setItem(CHAVE_ESPACO, JSON.stringify(e));
      adapterRef.current = adapterDe(e);
      pendentesRef.current = [];
      if (meta) salvarMeta(meta);
      else metaRef.current = e.tipo === "turma" ? lerMeta(kv, e.id) : { versao: 0, pendente: false };
      if (dados) adapterRef.current.save(dados);
      const carregado = adapterRef.current.load();
      dbRef.current = carregado;
      setDb(carregado);
      setEspaco(e);
      setStatus(e.tipo === "local" ? "local" : "sincronizado");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kv, salvarMeta],
  );

  // ------------------------------------------------------------ Envio (anotador)

  const enviar = useCallback(async () => {
    const e = espacoRef.current;
    if (e.tipo !== "turma" || e.papel !== "anotador") return;
    const estado = envioRef.current;
    if (estado.emAndamento || !metaRef.current.pendente) return;
    estado.emAndamento = true;
    window.clearTimeout(estado.timer);
    setStatus("enviando");
    let repetir = false;
    const enviadas = pendentesRef.current.length;
    try {
      const r = await gravarTurmaRemota(e.id, e.chave, metaRef.current.versao, dbRef.current);
      if (espacoRef.current !== e) return;
      pendentesRef.current = pendentesRef.current.slice(enviadas);
      salvarMeta({ versao: r.versao, pendente: pendentesRef.current.length > 0 });
      repetir = metaRef.current.pendente; // chegaram ações novas durante o envio
      if (!repetir) setStatus("sincronizado");
    } catch (err) {
      if (espacoRef.current !== e) return;
      if (err instanceof ErroTurma && err.status === 409 && err.corpo?.versao) {
        // Outra gravação passou na frente: refaz as ações deste aparelho sobre a versão atual e reenvia.
        const semFila = pendentesRef.current.length === 0;
        const base = mesclarRemoto(dbRef.current, err.corpo.dados);
        const { db: juntado, descartadas } = reaplicar(base, pendentesRef.current);
        commit(juntado);
        salvarMeta({ versao: err.corpo.versao, pendente: !semFila });
        if (semFila) toast.show("A turma mudou em outro celular; este aparelho foi atualizado com a versão da turma.", "info");
        else if (descartadas) toast.show("Algumas alterações não cabiam mais na versão atual da turma e foram descartadas.", "error");
        repetir = !semFila;
      } else if (err instanceof ErroTurma && err.status === 403) {
        toast.show("Outro celular passou a anotar esta turma. Este agora só acompanha.", "error");
        trocarEspaco({ tipo: "turma", id: e.id, papel: "espectador" }, undefined, { versao: 0, pendente: false });
      } else {
        setStatus("sem-conexao");
        estado.timer = window.setTimeout(() => void enviar(), REENVIAR_OFFLINE);
      }
    } finally {
      estado.emAndamento = false;
    }
    if (repetir) void enviar();
  }, [commit, salvarMeta, toast, trocarEspaco]);

  const agendarEnvio = useCallback(() => {
    window.clearTimeout(envioRef.current.timer);
    envioRef.current.timer = window.setTimeout(() => void enviar(), 400);
  }, [enviar]);

  // ------------------------------------------------------------ Aplicar operações

  const run = useCallback(
    <T,>(op: (db: Database) => { db: Database; value: T }): T | undefined => {
      const e = espacoRef.current;
      if (e.tipo === "turma" && e.papel === "espectador") {
        toast.show("Você está acompanhando a turma: só o celular que anota pode alterar.", "error");
        return undefined;
      }
      try {
        const { db: next, value } = op(dbRef.current);
        commit(next);
        if (e.tipo === "turma") {
          pendentesRef.current.push((d) => op(d).db);
          salvarMeta({ ...metaRef.current, pendente: true });
          agendarEnvio();
        }
        return value;
      } catch (err) {
        if (err instanceof DomainError) toast.show(err.message, "error");
        else {
          console.error(err);
          toast.show("Algo deu errado. Os dados anteriores foram mantidos.", "error");
        }
        return undefined;
      }
    },
    [agendarEnvio, commit, salvarMeta, toast],
  );

  const apply = useCallback(
    (op: (db: Database) => Database) => run((d) => ({ db: op(d), value: true })) === true,
    [run],
  );

  const applyDevice = useCallback(
    (op: (db: Database) => Database) => {
      try {
        commit(op(dbRef.current));
        return true;
      } catch (err) {
        if (err instanceof DomainError) toast.show(err.message, "error");
        return false;
      }
    },
    [commit, toast],
  );

  // ------------------------------------------------------------ Receber (espectador e anotador)

  useEffect(() => {
    if (espaco.tipo !== "turma") return;
    let parado = false;
    let timer: number | undefined;
    const controle = new AbortController();
    const intervalo = espaco.papel === "espectador" ? ESPIAR_ESPECTADOR : ESPIAR_ANOTADOR;

    const espiar = async () => {
      if (parado) return;
      // O anotador não puxa por cima do que ainda não enviou.
      const podeLer = espaco.papel === "espectador" || !metaRef.current.pendente;
      if (podeLer && document.visibilityState !== "hidden") {
        try {
          const r = await lerTurmaRemota(espaco.id, metaRef.current.versao || undefined, controle.signal);
          if (!parado && !r.inalterado && r.dados && (espaco.papel === "espectador" || !metaRef.current.pendente)) {
            commit(mesclarRemoto(dbRef.current, r.dados));
            salvarMeta({ versao: r.versao, pendente: false });
          }
          if (!parado) setStatus(espaco.papel === "espectador" ? "ao-vivo" : metaRef.current.pendente ? "enviando" : "sincronizado");
        } catch (err) {
          if ((err as Error).name === "AbortError" || parado) return;
          if (err instanceof ErroTurma && err.status === 404) {
            toast.show("Esta turma não existe mais no servidor.", "error");
          } else setStatus("sem-conexao");
        }
      }
      if (!parado) timer = window.setTimeout(espiar, intervalo);
    };
    void espiar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        void espiar();
      }
    };
    const aoReconectar = () => {
      if (espaco.papel === "anotador") void enviar();
      aoVoltar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoReconectar);
    // Mudanças que ficaram por enviar de uma sessão anterior.
    if (espaco.papel === "anotador" && metaRef.current.pendente) void enviar();
    return () => {
      parado = true;
      controle.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoReconectar);
    };
  }, [espaco, commit, enviar, salvarMeta, toast]);

  // ------------------------------------------------------------ Entrar e sair da turma

  const compartilharTurma = useCallback(async () => {
    try {
      const atual = dbRef.current;
      const r = await criarTurmaRemota(atual);
      trocarEspaco({ tipo: "turma", id: r.id, papel: "anotador", chave: r.chave }, atual, { versao: r.versao, pendente: false });
      return true;
    } catch (err) {
      toast.show((err as Error).message, "error");
      return false;
    }
  }, [toast, trocarEspaco]);

  const entrarComo = useCallback(
    async (e: Espaco & { tipo: "turma" }) => {
      try {
        const r = await lerTurmaRemota(e.id);
        trocarEspaco(e, mesclarRemoto(dbRef.current, r.dados), { versao: r.versao, pendente: false });
        return true;
      } catch (err) {
        toast.show((err as Error).message, "error");
        return false;
      }
    },
    [toast, trocarEspaco],
  );

  const entrarNaTurma = useCallback((id: string) => entrarComo({ tipo: "turma", id, papel: "espectador" }), [entrarComo]);
  const anotarTurma = useCallback(
    (id: string, chave: string) => entrarComo({ tipo: "turma", id, papel: "anotador", chave }),
    [entrarComo],
  );
  const sairDaTurma = useCallback(() => trocarEspaco({ tipo: "local" }), [trocarEspaco]);

  // ------------------------------------------------------------ Outras abas e tema

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

  const somenteLeitura = espaco.tipo === "turma" && espaco.papel === "espectador";
  const value = useMemo(
    () => ({
      db,
      run,
      apply,
      applyDevice,
      replaceAll: commit,
      espaco,
      somenteLeitura,
      status,
      compartilharTurma,
      entrarNaTurma,
      anotarTurma,
      sairDaTurma,
    }),
    [db, run, apply, applyDevice, commit, espaco, somenteLeitura, status, compartilharTurma, entrarNaTurma, anotarTurma, sairDaTurma],
  );
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
