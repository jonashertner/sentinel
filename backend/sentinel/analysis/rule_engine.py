from sentinel.models.event import HealthEvent, Source, Species, VerificationStatus

SWISS_NEIGHBORS = {"DE", "FR", "IT", "AT", "LI"}
SWISS_TRADE_PARTNERS = {"DE", "FR", "IT", "AT", "NL", "BE", "ES", "US", "CN", "BR", "GB", "PL"}
HIGH_CONCERN_DISEASES = {
    "Avian influenza", "Avian influenza A(H5N1)", "Avian influenza A(H5N6)",
    "Avian influenza A(H7N9)", "Mpox", "Ebola", "MERS", "Plague", "Dengue",
    "Marburg", "Nipah", "Lassa fever", "CCHF", "Rift Valley fever",
    "COVID-19", "Cholera", "Poliomyelitis", "Yellow fever",
}
ZOONOTIC_DISEASES = {
    "Avian influenza", "Avian influenza A(H5N1)", "Avian influenza A(H5N6)",
    "Avian influenza A(H7N9)", "Mpox", "Ebola", "MERS", "Nipah", "Hendra",
    "Rabies", "Brucellosis", "Q fever", "Lassa fever", "CCHF",
    "Rift Valley fever", "West Nile fever", "Marburg",
    "Campylobacteriosis", "Salmonellosis", "Listeriosis", "E. coli infection",
}
VECTOR_BORNE = {"Dengue", "Zika", "Chikungunya", "West Nile fever", "Yellow fever", "Malaria"}
FOODBORNE = {"Campylobacteriosis", "Salmonellosis", "Listeriosis", "E. coli infection"}
AMR_RELATED = {"Tuberculosis", "Campylobacteriosis", "Salmonellosis"}


def score_event(event: HealthEvent) -> HealthEvent:
    """Score an event using rule-based risk assessment."""
    score = 0.0
    tags: set[str] = set()

    # Geographic proximity (0-3)
    if any(c in SWISS_NEIGHBORS for c in event.countries):
        score += 3.0
    elif any(c in SWISS_TRADE_PARTNERS for c in event.countries):
        score += 1.5
    if "CH" in event.countries:
        score += 4.0

    # Disease severity (0-2.5)
    if event.disease in HIGH_CONCERN_DISEASES:
        score += 2.5

    # Zoonotic / One Health (0-1)
    if event.species == Species.BOTH or event.disease in ZOONOTIC_DISEASES:
        score += 1.0
        tags.add("zoonotic")

    # Tags
    if event.disease in VECTOR_BORNE:
        tags.add("vector-borne")
    if event.disease in FOODBORNE:
        tags.add("foodborne")
    if event.disease in AMR_RELATED:
        tags.add("AMR")

    # Case severity (0-2)
    if event.death_count and event.death_count > 10:
        score += 2.0
    elif event.death_count and event.death_count > 0:
        score += 1.0
    elif event.case_count and event.case_count > 100:
        score += 1.0

    # Source authority (0-1)
    if event.source in (Source.ECDC, Source.WHO_DON):
        score += 1.0
    elif event.source in (Source.CIDRAP, Source.WOAH):
        score += 0.75

    event.risk_score = min(score, 10.0)
    event.one_health_tags = sorted(tags)

    # Verification status based on source authority
    if event.source in (Source.WHO_DON, Source.ECDC, Source.WOAH):
        event.verification_status = VerificationStatus.CONFIRMED
    elif event.source in (Source.WHO_EIOS, Source.CIDRAP):
        event.verification_status = VerificationStatus.PENDING
    elif event.source in (Source.PROMED, Source.BEACON):
        event.verification_status = VerificationStatus.UNVERIFIED
    else:
        event.verification_status = VerificationStatus.UNVERIFIED

    # IHR Annex 2 decision instrument criteria
    event.ihr_unusual = event.disease in HIGH_CONCERN_DISEASES or (
        event.case_count is not None and event.case_count > 50
    )
    event.ihr_serious_impact = (
        (event.death_count is not None and event.death_count > 0)
        or event.disease in HIGH_CONCERN_DISEASES
    )
    event.ihr_international_spread = any(
        c in SWISS_NEIGHBORS | SWISS_TRADE_PARTNERS for c in event.countries
    ) or len(event.countries) > 1
    event.ihr_trade_travel_risk = any(
        c in SWISS_TRADE_PARTNERS for c in event.countries
    )

    return event
