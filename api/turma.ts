/**
 * Função da Vercel: guarda a turma compartilhada (jogadores, partidas e histórico).
 *
 * - Um celular ANOTA (tem a chave de anotador) e os outros ACOMPANHAM (só com o código).
 * - O documento da turma tem uma versão. Quem grava informa a versão em que se baseou;
 *   se outra gravação passou na frente, recebe 409 com a versão atual para juntar e tentar de novo.
 * - Armazenamento: Redis da Upstash (integração da Vercel), pela API REST. Variáveis:
 *   KV_REST_API_URL e KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN).
 * - Arquivo único de propósito, como api/contar-pecas.ts.
 */
import { createHash, randomBytes } from "node:crypto";

// ---------------------------------------------------------------- Regras (sem dependências)

/** Código da turma: 8 caracteres sem os que se confundem (0/O, 1/I/L). */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODIGO_VALIDO = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
/** Tamanho máximo do documento (abaixo do limite de 1 MB por comando da Upstash). */
export const MAX_DOC = 900_000;

export function novoCodigo(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function novaChave(): string {
  return randomBytes(24).toString("base64url");
}

export function hashChave(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

/** Confere a forma mínima do banco do app antes de guardar (não interpreta o conteúdo). */
export function documentoValido(dados: unknown): dados is Record<string, unknown> {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return false;
  const d = dados as Record<string, unknown>;
  return ["players", "matches", "rounds", "results"].every((k) => Array.isArray(d[k]));
}

// ---------------------------------------------------------------- Redis (Upstash REST)

export interface Redis {
  cmd(...args: (string | number)[]): Promise<unknown>;
}

export function redisDoAmbiente(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return {
    async cmd(...args) {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args.map(String)),
      });
      const corpo = (await res.json().catch(() => null)) as { result?: unknown; error?: string } | null;
      if (!res.ok || !corpo || corpo.error) throw new Error(`Redis: ${corpo?.error ?? res.status}`);
      return corpo.result;
    },
  };
}

const chaves = (id: string) => [`turma:${id}:versao`, `turma:${id}:dados`, `turma:${id}:chave`];

// Scripts atômicos (rodam inteiros dentro do Redis).
const LUA_CRIAR = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[3], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[1], 1)
return 1`;
const LUA_GRAVAR = `
local chave = redis.call('GET', KEYS[3])
if not chave then return -3 end
if chave ~= ARGV[1] then return -2 end
local atual = tonumber(redis.call('GET', KEYS[1]) or '0')
if atual ~= tonumber(ARGV[2]) then return -1 end
redis.call('SET', KEYS[2], ARGV[3])
return redis.call('INCR', KEYS[1])`;
const LUA_LER = `
local v = redis.call('GET', KEYS[1])
if not v then return nil end
if v == ARGV[1] then return {v} end
return {v, redis.call('GET', KEYS[2])}`;

export async function criarTurma(redis: Redis, dados: string): Promise<{ id: string; chave: string; versao: number }> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const id = novoCodigo();
    const chave = novaChave();
    const ok = await redis.cmd("EVAL", LUA_CRIAR, 3, ...chaves(id), hashChave(chave), dados);
    if (Number(ok) === 1) return { id, chave, versao: 1 };
  }
  throw new Error("Não foi possível gerar um código de turma livre.");
}

export async function lerTurma(
  redis: Redis,
  id: string,
  desde?: number,
): Promise<null | { versao: number; dados?: unknown }> {
  const r = (await redis.cmd("EVAL", LUA_LER, 3, ...chaves(id), desde ?? "")) as string[] | null;
  if (!r) return null;
  const versao = Number(r[0]);
  return r.length > 1 ? { versao, dados: JSON.parse(r[1]) } : { versao };
}

export type ResultadoGravar =
  | { ok: true; versao: number }
  | { ok: false; motivo: "conflito" | "chave" | "inexistente" };

export async function gravarTurma(
  redis: Redis,
  id: string,
  chave: string,
  versaoBase: number,
  dados: string,
): Promise<ResultadoGravar> {
  const r = Number(await redis.cmd("EVAL", LUA_GRAVAR, 3, ...chaves(id), hashChave(chave), versaoBase, dados));
  if (r === -1) return { ok: false, motivo: "conflito" };
  if (r === -2) return { ok: false, motivo: "chave" };
  if (r === -3) return { ok: false, motivo: "inexistente" };
  return { ok: true, versao: r };
}

// ---------------------------------------------------------------- HTTP

/** Mesmas origens permitidas da contagem por foto (ver api/contar-pecas.ts). */
function origemPermitida(origem: string | null, host: string | null): string | null {
  if (!origem) return null;
  const extras = (process.env.ORIGENS_PERMITIDAS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const lista = ["https://caiocmbezerra.github.io", "https://localhost", "capacitor://localhost", ...extras];
  if (host) lista.push(`https://${host}`);
  return lista.includes(origem) ? origem : null;
}

function cabecalhos(req: Request): Record<string, string> {
  const origem = origemPermitida(req.headers.get("origin"), req.headers.get("host"));
  return {
    ...(origem ? { "Access-Control-Allow-Origin": origem, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function resposta(req: Request, status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhos(req), "Content-Type": "application/json" },
  });
}

/** Permite trocar o Redis nos testes. */
let redisFabrica: () => Redis | null = redisDoAmbiente;
export function usarRedis(f: () => Redis | null) {
  redisFabrica = f;
}

async function preparar(req: Request): Promise<Response | Redis> {
  if (req.headers.get("origin") && !origemPermitida(req.headers.get("origin"), req.headers.get("host")))
    return resposta(req, 403, { erro: "Origem não permitida." });
  const redis = redisFabrica();
  if (!redis) return resposta(req, 503, { erro: "Placar compartilhado não configurado no servidor (falta o banco de dados)." });
  return redis;
}

async function lerCorpo(req: Request): Promise<Record<string, unknown> | null> {
  const texto = await req.text();
  if (texto.length > MAX_DOC + 2000) return null;
  try {
    const corpo = JSON.parse(texto);
    return corpo && typeof corpo === "object" ? corpo : null;
  } catch {
    return null;
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cabecalhos(req) });
}

/** Acompanhar: GET /api/turma?id=CODIGO&desde=VERSAO */
export async function GET(req: Request) {
  const redis = await preparar(req);
  if (redis instanceof Response) return redis;
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").toUpperCase();
  if (!CODIGO_VALIDO.test(id)) return resposta(req, 400, { erro: "Código de turma inválido." });
  const desde = url.searchParams.get("desde");
  try {
    const t = await lerTurma(redis, id, desde ? Number(desde) : undefined);
    if (!t) return resposta(req, 404, { erro: "Turma não encontrada. Confira o código." });
    return resposta(req, 200, t.dados === undefined ? { versao: t.versao, inalterado: true } : t);
  } catch (e) {
    console.error(e);
    return resposta(req, 502, { erro: "Falha ao ler a turma. Tente de novo." });
  }
}

/** Compartilhar (criar): POST /api/turma { dados } → { id, chave, versao } */
export async function POST(req: Request) {
  const redis = await preparar(req);
  if (redis instanceof Response) return redis;
  const corpo = await lerCorpo(req);
  if (!corpo || !documentoValido(corpo.dados)) return resposta(req, 400, { erro: "Dados da turma inválidos." });
  const texto = JSON.stringify(corpo.dados);
  if (texto.length > MAX_DOC) return resposta(req, 413, { erro: "Turma grande demais para compartilhar." });
  try {
    return resposta(req, 201, await criarTurma(redis, texto));
  } catch (e) {
    console.error(e);
    return resposta(req, 502, { erro: "Não foi possível criar a turma. Tente de novo." });
  }
}

/** Anotar (gravar): PUT /api/turma { id, chave, versaoBase, dados } */
export async function PUT(req: Request) {
  const redis = await preparar(req);
  if (redis instanceof Response) return redis;
  const corpo = await lerCorpo(req);
  const id = String(corpo?.id ?? "").toUpperCase();
  const chave = String(corpo?.chave ?? "");
  const versaoBase = Number(corpo?.versaoBase);
  if (!corpo || !CODIGO_VALIDO.test(id) || !chave || !Number.isInteger(versaoBase) || !documentoValido(corpo.dados))
    return resposta(req, 400, { erro: "Pedido de gravação inválido." });
  const texto = JSON.stringify(corpo.dados);
  if (texto.length > MAX_DOC) return resposta(req, 413, { erro: "Turma grande demais para compartilhar." });
  try {
    const r = await gravarTurma(redis, id, chave, versaoBase, texto);
    if (r.ok) return resposta(req, 200, { versao: r.versao });
    if (r.motivo === "inexistente") return resposta(req, 404, { erro: "Turma não encontrada." });
    if (r.motivo === "chave") return resposta(req, 403, { erro: "Este celular não é o anotador desta turma." });
    // Conflito: devolve a versão atual para o app juntar as mudanças e tentar de novo.
    const atual = await lerTurma(redis, id);
    return resposta(req, 409, { erro: "Outra gravação passou na frente.", ...atual });
  } catch (e) {
    console.error(e);
    return resposta(req, 502, { erro: "Falha ao gravar a turma. Tente de novo." });
  }
}
