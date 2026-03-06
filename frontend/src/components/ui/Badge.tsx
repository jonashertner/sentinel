import { clsx } from "clsx";
import { RISK_COLORS, SOURCE_LABELS } from "@/lib/constants";
import type { RiskCategory, Source } from "@/lib/types";

interface BadgeProps {
  label: string;
  variant?: "source" | "risk" | "tag";
  className?: string;
}

const SOURCE_STYLES: Record<string, string> = {
  WHO_DON:
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  WHO_EIOS:
    "bg-sky-500/10 text-sky-400 border-sky-500/20",
  PROMED:
    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ECDC:
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  WOAH:
    "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

export function Badge({ label, variant = "tag", className }: BadgeProps) {
  if (variant === "source") {
    const src = SOURCE_LABELS[label];
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          SOURCE_STYLES[label] ??
            "border-sentinel-border bg-sentinel-surface text-sentinel-text-secondary",
          className,
        )}
      >
        {src?.short ?? label}
      </span>
    );
  }

  if (variant === "risk") {
    const cat = label as RiskCategory;
    const colors = RISK_COLORS[cat];
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          colors
            ? `${colors.bg} ${colors.text} ${colors.border}`
            : "border-sentinel-border bg-sentinel-surface text-sentinel-text-secondary",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  // tag variant
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border border-sentinel-border bg-sentinel-surface px-1.5 py-0.5 text-[10px] font-medium text-sentinel-text-secondary",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  return <Badge label={source} variant="source" className={className} />;
}

export function RiskBadge({ category, className }: { category: RiskCategory; className?: string }) {
  return <Badge label={category} variant="risk" className={className} />;
}
