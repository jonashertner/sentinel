"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface SourceComparisonProps {
  data: { source: string; count: number }[];
}

const SOURCE_COLORS: Record<string, string> = {
  WHO_DON: "#3b82f6",
  WHO_EIOS: "#0ea5e9",
  PROMED: "#f59e0b",
  ECDC: "#22c55e",
  WOAH: "#8b5cf6",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-sentinel-border bg-sentinel-surface px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium text-sentinel-text">
        {d.source}
      </p>
      <p className="text-[10px] font-mono text-sentinel-text-secondary">
        {d.count} events
      </p>
    </div>
  );
}

export function SourceComparison({ data }: SourceComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={{ stroke: "#27272a" }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="source"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry) => (
            <Cell
              key={entry.source}
              fill={SOURCE_COLORS[entry.source] || "#71717a"}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
