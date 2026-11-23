import { Link } from "react-router-dom";
import { useStore } from "../state/store";

const ROTULOS = {
  "ao-vivo": { texto: "Ao vivo", cor: "bg-good" },
  sincronizado: { texto: "Sincronizado", cor: "bg-good" },
  enviando: { texto: "Enviando…", cor: "bg-accent" },
  "sem-conexao": { texto: "Sem conexão", cor: "bg-danger" },
} as const;

/** Situação do placar compartilhado (só aparece quando o aparelho está numa turma). */
export function SyncBadge() {
  const { espaco, status } = useStore();
  if (espaco.tipo !== "turma" || status === "local") return null;
  const r = ROTULOS[status];
  return (
    <Link
      to="/turma"
      className="inline-flex items-center gap-1.5 rounded-full bg-card-2 px-2.5 py-1 text-xs font-extrabold"
      aria-label={`Placar compartilhado: ${r.texto}, turma ${espaco.id}${espaco.papel === "espectador" ? ", só acompanhando" : ", anotando"}`}
    >
      <span className={`h-2 w-2 rounded-full ${r.cor} ${status === "ao-vivo" || status === "enviando" ? "animate-pulse" : ""}`} />
      {r.texto}
      <span className="num text-muted">· {espaco.id}</span>
    </Link>
  );
}
