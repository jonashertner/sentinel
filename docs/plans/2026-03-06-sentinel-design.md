# SENTINEL Design Document

**Swiss Epidemic Notification and Threat Intelligence Engine**

Date: 2026-03-06
Status: Approved

---

## 1. Overview

SENTINEL is an automated public health intelligence tool that screens global disease outbreak information daily and produces risk-scored, Switzerland-relevant intelligence briefs and an interactive dashboard. It serves the Swiss Federal Food Safety and Veterinary Office (BLV) and the Federal Office of Public Health (BAG) under the One Health framework — integrating human, animal, and environmental health surveillance.

### Problem

BLV and BAG analysts manually monitor multiple international sources (WHO, ECDC, ProMED, WOAH) for disease signals relevant to Switzerland. This is time-consuming, inconsistent, and risks missing early signals — especially at the human-animal-environment intersection where One Health threats emerge.

### Solution

An automated pipeline that collects, normalizes, deduplicates, and risk-scores global health events daily, presented through a world-class dashboard with analyst workflow tools (triage, annotation, situation tracking, export).

---

## 2. Architecture

```
GitHub Actions (Daily Cron)
    │
    ├── Collectors (WHO DON, WHO EIOS, ProMED, ECDC, WOAH)
    │         │
    │    Normalizer → Unified HealthEvent schema
    │         │
    │    Deduplicator → Cross-source merge
    │         │
    │    Rule Engine → Pre-filter + base score
    │         │
    │    Claude LLM → Risk narrative + Swiss relevance
    │         │
    │    ├── Daily Report (Markdown)
    │    └── events.json (Data Store)
    │              │
    └──────────────┘
                   │
            GitHub Pages
            Next.js SSG Dashboard
```

### Infrastructure

- **Pipeline**: GitHub Actions on daily cron schedule
- **Data store**: JSON files committed to the repository (`data/` directory)
- **Dashboard**: Next.js static site deployed to GitHub Pages
- **LLM**: Claude API (Haiku for bulk screening, Sonnet for detailed analysis)
- **CI**: GitHub Actions for tests, lint, type-check on PRs

---

## 3. Data Sources

| Source | Method | Data Type | One Health Domain |
|--------|--------|-----------|-------------------|
| WHO DONs | RSS + web scrape | Official outbreak reports | Human |
| WHO EIOS | Public API / RSS | Media-based epidemic intelligence | Human / Environment |
| ProMED-mail | RSS feed | Early-warning outbreak reports | Human / Animal |
| ECDC | RSS + CDTR reports | European threat assessments | Human |
| WOAH (WAHIS) | API | Animal disease outbreaks globally | Animal |

Each collector is a pluggable Python module implementing a shared interface. New sources can be added by implementing the `BaseCollector` abstract class.

---

## 4. Data Models

### 4.1 HealthEvent

```python
@dataclass
class HealthEvent:
    id: str                    # deterministic hash (disease + country + date + source)
    source: str                # WHO_DON | PROMED | ECDC | WOAH | WHO_EIOS
    title: str
    date_reported: date
    date_collected: date
    disease: str               # normalized disease name
    pathogen: str | None
    countries: list[str]       # ISO 3166 country codes
    regions: list[str]         # WHO regions
    species: str               # human | animal | both
    case_count: int | None
    death_count: int | None
    summary: str
    url: str
    raw_content: str

    # Analysis pipeline output
    risk_score: float          # 0-10
    swiss_relevance: float     # 0-10
    risk_category: str         # CRITICAL | HIGH | MEDIUM | LOW
    one_health_tags: list[str] # zoonotic, vector-borne, foodborne, AMR
    analysis: str              # LLM-generated risk narrative
```

### 4.2 Annotation

```python
@dataclass
class Annotation:
    id: str
    event_id: str
    author: str
    timestamp: datetime
    type: str                      # ASSESSMENT | NOTE | ACTION | LINK | ESCALATION
    content: str
    visibility: str                # INTERNAL | SHARED | CONFIDENTIAL
    risk_override: float | None
    status_change: str | None      # NEW -> MONITORING -> ESCALATED -> RESOLVED -> ARCHIVED
    linked_event_ids: list[str]
    tags: list[str]
```

### 4.3 Situation (Event Threading)

```python
@dataclass
class Situation:
    id: str
    title: str
    status: str                    # ACTIVE | WATCH | ESCALATED | RESOLVED | ARCHIVED
    created: date
    updated: date
    events: list[str]              # linked event IDs
    diseases: list[str]
    countries: list[str]
    lead_analyst: str
    priority: str                  # P1 (immediate) -> P4 (watch)
    summary: str                   # evolving narrative, LLM-assisted
    annotations: list[Annotation]
    swiss_impact_assessment: str
    recommended_actions: list[str]
    human_health_status: str | None
    animal_health_status: str | None
    environmental_status: str | None
```

### 4.4 Organization (Multi-Agency)

```python
ORGS = {
    "BLV": {
        "domain_focus": ["zoonotic", "vector-borne", "foodborne", "AMR", "animal_health"],
        "species_filter": ["animal", "both"],
        "priority_sources": ["WOAH", "ECDC", "ProMED"],
    },
    "BAG": {
        "domain_focus": ["pandemic", "respiratory", "vaccine-preventable", "travel_health", "AMR"],
        "species_filter": ["human", "both"],
        "priority_sources": ["WHO_DON", "ECDC", "WHO_EIOS"],
    },
    "JOINT": {
        "domain_focus": ["zoonotic", "AMR", "vector-borne"],
        "species_filter": ["both"],
    },
}
```

---

## 5. Risk Scoring (Hybrid Approach)

### 5.1 Rule Engine (Pre-filter)

Deterministic scoring based on:

- **Geographic proximity**: neighboring countries score higher; Swiss trade partners weighted
- **Disease type**: zoonotic and vector-borne diseases weighted higher (One Health priority)
- **Known vectors in Switzerland**: tick-borne, mosquito-borne diseases where vectors are established
- **Case severity**: CFR, case count growth rate
- **Source authority**: ECDC threat assessments and WHO DONs weighted as high-confidence
- **Travel/trade routes**: events in countries with high Swiss travel/import volume

### 5.2 LLM Analysis (Claude)

For events passing the rule-engine threshold:

- Structured risk assessment with reasoning
- Switzerland-specific relevance narrative (why this matters for CH)
- One Health cross-domain analysis (animal -> human spillover potential)
- Recommended monitoring actions
- Historical context (similar past events and outcomes)

### 5.3 Swiss Relevance Factors

- Border country outbreaks (DE, FR, IT, AT, LI)
- Migratory bird routes crossing Switzerland (for avian diseases)
- Swiss agricultural imports from affected regions
- Travel volume from affected countries
- Vector habitat suitability in Swiss climate zones
- Existing Swiss surveillance programs for the disease

---

## 6. Dashboard Design

### 6.1 Design Language

- **Swiss minimalist / International Typographic Style**
- Dark theme default (situational awareness tool aesthetic)
- Strict grid system, clean typography (Inter / Helvetica Neue)
- Color used only for meaning: Red (critical) -> Orange (high) -> Yellow (medium) -> Blue (low) -> Gray (resolved)
- Green reserved exclusively for "all clear"
- High data density, Tufte-inspired charts (D3.js + Recharts)
- Precise micro-interactions (200ms transitions)

### 6.2 Seven Core Views

1. **Command Center** — KPI cards, risk heatmap, priority events, trend sparklines
2. **Global Map** — Mapbox GL with toggleable layers (events, trade routes, migration routes, vector habitats), time slider for spread animation
3. **Triage Queue** — card-based event review with quick actions (assign status, link, annotate, override score), batch operations
4. **Situations** — Kanban board (Active/Watch/Escalated/Resolved), situation detail pages with timeline, annotation thread, One Health impact matrix
5. **Analytics** — disease trends, source comparison, geographic spread velocity, Switzerland risk trend, One Health correlation view, historical comparison
6. **Watchlists** — custom alert criteria, pre-built templates (Swiss border countries, PHEIC diseases, BLV priority zoonoses)
7. **Export Center** — wizard for PDF/CSV/JSON/Markdown/STIX export, agency-specific templates, scheduled recurring reports

### 6.3 Multi-Agency Support

- Login selects agency (BLV/BAG) -> adjusts default filters, priority ranking, report templates
- Shared situations visible to both agencies with per-agency annotations
- Cross-agency alerts for zoonotic spillover events
- Joint "One Health" view for inter-agency coordination

---

## 7. Export System

| Format | Purpose | Audience |
|--------|---------|----------|
| PDF Intelligence Brief | Executive summary with risk matrix and map | BLV/BAG leadership |
| CSV/Excel | Raw event data with applied filters | Epidemiologists, cantonal offices |
| Structured JSON | Machine-readable for system integration | IT systems (e.g., ALEK platform) |
| Markdown Report | Situation deep-dive with annotation history | Working groups |
| STIX/TAXII | Standardized threat intelligence sharing | International partners (WHO, ECDC) |
| Email Digest | Configurable daily/weekly priority alerts | All staff |

---

## 8. Data Persistence (PoC)

All state stored as JSON files in the repository:

```
data/
  events/
    2026-03-06.json
  situations/
    sit-001-h5n1-europe.json
  annotations/
    2026-03-06.json
  reports/
    2026-03-06-daily.md
  exports/
  watchlists.json
  analysts.json
```

Dashboard annotations stored in localStorage with JSON export/import for the PoC. Production deployment would use a proper database.

---

## 9. Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.12+, FastAPI, Pydantic |
| LLM | Anthropic Claude API (Haiku + Sonnet) |
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | Tailwind CSS, custom design tokens |
| Charts | D3.js, Recharts |
| Maps | Mapbox GL JS / Deck.gl |
| Testing | pytest (backend), Vitest (frontend) |
| CI/CD | GitHub Actions |
| Deployment | GitHub Pages (frontend), GitHub Actions (pipeline) |

---

## 10. Repository Structure

```
sentinel/
├── README.md
├── LICENSE (MIT)
├── CONTRIBUTING.md
├── CLAUDE.md
├── .github/workflows/
│   ├── pipeline.yml
│   ├── deploy-dashboard.yml
│   └── ci.yml
├── docs/
│   ├── architecture.md
│   ├── data-sources.md
│   ├── risk-scoring.md
│   ├── deployment.md
│   ├── analyst-guide.md
│   └── api-reference.md
├── backend/
│   ├── pyproject.toml
│   └── sentinel/
│       ├── main.py
│       ├── config.py
│       ├── pipeline.py
│       ├── collectors/ (base, who_don, who_eios, promed, ecdc, woah)
│       ├── analysis/ (normalizer, deduplicator, rule_engine, llm_analyzer, swiss_relevance)
│       ├── models/ (event, situation, annotation, organization)
│       ├── reports/ (daily_brief, pdf_export, csv_export, stix_export)
│       └── api/ (events, situations, annotations, exports, watchlists, analytics)
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── app/ (7 view pages)
│       ├── components/ (ui, maps, charts, events, situations, exports)
│       ├── lib/ (api, types, constants, utils)
│       └── styles/
└── data/ (pipeline output, git-committed)
```

---

## 11. Documentation Plan

1. **README.md** — Hero banner, 2-sentence description, architecture diagram, screenshot gallery, quick start (3 commands), feature overview, tech stack badges
2. **docs/architecture.md** — Full system design with diagrams, data flow, design decisions with rationale
3. **docs/data-sources.md** — Per source: capabilities, API details, rate limits, data quality, fallback strategies
4. **docs/risk-scoring.md** — Transparent methodology: rule weights, LLM prompts, Swiss relevance factors
5. **docs/analyst-guide.md** — User manual with screenshots, daily workflow walkthrough
6. **docs/deployment.md** — Step-by-step: fork -> set secrets -> enable Actions -> enable Pages
7. **docs/api-reference.md** — Backend API endpoints with request/response examples
8. **Inline documentation** — Docstrings on public functions, type hints throughout
