# Data Sources

SENTINEL collects from five international public health data sources. Each source is implemented as a pluggable collector module that conforms to the `BaseCollector` abstract interface.

---

## WHO Disease Outbreak News (DON)

**Collector:** `backend/sentinel/collectors/who_don.py`

### Overview

WHO DON publishes official reports on disease outbreaks and public health events worldwide. These are curated, verified reports from the WHO headquarters -- the gold standard for outbreak confirmation.

### Technical Details

| Property | Value |
|----------|-------|
| Feed URL | `https://www.who.int/feeds/entity/don/en/rss.xml` |
| Method | RSS (XML) feed via HTTP GET |
| Parser | `feedparser` library |
| Data format | RSS 2.0 with `<title>`, `<link>`, `<description>`, `<pubDate>` |
| Update frequency | Irregular; typically 2--5 new items per week |
| Authentication | None required |
| Rate limits | No documented rate limit; polite 30s timeout |

### What It Provides

- Official outbreak reports with verified case/death counts
- Title format: `"Disease - Country"` (parsed to extract disease and location)
- Detailed HTML description with epidemiological summary
- Publication date (used as `date_reported`)

### Parsing Strategy

1. Fetch RSS feed with `httpx.AsyncClient` (30s timeout)
2. Parse with `feedparser`
3. Extract disease and country from title by splitting on dash/em-dash separators
4. Map to `HealthEvent` with `source=WHO_DON`, `species=HUMAN`

### Limitations

- Titles do not follow a strict format; disease/country extraction is heuristic
- Country names in titles require normalization (handled by the Normalizer stage)
- Reports may lag actual outbreaks by days or weeks (official verification takes time)
- No structured case count in the feed; available only in the full article HTML

### Error Handling

- Network errors: caught and logged, returns empty list
- Malformed entries: skipped individually (other entries still processed)
- Timeout: 30-second limit prevents pipeline hangs

---

## WHO Epidemic Intelligence from Open Sources (EIOS)

**Collector:** `backend/sentinel/collectors/who_eios.py`

### Overview

EIOS is WHO's media intelligence platform that screens thousands of news sources, social media, and other open sources for early disease signals. It provides the earliest possible alerts, often before official reports.

### Technical Details

| Property | Value |
|----------|-------|
| API URL | `https://portal.who.int/eios/api/signals` |
| Method | REST API via HTTP GET |
| Data format | JSON (array of signal objects) |
| Update frequency | Continuous (new signals every few hours) |
| Authentication | **Bearer token required** (restricted access) |
| Rate limits | Governed by WHO access agreement |

### Access Requirements

EIOS access is restricted to authorized public health organizations. To use this collector:

1. Request access through the [WHO EIOS portal](https://www.who.int/initiatives/eios)
2. Obtain API credentials from the EIOS Secretariat
3. Configure the API key via environment variable or constructor parameter

The collector gracefully returns an empty list if credentials are not configured or the API is unreachable. This is expected behavior for environments without EIOS access.

### What It Provides

- Media-sourced disease signals (earliest detection layer)
- Structured fields: `title`, `summary`, `date`, `disease`, `countries`, `species`
- URL to the original media source
- Signal categorization and relevance scores

### Parsing Strategy

1. Fetch signals with optional Bearer token authentication
2. Parse JSON response (handles both array and object-wrapped formats)
3. Extract country codes (supports string and array formats)
4. Detect species from signal metadata

### Limitations

- Requires institutional access credentials
- Signals are unverified (media reports, not official data)
- Higher false-positive rate than official sources
- Signal quality varies by media source

### Error Handling

- Authentication failure: logged as expected behavior, returns empty list
- Missing credentials: warning logged, returns empty list (pipeline continues)
- Malformed items: skipped individually

### Fallback Strategy

If EIOS is unavailable, the pipeline operates with four sources. EIOS primarily adds early signal detection; the other sources provide verified data with higher confidence.

---

## ProMED-mail

**Collector:** `backend/sentinel/collectors/promed.py`

### Overview

ProMED-mail is the Program for Monitoring Emerging Diseases, operated by the International Society for Infectious Diseases (ISID). It provides expert-curated reports on emerging infectious diseases, often combining reports from multiple countries with expert commentary.

### Technical Details

| Property | Value |
|----------|-------|
| Feed URL | `https://promedmail.org/feed/` |
| Method | RSS feed via HTTP GET |
| Data format | RSS 2.0 |
| Update frequency | Multiple posts daily |
| Authentication | None required |
| Rate limits | No documented limit; polite access recommended |

### What It Provides

- Expert-curated outbreak reports with commentary
- Both human and animal health reports
- Subject line prefix indicates domain:
  - `PRO/` -- Human health
  - `PRO/AH/` -- Animal health
  - `PRO/AH/EDR>` -- Animal health, emerging disease report
- Title format: `"PRO/AH/EDR> Disease - Country: details"`

### Parsing Strategy

1. Fetch RSS feed with `httpx.AsyncClient`
2. Parse with `feedparser`
3. **Species detection** from subject line prefix:
   - Titles containing `AH/` are tagged as `Species.ANIMAL`
   - All others default to `Species.HUMAN`
4. **Disease/country extraction**: strip the `PRO/.../` prefix, then split on ` - ` to separate disease from location
5. Country part may include additional details after `:` which are stripped

### Limitations

- Subject line format is not fully standardized; variations exist
- Country extraction from the title is approximate (first 2 characters as ISO code)
- Full report content is in the RSS description, often lengthy and unstructured
- Reports may cover multiple countries within one post

### Error Handling

- Network errors: caught and logged, returns empty list
- Feed parsing failures: handled by feedparser's robust error tolerance
- Individual entry failures: skipped with continued processing

---

## European Centre for Disease Prevention and Control (ECDC)

**Collector:** `backend/sentinel/collectors/ecdc.py`

### Overview

ECDC publishes threat assessments and epidemiological updates focused on the European region. These are high-authority reports used for European surveillance. ECDC is the highest-priority source in SENTINEL's deduplication ranking.

### Technical Details

| Property | Value |
|----------|-------|
| Feed URL | `https://www.ecdc.europa.eu/en/taxonomy/term/2942/feed` |
| Method | RSS feed via HTTP GET |
| Data format | RSS 2.0 |
| Update frequency | Several times per week |
| Authentication | None required |
| Rate limits | No documented limit |

### What It Provides

- European-focused threat assessments
- Communicable disease threat reports (CDTR)
- Rapid risk assessments for specific outbreaks
- Title format: `"Disease - Region/Country"` (dash-separated)
- All events pre-tagged with `region=["EURO"]`

### Parsing Strategy

1. Fetch RSS feed with `httpx.AsyncClient`
2. Parse with `feedparser`
3. Extract disease and country from title (split on dash/em-dash)
4. Default country code to `"EU"` if no specific country identified
5. Map to `HealthEvent` with `source=ECDC`, `species=HUMAN`, `regions=["EURO"]`

### Limitations

- European focus only (global events may not appear)
- Title format varies between threat assessments and epidemiological updates
- Country identification from titles is approximate
- May not capture animal-only events

### Error Handling

- Standard 30-second timeout
- Network errors caught and logged
- Returns empty list on any failure

---

## World Organisation for Animal Health (WOAH) / WAHIS

**Collector:** `backend/sentinel/collectors/woah.py`

### Overview

WOAH (formerly OIE) operates the World Animal Health Information System (WAHIS), the authoritative source for animal disease notifications worldwide. This is SENTINEL's primary source for animal health data, essential for the One Health framework.

### Technical Details

| Property | Value |
|----------|-------|
| API URL | `https://wahis.woah.org/api/v1/pi/getReport/list` |
| Method | REST API via HTTP POST |
| Data format | JSON |
| Update frequency | Continuous (as countries submit reports) |
| Authentication | None required for public data |
| Rate limits | No documented public rate limit |

### Request Format

```json
{
    "pageNumber": 0,
    "pageSize": 20,
    "searchText": "",
    "sortColName": "eventDate",
    "sortColOrder": "DESC"
}
```

### What It Provides

- Official animal disease outbreak reports from member countries
- Structured data: disease name, country (with ISO code), event date, report ID
- Animal species/category information
- Report URLs linking to full WAHIS reports

### Parsing Strategy

1. POST to the WAHIS API with pagination parameters
2. Parse JSON response (handles multiple response structures: `content`, `items`, array)
3. Extract disease, country, date from report fields (tries multiple field names for resilience)
4. **Species detection**: checks for "human" in the animal category field
  - If human involvement detected: `Species.BOTH` (zoonotic spillover)
  - Default: `Species.ANIMAL`
5. Generate WAHIS URLs from report IDs: `https://wahis.woah.org/#/report-info?reportId={id}`

### Limitations

- API response format may change (the collector handles multiple field name variants)
- Country ISO codes from WAHIS may be 3-letter (ISO 3166-1 alpha-3); the collector truncates to 2
- Page size is fixed at 20 reports per request (sufficient for daily collection)
- No authentication means no access to restricted/draft reports

### Error Handling

- Network/API errors: caught and logged, returns empty list
- Missing fields: extensive use of `.get()` with fallback values
- Date parsing: tries ISO format, falls back to `date.today()`
- Invalid URLs: reconstructed as WAHIS deep links

---

## Cross-Source Considerations

### Source Priority for Deduplication

When multiple sources report the same event (same disease + same country within 3 days), SENTINEL merges them using a priority ranking:

| Priority | Source | Rationale |
|----------|--------|-----------|
| 5 (highest) | ECDC | European authority, most relevant for Switzerland |
| 4 | WHO DON | Global authority, verified data |
| 3 | WOAH | Animal health authority |
| 2 | ProMED | Expert reports, valuable commentary |
| 1 (lowest) | WHO EIOS | Media-based, less verified |

During merging:
- The highest-priority source provides the primary record
- The longest summary across sources is kept
- Country lists are unioned (all mentioned countries retained)
- The highest case/death counts are preserved

### Source Authority in Risk Scoring

ECDC and WHO DON events receive a +1.0 bonus in the rule engine, reflecting their higher data confidence.

### Graceful Degradation

The pipeline is designed to operate with any subset of sources. If a collector fails:
1. The error is logged with full traceback
2. The failure is recorded in the `PipelineResult.errors` list
3. The pipeline continues with data from remaining sources
4. The daily brief includes a source summary showing which sources contributed

This ensures the dashboard always has data, even if individual sources are temporarily unavailable.
