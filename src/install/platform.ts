/** Detecção do aparelho e do modo de uso, para mostrar o passo a passo certo de instalação. */

export type Plataforma = "iphone" | "android" | "computador";

export interface Ambiente {
  plataforma: Plataforma;
  /** Já está rodando como app instalado (tela de início ou APK). */
  instalado: boolean;
  /** iPhone/iPad fora do Safari: lá não existe "Adicionar à Tela de Início". */
  iosForaDoSafari: boolean;
}

export function detectarAmbiente(
  ua: string = navigator.userAgent,
  w: Window & typeof globalThis = window,
): Ambiente {
  // iPadOS se apresenta como Mac; o toque denuncia.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (w.navigator?.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(ua);
  const capacitor = Boolean((w as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const standalone =
    capacitor ||
    Boolean(w.matchMedia?.("(display-mode: standalone)").matches) ||
    Boolean((w.navigator as Navigator & { standalone?: boolean }).standalone);
  return {
    plataforma: ios ? "iphone" : android ? "android" : "computador",
    instalado: standalone,
    iosForaDoSafari: ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua),
  };
}

// ---------------------------------------------------------------- Instalação direta (Chrome/Android)

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendente: BeforeInstallPromptEvent | null = null;
const ouvintes = new Set<() => void>();

/** Guarda o convite de instalação do navegador (precisa ser registrado logo na abertura). */
export function capturarConviteDeInstalacao() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pendente = e as BeforeInstallPromptEvent;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    pendente = null;
    ouvintes.forEach((f) => f());
  });
}

export function podeInstalarDireto() {
  return pendente !== null;
}

export function aoMudarConvite(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Abre o diálogo nativo de instalação. Retorna true se a pessoa aceitou. */
export async function instalarDireto(): Promise<boolean> {
  if (!pendente) return false;
  const e = pendente;
  pendente = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  ouvintes.forEach((f) => f());
  return outcome === "accepted";
}
