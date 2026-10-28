/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" para funcionar tanto em hospedagem web (PWA) quanto empacotado no Capacitor.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
