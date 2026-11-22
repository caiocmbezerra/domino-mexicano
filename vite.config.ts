/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" para funcionar tanto em hospedagem web (PWA) quanto empacotado no Capacitor.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // No build da Vercel a função de contagem fica no mesmo domínio.
  define: { __CONTAGEM_PADRAO__: JSON.stringify(process.env.VERCEL ? "/api/contar-pecas" : "") },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
