/**
 * Configurações centrais do aplicativo. O nome exibido pode ser alterado aqui (padrão)
 * ou pelo usuário na tela "Ajustes" (fica salvo no aparelho).
 */
export const APP_CONFIG = {
  defaultAppName: "Dominó Mexicano — Placar",
  /** Conjunto duplo-12: carroções de 12-12 até 0-0. */
  highestDouble: 12,
  minPlayers: 2,
  maxPlayers: 12,
  storageKey: "domino-mexicano-placar:v1",
  /** Endereço público do app (usado no QR code e no convite). */
  publicUrl: "https://caiocmbezerra.github.io/domino-mexicano/",
  /** APK Android de instalação direta, gerado pelo GitHub Actions. */
  apkUrl: "https://github.com/caiocmbezerra/domino-mexicano/releases/download/android/domino-placar.apk",
  /**
   * Endereço completo da função de contagem por foto na Vercel, usado pelo site do GitHub
   * Pages e pelo APK (o build da própria Vercel usa o mesmo domínio). Vazio = desligada.
   */
  contagemUrl: "",
} as const;

/**
 * Contagem de pontos por foto (opcional): endereço da função da Vercel (api/contar-pecas.ts).
 * - Variável VITE_CONTAGEM_URL no build, se definida;
 * - senão, no build feito pela própria Vercel, "/api/contar-pecas" (mesmo domínio);
 * - senão, APP_CONFIG.contagemUrl (site do GitHub Pages e APK);
 * - senão, desligada (o botão de câmera não aparece). Ver README, "Contagem por foto".
 */
declare const __CONTAGEM_PADRAO__: string;
export const PHOTO_COUNT = {
  url: (import.meta.env.VITE_CONTAGEM_URL as string | undefined) || __CONTAGEM_PADRAO__ || APP_CONFIG.contagemUrl,
  get enabled() {
    return Boolean(this.url);
  },
};
