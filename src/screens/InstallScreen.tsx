import { CheckCircle2, Copy, Download, MessageCircle, MoreVertical, PlusSquare, Share, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { QrCode } from "../components/QrCode";
import { useToast } from "../components/Toast";
import { SectionTitle, TopBar } from "../components/ui";
import { APP_CONFIG } from "../config";
import {
  aoMudarConvite,
  detectarAmbiente,
  instalarDireto,
  podeInstalarDireto,
  type Plataforma,
} from "../install/platform";
import { useStore } from "../state/store";

const ABAS: { id: Plataforma; label: string }[] = [
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "computador", label: "Computador" },
];

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-black text-accent-fg">
        {n}
      </span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

/** Ícone em linha com o texto, para a pessoa reconhecer o botão na tela do celular. */
function Icone({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-0.5 items-center rounded-md bg-card-2 px-1 py-0.5 align-baseline">
      {children}
    </span>
  );
}

export function InstallScreen() {
  const { db } = useStore();
  const toast = useToast();
  const ambiente = detectarAmbiente();
  const [aba, setAba] = useState<Plataforma>(ambiente.plataforma);
  const [direto, setDireto] = useState(podeInstalarDireto());
  useEffect(() => {
    const sair = aoMudarConvite(() => setDireto(podeInstalarDireto()));
    return () => {
      sair();
    };
  }, []);

  const url = APP_CONFIG.publicUrl;
  const convite = `Placar do Dominó Mexicano da turma: ${url}\nNo iPhone, abra no Safari e toque em Compartilhar → Adicionar à Tela de Início. No Android, abra no Chrome e toque em ⋮ → Instalar app.`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Link copiado!", "success");
    } catch {
      toast.show(url, "info");
    }
  };

  return (
    <div className="screen">
      <TopBar title="Como instalar" subtitle="Instale no celular e convide a turma" back="/" />

      {ambiente.instalado && (
        <div className="card mt-2 flex items-center gap-3 border-good p-4">
          <CheckCircle2 className="shrink-0 text-good" />
          <p className="font-bold">Você já está usando o app instalado neste aparelho.</p>
        </div>
      )}

      <SectionTitle>Convidar a turma</SectionTitle>
      <section className="card flex flex-col items-center gap-3 p-5 text-center">
        <QrCode text={url} label={`QR code do endereço ${url}`} />
        <p className="text-sm text-muted">Aponte a câmera do celular para o código, ou envie o link.</p>
        <p className="num break-all rounded-lg bg-surface px-3 py-2 text-sm font-bold">{url}</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <button className="btn btn-secondary" onClick={copiar}>
            <Copy size={20} /> Copiar
          </button>
          <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(convite)}`} target="_blank" rel="noreferrer">
            <MessageCircle size={20} /> WhatsApp
          </a>
        </div>
        {typeof navigator.share === "function" && (
          <button
            className="btn btn-ghost w-full"
            onClick={() => navigator.share({ title: db.settings.appName, text: convite }).catch(() => undefined)}
          >
            <Share2 size={20} /> Compartilhar
          </button>
        )}
      </section>

      <SectionTitle>Passo a passo</SectionTitle>
      <div className="tabs" role="tablist" aria-label="Tipo de aparelho">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="card mt-3 p-5" role="tabpanel">
        {aba === "iphone" && (
          <>
            {ambiente.iosForaDoSafari && (
              <p className="mb-4 rounded-xl bg-danger-soft p-3 font-bold text-danger">
                Você está em outro navegador. No iPhone, só o Safari instala o app: copie o link e abra no Safari.
              </p>
            )}
            <ol className="grid gap-4">
              <Passo n={1}>
                Abra <b>{url.replace("https://", "")}</b> no <b>Safari</b>.
              </Passo>
              <Passo n={2}>
                Toque em <b>Compartilhar</b>{" "}
                <Icone>
                  <Share size={16} />
                </Icone>{" "}
                na barra do Safari (embaixo ou em cima, conforme o modelo).
              </Passo>
              <Passo n={3}>
                Role a lista e toque em <b>Adicionar à Tela de Início</b>{" "}
                <Icone>
                  <PlusSquare size={16} />
                </Icone>
                , depois em <b>Adicionar</b>.
              </Passo>
              <Passo n={4}>Abra pelo ícone do dominó na tela de início: o app abre em tela cheia e funciona sem internet.</Passo>
            </ol>
            <p className="mt-4 text-sm text-muted">
              Use sempre pelo ícone. No iPhone, sites abertos só numa aba do Safari podem ter os dados apagados após
              alguns dias sem uso; instalado na tela de início, isso não acontece.
            </p>
          </>
        )}

        {aba === "android" && (
          <>
            {direto && !ambiente.instalado && (
              <button
                className="btn btn-primary btn-lg mb-4 w-full"
                onClick={async () => {
                  if (await instalarDireto()) toast.show("App instalado!", "success");
                }}
              >
                <Smartphone size={22} /> Instalar agora
              </button>
            )}
            <ol className="grid gap-4">
              <Passo n={1}>
                Abra <b>{url.replace("https://", "")}</b> no <b>Chrome</b>.
              </Passo>
              <Passo n={2}>
                Toque no menu{" "}
                <Icone>
                  <MoreVertical size={16} />
                </Icone>{" "}
                no canto de cima.
              </Passo>
              <Passo n={3}>
                Toque em <b>Instalar app</b> (em alguns aparelhos: <b>Adicionar à tela inicial</b>) e confirme.
              </Passo>
            </ol>
            <div className="mt-5 rounded-xl bg-surface p-4">
              <p className="font-extrabold">Prefere o arquivo de instalação (APK)?</p>
              <p className="mt-1 text-sm text-muted">
                Baixe, abra o arquivo e permita "instalar apps desta fonte". O Android pode avisar que o app não veio da
                Play Store: é esperado. Para atualizar, instale a versão nova por cima; as partidas são mantidas.
              </p>
              <a className="btn btn-secondary mt-3 w-full" href={APP_CONFIG.apkUrl} target="_blank" rel="noreferrer">
                <Download size={20} /> Baixar APK
              </a>
            </div>
          </>
        )}

        {aba === "computador" && (
          <ol className="grid gap-4">
            <Passo n={1}>
              Abra <b>{url.replace("https://", "")}</b> no Chrome ou no Edge.
            </Passo>
            <Passo n={2}>
              Clique no ícone de instalar na barra de endereço (um monitor com uma seta) ou, no menu, em <b>Instalar</b>.
            </Passo>
            <Passo n={3}>Ou apenas use pelo navegador: funciona do mesmo jeito.</Passo>
          </ol>
        )}
      </div>

      <SectionTitle>Bom saber</SectionTitle>
      <ul className="card grid gap-2 p-4 text-sm">
        <li>• Não precisa de conta nem de loja. O app é gratuito e funciona sem internet depois de instalado.</li>
        <li>
          • As partidas ficam salvas <b>no aparelho</b> de quem anota. Só quem registra o jogo precisa do app; os outros
          podem só acompanhar a tela.
        </li>
        <li>
          • Para trocar de celular, use <b>Ajustes → Exportar</b> no antigo e <b>Importar</b> no novo.
        </li>
      </ul>
    </div>
  );
}
