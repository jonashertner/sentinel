import { clsx } from "clsx";
import { Heart, PawPrint, Leaf } from "lucide-react";
import type { Situation } from "@/lib/types";

interface OneHealthMatrixProps {
  situation: Situation;
}

function StatusIndicator({ label, status, icon: Icon }: {
  label: string;
  status: string | null;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const isActive = status && !status.toLowerCase().startsWith("no ");
  const isCritical = status?.toUpperCase().includes("CRITICAL");
  const isHighActive = status?.toUpperCase().includes("ACTIVE");

  const dotColor = isCritical
    ? "bg-sentinel-critical"
    : isHighActive
      ? "bg-sentinel-high"
      : isActive
        ? "bg-sentinel-medium"
        : "bg-sentinel-resolved";

  return (
    <div className="rounded-lg border border-sentinel-border bg-sentinel-bg p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-sentinel-text-muted" strokeWidth={1.5} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
          {label}
        </span>
        <span className={clsx("ml-auto h-2 w-2 rounded-full", dotColor)} />
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-sentinel-text-secondary">
        {status || "No data available"}
      </div>
    </div>
  );
}

export function OneHealthMatrix({ situation }: OneHealthMatrixProps) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted">
        One Health Assessment
      </div>
      <div className="space-y-2">
        <StatusIndicator
          label="Human Health"
          status={situation.human_health_status}
          icon={Heart}
        />
        <StatusIndicator
          label="Animal Health"
          status={situation.animal_health_status}
          icon={PawPrint}
        />
        <StatusIndicator
          label="Environment"
          status={situation.environmental_status}
          icon={Leaf}
        />
      </div>
    </div>
  );
}
