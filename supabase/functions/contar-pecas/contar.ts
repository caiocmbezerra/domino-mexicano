// Chamada à API da Claude para contar as peças de uma foto. Usada pela função do servidor
// (index.ts) e pelo teste com fotos reais (testar-fotos.ts), para os dois rodarem o mesmo código.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import { INSTRUCOES, type ResultadoContagem, TIPOS_ACEITOS, processarResposta } from "./contagem.ts";

export { Anthropic };

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
