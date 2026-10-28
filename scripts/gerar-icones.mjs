// Gera os ícones PNG do PWA/lojas a partir de public/icon.svg (usa o Chromium do Playwright).
// Uso: node scripts/gerar-icones.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// require (e não import) para respeitar NODE_PATH quando o Playwright está instalado globalmente.
const { chromium } = createRequire(import.meta.url)("playwright");
const svg = readFileSync(fileURLToPath(new URL("../public/icon.svg", import.meta.url)), "utf8");
const browser = await chromium.launch();
for (const size of [192, 512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("Ícones gerados em public/");
