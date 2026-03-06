import json
import logging
import re

from anthropic import AsyncAnthropic

from sentinel.config import settings
from sentinel.models.event import HealthEvent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior epidemiologist advising the Swiss Federal Office of Public Health "
    "(BAG) and the Federal Food Safety and Veterinary Office (BLV). Analyze disease "
    "events for their risk to Switzerland under the One Health framework "
    "(human, animal, environment).\n\n"
    "Respond in JSON format with these fields:\n"
    "- risk_assessment: 2-3 sentence risk analysis\n"
    "- swiss_relevance_narrative: Why this matters specifically for Switzerland "
    "(trade, travel, vectors, border proximity, migratory routes)\n"
    "- one_health_analysis: Cross-domain implications (human<>animal<>environment)\n"
    "- recommended_actions: List of 2-4 specific monitoring/preparedness actions "
    "for Swiss authorities\n"
    "- adjusted_risk_score: Float 0-10, your professional assessment "
    "(can differ from automated score)\n"
    "- ihr_annex2: Object with four boolean fields assessing IHR (2005) Annex 2 "
    "decision instrument criteria:\n"
    "  - unusual: Is this event unusual or unexpected?\n"
    "  - serious_impact: Is there serious public health impact?\n"
    "  - international_spread: Is there significant risk of international spread?\n"
    "  - trade_travel_risk: Is there significant risk of trade/travel restrictions?"
)


async def analyze_event(event: HealthEvent) -> HealthEvent:
    """Analyze a single event using Claude LLM."""
    if not settings.anthropic_api_key:
        logger.warning("No Anthropic API key configured, skipping LLM analysis")
        return event

    try:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        model = "claude-haiku-4-5-20251001" if event.risk_score < 6.0 else "claude-sonnet-4-6"

        prompt = f"""Analyze this public health event:

Title: {event.title}
Disease: {event.disease}
Countries: {', '.join(event.countries)}
Species: {event.species}
Source: {event.source}
Date: {event.date_reported}
Case count: {event.case_count or 'Unknown'}
Death count: {event.death_count or 'Unknown'}
Summary: {event.summary[:1000]}
Current risk score: {event.risk_score}
Current Swiss relevance: {event.swiss_relevance}
One Health tags: {', '.join(event.one_health_tags) or 'None'}
"""

        response = await client.messages.create(
            model=model,
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        # Try to parse JSON from response
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code block
            match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
            else:
                data = {"risk_assessment": text}

        analysis_parts = []
        if "risk_assessment" in data:
            analysis_parts.append(f"**Risk Assessment:** {data['risk_assessment']}")
        if "swiss_relevance_narrative" in data:
            analysis_parts.append(
                f"**Swiss Relevance:** {data['swiss_relevance_narrative']}"
            )
        if "one_health_analysis" in data:
            analysis_parts.append(f"**One Health:** {data['one_health_analysis']}")
        if "recommended_actions" in data:
            actions = data["recommended_actions"]
            if isinstance(actions, list):
                actions_text = "\n".join(f"- {a}" for a in actions)
                analysis_parts.append(f"**Recommended Actions:**\n{actions_text}")

        event.analysis = "\n\n".join(analysis_parts)

        if "adjusted_risk_score" in data:
            try:
                adjusted = float(data["adjusted_risk_score"])
                event.risk_score = max(min(adjusted, 10.0), 0.0)
            except (ValueError, TypeError):
                pass

        # IHR Annex 2 overrides from LLM
        if "ihr_annex2" in data and isinstance(data["ihr_annex2"], dict):
            a2 = data["ihr_annex2"]
            if "unusual" in a2:
                event.ihr_unusual = bool(a2["unusual"])
            if "serious_impact" in a2:
                event.ihr_serious_impact = bool(a2["serious_impact"])
            if "international_spread" in a2:
                event.ihr_international_spread = bool(a2["international_spread"])
            if "trade_travel_risk" in a2:
                event.ihr_trade_travel_risk = bool(a2["trade_travel_risk"])

    except Exception:
        logger.exception("LLM analysis failed for event %s", event.id)

    return event


async def analyze_events(
    events: list[HealthEvent], threshold: float = 4.0
) -> list[HealthEvent]:
    """Analyze events with risk score >= threshold using Claude."""
    results = []
    for event in events:
        if event.risk_score >= threshold:
            event = await analyze_event(event)
        results.append(event)
    return results
