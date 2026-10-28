import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/** Pequena vibração de confirmação (ignorada onde não há suporte). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem suporte */
  }
}

export function TopBar({
  title,
  subtitle,
  back,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rota de retorno; "history" volta uma página. */
  back?: string | "history";
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back ? (
        <button
          className="icon-btn -ml-2"
          aria-label="Voltar"
          onClick={() => (back === "history" ? navigate(-1) : navigate(back))}
        >
          <ChevronLeft size={28} />
        </button>
      ) : (
        <span className="w-1" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold leading-tight">{title}</h1>
        {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch disabled:opacity-40"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 text-muted">{icon}</div>
      <p className="text-lg font-extrabold">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="label">{children}</h2>
      {right}
    </div>
  );
}

export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="bottom-bar">
      <div>{children}</div>
    </div>
  );
}

/** Medalha/posição exibida no ranking. */
export function PositionBadge({ position, tied }: { position: number; tied?: boolean }) {
  const colors: Record<number, string> = {
    1: "bg-accent text-accent-fg",
    2: "bg-[#cbd5e1] text-[#0f172a]",
    3: "bg-[#d4a373] text-[#2a1606]",
  };
  return (
    <div
      className={`num flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full text-lg font-black leading-none ${
        colors[position] ?? "bg-card-2 text-fg"
      }`}
      aria-label={`${position}º lugar${tied ? ", empatado" : ""}`}
    >
      {position}º
      {tied && <span className="text-[9px] font-extrabold uppercase">emp.</span>}
    </div>
  );
}
