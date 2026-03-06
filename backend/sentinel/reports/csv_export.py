import csv
import io

from sentinel.models.event import HealthEvent

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
            e.id,
            e.title,
            e.source,
            e.date_reported.isoformat(),
            e.date_collected.isoformat(),
            e.disease,
            e.pathogen or "",
            ";".join(e.countries),
            ";".join(e.regions),
            e.species,
            e.case_count if e.case_count is not None else "",
            e.death_count if e.death_count is not None else "",
            e.risk_score,
            e.risk_category,
            e.swiss_relevance,
            ";".join(e.one_health_tags),
            e.url,
            e.summary,
        ])

    return output.getvalue()
