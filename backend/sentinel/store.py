import json
import os
import re
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from sentinel.models.annotation import Annotation
from sentinel.models.event import HealthEvent
from sentinel.models.situation import Situation

# Annotation IDs must be safe for use in filenames
_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _atomic_write_text(path: Path, content: str) -> None:
    """Write file contents atomically to avoid partial writes."""
    with NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as tmp:
        tmp.write(content)
        tmp.flush()
        os.fsync(tmp.fileno())
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def _default_ops_state() -> dict[str, Any]:
    return {
        "event_triage": {},
        "situation_notes": {},
        "situation_actions": {},
    }


class DataStore:
    """File-based data store using JSON files in the data/ directory."""

    def __init__(self, data_dir: str = "data"):
        self.base = Path(data_dir)
        self.events_dir = self.base / "events"
        self.reports_dir = self.base / "reports"
        self.situations_dir = self.base / "situations"
        self.annotations_dir = self.base / "annotations"
        self.collector_runs_dir = self.base / "collector_runs"
        self.ingestion_dir = self.base / "ingestion"
        self.ops_dir = self.base / "ops"
        self.watchlists_path = self.base / "watchlists.json"
        self.ops_state_path = self.ops_dir / "state.json"

        for d in [
            self.events_dir,
            self.reports_dir,
            self.situations_dir,
            self.annotations_dir,
            self.collector_runs_dir,
            self.ingestion_dir,
            self.ops_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)
        if not self.watchlists_path.exists():
            _atomic_write_text(self.watchlists_path, "[]")
        if not self.ops_state_path.exists():
            _atomic_write_text(self.ops_state_path, json.dumps(_default_ops_state(), indent=2))

    def save_events(self, day: date, events: list[HealthEvent]) -> None:
        path = self.events_dir / f"{day.isoformat()}.json"
        data = [e.model_dump(mode="json") for e in events]
        _atomic_write_text(path, json.dumps(data, indent=2, ensure_ascii=False))

    def load_events(self, day: date) -> list[HealthEvent]:
        path = self.events_dir / f"{day.isoformat()}.json"
        if not path.exists():
            return []
        data = json.loads(path.read_text())
        return [HealthEvent.model_validate(d) for d in data]

    def load_all_events(self) -> list[HealthEvent]:
        events = []
        for path in sorted(self.events_dir.glob("*.json")):
            data = json.loads(path.read_text())
            events.extend(HealthEvent.model_validate(d) for d in data)
        return events

    def save_report(self, day: date, content: str) -> None:
        path = self.reports_dir / f"{day.isoformat()}-daily.md"
        _atomic_write_text(path, content)

    def load_report(self, day: date) -> str:
        path = self.reports_dir / f"{day.isoformat()}-daily.md"
        return path.read_text() if path.exists() else ""

    def save_situation(self, situation: Situation) -> None:
        path = self.situations_dir / f"{situation.id}.json"
        _atomic_write_text(path, situation.model_dump_json(indent=2))

    def load_situations(self) -> list[Situation]:
        situations = []
        for path in sorted(self.situations_dir.glob("*.json")):
            situation = Situation.model_validate_json(path.read_text())
            if situation.id != path.stem:
                # Keep routing stable by using filename ID as canonical source.
                situation.id = path.stem
            situations.append(situation)
        return situations

    def save_annotation(self, annotation: Annotation) -> None:
        if not _SAFE_ID_RE.match(annotation.id):
            raise ValueError(f"Invalid annotation ID: {annotation.id!r}")
        path = self.annotations_dir / f"{annotation.id}.json"
        # Ensure resolved path stays within annotations directory
        if not path.resolve().is_relative_to(self.annotations_dir.resolve()):
            raise ValueError(f"Invalid annotation ID: {annotation.id!r}")
        _atomic_write_text(path, annotation.model_dump_json(indent=2))

    def load_annotations(self) -> list[Annotation]:
        annotations = []
        for path in sorted(self.annotations_dir.glob("*.json")):
            annotations.append(Annotation.model_validate_json(path.read_text()))
        return annotations

    def load_watchlists(self) -> list[dict[str, Any]]:
        data = _read_json(self.watchlists_path, [])
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def save_watchlists(self, watchlists: list[dict[str, Any]]) -> None:
        _atomic_write_text(
            self.watchlists_path,
            json.dumps(watchlists, indent=2, ensure_ascii=False),
        )

    def save_collector_statuses(self, day: date, statuses: list[dict[str, Any]]) -> None:
        path = self.collector_runs_dir / f"{day.isoformat()}.json"
        _atomic_write_text(path, json.dumps(statuses, indent=2, ensure_ascii=False))

    def load_collector_statuses(self, day: date) -> list[dict[str, Any]]:
        path = self.collector_runs_dir / f"{day.isoformat()}.json"
        data = _read_json(path, [])
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def load_latest_collector_statuses(self) -> tuple[str, list[dict[str, Any]]]:
        paths = sorted(self.collector_runs_dir.glob("*.json"))
        if not paths:
            return "", []
        latest = paths[-1]
        data = _read_json(latest, [])
        if not isinstance(data, list):
            return latest.stem, []
        return latest.stem, [item for item in data if isinstance(item, dict)]

    def save_ingestion_delta(self, day: date, delta: dict[str, Any]) -> None:
        path = self.ingestion_dir / f"{day.isoformat()}.json"
        _atomic_write_text(path, json.dumps(delta, indent=2, ensure_ascii=False))

    def load_latest_ingestion_delta(self) -> tuple[str, dict[str, Any]]:
        paths = sorted(self.ingestion_dir.glob("*.json"))
        if not paths:
            return "", {}
        latest = paths[-1]
        data = _read_json(latest, {})
        if not isinstance(data, dict):
            return latest.stem, {}
        return latest.stem, data

    def load_ops_state(self) -> dict[str, Any]:
        data = _read_json(self.ops_state_path, _default_ops_state())
        if not isinstance(data, dict):
            return _default_ops_state()
        state = _default_ops_state()
        for key in state:
            value = data.get(key)
            if isinstance(value, dict):
                state[key] = value
        return state

    def save_ops_state(self, state: dict[str, Any]) -> None:
        merged = _default_ops_state()
        for key in merged:
            value = state.get(key)
            if isinstance(value, dict):
                merged[key] = value
        _atomic_write_text(
            self.ops_state_path,
            json.dumps(merged, indent=2, ensure_ascii=False),
        )

    def write_manifest(
        self,
        *,
        projected_events: list[HealthEvent] | None = None,
        collector_statuses: list[dict[str, Any]] | None = None,
        ingestion_delta: dict[str, Any] | None = None,
    ) -> None:
        """Write a manifest.json listing available dates and situation IDs."""
        event_dates = sorted(
            p.stem for p in self.events_dir.glob("*.json")
        )
        situation_ids = sorted(
            p.stem for p in self.situations_dir.glob("*.json")
        )
        report_dates = sorted(
            p.stem.replace("-daily", "") for p in self.reports_dir.glob("*-daily.md")
        )
        if projected_events is not None:
            projected_total_events = len(projected_events)
            projected_source_totals: dict[str, int] = {}
            latest_collection = ""
            for event in projected_events:
                src = event.source.value
                projected_source_totals[src] = projected_source_totals.get(src, 0) + 1
                collected = event.date_collected.isoformat()
                if collected > latest_collection:
                    latest_collection = collected
        else:
            latest_by_id: dict[str, dict] = {}
            projected_source_totals = {}
            latest_collection = ""
            for d in reversed(event_dates):
                path = self.events_dir / f"{d}.json"
                data = _read_json(path, [])
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    event_id = str(item.get("id", ""))
                    if not event_id:
                        continue
                    item_collected = str(item.get("date_collected", d))
                    existing = latest_by_id.get(event_id)
                    existing_collected = str(existing.get("date_collected", "")) if existing else ""
                    if not existing or item_collected > existing_collected:
                        latest_by_id[event_id] = item
                if not latest_collection and data:
                    first = data[0]
                    if isinstance(first, dict):
                        latest_collection = str(first.get("date_collected", d))
            projected_total_events = len(latest_by_id)
            for item in latest_by_id.values():
                src = str(item.get("source", ""))
                if not src:
                    continue
                projected_source_totals[src] = projected_source_totals.get(src, 0) + 1

        if collector_statuses is None:
            _, collector_statuses = self.load_latest_collector_statuses()
        if ingestion_delta is None:
            _, ingestion_delta = self.load_latest_ingestion_delta()
        ingestion_summary = {}
        if isinstance(ingestion_delta, dict):
            ingestion_summary = {
                "latest_collection": ingestion_delta.get("latest_collection", ""),
                "previous_collection": ingestion_delta.get("previous_collection"),
                "new_count": ingestion_delta.get("new_count", 0),
                "changed_count": ingestion_delta.get("changed_count", 0),
                "retired_count": ingestion_delta.get("retired_count", 0),
                "new_by_source": ingestion_delta.get("new_by_source", {}),
                "changed_by_source": ingestion_delta.get("changed_by_source", {}),
            }

        manifest = {
            "event_dates": event_dates,
            "situation_ids": situation_ids,
            "report_dates": report_dates,
            "total_events": projected_total_events,
            "latest_collection": latest_collection or event_dates[-1] if event_dates else "",
            "projected_source_totals": projected_source_totals,
            "collector_statuses": collector_statuses or [],
            "ingestion_delta": ingestion_summary,
        }
        path = self.base / "manifest.json"
        _atomic_write_text(path, json.dumps(manifest, indent=2))
