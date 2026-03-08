import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date, timedelta

from sentinel.alerts.dispatch import dispatch_matches
from sentinel.alerts.engine import evaluate_alerts, load_matches, load_rules, save_matches
from sentinel.analysis.deduplicator import deduplicate
from sentinel.analysis.executive_ops import assess_events
from sentinel.analysis.llm_analyzer import analyze_events
from sentinel.analysis.normalizer import normalize_event
from sentinel.analysis.playbooks import apply_playbooks
from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.collectors.bag_bulletin import BAGBulletinCollector
from sentinel.collectors.beacon import BeaconCollector
from sentinel.collectors.base import CollectorSkipped
from sentinel.collectors.cidrap import CIDRAPCollector
from sentinel.collectors.ecdc import ECDCCollector
from sentinel.collectors.nnsid import NNSIDCollector
from sentinel.collectors.promed import ProMEDCollector
from sentinel.collectors.rasff import RASFFCollector
from sentinel.collectors.sentinella import SentinellaCollector
from sentinel.collectors.wastewater import WastewaterCollector
from sentinel.collectors.who_don import WHODONCollector
from sentinel.collectors.who_eios import WHOEIOSCollector
from sentinel.collectors.woah import WOAHCollector
from sentinel.config import settings
from sentinel.ingestion import compute_ingestion_delta
from sentinel.models.event import HealthEvent
from sentinel.projection import deduplicate_by_latest, load_projected_events
from sentinel.reports.daily_brief import generate_daily_brief
from sentinel.store import DataStore

logger = logging.getLogger(__name__)


@dataclass
class CollectorStatus:
    source: str
    ok: bool
    event_count: int
    latency_seconds: float
    error: str | None = None


@dataclass
class PipelineResult:
    date: date
    events_collected: int = 0
    events_after_dedup: int = 0
    events_analyzed: int = 0
    by_source: dict[str, int] = field(default_factory=dict)
    by_risk: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    collector_statuses: list[CollectorStatus] = field(default_factory=list)


def _apply_recency_gate(
    events: list[HealthEvent],
    *,
    reference_day: date,
    max_age_days: int,
) -> tuple[list[HealthEvent], int]:
    """Drop events outside the accepted reporting window."""
    if max_age_days <= 0:
        return events, 0
    cutoff = reference_day - timedelta(days=max_age_days)
    kept = []
    dropped = 0
    for event in events:
        if event.date_reported < cutoff or event.date_reported > reference_day:
            dropped += 1
            continue
        kept.append(event)
    return kept, dropped


async def run_pipeline(data_dir: str | None = None) -> PipelineResult:
    """Run the full SENTINEL pipeline: collect, normalize, deduplicate, score, analyze, report."""
    today = date.today()
    store = DataStore(data_dir=data_dir or settings.data_dir)
    result = PipelineResult(date=today)

    def record_skipped(source: str, message: str) -> None:
        result.by_source[source] = 0
        result.collector_statuses.append(
            CollectorStatus(
                source=source,
                ok=False,
                event_count=0,
                latency_seconds=0.0,
                error=message,
            )
        )
        logger.warning(message)

    # 1. Collect from all enabled sources
    collectors = []
    if settings.enable_who_don:
        collectors.append(WHODONCollector())
    if settings.enable_promed:
        collectors.append(ProMEDCollector())
    if settings.enable_ecdc:
        collectors.append(ECDCCollector())
    if settings.enable_woah:
        collectors.append(WOAHCollector())
    if settings.enable_who_eios:
        who_eios_api_key = settings.who_eios_api_key.strip()
        if who_eios_api_key:
            collectors.append(WHOEIOSCollector(api_key=who_eios_api_key))
        else:
            skip_msg = (
                "Collector WHO_EIOS skipped: SENTINEL_WHO_EIOS_API_KEY is not configured"
            )
            record_skipped("WHO_EIOS", skip_msg)
    if settings.enable_beacon:
        collectors.append(BeaconCollector())
    if settings.enable_cidrap:
        collectors.append(CIDRAPCollector())
    if settings.enable_nnsid:
        collectors.append(NNSIDCollector())
    if settings.enable_sentinella:
        collectors.append(SentinellaCollector())
    if settings.enable_bag_bulletin:
        collectors.append(BAGBulletinCollector())
    if settings.enable_rasff:
        collectors.append(RASFFCollector())
    if settings.enable_wastewater:
        collectors.append(WastewaterCollector())

    all_events = []
    for collector in collectors:
        t0 = time.monotonic()
        try:
            events = await collector.collect()
            latency = time.monotonic() - t0
            all_events.extend(events)
            result.by_source[collector.source_name] = len(events)
            result.collector_statuses.append(
                CollectorStatus(
                    source=collector.source_name,
                    ok=True,
                    event_count=len(events),
                    latency_seconds=round(latency, 2),
                )
            )
            logger.info(
                "Collected %d events from %s in %.1fs",
                len(events), collector.source_name, latency,
            )
        except CollectorSkipped as e:
            record_skipped(collector.source_name, str(e))
        except Exception as e:
            latency = time.monotonic() - t0
            error_msg = f"Collector {collector.source_name} failed: {e}"
            logger.error(error_msg)
            result.errors.append(error_msg)
            result.collector_statuses.append(
                CollectorStatus(
                    source=collector.source_name,
                    ok=False,
                    event_count=0,
                    latency_seconds=round(latency, 2),
                    error=str(e),
                )
            )

    result.events_collected = len(all_events)

    # 2. Normalize
    all_events = [normalize_event(e) for e in all_events]

    # 3. Recency gate
    all_events, dropped_count = _apply_recency_gate(
        all_events,
        reference_day=today,
        max_age_days=settings.max_event_age_days,
    )
    if dropped_count:
        logger.warning(
            "Dropped %d events outside %d-day reporting window",
            dropped_count,
            settings.max_event_age_days,
        )

    # 4. Deduplicate
    all_events = deduplicate(all_events)
    result.events_after_dedup = len(all_events)

    # 5. Rule-engine scoring
    all_events = [score_event(e) for e in all_events]

    # 6. Swiss relevance
    all_events = [compute_swiss_relevance(e) for e in all_events]

    # 7. Executive operations scoring (confidence, urgency, lead authority)
    all_events = assess_events(all_events)

    # 8. Decision playbooks (hazard class, SLA timer, escalation workflow)
    all_events = apply_playbooks(all_events)

    # 9. LLM analysis (events >= 4.0)
    all_events = await analyze_events(all_events, threshold=4.0)
    result.events_analyzed = sum(1 for e in all_events if e.analysis)

    # 10. Count by risk category
    for e in all_events:
        cat = e.risk_category.value
        result.by_risk[cat] = result.by_risk.get(cat, 0) + 1

    # 11. Save events
    store.save_events(today, all_events)
    store.save_collector_statuses(
        today,
        [
            {
                "source": s.source,
                "ok": s.ok,
                "event_count": s.event_count,
                "latency_seconds": s.latency_seconds,
                "error": s.error,
            }
            for s in result.collector_statuses
        ],
    )
    ingestion_delta = compute_ingestion_delta(store, today)
    store.save_ingestion_delta(today, ingestion_delta)

    # 12. Evaluate alert rules
    try:
        rules = load_rules()
        if rules:
            recent = load_matches()
            matches = evaluate_alerts(all_events, rules, recent)
            if matches:
                save_matches(recent + matches)
                await dispatch_matches(matches)
                logger.info("Alert engine: %d matches dispatched", len(matches))
    except Exception as e:
        logger.error("Alert evaluation failed: %s", e)

    # 13. Generate and save daily report
    report = generate_daily_brief(today, all_events)
    store.save_report(today, report)

    # 14. Update manifest for frontend
    projected_events = deduplicate_by_latest(load_projected_events(store))
    store.write_manifest(
        projected_events=projected_events,
        collector_statuses=[
            {
                "source": s.source,
                "ok": s.ok,
                "event_count": s.event_count,
                "latency_seconds": s.latency_seconds,
                "error": s.error,
            }
            for s in result.collector_statuses
        ],
        ingestion_delta=ingestion_delta,
    )

    logger.info(
        "Pipeline complete: %d collected, %d after dedup, %d analyzed",
        result.events_collected,
        result.events_after_dedup,
        result.events_analyzed,
    )
    return result


if __name__ == "__main__":
    logging.basicConfig(level=settings.log_level)
    result = asyncio.run(run_pipeline())
    print(f"Pipeline complete: {result}")
