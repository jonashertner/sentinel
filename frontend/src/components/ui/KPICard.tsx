import { clsx } from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: number;
  sparkData?: number[];
  className?: string;
}

export function KPICard({
  label,
  value,
  delta,
  sparkData,
  className,
}: KPICardProps) {
  const deltaIcon =
    delta === undefined || delta === 0 ? (
      <Minus className="h-3 w-3" />
    ) : delta > 0 ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    );

  const deltaColor =
    delta === undefined || delta === 0
      ? "text-sentinel-text-muted"
      : delta > 0
        ? "text-sentinel-high"
        : "text-sentinel-clear";

  return (
    <Card className={clsx("flex flex-col justify-between gap-3", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-sentinel-text-muted">
        {label}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-sentinel-text">
            {value}
          </div>
          {delta !== undefined && (
            <div
              className={clsx(
                "mt-1 flex items-center gap-1 text-[11px] font-medium",
                deltaColor,
              )}
            >
              {deltaIcon}
              <span>
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline
            data={sparkData}
            width={64}
            height={28}
            color="#71717a"
          />
        )}
      </div>
    </Card>
  );
}
