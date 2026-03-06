# Contributing to SENTINEL

Thank you for your interest in contributing to SENTINEL. This document covers how to add new data sources, code standards, and the pull request process.

---

## Architecture Overview for New Contributors

SENTINEL follows a pipeline architecture:

```
Collectors --> Normalizer --> Deduplicator --> Rule Engine --> Swiss Relevance --> LLM Analyzer --> Data Store
```

- **Backend** (`backend/sentinel/`) -- Python 3.12, FastAPI, Pydantic v2
- **Frontend** (`frontend/`) -- Next.js 14, React 18, TypeScript, Tailwind CSS
- **Data** (`data/`) -- JSON files committed to the repository (pipeline output)

All data models use Pydantic v2. Country codes are ISO 3166 alpha-2. Risk scores are floats on a 0--10 scale.

---

## Adding a New Data Source

The most common contribution is adding a new data source collector. SENTINEL uses a pluggable collector architecture.

### Step 1: Create the collector

Create a new file in `backend/sentinel/collectors/`. Your collector must implement the `BaseCollector` abstract class:

```python
# backend/sentinel/collectors/my_source.py
import logging
from datetime import date

import httpx

from sentinel.collectors.base import BaseCollector
from sentinel.models.event import HealthEvent, Source, Species

logger = logging.getLogger(__name__)


class MySourceCollector(BaseCollector):
    source_name = "MY_SOURCE"

    async def collect(self) -> list[HealthEvent]:
        """Fetch and return new health events from this source."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get("https://example.com/api/events")
                resp.raise_for_status()
            return self._parse_response(resp.json())
        except Exception:
            logger.exception("Failed to collect from MySource")
            return []

    def _parse_response(self, data: dict) -> list[HealthEvent]:
        events = []
        for item in data.get("items", []):
            events.append(HealthEvent(
                source=Source.MY_SOURCE,  # Add to Source enum first
                title=item["title"],
                date_reported=date.fromisoformat(item["date"]),
                date_collected=date.today(),
                disease=item["disease"],
                countries=[item["country_code"]],
                regions=[],
                species=Species.HUMAN,
                summary=item.get("summary", ""),
                url=item["url"],
                raw_content=str(item),
            ))
        return events
```

### Step 2: Register the source

1. Add the source to the `Source` enum in `backend/sentinel/models/event.py`
2. Add a toggle in `backend/sentinel/config.py`: `enable_my_source: bool = True`
3. Register in `backend/sentinel/pipeline.py`:

```python
if settings.enable_my_source:
    collectors.append(MySourceCollector())
```

4. Add source priority in `backend/sentinel/analysis/deduplicator.py` (`SOURCE_PRIORITY` dict)

### Step 3: Add tests

Create `backend/tests/test_my_source.py` with at least:

- A test that parses a sample response (use a fixture with real-world example data)
- A test that handles empty/malformed responses gracefully
- A test that the collector returns `[]` on network errors (not exceptions)

### Step 4: Update documentation

- Add the source to `docs/data-sources.md`
- Update the data sources table in `README.md`

---

## Development Setup

### Backend

```bash
cd backend
uv sync --dev          # Install all dependencies
uv run pytest -v       # Run tests
uv run ruff check .    # Lint
uv run ruff format .   # Auto-format
```

### Frontend

```bash
cd frontend
npm ci                 # Install dependencies
npm run dev            # Development server (localhost:3000)
npm run build          # Production build
npm run lint           # ESLint
```

---

## Code Standards

### Python (Backend)

- **Python 3.12+** -- Use modern syntax (`str | None` not `Optional[str]`, `list[str]` not `List[str]`)
- **Pydantic v2** -- All data models use Pydantic `BaseModel` with type annotations
- **Type hints** -- All public function signatures must have complete type annotations
- **Docstrings** -- All public functions and classes require docstrings
- **Linting** -- `ruff` with rules `E, F, I, N, W, UP` enabled. Line length 100
- **Testing** -- `pytest` with `pytest-asyncio` for async tests. Target meaningful coverage, not 100%
- **Error handling** -- Collectors must catch all exceptions and return empty lists, never crash the pipeline
- **Async** -- Collectors use `httpx.AsyncClient` with explicit timeouts (30s default)

### TypeScript (Frontend)

- **TypeScript strict mode** -- No `any` types in new code
- **React 18** -- Functional components with hooks
- **Tailwind CSS** -- Utility-first styling, no custom CSS unless absolutely necessary
- **ESLint** -- Standard Next.js config

### General

- **Commits** -- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `data:`
- **No secrets** -- Never commit API keys, tokens, or credentials. Use environment variables

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Make your changes** following the code standards above
3. **Write tests** for any new functionality
4. **Run the full check suite** before submitting:

```bash
# Backend
cd backend && uv run ruff check . && uv run pytest -v

# Frontend
cd frontend && npm run lint && npm run build
```

5. **Submit a PR** with a clear description of what changed and why
6. **Address review feedback** -- maintainers may request changes

### What makes a good PR

- Focused on a single concern (one feature, one bug fix)
- Includes tests for new behavior
- Updates relevant documentation
- Passes all CI checks
- Has a clear title and description

---

## Project Conventions

| Convention | Standard |
|------------|----------|
| Country codes | ISO 3166 alpha-2 (e.g., `CH`, `DE`, `FR`) |
| Disease names | Canonical names via normalizer (e.g., `Avian influenza A(H5N1)`) |
| Risk scores | Float, 0.0 -- 10.0 |
| Risk categories | `CRITICAL` (>= 8), `HIGH` (>= 6), `MEDIUM` (>= 4), `LOW` (< 4) |
| Event IDs | SHA-256 hash of `disease|countries|date|source`, truncated to 16 chars |
| Dates | ISO 8601 (`YYYY-MM-DD`) |
| Data storage | JSON files in `data/` directory, committed to the repository |

---

## Questions?

Open a GitHub Issue for questions, bug reports, or feature requests.
