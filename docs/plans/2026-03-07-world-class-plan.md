# SENTINEL World-Class Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade SENTINEL to world-class Swiss public health epidemic intelligence platform across 9 phases.

**Architecture:** Evolutionary upgrade — each phase is independently deployable. Phases 1-4 are foundational; Phases 5-9 build on them.

**Tech Stack:** Python 3.12, FastAPI, PostgreSQL 16 + TimescaleDB, Redis 7, Celery, Next.js 14, TypeScript, Tailwind CSS

---

## Phase 1: Foundation

### Task 1.1: PostgreSQL Database Schema

**Files:**
- Create: `backend/sentinel/db/__init__.py`
- Create: `backend/sentinel/db/engine.py`
- Create: `backend/sentinel/db/models.py`
- Create: `backend/sentinel/db/migrations/001_initial.sql`
- Create: `backend/sentinel/db/repository.py`
- Modify: `backend/sentinel/config.py`
- Modify: `backend/pyproject.toml`
- Test: `backend/tests/test_db/test_repository.py`

**Context:** Replace file-based DataStore with PostgreSQL. The DataStore interface (`save_events`, `load_events`, `load_all_events`, `save_annotation`, etc.) stays the same — we swap the implementation.

**Step 1: Add dependencies**

Add to `backend/pyproject.toml`:
```toml
dependencies = [
    # ... existing
    "asyncpg>=0.30.0",
    "sqlalchemy[asyncio]>=2.0",
    "alembic>=1.14",
]
```

**Step 2: Database engine**

Create `backend/sentinel/db/engine.py`:
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sentinel.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
```

**Step 3: SQLAlchemy models**

Create `backend/sentinel/db/models.py` with tables:
- `events` — all HealthEvent fields. Primary key: (id, date_collected). JSONB columns for: source_evidence, trigger_flags, recommended_actions, escalation_workflow, one_health_tags, merged_from, analyst_overrides.
- `annotations` — all Annotation fields. FK to events(id). Author stored as string (upgraded to FK in Task 1.2).
- `situations` — all Situation fields. JSONB for events list, annotations, diseases, countries.
- `watchlists` — id, name, diseases (JSONB array), countries (JSONB array), min_risk_score, one_health_tags (JSONB array), created_by, created_at.
- `collector_runs` — source, started_at, finished_at, event_count, ok, error, latency_ms.
- `audit_log` — id, user_id (nullable initially), action (VARCHAR), entity_type, entity_id, old_value (JSONB), new_value (JSONB), timestamp.

**Step 4: Initial migration SQL**

Create `backend/sentinel/db/migrations/001_initial.sql` with full CREATE TABLE statements, indexes on: events(date_collected), events(disease), events(risk_score), events(swiss_relevance), annotations(event_id), situations(status), audit_log(timestamp), collector_runs(source, started_at).

**Step 5: Repository layer**

Create `backend/sentinel/db/repository.py` implementing the same interface as DataStore:
```python
class PostgresStore:
    def __init__(self, session: AsyncSession): ...
    async def save_events(self, day: date, events: list[HealthEvent]) -> None: ...
    async def load_events(self, day: date) -> list[HealthEvent]: ...
    async def load_all_events(self) -> list[HealthEvent]: ...
    async def save_annotation(self, annotation: Annotation) -> None: ...
    async def load_annotations(self, event_id: str | None = None) -> list[Annotation]: ...
    async def save_situation(self, situation: Situation) -> None: ...
    async def load_situations(self) -> list[Situation]: ...
    async def save_watchlist(self, watchlist: Watchlist) -> None: ...
    async def load_watchlists(self) -> list[Watchlist]: ...
    async def delete_watchlist(self, id: str) -> None: ...
    async def save_collector_run(self, status: CollectorStatus) -> None: ...
    async def write_manifest(self) -> Manifest: ...
```

**Step 6: Add database_url to config**

Modify `backend/sentinel/config.py`:
```python
database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"
```

**Step 7: Write tests**

Test repository CRUD operations with a test database (use pytest-asyncio + testcontainers-python or SQLite for fast tests).

**Step 8: Commit**
```bash
git add backend/sentinel/db/ backend/pyproject.toml backend/sentinel/config.py backend/tests/test_db/
git commit -m "feat(db): add PostgreSQL schema, repository layer, and migrations"
```

---

### Task 1.2: Authentication & RBAC

**Files:**
- Create: `backend/sentinel/auth/__init__.py`
- Create: `backend/sentinel/auth/models.py`
- Create: `backend/sentinel/auth/dependencies.py`
- Create: `backend/sentinel/auth/oidc.py`
- Create: `backend/sentinel/db/migrations/002_users.sql`
- Modify: `backend/sentinel/api/events.py`
- Modify: `backend/sentinel/api/annotations.py`
- Modify: `backend/sentinel/api/situations.py`
- Modify: `backend/sentinel/api/watchlists.py`
- Modify: `backend/sentinel/config.py`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth-context.tsx`
- Create: `frontend/src/components/ui/LoginGate.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Test: `backend/tests/test_auth/test_dependencies.py`

**Step 1: User model and migration**

`002_users.sql`:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ANALYST',
    org VARCHAR(50),  -- BAG, BLV, CANTONAL_ZH, etc.
    canton VARCHAR(2),  -- ZH, BE, GE, etc. (for CANTONAL role)
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Add user_id FK to audit_log
ALTER TABLE audit_log ADD COLUMN user_id UUID REFERENCES users(id);
-- Add author_id FK to annotations
ALTER TABLE annotations ADD COLUMN author_id UUID REFERENCES users(id);
```

**Step 2: Role enum and auth models**

```python
# backend/sentinel/auth/models.py
from enum import Enum
from pydantic import BaseModel
from uuid import UUID

class Role(str, Enum):
    ANALYST = "ANALYST"
    SUPERVISOR = "SUPERVISOR"
    CANTONAL = "CANTONAL"
    EXECUTIVE = "EXECUTIVE"
    ADMIN = "ADMIN"

class User(BaseModel):
    id: UUID
    email: str
    name: str
    role: Role
    org: str | None = None
    canton: str | None = None

# Permissions matrix
PERMISSIONS = {
    Role.ANALYST: {"read_events", "annotate", "create_watchlist", "triage"},
    Role.SUPERVISOR: {"read_events", "annotate", "create_watchlist", "triage",
                      "approve_escalation", "manage_situations", "ihr_notify"},
    Role.CANTONAL: {"read_events", "annotate"},
    Role.EXECUTIVE: {"read_events", "read_analytics"},
    Role.ADMIN: {"*"},  # all permissions
}
```

**Step 3: OIDC integration**

`backend/sentinel/auth/oidc.py` — validate JWT from OIDC provider, extract user claims, upsert user record.

**Step 4: FastAPI dependency**

```python
# backend/sentinel/auth/dependencies.py
async def get_current_user(
    authorization: str = Header(None),
    session: AsyncSession = Depends(get_session),
) -> User: ...

def require_permission(permission: str):
    async def checker(user: User = Depends(get_current_user)):
        if permission not in PERMISSIONS[user.role] and "*" not in PERMISSIONS[user.role]:
            raise HTTPException(403, f"Missing permission: {permission}")
        return user
    return checker
```

**Step 5: Protect API routes**

Add `user: User = Depends(require_permission("annotate"))` to mutation endpoints. Read endpoints use `get_current_user` for audit but don't restrict. CANTONAL role gets filtered events.

**Step 6: Frontend auth context**

`frontend/src/lib/auth-context.tsx` — wraps app with auth state. On mount, checks for JWT cookie. If missing, redirects to OIDC login. Provides `useAuth()` hook with user info and role.

**Step 7: LoginGate component**

Wraps `<main>` content. If not authenticated, shows login redirect. Role-based nav item visibility (EXECUTIVE doesn't see triage, CANTONAL sees cantonal filter).

**Step 8: Tests**

Test permission matrix, JWT validation, cantonal filtering.

**Step 9: Commit**
```bash
git commit -m "feat(auth): add OIDC authentication and role-based access control"
```

---

### Task 1.3: Audit Logging

**Files:**
- Create: `backend/sentinel/audit.py`
- Modify: `backend/sentinel/api/annotations.py`
- Modify: `backend/sentinel/api/situations.py`
- Modify: `backend/sentinel/api/watchlists.py`
- Test: `backend/tests/test_audit.py`

**Step 1: Audit service**

```python
# backend/sentinel/audit.py
async def log_action(
    session: AsyncSession,
    user_id: UUID | None,
    action: str,  # "create_annotation", "update_situation", "override_risk", etc.
    entity_type: str,  # "event", "annotation", "situation", "watchlist"
    entity_id: str,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> None:
    await session.execute(
        insert(audit_log).values(
            user_id=user_id, action=action, entity_type=entity_type,
            entity_id=entity_id, old_value=old_value, new_value=new_value,
            timestamp=datetime.utcnow(),
        )
    )
```

**Step 2: Instrument all mutation endpoints**

Every POST/PATCH/DELETE endpoint calls `log_action()` with before/after state.

**Step 3: Audit log API**

```python
@router.get("/audit")
async def list_audit_log(
    entity_type: str | None = None,
    entity_id: str | None = None,
    user_id: UUID | None = None,
    since: datetime | None = None,
    limit: int = 100,
    user: User = Depends(require_permission("read_audit")),
) -> list[AuditEntry]: ...
```

**Step 4: Tests and commit**

---

### Task 1.4: WebSocket Infrastructure

**Files:**
- Create: `backend/sentinel/ws.py`
- Modify: `backend/sentinel/api/app.py`
- Create: `frontend/src/lib/ws-context.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: WebSocket manager**

```python
# backend/sentinel/ws.py
class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}  # channel → connections

    async def connect(self, websocket: WebSocket, user_id: str, channels: list[str]): ...
    async def disconnect(self, websocket: WebSocket): ...
    async def broadcast(self, channel: str, message: dict): ...

manager = ConnectionManager()

# Channels: "events", "annotations", "situations", "alerts:{user_id}"
```

**Step 2: WebSocket endpoint**

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate via token query param
    # Subscribe to channels based on role
    # Keep alive with ping/pong
```

**Step 3: Frontend WebSocket context**

```typescript
// frontend/src/lib/ws-context.tsx
export function WSProvider({ children }: { children: ReactNode }) {
    // Connect on mount, reconnect on drop
    // Dispatch events to subscribers
    // useWSSubscribe(channel, callback) hook
}
```

**Step 4: Wire into layout**

Wrap app with `<WSProvider>`. Event pages subscribe to "events" channel for live updates.

**Step 5: Commit**

---

### Task 1.5: Migrate Existing API to Database-Backed

**Files:**
- Modify: `backend/sentinel/api/events.py`
- Modify: `backend/sentinel/api/analytics.py`
- Modify: `backend/sentinel/api/exports.py`
- Modify: `backend/sentinel/api/situations.py`
- Modify: `backend/sentinel/api/annotations.py`
- Modify: `backend/sentinel/api/watchlists.py`
- Modify: `backend/sentinel/pipeline.py`
- Modify: `backend/sentinel/projection.py`
- Create: `backend/sentinel/db/migrations/003_seed_from_json.py`
- Test: `backend/tests/test_api/` (update all existing API tests)

**Step 1: Data migration script**

Read all existing JSON files from data/ and insert into PostgreSQL tables. Run once.

**Step 2: Swap DataStore usage**

Replace `DataStore(data_dir)` with `PostgresStore(session)` in all API routes. Use FastAPI dependency injection for session.

**Step 3: Update pipeline**

Pipeline saves to PostgreSQL instead of JSON. Also saves collector_runs.

**Step 4: Update projection**

`load_projected_events()` queries DB instead of loading all files.

**Step 5: Frontend API client**

Change `api.ts` from loading static JSON files to calling `/api/events`, `/api/situations`, etc. Remove all the `deriveXxx()` functions (backend now provides all computed fields).

**Step 6: Run all tests, verify, commit**

---

## Phase 2: Swiss Domestic Sources

### Task 2.1: NNSID Collector

**Files:**
- Create: `backend/sentinel/collectors/nnsid.py`
- Modify: `backend/sentinel/pipeline.py`
- Modify: `backend/sentinel/config.py`
- Create: `backend/sentinel/models/data_classification.py`
- Test: `backend/tests/test_collectors/test_nnsid.py`

**Step 1: Data classification model**

```python
# backend/sentinel/models/data_classification.py
class DataClassification(str, Enum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
```

Add `data_classification: DataClassification = DataClassification.PUBLIC` field to HealthEvent model.

**Step 2: NNSID collector**

```python
class NNSIDCollector(BaseCollector):
    source_name = "NNSID"

    async def collect(self) -> list[HealthEvent]:
        # Authenticate with BAG API credentials
        # Fetch mandatory notifications since last collection
        # Map NNSID disease codes to SENTINEL disease names
        # Set data_classification = CONFIDENTIAL
        # Set confidence = 0.98
        # Set countries = ["CH"]
        # Extract canton from reporting facility → regions
```

**Step 3: Add to pipeline, config (enable_nnsid, nnsid_api_key), tests with respx mocks**

**Step 4: Add Source.NNSID to enum, update SOURCE_LABELS in frontend constants, add i18n keys**

---

### Task 2.2: Sentinella Collector

**Files:**
- Create: `backend/sentinel/collectors/sentinella.py`
- Create: `backend/sentinel/models/baseline.py`
- Test: `backend/tests/test_collectors/test_sentinella.py`

**Step 1: Baseline model**

```python
class EpiBaseline(BaseModel):
    disease: str
    region: str  # canton or national
    week: int  # ISO week
    expected_count: float
    threshold_upper: float  # expected + 2σ
    historical_mean: float
    historical_std: float
```

**Step 2: Sentinella collector**

Parse weekly sentinel reports. Generate HealthEvent when incidence exceeds baseline threshold. Store baseline data in DB for anomaly detection (Phase 5).

**Step 3: Config, pipeline, tests**

---

### Task 2.3: BAG-Bulletin Collector

**Files:**
- Create: `backend/sentinel/collectors/bag_bulletin.py`
- Test: `backend/tests/test_collectors/test_bag_bulletin.py`

Parse BAG weekly bulletin (HTML or PDF). Extract outbreak reports, case counts, vaccination updates. Generate events for new outbreaks. Confidence 0.95.

---

### Task 2.4: RASFF Collector

**Files:**
- Create: `backend/sentinel/collectors/rasff.py`
- Test: `backend/tests/test_collectors/test_rasff.py`

**Step 1: RASFF API collector**

```python
class RASSFCollector(BaseCollector):
    source_name = "RASFF"

    async def collect(self) -> list[HealthEvent]:
        # Query RASFF API for recent notifications
        # Filter: food-borne hazards (Salmonella, Listeria, E.coli, mycotoxins, etc.)
        # Map notifying_country and distribution_countries to ISO codes
        # Set species = ANIMAL (food chain) or hazard_class = FOODBORNE
        # Set lead_agency = BLV
        # Flag Swiss distribution: swiss_relevance boost if CH in distribution countries
```

**Step 2: Add Source.RASFF, i18n keys, config**

---

### Task 2.5: Wastewater Surveillance Collector

**Files:**
- Create: `backend/sentinel/collectors/wastewater.py`
- Test: `backend/tests/test_collectors/test_wastewater.py`

Parse EAWAG/FOPH wastewater monitoring data. Generate synthetic events when pathogen concentration exceeds threshold (configurable per pathogen). Set `data_classification = INTERNAL`, confidence 0.70. Map treatment plant locations to cantons.

---

## Phase 3: Alerting & Near-Real-Time

### Task 3.1: Alert Rules Engine

**Files:**
- Create: `backend/sentinel/alerts/__init__.py`
- Create: `backend/sentinel/alerts/engine.py`
- Create: `backend/sentinel/alerts/models.py`
- Create: `backend/sentinel/db/migrations/004_alerts.sql`
- Create: `backend/sentinel/api/alerts.py`
- Test: `backend/tests/test_alerts/test_engine.py`

**Step 1: Alert rule model**

```python
class AlertCondition(BaseModel):
    field: str  # "risk_score", "swiss_relevance", "disease", "country", "operational_priority"
    operator: str  # "gte", "eq", "in", "contains"
    value: Any

class AlertRule(BaseModel):
    id: str
    user_id: UUID
    name: str
    conditions: list[AlertCondition]  # AND logic
    channels: list[str]  # ["email", "sms", "webhook", "in_app"]
    active: bool = True
    cooldown_minutes: int = 60  # don't re-alert for same event within cooldown
```

**Step 2: Evaluation engine**

```python
async def evaluate_alerts(events: list[HealthEvent], session: AsyncSession) -> list[AlertMatch]:
    rules = await load_active_rules(session)
    matches = []
    for event in events:
        for rule in rules:
            if matches_rule(event, rule) and not in_cooldown(rule, event, session):
                matches.append(AlertMatch(rule=rule, event=event))
    return matches
```

**Step 3: Call from pipeline after event persistence**

**Step 4: API CRUD for alert rules**

**Step 5: Tests**

---

### Task 3.2: Notification Dispatch

**Files:**
- Create: `backend/sentinel/alerts/dispatch.py`
- Create: `backend/sentinel/alerts/templates/`
- Modify: `backend/sentinel/config.py`
- Modify: `backend/sentinel/ws.py`

**Step 1: Email dispatcher**

```python
async def send_email_alert(user: User, event: HealthEvent, rule: AlertRule):
    # Render HTML template (4 languages based on user preference)
    # Include: event title, risk score, Swiss relevance, disease, countries, summary
    # Link to event detail in SENTINEL
    # Send via SMTP (config: smtp_host, smtp_port, smtp_user, smtp_password)
```

**Step 2: SMS dispatcher**

Twilio integration for CRITICAL alerts. Config: twilio_sid, twilio_token, twilio_from.

**Step 3: Webhook dispatcher**

POST JSON payload to configured URL. Support HMAC signature verification.

**Step 4: In-app dispatcher**

Broadcast via WebSocket to `alerts:{user_id}` channel. Store in `alert_history` for notification bell.

**Step 5: Frontend notification bell**

Add notification icon in sidebar with unread count badge. Clicking opens dropdown with recent alerts. Each links to event detail.

---

### Task 3.3: Near-Real-Time Collection

**Files:**
- Create: `backend/sentinel/scheduler.py`
- Modify: `backend/sentinel/pipeline.py`
- Modify: `backend/pyproject.toml`

**Step 1: Add APScheduler or Celery**

```python
# backend/sentinel/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# RSS sources: every 30 minutes
scheduler.add_job(collect_rss_sources, "interval", minutes=30)
# API sources: every 2 hours
scheduler.add_job(collect_api_sources, "interval", hours=2)
# Swiss domestic: every hour
scheduler.add_job(collect_swiss_sources, "interval", hours=1)
# Full pipeline (scoring, dedup, analysis): every 30 minutes
scheduler.add_job(run_incremental_pipeline, "interval", minutes=30)
```

**Step 2: Incremental pipeline**

Only process events collected since last run. Track `last_pipeline_run` timestamp. Skip dedup/scoring for events already processed.

**Step 3: Update GitHub Actions to run scheduler as a long-lived process (or Docker container)**

---

## Phase 4: IHR & Legal Compliance

### Task 4.1: IHR Notification Workflow

**Files:**
- Create: `backend/sentinel/ihr/__init__.py`
- Create: `backend/sentinel/ihr/models.py`
- Create: `backend/sentinel/ihr/workflow.py`
- Create: `backend/sentinel/api/ihr.py`
- Create: `backend/sentinel/db/migrations/005_ihr.sql`
- Create: `frontend/src/app/ihr/page.tsx`
- Create: `frontend/src/components/ihr/AssessmentWizard.tsx`
- Create: `frontend/src/components/ihr/NotificationDraft.tsx`
- Create: `frontend/src/components/ihr/StatusTracker.tsx`
- Test: `backend/tests/test_ihr/test_workflow.py`

**Step 1: IHR notification model**

```python
class IHRStatus(str, Enum):
    ASSESSING = "ASSESSING"
    DRAFT = "DRAFT"
    NOTIFIED = "NOTIFIED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    FOLLOW_UP = "FOLLOW_UP"
    CLOSED = "CLOSED"

class IHRNotification(BaseModel):
    id: str
    event_ids: list[str]
    status: IHRStatus
    assessor_id: UUID  # user who initiated assessment
    assessment: IHRAnnex2Assessment  # structured decision instrument results
    draft_notification: str | None  # WHO template format
    notified_at: datetime | None
    who_reference: str | None  # WHO case reference number
    who_response: str | None
    deadline: datetime  # 24h from assessment start
    notes: list[str]
```

**Step 2: Assessment wizard (frontend)**

4-step wizard walking through IHR Annex 2 decision instrument:
1. Is the event unusual or unexpected? (with guidance text per Swiss context)
2. Is there a risk of serious public health impact?
3. Is there a risk of international spread?
4. Is there a risk of trade/travel restrictions?

Each step shows the event data, pre-fills from automated IHR assessment, allows analyst override with justification.

**Step 3: Draft notification generator**

Auto-generates IHR notification text using WHO template format with event details, assessment results, and response measures.

**Step 4: Deadline monitoring**

Alert when assessment started but not notified within 20h (4h before 24h deadline). Visible countdown in IHR dashboard.

**Step 5: API endpoints**

```
POST   /api/ihr/assess          — Start IHR assessment for event(s)
GET    /api/ihr/notifications    — List all IHR notifications
PATCH  /api/ihr/notifications/{id} — Update status, add WHO response
GET    /api/ihr/dashboard        — Summary: pending, overdue, active
```

**Step 6: IHR dashboard page**

New `/ihr` nav item (visible to SUPERVISOR and ADMIN). Shows:
- Pending assessments (auto-flagged events meeting IHR criteria)
- Active notifications with countdown timers
- Historical notifications (resolved)

---

### Task 4.2: EpG Compliance Tracking

**Files:**
- Create: `backend/sentinel/legal/epg.py`
- Modify: `backend/sentinel/models/event.py`
- Create: `frontend/src/components/events/LegalContext.tsx`

**Step 1: EpG article mapping**

```python
# backend/sentinel/legal/epg.py
EpG_PROVISIONS = {
    "art6_special_situation": {
        "trigger": lambda e: e.operational_priority in ("CRITICAL", "HIGH") and "CH" in e.countries,
        "text_de": "Art. 6 EpG: Besondere Lage — Der Bundesrat kann Massnahmen anordnen.",
        "text_fr": "Art. 6 LEp: Situation particulière — Le Conseil fédéral peut ordonner des mesures.",
        "text_it": "Art. 6 LEp: Situazione particolare — Il Consiglio federale può ordinare provvedimenti.",
        "text_en": "Art. 6 EpidA: Special situation — Federal Council may order measures.",
    },
    "art12_reporting": {
        "trigger": lambda e: "CH" in e.countries and e.disease in NOTIFIABLE_DISEASES,
        "text_de": "Art. 12 EpG: Meldepflicht — Ärzte und Laboratorien müssen melden.",
        ...
    },
    # ... more articles
}

def applicable_provisions(event: HealthEvent) -> list[dict]:
    return [
        {"article": key, **prov}
        for key, prov in EpG_PROVISIONS.items()
        if prov["trigger"](event)
    ]
```

**Step 2: Add to event detail view**

Show applicable legal provisions in a "Legal Context" panel below the Decision Playbook section.

---

### Task 4.3: Data Classification Enforcement

**Files:**
- Modify: `backend/sentinel/api/events.py`
- Modify: `backend/sentinel/auth/dependencies.py`
- Modify: `frontend/src/components/events/EventCard.tsx`

**Step 1: Filter by classification**

```python
# In events endpoint
if user.role == Role.CANTONAL:
    # CANTONAL users don't see CONFIDENTIAL data from other cantons
    events = [e for e in events if e.data_classification != "CONFIDENTIAL" or e.canton == user.canton]
elif user.role == Role.EXECUTIVE:
    # EXECUTIVE sees aggregated data, not CONFIDENTIAL details
    events = [e for e in events if e.data_classification != "CONFIDENTIAL"]
```

**Step 2: Visual indicator**

Show lock icon on CONFIDENTIAL events, info icon on INTERNAL events.

---

## Phase 5: Enhanced Analytics

### Task 5.1: Connectivity-Weighted Swiss Relevance

**Files:**
- Create: `backend/sentinel/analysis/connectivity.py`
- Create: `backend/sentinel/data/air_connectivity.json`
- Create: `backend/sentinel/data/trade_volumes.json`
- Create: `backend/sentinel/data/diaspora.json`
- Create: `backend/sentinel/data/seasonal_factors.json`
- Modify: `backend/sentinel/analysis/swiss_relevance.py`
- Test: `backend/tests/test_analysis/test_connectivity.py`

**Step 1: Connectivity data files**

Pre-computed JSON files (updated quarterly):
- `air_connectivity.json`: `{"DE": 0.95, "US": 0.80, "TH": 0.65, ...}` — normalized passenger volume from BAZL
- `trade_volumes.json`: `{"DE": {"general": 0.95, "food": 0.90}, ...}` — from BAZG, split by food/general
- `diaspora.json`: `{"RS": 0.40, "PT": 0.35, "TR": 0.30, ...}` — BFS foreign population data
- `seasonal_factors.json`: `{"respiratory": {"01": 1.5, "07": 0.3, ...}, "vector_borne": {"06": 1.5, "12": 0.2, ...}}`

**Step 2: Connectivity scoring function**

```python
def compute_swiss_relevance(event: HealthEvent) -> float:
    base = 0.0
    for country in event.countries:
        air = AIR_CONNECTIVITY.get(country, 0.1)
        trade = TRADE_VOLUMES.get(country, {}).get(
            "food" if "foodborne" in event.one_health_tags else "general", 0.1
        )
        diaspora = DIASPORA.get(country, 0.05)
        country_score = 0.4 * air + 0.3 * trade + 0.2 * diaspora + 0.1 * geographic_proximity(country)
        base = max(base, country_score)

    # Disease severity multiplier
    severity = min(event.risk_score / 10.0, 1.0)

    # Seasonal adjustment
    month = str(event.date_reported.month).zfill(2)
    season = get_seasonal_factor(event, month)

    # CH override
    if "CH" in event.countries:
        return 10.0

    return min(base * 10.0 * severity * season, 10.0)
```

**Step 3: Replace current additive model in swiss_relevance.py**

**Step 4: Tests with known country/disease/date combinations**

---

### Task 5.2: Historical Baselines & Anomaly Detection

**Files:**
- Create: `backend/sentinel/analysis/baselines.py`
- Create: `backend/sentinel/analysis/aberration.py`
- Create: `backend/sentinel/db/migrations/006_baselines.sql`
- Create: `backend/sentinel/api/baselines.py`
- Create: `frontend/src/components/charts/BaselineChart.tsx`
- Test: `backend/tests/test_analysis/test_aberration.py`

**Step 1: Baseline computation**

```python
async def compute_baselines(session: AsyncSession) -> None:
    """Compute rolling 52-week baselines per disease × region."""
    # Query event counts grouped by disease, region, ISO week
    # Calculate mean and std over trailing 52 weeks
    # Store in baselines table
    # Run weekly (scheduled task)
```

**Step 2: Farrington algorithm**

```python
def farrington_test(
    observed: int,
    historical: list[int],  # same ISO week from past years
    alpha: float = 0.05,
) -> tuple[bool, float]:
    """Returns (is_aberrant, threshold)."""
    # Quasi-Poisson regression
    # Reference: Farrington et al., 1996; Noufaily et al., 2013
```

**Step 3: Trend classification**

```python
def classify_trend(
    weekly_counts: list[int],  # last 8 weeks
) -> tuple[str, float]:
    """Returns (direction, p_value). Direction: RISING, STABLE, DECLINING."""
    # Mann-Kendall test for monotonic trend
```

**Step 4: API endpoint**

```
GET /api/baselines/{disease}?region=EURO → { expected, threshold, observed, trend, is_aberrant }
```

**Step 5: Frontend baseline chart**

Recharts area chart showing observed vs expected band. Red markers for aberrations.

---

### Task 5.3: Data Quality Framework

**Files:**
- Create: `backend/sentinel/quality/__init__.py`
- Create: `backend/sentinel/quality/metrics.py`
- Create: `backend/sentinel/api/quality.py`
- Create: `frontend/src/app/data-quality/page.tsx`
- Add i18n keys for data quality page

**Step 1: Quality metrics**

```python
class SourceHealth(BaseModel):
    source: str
    last_collection: datetime
    avg_latency_seconds: float
    success_rate_7d: float  # % of successful runs
    events_7d: int
    freshness_status: str  # "OK", "STALE", "DOWN"

class EventCompleteness(BaseModel):
    total_events: int
    with_case_count: int
    with_death_count: int
    with_verification: int
    with_analysis: int
    avg_completeness: float  # 0-1

class OverrideMetrics(BaseModel):
    total_overrides_30d: int
    override_rate: float  # overrides / events
    avg_risk_adjustment: float  # mean(override - original)
    most_corrected_fields: list[tuple[str, int]]
```

**Step 2: API endpoint**

```
GET /api/quality → { source_health[], event_completeness, override_metrics, dedup_stats }
```

**Step 3: Frontend data quality page**

Traffic-light dashboard. Table of source health. Completeness gauge. Override trend chart.

---

### Task 5.4: Structured Epidemiological Parameter Extraction

**Files:**
- Modify: `backend/sentinel/models/event.py`
- Modify: `backend/sentinel/analysis/llm_analyzer.py`
- Modify: `frontend/src/components/events/EventDetail.tsx`
- Add i18n keys for epi parameters

**Step 1: Add fields to HealthEvent**

```python
cfr_estimate: float | None = None
r0_estimate: float | None = None
incubation_period_min_days: float | None = None
incubation_period_max_days: float | None = None
transmission_route: str | None = None  # RESPIRATORY, FECAL_ORAL, VECTOR, etc.
countermeasures: list[str] = []  # VACCINE, THERAPEUTIC, PROPHYLAXIS
swiss_lab_capacity: bool | None = None
```

**Step 2: Update LLM prompt**

Add structured extraction fields to the system prompt. Use tool_use/function calling for reliable JSON output instead of regex parsing.

**Step 3: Display in EventDetail**

New "Epidemiological Parameters" panel showing extracted values with "LLM-estimated" badge.

---

## Phase 6: Collaboration

### Task 6.1: Shared Annotations (Server-Side)

**Files:**
- Modify: `backend/sentinel/api/annotations.py`
- Modify: `frontend/src/components/events/EventDetail.tsx`
- Remove localStorage-based annotation storage from frontend

**Step 1: All annotations go through API**

Frontend EventDetail calls `POST /api/annotations` instead of localStorage. Annotations appear in real-time via WebSocket broadcast.

**Step 2: Annotation list in EventDetail**

Show all annotations for event, with author name, timestamp, visibility badge. Newest first.

**Step 3: Triage status also server-side**

Move MONITOR/ESCALATE/DISMISS state to annotation (type=ACTION) instead of localStorage.

---

### Task 6.2: Task Assignment

**Files:**
- Create: `backend/sentinel/db/migrations/007_tasks.sql`
- Create: `backend/sentinel/api/tasks.py`
- Create: `frontend/src/app/tasks/page.tsx`
- Create: `frontend/src/components/tasks/TaskCard.tsx`
- Add i18n keys for tasks

**Step 1: Tasks table**

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignee_id UUID REFERENCES users(id) NOT NULL,
    created_by UUID REFERENCES users(id) NOT NULL,
    event_id VARCHAR(255),
    situation_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, DONE
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
```

**Step 2: API CRUD**

```
POST   /api/tasks           — Create task
GET    /api/tasks            — List tasks (filter: assignee, status, event_id)
PATCH  /api/tasks/{id}       — Update status, reassign
DELETE /api/tasks/{id}       — Delete task
GET    /api/tasks/my         — My open tasks (for sidebar badge)
```

**Step 3: Frontend tasks page**

Kanban board: OPEN | IN_PROGRESS | DONE. Task cards with assignee, due date, linked event/situation.

**Step 4: "Assign task" button on EventDetail and SituationDetail**

---

### Task 6.3: Shift Handover Briefing

**Files:**
- Create: `backend/sentinel/reports/handover.py`
- Create: `backend/sentinel/api/handover.py`
- Create: `frontend/src/app/handover/page.tsx`
- Add i18n keys for handover

**Step 1: Handover generator**

```python
async def generate_handover(
    session: AsyncSession,
    shift_start: datetime,
    shift_end: datetime,
) -> HandoverBrief:
    return HandoverBrief(
        period=f"{shift_start.isoformat()} — {shift_end.isoformat()}",
        new_events=await count_events_since(session, shift_start),
        unreviewed_events=await count_unreviewed(session),
        pending_escalations=await list_pending_escalations(session),
        approaching_sla=await list_approaching_sla(session, hours=4),
        situation_updates=await list_situation_updates(session, shift_start),
        source_health=await get_source_health(session),
        open_tasks=await count_open_tasks(session),
        ihr_pending=await count_ihr_pending(session),
    )
```

**Step 2: API endpoint**

```
GET /api/handover?shift_hours=8 → HandoverBrief
POST /api/handover/acknowledge → mark handover received
```

**Step 3: Frontend handover page**

Clean, printable briefing. Sections with counts and links. "Acknowledge" button. Auto-generated at shift boundaries.

---

### Task 6.4: Discussion Threads

**Files:**
- Create: `backend/sentinel/db/migrations/008_comments.sql`
- Create: `backend/sentinel/api/comments.py`
- Create: `frontend/src/components/events/CommentThread.tsx`

**Step 1: Comments table**

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,  -- 'event', 'situation'
    entity_id VARCHAR(255) NOT NULL,
    author_id UUID REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL,
    mentions UUID[],  -- user IDs mentioned
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ
);
```

**Step 2: API endpoints**

```
POST /api/comments — Create comment (triggers @mention notifications)
GET  /api/comments?entity_type=event&entity_id=xxx — List thread
```

**Step 3: Frontend CommentThread component**

Rendered in EventDetail and SituationDetail below formal annotations. Lighter styling (chat-like). @mention autocomplete from user list.

---

## Phase 7: Swiss-Specific Views

### Task 7.1: Cantonal Dashboard

**Files:**
- Create: `frontend/src/app/cantonal/page.tsx`
- Create: `frontend/src/components/maps/CantonalMap.tsx`
- Create: `backend/sentinel/data/cantons.json`
- Modify: `backend/sentinel/api/events.py` (canton filter)
- Add i18n keys for cantonal view

**Step 1: Canton data**

```json
{
  "ZH": {"name_de": "Zürich", "name_fr": "Zurich", "name_it": "Zurigo", "population": 1579967, "kantonsarzt": "..."},
  "BE": {"name_de": "Bern", ...},
  ...
}
```

**Step 2: Canton assignment for events**

For events with `"CH"` in countries, use location data (if available from NNSID) or annotation to assign canton. New field: `cantons: list[str]` on HealthEvent.

**Step 3: API canton filter**

```
GET /api/events?canton=ZH → events assigned to Zürich
```

**Step 4: Cantonal dashboard page**

- Canton selector (dropdown or clickable Swiss map)
- Events relevant to selected canton
- Cross-cantonal events (multiple cantons affected)
- Cantonal KPIs (events this week, active situations, approaching SLAs)
- Cantonal contact information

**Step 5: Swiss cantonal map component**

SVG map of 26 cantons, colored by event intensity. Click to select. TopoJSON for Swiss canton boundaries.

---

### Task 7.2: Cross-Border Epidemiology View

**Files:**
- Create: `frontend/src/app/cross-border/page.tsx`
- Create: `frontend/src/components/maps/BorderRegionMap.tsx`
- Create: `backend/sentinel/data/border_regions.json`
- Add i18n keys

**Step 1: Border region definitions**

```json
{
  "basel_tri": {
    "name_de": "Dreiländereck Basel",
    "swiss_cantons": ["BS", "BL"],
    "adjacent": {"DE": ["Baden-Württemberg"], "FR": ["Alsace"]},
    "adjacent_countries": ["DE", "FR"]
  },
  "geneva_leman": {
    "name_de": "Genferseeregion",
    "swiss_cantons": ["GE", "VD"],
    "adjacent": {"FR": ["Haute-Savoie", "Ain"]},
    "adjacent_countries": ["FR"]
  },
  "ticino_lombardy": {
    "name_de": "Tessin-Lombardei",
    "swiss_cantons": ["TI"],
    "adjacent": {"IT": ["Lombardia", "Piemonte"]},
    "adjacent_countries": ["IT"]
  },
  "bodensee": {
    "name_de": "Bodenseeregion",
    "swiss_cantons": ["SG", "TG", "AR", "AI"],
    "adjacent": {"DE": ["Bayern"], "AT": ["Vorarlberg"]},
    "adjacent_countries": ["DE", "AT"]
  }
}
```

**Step 2: Border region page**

4 tabs (one per region). Each shows:
- Zoomed map of border area
- Events on Swiss side + events in adjacent regions
- Key health indicators for both sides
- Commuter flow context

---

### Task 7.3: One Health Unified Dashboard

**Files:**
- Create: `frontend/src/app/one-health/page.tsx`
- Create: `frontend/src/components/one-health/DomainColumn.tsx`
- Create: `frontend/src/components/one-health/SharedSignals.tsx`
- Add i18n keys

**Step 1: Three-column layout**

- **Human Health (BAG):** Events with species=HUMAN, sorted by Swiss relevance
- **Animal Health (BLV):** Events with species=ANIMAL, sorted by risk
- **Shared / Zoonotic (center):** Events with species=BOTH or tags containing zoonotic/foodborne/vector-borne

**Step 2: Cross-domain correlation**

Highlight when an animal outbreak has potential human spillover (e.g., H5N1 in poultry → watch for human cases). Show timeline of animal events followed by human events for same disease.

**Step 3: Joint situation tracker**

Situations tagged as JOINT (lead_agency=JOINT) shown prominently at top.

---

## Phase 8: Analyst UX

### Task 8.1: Keyboard Shortcuts

**Files:**
- Create: `frontend/src/lib/keyboard-context.tsx`
- Create: `frontend/src/components/ui/ShortcutOverlay.tsx`
- Modify: `frontend/src/app/triage/page.tsx`
- Modify: `frontend/src/components/events/EventCard.tsx`
- Modify: `frontend/src/components/events/EventDetail.tsx`
- Add i18n keys

**Step 1: Keyboard context**

```typescript
// frontend/src/lib/keyboard-context.tsx
export function KeyboardProvider({ children }: { children: ReactNode }) {
    // Register global key handlers
    // J/K: navigate focused event index
    // Enter: expand focused event
    // Esc: collapse
    // M/E/D: Monitor/Escalate/Dismiss focused event
    // /: focus search
    // N: next unreviewed
    // ?: toggle shortcut overlay
}
```

**Step 2: Focus management**

Add `focusedIndex` state to triage page. Scroll-into-view on navigation. Visual focus ring on focused EventCard.

**Step 3: Shortcut overlay**

Modal showing all shortcuts in a grid. Triggered by `?`. Dismissible with Esc.

---

### Task 8.2: Batch Triage Operations

**Files:**
- Modify: `frontend/src/app/triage/page.tsx`
- Create: `frontend/src/components/triage/BatchActionBar.tsx`
- Create: `backend/sentinel/api/batch.py`

**Step 1: Multi-select**

Add checkbox to each EventCard. "Select all visible" button. Selected count badge.

**Step 2: Floating action bar**

When events selected, show sticky bar at bottom:
```
[3 selected]  [Dismiss All]  [Set Priority ▾]  [Assign To ▾]  [Clear Selection]
```

**Step 3: Batch API endpoint**

```
POST /api/events/batch-action
{
    "event_ids": ["...", "..."],
    "action": "dismiss" | "set_priority" | "assign",
    "value": "HIGH" | user_id
}
```

---

### Task 8.3: Event Linking

**Files:**
- Create: `backend/sentinel/db/migrations/009_event_links.sql`
- Create: `backend/sentinel/api/event_links.py`
- Modify: `frontend/src/components/events/EventDetail.tsx`

**Step 1: Links table**

```sql
CREATE TABLE event_links (
    event_id_a VARCHAR(255) NOT NULL,
    event_id_b VARCHAR(255) NOT NULL,
    link_type VARCHAR(50) NOT NULL DEFAULT 'RELATED',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id_a, event_id_b)
);
```

**Step 2: API endpoints**

```
POST /api/events/{id}/links — Link to another event
GET  /api/events/{id}/links — Get linked events
DELETE /api/events/{id}/links/{other_id} — Remove link
```

**Step 3: UI in EventDetail**

"Link related event" button. Search modal (by disease, date, country). Linked events section showing linked events with reason.

---

### Task 8.4: Historical Comparison View

**Files:**
- Create: `frontend/src/components/events/ComparisonPanel.tsx`
- Create: `backend/sentinel/api/similar.py`

**Step 1: Similarity search API**

```
GET /api/events/{id}/similar?limit=5 → list of similar historical events
```

Similarity: same disease + overlapping regions + same season (±2 months) + risk within ±2.0

**Step 2: Side-by-side comparison panel**

Shows current event alongside most similar historical event. Highlights differences. Shows outcome of historical event (resolved? escalated? pandemic?).

---

## Phase 9: Advanced Capabilities

### Task 9.1: Forecasting & What-If Modeling

**Files:**
- Create: `backend/sentinel/modeling/__init__.py`
- Create: `backend/sentinel/modeling/sir.py`
- Create: `backend/sentinel/modeling/import_risk.py`
- Create: `backend/sentinel/api/modeling.py`
- Create: `frontend/src/app/modeling/page.tsx`
- Create: `frontend/src/components/modeling/EpidemicCurve.tsx`
- Create: `frontend/src/components/modeling/ScenarioBuilder.tsx`
- Add i18n keys

**Step 1: SIR/SEIR model**

```python
# backend/sentinel/modeling/sir.py
class SEIRParams(BaseModel):
    population: int = 8_800_000  # Swiss population
    r0: float
    incubation_days: float
    infectious_days: float
    initial_exposed: int = 1
    intervention_day: int | None = None
    intervention_r0: float | None = None  # reduced R0 after intervention

def run_seir(params: SEIRParams, days: int = 365) -> SEIRResult:
    """Run SEIR model and return daily S, E, I, R compartments."""
    # Standard SEIR differential equations
    # Optional intervention at day N reducing R0
```

**Step 2: Import risk model**

```python
def compute_import_risk(
    disease: str,
    origin_countries: list[str],
    prevalence_per_100k: float,
) -> ImportRiskResult:
    """Probability of case importation to Switzerland."""
    # For each origin country:
    #   daily_travelers = air_connectivity[country] * annual_passengers / 365
    #   p_infected_traveler = prevalence * daily_travelers / 100_000
    #   p_import_per_day = 1 - (1 - p_infected_traveler) ** daily_travelers
    # Aggregate across countries
```

**Step 3: API endpoint**

```
POST /api/modeling/seir — Run SEIR with parameters → { days[], S[], E[], I[], R[], peak_day, peak_infected, healthcare_demand }
POST /api/modeling/import-risk — Compute import probability → { daily_probability, expected_days_to_first_case }
```

**Step 4: Scenario builder (frontend)**

Interactive form: select disease (pre-fills R0, incubation, infectious period from epi parameters), adjust parameters, set intervention day, compare with/without intervention. Two epidemic curves overlaid.

**Step 5: Healthcare capacity overlay**

Show Swiss ICU capacity line on epidemic curve. Highlight when projected demand exceeds capacity.

---

### Task 9.2: Enhanced LLM Pipeline

**Files:**
- Modify: `backend/sentinel/analysis/llm_analyzer.py`
- Create: `backend/sentinel/analysis/llm_calibration.py`
- Modify: `backend/sentinel/config.py`

**Step 1: Function calling for structured extraction**

Replace regex JSON parsing with Anthropic tool_use:
```python
tools = [{
    "name": "analyze_event",
    "description": "Provide structured epidemiological analysis",
    "input_schema": {
        "type": "object",
        "properties": {
            "risk_assessment": {"type": "string"},
            "adjusted_risk_score": {"type": "number", "minimum": 0, "maximum": 10},
            "swiss_relevance_narrative": {"type": "string"},
            "cfr_estimate": {"type": "number", "nullable": True},
            "r0_estimate": {"type": "number", "nullable": True},
            "transmission_route": {"type": "string", "enum": [...]},
            "ihr_annex2": {"type": "object", ...},
        },
        "required": ["risk_assessment", "adjusted_risk_score"]
    }
}]
```

**Step 2: Tiered model selection**

- CRITICAL/HIGH events: claude-opus-4-6 (maximum quality)
- MEDIUM events: claude-sonnet-4-6 (good quality, lower cost)
- LOW events: Skip LLM analysis entirely

**Step 3: Calibration tracking**

```python
# backend/sentinel/analysis/llm_calibration.py
async def record_calibration(
    event_id: str,
    llm_risk_score: float,
    analyst_risk_score: float | None,
    session: AsyncSession,
) -> None:
    """Track LLM vs analyst scores for calibration analysis."""
```

Generate weekly calibration report: mean absolute error, bias direction, per-disease accuracy.

---

## Navigation Updates

### Task N.1: Update Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/ui/Sidebar.tsx`
- Modify: `frontend/src/lib/i18n.tsx`

Add new nav items (role-gated):
```typescript
const NAV_ITEMS = [
  { href: "/", labelKey: "nav.commandCenter", icon: LayoutDashboard },
  { href: "/map", labelKey: "nav.globalMap", icon: Globe },
  { href: "/triage", labelKey: "nav.triageQueue", icon: ListFilter },
  { href: "/situations", labelKey: "nav.situations", icon: AlertTriangle },
  { href: "/one-health", labelKey: "nav.oneHealth", icon: Heart, roles: ["ANALYST", "SUPERVISOR"] },
  { href: "/cantonal", labelKey: "nav.cantonal", icon: MapPin, roles: ["CANTONAL", "SUPERVISOR", "ADMIN"] },
  { href: "/cross-border", labelKey: "nav.crossBorder", icon: ArrowLeftRight, roles: ["ANALYST", "SUPERVISOR"] },
  { href: "/ihr", labelKey: "nav.ihr", icon: FileCheck, roles: ["SUPERVISOR", "ADMIN"] },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { href: "/data-quality", labelKey: "nav.dataQuality", icon: ShieldCheck, roles: ["SUPERVISOR", "ADMIN"] },
  { href: "/modeling", labelKey: "nav.modeling", icon: TrendingUp, roles: ["ANALYST", "SUPERVISOR"] },
  { href: "/tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { href: "/handover", labelKey: "nav.handover", icon: ArrowRightLeft },
  { href: "/watchlists", labelKey: "nav.watchlists", icon: Eye },
  { href: "/exports", labelKey: "nav.exports", icon: Download },
];
```

Group into sections: Operations | Analysis | Administration

---

## Deployment

### Task D.1: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `.env.example`

```yaml
services:
  db:
    image: timescale/timescaledb:latest-pg16
    volumes: [sentinel-data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: sentinel
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine

  backend:
    build: ./backend
    depends_on: [db, redis]
    environment:
      SENTINEL_DATABASE_URL: postgresql+asyncpg://sentinel:${DB_PASSWORD}@db:5432/sentinel
      SENTINEL_REDIS_URL: redis://redis:6379/0
      SENTINEL_ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

  scheduler:
    build: ./backend
    command: python -m sentinel.scheduler
    depends_on: [db, redis, backend]

  frontend:
    build: ./frontend
    depends_on: [backend]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_PASSWORD}
```

---

## Estimated Scope

| Phase | Tasks | Estimated Files | Dependencies |
|-------|-------|-----------------|--------------|
| 1. Foundation | 5 | ~40 | None |
| 2. Swiss Sources | 5 | ~15 | Phase 1 |
| 3. Alerting | 3 | ~15 | Phase 1 |
| 4. IHR & Legal | 3 | ~20 | Phase 1, 2 |
| 5. Enhanced Analytics | 4 | ~20 | Phase 1, 2 |
| 6. Collaboration | 4 | ~20 | Phase 1 |
| 7. Swiss Views | 3 | ~15 | Phase 1, 2, 5 |
| 8. Analyst UX | 4 | ~15 | Phase 1, 6 |
| 9. Advanced | 2 | ~15 | Phase 1, 5 |
| Nav + Deploy | 2 | ~5 | All |
| **Total** | **35** | **~180** | |
