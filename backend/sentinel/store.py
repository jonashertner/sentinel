import json
from datetime import date
from pathlib import Path

from sentinel.models.annotation import Annotation
from sentinel.models.event import HealthEvent
from sentinel.models.situation import Situation


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
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

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
        path.write_text(content)

    def load_report(self, day: date) -> str:
        path = self.reports_dir / f"{day.isoformat()}-daily.md"
        return path.read_text() if path.exists() else ""

    def save_situation(self, situation: Situation) -> None:
        path = self.situations_dir / f"{situation.id}.json"
        path.write_text(situation.model_dump_json(indent=2))

    def load_situations(self) -> list[Situation]:
        situations = []
        for path in sorted(self.situations_dir.glob("*.json")):
            situations.append(Situation.model_validate_json(path.read_text()))
        return situations

    def save_annotation(self, annotation: Annotation) -> None:
        path = self.annotations_dir / f"{annotation.id}.json"
        path.write_text(annotation.model_dump_json(indent=2))

    def load_annotations(self) -> list[Annotation]:
        annotations = []
        for path in sorted(self.annotations_dir.glob("*.json")):
            annotations.append(Annotation.model_validate_json(path.read_text()))
        return annotations
