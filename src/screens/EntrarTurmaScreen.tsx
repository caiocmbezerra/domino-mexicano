import { Eye, PencilLine } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { TopBar } from "../components/ui";
import { useToast } from "../components/Toast";
import { CODIGO_TURMA, normalizarCodigo } from "../sync/turma";
import { useStore } from "../state/store";

/** Aberto pelo QR code: #/entrar/CODIGO (acompanhar) ou #/anotar/CODIGO/CHAVE (anotar). */
export function EntrarTurmaScreen({ modo }: { modo: "acompanhar" | "anotar" }) {
  const { id: bruto = "", chave = "" } = useParams();
  const id = normalizarCodigo(bruto);
  const { espaco, entrarNaTurma, anotarTurma } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);

  if (!CODIGO_TURMA.test(id) || (modo === "anotar" && !chave)) {
    return (
      <div className="screen">
        <TopBar title="Placar compartilhado" back="/" />
        <p className="card mt-2 p-4">Este link de turma está incompleto. Peça o QR code de novo a quem anota.</p>
      </div>
    );
  }
  const jaEsta =
    espaco.tipo === "turma" && espaco.id === id && (modo === "acompanhar" || espaco.papel === "anotador");
  if (jaEsta) return <Navigate to="/" replace />;

  const confirmar = async () => {
    setOcupado(true);
    const ok = modo === "anotar" ? await anotarTurma(id, chave) : await entrarNaTurma(id);
    setOcupado(false);
    if (ok) {
      toast.show(modo === "anotar" ? "Este celular agora anota a turma." : "Acompanhando a turma ao vivo.", "success");
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="screen">
      <TopBar title="Placar compartilhado" back="/" />
      <section className="card mt-2 grid gap-3 p-5">
        {modo === "anotar" ? <PencilLine className="text-accent" size={32} /> : <Eye className="text-accent" size={32} />}
        <h2 className="text-xl font-black">
          {modo === "anotar" ? "Anotar a turma neste celular?" : "Acompanhar a turma ao vivo?"}
        </h2>
        <p className="num text-2xl font-black tracking-widest">{id}</p>
        <p className="text-muted">
          {modo === "anotar"
            ? "Este celular poderá lançar rodadas e pontos da turma. Os dados que já estão neste celular ficam guardados à parte."
            : "Você verá jogadores, partidas e a planilha se atualizando sozinhos. Os dados que já estão neste celular ficam guardados à parte."}
        </p>
        <button className="btn btn-primary btn-lg w-full" disabled={ocupado} onClick={confirmar}>
          {ocupado ? "Conectando…" : modo === "anotar" ? "Anotar neste celular" : "Acompanhar"}
        </button>
        <button className="btn btn-ghost w-full" onClick={() => navigate("/", { replace: true })}>
          Agora não
        </button>
      </section>
    </div>
  );
}
