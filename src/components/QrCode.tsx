import qrcode from "qrcode-generator";
import { useMemo } from "react";

/**
 * QR code desenhado em SVG, gerado no próprio aparelho (funciona sem internet).
 * Sempre preto sobre branco: é o que as câmeras leem melhor, em qualquer tema.
 */
export function QrCode({ text, size = 220, label }: { text: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < count; r++)
      for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { path: d, n: count };
  }, [text]);
  const margin = 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${n + margin * 2} ${n + margin * 2}`}
      shapeRendering="crispEdges"
      className="rounded-xl"
      style={{ background: "#ffffff", maxWidth: "100%", height: "auto" }}
    >
      <path d={path} fill="#000000" />
    </svg>
  );
}
