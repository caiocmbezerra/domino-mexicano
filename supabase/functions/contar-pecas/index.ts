// Função do Supabase (Deno) que conta as peças de dominó numa foto usando a API da Claude.
// A chave da API fica só aqui, no servidor (segredo ANTHROPIC_API_KEY), nunca no app.
//
// Publicar:  supabase secrets set ANTHROPIC_API_KEY=...   e   supabase functions deploy contar-pecas
import { Anthropic, contarPecasNaFoto } from "./contar.ts";
import { MAX_BASE64, TIPOS_ACEITOS } from "./contagem.ts";

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
    const r = await contarPecasNaFoto(client, imagem, tipo as (typeof TIPOS_ACEITOS)[number]);
    return r.ok ? resposta(200, r.resultado) : resposta(r.status, { erro: r.erro });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta(429, { erro: "Muitas fotos seguidas. Aguarde um pouco." });
    if (e instanceof Anthropic.AuthenticationError) return resposta(500, { erro: "Chave da API inválida no servidor." });
    if (e instanceof Anthropic.APIError) return resposta(502, { erro: `Falha na IA (${e.status}). Tente de novo.` });
    console.error(e);
    return resposta(500, { erro: "Erro inesperado ao contar as peças." });
  }
});
