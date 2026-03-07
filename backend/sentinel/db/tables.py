"""SQLAlchemy Core table definitions for SENTINEL."""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    func,
)

metadata = MetaData()

events = Table(
    "events",
    metadata,
    Column("id", String(64), nullable=False),
    Column("date_collected", Date, nullable=False),
    Column("source", String(20), nullable=False),
    Column("title", Text, nullable=False),
    Column("date_reported", Date, nullable=False),
    Column("disease", String(255), nullable=False),
    Column("pathogen", String(255)),
    Column("countries", JSON, nullable=False),  # list[str]
    Column("regions", JSON, nullable=False),  # list[str]
    Column("species", String(20), nullable=False),
    Column("case_count", Integer),
    Column("death_count", Integer),
    Column("summary", Text, nullable=False, server_default=""),
    Column("url", Text, nullable=False, server_default=""),
    Column("raw_content", Text, nullable=False, server_default=""),
    # Scoring
    Column("risk_score", Float, nullable=False, server_default="0"),
    Column("swiss_relevance", Float, nullable=False, server_default="0"),
    Column("one_health_tags", JSON, nullable=False, server_default="[]"),
    Column("analysis", Text, nullable=False, server_default=""),
    # Verification & IHR
    Column("verification_status", String(20), nullable=False, server_default="UNVERIFIED"),
    Column("ihr_unusual", Boolean),
    Column("ihr_serious_impact", Boolean),
    Column("ihr_international_spread", Boolean),
    Column("ihr_trade_travel_risk", Boolean),
    # Executive ops
    Column("confidence_score", Float, nullable=False, server_default="0.5"),
    Column("probability_score", Float, nullable=False, server_default="0"),
    Column("impact_score", Float, nullable=False, server_default="0"),
    Column("operational_priority", String(20), nullable=False, server_default="ROUTINE"),
    Column("ims_activation", String(30), nullable=False, server_default="MONITORING"),
    Column("lead_agency", String(10), nullable=False, server_default="JOINT"),
    Column("decision_window_hours", Integer, nullable=False, server_default="168"),
    Column("trigger_flags", JSON, nullable=False, server_default="[]"),
    Column("recommended_actions", JSON, nullable=False, server_default="[]"),
    # Provenance
    Column("merged_from", JSON, nullable=False, server_default="[]"),
    Column("source_evidence", JSON, nullable=False, server_default="[]"),
    Column("provenance_hash", String(40), nullable=False, server_default=""),
    Column("analyst_overrides", JSON, nullable=False, server_default="[]"),
    # Playbook
    Column("hazard_class", String(30), nullable=False, server_default="GENERAL"),
    Column("playbook", String(30), nullable=False, server_default="GENERAL_MONITORING"),
    Column("playbook_sla_hours", Integer, nullable=False, server_default="168"),
    Column("sla_timer_hours", Integer, nullable=False, server_default="168"),
    Column("escalation_level", String(30), nullable=False, server_default="ROUTINE_SURVEILLANCE"),
    Column("escalation_workflow", JSON, nullable=False, server_default="[]"),
    # Composite PK: same event can appear on multiple collection dates;
    # we keep only the latest via query, but store all for audit.
    Index("ix_events_pk", "id", "date_collected", unique=True),
    Index("ix_events_date_reported", "date_reported"),
    Index("ix_events_disease", "disease"),
    Index("ix_events_risk_score", "risk_score"),
    Index("ix_events_swiss_relevance", "swiss_relevance"),
    Index("ix_events_source", "source"),
)

annotations = Table(
    "annotations",
    metadata,
    Column("id", String(24), primary_key=True),
    Column("event_id", String(64), nullable=False),
    Column("author", String(255), nullable=False),
    Column("timestamp", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("type", String(20), nullable=False),
    Column("content", Text, nullable=False, server_default=""),
    Column("visibility", String(20), nullable=False, server_default="INTERNAL"),
    Column("risk_override", Float),
    Column("status_change", String(20)),
    Column("verification_override", String(20)),
    Column("operational_priority_override", String(20)),
    Column("playbook_override", String(30)),
    Column("playbook_sla_override_hours", Integer),
    Column("escalation_level_override", String(30)),
    Column("override_reason", Text, nullable=False, server_default=""),
    Column("linked_event_ids", JSON, nullable=False, server_default="[]"),
    Column("tags", JSON, nullable=False, server_default="[]"),
    Index("ix_annotations_event_id", "event_id"),
)

situations = Table(
    "situations",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("title", String(500), nullable=False),
    Column("status", String(20), nullable=False, server_default="ACTIVE"),
    Column("priority", String(10), nullable=False, server_default="P2"),
    Column("created", Date, nullable=False),
    Column("updated", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("events", JSON, nullable=False, server_default="[]"),
    Column("diseases", JSON, nullable=False, server_default="[]"),
    Column("countries", JSON, nullable=False, server_default="[]"),
    Column("lead_analyst", String(255), nullable=False, server_default=""),
    Column("summary", Text, nullable=False, server_default=""),
    Column("annotations", JSON, nullable=False, server_default="[]"),
    Column("swiss_impact_assessment", Text),
    Column("recommended_actions", JSON),
    Column("human_health_status", String(255)),
    Column("animal_health_status", String(255)),
    Column("environmental_status", String(255)),
    Index("ix_situations_status", "status"),
)

watchlists = Table(
    "watchlists",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("name", String(255), nullable=False),
    Column("diseases", JSON, nullable=False, server_default="[]"),
    Column("countries", JSON, nullable=False, server_default="[]"),
    Column("min_risk_score", Float, nullable=False, server_default="0"),
    Column("one_health_tags", JSON, nullable=False, server_default="[]"),
)

collector_runs = Table(
    "collector_runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("source", String(20), nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("finished_at", DateTime(timezone=True)),
    Column("event_count", Integer, nullable=False, server_default="0"),
    Column("ok", Boolean, nullable=False, server_default="true"),
    Column("error", Text),
    Column("latency_seconds", Float),
    Index("ix_collector_runs_source_started", "source", "started_at"),
)

audit_log = Table(
    "audit_log",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("action", String(100), nullable=False),
    Column("entity_type", String(50), nullable=False),
    Column("entity_id", String(255), nullable=False),
    Column("old_value", JSON),
    Column("new_value", JSON),
    Column("timestamp", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Index("ix_audit_log_timestamp", "timestamp"),
    Index("ix_audit_log_entity", "entity_type", "entity_id"),
)

reports = Table(
    "reports",
    metadata,
    Column("day", Date, primary_key=True),
    Column("content", Text, nullable=False),
)
