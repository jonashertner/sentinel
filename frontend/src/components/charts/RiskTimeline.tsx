"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface RiskTimelineProps {
  data: {
    date: string;
    avgRisk: number;
    avgSwissRelevance: number;
  }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-md border border-sentinel-border bg-sentinel-surface px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono font-medium text-sentinel-text-muted mb-1">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sentinel-text-secondary">{entry.name}</span>
          <span className="font-mono font-medium text-sentinel-text ml-auto">
            {typeof entry.value === "number"
              ? entry.value.toFixed(1)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RiskTimeline({ data }: RiskTimelineProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
      >
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
          domain={[0, 10]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{
            fontSize: 10,
            color: "#a1a1aa",
            paddingTop: 8,
          }}
        />
        <Line
          type="monotone"
          dataKey="avgRisk"
          name="Avg Risk Score"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3, fill: "#f97316" }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="avgSwissRelevance"
          name="Avg Swiss Relevance"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3, fill: "#ef4444" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
