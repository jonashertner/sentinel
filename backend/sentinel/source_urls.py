"""Source URL trust and canonicalization utilities."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sentinel.models.event import HealthEvent, Source

TRUSTED_SOURCE_DOMAINS: dict[Source, tuple[str, ...]] = {
    Source.WHO_DON: ("who.int",),
    Source.WHO_EIOS: ("who.int",),
    Source.ECDC: ("ecdc.europa.eu",),
    Source.WOAH: ("woah.org",),
    Source.PROMED: ("promedmail.org",),
    Source.CIDRAP: ("cidrap.umn.edu",),
    Source.BEACON: ("healthmap.org", "beacon.healthmap.org"),
}

SOURCE_LANDING_PAGES: dict[Source, str] = {
    Source.WHO_DON: "https://www.who.int/emergencies/disease-outbreak-news",
    Source.WHO_EIOS: "https://www.who.int/initiatives/eios",
    Source.ECDC: "https://www.ecdc.europa.eu/en",
    Source.WOAH: "https://www.woah.org/",
    Source.PROMED: "https://promedmail.org/",
    Source.CIDRAP: "https://www.cidrap.umn.edu/",
    Source.BEACON: "https://beacon.healthmap.org/",
}

ECDC_LEGACY_URL_OVERRIDES = {
    "h5n1-threat-assessment-march2026": "https://www.ecdc.europa.eu/en/avian-influenza",
}


def _host_allowed(host: str, allowed_domains: tuple[str, ...]) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in allowed_domains)


def _sanitize_query(query: str) -> str:
    if not query:
        return ""
    safe_pairs = [
        (k, v)
        for k, v in parse_qsl(query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
    ]
    return urlencode(safe_pairs, doseq=True)


def is_trusted_source_url(source: Source, url: str) -> bool:
    allowed = TRUSTED_SOURCE_DOMAINS.get(source)
    if not allowed:
        return True
    try:
        host = (urlsplit(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    return _host_allowed(host, allowed)


def canonicalize_source_url(source: Source, url: str) -> str:
    """Canonicalize source URLs and heal known legacy links.

    Returns an empty string when a URL has an explicit but untrusted domain.
    Returns a stable source landing page when URL parsing fails.
    """
    raw = (url or "").strip()
    if not raw:
        return SOURCE_LANDING_PAGES.get(source, "")

    if raw.startswith("//"):
        raw = f"https:{raw}"
    elif "://" not in raw and raw.startswith("www."):
        raw = f"https://{raw}"

    try:
        parts = urlsplit(raw)
    except Exception:
        return SOURCE_LANDING_PAGES.get(source, "")

    host = (parts.hostname or "").lower()
    if host:
        allowed = TRUSTED_SOURCE_DOMAINS.get(source)
        if allowed and not _host_allowed(host, allowed):
            return ""
    else:
        return SOURCE_LANDING_PAGES.get(source, "")

    path = parts.path or "/"
    query = _sanitize_query(parts.query)

    if source == Source.ECDC and host.endswith("ecdc.europa.eu"):
        seg = [p for p in path.split("/") if p]
        if seg:
            slug = seg[-1]
            override = ECDC_LEGACY_URL_OVERRIDES.get(slug)
            if override:
                return override
            if len(seg) >= 4 and seg[0] == "en" and seg[-2] == "threats":
                return f"https://www.ecdc.europa.eu/en/news-events/{slug}"

    netloc = host
    if parts.port:
        netloc = f"{host}:{parts.port}"
    return urlunsplit(("https", netloc, path, query, ""))


def canonicalize_event_urls(event: HealthEvent) -> HealthEvent:
    """Canonicalize event and provenance URLs in one pass."""
    canonical_url = canonicalize_source_url(event.source, event.url)
    evidence = []
    for item in event.source_evidence:
        evidence.append(
            item.model_copy(update={"url": canonicalize_source_url(item.source, item.url)})
        )
    return event.model_copy(update={"url": canonical_url, "source_evidence": evidence})
