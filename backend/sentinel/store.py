import json
import os
import re
from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile

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


class DataStore:
    """File-based data store using JSON files in the data/ directory."""

    def __init__(self, data_dir: str = "data"):
        self.base = Path(data_dir)
        self.events_dir = self.base / "events"
        self.reports_dir = self.base / "reports"
        self.situations_dir = self.base / "situations"
        self.annotations_dir = self.base / "annotations"

        for d in [self.events_dir, self.reports_dir, self.situations_dir, self.annotations_dir]:
            d.mkdir(parents=True, exist_ok=True)

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

    def write_manifest(self) -> None:
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
        latest_by_id: dict[str, dict] = {}
        latest_collection = ""
        for d in reversed(event_dates):
            path = self.events_dir / f"{d}.json"
            data = json.loads(path.read_text())
            for item in data:
                event_id = str(item.get("id", ""))
                if not event_id:
                    continue
                item_collected = str(item.get("date_collected", d))
                existing = latest_by_id.get(event_id)
                existing_collected = str(existing.get("date_collected", "")) if existing else ""
                if not existing or item_collected > existing_collected:
                    latest_by_id[event_id] = item
            if not latest_collection and data:
                latest_collection = data[0].get("date_collected", d)

        manifest = {
            "event_dates": event_dates,
            "situation_ids": situation_ids,
            "report_dates": report_dates,
            "total_events": len(latest_by_id),
            "latest_collection": latest_collection or event_dates[-1] if event_dates else "",
        }
        path = self.base / "manifest.json"
        _atomic_write_text(path, json.dumps(manifest, indent=2))
