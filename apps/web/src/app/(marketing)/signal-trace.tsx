import { palette } from "./palette";

// The one signature visual element for this session: a restrained
// "relationship signal trace" -- a thin line with a few nodes, suggesting
// conversation -> signal -> action. Static by default; any transition is
// gated behind prefers-reduced-motion via the motion-safe: Tailwind variant.
export function SignalTrace() {
  return (
    <svg
      viewBox="0 0 520 80"
      width="100%"
      height="80"
      role="presentation"
      aria-hidden="true"
      className="max-w-xl"
    >
      <line
        x1="10"
        y1="40"
        x2="510"
        y2="40"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
      />
      <circle cx="40" cy="40" r="4" fill="rgba(255,255,255,0.35)" />
      <circle cx="190" cy="40" r="4" fill="rgba(255,255,255,0.35)" />
      <circle cx="340" cy="40" r="4" fill="rgba(255,255,255,0.5)" />
      <circle
        cx="480"
        cy="40"
        r="6"
        fill={palette.healthTeal}
        className="motion-safe:animate-pulse"
      />
    </svg>
  );
}
