from sentinel.models.event import HealthEvent

SOURCE_PRIORITY = {"ECDC": 5, "WHO_DON": 4, "WOAH": 3, "PROMED": 2, "WHO_EIOS": 1}


def _event_key(event: HealthEvent) -> str:
    """Group key: normalized disease + sorted countries."""
    return f"{event.disease.lower()}|{'|'.join(sorted(event.countries))}"


def deduplicate(events: list[HealthEvent]) -> list[HealthEvent]:
    """Merge events describing the same outbreak from different sources."""
    groups: list[tuple[str, list[HealthEvent]]] = []
    for event in events:
        key = _event_key(event)
        matched = False
        for group_key, group in groups:
            if key == group_key:
                # Check date proximity (within 3 days)
                for g in group:
                    diff = abs((event.date_reported - g.date_reported).days)
                    if diff <= 3:
                        group.append(event)
                        matched = True
                        break
            if matched:
                break
        if not matched:
            groups.append((key, [event]))

    result = []
    for _key, group in groups:
        if len(group) == 1:
            result.append(group[0])
        else:
            result.append(_merge_group(group))
    return result


def _merge_group(events: list[HealthEvent]) -> HealthEvent:
    """Merge a group of duplicate events, keeping the best data from each."""
    # Sort by source priority (highest first)
    events.sort(key=lambda e: SOURCE_PRIORITY.get(e.source, 0), reverse=True)
    primary = events[0].model_copy()
    # Take the longest summary
    primary.summary = max((e.summary for e in events), key=len)
    primary.raw_content = max((e.raw_content for e in events), key=len)
    # Union countries
    all_countries: set[str] = set()
    for e in events:
        all_countries.update(e.countries)
    primary.countries = sorted(all_countries)
    # Take highest risk score
    primary.risk_score = max(e.risk_score for e in events)
    # Take highest case/death counts
    case_counts = [e.case_count for e in events if e.case_count is not None]
    primary.case_count = max(case_counts) if case_counts else None
    death_counts = [e.death_count for e in events if e.death_count is not None]
    primary.death_count = max(death_counts) if death_counts else None
    return primary
