import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from sentinel.analysis.llm_analyzer import analyze_event, analyze_events
from sentinel.models.event import HealthEvent, Source, Species


def _make_event(risk_score: float = 5.0) -> HealthEvent:
    return HealthEvent(
        source=Source.WHO_DON,
        title="Ebola outbreak",
        date_reported=date(2026, 3, 1),
        date_collected=date(2026, 3, 6),
        disease="Ebola",
        countries=["CD"],
        regions=["AFRO"],
        species=Species.HUMAN,
        summary="An Ebola outbreak was reported.",
        url="https://example.com",
        raw_content="Full text",
        risk_score=risk_score,
        swiss_relevance=2.0,
        one_health_tags=["zoonotic"],
    )


def _mock_response(data: dict) -> MagicMock:
    content_block = MagicMock()
    content_block.text = json.dumps(data)
    response = MagicMock()
    response.content = [content_block]
    return response


class TestAnalyzeEvent:
    @pytest.mark.asyncio
    async def test_event_gets_analyzed(self):
        event = _make_event()
        response_data = {
            "risk_assessment": "High risk due to Ebola.",
            "swiss_relevance_narrative": "Trade routes affected.",
            "one_health_analysis": "Zoonotic spillover risk.",
            "recommended_actions": ["Monitor borders", "Alert hospitals"],
            "adjusted_risk_score": 7.5,
        }

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response(response_data))

        with (
            patch("sentinel.analysis.llm_analyzer.settings") as mock_settings,
            patch("sentinel.analysis.llm_analyzer.AsyncAnthropic", return_value=mock_client),
        ):
            mock_settings.anthropic_api_key = "test-key"
            result = await analyze_event(event)

        assert "Risk Assessment" in result.analysis
        assert "Trade routes" in result.analysis
        assert result.risk_score == 7.5

    @pytest.mark.asyncio
    async def test_no_api_key_skips_analysis(self):
        event = _make_event()
        with patch("sentinel.analysis.llm_analyzer.settings") as mock_settings:
            mock_settings.anthropic_api_key = ""
            result = await analyze_event(event)
        assert result.analysis == ""

    @pytest.mark.asyncio
    async def test_api_error_returns_event_unchanged(self):
        event = _make_event()
        original_score = event.risk_score

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("API Error"))

        with (
            patch("sentinel.analysis.llm_analyzer.settings") as mock_settings,
            patch("sentinel.analysis.llm_analyzer.AsyncAnthropic", return_value=mock_client),
        ):
            mock_settings.anthropic_api_key = "test-key"
            result = await analyze_event(event)

        assert result.risk_score == original_score
        assert result.analysis == ""


class TestAnalyzeEvents:
    @pytest.mark.asyncio
    async def test_below_threshold_passes_through(self):
        event = _make_event(risk_score=2.0)
        with patch("sentinel.analysis.llm_analyzer.settings") as mock_settings:
            mock_settings.anthropic_api_key = ""
            results = await analyze_events([event], threshold=4.0)
        assert len(results) == 1
        assert results[0].analysis == ""

    @pytest.mark.asyncio
    async def test_above_threshold_gets_analyzed(self):
        event = _make_event(risk_score=5.0)
        response_data = {
            "risk_assessment": "Moderate risk.",
            "adjusted_risk_score": 6.0,
        }
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=_mock_response(response_data))

        with (
            patch("sentinel.analysis.llm_analyzer.settings") as mock_settings,
            patch("sentinel.analysis.llm_analyzer.AsyncAnthropic", return_value=mock_client),
        ):
            mock_settings.anthropic_api_key = "test-key"
            results = await analyze_events([event], threshold=4.0)

        assert len(results) == 1
        assert results[0].analysis != ""
