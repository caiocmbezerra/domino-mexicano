import { APP_CONFIG } from "../config";
import { emptyDatabase } from "../domain/database";
import type { Database, TieBreaker } from "../domain/types";

/**
 * Camada de armazenamento. A implementação padrão grava no próprio aparelho
 * (localStorage), sem conta nem login. Para sincronizar entre aparelhos, basta
 * criar outra implementação desta interface (ex.: Supabase — ver supabase/schema.sql).
 */
export interface StorageAdapter {
  load(): Database;
  save(db: Database): void;
}

/** Subconjunto da Web Storage API — permite testes com um armazenamento em memória. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * O 0-0 deixou de ser critério de desempate (só marca zero na rodada). Partidas e ajustes
 * salvos com ele passam a desempatar por vitórias de rodada, sem repetir critérios.
 */
function migrarDesempate(lista: unknown): TieBreaker[] {
  const validos: TieBreaker[] = ["wins", "lowestMaxRound"];
  const saida: TieBreaker[] = [];
  for (const c of Array.isArray(lista) ? lista : []) {
    const novo = (c === "zeroDoubles" ? "wins" : c) as TieBreaker;
    if (validos.includes(novo) && !saida.includes(novo)) saida.push(novo);
  }
  return saida;
}

/** Garante a forma esperada do banco lido do armazenamento (dados antigos ou corrompidos). */
export function migrate(raw: unknown): Database {
  const base = emptyDatabase();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Database>;
  return {
    schemaVersion: 1,
    players: Array.isArray(r.players) ? r.players : [],
    matches: (Array.isArray(r.matches) ? r.matches : []).map((m) => ({
      ...m,
      settings: { ...m.settings, tieBreakers: migrarDesempate(m.settings?.tieBreakers) },
    })),
    rounds: Array.isArray(r.rounds) ? r.rounds : [],
    results: Array.isArray(r.results) ? r.results : [],
    settings: {
      ...base.settings,
      ...(r.settings ?? {}),
      defaultMatchSettings: {
        ...base.settings.defaultMatchSettings,
        ...(r.settings?.defaultMatchSettings ?? {}),
        tieBreakers: r.settings?.defaultMatchSettings
          ? migrarDesempate(r.settings.defaultMatchSettings.tieBreakers)
          : base.settings.defaultMatchSettings.tieBreakers,
      },
    },
  };
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private storage: KeyValueStorage,
    private key: string = APP_CONFIG.storageKey,
  ) {}

  load(): Database {
    const text = this.storage.getItem(this.key);
    if (!text) return emptyDatabase();
    try {
      return migrate(JSON.parse(text));
    } catch {
      // Preserva o conteúdo ilegível em outra chave em vez de perdê-lo silenciosamente.
      this.storage.setItem(`${this.key}:corrompido:${Date.now()}`, text);
      return emptyDatabase();
    }
  }

  save(db: Database): void {
    this.storage.setItem(this.key, JSON.stringify(db));
  }
}

/** Armazenamento em memória (testes e navegadores sem localStorage). */
export class MemoryStorage implements KeyValueStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}
