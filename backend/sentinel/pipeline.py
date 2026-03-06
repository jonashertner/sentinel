import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date

from sentinel.analysis.deduplicator import deduplicate
from sentinel.analysis.llm_analyzer import analyze_events
from sentinel.analysis.normalizer import normalize_event
from sentinel.analysis.rule_engine import score_event
from sentinel.analysis.swiss_relevance import compute_swiss_relevance
from sentinel.collectors.ecdc import ECDCCollector
from sentinel.collectors.promed import ProMEDCollector
from sentinel.collectors.who_don import WHODONCollector
from sentinel.collectors.who_eios import WHOEIOSCollector
from sentinel.collectors.woah import WOAHCollector
from sentinel.config import settings
from sentinel.reports.daily_brief import generate_daily_brief
from sentinel.store import DataStore

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    date: date
    events_collected: int = 0
    events_after_dedup: int = 0
    events_analyzed: int = 0
    by_source: dict[str, int] = field(default_factory=dict)
    by_risk: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


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
        collectors.append(WHOEIOSCollector())

    all_events = []
    for collector in collectors:
        try:
            events = await collector.collect()
            all_events.extend(events)
            result.by_source[collector.source_name] = len(events)
            logger.info("Collected %d events from %s", len(events), collector.source_name)
        except Exception as e:
            error_msg = f"Collector {collector.source_name} failed: {e}"
            logger.error(error_msg)
            result.errors.append(error_msg)

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

    # 6. LLM analysis (events >= 4.0)
    all_events = await analyze_events(all_events, threshold=4.0)
    result.events_analyzed = sum(1 for e in all_events if e.analysis)

    # 7. Count by risk category
    for e in all_events:
        cat = e.risk_category.value
        result.by_risk[cat] = result.by_risk.get(cat, 0) + 1

    # 8. Save events
    store.save_events(today, all_events)

    # 9. Generate and save daily report
    report = generate_daily_brief(today, all_events)
    store.save_report(today, report)

    # 10. Update manifest for frontend
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
