const RINGS = 16;

function ring(i: number) {
  const pts: string[] = [];
  const steps = 72;
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const wobble =
      1 + 0.16 * Math.sin(a * 3 + i * 0.35) + 0.09 * Math.sin(a * 5 - i * 0.2) + 0.05 * Math.cos(a * 2 + i);
    const r = (28 + i * 24) * wobble;
    pts.push(`${(500 + r * Math.cos(a) * 1.25).toFixed(1)},${(380 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function Contours({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 760"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
    >
      {Array.from({ length: RINGS }, (_, i) => (
        <path
          key={i}
          d={ring(i)}
          stroke="currentColor"
          strokeWidth={i % 4 === 0 ? 1.4 : 0.8}
          opacity={0.9 - i * 0.04}
        />
      ))}
    </svg>
  );
}
