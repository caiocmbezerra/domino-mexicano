/**
 * Placar compartilhado (turma): um celular anota, os outros acompanham ao vivo.
 * Aqui ficam as regras puras (espaço ativo, o que é do aparelho, como juntar versões)
 * e o cliente da função api/turma.ts.
 */
import { TURMA_URL } from "../config";
import type { Database } from "../domain/types";
import { migrate } from "../storage/adapter";

/** Em qual conjunto de dados o app está trabalhando neste aparelho. */
export type Espaco =
  | { tipo: "local" }
  | { tipo: "turma"; id: string; papel: "anotador"; chave: string }
  | { tipo: "turma"; id: string; papel: "espectador" };

export type StatusSync = "local" | "sincronizado" | "enviando" | "ao-vivo" | "sem-conexao";

/** Preferências que são de cada aparelho e nunca vêm da turma. */
const PREFS_DO_APARELHO = ["theme", "photoCount", "sheetOrder"] as const;

/** Versão recebida da turma + preferências deste aparelho. */
export function mesclarRemoto(local: Database, remoto: unknown): Database {
  const r = migrate(remoto);
  const settings = { ...r.settings };
  for (const k of PREFS_DO_APARELHO) (settings as Record<string, unknown>)[k] = local.settings[k];
  return { ...r, settings };
}

/** O que vai para a turma: tudo menos as preferências do aparelho. */
export function paraEnviar(db: Database): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...db.settings };
  for (const k of PREFS_DO_APARELHO) delete settings[k];
  return { ...db, settings };
}

/**
 * Conflito: outra gravação passou na frente. Refaz, sobre a versão atual da turma, as
 * ações deste aparelho que ainda não tinham sido gravadas. Ações que já não fazem
 * sentido (ex.: a rodada foi apagada) são descartadas, sem derrubar as demais.
 */
export function reaplicar(
  base: Database,
  pendentes: ((db: Database) => Database)[],
): { db: Database; descartadas: number } {
  let db = base;
  let descartadas = 0;
  for (const op of pendentes) {
    try {
      db = op(db);
    } catch {
      descartadas++;
    }
  }
  return { db, descartadas };
}

export const CODIGO_TURMA = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/** O código não usa 0, 1, O, I nem L (para não confundir): basta maiúsculas, sem espaços e traços. */
export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 8);
}

/** Endereço que abre o app já acompanhando a turma. */
export function linkAcompanhar(appUrl: string, id: string) {
  return `${appUrl}#/entrar/${id}`;
}

/** Endereço que transforma outro celular em anotador (contém a chave: entregue só a quem vai anotar). */
export function linkAnotar(appUrl: string, id: string, chave: string) {
  return `${appUrl}#/anotar/${id}/${chave}`;
}

// ---------------------------------------------------------------- Cliente da função

export class ErroTurma extends Error {
  constructor(
    message: string,
    public status: number,
    public corpo?: { versao?: number; dados?: unknown },
  ) {
    super(message);
  }
}

/** Tempo máximo de cada pedido: com sinal fraco, melhor desistir e tentar de novo do que ficar parado. */
const TEMPO_MAXIMO = 12000;

async function pedir(method: string, query: string, body?: unknown, sinal?: AbortSignal) {
  let res: Response;
  const limite = new AbortController();
  const timer = setTimeout(() => limite.abort(), TEMPO_MAXIMO);
  const cancelar = () => limite.abort();
  sinal?.addEventListener("abort", cancelar);
  try {
    res = await fetch(`${TURMA_URL}${query}`, {
      method,
      signal: limite.signal,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (sinal?.aborted) throw e; // cancelado por quem pediu (ex.: saiu da tela)
    throw new ErroTurma("Sem conexão com a internet.", 0);
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener("abort", cancelar);
  }
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new ErroTurma(corpo?.erro ?? `Erro ${res.status} no placar compartilhado.`, res.status, corpo ?? undefined);
  return corpo;
}

export async function criarTurmaRemota(db: Database): Promise<{ id: string; chave: string; versao: number }> {
  return pedir("POST", "", { dados: paraEnviar(db) });
}

export async function lerTurmaRemota(id: string, desde?: number, sinal?: AbortSignal): Promise<{ versao: number; dados?: unknown; inalterado?: boolean }> {
  return pedir("GET", `?id=${encodeURIComponent(id)}${desde ? `&desde=${desde}` : ""}`, undefined, sinal);
}

export async function gravarTurmaRemota(id: string, chave: string, versaoBase: number, db: Database): Promise<{ versao: number }> {
  return pedir("PUT", "", { id, chave, versaoBase, dados: paraEnviar(db) });
}
