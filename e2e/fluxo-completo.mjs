// Teste ponta a ponta no navegador (Chromium/Playwright) com tela de celular.
// Percorre o fluxo real das telas e confere os cenários A–J na interface.
//
// Uso: npm run build && npm run test:e2e
//   (o Playwright precisa estar instalado; se estiver global, rode com NODE_PATH=$(npm root -g))
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const shots = process.env.SCREENSHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });

const PORT = 4789;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "pipe" });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes(String(PORT)) && resolve());
  server.on("exit", (code) => reject(new Error(`preview saiu com código ${code}`)));
  setTimeout(() => reject(new Error("preview não subiu")), 20000);
});

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`);
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "pt-BR" });
const page = await context.newPage();
page.on("pageerror", (e) => {
  failures++;
  console.log("  ✗ erro na página:", e.message);
});
const shot = async (name) => shots && (await page.waitForTimeout(400), page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }));
const btn = (name, exact = false) => page.getByRole("button", { name, exact });
const text = async () => page.locator("body").innerText();
/** Espera (até 5 s) o texto aparecer na tela — a navegação entre telas é assíncrona. */
const has = async (p, str) => {
  try {
    await p.getByText(str, { exact: false }).first().waitFor({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};

try {
  await page.goto(`http://localhost:${PORT}/`);
  await shot("01-inicio-vazio");

  console.log("Cadastro e nova partida");
  await btn("Nova partida").click();
  for (const n of ["João", "Pedro", "Carlos"]) {
    await page.getByLabel("Nome do novo jogador").fill(n);
    await btn("Adicionar jogador").click();
  }
  check(await has(page, "Iniciar partida com 3"), "3 participantes selecionados");
  await btn("Descer João").click();
  await btn("Subir João").click(); // reordena e volta
  await shot("02-nova-partida");
  await btn("Iniciar partida com 3").click();

  console.log("Teste A — busca do carroção");
  await page.getByText("Carroção de abertura").first().waitFor();
  check(await has(page, "12-12"), "busca começa no 12-12");
  await btn("Ninguém tem").click();
  check(await has(page, "Alguém tem o 11-11?"), "ninguém tem 12-12 → 11-11");
  await btn("Ninguém tem").click();
  check(await has(page, "Alguém tem o 10-10?"), "ninguém tem 11-11 → 10-10");
  await btn("Voltar para o carroção anterior").click();
  check(await has(page, "Alguém tem o 11-11?"), "voltar na busca → 11-11");
  await btn("Ninguém tem").click();
  await page.getByRole("button", { name: "Carlos", exact: true }).click();
  await page.getByRole("button", { name: "Pedro", exact: true }).click(); // corrige a escolha
  await shot("03-abertura");
  await btn(/Confirmar: Pedro abre com 10-10/).click();
  await page.getByText("Ordem de saída").waitFor();
  check(await has(page, "Abriu: Pedro"), "rodada 1 aberta por Pedro com 10-10");

  console.log("Teste C — pontuação");
  await btn("João").filter({ hasText: "João" }).last().click(); // João sai em 1º
  await page.getByLabel("Pontos de Pedro").fill("18");
  await page.getByLabel("Pontos de Carlos").fill("27");
  await shot("04-rodada");
  await btn("Revisar e fechar rodada").click();
  await page.getByRole("alertdialog").waitFor();
  const resumo = await page.getByRole("alertdialog").innerText();
  check(resumo.includes("10-10") && resumo.includes("1º João") && resumo.includes("Pedro"), "resumo mostra carroção, abertura e ordem");
  await shot("05-resumo");
  await btn("Fechar rodada", true).click();
  await page.getByText("Rodada 1 fechada!").waitFor();
  await shot("06-placar");

  const totals = async () => {
    // Somatório lido da coluna "Total" da planilha.
    await page.getByRole("tab", { name: "Planilha" }).click();
    const cells = await page.locator('td[aria-label^="Total de "]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    return Object.fromEntries(cells.map((l) => {
      const [, name, pts] = l.match(/^Total de (.+): (\d+)$/);
      return [name, Number(pts)];
    }));
  };
  let t = await totals();
  check(t["João"] === 0 && t.Pedro === 18 && t.Carlos === 27, `totais após rodada 1: ${JSON.stringify(t)}`);
  const linhas = await page.locator("tbody th[scope=row]").allInnerTexts();
  check(JSON.stringify(linhas) === JSON.stringify(["João", "Pedro", "Carlos"]), "planilha: jogadores um embaixo do outro, na ordem de exibição");
  check((await page.getByLabel(/lugar/).count()) === 0 && (await page.getByRole("tab", { name: "Ranking" }).count()) === 0, "sem ranking durante a partida");

  console.log("Teste B — próxima rodada pula o 10-10");
  await btn("Abrir rodada 2").click();
  check(await has(page, "Alguém tem o 12-12?"), "busca reinicia no 12-12");
  await btn("Ninguém tem").click();
  await btn("Ninguém tem").click();
  check(await has(page, "Alguém tem o 9-9?"), "11-11 → 9-9 (10-10 pulado)");
  await page.getByRole("button", { name: "Carlos", exact: true }).click();
  await btn(/Confirmar: Carlos abre com 9-9/).click();
  await page.getByText("Ordem de saída").waitFor();

  console.log("Teste D — 0-0 e Teste H — persistência no meio da rodada");
  await btn("Pedro").filter({ hasText: "Pedro" }).last().click(); // Pedro vence
  await page.getByLabel("Pontos de João").fill("30");
  const carlosCard = page.locator("li.card", { hasText: "Carlos" });
  await carlosCard.getByRole("button", { name: /Terminou com o 0-0/ }).click();
  await page.getByLabel("Pontos de Carlos").fill("41");
  await page.waitForTimeout(150);
  await page.reload();
  await page.getByText("Ordem de saída").waitFor();
  const afterReload = await text();
  check(afterReload.includes("Rodada 2") && afterReload.includes("vencedor"), "rascunho da rodada 2 sobrevive ao recarregar");
  check((await page.getByLabel("Pontos de João").inputValue()) === "30", "pontos digitados mantidos após recarregar");
  check(afterReload.includes("Regra do 0-0: conta 0"), "0-0 de Carlos mantido e contando zero");
  await shot("07-rodada-0-0");
  await btn("Revisar e fechar rodada").click();
  await btn("Fechar rodada", true).click();
  await page.getByText("Rodada 2 fechada!").waitFor();
  t = await totals();
  check(t["João"] === 30 && t.Pedro === 18 && t.Carlos === 27, `totais após rodada 2: ${JSON.stringify(t)}`);

  console.log("Teste G — corrigir a rodada 1");
  await page.getByRole("button", { name: /^Rodada 1, 10-10/ }).click();
  await page.getByRole("dialog").waitFor();
  const detalhe = await page.getByRole("dialog").innerText();
  check(/Rodada 1/.test(detalhe) && /abriu Pedro/.test(detalhe) && /1º\s+João/.test(detalhe) && /Carlos\s+27/.test(detalhe), "tocar na rodada 1 mostra jogadores e pontos");
  await shot("08-detalhe-rodada");
  await btn("Corrigir rodada 1").click();
  await page.getByLabel("Pontos de Carlos").fill("34");
  await btn("Revisar e salvar correção").click();
  await btn("Salvar correção", true).click();
  await page.getByText("Rodada 1 corrigida.").waitFor();
  t = await totals();
  check(t["João"] === 30 && t.Pedro === 18 && t.Carlos === 34, `totais recalculados sem duplicar: ${JSON.stringify(t)}`);

  console.log("Teste H — reabrir o app inteiro");
  const page2 = await context.newPage();
  await page2.goto(`http://localhost:${PORT}/`);
  await has(page2, "Rodada atual");
  const home = await page2.locator("body").innerText();
  check(/Em andamento/i.test(home) && /Rodada atual\s+3/i.test(home), "partida retomada na rodada 3");
  await page2.getByRole("button", { name: "Continuar partida" }).click();
  await page2.getByRole("button", { name: "Abrir rodada 3" }).click();
  check(await has(page2, "Alguém tem o 12-12?"), "sequência não reiniciou indevidamente (12-12 ainda livre)");
  await page2.getByRole("button", { name: "Ninguém tem" }).click();
  await page2.getByRole("button", { name: "Ninguém tem" }).click();
  check(await has(page2, "Alguém tem o 8-8?"), "11-11 → 8-8 (10 e 9 usados)");
  await page2.close();
  await page.goto(`http://localhost:${PORT}/`);

  console.log("Encerramento e compartilhamento");
  await btn("Continuar partida").click();
  await btn("Encerrar").click();
  await shot("09-encerrar");
  await btn("Confirmar encerramento").click();
  await btn("Encerrar partida", true).click();
  await page.getByText("Resultado da partida").waitFor();
  await has(page, "Campeão");
  const podio = await page.locator("section").first().innerText();
  check(/Campeão\s+Pedro\s+18 pontos/i.test(podio), "Pedro campeão com 18 pontos");
  await page.getByText("Ver texto do resumo").click();
  const resumoTexto = await page.locator("pre").innerText();
  check(resumoTexto.includes("1º — Pedro: 18 pontos") && resumoTexto.includes("2º — João: 30 pontos") && resumoTexto.includes("3º — Carlos: 34 pontos"), "texto para WhatsApp com a classificação real");
  check(resumoTexto.includes("Maior pontuação em uma rodada: Carlos na rodada 1, 34 pontos"), "recorde de maior rodada no resumo");
  await shot("10-resultado");

  console.log("Teste J — segunda partida não mistura resultados");
  await page.goto(`http://localhost:${PORT}/#/nova`);
  await page.getByRole("button", { name: "Pedro" }).click();
  await page.getByRole("button", { name: "João" }).click();
  await btn("Iniciar partida com 2").click();
  check(await has(page, "Alguém tem o 12-12?"), "nova partida começa com todos os carroções");
  await page.getByRole("button", { name: "João", exact: true }).click();
  await btn(/Confirmar/).click();
  await btn("João").filter({ hasText: "João" }).last().click();
  await page.getByLabel("Pontos de Pedro").fill("50");
  await btn("Revisar e fechar rodada").click();
  await btn("Fechar rodada", true).click();
  await page.getByText("Rodada 1 fechada!").waitFor();
  await page.goto(`http://localhost:${PORT}/#/historico`);
  await shot("11-historico");
  await page.getByRole("link", { name: /João, Pedro e Carlos/ }).click();
  t = await totals();
  check(t["João"] === 30 && t.Pedro === 18 && t.Carlos === 34, `primeira partida intacta no histórico: ${JSON.stringify(t)}`);
  check(!await has(page, "Desfazer rodada"), "partida encerrada aberta somente para consulta");

  console.log("Teste I — empate na interface");
  await page.goto(`http://localhost:${PORT}/#/`);
  await btn("Continuar partida").click();
  await btn("Abrir rodada 2").click();
  await page.getByRole("button", { name: "Pedro", exact: true }).click();
  await btn(/Confirmar/).click();
  await btn("Pedro").filter({ hasText: "Pedro" }).last().click();
  await page.getByLabel("Pontos de João").fill("50");
  await btn("Revisar e fechar rodada").click();
  await btn("Fechar rodada", true).click();
  await page.getByText("Rodada 2 fechada!").waitFor();
  t = await totals();
  check(t["João"] === 50 && t.Pedro === 50, `planilha da 2ª partida: ${JSON.stringify(t)}`);
  await btn("Encerrar").click();
  await has(page, "Ranking final");
  await btn("Confirmar encerramento").click();
  await btn("Encerrar partida", true).click();
  await has(page, "Resultado da partida");
  await has(page, "Empate");
  const badges = await page.getByLabel("1º lugar, empatado").count();
  check(badges === 2, "50 × 50 aparece como empate explícito, ambos em 1º lugar");
  await shot("12-empate");

  await page.goto(`http://localhost:${PORT}/#/estatisticas`);
  await shot("13-estatisticas");
  await page.goto(`http://localhost:${PORT}/#/ajustes`);
  await page.getByRole("radio", { name: /Claro/ }).click();
  await page.goto(`http://localhost:${PORT}/#/`);
  await shot("14-inicio-tema-claro");
} catch (e) {
  failures++;
  console.error("Falha inesperada:", e);
  await shot("erro");
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTodas as verificações E2E passaram.");
process.exit(failures ? 1 : 0);
