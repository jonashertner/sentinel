"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Globe,
  ListFilter,
  AlertTriangle,
  BarChart3,
  Bell,
  Activity,
  ChevronRight,
  X,
  Zap,
  Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "sentinel-welcome-dismissed";

export function WelcomeOverlay() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    }
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, "1");
    }, 300);
  }

  if (!visible) return null;

  const features = [
    {
      icon: Globe,
      color: "#3b82f6",
      titleKey: "welcome.f1.title",
      descKey: "welcome.f1.desc",
    },
    {
      icon: ListFilter,
      color: "#f97316",
      titleKey: "welcome.f2.title",
      descKey: "welcome.f2.desc",
    },
    {
      icon: AlertTriangle,
      color: "#ef4444",
      titleKey: "welcome.f3.title",
      descKey: "welcome.f3.desc",
    },
    {
      icon: Bell,
      color: "#22c55e",
      titleKey: "welcome.f4.title",
      descKey: "welcome.f4.desc",
    },
    {
      icon: Activity,
      color: "#a855f7",
      titleKey: "welcome.f5.title",
      descKey: "welcome.f5.desc",
    },
    {
      icon: BarChart3,
      color: "#14b8a6",
      titleKey: "welcome.f6.title",
      descKey: "welcome.f6.desc",
    },
  ];

  const pages = [
    // Page 0: Hero
    <div key="hero" className="flex flex-col items-center text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/20 via-orange-500/10 to-blue-500/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-sentinel-border bg-sentinel-surface">
          <Shield className="h-10 w-10 text-sentinel-text" strokeWidth={1.5} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-sentinel-text">
        SENTINEL
      </h1>
      <p className="mt-1 text-[13px] font-medium tracking-widest uppercase text-sentinel-text-muted">
        {t("welcome.acronym")}
      </p>
      <div className="mt-5 max-w-sm">
        <p className="text-[13px] leading-relaxed text-sentinel-text-secondary">
          {t("welcome.intro")}
        </p>
      </div>
      <div className="mt-6 flex items-center gap-3 text-[11px] text-sentinel-text-muted">
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-sentinel-high" />
          {t("welcome.stat1")}
        </span>
        <span className="text-sentinel-border">|</span>
        <span className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-sentinel-clear" />
          {t("welcome.stat2")}
        </span>
        <span className="text-sentinel-border">|</span>
        <span className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-blue-400" />
          {t("welcome.stat3")}
        </span>
      </div>
    </div>,

    // Page 1: Features grid
    <div key="features" className="w-full max-w-lg">
      <h2 className="text-center text-[11px] font-semibold uppercase tracking-widest text-sentinel-text-muted mb-5">
        {t("welcome.capabilities")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="group rounded-lg border border-sentinel-border-subtle bg-sentinel-surface/50 p-3.5 hover:border-sentinel-border hover:bg-sentinel-surface transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: f.color + "18" }}
              >
                <f.icon className="h-4 w-4" style={{ color: f.color }} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[12px] font-semibold text-sentinel-text leading-tight">
                  {t(f.titleKey)}
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-sentinel-text-muted">
                  {t(f.descKey)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>,

    // Page 2: Swiss focus
    <div key="swiss" className="flex flex-col items-center text-center max-w-md">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/10 mb-5">
        <span className="text-2xl">🇨🇭</span>
      </div>
      <h2 className="text-lg font-semibold text-sentinel-text">
        {t("welcome.swiss.title")}
      </h2>
      <p className="mt-3 text-[13px] leading-relaxed text-sentinel-text-secondary">
        {t("welcome.swiss.desc")}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-4 w-full">
        {[
          { label: t("welcome.swiss.bag"), sub: t("welcome.swiss.bagDesc") },
          { label: t("welcome.swiss.blv"), sub: t("welcome.swiss.blvDesc") },
          { label: t("welcome.swiss.ihr"), sub: t("welcome.swiss.ihrDesc") },
        ].map((item, i) => (
          <div key={i} className="rounded-lg border border-sentinel-border-subtle p-3 text-center">
            <div className="text-[12px] font-semibold text-sentinel-text">{item.label}</div>
            <div className="mt-0.5 text-[10px] text-sentinel-text-muted leading-snug">{item.sub}</div>
          </div>
        ))}
      </div>
    </div>,
  ];

  const totalPages = pages.length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        exiting ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-sentinel-border bg-sentinel-bg shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-sentinel-text-muted hover:text-sentinel-text hover:bg-sentinel-surface-hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="px-8 pt-10 pb-6 flex flex-col items-center min-h-[380px] justify-center">
          {pages[page]}
        </div>

        {/* Footer */}
        <div className="border-t border-sentinel-border px-8 py-4 flex items-center justify-between bg-sentinel-surface/30">
          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === page
                    ? "w-5 bg-sentinel-text"
                    : "w-1.5 bg-sentinel-text-muted/40 hover:bg-sentinel-text-muted"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              className="text-[11px] font-medium text-sentinel-text-muted hover:text-sentinel-text transition-colors"
            >
              {t("welcome.skip")}
            </button>
            {page < totalPages - 1 ? (
              <button
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1 rounded-lg bg-sentinel-text text-sentinel-bg px-4 py-1.5 text-[12px] font-semibold hover:opacity-90 transition-opacity"
              >
                {t("welcome.next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="rounded-lg bg-sentinel-text text-sentinel-bg px-5 py-1.5 text-[12px] font-semibold hover:opacity-90 transition-opacity"
              >
                {t("welcome.start")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
