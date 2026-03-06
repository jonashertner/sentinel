import { RISK_COLORS } from "@/lib/constants";
import type { RiskCategory } from "@/lib/types";

const LEVELS: RiskCategory[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function MapLegend() {
  return (
    <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-sentinel-text-muted">
      <span className="font-semibold tracking-[0.15em]">Risk</span>
      {LEVELS.map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: RISK_COLORS[level].dot,
              boxShadow: `0 0 4px ${RISK_COLORS[level].dot}40`,
            }}
          />
          <span className="text-[9px]">{level}</span>
        </span>
      ))}
    </div>
  );
}
