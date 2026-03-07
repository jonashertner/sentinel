# SENTINEL World-Class Upgrade — Design Document

**Goal:** Transform SENTINEL from a global epidemic intelligence dashboard with Swiss relevance scoring into the definitive operational platform for Swiss federal public health epidemic intelligence — serving BAG, BLV, cantonal health authorities, and the IHR National Focal Point.

**Architecture:** 9-phase evolutionary upgrade preserving the existing pipeline/projection/i18n architecture while adding: PostgreSQL persistence, OIDC authentication with RBAC, Swiss domestic data sources (NNSID, Sentinella, BAG-Bulletin, RASFF, wastewater), real-time alerting, IHR notification workflow, connectivity-weighted Swiss relevance, historical anomaly detection, multi-user collaboration, cantonal views, and analyst efficiency features.

**Phases:**
1. Foundation (DB, Auth, Audit, WebSocket)
2. Swiss Domestic Sources (NNSID, Sentinella, BAG-Bulletin, RASFF, Wastewater)
3. Alerting & Near-Real-Time Collection
4. IHR & Legal Compliance (IHR workflow, EpG tracking, data classification)
5. Enhanced Analytics (connectivity-weighted relevance, baselines, anomaly detection, data quality)
6. Collaboration (shared annotations, tasks, shift handover)
7. Swiss-Specific Views (cantonal, cross-border, One Health dashboard)
8. Analyst UX (keyboard shortcuts, batch triage, event linking)
9. Advanced Capabilities (forecasting, structured epi extraction)

---

## Phase 1: Foundation

### Database (PostgreSQL + TimescaleDB)

**Tables:**
- `events` — hypertable partitioned by date_collected, all HealthEvent fields as columns, JSONB for flexible fields (source_evidence, trigger_flags, recommended_actions, escalation_workflow, one_health_tags)
- `annotations` — foreign key to events, all override fields, author_id FK to users
- `situations` — all Situation fields, JSONB for events list and annotations
- `watchlists` — persistent storage replacing in-memory PoC
- `users` — id, email, name, role, org (BAG/BLV/cantonal), active, created_at
- `audit_log` — user_id, action, entity_type, entity_id, old_value (JSONB), new_value (JSONB), timestamp
- `alert_rules` — user_id, name, conditions (JSONB), channels (email/sms/webhook), active
- `alert_history` — rule_id, event_id, channel, sent_at, acknowledged_at
- `ihr_notifications` — event_id, status (ASSESSING/NOTIFIED/ACKNOWLEDGED/CLOSED), draft content, sent_at, who_response
- `collector_runs` — source, started_at, finished_at, event_count, ok, error, latency_ms

**Migration strategy:** Keep JSON file export as a data exchange format. DataStore interface remains, backed by PostgreSQL instead of files. Manifest endpoint computed from DB queries.

### Authentication (OIDC + RBAC)

**Roles:**
- ANALYST: Triage, annotate, create watchlists
- SUPERVISOR: Approve escalations, manage situations, IHR notifications
- CANTONAL: Read access filtered to canton, annotate
- EXECUTIVE: Read-only executive dashboards
- ADMIN: User management, system config

**Implementation:** FastAPI dependency injection with `get_current_user()`. Frontend stores JWT in httpOnly cookie. OIDC provider configurable (Azure AD for Swiss federal, Keycloak for dev).

### Audit Logging

Every mutation (annotation create, situation update, event override, IHR status change) creates an audit_log entry with before/after values. Immutable append-only table.

### WebSocket Infrastructure

FastAPI WebSocket endpoint at `/ws`. Broadcasts:
- New events from pipeline runs
- Annotation/override changes
- Alert triggers
- Situation updates

Frontend connects on mount, reconnects on drop. Enables real-time collaboration without polling.

---

## Phase 2: Swiss Domestic Sources

### NNSID Collector
- **Source:** BAG Nationales Meldesystem / NNSID API
- **Data:** Mandatory notifiable disease reports from physicians, labs, hospitals
- **Confidence:** 0.98 (highest — official Swiss data)
- **Special handling:** May contain patient-identifiable data → data classification CONFIDENTIAL, role-gated access

### Sentinella Collector
- **Source:** Sentinella surveillance network (ILI, measles, pertussis, tick bites)
- **Data:** Weekly sentinel reports with incidence rates per 100k
- **Special handling:** Provides baseline data for anomaly detection; feed into thresholds table

### BAG-Bulletin Collector
- **Source:** BAG Wochenbulletin / Bulletin OFSP
- **Data:** Weekly curated intelligence summaries, outbreak reports, vaccination coverage
- **Parsing:** PDF or HTML extraction of key metrics and narrative
- **Confidence:** 0.95

### RASFF Collector
- **Source:** EU Rapid Alert System for Food and Feed API
- **Data:** Food safety alerts, border rejections, contamination notifications
- **Special handling:** Maps to BLV domain; species=ANIMAL or hazard_class=FOODBORNE
- **Confidence:** 0.90

### Wastewater Surveillance Collector
- **Source:** EAWAG/FOPH wastewater monitoring platform
- **Data:** Pathogen concentration trends (SARS-CoV-2, influenza, RSV, norovirus, poliovirus) at ~100 Swiss treatment plants
- **Special handling:** Leading indicator — signals 1-2 weeks before clinical cases. Generates synthetic events when concentration exceeds threshold.
- **Confidence:** 0.70 (indirect signal)

---

## Phase 3: Alerting & Near-Real-Time

### Alert Rules Engine
- Configurable per-user rules: conditions on risk_score, swiss_relevance, disease, country, source, IHR flags, operational_priority
- Watchlists become alert-capable (toggle "notify me")
- Rule evaluation runs after every pipeline ingestion

### Notification Channels
- **Email:** SMTP integration, HTML templates per language (DE/FR/IT/EN)
- **SMS:** Twilio/MessageBird for CRITICAL alerts to duty officer
- **Webhook:** POST to arbitrary URL (for integration with BAG/BLV internal systems)
- **In-app:** WebSocket push + notification bell in sidebar with unread count

### Near-Real-Time Collection
- RSS-based collectors (WHO DON, ProMED, ECDC, Beacon, CIDRAP) poll every 30 minutes
- API-based collectors (WOAH, WHO EIOS) poll every 2 hours (rate limits)
- Swiss domestic sources: NNSID real-time push (if available), others hourly
- Pipeline runs incrementally (only new/changed items), not full re-process
- Celery task queue or APScheduler for orchestration

---

## Phase 4: IHR & Legal Compliance

### IHR Notification Workflow
- **Assessment wizard:** Step-by-step IHR Annex 2 decision instrument (4 questions already modeled as ihr_* fields)
- **Draft notification:** Auto-generate structured IHR notification using WHO template fields
- **Status tracking:** ASSESSING → NOTIFIED → ACKNOWLEDGED → CLOSED with timestamps
- **24h deadline monitoring:** Alert when assessment started but not notified within 20h
- **WHO response tracking:** Record WHO acknowledgment and follow-up requests

### EpG Compliance Tracking
- Map events to EpG articles (Art. 6 special situation criteria, Art. 12 reporting obligations, Art. 30-38 measures)
- Surface applicable legal provisions in event detail view
- Track cantonal vs federal jurisdiction per event type

### Data Classification
- Every event gets classification: PUBLIC, INTERNAL, CONFIDENTIAL
- NNSID data defaults to CONFIDENTIAL
- Published WHO/ECDC data defaults to PUBLIC
- Classification controls: API response filtering by user role, UI visibility, export restrictions
- Annotation visibility (already has INTERNAL/SHARED/CONFIDENTIAL in model)

---

## Phase 5: Enhanced Analytics

### Connectivity-Weighted Swiss Relevance
Replace binary country matching with weighted model:
- **Air connectivity score:** BAZL passenger volume data by origin country → weight factor
- **Trade volume score:** Swiss Customs (BAZG) import data by country and commodity → weight factor for foodborne/animal health
- **Diaspora score:** BFS foreign resident population by nationality → weight factor
- **Tourism score:** STV outbound tourism statistics → weight factor
- **Seasonal adjustment:** Monthly multipliers by disease category (respiratory peaks winter, vector-borne peaks summer)
- **Combined formula:** weighted sum normalized to 0-10, replacing current additive model

### Historical Baselines & Anomaly Detection
- **Baseline computation:** Rolling 52-week average by disease × region, stored in `baselines` table
- **Aberration detection:** Farrington improved algorithm for weekly counts; flag events exceeding expected + 2σ
- **Trend classification:** Mann-Kendall test for monotonic trend; output RISING/STABLE/DECLINING with p-value
- **UI:** Sparklines show baseline band; aberrations marked with exclamation icon

### Structured Epidemiological Parameter Extraction
Extend LLM analysis to extract structured fields:
- `cfr_estimate`: Case fatality rate (float, nullable)
- `r0_estimate`: Basic reproduction number (float, nullable)
- `incubation_period_days`: Range (min, max)
- `transmission_route`: Enum (RESPIRATORY, FECAL_ORAL, VECTOR, DIRECT_CONTACT, FOODBORNE, WATERBORNE, UNKNOWN)
- `countermeasures_available`: List (VACCINE, THERAPEUTIC, PROPHYLAXIS, NONE)
- `swiss_lab_capacity`: Boolean (can Swiss reference labs diagnose this?)

### Data Quality Framework
- **Source freshness:** Track last_successful_collection per source; alert if > 2× normal interval
- **Completeness score:** Per-event metric (% of fields populated: case_count, death_count, regions, verification)
- **Cross-source agreement:** When dedup merges sources, measure field concordance
- **Analyst correction rate:** Track overrides/total_events ratio; use as scoring model feedback signal
- **Dashboard:** New /data-quality page showing all metrics with traffic-light indicators

---

## Phase 6: Collaboration

### Shared Annotations
- Annotations stored in PostgreSQL (replacing localStorage)
- Real-time sync via WebSocket
- Author attribution with user profile
- Visibility controls (INTERNAL team only, SHARED cross-agency, CONFIDENTIAL supervisor-only)

### Task Assignment
- New `tasks` table: assignee_id, event_id/situation_id, title, due_at, status (OPEN/IN_PROGRESS/DONE), created_by
- Assign from event detail or situation detail
- My Tasks view in sidebar or dedicated page
- Due date alerts

### Shift Handover Briefing
- Auto-generated at configurable shift boundaries (e.g., 06:00, 14:00, 22:00 — aligned with collection)
- Content: new events since last shift, unreviewed events, pending escalations, approaching SLA deadlines, active situations with updates, data source health
- Markdown format, viewable in-app and exportable
- "Acknowledge handover" button to confirm receipt

### Discussion Threads
- Comment threads on events and situations (separate from formal annotations)
- @mention support with notification
- Lightweight — no approval workflow, just conversation

---

## Phase 7: Swiss-Specific Views

### Cantonal Dashboard
- Canton selector (26 cantons + Liechtenstein)
- Events filtered by canton assignment (derived from country=CH + location normalization)
- Cantonal notification obligations highlighted
- Cantonal contact directory
- Cross-cantonal event view for multi-canton outbreaks

### Cross-Border Epidemiology View
- 4 border region profiles:
  - Basel tri-border (BS/BL ↔ DE-BW, FR-Alsace)
  - Geneva (GE/VD ↔ FR-Haute-Savoie/Ain)
  - Ticino (TI ↔ IT-Lombardia/Piemonte)
  - Bodensee (SG/TG/AR/AI ↔ DE-Bayern, AT-Vorarlberg)
- Map view zoomed to border region with events from both sides
- Commuter flow overlay
- Adjacent-region events highlighted in triage

### One Health Unified Dashboard
- Three-column view: Human (BAG) | Animal (BLV) | Environment
- Shared signals in center (zoonotic, foodborne, vector-borne)
- Correlation view: animal outbreak → human spillover risk
- Joint BAG-BLV situation tracker

---

## Phase 8: Analyst UX

### Keyboard Shortcuts
- `J`/`K`: Navigate events up/down
- `Enter`: Expand event detail
- `Esc`: Collapse / go back
- `M`/`E`/`D`: Monitor / Escalate / Dismiss
- `1-4`: Set priority (CRITICAL/HIGH/ELEVATED/ROUTINE)
- `/`: Focus search/filter
- `N`: Jump to next unreviewed
- `?`: Show shortcut overlay

### Batch Triage
- Checkbox selection on event cards
- Floating action bar: "N selected — Dismiss All / Set Priority / Assign To"
- Select all matching current filters

### Event Linking
- Manual link button on event detail: "Link related event"
- Search by disease, date, country to find candidates
- Creates bidirectional link (not merge — preserves both events)
- Linked events shown in provenance section

### Comparison View
- Side-by-side view of current event vs historical similar events
- Similarity based on disease + region + time of year
- Shows outcome of historical events (resolved, escalated, pandemic)

---

## Phase 9: Advanced Capabilities

### Forecasting & What-If Modeling
- Simple SIR/SEIR compartmental models parameterized per disease
- Swiss population (8.8M), age structure, healthcare capacity (ICU beds, ventilators)
- Import risk model: probability of introduction based on connectivity score × disease prevalence at origin
- Scenario builder: "If H5N1 achieves R0=2.5 human-to-human, project Swiss impact"
- Output: epidemic curves, peak timing, healthcare demand, compare intervention scenarios

### Enhanced LLM Pipeline
- Multi-model ensemble (Claude + GPT-4 for cross-validation)
- Structured extraction with function calling (not regex parsing)
- Confidence calibration: track LLM risk scores vs analyst corrections, adjust systematically
- Swiss-specific fine-tuning prompt library (EpG terminology, BAG/BLV procedures, cantonal system)
- Cost optimization: smaller model for routine events, opus for CRITICAL/HIGH

---

## Tech Stack Additions

| Component | Current | Target |
|-----------|---------|--------|
| Database | JSON files | PostgreSQL 16 + TimescaleDB |
| Cache | None | Redis 7 |
| Task queue | GitHub Actions cron | Celery + Redis broker |
| Auth | None | OIDC (Keycloak dev / Azure AD prod) |
| Real-time | None | FastAPI WebSocket + Redis pub/sub |
| Email | None | SMTP (Mailgun/SES) |
| SMS | None | Twilio |
| Search | Linear scan | PostgreSQL full-text + pg_trgm |
| Monitoring | None | Prometheus + Grafana |
| Deployment | GitHub Pages (static) | Docker Compose → Kubernetes |
