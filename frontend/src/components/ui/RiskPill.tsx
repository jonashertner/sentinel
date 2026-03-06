import { clsx } from "clsx";
import { RISK_COLORS } from "@/lib/constants";
import type { RiskCategory } from "@/lib/types";

interface RiskPillProps {
  score: number;
  category: RiskCategory;
  className?: string;
}

export function RiskPill({ score, category, className }: RiskPillProps) {
  const colors = RISK_COLORS[category];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: colors.dot }}
      />
      <span>{score.toFixed(1)}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-80">
        {category}
      </span>
    </span>
  );
}
