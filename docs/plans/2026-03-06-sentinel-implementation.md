# SENTINEL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build SENTINEL — an automated daily public health intelligence pipeline and dashboard for Swiss federal agencies (BLV/BAG) to monitor global disease threats under the One Health framework.

**Architecture:** Python FastAPI backend with pluggable collectors for 5 data sources (WHO DON, WHO EIOS, ProMED, ECDC, WOAH). Hybrid risk scoring (rule engine + Claude LLM). Next.js SSG dashboard with 7 views deployed to GitHub Pages. All data stored as JSON in the repo, pipeline runs via GitHub Actions cron.

**Tech Stack:** Python 3.12+ / FastAPI / Pydantic / Anthropic SDK / Next.js 14 / React 18 / TypeScript / Tailwind CSS / Recharts / Mapbox GL / pytest / Vitest / GitHub Actions

**Design Doc:** `docs/plans/2026-03-06-sentinel-design.md`

---

## Phase 1: Project Scaffolding & Data Models

### Task 1: Initialize Git Repository and Project Structure

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `CLAUDE.md`
- Create: `backend/pyproject.toml`
- Create: `backend/sentinel/__init__.py`
- Create: `backend/sentinel/config.py`

**Step 1: Initialize git repo**

```bash
cd /Users/jonashertner/sentinel
git init
```

**Step 2: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
dist/
build/
.venv/
venv/
.env

# Node
node_modules/
.next/
out/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Secrets
.env.local
.env.production
```

**Step 3: Create LICENSE (MIT)**

Standard MIT license with year 2026.

**Step 4: Create CLAUDE.md**

```markdown
# SENTINEL

Swiss Epidemic Notification and Threat Intelligence Engine.

## Project Structure
- `backend/` — Python FastAPI backend (collectors, analysis, API)
- `frontend/` — Next.js dashboard
- `data/` — Pipeline output (JSON files, committed to repo)
- `docs/` — Documentation

## Backend
- Python 3.12+, managed with uv
- FastAPI + Pydantic models
- Run: `cd backend && uv run python -m sentinel.pipeline`
- Test: `cd backend && uv run pytest`
- Lint: `cd backend && uv run ruff check .`

## Frontend
- Next.js 14, TypeScript, Tailwind CSS
- Run: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Test: `cd frontend && npm test`

## Conventions
- All data models use Pydantic v2
- Collectors implement BaseCollector ABC
- ISO 3166 alpha-2 for country codes
- Risk scores: 0-10 float scale
- Risk categories: CRITICAL (8-10), HIGH (6-8), MEDIUM (4-6), LOW (0-4)
```

**Step 5: Create backend/pyproject.toml**

```toml
[project]
name = "sentinel"
version = "0.1.0"
description = "Swiss Epidemic Notification and Threat Intelligence Engine"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.34.0",
    "pydantic>=2.10.0",
    "httpx>=0.28.0",
    "feedparser>=6.0.0",
    "beautifulsoup4>=4.12.0",
    "anthropic>=0.42.0",
    "lxml>=5.0.0",
    "python-dateutil>=2.9.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-httpx>=0.35.0",
    "ruff>=0.8.0",
    "respx>=0.22.0",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Step 6: Create backend/sentinel/__init__.py and config.py**

`__init__.py`: empty file.

`config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    data_dir: str = "data"
    log_level: str = "INFO"
    mapbox_token: str = ""

    # Source toggles
    enable_who_don: bool = True
    enable_who_eios: bool = True
    enable_promed: bool = True
    enable_ecdc: bool = True
    enable_woah: bool = True

    model_config = {"env_prefix": "SENTINEL_"}


settings = Settings()
```

Add `pydantic-settings>=2.7.0` to dependencies.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize SENTINEL project scaffolding

Set up Python backend with FastAPI/Pydantic, gitignore,
LICENSE, CLAUDE.md, and project configuration."
```

---

### Task 2: Pydantic Data Models

**Files:**
- Create: `backend/sentinel/models/__init__.py`
- Create: `backend/sentinel/models/event.py`
- Create: `backend/sentinel/models/situation.py`
- Create: `backend/sentinel/models/annotation.py`
- Create: `backend/sentinel/models/organization.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_models.py`

**Step 1: Write tests for data models**

```python
# backend/tests/test_models.py
from datetime import date, datetime

from sentinel.models.event import HealthEvent, RiskCategory, Source, Species
from sentinel.models.annotation import Annotation, AnnotationType, EventStatus, Visibility
from sentinel.models.situation import Situation, SituationStatus, Priority
from sentinel.models.organization import Organization, ORGANIZATIONS


class TestHealthEvent:
    def test_create_minimal_event(self):
        event = HealthEvent(
            title="H5N1 outbreak in poultry",
            source=Source.WHO_DON,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="Avian influenza A(H5N1)",
            countries=["DE"],
            regions=["EURO"],
            species=Species.ANIMAL,
            summary="Outbreak detected in commercial poultry farm.",
            url="https://who.int/don/123",
            raw_content="Full text...",
        )
        assert event.id  # auto-generated
        assert event.risk_score == 0.0
        assert event.risk_category == RiskCategory.LOW

    def test_deterministic_id(self):
        kwargs = dict(
            title="Test",
            source=Source.WHO_DON,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="H5N1",
            countries=["DE"],
            regions=["EURO"],
            species=Species.ANIMAL,
            summary="Test",
            url="https://example.com",
            raw_content="Test",
        )
        e1 = HealthEvent(**kwargs)
        e2 = HealthEvent(**kwargs)
        assert e1.id == e2.id

    def test_risk_category_from_score(self):
        event = HealthEvent(
            title="Test",
            source=Source.ECDC,
            date_reported=date(2026, 3, 1),
            date_collected=date(2026, 3, 6),
            disease="Test",
            countries=["CH"],
            regions=["EURO"],
            species=Species.HUMAN,
            summary="Test",
            url="https://example.com",
            raw_content="Test",
            risk_score=8.5,
        )
        assert event.risk_category == RiskCategory.CRITICAL


class TestAnnotation:
    def test_create_annotation(self):
        ann = Annotation(
            event_id="evt-123",
            author="Dr. Mueller",
            type=AnnotationType.ASSESSMENT,
            content="This is relevant due to Swiss poultry imports.",
            visibility=Visibility.SHARED,
        )
        assert ann.id
        assert ann.timestamp

    def test_risk_override(self):
        ann = Annotation(
            event_id="evt-123",
            author="Dr. Mueller",
            type=AnnotationType.ASSESSMENT,
            content="Upgrading risk.",
            visibility=Visibility.INTERNAL,
            risk_override=9.0,
            status_change=EventStatus.ESCALATED,
        )
        assert ann.risk_override == 9.0


class TestSituation:
    def test_create_situation(self):
        sit = Situation(
            title="H5N1 clade 2.3.4.4b — Europe 2026",
            diseases=["Avian influenza A(H5N1)"],
            countries=["DE", "FR", "NL"],
            lead_analyst="Dr. Mueller",
            summary="Ongoing avian influenza outbreak in European poultry.",
            swiss_impact_assessment="High risk due to migratory bird routes.",
        )
        assert sit.status == SituationStatus.ACTIVE
        assert sit.priority == Priority.P2


class TestOrganizations:
    def test_blv_config(self):
        blv = ORGANIZATIONS["BLV"]
        assert "zoonotic" in blv.domain_focus
        assert "animal" in blv.species_filter

    def test_bag_config(self):
        bag = ORGANIZATIONS["BAG"]
        assert "pandemic" in bag.domain_focus
        assert "human" in bag.species_filter
```

**Step 2: Run tests — verify they fail**

```bash
cd /Users/jonashertner/sentinel/backend && uv run pytest tests/test_models.py -v
```

Expected: ImportError (modules don't exist yet).

**Step 3: Implement models**

`backend/sentinel/models/__init__.py`:
```python
from .event import HealthEvent, RiskCategory, Source, Species
from .annotation import Annotation, AnnotationType, EventStatus, Visibility
from .situation import Situation, SituationStatus, Priority
from .organization import Organization, ORGANIZATIONS

__all__ = [
    "HealthEvent", "RiskCategory", "Source", "Species",
    "Annotation", "AnnotationType", "EventStatus", "Visibility",
    "Situation", "SituationStatus", "Priority",
    "Organization", "ORGANIZATIONS",
]
```

`backend/sentinel/models/event.py`:
```python
import hashlib
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class Source(StrEnum):
    WHO_DON = "WHO_DON"
    WHO_EIOS = "WHO_EIOS"
    PROMED = "PROMED"
    ECDC = "ECDC"
    WOAH = "WOAH"


class Species(StrEnum):
    HUMAN = "human"
    ANIMAL = "animal"
    BOTH = "both"


class RiskCategory(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


def _compute_risk_category(score: float) -> RiskCategory:
    if score >= 8.0:
        return RiskCategory.CRITICAL
    if score >= 6.0:
        return RiskCategory.HIGH
    if score >= 4.0:
        return RiskCategory.MEDIUM
    return RiskCategory.LOW


class HealthEvent(BaseModel):
    id: str = ""
    source: Source
    title: str
    date_reported: date
    date_collected: date
    disease: str
    pathogen: str | None = None
    countries: list[str]
    regions: list[str]
    species: Species
    case_count: int | None = None
    death_count: int | None = None
    summary: str
    url: str
    raw_content: str

    risk_score: float = Field(default=0.0, ge=0.0, le=10.0)
    swiss_relevance: float = Field(default=0.0, ge=0.0, le=10.0)
    risk_category: RiskCategory = RiskCategory.LOW
    one_health_tags: list[str] = Field(default_factory=list)
    analysis: str = ""

    @model_validator(mode="after")
    def _set_computed_fields(self):
        if not self.id:
            raw = f"{self.disease}|{'|'.join(sorted(self.countries))}|{self.date_reported}|{self.source}"
            self.id = hashlib.sha256(raw.encode()).hexdigest()[:16]
        self.risk_category = _compute_risk_category(self.risk_score)
        return self
```

`backend/sentinel/models/annotation.py`:
```python
import uuid
from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field


class AnnotationType(StrEnum):
    ASSESSMENT = "ASSESSMENT"
    NOTE = "NOTE"
    ACTION = "ACTION"
    LINK = "LINK"
    ESCALATION = "ESCALATION"


class EventStatus(StrEnum):
    NEW = "NEW"
    MONITORING = "MONITORING"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    ARCHIVED = "ARCHIVED"


class Visibility(StrEnum):
    INTERNAL = "INTERNAL"
    SHARED = "SHARED"
    CONFIDENTIAL = "CONFIDENTIAL"


class Annotation(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    event_id: str
    author: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    type: AnnotationType
    content: str
    visibility: Visibility
    risk_override: float | None = None
    status_change: EventStatus | None = None
    linked_event_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
```

`backend/sentinel/models/situation.py`:
```python
import uuid
from datetime import date, datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field

from .annotation import Annotation


class SituationStatus(StrEnum):
    ACTIVE = "ACTIVE"
    WATCH = "WATCH"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    ARCHIVED = "ARCHIVED"


class Priority(StrEnum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class Situation(BaseModel):
    id: str = Field(default_factory=lambda: f"sit-{uuid.uuid4().hex[:8]}")
    title: str
    status: SituationStatus = SituationStatus.ACTIVE
    created: date = Field(default_factory=lambda: date.today())
    updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    events: list[str] = Field(default_factory=list)
    diseases: list[str]
    countries: list[str]
    lead_analyst: str
    priority: Priority = Priority.P2
    summary: str
    annotations: list[Annotation] = Field(default_factory=list)
    swiss_impact_assessment: str = ""
    recommended_actions: list[str] = Field(default_factory=list)
    human_health_status: str | None = None
    animal_health_status: str | None = None
    environmental_status: str | None = None
```

`backend/sentinel/models/organization.py`:
```python
from pydantic import BaseModel


class Organization(BaseModel):
    id: str
    name: str
    domain_focus: list[str]
    species_filter: list[str]
    priority_sources: list[str]
    report_template: str = "default"


ORGANIZATIONS: dict[str, Organization] = {
    "BLV": Organization(
        id="BLV",
        name="Federal Food Safety and Veterinary Office",
        domain_focus=["zoonotic", "vector-borne", "foodborne", "AMR", "animal_health"],
        species_filter=["animal", "both"],
        priority_sources=["WOAH", "ECDC", "PROMED"],
    ),
    "BAG": Organization(
        id="BAG",
        name="Federal Office of Public Health",
        domain_focus=["pandemic", "respiratory", "vaccine-preventable", "travel_health", "AMR"],
        species_filter=["human", "both"],
        priority_sources=["WHO_DON", "ECDC", "WHO_EIOS"],
    ),
    "JOINT": Organization(
        id="JOINT",
        name="Joint One Health Coordination",
        domain_focus=["zoonotic", "AMR", "vector-borne"],
        species_filter=["both"],
        priority_sources=["WHO_DON", "WOAH", "ECDC", "PROMED", "WHO_EIOS"],
    ),
}
```

**Step 4: Run tests — verify they pass**

```bash
cd /Users/jonashertner/sentinel/backend && uv run pytest tests/test_models.py -v
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add backend/sentinel/models/ backend/tests/
git commit -m "feat: add Pydantic data models for events, annotations, situations, orgs"
```

---

## Phase 2: Collectors

### Task 3: Base Collector and Data Store

**Files:**
- Create: `backend/sentinel/collectors/__init__.py`
- Create: `backend/sentinel/collectors/base.py`
- Create: `backend/sentinel/store.py`
- Create: `backend/tests/test_store.py`

**Step 1: Write tests for data store**

```python
# backend/tests/test_store.py
import json
import tempfile
from datetime import date
from pathlib import Path

from sentinel.store import DataStore
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(**kwargs) -> HealthEvent:
    defaults = dict(
        title="Test Event",
        source=Source.WHO_DON,
        date_reported=date(2026, 3, 6),
        date_collected=date(2026, 3, 6),
        disease="H5N1",
        countries=["DE"],
        regions=["EURO"],
        species=Species.ANIMAL,
        summary="Test",
        url="https://example.com",
        raw_content="Test content",
    )
    defaults.update(kwargs)
    return HealthEvent(**defaults)


class TestDataStore:
    def test_save_and_load_events(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        events = [_make_event(), _make_event(disease="Dengue", countries=["BR"])]
        store.save_events(date(2026, 3, 6), events)

        loaded = store.load_events(date(2026, 3, 6))
        assert len(loaded) == 2
        assert loaded[0].disease == "H5N1"

    def test_load_nonexistent_date_returns_empty(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        loaded = store.load_events(date(2026, 1, 1))
        assert loaded == []

    def test_load_all_events(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        store.save_events(date(2026, 3, 5), [_make_event(date_reported=date(2026, 3, 5))])
        store.save_events(date(2026, 3, 6), [_make_event(date_reported=date(2026, 3, 6))])

        all_events = store.load_all_events()
        assert len(all_events) == 2

    def test_save_daily_report(self, tmp_path):
        store = DataStore(data_dir=str(tmp_path))
        store.save_report(date(2026, 3, 6), "# Daily Report\n\nContent here.")
        report = store.load_report(date(2026, 3, 6))
        assert "Daily Report" in report
```

**Step 2: Run tests — verify fail**

**Step 3: Implement base collector and data store**

`backend/sentinel/collectors/base.py`:
```python
from abc import ABC, abstractmethod

from sentinel.models.event import HealthEvent


class BaseCollector(ABC):
    """Abstract base class for all data source collectors."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the source identifier (e.g., 'WHO_DON')."""

    @abstractmethod
    async def collect(self) -> list[HealthEvent]:
        """Fetch and return new health events from this source."""
```

`backend/sentinel/store.py`:
```python
import json
from datetime import date
from pathlib import Path

from sentinel.models.event import HealthEvent


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
```

**Step 4: Run tests — verify pass**

**Step 5: Commit**

```bash
git add backend/sentinel/collectors/ backend/sentinel/store.py backend/tests/test_store.py
git commit -m "feat: add base collector interface and JSON data store"
```

---

### Task 4: WHO Disease Outbreak News Collector

**Files:**
- Create: `backend/sentinel/collectors/who_don.py`
- Create: `backend/tests/test_collectors/__init__.py`
- Create: `backend/tests/test_collectors/test_who_don.py`
- Create: `backend/tests/fixtures/who_don_sample.xml`

**Step 1: Create sample RSS fixture by inspecting actual WHO DON feed structure**

Save a representative sample RSS XML to `backend/tests/fixtures/who_don_sample.xml`.

**Step 2: Write tests**

```python
# backend/tests/test_collectors/test_who_don.py
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from sentinel.collectors.who_don import WHODONCollector
from sentinel.models.event import Source


FIXTURES = Path(__file__).parent.parent / "fixtures"


class TestWHODONCollector:
    @pytest.fixture
    def collector(self):
        return WHODONCollector()

    def test_source_name(self, collector):
        assert collector.source_name == "WHO_DON"

    async def test_parse_feed(self, collector):
        xml = (FIXTURES / "who_don_sample.xml").read_text()
        events = collector.parse_feed(xml)
        assert len(events) > 0
        for event in events:
            assert event.source == Source.WHO_DON
            assert event.url.startswith("http")
            assert event.disease
            assert len(event.countries) > 0
```

**Step 3: Implement WHO DON collector**

```python
# backend/sentinel/collectors/who_don.py
import hashlib
import re
from datetime import date

import feedparser
import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

WHO_DON_FEED = "https://www.who.int/feeds/entity/don/en/rss.xml"


class WHODONCollector(BaseCollector):
    source_name = "WHO_DON"

    async def collect(self) -> list[HealthEvent]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(WHO_DON_FEED)
            resp.raise_for_status()
        return self.parse_feed(resp.text)

    def parse_feed(self, xml: str) -> list[HealthEvent]:
        feed = feedparser.parse(xml)
        events = []
        for entry in feed.entries:
            event = self._parse_entry(entry)
            if event:
                events.append(event)
        return events

    def _parse_entry(self, entry) -> HealthEvent | None:
        title = entry.get("title", "")
        link = entry.get("link", "")
        summary = entry.get("summary", "")
        published = entry.get("published_parsed")

        if not title or not link:
            return None

        date_reported = (
            date(published.tm_year, published.tm_mon, published.tm_mday)
            if published
            else date.today()
        )

        disease, countries = self._extract_disease_and_countries(title)

        return HealthEvent(
            source=Source.WHO_DON,
            title=title,
            date_reported=date_reported,
            date_collected=date.today(),
            disease=disease,
            countries=countries,
            regions=[],
            species=Species.HUMAN,
            summary=summary[:2000],
            url=link,
            raw_content=summary,
        )

    def _extract_disease_and_countries(self, title: str) -> tuple[str, list[str]]:
        """Extract disease name and country from DON title format:
        'Disease Name – Country' or 'Disease Name - Country'
        """
        parts = re.split(r"\s*[–—-]\s*", title, maxsplit=1)
        disease = parts[0].strip() if parts else title
        countries = []
        if len(parts) > 1:
            # Country extraction is best-effort; will be refined by normalizer
            countries = [parts[1].strip()[:2].upper()]
        return disease, countries if countries else ["XX"]
```

**Step 4: Run tests — verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: add WHO Disease Outbreak News collector"
```

---

### Task 5: ProMED-mail Collector

**Files:**
- Create: `backend/sentinel/collectors/promed.py`
- Create: `backend/tests/test_collectors/test_promed.py`
- Create: `backend/tests/fixtures/promed_sample.xml`

Same pattern as Task 4. ProMED uses RSS at `https://promedmail.org/feed/`. Parse feed entries, extract disease/location from structured subject lines (format: `PRO/AH/EDR> Disease name - Country: (Province) details`). Map to HealthEvent with `Source.PROMED`. Species detection from PRO (human) vs AH (animal) prefix.

**Commit:** `feat: add ProMED-mail collector`

---

### Task 6: ECDC Collector

**Files:**
- Create: `backend/sentinel/collectors/ecdc.py`
- Create: `backend/tests/test_collectors/test_ecdc.py`
- Create: `backend/tests/fixtures/ecdc_sample.xml`

ECDC RSS feed at `https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed`. Parse threat assessments and communicable disease reports. ECDC events auto-score higher for Swiss relevance (European context). Map to HealthEvent with `Source.ECDC`.

**Commit:** `feat: add ECDC threat assessment collector`

---

### Task 7: WOAH (WAHIS) Collector

**Files:**
- Create: `backend/sentinel/collectors/woah.py`
- Create: `backend/tests/test_collectors/test_woah.py`
- Create: `backend/tests/fixtures/woah_sample.json`

WOAH WAHIS API at `https://wahis.woah.org/api/v1/pi/getReport/list`. Fetch recent animal disease outbreak reports. All events are `Species.ANIMAL` or `Species.BOTH`. Critical for One Health — zoonotic disease early warning. Map to HealthEvent with `Source.WOAH`.

**Commit:** `feat: add WOAH/WAHIS animal disease collector`

---

### Task 8: WHO EIOS Collector

**Files:**
- Create: `backend/sentinel/collectors/who_eios.py`
- Create: `backend/tests/test_collectors/test_who_eios.py`

WHO EIOS (Epidemic Intelligence from Open Sources) public signals. If direct API unavailable, use the public RSS/Atom feed. These are media-based signals — often earliest indicators. Map to HealthEvent with `Source.WHO_EIOS`.

**Commit:** `feat: add WHO EIOS media intelligence collector`

---

## Phase 3: Analysis Pipeline

### Task 9: Event Normalizer

**Files:**
- Create: `backend/sentinel/analysis/__init__.py`
- Create: `backend/sentinel/analysis/normalizer.py`
- Create: `backend/tests/test_analysis/__init__.py`
- Create: `backend/tests/test_analysis/test_normalizer.py`

**Purpose:** Normalize disease names (e.g., "Avian flu" → "Avian influenza A(H5N1)"), standardize country codes to ISO 3166 alpha-2, assign WHO regions, clean HTML from summaries.

Key functions:
- `normalize_disease(name: str) -> str` — lookup table + fuzzy match
- `normalize_country(text: str) -> list[str]` — text to ISO codes
- `normalize_event(event: HealthEvent) -> HealthEvent` — full normalization pass

Include a `DISEASE_ALIASES` dict mapping common variants to canonical names.
Include a `COUNTRY_ALIASES` dict for common names → ISO codes.

**Commit:** `feat: add event normalizer with disease/country standardization`

---

### Task 10: Deduplicator

**Files:**
- Create: `backend/sentinel/analysis/deduplicator.py`
- Create: `backend/tests/test_analysis/test_deduplicator.py`

**Purpose:** Merge events from multiple sources that describe the same outbreak.

Logic:
1. Group by (disease_normalized, country, date_reported ± 3 days)
2. Within groups, merge: keep longest summary, union all source URLs, take highest risk score
3. Merged events get `source` set to the highest-authority source

```python
def deduplicate(events: list[HealthEvent]) -> list[HealthEvent]:
    """Merge duplicate events from different sources."""
```

**Commit:** `feat: add cross-source event deduplication`

---

### Task 11: Rule-Based Risk Engine

**Files:**
- Create: `backend/sentinel/analysis/rule_engine.py`
- Create: `backend/sentinel/analysis/swiss_relevance.py`
- Create: `backend/tests/test_analysis/test_rule_engine.py`

**Purpose:** Deterministic pre-scoring before LLM analysis.

`rule_engine.py` — compute `risk_score` based on:
```python
SWISS_NEIGHBORS = {"DE", "FR", "IT", "AT", "LI"}
SWISS_TRADE_PARTNERS = {"DE", "FR", "IT", "AT", "NL", "BE", "ES", "US", "CN", "BR"}
ESTABLISHED_VECTORS_CH = {"tick": ["TBE", "Lyme"], "mosquito": ["West Nile"]}
HIGH_CONCERN_DISEASES = {"Avian influenza", "Mpox", "Ebola", "MERS", "SARS", "Plague", "Dengue"}

def score_event(event: HealthEvent) -> HealthEvent:
    score = 0.0
    # Geographic proximity (0-3 points)
    if any(c in SWISS_NEIGHBORS for c in event.countries):
        score += 3.0
    elif any(c in SWISS_TRADE_PARTNERS for c in event.countries):
        score += 1.5
    # Disease severity (0-3 points)
    if event.disease in HIGH_CONCERN_DISEASES:
        score += 2.5
    if event.species == Species.BOTH:  # zoonotic
        score += 1.0
    # Case severity (0-2 points)
    if event.death_count and event.death_count > 10:
        score += 2.0
    elif event.case_count and event.case_count > 100:
        score += 1.0
    # Source authority (0-2 points)
    if event.source in (Source.ECDC, Source.WHO_DON):
        score += 1.0
    event.risk_score = min(score, 10.0)
    return event
```

`swiss_relevance.py` — compute `swiss_relevance` score (similar structure, focused on CH-specific factors).

**Commit:** `feat: add rule-based risk scoring and Swiss relevance engine`

---

### Task 12: Claude LLM Analyzer

**Files:**
- Create: `backend/sentinel/analysis/llm_analyzer.py`
- Create: `backend/tests/test_analysis/test_llm_analyzer.py`

**Purpose:** For events scoring >= 4.0 from rule engine, run Claude analysis.

```python
async def analyze_event(event: HealthEvent) -> HealthEvent:
    """Use Claude to generate structured risk analysis and Swiss relevance narrative."""
```

System prompt instructs Claude to act as a Swiss public health epidemiologist. Returns structured JSON with:
- `risk_assessment`: narrative risk analysis
- `swiss_relevance_narrative`: why this matters for CH
- `one_health_tags`: categorization
- `recommended_actions`: list of monitoring steps
- `adjusted_risk_score`: LLM can adjust rule-engine score with reasoning

Use `claude-haiku-4-5-20251001` for events scoring 4-6, `claude-sonnet-4-6` for events scoring 6+.

Mock the Anthropic client in tests using `respx` or `unittest.mock`.

**Commit:** `feat: add Claude LLM risk analyzer with Swiss relevance narratives`

---

### Task 13: Pipeline Orchestrator

**Files:**
- Create: `backend/sentinel/pipeline.py`
- Create: `backend/tests/test_pipeline.py`

**Purpose:** Orchestrate the full daily pipeline: collect → normalize → deduplicate → score → analyze → store → report.

```python
async def run_pipeline(data_dir: str = "data") -> PipelineResult:
    """Run the complete daily collection and analysis pipeline."""
    # 1. Collect from all enabled sources (parallel)
    # 2. Normalize all events
    # 3. Deduplicate across sources
    # 4. Rule-engine scoring
    # 5. LLM analysis (for events >= 4.0)
    # 6. Save events to data store
    # 7. Generate daily report
    # 8. Save report
    # Return summary stats
```

Include a `PipelineResult` model with stats (events collected, deduplicated, analyzed, by source, by risk level).

CLI entry point: `python -m sentinel.pipeline`

**Commit:** `feat: add pipeline orchestrator with full daily collection flow`

---

### Task 14: Daily Report Generator

**Files:**
- Create: `backend/sentinel/reports/__init__.py`
- Create: `backend/sentinel/reports/daily_brief.py`
- Create: `backend/tests/test_reports/__init__.py`
- Create: `backend/tests/test_reports/test_daily_brief.py`

**Purpose:** Generate a structured Markdown daily intelligence brief.

```markdown
# SENTINEL Daily Intelligence Brief — 2026-03-06

## Executive Summary
[LLM-generated 3-sentence overview of today's threat landscape]

## Critical & High Risk Events

### [Event Title] — Risk: 9.2 (CRITICAL)
- **Source:** WHO DON | **Disease:** H5N1 | **Countries:** DE, NL
- **Swiss Relevance:** 8.5 — Border country, migratory bird routes
- **Analysis:** [LLM narrative]
- **Recommended Actions:** [list]

## New Events by Category
### Zoonotic (3 events)
### Vector-borne (1 event)
### Respiratory (2 events)

## Active Situations Update
[Changes to existing situations]

## Source Summary
| Source | Events | New | Notable |
```

**Commit:** `feat: add Markdown daily intelligence brief generator`

---

## Phase 4: FastAPI Backend

### Task 15: FastAPI Application and Event API

**Files:**
- Create: `backend/sentinel/main.py`
- Create: `backend/sentinel/api/__init__.py`
- Create: `backend/sentinel/api/events.py`
- Create: `backend/tests/test_api/__init__.py`
- Create: `backend/tests/test_api/test_events.py`

**Purpose:** REST API serving event data to the dashboard.

Endpoints:
- `GET /api/events` — list events with filters (date, source, disease, risk_category, country)
- `GET /api/events/{id}` — single event detail
- `GET /api/events/latest` — most recent collection day
- `GET /api/stats` — aggregate statistics (counts by source, risk, disease)

Use FastAPI dependency injection with `DataStore`. Enable CORS for GitHub Pages origin.

Test with `TestClient` from `fastapi.testclient` + fixture data.

**Commit:** `feat: add FastAPI app with events API`

---

### Task 16: Situations, Annotations, Watchlists API

**Files:**
- Create: `backend/sentinel/api/situations.py`
- Create: `backend/sentinel/api/annotations.py`
- Create: `backend/sentinel/api/watchlists.py`
- Create: `backend/sentinel/api/analytics.py`
- Create: `backend/tests/test_api/test_situations.py`

Endpoints:
- `GET/POST /api/situations` — list/create situations
- `GET/PATCH /api/situations/{id}` — detail/update
- `POST /api/situations/{id}/events` — link events
- `POST /api/annotations` — create annotation
- `GET /api/annotations?event_id=X` — list annotations for event
- `GET/POST /api/watchlists` — manage watchlists
- `GET /api/analytics/trends` — disease trend data
- `GET /api/analytics/sources` — source comparison data

**Commit:** `feat: add situations, annotations, watchlists, and analytics API`

---

### Task 17: Export API

**Files:**
- Create: `backend/sentinel/api/exports.py`
- Create: `backend/sentinel/reports/csv_export.py`
- Create: `backend/sentinel/reports/pdf_export.py`
- Create: `backend/tests/test_api/test_exports.py`

Endpoints:
- `POST /api/exports/csv` — filtered CSV download
- `POST /api/exports/json` — filtered JSON download
- `POST /api/exports/markdown` — situation report as Markdown
- `GET /api/reports/{date}` — daily brief Markdown

For PoC, skip PDF and STIX (note them as TODO). CSV and JSON exports are the priority.

**Commit:** `feat: add CSV/JSON/Markdown export endpoints`

---

## Phase 5: Seed Data

### Task 18: Generate Realistic Seed Data

**Files:**
- Create: `backend/scripts/generate_seed_data.py`
- Create: `data/events/2026-03-01.json` through `data/events/2026-03-06.json`
- Create: `data/situations/sit-001-h5n1-europe.json`
- Create: `data/situations/sit-002-dengue-sea.json`
- Create: `data/situations/sit-003-mpox-clade1b.json`
- Create: `data/reports/2026-03-06-daily.md`
- Create: `data/watchlists.json`

**Purpose:** The dashboard must look impressive from day one. Generate 6 days of realistic health events based on real-world disease situations (H5N1 in European poultry, dengue in Southeast Asia, mpox clade Ib expansion, cholera in East Africa, measles in Central Asia). Include 3 active situations, sample watchlists, and a sample daily report.

This script uses realistic disease names, country codes, risk scores, and LLM-style analysis text. Events should tell a coherent story across days (situation evolution).

**Commit:** `feat: add realistic seed data for dashboard demo`

---

## Phase 6: Frontend Dashboard

### Task 19: Next.js Project Setup and Design System

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/constants.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/app/layout.tsx`

**Step 1: Initialize Next.js project**

```bash
cd /Users/jonashertner/sentinel/frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

**Step 2: Install dependencies**

```bash
npm install recharts mapbox-gl @mapbox/mapbox-gl-geocoder lucide-react clsx date-fns
npm install -D @types/mapbox-gl
```

**Step 3: Configure Tailwind with design tokens**

`tailwind.config.ts` — Swiss minimalist design system:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: "#0a0a0b",
          surface: "#141416",
          "surface-hover": "#1c1c1f",
          border: "#27272a",
          "border-subtle": "#1e1e21",
          text: "#fafafa",
          "text-secondary": "#a1a1aa",
          "text-muted": "#71717a",
          critical: "#ef4444",
          high: "#f97316",
          medium: "#eab308",
          low: "#3b82f6",
          resolved: "#52525b",
          clear: "#22c55e",
          accent: "#e2e2e2",
        },
      },
      fontFamily: {
        sans: ["Inter", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 4: Create globals.css**

Dark theme, clean typography, scrollbar styling, subtle transitions.

**Step 5: Create lib/types.ts**

TypeScript interfaces matching all Pydantic models (HealthEvent, Annotation, Situation, Organization).

**Step 6: Create lib/constants.ts**

Risk colors, disease category icons, source labels, One Health domain colors.

**Step 7: Create lib/api.ts**

Data fetching layer — in SSG mode, reads from static JSON files in `public/data/`. In dev mode, can proxy to FastAPI backend.

**Step 8: Create root layout.tsx**

Dark theme wrapper, sidebar navigation with 7 views, Inter font loading, status bar.

**Step 9: Commit**

```bash
git commit -m "feat: initialize Next.js frontend with Swiss minimalist design system"
```

---

### Task 20: UI Component Library

**Files:**
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/RiskPill.tsx`
- Create: `frontend/src/components/ui/Sparkline.tsx`
- Create: `frontend/src/components/ui/DataTable.tsx`
- Create: `frontend/src/components/ui/KPICard.tsx`
- Create: `frontend/src/components/ui/SearchInput.tsx`
- Create: `frontend/src/components/ui/FilterBar.tsx`
- Create: `frontend/src/components/ui/Sidebar.tsx`

**Purpose:** Build the primitive UI components that every view uses. Swiss minimalist style: clean borders, precise spacing, monochrome with semantic color accents. Every component must feel engineered and precise.

Design principles for each component:
- `Badge` — source labels (WHO, ECDC, etc.) and disease tags. Subtle background, crisp text.
- `Card` — the primary container. Thin border, no shadow (too decorative), hover state with border highlight.
- `RiskPill` — compact risk level indicator. Color-coded pill with score number.
- `Sparkline` — tiny inline chart using SVG. 7-day trend visualization.
- `KPICard` — large number + label + sparkline + delta indicator.
- `DataTable` — sortable, filterable table with fixed headers. High data density.
- `FilterBar` — horizontal row of filter chips and dropdowns.
- `Sidebar` — navigation with icons, active state, collapsed mode.

**Commit:** `feat: add Swiss minimalist UI component library`

---

### Task 21: Command Center (Landing Page)

**Files:**
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/dashboard/CommandCenter.tsx`

**Purpose:** The first thing analysts see. Must communicate "threat landscape at a glance" in under 3 seconds.

Layout:
```
┌─────────────────────────────────────────────────┐
│  [New Events: 12] [Situations: 5] [Critical: 3] [Swiss-Relevant: 8] │  ← KPI strip
├───────────────────────────┬─────────────────────┤
│                           │                     │
│   Risk World Map          │  Priority Events    │
│   (simplified, no Mapbox  │  (top 10 list)      │
│    — use SVG world map    │                     │
│    for static build)      │                     │
│                           │                     │
├───────────────────────────┴─────────────────────┤
│  7-Day Trend Sparklines by Disease Category     │
└─────────────────────────────────────────────────┘
```

For the SSG/PoC version, use an SVG world map component instead of Mapbox (no API key needed). Countries colored by event density.

**Commit:** `feat: add Command Center dashboard landing page`

---

### Task 22: Triage Queue View

**Files:**
- Create: `frontend/src/app/triage/page.tsx`
- Create: `frontend/src/components/events/EventCard.tsx`
- Create: `frontend/src/components/events/EventDetail.tsx`
- Create: `frontend/src/components/events/TriageActions.tsx`

**Purpose:** Card-based list of events sorted by Swiss relevance. Each card shows source badge, disease, country flags, risk pill, one-line AI summary. Click expands to full detail with annotation panel.

Quick actions on each card:
- Status toggle (New → Monitoring → Escalated → Dismissed)
- Link to situation (dropdown of active situations)
- Add annotation (inline text field)
- Override risk score (number input with required justification)

Filter bar: source, disease, risk level, One Health domain, date range, agency view (BLV/BAG/Joint).

**Commit:** `feat: add Triage Queue view with event cards and quick actions`

---

### Task 23: Global Map View

**Files:**
- Create: `frontend/src/app/map/page.tsx`
- Create: `frontend/src/components/maps/GlobalMap.tsx`
- Create: `frontend/src/components/maps/EventMarker.tsx`
- Create: `frontend/src/components/maps/CountryLayer.tsx`
- Create: `frontend/src/components/maps/MapLegend.tsx`

**Purpose:** Full-screen interactive world map. For the SSG PoC, use a TopoJSON/GeoJSON SVG-based map (no Mapbox dependency). Countries colored by cumulative risk score. Event dots sized by severity, colored by disease category. Click country → sidebar with event list. Switzerland highlighted with incoming risk arrows from neighboring countries.

Toggleable layers: events, disease heatmap, Switzerland detail.
Time slider for date range.

**Commit:** `feat: add interactive Global Map view with event visualization`

---

### Task 24: Situations View

**Files:**
- Create: `frontend/src/app/situations/page.tsx`
- Create: `frontend/src/app/situations/[id]/page.tsx`
- Create: `frontend/src/components/situations/SituationBoard.tsx`
- Create: `frontend/src/components/situations/SituationCard.tsx`
- Create: `frontend/src/components/situations/Timeline.tsx`
- Create: `frontend/src/components/situations/OneHealthMatrix.tsx`
- Create: `frontend/src/components/situations/AnnotationThread.tsx`

**Purpose:**

Board view: 4-column Kanban (Active / Watch / Escalated / Resolved). Cards show title, priority badge, event count, last update, lead analyst, sparkline.

Detail view (`/situations/[id]`):
- Header: title, status, priority, lead analyst, created date
- Timeline: chronological list of linked events from multiple sources
- Annotation thread: discussion-like interface for analyst notes
- One Health Matrix: 3-column view (Human / Animal / Environment) with status indicators
- Swiss Impact Assessment: dedicated panel
- Recommended Actions: checklist
- Export button

**Commit:** `feat: add Situations kanban board and detail views`

---

### Task 25: Analytics View

**Files:**
- Create: `frontend/src/app/analytics/page.tsx`
- Create: `frontend/src/components/charts/TrendChart.tsx`
- Create: `frontend/src/components/charts/SourceComparison.tsx`
- Create: `frontend/src/components/charts/RiskTimeline.tsx`
- Create: `frontend/src/components/charts/OneHealthCorrelation.tsx`
- Create: `frontend/src/components/charts/DiseaseBreakdown.tsx`

**Purpose:** Analytics dashboard with Tufte-inspired Recharts visualizations.

Charts:
1. **Disease Trends** — stacked area chart of events by disease over time
2. **Source Comparison** — bar chart showing which sources report fastest
3. **Switzerland Risk Timeline** — line chart of daily average Swiss relevance score (30/90 day)
4. **One Health Correlation** — dual-axis chart overlaying animal outbreaks and human cases
5. **Disease Breakdown** — horizontal bar chart of events by disease category
6. **Geographic Distribution** — bubble chart of events by region

All charts: dark theme, no gridlines, minimal axis labels, direct data labels where possible.

**Commit:** `feat: add Analytics view with Tufte-inspired charts`

---

### Task 26: Watchlists View

**Files:**
- Create: `frontend/src/app/watchlists/page.tsx`
- Create: `frontend/src/components/watchlists/WatchlistCard.tsx`
- Create: `frontend/src/components/watchlists/WatchlistForm.tsx`

**Purpose:** List of watchlists with match counts and trend arrows. Create/edit form with disease, country, pathogen criteria. Pre-built templates shown as suggestions.

For PoC: stored in localStorage. Display matching events count from loaded data.

**Commit:** `feat: add Watchlists view with custom alert criteria`

---

### Task 27: Export Center View

**Files:**
- Create: `frontend/src/app/exports/page.tsx`
- Create: `frontend/src/components/exports/ExportWizard.tsx`
- Create: `frontend/src/components/exports/FormatSelector.tsx`
- Create: `frontend/src/components/exports/ScopeSelector.tsx`

**Purpose:** Step-by-step export wizard: Select scope (events/situations/date range) → Choose format (CSV/JSON/Markdown) → Apply agency template (BLV/BAG/Joint) → Preview → Download.

For PoC: CSV and JSON export implemented client-side (generate file in browser from loaded data). Markdown report shows daily brief content.

**Commit:** `feat: add Export Center with CSV/JSON download wizard`

---

## Phase 7: GitHub Actions & Deployment

### Task 28: CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: cd backend && uv sync --dev
      - run: cd backend && uv run ruff check .
      - run: cd backend && uv run pytest -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build
```

**Commit:** `ci: add CI workflow for backend and frontend`

---

### Task 29: Daily Pipeline Workflow

**Files:**
- Create: `.github/workflows/pipeline.yml`

```yaml
name: Daily Pipeline
on:
  schedule:
    - cron: "0 6 * * *"  # 06:00 UTC daily
  workflow_dispatch:  # manual trigger

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: cd backend && uv sync
      - run: cd backend && uv run python -m sentinel.pipeline
        env:
          SENTINEL_ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SENTINEL_DATA_DIR: ../data
      - name: Commit new data
        run: |
          git config user.name "SENTINEL Pipeline"
          git config user.email "sentinel@github-actions"
          git add data/
          git diff --staged --quiet || git commit -m "data: daily collection $(date -u +%Y-%m-%d)"
          git push
```

**Commit:** `ci: add daily pipeline workflow with GitHub Actions cron`

---

### Task 30: Dashboard Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy-dashboard.yml`
- Modify: `frontend/next.config.js` (add static export config)

```yaml
name: Deploy Dashboard
on:
  push:
    branches: [main]
    paths:
      - "data/**"
      - "frontend/**"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Copy data to frontend public
        run: cp -r data/ frontend/public/data/
      - run: cd frontend && npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/out
      - uses: actions/deploy-pages@v4
```

Update `next.config.js` to add `output: 'export'` for static generation.

**Commit:** `ci: add GitHub Pages deployment workflow for dashboard`

---

## Phase 8: Documentation

### Task 31: README.md

**Files:**
- Create: `README.md`

World-class README with:
- SENTINEL title + tagline ("Automated global disease intelligence for Swiss public health")
- Status badges (CI, deployment, license)
- 2-sentence description
- Architecture diagram (Mermaid)
- Feature list with brief descriptions
- Data sources table
- Quick start (3 steps: clone, set API keys, run pipeline)
- Dashboard screenshots section (placeholder until screenshots taken)
- Tech stack
- Contributing link
- License

**Commit:** `docs: add comprehensive README`

---

### Task 32: Documentation Suite

**Files:**
- Create: `docs/architecture.md`
- Create: `docs/data-sources.md`
- Create: `docs/risk-scoring.md`
- Create: `docs/deployment.md`
- Create: `docs/analyst-guide.md`
- Create: `docs/api-reference.md`
- Create: `CONTRIBUTING.md`

Each doc as described in design section 11. Key content:

- `architecture.md` — system diagram, data flow, component descriptions, design decisions with rationale
- `data-sources.md` — per source: what it provides, endpoint/feed URL, update frequency, rate limits, data quality notes
- `risk-scoring.md` — rule engine weights (exact values), LLM prompt templates, Swiss relevance factor weights, scoring examples
- `deployment.md` — fork → set secrets → enable Actions → enable Pages, step by step with screenshots
- `analyst-guide.md` — daily workflow walkthrough: open dashboard → review triage → annotate events → manage situations → export reports
- `api-reference.md` — every endpoint with method, path, query params, request/response JSON examples
- `CONTRIBUTING.md` — how to add a new data source (implement BaseCollector), coding standards, PR process

**Commit:** `docs: add full documentation suite`

---

## Phase 9: Polish

### Task 33: GitHub Repository Setup

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/ISSUE_TEMPLATE/new_data_source.md`

Issue templates for bugs, features, and new data source requests.

**Commit:** `chore: add GitHub issue templates`

---

### Task 34: Final Integration Test and Data Sync

**Step 1:** Run full backend test suite: `cd backend && uv run pytest -v`

**Step 2:** Run frontend build: `cd frontend && npm run build`

**Step 3:** Copy seed data to frontend: `cp -r data/ frontend/public/data/`

**Step 4:** Run frontend dev server and verify all 7 views render correctly with seed data

**Step 5:** Fix any issues found

**Step 6:** Final commit: `feat: complete SENTINEL v0.1.0 proof of concept`

---

## Execution Order Summary

| Phase | Tasks | Description | Milestone |
|-------|-------|-------------|-----------|
| 1 | 1-2 | Scaffolding + Models | Project builds |
| 2 | 3-8 | All 5 collectors | Data collection works |
| 3 | 9-14 | Analysis pipeline | Full pipeline runs |
| 4 | 15-17 | FastAPI backend | API serves data |
| 5 | 18 | Seed data | Demo data ready |
| 6 | 19-27 | Frontend dashboard | Dashboard renders |
| 7 | 28-30 | GitHub Actions | CI/CD works |
| 8 | 31-32 | Documentation | Docs complete |
| 9 | 33-34 | Polish | Ship it |

**Total: 34 tasks across 9 phases.**
