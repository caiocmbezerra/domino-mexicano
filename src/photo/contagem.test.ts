import { describe, expect, it } from "vitest";
import { processarResposta, somaPecas } from "../../supabase/functions/contar-pecas/contagem";

describe("Contagem por foto — regras aplicadas à resposta da IA", () => {
  it("soma as peças no código (não confia na IA para somar)", () => {
    const r = processarResposta({
      foto_legivel: true,
      pecas: [
        { lado_a: 12, lado_b: 7, confianca: "alta" },
        { lado_a: 5, lado_b: 3, confianca: "alta" },
        { lado_a: 9, lado_b: 0, confianca: "baixa" },
      ],
      pecas_ilegiveis: 0,
      observacoes: "  ",
    });
    expect(r.total).toBe(36);
    expect(r.pecas).toHaveLength(3);
    expect(r.pecas[2].confianca).toBe("baixa");
    expect(r.temZeroZero).toBe(false);
    expect(r.observacoes).toBe("");
  });

  it("detecta o 0-0 para marcar a regra da turma", () => {
    const r = processarResposta({
      foto_legivel: true,
      pecas: [
        { lado_a: 0, lado_b: 0, confianca: "alta" },
        { lado_a: 11, lado_b: 4, confianca: "alta" },
      ],
      pecas_ilegiveis: 0,
      observacoes: "",
    });
    expect(r.temZeroZero).toBe(true);
    expect(r.total).toBe(15);
  });

  it("descarta valores impossíveis e normaliza confiança desconhecida", () => {
    const r = processarResposta({
      foto_legivel: true,
      pecas: [
        { lado_a: 13, lado_b: 2, confianca: "alta" },
        { lado_a: -1, lado_b: 2, confianca: "alta" },
        { lado_a: 2.5, lado_b: 2, confianca: "alta" },
        { lado_a: 6, lado_b: 6, confianca: "talvez" },
      ],
      pecas_ilegiveis: 2.7,
      observacoes: "Reflexo na peça da direita.",
    });
    expect(r.descartadas).toBe(3);
    expect(r.pecas).toEqual([{ a: 6, b: 6, confianca: "baixa" }]);
    expect(r.total).toBe(12);
    expect(r.pecasIlegiveis).toBe(2);
  });

  it("foto ilegível volta sem peças", () => {
    const r = processarResposta({ foto_legivel: false, pecas: [], pecas_ilegiveis: 0, observacoes: "Foto escura." });
    expect(r).toMatchObject({ fotoLegivel: false, total: 0, pecas: [] });
    expect(somaPecas([])).toBe(0);
  });
});
