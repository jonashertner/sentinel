"""Alert evaluation engine — matches events against active rules."""

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sentinel.alerts.models import AlertCondition, AlertMatch, AlertOperator, AlertRule
from sentinel.config import settings
from sentinel.models.event import HealthEvent

logger = logging.getLogger(__name__)


def matches_condition(event: HealthEvent, cond: AlertCondition) -> bool:
    """Check if a single condition matches an event."""
    raw = event.model_dump(mode="json")
    val = raw.get(cond.field)
    if val is None:
        return False

    match cond.operator:
        case AlertOperator.GTE:
            return float(val) >= float(cond.value)
        case AlertOperator.LTE:
            return float(val) <= float(cond.value)
        case AlertOperator.EQ:
            return str(val) == str(cond.value)
        case AlertOperator.NEQ:
            return str(val) != str(cond.value)
        case AlertOperator.IN:
            targets = cond.value if isinstance(cond.value, list) else [cond.value]
            return str(val) in [str(t) for t in targets]
        case AlertOperator.CONTAINS:
            if isinstance(val, list):
                return str(cond.value) in [str(v) for v in val]
            return str(cond.value) in str(val)
    return False


def matches_rule(event: HealthEvent, rule: AlertRule) -> bool:
    """Check if all conditions in a rule match (AND logic)."""
    return all(matches_condition(event, c) for c in rule.conditions)


def evaluate_alerts(
    events: list[HealthEvent],
    rules: list[AlertRule],
    recent_matches: list[AlertMatch] | None = None,
) -> list[AlertMatch]:
    """Evaluate events against active rules, respecting cooldowns."""
    recent = recent_matches or []
    matches = []

    for event in events:
        for rule in rules:
            if not rule.active:
                continue
            if not matches_rule(event, rule):
                continue
            if _in_cooldown(rule, event.id, recent):
                continue

            match = AlertMatch(
                rule_id=rule.id,
                rule_name=rule.name,
                event_id=event.id,
                event_title=event.title,
                channels=rule.channels,
            )
            matches.append(match)
            recent.append(match)

    return matches


def _in_cooldown(
    rule: AlertRule, event_id: str, recent: list[AlertMatch]
) -> bool:
    """Check if this rule+event combo was recently matched."""
    cutoff = datetime.now(UTC) - timedelta(minutes=rule.cooldown_minutes)
    return any(
        m.rule_id == rule.id and m.event_id == event_id and m.matched_at > cutoff
        for m in recent
    )


# -- File-based persistence for rules and matches --


def _rules_path() -> Path:
    p = Path(settings.data_dir) / "alert_rules.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _matches_path() -> Path:
    p = Path(settings.data_dir) / "alert_matches.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def load_rules() -> list[AlertRule]:
    path = _rules_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return [AlertRule.model_validate(r) for r in data]


def save_rules(rules: list[AlertRule]) -> None:
    path = _rules_path()
    path.write_text(json.dumps([r.model_dump(mode="json") for r in rules], indent=2))


def load_matches() -> list[AlertMatch]:
    path = _matches_path()
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return [AlertMatch.model_validate(m) for m in data]


def save_matches(matches: list[AlertMatch]) -> None:
    path = _matches_path()
    path.write_text(json.dumps([m.model_dump(mode="json") for m in matches], indent=2))
