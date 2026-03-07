import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date

from sentinel.analysis.deduplicator import deduplicate
from sentinel.analysis.executive_ops import assess_events
from sentinel.analysis.llm_analyzer import analyze_events
from sentinel.analysis.normalizer import normalize_event
from sentinel.analysis.playbooks import apply_playbooks
from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.collectors.bag_bulletin import BAGBulletinCollector
from sentinel.collectors.beacon import BeaconCollector
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


async def run_pipeline(data_dir: str | None = None) -> PipelineResult:
    """Run the full SENTINEL pipeline: collect, normalize, deduplicate, score, analyze, report."""
    today = date.today()
    store = DataStore(data_dir=data_dir or settings.data_dir)
    result = PipelineResult(date=today)

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
        collectors.append(WHOEIOSCollector(api_key=settings.who_eios_api_key or None))
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

    # 3. Deduplicate
    all_events = deduplicate(all_events)
    result.events_after_dedup = len(all_events)

    # 4. Rule-engine scoring
    all_events = [score_event(e) for e in all_events]

    # 5. Swiss relevance
    all_events = [compute_swiss_relevance(e) for e in all_events]

    # 6. Executive operations scoring (confidence, urgency, lead authority)
    all_events = assess_events(all_events)

    # 7. Decision playbooks (hazard class, SLA timer, escalation workflow)
    all_events = apply_playbooks(all_events)

    # 8. LLM analysis (events >= 4.0)
    all_events = await analyze_events(all_events, threshold=4.0)
    result.events_analyzed = sum(1 for e in all_events if e.analysis)

    # 9. Count by risk category
    for e in all_events:
        cat = e.risk_category.value
        result.by_risk[cat] = result.by_risk.get(cat, 0) + 1

    # 10. Save events
    store.save_events(today, all_events)

    # 11. Generate and save daily report
    report = generate_daily_brief(today, all_events)
    store.save_report(today, report)

    # 12. Update manifest for frontend
    store.write_manifest()

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
