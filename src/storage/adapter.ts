import { APP_CONFIG } from "../config";
import { emptyDatabase } from "../domain/database";
import type { Database } from "../domain/types";

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

/** Garante a forma esperada do banco lido do armazenamento (dados antigos ou corrompidos). */
export function migrate(raw: unknown): Database {
  const base = emptyDatabase();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Database>;
  return {
    schemaVersion: 1,
    players: Array.isArray(r.players) ? r.players : [],
    matches: Array.isArray(r.matches) ? r.matches : [],
    rounds: Array.isArray(r.rounds) ? r.rounds : [],
    results: Array.isArray(r.results) ? r.results : [],
    settings: {
      ...base.settings,
      ...(r.settings ?? {}),
      defaultMatchSettings: {
        ...base.settings.defaultMatchSettings,
        ...(r.settings?.defaultMatchSettings ?? {}),
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
