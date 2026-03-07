"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearApiWriteKey, getManifest, hasApiWriteKey, setApiWriteKey } from "@/lib/api";
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
  Languages,
} from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/lib/theme-context";
import { useI18n, LOCALE_LABELS, type Locale } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.commandCenter", icon: LayoutDashboard },
  { href: "/map", labelKey: "nav.globalMap", icon: Globe },
  { href: "/triage", labelKey: "nav.triageQueue", icon: ListFilter },
  { href: "/situations", labelKey: "nav.situations", icon: AlertTriangle },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { href: "/watchlists", labelKey: "nav.watchlists", icon: Eye },
  { href: "/exports", labelKey: "nav.exports", icon: Download },
] as const;

const AGENCIES = ["BLV", "BAG", "Joint"] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { theme, mode, setMode } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const cycleTheme = () => {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };
  const ThemeIcon = mode === "system" ? Monitor : theme === "dark" ? Sun : Moon;
  const themeLabel = mode === "system" ? t("theme.system") : mode === "light" ? t("theme.light") : t("theme.dark");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [writeKeyConfigured, setWriteKeyConfigured] = useState<boolean>(() => hasApiWriteKey());

  useEffect(() => {
    getManifest().then(setManifest).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);
  const [agency, setAgency] = useState<(typeof AGENCIES)[number]>("Joint");
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  function configureWriteKey() {
    const input = window.prompt(t("sidebar.writeKeyPrompt"));
    if (input === null) return;
    if (!input.trim()) {
      clearApiWriteKey();
      setWriteKeyConfigured(false);
      return;
    }
    setApiWriteKey(input, false);
    setWriteKeyConfigured(true);
  }

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
            {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
              const active = pathname === href;
              const label = t(labelKey);
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

        {/* Language switcher */}
        <div className="border-t border-sentinel-border px-2 py-2">
          {showLabels ? (
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex w-full items-center justify-between rounded-md bg-sentinel-surface-hover px-3 py-2 text-[12px] font-medium text-sentinel-text-secondary hover:text-sentinel-text"
              >
                <span className="flex items-center gap-2">
                  <Languages className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {LOCALE_LABELS[locale]}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-3.5 w-3.5 transition-transform",
                    langOpen && "rotate-180",
                  )}
                />
              </button>
              {langOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-sentinel-border bg-sentinel-surface py-1 shadow-lg">
                  {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLocale(l);
                        setLangOpen(false);
                      }}
                      className={clsx(
                        "flex w-full px-3 py-1.5 text-left text-[12px]",
                        l === locale
                          ? "text-sentinel-text font-medium"
                          : "text-sentinel-text-muted hover:text-sentinel-text-secondary",
                      )}
                    >
                      {LOCALE_LABELS[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex w-full items-center justify-center py-2 text-sentinel-text-muted hover:text-sentinel-text-secondary"
              title={LOCALE_LABELS[locale]}
            >
              <Languages className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* API write key */}
        <div className="border-t border-sentinel-border px-2 py-2">
          {showLabels ? (
            <button
              onClick={configureWriteKey}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[12px] font-medium text-sentinel-text-muted hover:bg-sentinel-surface-hover hover:text-sentinel-text-secondary"
            >
              <span>{t("sidebar.writeKey")}</span>
              <span className={writeKeyConfigured ? "text-sentinel-clear" : "text-sentinel-text-muted"}>
                {writeKeyConfigured ? t("sidebar.writeKeySet") : t("sidebar.writeKeyMissing")}
              </span>
            </button>
          ) : (
            <button
              onClick={configureWriteKey}
              className="flex w-full items-center justify-center py-2 text-sentinel-text-muted hover:text-sentinel-text-secondary"
              title={t("sidebar.writeKey")}
            >
              <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Status bar */}
        <div className="border-t border-sentinel-border-subtle px-3 py-2">
          {showLabels ? (
            <div className="space-y-0.5 text-[10px] leading-tight text-sentinel-text-muted">
              <div>{t("sidebar.lastCollection")}: {manifest?.latest_collection ?? "—"}</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sentinel-clear" />
                {t("sidebar.events")}: {manifest?.total_events ?? "—"}
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
            aria-label={collapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")}
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
        className={clsx(
          "fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-sentinel-border bg-sentinel-surface/95 backdrop-blur-sm md:hidden",
          mobileOpen && "pointer-events-none opacity-0",
        )}
        aria-label={t("sidebar.openNav")}
        aria-expanded={mobileOpen}
        aria-controls="sentinel-mobile-sidebar"
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
        id="sentinel-mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sentinel-border bg-sentinel-surface transition-transform duration-200 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
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
