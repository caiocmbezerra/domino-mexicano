import { Copy, Eye, KeyRound, LogOut, MessageCircle, PencilLine, Wifi } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../components/ConfirmDialog";
import { QrCode } from "../components/QrCode";
import { SyncBadge } from "../components/SyncBadge";
import { useToast } from "../components/Toast";
import { SectionTitle, TopBar } from "../components/ui";
import { APP_CONFIG } from "../config";
import { CODIGO_TURMA, linkAcompanhar, linkAnotar, normalizarCodigo } from "../sync/turma";
import { useStore } from "../state/store";

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Placar compartilhado: um celular anota, os outros acompanham ao vivo. */
export function TurmaScreen() {
  const { db, espaco, compartilharTurma, entrarNaTurma, sairDaTurma } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mostrarAnotar, setMostrarAnotar] = useState(false);

  const compartilhar = async () => {
    const ok = await confirm({
      title: "Compartilhar a turma?",
      message: (
        <>
          Jogadores, partidas e histórico deste celular vão para o servidor do app, e outros celulares poderão
          <b> acompanhar ao vivo</b> pelo QR code. Só este celular continua anotando.
        </>
      ),
      confirmLabel: "Compartilhar",
    });
    if (!ok) return;
    setOcupado(true);
    if (await compartilharTurma()) toast.show("Turma compartilhada! Mostre o QR code para quem vai acompanhar.", "success");
    setOcupado(false);
  };

  const entrar = async () => {
    const id = normalizarCodigo(codigo);
    if (!CODIGO_TURMA.test(id)) return toast.show("O código tem 8 letras e números. Confira e tente de novo.", "error");
    setOcupado(true);
    if (await entrarNaTurma(id)) {
      toast.show("Acompanhando a turma ao vivo.", "success");
      navigate("/");
    }
    setOcupado(false);
  };

  const sair = async () => {
    const anotador = espaco.tipo === "turma" && espaco.papel === "anotador";
    const ok = await confirm({
      title: anotador ? "Parar de anotar neste celular?" : "Parar de acompanhar?",
      message: anotador
        ? "Este celular volta a usar só os dados dele, os que estavam aqui antes de compartilhar. A turma continua no servidor, mas só volta a ser anotada por quem tiver o link de anotador."
        : "Este celular volta a usar só os dados dele. A turma continua no servidor; para voltar, escaneie o QR code de novo.",
      confirmLabel: anotador ? "Parar de anotar" : "Parar de acompanhar",
      danger: anotador,
    });
    if (ok) {
      sairDaTurma();
      toast.show("Pronto: este celular voltou para os dados dele.", "success");
    }
  };

  if (espaco.tipo === "local") {
    return (
      <div className="screen">
        <TopBar title="Placar compartilhado" subtitle="Vários celulares, a mesma turma" back="/" />
        <section className="card mt-2 grid gap-3 p-5">
          <Wifi className="text-accent" size={32} />
          <p>
            Hoje as partidas ficam <b>só neste celular</b>. Compartilhando, a turma inteira (jogadores, partidas,
            histórico e estatísticas) fica igual em todos os celulares que entrarem.
          </p>
          <ul className="grid gap-1 text-sm text-muted">
            <li>• Este celular <b className="text-fg">anota</b>: lança rodadas e pontos.</li>
            <li>• Os outros <b className="text-fg">acompanham ao vivo</b>, só olhando, pelo QR code.</li>
            <li>• Precisa de internet para atualizar; sem sinal, o anotador continua e envia depois.</li>
          </ul>
          <button className="btn btn-primary btn-lg w-full" disabled={ocupado} onClick={compartilhar}>
            <Wifi size={22} /> {ocupado ? "Compartilhando…" : "Compartilhar a turma"}
          </button>
        </section>

        <SectionTitle>Já tem um código?</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
        >
          <input
            className="input num uppercase"
            placeholder="Código da turma"
            aria-label="Código da turma"
            value={codigo}
            maxLength={12}
            autoCapitalize="characters"
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button className="btn btn-secondary shrink-0" type="submit" disabled={ocupado || normalizarCodigo(codigo).length !== 8}>
            <Eye size={20} /> Acompanhar
          </button>
        </form>
        <p className="mt-2 text-sm text-muted">Ou escaneie o QR code mostrado no celular de quem anota.</p>
      </div>
    );
  }

  const link = linkAcompanhar(APP_CONFIG.publicUrl, espaco.id);
  const anotador = espaco.papel === "anotador";
  return (
    <div className="screen">
      <TopBar title="Placar compartilhado" subtitle={db.settings.appName} back="/" />

      <section className="card mt-2 flex items-center gap-3 p-4">
        {anotador ? <PencilLine className="shrink-0 text-accent" /> : <Eye className="shrink-0 text-accent" />}
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{anotador ? "Este celular anota a turma" : "Este celular acompanha a turma"}</div>
          <div className="text-sm text-muted">
            {anotador ? "Rodadas e pontos lançados aqui aparecem nos outros celulares." : "A planilha se atualiza sozinha; só o anotador altera."}
          </div>
          <div className="mt-2">
            <SyncBadge />
          </div>
        </div>
      </section>

      <SectionTitle>Convidar para acompanhar</SectionTitle>
      <section className="card flex flex-col items-center gap-3 p-5 text-center">
        <QrCode text={link} label={`QR code para acompanhar a turma ${espaco.id}`} />
        <div>
          <div className="label">Código da turma</div>
          <div className="num text-3xl font-black tracking-widest">{espaco.id}</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={async () => toast.show((await copiar(link)) ? "Link copiado!" : link, "success")}>
            <Copy size={20} /> Copiar
          </button>
          <a
            className="btn btn-secondary"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Acompanhe o placar do dominó ao vivo: ${link}`)}`}
          >
            <MessageCircle size={20} /> WhatsApp
          </a>
        </div>
      </section>

      {anotador && (
        <>
          <SectionTitle>Outro celular vai anotar?</SectionTitle>
          {!mostrarAnotar ? (
            <button className="btn btn-ghost w-full" onClick={() => setMostrarAnotar(true)}>
              <KeyRound size={20} /> Mostrar QR code de anotador
            </button>
          ) : (
            <section className="card flex flex-col items-center gap-3 border-danger p-5 text-center">
              <p className="text-sm font-bold text-danger">
                Quem escanear este código também poderá lançar e alterar pontos. Mostre só para quem vai anotar.
              </p>
              <QrCode text={linkAnotar(APP_CONFIG.publicUrl, espaco.id, espaco.chave)} label="QR code de anotador" />
              <p className="text-sm text-muted">
                Para evitar confusão, depois que o outro celular começar a anotar, use "Parar de anotar" neste aqui.
              </p>
              <button className="btn btn-ghost w-full" onClick={() => setMostrarAnotar(false)}>
                Esconder
              </button>
            </section>
          )}
        </>
      )}

      <button className="btn btn-ghost mt-8 w-full text-danger" onClick={sair}>
        <LogOut size={20} /> {anotador ? "Parar de anotar neste celular" : "Parar de acompanhar"}
      </button>
    </div>
  );
}
