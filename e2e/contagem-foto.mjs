// Teste no navegador da contagem por foto, com a resposta da IA simulada
// (não gasta créditos da API). Gera um build próprio com a função ligada.
//
// Uso: NODE_PATH=$(npm root -g) node e2e/contagem-foto.mjs
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = ["node_modules/vite/bin/vite.js"];
const FAKE = "https://exemplo-supabase.test";
execFileSync(process.execPath, [...vite, "build", "--outDir", "dist-foto", "--emptyOutDir"], {
  cwd: root,
  env: { ...process.env, VITE_SUPABASE_URL: FAKE, VITE_SUPABASE_ANON_KEY: "chave-publica-teste" },
  stdio: "ignore",
});

const PORT = 4790;
const server = spawn(process.execPath, [...vite, "preview", "--outDir", "dist-foto", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "pipe" });
await new Promise((ok, fail) => {
  server.stdout.on("data", (d) => String(d).includes(String(PORT)) && ok());
  setTimeout(() => fail(new Error("preview não subiu")), 20000);
});

let falhas = 0;
const check = (c, l) => (c ? console.log(`  ✓ ${l}`) : (falhas++, console.log(`  ✗ ${l}`)));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
page.on("pageerror", (e) => (falhas++, console.log("  ✗ erro na página:", e.message)));

// Resposta simulada da função: 12|7, 5|3 (duvidosa), 0|0 e uma peça ilegível.
let pedido = null;
await page.route(`${FAKE}/functions/v1/contar-pecas`, async (route) => {
  pedido = { headers: route.request().headers(), corpo: route.request().postDataJSON() };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      fotoLegivel: true,
      pecas: [
        { a: 12, b: 7, confianca: "alta" },
        { a: 5, b: 3, confianca: "baixa" },
        { a: 0, b: 0, confianca: "alta" },
      ],
      total: 27,
      temZeroZero: true,
      pecasIlegiveis: 1,
      descartadas: 0,
      observacoes: "Uma peça está virada para baixo.",
    }),
  });
});

try {
  const btn = (n, exact = false) => page.getByRole("button", { name: n, exact });
  await page.goto(`http://localhost:${PORT}/`);
  console.log("Opcional, à escolha do organizador");
  await page.goto(`http://localhost:${PORT}/#/ajustes`);
  const chave = page.getByRole("switch", { name: "Mostrar botão de contagem por foto" });
  check((await chave.getAttribute("aria-checked")) === "false", "vem desligada por padrão");
  await page.goto(`http://localhost:${PORT}/`);
  await btn("Nova partida").click();
  for (const n of ["Ana", "Beto"]) {
    await page.getByLabel("Nome do novo jogador").fill(n);
    await btn("Adicionar jogador").click();
  }
  await btn("Iniciar partida com 2").click();
  await page.getByRole("button", { name: "Ana", exact: true }).click();
  await btn(/Confirmar/).click();
  await btn("Ana").filter({ hasText: "Ana" }).last().click(); // Ana vence

  check((await btn("Contar pontos de Beto por foto").count()) === 0, "desligada: sem câmera, pontos só digitados");
  await page.getByRole("textbox", { name: "Pontos de Beto" }).fill("10");
  check((await page.getByRole("textbox", { name: "Pontos de Beto" }).inputValue()) === "10", "digitação manual funciona sem a foto");
  await page.goto(`http://localhost:${PORT}/#/ajustes`);
  await page.getByRole("switch", { name: "Mostrar botão de contagem por foto" }).click();
  await page.goto(`http://localhost:${PORT}/`);
  await btn("Continuar partida").click();
  await btn("Registrar rodada 1").click();

  console.log("Contagem por foto");
  check((await btn("Contar pontos de Ana por foto").count()) === 0, "vencedor não tem botão de câmera");
  await btn("Contar pontos de Beto por foto").click();
  // Foto de teste: um PNG gerado pelo próprio navegador.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 2400;
    c.height = 1200;
    const g = c.getContext("2d");
    g.fillStyle = "#f7f2e3";
    g.fillRect(0, 0, 2400, 1200);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Tirar foto das peças").setInputFiles({ name: "pecas.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByText("Confira cada peça com a foto").waitFor();
  check(pedido?.headers.authorization === "Bearer chave-publica-teste", "envia a chave pública do Supabase");
  check(pedido?.corpo.tipo === "image/jpeg" && pedido.corpo.imagem.length > 100, "envia a foto reduzida em JPEG");
  const dialogo = await page.getByRole("dialog").innerText();
  check(/27/.test(dialogo) && /Inclui o 0-0/.test(dialogo), "mostra total 27 e o 0-0 encontrado");
  check(/1 peça não pôde ser lida/.test(dialogo) && /virada para baixo/.test(dialogo), "avisa da peça ilegível");
  check((await page.getByText("Conferir: a IA ficou em dúvida").count()) === 1, "peça duvidosa marcada para conferir");
  await page.waitForTimeout(400);
  if (process.env.SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SCREENSHOTS_DIR}/15-contagem-foto.png` });

  // Operador corrige a peça duvidosa (5|3 → 5|4) e adiciona a peça ilegível (6|2).
  await btn("Corrigir peça 2").click();
  await page.getByLabel("Peça 2, segunda metade").selectOption("4");
  await btn("Adicionar peça que faltou").click();
  await page.getByLabel("Peça 4, primeira metade").selectOption("6");
  await page.getByLabel("Peça 4, segunda metade").selectOption("2");
  check(await page.getByRole("button", { name: "Usar 36 pontos e marcar 0-0" }).isVisible(), "total recalculado após correção: 36");
  await btn("Usar 36 pontos e marcar 0-0").click();
  check((await page.getByRole("textbox", { name: "Pontos de Beto" }).inputValue()) === "36", "pontos de Beto preenchidos com 36");
  const card = page.locator("li.card", { hasText: "Beto" });
  check((await card.getByRole("button", { name: /Terminou com o 0-0/ }).getAttribute("aria-pressed")) === "true", "0-0 marcado automaticamente");
  check(await page.getByText("Regra do 0-0: conta 0").isVisible(), "regra da turma aplicada: conta 0");

  console.log("Erro de rede");
  await page.unroute(`${FAKE}/functions/v1/contar-pecas`);
  await page.route(`${FAKE}/functions/v1/contar-pecas`, (r) => r.abort());
  await btn("Contar pontos de Beto por foto").click();
  await page.getByLabel("Tirar foto das peças").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const avisou = await page.getByText(/Sem conexão/).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check(avisou, "sem internet: mensagem clara");
  await btn("Digitar os pontos").click();
  check((await page.getByRole("textbox", { name: "Pontos de Beto" }).inputValue()) === "36", "falha não altera os pontos já lançados");
} catch (e) {
  falhas++;
  console.error("Falha inesperada:", e);
} finally {
  await browser.close();
  server.kill();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações da contagem por foto passaram.");
process.exit(falhas ? 1 : 0);
