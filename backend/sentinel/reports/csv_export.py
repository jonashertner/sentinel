import csv
import io

from sentinel.models.event import HealthEvent

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_cell(value: str) -> str:
    """Prevent spreadsheet formula injection by prefixing dangerous cells."""
    if isinstance(value, str) and value and value[0] in _FORMULA_PREFIXES:
        return f"'{value}"
    return value

CSV_COLUMNS = [
    "id",
    "title",
    "source",
    "date_reported",
    "date_collected",
    "disease",
    "pathogen",
    "countries",
    "regions",
    "species",
    "case_count",
    "death_count",
    "risk_score",
    "risk_category",
    "swiss_relevance",
    "confidence_score",
    "probability_score",
    "impact_score",
    "operational_priority",
    "ims_activation",
    "lead_agency",
    "decision_window_hours",
    "trigger_flags",
    "recommended_actions",
    "hazard_class",
    "playbook",
    "playbook_sla_hours",
    "sla_timer_hours",
    "escalation_level",
    "escalation_workflow",
    "merged_from",
    "source_evidence_count",
    "provenance_hash",
    "analyst_overrides_count",
    "one_health_tags",
    "url",
    "summary",
]


def events_to_csv(events: list[HealthEvent]) -> str:
    """Generate a CSV string from a list of HealthEvent objects."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for e in events:
        writer.writerow([
            _sanitize_cell(e.id),
            _sanitize_cell(e.title),
            e.source,
            e.date_reported.isoformat(),
            e.date_collected.isoformat(),
            _sanitize_cell(e.disease),
            _sanitize_cell(e.pathogen or ""),
            ";".join(e.countries),
            ";".join(e.regions),
            e.species,
            e.case_count if e.case_count is not None else "",
            e.death_count if e.death_count is not None else "",
            e.risk_score,
            e.risk_category,
            e.swiss_relevance,
            e.confidence_score,
            e.probability_score,
            e.impact_score,
            e.operational_priority,
            e.ims_activation,
            e.lead_agency,
            e.decision_window_hours,
            ";".join(e.trigger_flags),
            ";".join(_sanitize_cell(a) for a in e.recommended_actions),
            e.hazard_class,
            e.playbook,
            e.playbook_sla_hours,
            e.sla_timer_hours,
            e.escalation_level,
            ";".join(_sanitize_cell(step) for step in e.escalation_workflow),
            ";".join(e.merged_from),
            len(e.source_evidence),
            e.provenance_hash,
            len(e.analyst_overrides),
            ";".join(e.one_health_tags),
            _sanitize_cell(e.url),
            _sanitize_cell(e.summary),
        ])

    return output.getvalue()
