"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { loadWatchlists, loadAllEvents } from "@/lib/api";
import type { HealthEvent, Watchlist } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { WatchlistCard } from "@/components/watchlists/WatchlistCard";

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
  const [serverWatchlists, setServerWatchlists] = useState<Watchlist[]>([]);
  const [customWatchlists, setCustomWatchlists] = useState<Watchlist[]>(() => {
    try {
      const stored = localStorage.getItem("sentinel-custom-watchlists");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDiseases, setFormDiseases] = useState<string[]>([]);
  const [formCountries, setFormCountries] = useState<string[]>([]);
  const [formMinRisk, setFormMinRisk] = useState(3);
  const [formTags, setFormTags] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([loadWatchlists(), loadAllEvents()])
      .then(([wl, ev]) => {
        setServerWatchlists(wl);
        setEvents(ev);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  }, []);

  const allWatchlists = useMemo(
    () => [...serverWatchlists, ...customWatchlists],
    [serverWatchlists, customWatchlists],
  );

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
    (id: string) => {
      const updated = customWatchlists.filter((w) => w.id !== id);
      setCustomWatchlists(updated);
      localStorage.setItem(
        "sentinel-custom-watchlists",
        JSON.stringify(updated),
      );
    },
    [customWatchlists],
  );

  const createWatchlist = () => {
    if (!formName.trim()) return;
    const newWl: Watchlist = {
      id: `wl-custom-${Date.now()}`,
      name: formName.trim(),
      diseases: formDiseases,
      countries: formCountries,
      min_risk_score: formMinRisk,
      one_health_tags: formTags,
    };
    const updated = [...customWatchlists, newWl];
    setCustomWatchlists(updated);
    localStorage.setItem("sentinel-custom-watchlists", JSON.stringify(updated));
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
        Loading watchlists...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-sentinel-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-sentinel-text">
            WATCHLISTS
          </h1>
          <p className="mt-0.5 text-[11px] text-sentinel-text-muted">
            Custom event filters and monitoring criteria
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="h-3 w-3" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" /> Create Watchlist
            </>
          )}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Create form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-sentinel-border bg-sentinel-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-3">
              New Watchlist
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Watchlist name..."
                  className="w-full rounded-md border border-sentinel-border bg-sentinel-bg px-3 py-2 text-[12px] text-sentinel-text placeholder:text-sentinel-text-muted outline-none focus:border-sentinel-text-muted"
                />
              </div>

              {/* Diseases */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-sentinel-text-muted mb-1.5">
                  Diseases
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
                  Countries
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
                  Min Risk Score: {formMinRisk}
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
                    One Health Tags
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
                Create Watchlist
              </Button>
            </div>
          </div>
        )}

        {/* Watchlist cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {allWatchlists.map((wl) => {
            const matching = events.filter((e) => matchesWatchlist(e, wl));
            const isCustom = customWatchlists.some((c) => c.id === wl.id);
            return (
              <WatchlistCard
                key={wl.id}
                watchlist={wl}
                matchingEvents={matching}
                isCustom={isCustom}
                onDelete={isCustom ? () => deleteCustom(wl.id) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
