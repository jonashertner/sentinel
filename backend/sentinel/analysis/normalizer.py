from sentinel.models.event import HealthEvent

# Map common disease name variants to canonical names
DISEASE_ALIASES: dict[str, str] = {
    "avian flu": "Avian influenza",
    "avian influenza": "Avian influenza",
    "bird flu": "Avian influenza",
    "h5n1": "Avian influenza A(H5N1)",
    "h5n6": "Avian influenza A(H5N6)",
    "h7n9": "Avian influenza A(H7N9)",
    "swine flu": "Influenza A(H1N1)",
    "monkeypox": "Mpox",
    "monkey pox": "Mpox",
    "ebola virus disease": "Ebola",
    "evd": "Ebola",
    "mers-cov": "MERS",
    "middle east respiratory syndrome": "MERS",
    "sars-cov-2": "COVID-19",
    "covid": "COVID-19",
    "coronavirus disease": "COVID-19",
    "yellow fever": "Yellow fever",
    "dengue fever": "Dengue",
    "dengue hemorrhagic fever": "Dengue",
    "west nile virus": "West Nile fever",
    "wnv": "West Nile fever",
    "zika virus": "Zika",
    "chikungunya virus": "Chikungunya",
    "cholera": "Cholera",
    "plague": "Plague",
    "anthrax": "Anthrax",
    "rabies": "Rabies",
    "tuberculosis": "Tuberculosis",
    "tb": "Tuberculosis",
    "measles": "Measles",
    "polio": "Poliomyelitis",
    "poliomyelitis": "Poliomyelitis",
    "lassa fever": "Lassa fever",
    "rift valley fever": "Rift Valley fever",
    "crimean-congo hemorrhagic fever": "CCHF",
    "cchf": "CCHF",
    "marburg": "Marburg",
    "nipah": "Nipah",
    "hendra": "Hendra",
    "campylobacter": "Campylobacteriosis",
    "salmonella": "Salmonellosis",
    "listeria": "Listeriosis",
    "e. coli": "E. coli infection",
    "brucellosis": "Brucellosis",
    "q fever": "Q fever",
    "african swine fever": "African swine fever",
    "asf": "African swine fever",
    "foot and mouth disease": "Foot-and-mouth disease",
    "fmd": "Foot-and-mouth disease",
    "lumpy skin disease": "Lumpy skin disease",
    "lsd": "Lumpy skin disease",
    "newcastle disease": "Newcastle disease",
    "bluetongue": "Bluetongue",
}

# Common country name to ISO 3166 alpha-2 mapping
COUNTRY_CODES: dict[str, str] = {
    "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR",
    "australia": "AU", "austria": "AT", "bangladesh": "BD", "belgium": "BE",
    "bolivia": "BO", "brazil": "BR", "burkina faso": "BF", "burundi": "BI",
    "cambodia": "KH", "cameroon": "CM", "canada": "CA", "chad": "TD",
    "chile": "CL", "china": "CN", "colombia": "CO", "congo": "CG",
    "democratic republic of the congo": "CD", "drc": "CD",
    "côte d'ivoire": "CI", "ivory coast": "CI",
    "croatia": "HR", "cuba": "CU", "czech republic": "CZ", "czechia": "CZ",
    "denmark": "DK", "ecuador": "EC", "egypt": "EG", "ethiopia": "ET",
    "finland": "FI", "france": "FR", "germany": "DE", "ghana": "GH",
    "greece": "GR", "guinea": "GN", "haiti": "HT", "honduras": "HN",
    "hungary": "HU", "india": "IN", "indonesia": "ID", "iran": "IR",
    "iraq": "IQ", "ireland": "IE", "israel": "IL", "italy": "IT",
    "japan": "JP", "jordan": "JO", "kenya": "KE", "south korea": "KR",
    "republic of korea": "KR", "laos": "LA", "lebanon": "LB",
    "liberia": "LR", "libya": "LY", "liechtenstein": "LI",
    "madagascar": "MG", "malawi": "MW", "malaysia": "MY", "mali": "ML",
    "mexico": "MX", "morocco": "MA", "mozambique": "MZ", "myanmar": "MM",
    "nepal": "NP", "netherlands": "NL", "new zealand": "NZ",
    "niger": "NE", "nigeria": "NG", "norway": "NO", "oman": "OM",
    "pakistan": "PK", "panama": "PA", "papua new guinea": "PG",
    "paraguay": "PY", "peru": "PE", "philippines": "PH", "poland": "PL",
    "portugal": "PT", "qatar": "QA", "romania": "RO", "russia": "RU",
    "russian federation": "RU", "rwanda": "RW",
    "saudi arabia": "SA", "senegal": "SN", "serbia": "RS",
    "sierra leone": "SL", "singapore": "SG", "slovakia": "SK",
    "slovenia": "SI", "somalia": "SO", "south africa": "ZA",
    "south sudan": "SS", "spain": "ES", "sri lanka": "LK",
    "sudan": "SD", "sweden": "SE", "switzerland": "CH",
    "syria": "SY", "taiwan": "TW", "tanzania": "TZ", "thailand": "TH",
    "togo": "TG", "tunisia": "TN", "turkey": "TR", "türkiye": "TR",
    "uganda": "UG", "ukraine": "UA", "united arab emirates": "AE",
    "uae": "AE", "united kingdom": "GB", "uk": "GB",
    "united states": "US", "usa": "US", "united states of america": "US",
    "uruguay": "UY", "uzbekistan": "UZ", "venezuela": "VE",
    "viet nam": "VN", "vietnam": "VN", "yemen": "YE",
    "zambia": "ZM", "zimbabwe": "ZW",
}

WHO_REGIONS: dict[str, str] = {
    "AF": "AFRO", "DZ": "AFRO", "BF": "AFRO", "BI": "AFRO", "CM": "AFRO",
    "TD": "AFRO", "CG": "AFRO", "CD": "AFRO", "CI": "AFRO", "ET": "AFRO",
    "GH": "AFRO", "GN": "AFRO", "KE": "AFRO", "LR": "AFRO", "MG": "AFRO",
    "MW": "AFRO", "ML": "AFRO", "MZ": "AFRO", "NE": "AFRO", "NG": "AFRO",
    "RW": "AFRO", "SN": "AFRO", "SL": "AFRO", "SO": "AFRO", "ZA": "AFRO",
    "SS": "AFRO", "SD": "AFRO", "TZ": "AFRO", "TG": "AFRO", "UG": "AFRO",
    "ZM": "AFRO", "ZW": "AFRO",
    "AR": "AMRO", "BO": "AMRO", "BR": "AMRO", "CA": "AMRO", "CL": "AMRO",
    "CO": "AMRO", "CU": "AMRO", "EC": "AMRO", "HT": "AMRO", "HN": "AMRO",
    "MX": "AMRO", "PA": "AMRO", "PY": "AMRO", "PE": "AMRO", "US": "AMRO",
    "UY": "AMRO", "VE": "AMRO",
    "BD": "SEARO", "IN": "SEARO", "ID": "SEARO", "MM": "SEARO", "NP": "SEARO",
    "LK": "SEARO", "TH": "SEARO",
    "AL": "EURO", "AT": "EURO", "BE": "EURO", "HR": "EURO", "CZ": "EURO",
    "DK": "EURO", "FI": "EURO", "FR": "EURO", "DE": "EURO", "GR": "EURO",
    "HU": "EURO", "IE": "EURO", "IL": "EURO", "IT": "EURO", "LI": "EURO",
    "NL": "EURO", "NO": "EURO", "PL": "EURO", "PT": "EURO", "RO": "EURO",
    "RU": "EURO", "RS": "EURO", "SK": "EURO", "SI": "EURO", "ES": "EURO",
    "SE": "EURO", "CH": "EURO", "TR": "EURO", "UA": "EURO", "GB": "EURO",
    "EG": "EMRO", "IR": "EMRO", "IQ": "EMRO", "JO": "EMRO", "LB": "EMRO",
    "LY": "EMRO", "MA": "EMRO", "OM": "EMRO", "PK": "EMRO", "QA": "EMRO",
    "SA": "EMRO", "SY": "EMRO", "TN": "EMRO", "AE": "EMRO", "YE": "EMRO",
    "AU": "WPRO", "KH": "WPRO", "CN": "WPRO", "JP": "WPRO", "KR": "WPRO",
    "LA": "WPRO", "MY": "WPRO", "NZ": "WPRO", "PG": "WPRO", "PH": "WPRO",
    "SG": "WPRO", "TW": "WPRO", "VN": "WPRO",
}


def normalize_disease(name: str) -> str:
    """Normalize a disease name to its canonical form."""
    key = name.lower().strip()
    if key in DISEASE_ALIASES:
        return DISEASE_ALIASES[key]
    # Check partial matches
    for alias, canonical in DISEASE_ALIASES.items():
        if alias in key:
            return canonical
    return name.strip()


def normalize_country(text: str) -> list[str]:
    """Normalize a country name or code to ISO 3166 alpha-2 code(s)."""
    key = text.lower().strip()
    if not key:
        return ["XX"]
    if key.upper() == "EU":
        return ["EU"]
    # Already a valid 2-letter code (but not XX)
    if len(key) == 2 and key.upper() != "XX" and key.upper() in WHO_REGIONS:
        return [key.upper()]
    if key in COUNTRY_CODES:
        return [COUNTRY_CODES[key]]
    # Try partial match
    for name, code in COUNTRY_CODES.items():
        if name in key or key in name:
            return [code]
    return ["XX"]


def assign_who_regions(countries: list[str]) -> list[str]:
    """Assign WHO regions based on country codes."""
    regions = set()
    for c in countries:
        if c == "EU":
            regions.add("EURO")
            continue
        if c in WHO_REGIONS:
            regions.add(WHO_REGIONS[c])
    return sorted(regions)


def normalize_event(event: HealthEvent) -> HealthEvent:
    """Normalize disease names and country codes on an event."""
    event.disease = normalize_disease(event.disease)
    normalized_countries: list[str] = []
    for c in event.countries:
        normalized_countries.extend(normalize_country(c))
    event.countries = sorted(set(normalized_countries))
    if not event.regions:
        event.regions = assign_who_regions(event.countries)
    return event
