"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  ListFilter,
  AlertTriangle,
  BarChart3,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/map", label: "Global Map", icon: Globe },
  { href: "/triage", label: "Triage Queue", icon: ListFilter },
  { href: "/situations", label: "Situations", icon: AlertTriangle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/watchlists", label: "Watchlists", icon: Eye },
  { href: "/exports", label: "Exports", icon: Download },
] as const;

const AGENCIES = ["BLV", "BAG", "Joint"] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [agency, setAgency] = useState<(typeof AGENCIES)[number]>("Joint");
  const [agencyOpen, setAgencyOpen] = useState(false);

  return (
    <aside
      className={clsx(
        "flex h-screen flex-col border-r border-sentinel-border bg-sentinel-surface",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sentinel-border px-4">
        <Shield className="h-5 w-5 shrink-0 text-sentinel-text" strokeWidth={1.5} />
        {!collapsed && (
          <span className="text-sm font-semibold tracking-[0.15em] text-sentinel-text">
            SENTINEL
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium",
                    active
                      ? "border-l-2 border-sentinel-text bg-sentinel-surface-active text-sentinel-text"
                      : "border-l-2 border-transparent text-sentinel-text-secondary hover:bg-sentinel-surface-hover hover:text-sentinel-text",
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon
                    className={clsx(
                      "h-4 w-4 shrink-0",
                      active
                        ? "text-sentinel-text"
                        : "text-sentinel-text-muted group-hover:text-sentinel-text-secondary",
                    )}
                    strokeWidth={1.5}
                  />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Agency selector */}
      <div className="border-t border-sentinel-border px-2 py-2">
        {!collapsed ? (
          <div className="relative">
            <button
              onClick={() => setAgencyOpen(!agencyOpen)}
              className="flex w-full items-center justify-between rounded-md bg-sentinel-surface-hover px-3 py-2 text-[12px] font-medium text-sentinel-text-secondary hover:text-sentinel-text"
            >
              <span className="uppercase tracking-wider">{agency}</span>
              <ChevronDown
                className={clsx(
                  "h-3.5 w-3.5 transition-transform",
                  agencyOpen && "rotate-180",
                )}
              />
            </button>
            {agencyOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-sentinel-border bg-sentinel-surface py-1 shadow-lg">
                {AGENCIES.map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setAgency(a);
                      setAgencyOpen(false);
                    }}
                    className={clsx(
                      "flex w-full px-3 py-1.5 text-left text-[12px] uppercase tracking-wider",
                      a === agency
                        ? "text-sentinel-text"
                        : "text-sentinel-text-muted hover:text-sentinel-text-secondary",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-center justify-center py-2 text-[10px] font-bold uppercase tracking-wider text-sentinel-text-muted"
            title={agency}
          >
            {agency.slice(0, 3)}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-sentinel-border-subtle px-3 py-2">
        {!collapsed ? (
          <div className="space-y-0.5 text-[10px] leading-tight text-sentinel-text-muted">
            <div>Pipeline last run: 2026-03-06 06:00 UTC</div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
              Events: 32
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center border-t border-sentinel-border py-2.5 text-sentinel-text-muted hover:text-sentinel-text-secondary"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
