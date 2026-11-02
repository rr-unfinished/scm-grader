import { gradeOf } from "@/lib/scoring";

const RING_COLOR = {
  white: { strong: "#127A55", "needs-work": "#A55F00", poor: "#B8402C", track: "#E3EBEF" },
  navy: { strong: "#5FD3A4", "needs-work": "#F7B955", poor: "#F28B76", track: "rgba(255,255,255,.14)" },
} as const;

export default function ScoreRing({
  score,
  on = "white",
  small = false,
}: {
  score: number;
  on?: "white" | "navy";
  small?: boolean;
}) {
  const C = 2 * Math.PI * 52;
  const palette = RING_COLOR[on];
  const color = palette[gradeOf(score, 100)];
  return (
    <div className={`ring on-${on}${small ? " small" : ""}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" stroke={palette.track} strokeWidth="12" fill="none" />
        <circle
          cx="60"
          cy="60"
          r="52"
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C.toFixed(1)}
          strokeDashoffset={(C * (1 - score / 100)).toFixed(1)}
        />
      </svg>
      <div className="num">
        <b>{score}</b>
        <span>/100</span>
      </div>
    </div>
  );
}
