import { HashRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/Toast";
import { StoreProvider } from "./state/store";
import { FinishScreen } from "./screens/FinishScreen";
import { GlobalStatsScreen } from "./screens/GlobalStatsScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { NewMatchScreen } from "./screens/NewMatchScreen";
import { OpeningScreen } from "./screens/OpeningScreen";
import { PlayerDetailScreen } from "./screens/PlayerDetailScreen";
import { PlayersScreen } from "./screens/PlayersScreen";
import { RoundScreen } from "./screens/RoundScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

// HashRouter: funciona igual na web, como PWA e empacotado (Capacitor), sem configurar o servidor.
// VITE_ROUTER=memory: navegação só em memória, para hospedagens que não permitem mexer no endereço
// (ex.: página de demonstração). Os dados continuam salvos no aparelho normalmente.
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : HashRouter;
export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <ConfirmProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/jogadores" element={<PlayersScreen />} />
              <Route path="/jogadores/:playerId" element={<PlayerDetailScreen />} />
              <Route path="/nova" element={<NewMatchScreen />} />
              <Route path="/partida/:matchId" element={<MatchScreen />} />
              <Route path="/partida/:matchId/abertura" element={<OpeningScreen />} />
              <Route path="/partida/:matchId/rodada/:roundId" element={<RoundScreen />} />
              <Route path="/partida/:matchId/encerrar" element={<FinishScreen />} />
              <Route path="/historico" element={<HistoryScreen />} />
              <Route path="/estatisticas" element={<GlobalStatsScreen />} />
              <Route path="/ajustes" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </ConfirmProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
