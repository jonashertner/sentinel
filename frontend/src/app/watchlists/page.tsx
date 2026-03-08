"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X } from "lucide-react";
import {
  createWatchlistShared as createWatchlistApi,
  deleteWatchlist as deleteWatchlistApi,
  loadAllEvents,
  loadWatchlists,
} from "@/lib/api";
import type { HealthEvent, Watchlist } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { WatchlistCard } from "@/components/watchlists/WatchlistCard";
import { useI18n } from "@/lib/i18n";

function matchesWatchlist(event: HealthEvent, wl: Watchlist): boolean {
  if (event.risk_score < wl.min_risk_score) return false;

  const hasDisease =
    wl.diseases.length === 0 ||
    wl.diseases.some(
      (d) =>
        event.disease.toLowerCase().includes(d.toLowerCase()) ||
        d.toLowerCase().includes(event.disease.toLowerCase()),
    );

  const hasCountry =
    wl.countries.length === 0 ||
    event.countries.some((cc) => wl.countries.includes(cc));

  const hasTag =
    wl.one_health_tags.length === 0 ||
    wl.one_health_tags.some((t) => event.one_health_tags.includes(t));

  return hasDisease && hasCountry && hasTag;
}

export default function WatchlistsPage() {
  const { t } = useI18n();
  const [serverWatchlists, setServerWatchlists] = useState<Watchlist[]>([]);
  const [customWatchlists, setCustomWatchlists] = useState<Watchlist[]>([]);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDiseases, setFormDiseases] = useState<string[]>([]);
  const [formCountries, setFormCountries] = useState<string[]>([]);
  const [formMinRisk, setFormMinRisk] = useState(3);
  const [formTags, setFormTags] = useState<string[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("sentinel-custom-watchlists");
        if (stored) {
          setCustomWatchlists(JSON.parse(stored) as Watchlist[]);
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    Promise.all([loadWatchlists(), loadAllEvents()])
      .then(([wl, ev]) => {
        setServerWatchlists(wl);
        setEvents(ev);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  }, []);

  const allWatchlists = useMemo(() => {
    const byId = new Map<string, Watchlist>();
    for (const wl of serverWatchlists) byId.set(wl.id, wl);
    for (const wl of customWatchlists) byId.set(wl.id, wl);
    return [...byId.values()];
  }, [serverWatchlists, customWatchlists]);

  // Unique diseases and countries from events
  const uniqueDiseases = useMemo(
    () => [...new Set(events.map((e) => e.disease))].sort(),
    [events],
  );
  const uniqueCountries = useMemo(
    () => [...new Set(events.flatMap((e) => e.countries))].sort(),
    [events],
  );
  const uniqueTags = useMemo(
    () => [...new Set(events.flatMap((e) => e.one_health_tags))].sort(),
    [events],
  );

  const deleteCustom = useCallback(
    async (id: string) => {
      const deletedRemote = await deleteWatchlistApi(id);
      if (deletedRemote.ok) {
        setServerWatchlists((current) => current.filter((w) => w.id !== id));
        setSyncMessage(t("watchlists.sharedSynced"));
      }
      const updated = customWatchlists.filter((w) => w.id !== id);
      setCustomWatchlists(updated);
      localStorage.setItem(
        "sentinel-custom-watchlists",
        JSON.stringify(updated),
      );
      if (!deletedRemote.ok) {
        setSyncMessage(
          deletedRemote.status === 401 || deletedRemote.status === 503
            ? t("watchlists.localFallbackAuth")
            : t("watchlists.localFallback"),
        );
      }
    },
    [customWatchlists, t],
  );

  const createWatchlist = async () => {
    if (!formName.trim()) return;
    const newWl: Watchlist = {
      id: `wl-custom-${Date.now()}`,
      name: formName.trim(),
      diseases: formDiseases,
      countries: formCountries,
      min_risk_score: formMinRisk,
      one_health_tags: formTags,
    };

    const createdRemote = await createWatchlistApi(newWl);
    if (createdRemote.ok && createdRemote.data) {
      const remoteWatchlist = createdRemote.data;
      setServerWatchlists((current) => {
        const next = current.filter((w) => w.id !== remoteWatchlist.id);
        next.push(remoteWatchlist);
        return next;
      });
      setSyncMessage(t("watchlists.sharedSynced"));
    } else {
      const updated = [...customWatchlists, newWl];
      setCustomWatchlists(updated);
      localStorage.setItem("sentinel-custom-watchlists", JSON.stringify(updated));
      setSyncMessage(
        createdRemote.status === 401 || createdRemote.status === 503
          ? t("watchlists.localFallbackAuth")
          : t("watchlists.localFallback"),
      );
    }

    setShowForm(false);
    setFormName("");
    setFormDiseases([]);
    setFormCountries([]);
    setFormMinRisk(3);
    setFormTags([]);
  };

  const toggleMultiSelect = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
  ) => {
    if (arr.includes(val)) setter(arr.filter((v) => v !== val));
    else setter([...arr, val]);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-sentinel-text-muted">
        {t("loading.watchlists")}…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border pl-14 pr-4 sm:px-6 md:px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            {t("watchlists.title").toUpperCase()}
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            {t("watchlists.subtitle")}
          </p>
          {syncMessage && (
            <p className="mt-1 text-[10px] text-sentinel-text-muted">{syncMessage}</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="h-3 w-3" /> {t("watchlists.cancel")}
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" /> {t("watchlists.create")}
            </>
          )}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Create form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-sentinel-border bg-sentinel-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-3">
              {t("watchlists.new")}
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  {t("watchlists.name")}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("watchlists.namePlaceholder")}
                  className="w-full rounded-md border border-sentinel-border bg-sentinel-bg px-3 py-2 text-[12px] text-sentinel-text placeholder:text-sentinel-text-muted outline-none focus:border-sentinel-text-muted"
                />
              </div>

              {/* Diseases */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  {t("watchlists.diseases")}
                </label>
                <div className="flex flex-wrap gap-1">
                  {uniqueDiseases.map((d) => (
                    <button
                      key={d}
                      onClick={() =>
                        toggleMultiSelect(formDiseases, setFormDiseases, d)
                      }
                      className={`rounded border px-2 py-1 text-[10px] ${
                        formDiseases.includes(d)
                          ? "border-sentinel-text bg-sentinel-surface-active text-sentinel-text"
                          : "border-sentinel-border text-sentinel-text-muted hover:text-sentinel-text-secondary"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Countries */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  {t("watchlists.countries")}
                </label>
                <div className="flex flex-wrap gap-1">
                  {uniqueCountries.map((cc) => (
                    <button
                      key={cc}
                      onClick={() =>
                        toggleMultiSelect(
                          formCountries,
                          setFormCountries,
                          cc,
                        )
                      }
                      className={`rounded border px-2 py-1 font-mono text-[10px] ${
                        formCountries.includes(cc)
                          ? "border-sentinel-text bg-sentinel-surface-active text-sentinel-text"
                          : "border-sentinel-border text-sentinel-text-muted hover:text-sentinel-text-secondary"
                      }`}
                    >
                      {cc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min risk score */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  {t("watchlists.minRisk")}: {formMinRisk}
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={formMinRisk}
                  onChange={(e) => setFormMinRisk(Number(e.target.value))}
                  className="w-full accent-sentinel-text"
                />
                <div className="flex justify-between text-[9px] text-sentinel-text-muted mt-0.5">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>

              {/* One Health Tags */}
              {uniqueTags.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                    {t("watchlists.oneHealthTags")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueTags.map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-1.5 text-[11px] text-sentinel-text-secondary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formTags.includes(t)}
                          onChange={() =>
                            toggleMultiSelect(formTags, setFormTags, t)
                          }
                          className="accent-sentinel-text"
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                onClick={createWatchlist}
                disabled={!formName.trim()}
              >
                {t("watchlists.create")}
              </Button>
            </div>
          </div>
        )}

        {/* Watchlist cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {allWatchlists.map((wl) => {
            const matching = events.filter((e) => matchesWatchlist(e, wl));
            const isCustom = wl.id.startsWith("wl-custom-") || customWatchlists.some((c) => c.id === wl.id);
            return (
              <WatchlistCard
                key={wl.id}
                watchlist={wl}
                matchingEvents={matching}
                isCustom={isCustom}
                onDelete={isCustom ? () => void deleteCustom(wl.id) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
