/** Minimal SVG sparkline — no axes, no gridlines, one hairline path. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  threshold,
}: {
  values: number[];
  width?: number;
  height?: number;
  threshold?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values, threshold ?? Infinity);
  const max = Math.max(...values, threshold ?? -Infinity);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      {threshold !== undefined && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="var(--color-edge)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="var(--color-mut)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(last)}
        r="2.5"
        fill={
          threshold !== undefined && last < threshold
            ? "var(--color-fail)"
            : "var(--color-accent)"
        }
      />
    </svg>
  );
}
