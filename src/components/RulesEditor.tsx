import { ArrowDown, ArrowUp } from "lucide-react";
import { TIE_BREAKER_LABELS } from "../domain/stats";
import type { MatchSettings, TieBreaker } from "../domain/types";
import { Switch } from "./ui";

const ALL: TieBreaker[] = ["zeroDoubles", "wins", "lowestMaxRound"];

/** Configuração das regras da turma: regra do 0-0 e critérios de desempate. */
export function RulesEditor({ value, onChange }: { value: MatchSettings; onChange: (v: MatchSettings) => void }) {
  const active = value.tieBreakers;
  const inactive = ALL.filter((t) => !active.includes(t));

  const move = (index: number, delta: number) => {
    const next = [...active];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange({ ...value, tieBreakers: next });
  };

  return (
    <div className="grid gap-3">
      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="font-extrabold">Quem termina com o 0-0 marca zero</div>
          <div className="text-sm text-muted">
            Regra da turma. A ocorrência é registrada à parte e pode servir de desempate.
          </div>
        </div>
        <Switch
          label="Quem termina com o 0-0 marca zero"
          checked={value.zeroDoubleScoresZero}
          onChange={(v) => onChange({ ...value, zeroDoubleScoresZero: v })}
        />
      </div>

      <div className="card p-4">
        <div className="font-extrabold">Critérios de desempate</div>
        <div className="text-sm text-muted">
          1º critério é sempre a menor pontuação acumulada. Se ainda empatar, aplica os critérios abaixo
          na ordem. Persistindo, os jogadores ficam empatados.
        </div>
        <ol className="mt-3 grid gap-2">
          {active.map((t, i) => (
            <li key={t} className="flex items-center gap-2 rounded-xl bg-surface p-2 pl-3">
              <span className="num w-6 font-black text-accent">{i + 2}º</span>
              <span className="flex-1 font-semibold">{TIE_BREAKER_LABELS[t]}</span>
              <button className="icon-btn" aria-label="Subir critério" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={20} />
              </button>
              <button className="icon-btn" aria-label="Descer critério" disabled={i === active.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={20} />
              </button>
              <Switch
                label={`Usar critério: ${TIE_BREAKER_LABELS[t]}`}
                checked
                onChange={() => onChange({ ...value, tieBreakers: active.filter((x) => x !== t) })}
              />
            </li>
          ))}
          {inactive.map((t) => (
            <li key={t} className="flex items-center gap-2 rounded-xl p-2 pl-3 opacity-80">
              <span className="w-6" />
              <span className="flex-1 font-semibold text-muted">{TIE_BREAKER_LABELS[t]}</span>
              <Switch
                label={`Usar critério: ${TIE_BREAKER_LABELS[t]}`}
                checked={false}
                onChange={() => onChange({ ...value, tieBreakers: [...active, t] })}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
