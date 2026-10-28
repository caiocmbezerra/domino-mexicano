// Gera ícones e telas de abertura do Android a partir de public/icon.svg.
// Uso: NODE_PATH=$(npm root -g) node scripts/gerar-icones-android.cjs   (depois de `npx cap add android`)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const res = path.join(__dirname, "../android/app/src/main/res");
const svg = fs.readFileSync(path.join(__dirname, "../public/icon.svg"), "utf8");
// Só a peça, sem o fundo arredondado (para o ícone adaptativo).
const peca = svg.replace(/<rect width="512" height="512" rx="112" fill="#0c1311"\/>/, "");
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const browser = await chromium.launch();
  const render = async (file, w, h, html) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<style>html,body{margin:0;background:transparent;overflow:hidden}</style>${html}`);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
  };
  const sized = (s, size) => s.replace("<svg ", `<svg width="${size}" height="${size}" `);
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(res, `mipmap-${d}`);
    const n = Math.round(48 * k);
    await render(path.join(dir, "ic_launcher.png"), n, n, sized(svg, n));
    await render(path.join(dir, "ic_launcher_round.png"), n, n, `<div style="width:${n}px;height:${n}px;border-radius:50%;overflow:hidden">${sized(svg.replace('rx="112"', 'rx="0"'), n)}</div>`);
    const f = Math.round(108 * k);
    const inner = Math.round(f * 0.72);
    await render(path.join(dir, "ic_launcher_foreground.png"), f, f, `<div style="width:${f}px;height:${f}px;display:flex;align-items:center;justify-content:center">${sized(peca, inner)}</div>`);
  }
  // Telas de abertura: fundo da mesa com a peça no centro, no tamanho de cada arquivo existente.
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const file of walk(res).filter((f) => path.basename(f) === "splash.png")) {
    const buf = fs.readFileSync(file);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const s = Math.round(Math.min(w, h) * 0.35);
    await render(file, w, h, `<div style="width:${w}px;height:${h}px;background:#0c1311;display:flex;align-items:center;justify-content:center">${sized(peca, s)}</div>`);
  }
  await browser.close();
  console.log("Ícones e telas de abertura do Android gerados.");
})();
