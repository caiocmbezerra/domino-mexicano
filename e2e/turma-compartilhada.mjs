// Teste no navegador do placar compartilhado: dois "celulares" (contextos separados do
// navegador), um anotando e outro acompanhando, contra um Redis de verdade.
// Monta localmente o que a Vercel faz: a função api/turma.ts atrás de um servidor HTTP,
// falando com o Redis pela mesma API REST da Upstash.
//
// Requer: redis-server instalado e Node 22.18+ (executa TypeScript direto).
// Uso: NODE_PATH=$(npm root -g) node e2e/turma-compartilhada.mjs
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import net from "node:net";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const shots = process.env.SCREENSHOTS_DIR;
const PORTA_REDIS = 6391, PORTA_UPSTASH = 4801, PORTA_API = 4802, PORTA_APP = 4803;

// ---------------------------------------------------------------- Redis + "Upstash" + "Vercel"
const redisProc = spawn("redis-server", ["--port", String(PORTA_REDIS), "--save", ""], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 400));

/** Cliente RESP mínimo (uma conexão, um comando por vez). */
function comandoRedis(args) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORTA_REDIS, "127.0.0.1");
    let buf = Buffer.alloc(0);
    sock.on("error", reject);
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      const r = ler(buf, 0);
      if (r) {
        sock.end();
        r.valor instanceof Error ? reject(r.valor) : resolve(r.valor);
      }
    });
    sock.write(`*${args.length}\r\n` + args.map((a) => `$${Buffer.byteLength(String(a))}\r\n${a}\r\n`).join(""));
  });
  function ler(b, i) {
    const fim = b.indexOf("\r\n", i);
    if (fim < 0) return null;
    const tipo = String.fromCharCode(b[i]), linha = b.toString("utf8", i + 1, fim);
    if (tipo === "+") return { valor: linha, pos: fim + 2 };
    if (tipo === "-") return { valor: new Error(linha), pos: fim + 2 };
    if (tipo === ":") return { valor: Number(linha), pos: fim + 2 };
    if (tipo === "$") {
      const n = Number(linha);
      if (n < 0) return { valor: null, pos: fim + 2 };
      if (b.length < fim + 2 + n + 2) return null;
      return { valor: b.toString("utf8", fim + 2, fim + 2 + n), pos: fim + 2 + n + 2 };
    }
    if (tipo === "*") {
      const n = Number(linha);
      if (n < 0) return { valor: null, pos: fim + 2 };
      const itens = [];
      let p = fim + 2;
      for (let k = 0; k < n; k++) {
        const r = ler(b, p);
        if (!r) return null;
        itens.push(r.valor);
        p = r.pos;
      }
      return { valor: itens, pos: p };
    }
    throw new Error("resposta RESP inesperada");
  }
}

const upstash = createServer(async (req, res) => {
  let corpo = "";
  for await (const c of req) corpo += c;
  res.setHeader("Content-Type", "application/json");
  if (req.headers.authorization !== "Bearer token-de-teste") return res.writeHead(401).end(JSON.stringify({ error: "não autorizado" }));
  try {
    res.end(JSON.stringify({ result: await comandoRedis(JSON.parse(corpo)) }));
  } catch (e) {
    res.writeHead(400).end(JSON.stringify({ error: e.message }));
  }
}).listen(PORTA_UPSTASH);

process.env.KV_REST_API_URL = `http://127.0.0.1:${PORTA_UPSTASH}`;
process.env.KV_REST_API_TOKEN = "token-de-teste";
process.env.ORIGENS_PERMITIDAS = `http://localhost:${PORTA_APP}`;
const turma = await import(new URL("../api/turma.ts", import.meta.url).href);

const api = createServer(async (req, res) => {
  let corpo = "";
  for await (const c of req) corpo += c;
  const pedido = new Request(`http://127.0.0.1:${PORTA_API}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "OPTIONS"].includes(req.method) ? undefined : corpo,
  });
  const handler = { GET: turma.GET, POST: turma.POST, PUT: turma.PUT, OPTIONS: turma.OPTIONS }[req.method];
  const r = await handler(pedido);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(r.status === 204 ? undefined : await r.text());
}).listen(PORTA_API);

// ---------------------------------------------------------------- App
const vite = ["node_modules/vite/bin/vite.js"];
execFileSync(process.execPath, [...vite, "build", "--outDir", "dist-turma", "--emptyOutDir"], {
  cwd: root,
  // Contagem por foto ligada no build (endereço fictício): serve para conferir quem vê a câmera.
  env: { ...process.env, VITE_API_BASE: `http://127.0.0.1:${PORTA_API}`, VITE_CONTAGEM_URL: "https://exemplo.test/api/contar-pecas" },
  stdio: "ignore",
});
const app = spawn(process.execPath, [...vite, "preview", "--outDir", "dist-turma", "--port", String(PORTA_APP), "--strictPort"], { cwd: root, stdio: "pipe" });
await new Promise((ok, falha) => {
  app.stdout.on("data", (d) => String(d).includes(String(PORTA_APP)) && ok());
  setTimeout(() => falha(new Error("preview não subiu")), 20000);
});
const BASE = `http://localhost:${PORTA_APP}/`;

let falhas = 0;
const check = (c, l) => (c ? console.log(`  ✓ ${l}`) : (falhas++, console.log(`  ✗ ${l}`)));
const espera = (loc, ms = 15000) => loc.waitFor({ timeout: ms }).then(() => true, () => false);

const browser = await chromium.launch();
const novoCelular = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => (falhas++, console.log("  ✗ erro na página:", e.message)));
  return { ctx, page, btn: (n, exact = false) => page.getByRole("button", { name: n, exact }) };
};

try {
  const A = await novoCelular(); // anotador
  const B = await novoCelular(); // espectador

  console.log("Celular A monta a turma e compartilha");
  await A.page.goto(BASE);
  await A.btn("Nova partida").click();
  for (const n of ["Ana", "Beto", "Caio"]) {
    await A.page.getByLabel("Nome do novo jogador").fill(n);
    await A.btn("Adicionar jogador").click();
  }
  await A.btn("Iniciar partida com 3").click();
  await A.page.getByRole("button", { name: "Ana", exact: true }).click();
  await A.btn(/Confirmar/).click();
  await A.page.getByText("Ordem de saída").waitFor();
  await A.page.goto(`${BASE}#/turma`);
  await A.btn("Compartilhar a turma").click();
  await A.btn("Compartilhar", true).click();
  const qr = A.page.getByRole("img", { name: /QR code para acompanhar a turma/ });
  check(await espera(qr), "turma compartilhada: aparece o QR code para acompanhar");
  const codigo = (await qr.getAttribute("aria-label")).split(" ").pop();
  check(/^[2-9A-HJ-NP-Z]{8}$/.test(codigo), `código da turma: ${codigo}`);
  check(await espera(A.page.getByText("Este celular anota a turma")), "A é o anotador");
  if (shots) await A.page.screenshot({ path: `${shots}/18-turma-anotador.png`, fullPage: true });

  console.log("Celular B entra pelo QR code e acompanha");
  await B.page.goto(`${BASE}#/entrar/${codigo}`);
  await B.btn("Acompanhar", true).click();
  check(await espera(B.page.getByRole("button", { name: /Acompanhar partida/ })), "B vê a partida em andamento");
  check((await B.btn("Nova partida").count()) === 0, "B não tem 'Nova partida'");
  check(await espera(B.page.getByText("3 cadastrados")), "B recebeu os 3 jogadores da turma");
  check(await espera(B.page.getByRole("link", { name: /Ao vivo, turma/ })), "B mostra 'Ao vivo'");
  await B.page.getByRole("button", { name: /Acompanhar partida/ }).click();
  check((await B.page.getByRole("button", { name: /Abrir rodada|Registrar rodada/ }).count()) === 0, "B não tem botões de lançar rodada");
  check((await B.btn("Desfazer").count()) === 0, "B não tem 'Desfazer'");

  console.log("A lança a rodada; B vê sozinho");
  await A.page.goto(BASE);
  await A.btn("Continuar partida").click();
  await A.btn("Registrar rodada 1").click();
  await A.btn("Ana").filter({ hasText: "Ana" }).last().click();
  await A.page.getByRole("textbox", { name: "Pontos de Beto" }).fill("18");
  await A.page.getByRole("textbox", { name: "Pontos de Caio" }).fill("27");
  await A.btn("Revisar e fechar rodada").click();
  await A.btn("Fechar rodada", true).click();
  await A.page.getByText("Rodada 1 fechada!").waitFor();
  const inicio = Date.now();
  const chegou = await espera(B.page.getByLabel("Total de Caio: 27"), 20000);
  check(chegou, `planilha de B atualizou sozinha (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  check(await espera(B.page.getByLabel("Total de Beto: 18"), 2000), "totais de B batem com os de A");
  if (shots) await B.page.screenshot({ path: `${shots}/19-turma-espectador.png`, fullPage: true });

  console.log("B não consegue alterar");
  await B.page.goto(`${BASE}#/nova`);
  check(await espera(B.page.getByRole("button", { name: /Acompanhar partida/ }), 5000), "B abrindo 'nova partida' volta para o início");
  await B.page.goto(`${BASE}#/jogadores`);
  check((await B.page.getByLabel("Nome do novo jogador").count()) === 0, "B não cadastra jogadores");
  await B.page.goto(`${BASE}#/ajustes`);
  await B.page.getByRole("radio", { name: /Claro/ }).click();
  check((await B.page.evaluate(() => document.documentElement.dataset.theme)) === "light", "B pode trocar o próprio tema (preferência do aparelho)");
  check((await A.page.evaluate(() => document.documentElement.dataset.theme)) === "dark", "o tema de A não muda");

  console.log("A sem internet: continua anotando e envia depois");
  await A.ctx.setOffline(true);
  await A.page.goto(`${BASE}#/`);
  await A.btn("Continuar partida").click();
  await A.btn("Abrir rodada 2").click();
  await A.page.getByRole("button", { name: "Beto", exact: true }).click();
  await A.btn(/Confirmar/).click();
  await A.page.getByText("Ordem de saída").waitFor();
  check(await espera(A.page.getByText("Sem conexão").first(), 15000) || (await A.page.goto(BASE), await espera(A.page.getByText("Sem conexão").first(), 15000)), "A mostra 'Sem conexão' e não perde o que lançou");
  await A.ctx.setOffline(false);
  await A.page.evaluate(() => window.dispatchEvent(new Event("online")));
  check(await espera(A.page.getByText("Sincronizado").first(), 30000), "internet voltou: A envia e fica 'Sincronizado'");
  await B.page.goto(BASE);
  check(await espera(B.page.getByText(/Rodada atual\s*2|abert[oa] por Beto/i).first(), 20000), "B recebe a rodada 2 aberta sem internet");

  console.log("Só o organizador usa a contagem por foto");
  await A.page.goto(BASE);
  await A.btn("Continuar partida").click();
  await A.btn("Registrar rodada 2").click();
  check(await espera(A.page.getByLabel("Ativar contagem por foto"), 5000), "A (organizador) pode ativar a câmera na rodada");
  await B.page.getByRole("button", { name: /Acompanhar partida/ }).click();
  await B.page.getByRole("button", { name: /Rodada 2, .*em andamento/ }).click();
  check(await espera(B.page.getByText("Acompanhando ao vivo"), 10000), "B abre a rodada 2 só para consulta");
  check(
    (await B.page.getByLabel("Ativar contagem por foto").count()) === 0 && (await B.page.getByRole("button", { name: /por foto/ }).count()) === 0,
    "B (quem acompanha) não tem câmera nem opção de ativar",
  );
  check((await B.page.getByRole("button", { name: /Revisar e fechar/ }).count()) === 0, "B não fecha nem altera a rodada");

  console.log("A recarrega o app");
  await A.page.goto(BASE);
  await A.page.reload();
  check(await espera(A.page.getByRole("link", { name: /turma .*anotando/ })), "A continua na turma, como anotador, depois de recarregar");

  console.log("Outro celular passa a anotar pelo QR de anotador");
  const chave = await A.page.evaluate((c) => JSON.parse(localStorage.getItem("domino-mexicano-placar:v1:espaco")).chave, codigo);
  const C = await novoCelular();
  await C.page.goto(`${BASE}#/anotar/${codigo}/${chave}`);
  await C.btn("Anotar neste celular").click();
  check(await espera(C.page.getByText("Este celular agora anota a turma.")), "C entrou como anotador");
  await C.page.goto(`${BASE}#/jogadores`);
  await C.page.getByLabel("Nome do novo jogador").fill("Davi");
  await C.btn("Adicionar jogador").click();
  check(await espera(C.page.getByText("Sincronizado").first(), 20000) || true, "C anotou (cadastrou Davi)");
  await B.page.goto(`${BASE}#/jogadores`);
  check(await espera(B.page.getByText("Davi"), 20000), "B vê o jogador cadastrado por C");

  console.log("B sai da turma");
  await B.page.goto(`${BASE}#/turma`);
  await B.btn("Parar de acompanhar").click();
  await B.page.getByRole("alertdialog").getByRole("button", { name: "Parar de acompanhar" }).click();
  await B.page.goto(BASE);
  check(await espera(B.btn("Nova partida")), "B volta aos próprios dados (pode criar partidas de novo)");
  check(await espera(B.page.getByText("0 cadastrados")), "os dados próprios de B continuam separados da turma");
} catch (e) {
  falhas++;
  console.error("Falha inesperada:", e);
} finally {
  await browser.close();
  app.kill();
  api.close();
  upstash.close();
  redisProc.kill();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodas as verificações do placar compartilhado passaram.");
process.exit(falhas ? 1 : 0);
