import { PHOTO_COUNT } from "../config";
import type { ResultadoContagem } from "../../supabase/functions/contar-pecas/contagem";

export type { ResultadoContagem };

/** Maior lado da foto enviada: suficiente para contar os pontinhos e barato de enviar. */
const MAX_LADO = 1568;

/** Reduz a foto no próprio aparelho e devolve o conteúdo em base64 (JPEG). */
export async function prepararFoto(arquivo: File): Promise<{ base64: string; previa: string }> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const previa = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: previa.slice(previa.indexOf(",") + 1), previa };
}

/** Envia a foto para a função no servidor, que pede à IA a lista de peças. */
export async function contarPecas(base64: string, sinal?: AbortSignal): Promise<ResultadoContagem> {
  let res: Response;
  try {
    res = await fetch(`${PHOTO_COUNT.url}/functions/v1/contar-pecas`, {
      method: "POST",
      signal: sinal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PHOTO_COUNT.anonKey}`,
        apikey: PHOTO_COUNT.anonKey,
      },
      body: JSON.stringify({ imagem: base64, tipo: "image/jpeg" }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Sem conexão com a internet. Conte manualmente ou tente de novo.");
  }
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(corpo?.erro ?? `Não foi possível contar (erro ${res.status}).`);
  return corpo as ResultadoContagem;
}
