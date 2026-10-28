/** Peça de dominó desenhada em SVG, com as cores tradicionais dos conjuntos duplo-12. */

const L = 0.24;
const C = 0.5;
const R = 0.76;
const ROWS4 = [0.19, 0.397, 0.603, 0.81];

const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[C, C]],
  2: [[L, L], [R, R]],
  3: [[L, L], [C, C], [R, R]],
  4: [[L, L], [R, L], [L, R], [R, R]],
  5: [[L, L], [R, L], [C, C], [L, R], [R, R]],
  6: [[L, L], [R, L], [L, C], [R, C], [L, R], [R, R]],
  7: [[L, L], [R, L], [L, C], [C, C], [R, C], [L, R], [R, R]],
  8: ROWS4.flatMap((y) => [[L, y], [R, y]] as [number, number][]),
  9: [L, C, R].flatMap((y) => [[L, y], [C, y], [R, y]] as [number, number][]),
  10: [...ROWS4.flatMap((y) => [[L, y], [R, y]] as [number, number][]), [C, 0.3], [C, 0.7]],
  11: [...ROWS4.flatMap((y) => [[L, y], [R, y]] as [number, number][]), [C, 0.25], [C, 0.5], [C, 0.75]],
  12: ROWS4.flatMap((y) => [[L, y], [C, y], [R, y]] as [number, number][]),
};

export const PIP_COLORS: Record<number, string> = {
  0: "#1f2937",
  1: "#0284c7",
  2: "#15803d",
  3: "#dc2626",
  4: "#92400e",
  5: "#1d4ed8",
  6: "#a16207",
  7: "#7c3aed",
  8: "#047857",
  9: "#475569",
  10: "#ea580c",
  11: "#111827",
  12: "#be185d",
};

interface Props {
  value: number;
  /** Largura em px (a altura é o dobro). */
  size?: number;
  dimmed?: boolean;
  className?: string;
}

function Half({ value, offsetY }: { value: number; offsetY: number }) {
  const r = value >= 10 ? 0.068 : 0.08;
  return (
    <g transform={`translate(0 ${offsetY})`}>
      {PIPS[value]?.map(([x, y], i) => (
        <circle key={i} cx={x * 100} cy={y * 100} r={r * 100} fill={PIP_COLORS[value]} />
      ))}
    </g>
  );
}

export function DominoTile({ value, size = 56, dimmed = false, className = "" }: Props) {
  const label = `Carroção ${value}-${value}`;
  return (
    <svg
      viewBox="0 0 100 200"
      width={size}
      height={size * 2}
      role="img"
      aria-label={label}
      className={`domino-tile ${dimmed ? "opacity-30" : ""} ${className}`}
    >
      <rect x="2" y="2" width="96" height="196" rx="14" fill="var(--tile)" stroke="var(--tile-edge)" strokeWidth="3" />
      <line x1="12" y1="100" x2="88" y2="100" stroke="var(--tile-edge)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="100" r="4" fill="var(--tile-edge)" />
      <Half value={value} offsetY={0} />
      <Half value={value} offsetY={100} />
    </svg>
  );
}
