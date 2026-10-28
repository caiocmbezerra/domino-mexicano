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
} as const;

/**
 * Contagem de pontos por foto (opcional). Fica desligada até existirem as variáveis
 * VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build — ver README, "Contagem por foto".
 */
export const PHOTO_COUNT = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "",
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  get enabled() {
    return Boolean(this.url && this.anonKey);
  },
};
