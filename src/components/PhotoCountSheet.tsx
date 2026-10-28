import { AlertTriangle, Camera, Check, ImagePlus, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { contarPecas, prepararFoto } from "../photo/api";
import { PIP_COLORS } from "./DominoTile";
import { haptic } from "./ui";

interface PecaEditavel {
  id: number;
  a: number;
  b: number;
  conferir: boolean;
}

type Estado =
  | { fase: "escolher" }
  | { fase: "contando"; previa: string }
  | { fase: "conferir"; previa: string; avisos: string[] }
  | { fase: "erro"; previa: string | null; mensagem: string };

const VALORES = Array.from({ length: 13 }, (_, i) => i);

function Metade({ valor }: { valor: number }) {
  return (
    <span
      className="num flex h-9 w-9 items-center justify-center text-lg font-black"
      style={{ color: valor === 0 ? "var(--tile-edge)" : PIP_COLORS[valor] }}
    >
      {valor}
    </span>
  );
}

/** Peça desenhada em miniatura (marfim, com o número de cada metade na cor do conjunto). */
function MiniPeca({ a, b }: { a: number; b: number }) {
  return (
    <span className="inline-flex items-center rounded-lg border-2 border-[var(--tile-edge)] bg-[var(--tile)]">
      <Metade valor={a} />
      <span className="h-6 w-0.5 bg-[var(--tile-edge)]" />
      <Metade valor={b} />
    </span>
  );
}

/**
 * Contagem por foto: a IA lista as peças, o operador confere cada uma contra a foto,
 * corrige se precisar e só então aplica o total ao jogador.
 */
export function PhotoCountSheet({
  playerName,
  onApply,
  onClose,
}: {
  playerName: string;
  onApply: (points: number, hadZeroDouble: boolean) => void;
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "escolher" });
  const [pecas, setPecas] = useState<PecaEditavel[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);

  useEffect(() => () => abort.current?.abort(), []);

  const processar = async (arquivo: File) => {
    let previa: string | null = null;
    try {
      const foto = await prepararFoto(arquivo);
      previa = foto.previa;
      setEstado({ fase: "contando", previa });
      abort.current = new AbortController();
      const r = await contarPecas(foto.base64, abort.current.signal);
      if (!r.fotoLegivel) {
        setEstado({ fase: "erro", previa, mensagem: r.observacoes || "Não foi possível ler as peças nesta foto." });
        return;
      }
      setPecas(r.pecas.map((p) => ({ id: ++seq.current, a: p.a, b: p.b, conferir: p.confianca === "baixa" })));
      const avisos: string[] = [];
      if (r.pecasIlegiveis > 0)
        avisos.push(`${r.pecasIlegiveis} ${r.pecasIlegiveis === 1 ? "peça não pôde ser lida" : "peças não puderam ser lidas"}: adicione manualmente.`);
      if (r.descartadas > 0) avisos.push("A IA devolveu valores impossíveis em alguma peça: confira a lista.");
      if (r.observacoes) avisos.push(r.observacoes);
      haptic(20);
      setEstado({ fase: "conferir", previa, avisos });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setEstado({ fase: "erro", previa, mensagem: (e as Error).message || "Não foi possível processar a foto." });
    }
  };

  const onArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void processar(f);
  };

  const total = pecas.reduce((s, p) => s + p.a + p.b, 0);
  const temZero = pecas.some((p) => p.a === 0 && p.b === 0);
  const pendentes = pecas.filter((p) => p.conferir).length;
  const atualizar = (id: number, campo: "a" | "b", v: number) =>
    setPecas((l) => l.map((p) => (p.id === id ? { ...p, [campo]: v, conferir: false } : p)));

  const previa = estado.fase !== "escolher" ? estado.previa : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="foto-titulo" className="modal animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="foto-titulo" className="text-xl font-black">
              Contar por foto
            </h2>
            <p className="truncate text-muted">Peças na mão de {playerName}</p>
          </div>
          <button className="icon-btn -mr-2 -mt-2" aria-label="Fechar contagem por foto" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onArquivo} aria-label="Tirar foto das peças" />
        <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={onArquivo} aria-label="Escolher foto das peças" />

        {previa && (
          <img src={previa} alt={`Foto das peças de ${playerName}`} className="mt-4 max-h-[32dvh] w-full rounded-2xl object-contain bg-surface" />
        )}

        {estado.fase === "escolher" && (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-muted">
              Vire as peças para cima, separadas umas das outras, com boa luz e sem reflexo. Uma foto por
              jogador.
            </p>
            <button className="btn btn-primary btn-lg w-full" onClick={() => camera.current?.click()}>
              <Camera size={22} /> Tirar foto
            </button>
            <button className="btn btn-secondary w-full" onClick={() => galeria.current?.click()}>
              <ImagePlus size={20} /> Escolher da galeria
            </button>
          </div>
        )}

        {estado.fase === "contando" && (
          <div className="mt-4 flex items-center justify-center gap-3 py-4 text-lg font-bold" role="status">
            <span className="h-6 w-6 animate-spin rounded-full border-4 border-line border-t-accent" />
            Contando as peças…
          </div>
        )}

        {estado.fase === "erro" && (
          <div className="mt-4 grid gap-3">
            <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-danger">
              <AlertTriangle className="shrink-0" size={20} />
              <span className="font-semibold">{estado.mensagem}</span>
            </div>
            <button className="btn btn-primary w-full" onClick={() => camera.current?.click()}>
              <RotateCcw size={20} /> Tirar outra foto
            </button>
            <button className="btn btn-ghost w-full" onClick={onClose}>
              Digitar os pontos
            </button>
          </div>
        )}

        {estado.fase === "conferir" && (
          <div className="mt-4">
            {estado.avisos.map((a) => (
              <p key={a} className="mb-2 flex gap-2 rounded-xl bg-accent-soft p-3 text-sm font-semibold">
                <AlertTriangle className="shrink-0 text-accent" size={18} /> {a}
              </p>
            ))}
            <div className="mb-2 flex items-baseline justify-between">
              <span className="label">Confira cada peça com a foto</span>
              <span className="text-sm text-muted">{pecas.length} peças</span>
            </div>
            <ul className="grid gap-2">
              {pecas.map((p, i) => (
                <li key={p.id} className={`min-w-0 rounded-xl border p-2 ${p.conferir ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
                  <div className="flex items-center gap-3">
                    <span className="num w-5 text-sm font-bold text-muted">{i + 1}</span>
                    <MiniPeca a={p.a} b={p.b} />
                    <span className="num min-w-0 flex-1 whitespace-nowrap text-lg font-extrabold">= {p.a + p.b}</span>
                    <button className="icon-btn !h-10 !w-10" aria-label={`Corrigir peça ${i + 1}`} onClick={() => setEditando(editando === p.id ? null : p.id)}>
                      <Pencil size={18} />
                    </button>
                    <button
                      className="icon-btn !h-10 !w-10 text-danger"
                      aria-label={`Remover peça ${i + 1}`}
                      onClick={() => setPecas((l) => l.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {p.conferir && editando !== p.id && (
                    <p className="ml-8 mt-1 text-sm font-bold text-accent">Conferir: a IA ficou em dúvida</p>
                  )}
                  {editando === p.id && (
                    <div className="mt-2 flex items-center gap-2">
                      {(["a", "b"] as const).map((campo) => (
                        <select
                          key={campo}
                          className="input !min-h-12 flex-1"
                          aria-label={`Peça ${i + 1}, ${campo === "a" ? "primeira" : "segunda"} metade`}
                          value={p[campo]}
                          onChange={(e) => atualizar(p.id, campo, Number(e.target.value))}
                        >
                          {VALORES.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ))}
                      <button className="btn btn-secondary !min-h-12 !px-4" onClick={() => setEditando(null)}>
                        <Check size={18} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button
              className="btn btn-ghost mt-2 w-full"
              onClick={() => {
                const id = ++seq.current;
                setPecas((l) => [...l, { id, a: 0, b: 0, conferir: true }]);
                setEditando(id);
              }}
            >
              <Plus size={18} /> Adicionar peça que faltou
            </button>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface p-4">
              <div>
                <div className="label">Total das peças</div>
                {temZero && <div className="text-sm font-bold text-accent">Inclui o 0-0</div>}
              </div>
              <div className="num text-5xl font-black">{total}</div>
            </div>
            {pendentes > 0 && (
              <p className="mt-2 text-sm text-muted">
                {pendentes} {pendentes === 1 ? "peça marcada" : "peças marcadas"} para conferir: corrija ou confirme olhando a foto.
              </p>
            )}
            <div className="mt-4 grid gap-2">
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={() => {
                  haptic(25);
                  onApply(total, temZero);
                }}
              >
                <Check size={22} /> Usar {total} pontos{temZero ? " e marcar 0-0" : ""}
              </button>
              <button className="btn btn-ghost w-full" onClick={() => camera.current?.click()}>
                <RotateCcw size={18} /> Tirar outra foto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
