import { Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Shield
          className="mx-auto mb-4 h-12 w-12 text-sentinel-text-muted"
          strokeWidth={1}
        />
        <h1 className="text-lg font-semibold tracking-wide text-sentinel-text">
          SENTINEL
        </h1>
        <p className="mt-1 text-[13px] text-sentinel-text-muted">
          Swiss Epidemic Intelligence — Command Center
        </p>
      </div>
    </div>
  );
}
