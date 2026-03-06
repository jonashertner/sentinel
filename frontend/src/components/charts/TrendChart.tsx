"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface TrendChartProps {
  data: { date: string; [disease: string]: string | number }[];
  diseases: string[];
}

const DISEASE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
  "#84cc16",
  "#6366f1",
  "#d946ef",
  "#0ea5e9",
  "#fb923c",
];

function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-md border border-sentinel-border bg-sentinel-surface px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono font-medium text-sentinel-text-muted mb-1">
        {label as string}
      </p>
      {(payload as Record<string, unknown>[]).map((entry: Record<string, unknown>) => (
        <div key={entry.name as string} className="flex items-center gap-2 text-[11px]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color as string }}
          />
          <span className="text-sentinel-text-secondary">{entry.name as string}</span>
          <span className="font-mono font-medium text-sentinel-text ml-auto">
            {String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, diseases }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={{ stroke: "#27272a" }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {diseases.map((disease, i) => (
          <Area
            key={disease}
            type="monotone"
            dataKey={disease}
            stroke={DISEASE_COLORS[i % DISEASE_COLORS.length]}
            fill={DISEASE_COLORS[i % DISEASE_COLORS.length]}
            fillOpacity={0.08}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
