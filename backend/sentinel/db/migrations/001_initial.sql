-- SENTINEL database schema v1
-- Run: psql -d sentinel -f 001_initial.sql

CREATE TABLE IF NOT EXISTS events (
    id              VARCHAR(64)     NOT NULL,
    date_collected  DATE            NOT NULL,
    source          VARCHAR(20)     NOT NULL,
    title           TEXT            NOT NULL,
    date_reported   DATE            NOT NULL,
    disease         VARCHAR(255)    NOT NULL,
    pathogen        VARCHAR(255),
    countries       JSONB           NOT NULL DEFAULT '[]',
    regions         JSONB           NOT NULL DEFAULT '[]',
    species         VARCHAR(20)     NOT NULL,
    case_count      INTEGER,
    death_count     INTEGER,
    summary         TEXT            NOT NULL DEFAULT '',
    url             TEXT            NOT NULL DEFAULT '',
    raw_content     TEXT            NOT NULL DEFAULT '',
    -- Scoring
    risk_score              REAL    NOT NULL DEFAULT 0,
    swiss_relevance         REAL    NOT NULL DEFAULT 0,
    one_health_tags         JSONB   NOT NULL DEFAULT '[]',
    analysis                TEXT    NOT NULL DEFAULT '',
    -- Verification & IHR
    verification_status     VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
    ihr_unusual             BOOLEAN,
    ihr_serious_impact      BOOLEAN,
    ihr_international_spread BOOLEAN,
    ihr_trade_travel_risk   BOOLEAN,
    -- Executive ops
    confidence_score        REAL    NOT NULL DEFAULT 0.5,
    probability_score       REAL    NOT NULL DEFAULT 0,
    impact_score            REAL    NOT NULL DEFAULT 0,
    operational_priority    VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
    ims_activation          VARCHAR(30) NOT NULL DEFAULT 'MONITORING',
    lead_agency             VARCHAR(10) NOT NULL DEFAULT 'JOINT',
    decision_window_hours   INTEGER NOT NULL DEFAULT 168,
    trigger_flags           JSONB   NOT NULL DEFAULT '[]',
    recommended_actions     JSONB   NOT NULL DEFAULT '[]',
    -- Provenance
    merged_from             JSONB   NOT NULL DEFAULT '[]',
    source_evidence         JSONB   NOT NULL DEFAULT '[]',
    provenance_hash         VARCHAR(40) NOT NULL DEFAULT '',
    analyst_overrides       JSONB   NOT NULL DEFAULT '[]',
    -- Playbook
    hazard_class            VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    playbook                VARCHAR(30) NOT NULL DEFAULT 'GENERAL_MONITORING',
    playbook_sla_hours      INTEGER NOT NULL DEFAULT 168,
    sla_timer_hours         INTEGER NOT NULL DEFAULT 168,
    escalation_level        VARCHAR(30) NOT NULL DEFAULT 'ROUTINE_SURVEILLANCE',
    escalation_workflow     JSONB   NOT NULL DEFAULT '[]',

    CONSTRAINT events_pk UNIQUE (id, date_collected)
);

CREATE INDEX IF NOT EXISTS ix_events_date_reported ON events(date_reported);
CREATE INDEX IF NOT EXISTS ix_events_disease ON events(disease);
CREATE INDEX IF NOT EXISTS ix_events_risk_score ON events(risk_score);
CREATE INDEX IF NOT EXISTS ix_events_swiss_relevance ON events(swiss_relevance);
CREATE INDEX IF NOT EXISTS ix_events_source ON events(source);

CREATE TABLE IF NOT EXISTS annotations (
    id                              VARCHAR(24)     PRIMARY KEY,
    event_id                        VARCHAR(64)     NOT NULL,
    author                          VARCHAR(255)    NOT NULL,
    "timestamp"                     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    type                            VARCHAR(20)     NOT NULL,
    content                         TEXT            NOT NULL DEFAULT '',
    visibility                      VARCHAR(20)     NOT NULL DEFAULT 'INTERNAL',
    risk_override                   REAL,
    status_change                   VARCHAR(20),
    verification_override           VARCHAR(20),
    operational_priority_override   VARCHAR(20),
    playbook_override               VARCHAR(30),
    playbook_sla_override_hours     INTEGER,
    escalation_level_override       VARCHAR(30),
    override_reason                 TEXT            NOT NULL DEFAULT '',
    linked_event_ids                JSONB           NOT NULL DEFAULT '[]',
    tags                            JSONB           NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS ix_annotations_event_id ON annotations(event_id);

CREATE TABLE IF NOT EXISTS situations (
    id                      VARCHAR(64)     PRIMARY KEY,
    title                   VARCHAR(500)    NOT NULL,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    priority                VARCHAR(10)     NOT NULL DEFAULT 'P2',
    created                 DATE            NOT NULL,
    updated                 TIMESTAMPTZ     NOT NULL DEFAULT now(),
    events                  JSONB           NOT NULL DEFAULT '[]',
    diseases                JSONB           NOT NULL DEFAULT '[]',
    countries               JSONB           NOT NULL DEFAULT '[]',
    lead_analyst            VARCHAR(255)    NOT NULL DEFAULT '',
    summary                 TEXT            NOT NULL DEFAULT '',
    annotations             JSONB           NOT NULL DEFAULT '[]',
    swiss_impact_assessment TEXT,
    recommended_actions     JSONB,
    human_health_status     VARCHAR(255),
    animal_health_status    VARCHAR(255),
    environmental_status    VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_situations_status ON situations(status);

CREATE TABLE IF NOT EXISTS watchlists (
    id              VARCHAR(64)     PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    diseases        JSONB           NOT NULL DEFAULT '[]',
    countries       JSONB           NOT NULL DEFAULT '[]',
    min_risk_score  REAL            NOT NULL DEFAULT 0,
    one_health_tags JSONB           NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS reports (
    day     DATE    PRIMARY KEY,
    content TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS collector_runs (
    id              SERIAL      PRIMARY KEY,
    source          VARCHAR(20) NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    event_count     INTEGER     NOT NULL DEFAULT 0,
    ok              BOOLEAN     NOT NULL DEFAULT true,
    error           TEXT,
    latency_seconds REAL
);

CREATE INDEX IF NOT EXISTS ix_collector_runs_source_started ON collector_runs(source, started_at);

CREATE TABLE IF NOT EXISTS audit_log (
    id          SERIAL          PRIMARY KEY,
    action      VARCHAR(100)    NOT NULL,
    entity_type VARCHAR(50)     NOT NULL,
    entity_id   VARCHAR(255)    NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    "timestamp" TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_log_timestamp ON audit_log("timestamp");
CREATE INDEX IF NOT EXISTS ix_audit_log_entity ON audit_log(entity_type, entity_id);
