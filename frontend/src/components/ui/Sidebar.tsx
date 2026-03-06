"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getManifest } from "@/lib/api";
import type { Manifest } from "@/lib/api";
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
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/lib/theme-context";

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
  const { theme, mode, setMode } = useTheme();
  const cycleTheme = () => {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };
  const ThemeIcon = mode === "system" ? Monitor : theme === "dark" ? Sun : Moon;
  const themeLabel = mode === "system" ? "System" : mode === "light" ? "Light" : "Dark";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    getManifest().then(setManifest).catch(() => {});
  }, []);
  const [agency, setAgency] = useState<(typeof AGENCIES)[number]>("Joint");
  const [agencyOpen, setAgencyOpen] = useState(false);

  const sidebarContent = (isMobile: boolean) => {
    const showLabels = isMobile || !collapsed;
    return (
      <>
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-sentinel-border px-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 shrink-0 text-sentinel-text" strokeWidth={1.5} />
            {showLabels && (
              <span className="text-sm font-semibold tracking-[0.15em] text-sentinel-text">
                SENTINEL
              </span>
            )}
          </div>
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="text-sentinel-text-muted hover:text-sentinel-text"
            >
              <X className="h-5 w-5" />
            </button>
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
                    onClick={() => isMobile && setMobileOpen(false)}
                    className={clsx(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium",
                      active
                        ? "border-l-2 border-sentinel-text bg-sentinel-surface-active text-sentinel-text"
                        : "border-l-2 border-transparent text-sentinel-text-secondary hover:bg-sentinel-surface-hover hover:text-sentinel-text",
                    )}
                    title={!showLabels ? label : undefined}
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
                    {showLabels && <span>{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Agency selector */}
        <div className="border-t border-sentinel-border px-2 py-2">
          {showLabels ? (
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

        {/* Theme toggle */}
        <div className="border-t border-sentinel-border px-2 py-2">
          {showLabels ? (
            <button
              onClick={cycleTheme}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium text-sentinel-text-muted hover:bg-sentinel-surface-hover hover:text-sentinel-text-secondary"
            >
              <ThemeIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{themeLabel}</span>
            </button>
          ) : (
            <button
              onClick={cycleTheme}
              className="flex w-full items-center justify-center py-2 text-sentinel-text-muted hover:text-sentinel-text-secondary"
              title={themeLabel}
            >
              <ThemeIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Status bar */}
        <div className="border-t border-sentinel-border-subtle px-3 py-2">
          {showLabels ? (
            <div className="space-y-0.5 text-[10px] leading-tight text-sentinel-text-muted">
              <div>Last collection: {manifest?.latest_collection ?? "—"}</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
                Events: {manifest?.total_events ?? "—"}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
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
        )}
      </>
    );
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-sentinel-border bg-sentinel-surface/95 backdrop-blur-sm md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5 text-sentinel-text" strokeWidth={1.5} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sentinel-border bg-sentinel-surface transition-transform duration-200 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden md:flex h-screen flex-col border-r border-sentinel-border bg-sentinel-surface",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-56",
        )}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}
