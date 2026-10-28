/**
 * Regras da contagem por foto, sem dependências (usadas pela função no servidor e
 * testadas no app). A IA só LISTA as peças; a soma é sempre feita aqui, no código.
 */

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
export const MAX_BASE64 = 4_500_000;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
