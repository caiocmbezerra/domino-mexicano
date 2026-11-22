// Teste da contagem por foto com a IA DE VERDADE (gasta alguns centavos de crédito).
// Roda o mesmo código da função da Vercel (api/contar-pecas.ts) sobre fotos com resultado conhecido
// e compara peça por peça. Usado pelo workflow "Testar contagem por foto (IA real)".
//
// Uso (Node 22.18+, que executa TypeScript direto):
//   ANTHROPIC_API_KEY=... node scripts/testar-contagem-real.ts e2e/fotos-teste
import Anthropic from "@anthropic-ai/sdk";
import { readFile, appendFile } from "node:fs/promises";
import { contarPecasNaFoto } from "../api/contar-pecas.ts";

const pasta = process.argv[2] ?? "e2e/fotos-teste";
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Chave da API não encontrada. Cadastre o segredo ANTHROPIC_API_KEY em Settings → Secrets and variables → Actions do repositório.",
  );
  process.exit(2);
}

type Esperado = { jogador: string; total: number; pecas: string[] };
const esperado: { fotos: Record<string, Esperado>; repetidas_entre_fotos: string[] } = JSON.parse(
  await readFile(`${pasta}/esperado.json`, "utf8"),
);
const rotulo = (a: number, b: number) => `${Math.max(a, b)}|${Math.min(a, b)}`;
const client = new Anthropic();

const linhas: string[] = ["## Contagem por foto — IA real", ""];
const vistas = new Map<string, string[]>();
let falhas = 0;

for (const [arquivo, e] of Object.entries(esperado.fotos)) {
  const bytes = await readFile(`${pasta}/${arquivo}`);
  const inicio = Date.now();
  let r;
  try {
    r = await contarPecasNaFoto(client, bytes.toString("base64"), "image/jpeg");
  } catch (err) {
    falhas++;
    const msg = err instanceof Anthropic.AuthenticationError
      ? "chave da API inválida"
      : err instanceof Anthropic.APIError
        ? `erro ${err.status} da API: ${err.message}`
        : String(err);
    linhas.push(`### ${arquivo} (${e.jogador}) — ❌ ${msg}`, "");
    console.error(`${arquivo}: ${msg}`);
    continue;
  }
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  if (!r.ok) {
    falhas++;
    linhas.push(`### ${arquivo} (${e.jogador}) — ❌ ${r.erro}`, "");
    continue;
  }
  const lidas = r.resultado.pecas.map((p) => rotulo(p.a, p.b));
  for (const l of lidas) vistas.set(l, [...(vistas.get(l) ?? []), e.jogador]);
  const certas = [...e.pecas].sort().join(",") === [...lidas].sort().join(",");
  const totalOk = r.resultado.total === e.total;
  if (!certas || !totalOk) falhas++;
  linhas.push(
    `### ${arquivo} (${e.jogador}) — ${certas && totalOk ? "✅ acertou" : "❌ divergiu"} (${seg} s)`,
    "",
    `| | Peças | Total |`,
    `|---|---|---|`,
    `| IA | ${lidas.join(" · ") || "—"} | **${r.resultado.total}** |`,
    `| Esperado | ${e.pecas.join(" · ")} | **${e.total}** |`,
    "",
    ...(r.resultado.pecas.some((p) => p.confianca === "baixa")
      ? [`Marcadas para conferir: ${r.resultado.pecas.filter((p) => p.confianca === "baixa").map((p) => rotulo(p.a, p.b)).join(", ")}`, ""]
      : []),
    ...(r.resultado.observacoes ? [`Observação da IA: ${r.resultado.observacoes}`, ""] : []),
  );
}

const repetidas = [...vistas].filter(([, quem]) => new Set(quem).size > 1).map(([l]) => l).sort();
const repetidasEsperadas = [...esperado.repetidas_entre_fotos].sort();
const repOk = repetidas.join(",") === repetidasEsperadas.join(",");
if (!repOk) falhas++;
linhas.push(
  `### Peças repetidas entre as fotos — ${repOk ? "✅" : "❌"}`,
  "",
  `Encontradas: ${repetidas.join(", ") || "nenhuma"} · Esperadas: ${repetidasEsperadas.join(", ") || "nenhuma"}`,
  "",
  falhas ? `**${falhas} divergência(s).**` : "**Tudo conferido.**",
);

const relatorio = linhas.join("\n");
console.log(relatorio);
const resumo = process.env.GITHUB_STEP_SUMMARY;
if (resumo) await appendFile(resumo, relatorio + "\n");
process.exit(falhas ? 1 : 0);
