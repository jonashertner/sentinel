import tempfile
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from sentinel.models.event import HealthEvent, Source, Species
from sentinel.pipeline import run_pipeline


def _make_event(
    disease: str = "Avian influenza",
    countries: list[str] | None = None,
    source: Source = Source.WHO_DON,
) -> HealthEvent:
    return HealthEvent(
        source=source,
        title=f"{disease} outbreak",
        date_reported=date(2026, 3, 1),
        date_collected=date(2026, 3, 6),
        disease=disease,
        countries=countries or ["DE"],
        regions=[],
        species=Species.ANIMAL,
        summary="An outbreak was reported in poultry.",
        url="https://example.com",
        raw_content="Full outbreak report text.",
    )


class TestPipeline:
    @pytest.mark.asyncio
    async def test_pipeline_runs_without_errors(self):
        events_who = [_make_event(source=Source.WHO_DON)]
        events_ecdc = [_make_event(disease="Ebola", countries=["CD"], source=Source.ECDC)]

        mock_who = AsyncMock()
        mock_who.source_name = "WHO_DON"
        mock_who.collect = AsyncMock(return_value=events_who)

        mock_ecdc = AsyncMock()
        mock_ecdc.source_name = "ECDC"
        mock_ecdc.collect = AsyncMock(return_value=events_ecdc)

        with (
            tempfile.TemporaryDirectory() as tmpdir,
            patch("sentinel.pipeline.settings") as mock_settings,
            patch("sentinel.pipeline.WHODONCollector", return_value=mock_who),
            patch("sentinel.pipeline.ProMEDCollector", return_value=AsyncMock(
                source_name="PROMED", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.ECDCCollector", return_value=mock_ecdc),
            patch("sentinel.pipeline.WOAHCollector", return_value=AsyncMock(
                source_name="WOAH", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.WHOEIOSCollector", return_value=AsyncMock(
                source_name="WHO_EIOS", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.BeaconCollector", return_value=AsyncMock(
                source_name="BEACON", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.CIDRAPCollector", return_value=AsyncMock(
                source_name="CIDRAP", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.analysis.llm_analyzer.settings") as mock_llm_settings,
        ):
            mock_settings.enable_who_don = True
            mock_settings.enable_promed = True
            mock_settings.enable_ecdc = True
            mock_settings.enable_woah = True
            mock_settings.enable_who_eios = True
            mock_settings.enable_beacon = True
            mock_settings.enable_cidrap = True
            mock_settings.data_dir = tmpdir
            mock_llm_settings.anthropic_api_key = ""

            result = await run_pipeline(data_dir=tmpdir)

        assert result.events_collected == 2
        assert result.events_after_dedup == 2  # Different diseases, not merged
        assert len(result.errors) == 0
        # Structured collector status is populated for every source
        assert len(result.collector_statuses) == 7
        assert all(s.ok for s in result.collector_statuses)

    @pytest.mark.asyncio
    async def test_pipeline_handles_collector_error(self):
        mock_who = AsyncMock()
        mock_who.source_name = "WHO_DON"
        mock_who.collect = AsyncMock(side_effect=Exception("Network error"))

        with (
            tempfile.TemporaryDirectory() as tmpdir,
            patch("sentinel.pipeline.settings") as mock_settings,
            patch("sentinel.pipeline.WHODONCollector", return_value=mock_who),
            patch("sentinel.pipeline.ProMEDCollector", return_value=AsyncMock(
                source_name="PROMED", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.ECDCCollector", return_value=AsyncMock(
                source_name="ECDC", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.WOAHCollector", return_value=AsyncMock(
                source_name="WOAH", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.WHOEIOSCollector", return_value=AsyncMock(
                source_name="WHO_EIOS", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.BeaconCollector", return_value=AsyncMock(
                source_name="BEACON", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.CIDRAPCollector", return_value=AsyncMock(
                source_name="CIDRAP", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.analysis.llm_analyzer.settings") as mock_llm_settings,
        ):
            mock_settings.enable_who_don = True
            mock_settings.enable_promed = True
            mock_settings.enable_ecdc = True
            mock_settings.enable_woah = True
            mock_settings.enable_who_eios = True
            mock_settings.enable_beacon = True
            mock_settings.enable_cidrap = True
            mock_settings.data_dir = tmpdir
            mock_llm_settings.anthropic_api_key = ""

            result = await run_pipeline(data_dir=tmpdir)

        assert len(result.errors) == 1
        assert "WHO_DON" in result.errors[0]
        # Structured status: WHO_DON failed, others ok
        failed = [s for s in result.collector_statuses if not s.ok]
        assert len(failed) == 1
        assert failed[0].source == "WHO_DON"
        assert failed[0].error == "Network error"

    @pytest.mark.asyncio
    async def test_pipeline_result_stats(self):
        events = [
            _make_event(source=Source.WHO_DON),
            _make_event(source=Source.WHO_DON, disease="Ebola", countries=["CD"]),
        ]

        mock_who = AsyncMock()
        mock_who.source_name = "WHO_DON"
        mock_who.collect = AsyncMock(return_value=events)

        with (
            tempfile.TemporaryDirectory() as tmpdir,
            patch("sentinel.pipeline.settings") as mock_settings,
            patch("sentinel.pipeline.WHODONCollector", return_value=mock_who),
            patch("sentinel.pipeline.ProMEDCollector", return_value=AsyncMock(
                source_name="PROMED", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.ECDCCollector", return_value=AsyncMock(
                source_name="ECDC", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.WOAHCollector", return_value=AsyncMock(
                source_name="WOAH", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.WHOEIOSCollector", return_value=AsyncMock(
                source_name="WHO_EIOS", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.BeaconCollector", return_value=AsyncMock(
                source_name="BEACON", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.pipeline.CIDRAPCollector", return_value=AsyncMock(
                source_name="CIDRAP", collect=AsyncMock(return_value=[])
            )),
            patch("sentinel.analysis.llm_analyzer.settings") as mock_llm_settings,
        ):
            mock_settings.enable_who_don = True
            mock_settings.enable_promed = True
            mock_settings.enable_ecdc = True
            mock_settings.enable_woah = True
            mock_settings.enable_who_eios = True
            mock_settings.enable_beacon = True
            mock_settings.enable_cidrap = True
            mock_settings.data_dir = tmpdir
            mock_llm_settings.anthropic_api_key = ""

            result = await run_pipeline(data_dir=tmpdir)

        assert result.by_source["WHO_DON"] == 2
        assert sum(result.by_risk.values()) == result.events_after_dedup
