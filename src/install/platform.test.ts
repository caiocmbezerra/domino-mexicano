import { describe, expect, it } from "vitest";
import { detectarAmbiente } from "./platform";

const win = (opts: { standalone?: boolean; touch?: number; displayStandalone?: boolean } = {}) =>
  ({
    navigator: { maxTouchPoints: opts.touch ?? 0, standalone: opts.standalone },
    matchMedia: () => ({ matches: Boolean(opts.displayStandalone) }),
  }) as unknown as Window & typeof globalThis;

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("Como instalar — detecção do aparelho", () => {
  it("iPhone no Safari", () => {
    expect(detectarAmbiente(IPHONE_SAFARI, win())).toEqual({ plataforma: "iphone", instalado: false, iosForaDoSafari: false });
  });
  it("iPhone no Chrome precisa abrir no Safari", () => {
    expect(detectarAmbiente(IPHONE_CHROME, win()).iosForaDoSafari).toBe(true);
  });
  it("iPad (que se apresenta como Mac) é tratado como iPhone/iPad", () => {
    expect(detectarAmbiente(IPAD, win({ touch: 5 })).plataforma).toBe("iphone");
    expect(detectarAmbiente(IPAD, win({ touch: 0 })).plataforma).toBe("computador");
  });
  it("Android e app já instalado", () => {
    expect(detectarAmbiente(ANDROID, win()).plataforma).toBe("android");
    expect(detectarAmbiente(ANDROID, win({ displayStandalone: true })).instalado).toBe(true);
    expect(detectarAmbiente(IPHONE_SAFARI, win({ standalone: true })).instalado).toBe(true);
  });
});
