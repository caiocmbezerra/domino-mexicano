import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useToast } from "./Toast";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores sem Clipboard API (ou fora de contexto seguro).
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Compartilhamento nativo do aparelho, cópia do texto e atalho para o WhatsApp. */
export function ShareButtons({ text, title }: { text: string; title: string }) {
  const toast = useToast();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="grid gap-2">
      {canShare && (
        <button
          className="btn btn-primary w-full"
          onClick={() => navigator.share({ title, text }).catch(() => undefined)}
        >
          <Share2 size={20} /> Compartilhar resultado
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn btn-secondary"
          onClick={async () =>
            toast.show((await copyText(text)) ? "Resumo copiado!" : "Não foi possível copiar.", "success")
          }
        >
          <Copy size={20} /> Copiar texto
        </button>
        <a
          className="btn btn-secondary"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={20} /> WhatsApp
        </a>
      </div>
      <details className="card p-3">
        <summary className="cursor-pointer font-bold">Ver texto do resumo</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{text}</pre>
      </details>
    </div>
  );
}
