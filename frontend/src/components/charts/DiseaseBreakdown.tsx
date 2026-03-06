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

interface DiseaseBreakdownProps {
  data: { disease: string; count: number; maxRisk: number }[];
}

function riskToColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f97316";
  if (score >= 4) return "#eab308";
  return "#3b82f6";
}

function CustomTooltip({ active, payload }: Record<string, unknown>) {
  const items = payload as { payload: { disease: string; count: number; maxRisk: number } }[] | undefined;
  if (!active || !items?.[0]) return null;
  const d = items[0].payload;
  return (
    <div className="rounded-md border border-sentinel-border bg-sentinel-surface px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium text-sentinel-text">{d.disease}</p>
      <p className="text-[10px] font-mono text-sentinel-text-secondary">
        {d.count} events | Max risk: {d.maxRisk.toFixed(1)}
      </p>
    </div>
  );
}

export function DiseaseBreakdown({ data }: DiseaseBreakdownProps) {
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
          dataKey="disease"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((entry) => (
            <Cell
              key={entry.disease}
              fill={riskToColor(entry.maxRisk)}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
