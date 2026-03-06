"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";

export interface FilterConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: string) => void;
  activeChips?: { key: string; label: string }[];
  onChipRemove?: (key: string) => void;
  className?: string;
}

export function FilterBar({
  filters,
  onFilterChange,
  activeChips,
  onChipRemove,
  className,
}: FilterBarProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {filters.map((filter) => (
        <div key={filter.key} className="relative">
          <select
            value={filter.value}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            className="h-7 appearance-none rounded border border-sentinel-border bg-sentinel-surface px-2.5 pr-7 text-[11px] font-medium text-sentinel-text-secondary outline-none hover:border-sentinel-text-muted focus:border-sentinel-text-muted"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <svg
              width="8"
              height="5"
              viewBox="0 0 8 5"
              fill="none"
              className="text-sentinel-text-muted"
            >
              <path
                d="M1 1L4 4L7 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      ))}

      {activeChips && activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded border border-sentinel-border bg-sentinel-surface-active px-2 py-0.5 text-[10px] font-medium text-sentinel-text-secondary"
            >
              {chip.label}
              {onChipRemove && (
                <button
                  onClick={() => onChipRemove(chip.key)}
                  className="ml-0.5 text-sentinel-text-muted hover:text-sentinel-text"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
