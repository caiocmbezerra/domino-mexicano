/**
 * Função da Vercel: conta as pedras de dominó numa foto usando a API da Claude.
 *
 * - A chave fica só no servidor (variável de ambiente ANTHROPIC_API_KEY na Vercel), nunca no app.
 * - A IA só LISTA as peças; a soma e a validação (0–12, 0-0) são feitas aqui, no código.
 * - Arquivo único de propósito: a Vercel não precisa resolver importações entre arquivos.
 *   O app importa daqui só os tipos (apagados no build) e os testes usam processarResposta.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// ---------------------------------------------------------------- Regras (sem dependências)

export const MAIOR_VALOR = 12; // conjunto duplo-12

export type Confianca = "alta" | "baixa";

/** Formato que a IA devolve (validado pelo esquema de saída estruturada). */
export interface RespostaIA {
  foto_legivel: boolean;
  pecas: { lado_a: number; lado_b: number; confianca: string }[];
  pecas_ilegiveis: number;
  observacoes: string;
}

export interface Peca {
  a: number;
  b: number;
  confianca: Confianca;
}

export interface ResultadoContagem {
  fotoLegivel: boolean;
  pecas: Peca[];
  total: number;
  temZeroZero: boolean;
  /** Peças que a IA não conseguiu ler — o operador precisa conferir. */
  pecasIlegiveis: number;
  /** Peças descartadas por valores impossíveis (fora de 0–12). */
  descartadas: number;
  observacoes: string;
}

export const INSTRUCOES = `Você confere a pontuação de uma partida de Dominó Mexicano (conjunto duplo-12).

A foto mostra as peças que sobraram na mão de UM jogador ao fim da rodada, viradas para cima.
Cada peça tem duas metades, e cada metade tem de 0 a 12 pontos (pips). Em muitos conjuntos
duplo-12 cada valor tem uma cor própria, o que ajuda a distinguir 11 de 12, 8 de 9, etc.

Liste cada peça visível exatamente uma vez, na ordem em que aparecem (da esquerda para a
direita, de cima para baixo), com a quantidade de pontos de cada metade. Conte os pontos de
cada metade com cuidado; uma metade lisa vale 0.

- Use confianca "baixa" quando a contagem de alguma metade for duvidosa (borrão, reflexo,
  peça parcialmente coberta). Use "alta" só quando tiver certeza.
- Peças viradas para baixo ou impossíveis de ler não entram na lista: some-as em pecas_ilegiveis.
- Não some os pontos; apenas liste as peças.
- Se a foto não mostrar peças de dominó legíveis, responda foto_legivel = false e lista vazia.
- Em observacoes, escreva em português, numa frase curta, qualquer coisa que o operador
  deva conferir (ou deixe vazio).`;

/** Valida a resposta da IA e calcula o total. Nunca confia em valores fora de 0–12. */
export function processarResposta(r: RespostaIA): ResultadoContagem {
  const validos = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAIOR_VALOR;
  const pecas: Peca[] = [];
  let descartadas = 0;
  for (const p of r.pecas) {
    if (validos(p.lado_a) && validos(p.lado_b)) {
      pecas.push({ a: p.lado_a, b: p.lado_b, confianca: p.confianca === "alta" ? "alta" : "baixa" });
    } else descartadas++;
  }
  return {
    fotoLegivel: r.foto_legivel,
    pecas,
    total: somaPecas(pecas),
    temZeroZero: pecas.some((p) => p.a === 0 && p.b === 0),
    pecasIlegiveis: Math.max(0, Math.trunc(r.pecas_ilegiveis) || 0),
    descartadas,
    observacoes: r.observacoes.trim(),
  };
}

export function somaPecas(pecas: { a: number; b: number }[]): number {
  return pecas.reduce((s, p) => s + p.a + p.b, 0);
}

/** Limite do tamanho da imagem recebida (base64). O app já reduz a foto antes de enviar. */
export const MAX_BASE64 = 4_000_000; // abaixo do limite de 4,5 MB do corpo na Vercel
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

// ---------------------------------------------------------------- Chamada à IA

// Esquema da resposta. Faixas (0–12) e valores de confiança são conferidos em processarResposta,
// não aqui: o formato estruturado garante a forma do JSON, o código garante os valores.
const Saida = z.object({
  foto_legivel: z.boolean(),
  pecas: z.array(
    z.object({
      lado_a: z.number().describe("Pontos de uma metade, de 0 a 12"),
      lado_b: z.number().describe("Pontos da outra metade, de 0 a 12"),
      confianca: z.string().describe('"alta" ou "baixa"'),
    }),
  ),
  pecas_ilegiveis: z.number().describe("Quantidade de peças viradas ou impossíveis de ler"),
  observacoes: z.string(),
});

export type Contagem =
  | { ok: true; resultado: ResultadoContagem }
  | { ok: false; status: number; erro: string };

export async function contarPecasNaFoto(
  client: Anthropic,
  imagem: string,
  tipo: (typeof TIPOS_ACEITOS)[number],
): Promise<Contagem> {
  const msg = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Se a IA recusar por engano, a própria API refaz o pedido no modelo de reserva recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Contar pontinhos exige atenção: esforço alto (o padrão deste modelo é médio).
    output_config: { effort: "high", format: betaZodOutputFormat(Saida) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo, data: imagem } },
          { type: "text", text: INSTRUCOES },
        ],
      },
    ],
  });
  if (msg.stop_reason === "refusal") return { ok: false, status: 422, erro: "A IA não analisou esta foto. Conte manualmente." };
  if (!msg.parsed_output) return { ok: false, status: 502, erro: "A IA não devolveu uma contagem válida. Tente outra foto." };
  return { ok: true, resultado: processarResposta(msg.parsed_output) };
}

// ---------------------------------------------------------------- HTTP

/**
 * Sites que podem chamar a função pelo navegador: o app no GitHub Pages, o app Android
 * (Capacitor usa https://localhost) e o próprio domínio da Vercel. Outros podem ser
 * acrescentados na variável ORIGENS_PERMITIDAS, separados por vírgula.
 * Isso impede outros SITES de usarem a função; contra abuso fora do navegador, a proteção
 * real é o limite de gasto mensal configurado no Console da Anthropic.
 */
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function resposta(req: Request, status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhos(req), "Content-Type": "application/json" },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cabecalhos(req) });
}

export async function POST(req: Request) {
  if (req.headers.get("origin") && !origemPermitida(req.headers.get("origin"), req.headers.get("host")))
    return resposta(req, 403, { erro: "Origem não permitida." });
  if (!process.env.ANTHROPIC_API_KEY)
    return resposta(req, 503, { erro: "Contagem por foto não configurada no servidor (falta a chave da API)." });

  let imagem: string, tipo: string;
  try {
    const corpo = await req.json();
    imagem = String(corpo.imagem ?? "");
    tipo = String(corpo.tipo ?? "image/jpeg");
  } catch {
    return resposta(req, 400, { erro: "Corpo da requisição inválido." });
  }
  if (!imagem) return resposta(req, 400, { erro: "Envie a foto." });
  if (imagem.length > MAX_BASE64) return resposta(req, 413, { erro: "Foto grande demais." });
  if (!(TIPOS_ACEITOS as readonly string[]).includes(tipo)) return resposta(req, 415, { erro: "Formato de imagem não aceito." });

  try {
    const r = await contarPecasNaFoto(new Anthropic(), imagem, tipo as (typeof TIPOS_ACEITOS)[number]);
    return r.ok ? resposta(req, 200, r.resultado) : resposta(req, r.status, { erro: r.erro });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta(req, 429, { erro: "Muitas fotos seguidas. Aguarde um pouco." });
    if (e instanceof Anthropic.AuthenticationError) return resposta(req, 500, { erro: "Chave da API inválida no servidor." });
    if (e instanceof Anthropic.APIError) return resposta(req, 502, { erro: `Falha na IA (${e.status}). Tente de novo.` });
    console.error(e);
    return resposta(req, 500, { erro: "Erro inesperado ao contar as peças." });
  }
}
