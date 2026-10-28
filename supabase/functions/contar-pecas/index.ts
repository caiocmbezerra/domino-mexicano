// Função do Supabase (Deno) que conta as peças de dominó numa foto usando a API da Claude.
// A chave da API fica só aqui, no servidor (segredo ANTHROPIC_API_KEY), nunca no app.
//
// Publicar:  supabase secrets set ANTHROPIC_API_KEY=...   e   supabase functions deploy contar-pecas
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod";
import { z } from "npm:zod@4.6.7";
import { INSTRUCOES, MAX_BASE64, TIPOS_ACEITOS, processarResposta } from "./contagem.ts";

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { erro: "Use POST." });

  let imagem: string, tipo: string;
  try {
    const corpo = await req.json();
    imagem = String(corpo.imagem ?? "");
    tipo = String(corpo.tipo ?? "image/jpeg");
  } catch {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }
  if (!imagem) return resposta(400, { erro: "Envie a foto." });
  if (imagem.length > MAX_BASE64) return resposta(413, { erro: "Foto grande demais." });
  if (!(TIPOS_ACEITOS as readonly string[]).includes(tipo)) return resposta(415, { erro: "Formato de imagem não aceito." });

  try {
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
            {
              type: "image",
              source: { type: "base64", media_type: tipo as (typeof TIPOS_ACEITOS)[number], data: imagem },
            },
            { type: "text", text: INSTRUCOES },
          ],
        },
      ],
    });

    if (msg.stop_reason === "refusal") return resposta(422, { erro: "A IA não analisou esta foto. Conte manualmente." });
    if (!msg.parsed_output) return resposta(502, { erro: "A IA não devolveu uma contagem válida. Tente outra foto." });
    return resposta(200, processarResposta(msg.parsed_output));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta(429, { erro: "Muitas fotos seguidas. Aguarde um pouco." });
    if (e instanceof Anthropic.AuthenticationError) return resposta(500, { erro: "Chave da API inválida no servidor." });
    if (e instanceof Anthropic.APIError) return resposta(502, { erro: `Falha na IA (${e.status}). Tente de novo.` });
    console.error(e);
    return resposta(500, { erro: "Erro inesperado ao contar as peças." });
  }
});
