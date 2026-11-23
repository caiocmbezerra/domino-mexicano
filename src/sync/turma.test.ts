import { describe, expect, it } from "vitest";
import { emptyDatabase } from "../domain/database";
import { addPlayer, DomainError } from "../domain/operations";
import type { Database } from "../domain/types";
import { mesclarRemoto, normalizarCodigo, paraEnviar, reaplicar } from "./turma";

describe("Placar compartilhado — regras", () => {
  it("o que vai para a turma não leva as preferências do aparelho", () => {
    const db = { ...emptyDatabase(), settings: { ...emptyDatabase().settings, theme: "light" as const, photoCount: true, sheetOrder: "total" as const } };
    const enviado = paraEnviar(db) as { settings: Record<string, unknown> };
    expect(enviado.settings).not.toHaveProperty("theme");
    expect(enviado.settings).not.toHaveProperty("photoCount");
    expect(enviado.settings).not.toHaveProperty("sheetOrder");
    expect(enviado.settings.appName).toBe(db.settings.appName);
  });

  it("ao receber a turma, cada aparelho mantém tema, câmera e ordem da planilha", () => {
    const local = { ...emptyDatabase(), settings: { ...emptyDatabase().settings, theme: "light" as const, photoCount: true, sheetOrder: "rodada" as const } };
    const { db: comAna } = addPlayer(emptyDatabase(), "Ana");
    const remoto = { ...paraEnviar(comAna), settings: { ...comAna.settings, appName: "Turma do Zé" } };
    const r = mesclarRemoto(local, remoto);
    expect(r.players.map((p) => p.name)).toEqual(["Ana"]);
    expect(r.settings.appName).toBe("Turma do Zé");
    expect(r.settings).toMatchObject({ theme: "light", photoCount: true, sheetOrder: "rodada" });
  });

  it("conflito: refaz as ações pendentes sobre a versão atual e descarta as que não cabem mais", () => {
    const base = addPlayer(emptyDatabase(), "Ana").db; // versão da turma, que já tem a Ana
    const pendentes: ((d: Database) => Database)[] = [
      (d) => addPlayer(d, "Beto").db,
      (d) => addPlayer(d, "Ana").db, // repetida: recusada pelas regras
      () => {
        throw new DomainError("rodada sumiu");
      },
    ];
    const { db, descartadas } = reaplicar(base, pendentes);
    expect(db.players.map((p) => p.name)).toEqual(["Ana", "Beto"]);
    expect(descartadas).toBe(2);
  });

  it("código digitado: maiúsculas, sem espaços nem traços, até 8 caracteres", () => {
    expect(normalizarCodigo(" weed 2p84 ")).toBe("WEED2P84");
    expect(normalizarCodigo("abcd-efgh-jk")).toBe("ABCDEFGH");
  });
});
