/**
 * Locomate illustration library. Inline SVG, single-weight ink lines.
 *
 * Drawn from /Bộ Nhận Diện/Moodboard.jpg and the heritage references
 * itemised in the canvas brand sheet (see
 * `~/.cursor/projects/c-Dev-locomate/canvases/locomate-design-system.canvas.tsx`):
 *
 *   - DongSonSun / DrumRing  → Đông Sơn bronze drum (~2nd c. BCE)
 *   - HoiVanBand             → ceramic key border, Lý / Trần dynasty pottery
 *   - Waves                  → imperial wave pattern, Nguyễn-dynasty robes
 *   - CloudScroll            → 'triện văn' cloud scrolls
 *   - Lotus                  → 'sen', altar lotus from above
 *   - MamCom                 → ceramic family-meal tray
 *   - ConicalHat             → 'nón lá' silhouette w/ bamboo frame
 *   - PhinFilter             → Vietnamese drip coffee filter
 *   - AoDai                  → 'áo dài' figure
 *   - FolkStar               → 5-pointed folk-emblem star
 *
 * Style rules (enforced by `ce-frontend-design` skill):
 *   01. One ink weight: 1.3 px figures, 1.5 px pattern bands.
 *   02. Stroke is brick or forest (--brick / --secondary). Mustard / sage may
 *       fill, never stroke. Terracotta is reserved for FolkStar.
 *   03. Flat. No shading. No drop-shadow. Halftone OK at 0.8 px.
 */

type IllusProps = { color?: string; size?: number; className?: string };
type BandProps = {
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  className?: string;
};

// CSS-var defaults so callers without an explicit color inherit the brand.
const DEFAULT_INK = "var(--brick)";
const DEFAULT_FOREST = "var(--secondary)";
const DEFAULT_TERRACOTTA = "var(--primary)";
const DEFAULT_PARCHMENT = "var(--parchment)";

export function DongSonSun({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const c = size / 2;
  const spokes = 12;
  const innerR = size * 0.075;
  const spokeStart = innerR + size * 0.03;
  const spokeEnd = size * 0.3;
  const ringR = size * 0.4;
  const dotR = size * 0.46;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <circle cx={c} cy={c} r={innerR} fill={color} />
      {Array.from({ length: spokes }).map((_, i) => {
        const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={c + spokeStart * Math.cos(a)}
            y1={c + spokeStart * Math.sin(a)}
            x2={c + spokeEnd * Math.cos(a)}
            y2={c + spokeEnd * Math.sin(a)}
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={c} cy={c} r={ringR} fill="none" stroke={color} strokeWidth={1} />
      {Array.from({ length: 28 }).map((_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={c + dotR * Math.cos(a)}
            cy={c + dotR * Math.sin(a)}
            r={0.9}
            fill={color}
          />
        );
      })}
    </svg>
  );
}

export function DrumRing({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} fill="none" strokeWidth={1}>
        <circle cx={c} cy={c} r={size * 0.46} />
        <circle cx={c} cy={c} r={size * 0.36} />
        <circle cx={c} cy={c} r={size * 0.26} strokeDasharray="2 2.2" />
        <circle cx={c} cy={c} r={size * 0.16} />
      </g>
      <g fill={color}>
        <circle cx={c} cy={c} r={size * 0.05} />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4 - Math.PI / 2;
          const r = size * 0.41;
          const x = c + r * Math.cos(a);
          const y = c + r * Math.sin(a);
          return (
            <g key={i} transform={`rotate(${i * 45} ${x} ${y})`}>
              <path d={`M ${x - 3} ${y + 2} L ${x} ${y - 3} L ${x + 3} ${y + 2} Z`} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function HoiVanBand({
  width = 280,
  height = 32,
  color = DEFAULT_INK,
  opacity = 0.7,
  className,
}: BandProps) {
  const unit = 32;
  const count = Math.ceil(width / unit) + 1;
  return (
    <svg
      viewBox={`0 0 ${count * unit} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <g
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      >
        <line x1={0} y1={height - 1} x2={count * unit} y2={height - 1} />
        {Array.from({ length: count }).map((_, i) => {
          const x = i * unit;
          const top = 4;
          const bot = height - 4;
          return (
            <path
              key={i}
              d={`M ${x} ${bot} L ${x + 4} ${bot} L ${x + 4} ${top + 12} L ${x + 12} ${top + 12} L ${x + 12} ${top + 4} L ${x + 20} ${top + 4} L ${x + 20} ${top + 12} L ${x + 28} ${top + 12} L ${x + 28} ${bot}`}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function Waves({
  width = 280,
  height = 56,
  color = DEFAULT_FOREST,
  opacity = 0.7,
  className,
}: BandProps) {
  const segments = 6;
  const segW = width / segments;
  const wavePath = (yBase: number) => {
    let d = `M 0 ${yBase}`;
    for (let i = 0; i < segments; i++) {
      const x = i * segW;
      d += ` Q ${x + segW / 2} ${yBase - 12} ${x + segW} ${yBase}`;
    }
    return d;
  };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <g stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={opacity}>
        <path d={wavePath(height - 4)} />
        <path d={wavePath(height - 16)} opacity={0.7} />
        <path d={wavePath(height - 28)} opacity={0.4} />
      </g>
    </svg>
  );
}

export function CloudScroll({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d={`M ${c - 28} ${c + 6} Q ${c - 28} ${c - 18} ${c - 10} ${c - 18} Q ${c + 8} ${c - 18} ${c + 8} ${c + 6} M ${c + 8} ${c + 6} Q ${c + 8} ${c - 8} ${c + 18} ${c - 8} Q ${c + 28} ${c - 8} ${c + 28} ${c + 6}`}
        />
        <path
          d={`M ${c - 18} ${c + 6} Q ${c - 18} ${c - 4} ${c - 10} ${c - 4} Q ${c - 2} ${c - 4} ${c - 2} ${c + 6}`}
        />
        <line x1={c - 30} y1={c + 8} x2={c + 30} y2={c + 8} strokeWidth={0.8} opacity={0.4} />
        <circle cx={c - 10} cy={c - 10} r={1.4} fill={color} />
        <circle cx={c + 18} cy={c - 1} r={1.2} fill={color} />
      </g>
    </svg>
  );
}

export function Lotus({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const c = size / 2;
  const petals = 8;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {Array.from({ length: petals }).map((_, i) => {
          const rot = (i * 360) / petals;
          return (
            <g key={i} transform={`rotate(${rot} ${c} ${c})`}>
              <path
                d={`M ${c} ${size * 0.16} Q ${c - size * 0.13} ${c - size * 0.04} ${c} ${c} Q ${c + size * 0.13} ${c - size * 0.04} ${c} ${size * 0.16} Z`}
              />
            </g>
          );
        })}
        {Array.from({ length: petals }).map((_, i) => {
          const rot = (i * 360) / petals + 360 / petals / 2;
          return (
            <g key={`b-${i}`} transform={`rotate(${rot} ${c} ${c})`} opacity={0.45}>
              <path
                d={`M ${c} ${size * 0.28} Q ${c - size * 0.08} ${c - size * 0.02} ${c} ${c - size * 0.02} Q ${c + size * 0.08} ${c - size * 0.02} ${c} ${size * 0.28} Z`}
              />
            </g>
          );
        })}
      </g>
      <circle cx={c} cy={c} r={3.5} fill={color} />
    </svg>
  );
}

export function MamCom({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} fill="none" strokeWidth={1.3} strokeLinecap="round">
        <line
          x1={size * 0.18}
          y1={size * 0.18}
          x2={size * 0.82}
          y2={size * 0.82}
          strokeWidth={0.7}
          opacity={0.55}
        />
        <line
          x1={size * 0.82}
          y1={size * 0.18}
          x2={size * 0.18}
          y2={size * 0.82}
          strokeWidth={0.7}
          opacity={0.55}
        />
        <circle cx={c} cy={c} r={size * 0.46} />
        <circle cx={c} cy={c} r={size * 0.42} strokeWidth={0.6} opacity={0.5} />
        <circle cx={c} cy={c} r={size * 0.1} />
        <circle cx={c} cy={c - size * 0.25} r={size * 0.08} />
        <circle cx={c + size * 0.25} cy={c} r={size * 0.08} />
        <circle cx={c} cy={c + size * 0.25} r={size * 0.08} />
        <circle cx={c - size * 0.25} cy={c} r={size * 0.08} />
        <circle cx={c} cy={c} r={size * 0.025} fill={color} />
      </g>
    </svg>
  );
}

export function ConicalHat({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const cx = size / 2;
  const top = size * 0.2;
  const bottom = size * 0.72;
  const half = size * 0.34;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${cx} ${top} L ${cx - half} ${bottom} L ${cx + half} ${bottom} Z`} />
        <ellipse cx={cx} cy={bottom} rx={half} ry={size * 0.04} />
        {[-0.74, -0.45, -0.18, 0, 0.18, 0.45, 0.74].map((k, i) => (
          <line
            key={i}
            x1={cx}
            y1={top}
            x2={cx + half * k}
            y2={bottom}
            strokeWidth={0.55}
            opacity={0.45}
          />
        ))}
        <circle cx={cx} cy={top} r={1.6} fill={color} />
        <line
          x1={cx - size * 0.14}
          y1={size * 0.85}
          x2={cx - size * 0.06}
          y2={size * 0.78}
          strokeWidth={0.8}
          opacity={0.6}
        />
        <line
          x1={cx + size * 0.14}
          y1={size * 0.85}
          x2={cx + size * 0.06}
          y2={size * 0.78}
          strokeWidth={0.8}
          opacity={0.6}
        />
      </g>
    </svg>
  );
}

export function PhinFilter({ color = DEFAULT_INK, size = 80, className }: IllusProps) {
  const cx = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={cx} cy={size * 0.34} rx={size * 0.22} ry={size * 0.035} />
        <line x1={cx} y1={size * 0.3} x2={cx} y2={size * 0.26} />
        <circle cx={cx} cy={size * 0.24} r={size * 0.04} />
        <rect x={size * 0.28} y={size * 0.34} width={size * 0.44} height={size * 0.18} rx={1.5} />
        <ellipse cx={cx} cy={size * 0.52} rx={size * 0.22} ry={size * 0.03} />
        <path
          d={`M ${size * 0.31} ${size * 0.56} L ${size * 0.34} ${size * 0.78} L ${size * 0.66} ${size * 0.78} L ${size * 0.69} ${size * 0.56}`}
        />
        <ellipse cx={cx} cy={size * 0.78} rx={size * 0.165} ry={size * 0.028} />
        <line
          x1={cx}
          y1={size * 0.55}
          x2={cx}
          y2={size * 0.62}
          strokeWidth={0.8}
          strokeDasharray="1.6 1.6"
        />
        <circle cx={cx} cy={size * 0.65} r={0.9} fill={color} />
      </g>
    </svg>
  );
}

export function AoDai({
  color = DEFAULT_INK,
  accent = DEFAULT_TERRACOTTA,
  size = 80,
  className,
}: IllusProps & { accent?: string }) {
  const cx = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <g stroke={color} fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        <path
          d={`M ${cx - 4} ${size * 0.3} L ${cx - size * 0.18} ${size * 0.55} L ${cx - size * 0.22} ${size * 0.88} L ${cx + size * 0.22} ${size * 0.88} L ${cx + size * 0.18} ${size * 0.55} L ${cx + 4} ${size * 0.3} Z`}
          fill={accent}
          fillOpacity={0.12}
        />
        <path d={`M ${cx - 9} ${size * 0.22} L ${cx} ${size * 0.1} L ${cx + 9} ${size * 0.22} Z`} />
        <ellipse cx={cx} cy={size * 0.22} rx={9} ry={size * 0.018} />
        <circle cx={cx} cy={size * 0.27} r={size * 0.045} />
        <line
          x1={cx}
          y1={size * 0.55}
          x2={cx}
          y2={size * 0.88}
          strokeWidth={0.6}
          opacity={0.5}
        />
        <line x1={cx - 4} y1={size * 0.3} x2={cx - size * 0.2} y2={size * 0.5} />
        <line x1={cx + 4} y1={size * 0.3} x2={cx + size * 0.2} y2={size * 0.5} />
        <circle cx={cx} cy={size * 0.4} r={1.1} fill={color} />
        <circle cx={cx} cy={size * 0.5} r={1.1} fill={color} />
      </g>
    </svg>
  );
}

export function FolkStar({
  fill = DEFAULT_TERRACOTTA,
  accent = DEFAULT_PARCHMENT,
  size = 80,
  className,
}: { fill?: string; accent?: string; size?: number; className?: string }) {
  const c = size / 2;
  const ptsAt = (outerR: number, innerR: number) => {
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      out.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
    }
    return out.join(" ");
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className}>
      <polygon points={ptsAt(size * 0.44, size * 0.18)} fill={fill} />
      <polygon points={ptsAt(size * 0.22, size * 0.09)} fill={accent} opacity={0.92} />
      <circle cx={c} cy={c} r={size * 0.05} fill={fill} />
    </svg>
  );
}
