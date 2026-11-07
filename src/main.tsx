import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { capturarConviteDeInstalacao } from "./install/platform";

// O navegador oferece a instalação uma única vez, logo na abertura: guarda para a tela "Como instalar".
capturarConviteDeInstalacao();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: registra o service worker (funciona offline após o primeiro acesso).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
