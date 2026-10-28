import { ArrowDown, ArrowUp, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddPlayerForm } from "../components/AddPlayerForm";
import { RulesEditor } from "../components/RulesEditor";
import { BottomBar, SectionTitle, TopBar, haptic } from "../components/ui";
import { APP_CONFIG } from "../config";
import { createMatch } from "../domain/operations";
import type { ID, MatchSettings } from "../domain/types";
import { useNameOf, useStore } from "../state/store";

export function NewMatchScreen() {
  const { db, run } = useStore();
  const navigate = useNavigate();
  const nameOf = useNameOf();
  const [selected, setSelected] = useState<ID[]>([]);
  const [rules, setRules] = useState<MatchSettings>(db.settings.defaultMatchSettings);

  const full = selected.length >= APP_CONFIG.maxPlayers;
  const available = db.players
    .filter((p) => !selected.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const add = (id: ID) => {
    if (full) return;
    haptic();
    setSelected((s) => (s.includes(id) ? s : [...s, id]));
  };
  const move = (index: number, delta: number) =>
    setSelected((s) => {
      const next = [...s];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const start = () => {
    const id = run((d) => {
      const r = createMatch(d, selected, rules);
      return { db: r.db, value: r.id };
    });
    if (id) navigate(`/partida/${id}/abertura`, { replace: true });
  };

  return (
    <div className="screen">
      <TopBar title="Nova partida" subtitle="Escolha quem vai jogar" back="/" />

      <SectionTitle right={<span className="num text-sm font-bold text-muted">{selected.length}/{APP_CONFIG.maxPlayers}</span>}>
        Participantes
      </SectionTitle>
      {selected.length === 0 ? (
        <p className="card p-4 text-muted">Toque nos nomes abaixo para incluir na partida (mínimo {APP_CONFIG.minPlayers}).</p>
      ) : (
        <ol className="card divide-y divide-line">
          {selected.map((id, i) => (
            <li key={id} className="flex items-center gap-1 py-1.5 pl-4 pr-1.5 animate-pop">
              <span className="num w-7 font-black text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{nameOf(id)}</span>
              <button className="icon-btn" aria-label={`Subir ${nameOf(id)}`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={20} />
              </button>
              <button
                className="icon-btn"
                aria-label={`Descer ${nameOf(id)}`}
                disabled={i === selected.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={20} />
              </button>
              <button
                className="icon-btn text-danger"
                aria-label={`Remover ${nameOf(id)}`}
                onClick={() => setSelected((s) => s.filter((x) => x !== id))}
              >
                <X size={22} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-sm text-muted">
        Esta é apenas a ordem de exibição no placar — a ordem de saída é registrada em cada rodada.
      </p>

      <SectionTitle>Adicionar jogadores</SectionTitle>
      {available.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {available.map((p) => (
            <button key={p.id} className="chip" disabled={full} onClick={() => add(p.id)}>
              <Plus size={18} /> {p.name}
            </button>
          ))}
        </div>
      )}
      <AddPlayerForm onAdded={add} />
      {full && <p className="mt-2 text-sm text-danger">Limite de {APP_CONFIG.maxPlayers} jogadores atingido.</p>}

      <SectionTitle>Regras da turma</SectionTitle>
      <RulesEditor value={rules} onChange={setRules} />

      <BottomBar>
        <button className="btn btn-primary btn-lg w-full" disabled={selected.length < APP_CONFIG.minPlayers} onClick={start}>
          <Play size={22} />
          {selected.length < APP_CONFIG.minPlayers
            ? `Selecione ao menos ${APP_CONFIG.minPlayers} jogadores`
            : `Iniciar partida com ${selected.length}`}
        </button>
      </BottomBar>
    </div>
  );
}
