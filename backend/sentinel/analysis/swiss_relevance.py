from sentinel.models.event import HealthEvent

SWISS_NEIGHBORS = {"DE", "FR", "IT", "AT", "LI"}
SWISS_TRADE_PARTNERS = {"DE", "FR", "IT", "AT", "NL", "BE", "ES", "US", "CN", "BR", "GB"}
EURO_COUNTRIES = {
    "DE", "FR", "IT", "AT", "LI", "NL", "BE", "ES", "PT", "GB", "IE",
    "DK", "SE", "NO", "FI", "PL", "CZ", "SK", "HU", "RO", "HR", "SI",
    "GR", "RS", "AL", "UA", "RU",
}
# Diseases with established or emerging vectors in Switzerland
CH_VECTOR_DISEASES = {"West Nile fever", "Dengue", "Chikungunya", "Zika", "Bluetongue"}


def compute_swiss_relevance(event: HealthEvent) -> HealthEvent:
    """Compute Swiss relevance score for an event."""
    score = 0.0

    if "CH" in event.countries:
        score = 10.0
    elif any(c in SWISS_NEIGHBORS for c in event.countries):
        score += 5.0
    elif any(c in EURO_COUNTRIES for c in event.countries):
        score += 2.5
    elif any(c in SWISS_TRADE_PARTNERS for c in event.countries):
        score += 2.0

    if event.disease in CH_VECTOR_DISEASES:
        score += 2.0

    # Zoonotic diseases: relevant for BLV
    if "zoonotic" in event.one_health_tags:
        score += 1.5

    # Foodborne: relevant for BLV food safety mandate
    if "foodborne" in event.one_health_tags:
        score += 1.5

    # High case counts increase relevance
    if event.case_count and event.case_count > 1000:
        score += 1.0

    event.swiss_relevance = min(score, 10.0)
    return event
