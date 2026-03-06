# API Reference

SENTINEL provides a FastAPI REST API for the frontend dashboard. During development, the API serves live data from the `DataStore`. In production (GitHub Pages), the frontend reads directly from static JSON files.

**Base URL:** `http://localhost:8000` (development)

---

## Health Check

### `GET /api/health`

Returns service health status.

**Response:**

```json
{
    "status": "ok",
    "service": "sentinel"
}
```

---

## Events

### `GET /api/events`

List all events with optional filtering. Results are sorted by Swiss relevance (descending).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `date_from` | `date` | Filter events reported on or after this date (YYYY-MM-DD) |
| `date_to` | `date` | Filter events reported on or before this date |
| `source` | `string` | Filter by source: `WHO_DON`, `WHO_EIOS`, `PROMED`, `ECDC`, `WOAH` |
| `disease` | `string` | Filter by disease name (case-insensitive substring match) |
| `risk_category` | `string` | Filter by risk category: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `country` | `string` | Filter by country code (ISO 3166 alpha-2, case-insensitive) |
| `min_swiss_relevance` | `float` | Minimum Swiss relevance score (0--10) |

**Response:** `200 OK`

```json
[
    {
        "id": "a1b2c3d4e5f67890",
        "source": "ECDC",
        "title": "Avian influenza A(H5N1) - Germany",
        "date_reported": "2026-03-05",
        "date_collected": "2026-03-06",
        "disease": "Avian influenza A(H5N1)",
        "pathogen": null,
        "countries": ["DE"],
        "regions": ["EURO"],
        "species": "animal",
        "case_count": 50,
        "death_count": null,
        "summary": "Outbreak of HPAI H5N1 detected in poultry farm...",
        "url": "https://www.ecdc.europa.eu/...",
        "raw_content": "...",
        "risk_score": 6.5,
        "swiss_relevance": 6.5,
        "risk_category": "HIGH",
        "one_health_tags": ["zoonotic"],
        "analysis": "**Risk Assessment:** ..."
    }
]
```

---

### `GET /api/events/latest`

Get events from the most recent collection date, sorted by Swiss relevance.

**Query Parameters:** None

**Response:** `200 OK` -- Same format as `GET /api/events`

---

### `GET /api/events/stats`

Get aggregate statistics across all events.

**Response:** `200 OK`

```json
{
    "total": 142,
    "by_source": {
        "WHO_DON": 28,
        "ECDC": 35,
        "PROMED": 40,
        "WOAH": 20,
        "WHO_EIOS": 19
    },
    "by_risk": {
        "CRITICAL": 3,
        "HIGH": 12,
        "MEDIUM": 45,
        "LOW": 82
    },
    "by_disease": {
        "Avian influenza A(H5N1)": 15,
        "Dengue": 12,
        "Cholera": 10,
        "Mpox": 8,
        "COVID-19": 7
    }
}
```

The `by_disease` field returns the top 20 diseases by event count.

---

### `GET /api/events/{event_id}`

Get a single event by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | `string` | Event ID (16-character hex hash) |

**Response:** `200 OK` -- Single event object

**Error:** `404 Not Found`

```json
{
    "detail": "Event not found"
}
```

---

## Situations

### `GET /api/situations`

List all situations.

**Response:** `200 OK`

```json
[
    {
        "id": "sit-a1b2c3d4",
        "title": "H5N1 European Spread 2026",
        "status": "ACTIVE",
        "created": "2026-03-01",
        "updated": "2026-03-06T08:30:00Z",
        "events": ["a1b2c3d4e5f67890", "b2c3d4e5f6789012"],
        "diseases": ["Avian influenza A(H5N1)"],
        "countries": ["DE", "FR", "NL"],
        "lead_analyst": "Dr. Mueller",
        "priority": "P1",
        "summary": "HPAI H5N1 spreading across Western Europe...",
        "annotations": [],
        "swiss_impact_assessment": "High risk of introduction via migratory birds...",
        "recommended_actions": [
            "Increase surveillance of wild bird populations",
            "Alert cantonal veterinary offices"
        ],
        "human_health_status": "No human cases",
        "animal_health_status": "Active outbreaks in poultry",
        "environmental_status": "Wild bird die-offs reported"
    }
]
```

---

### `POST /api/situations`

Create a new situation.

**Request Body:**

```json
{
    "title": "H5N1 European Spread 2026",
    "diseases": ["Avian influenza A(H5N1)"],
    "countries": ["DE", "FR"],
    "lead_analyst": "Dr. Mueller",
    "priority": "P2",
    "summary": "Monitoring spread of H5N1 across European countries.",
    "events": ["a1b2c3d4e5f67890"]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | `string` | Yes | -- |
| `diseases` | `string[]` | Yes | -- |
| `countries` | `string[]` | Yes | -- |
| `lead_analyst` | `string` | Yes | -- |
| `priority` | `string` | No | `P2` |
| `summary` | `string` | Yes | -- |
| `events` | `string[]` | No | `[]` |

**Response:** `201 Created` -- Full situation object with generated `id`

---

### `GET /api/situations/{situation_id}`

Get a single situation by ID.

**Response:** `200 OK` -- Full situation object

**Error:** `404 Not Found`

---

### `PATCH /api/situations/{situation_id}`

Update a situation. Only include fields you want to change.

**Request Body:**

```json
{
    "status": "ESCALATED",
    "priority": "P1",
    "summary": "Updated: Human case confirmed in poultry worker.",
    "swiss_impact_assessment": "Direct risk to Swiss poultry sector.",
    "recommended_actions": [
        "Activate BLV emergency protocol",
        "Notify BAG for human health coordination"
    ]
}
```

All fields are optional. Only non-null fields are applied.

**Response:** `200 OK` -- Updated situation object

**Error:** `404 Not Found`

---

### `POST /api/situations/{situation_id}/events`

Link events to an existing situation.

**Request Body:**

```json
{
    "event_ids": ["c3d4e5f678901234", "d4e5f67890123456"]
}
```

Events that are already linked are not duplicated.

**Response:** `200 OK` -- Updated situation object

**Error:** `404 Not Found`

---

## Annotations

### `POST /api/annotations`

Create a new annotation on an event.

**Request Body:**

```json
{
    "event_id": "a1b2c3d4e5f67890",
    "author": "Dr. Mueller",
    "type": "ASSESSMENT",
    "content": "This outbreak is significant for Swiss poultry sector. Recommend enhanced border surveillance.",
    "visibility": "SHARED",
    "risk_override": 7.5,
    "status_change": "ESCALATED",
    "linked_event_ids": ["b2c3d4e5f6789012"],
    "tags": ["urgent", "BLV-action"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | `string` | Yes | ID of the event being annotated |
| `author` | `string` | Yes | Analyst name |
| `type` | `string` | Yes | `ASSESSMENT`, `NOTE`, `ACTION`, `LINK`, `ESCALATION` |
| `content` | `string` | Yes | Annotation text |
| `visibility` | `string` | Yes | `INTERNAL`, `SHARED`, `CONFIDENTIAL` |
| `risk_override` | `float` | No | Override the event's risk score (0--10) |
| `status_change` | `string` | No | `NEW`, `MONITORING`, `ESCALATED`, `RESOLVED`, `ARCHIVED` |
| `linked_event_ids` | `string[]` | No | Related event IDs |
| `tags` | `string[]` | No | Custom tags |

**Response:** `201 Created` -- Full annotation object with generated `id` and `timestamp`

---

### `GET /api/annotations`

List annotations, optionally filtered by event.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `event_id` | `string` | Filter annotations for a specific event |

**Response:** `200 OK`

```json
[
    {
        "id": "a1b2c3d4e5f6",
        "event_id": "a1b2c3d4e5f67890",
        "author": "Dr. Mueller",
        "timestamp": "2026-03-06T09:15:00Z",
        "type": "ASSESSMENT",
        "content": "This outbreak is significant...",
        "visibility": "SHARED",
        "risk_override": 7.5,
        "status_change": "ESCALATED",
        "linked_event_ids": ["b2c3d4e5f6789012"],
        "tags": ["urgent", "BLV-action"]
    }
]
```

---

## Analytics

### `GET /api/analytics/trends`

Events per day grouped by disease. Used for trend line charts.

**Response:** `200 OK`

```json
[
    {
        "date": "2026-03-04",
        "diseases": {
            "Avian influenza A(H5N1)": 3,
            "Dengue": 5,
            "Cholera": 2
        }
    },
    {
        "date": "2026-03-05",
        "diseases": {
            "Avian influenza A(H5N1)": 4,
            "Dengue": 3,
            "Mpox": 1
        }
    }
]
```

---

### `GET /api/analytics/sources`

Events per source per day. Used for source comparison charts.

**Response:** `200 OK`

```json
[
    {
        "date": "2026-03-04",
        "sources": {
            "WHO_DON": 5,
            "ECDC": 7,
            "PROMED": 8,
            "WOAH": 4,
            "WHO_EIOS": 3
        }
    }
]
```

---

### `GET /api/analytics/risk-timeline`

Average risk score and Swiss relevance per day with event count.

**Response:** `200 OK`

```json
[
    {
        "date": "2026-03-04",
        "avg_risk_score": 4.23,
        "avg_swiss_relevance": 3.15,
        "event_count": 27
    },
    {
        "date": "2026-03-05",
        "avg_risk_score": 4.87,
        "avg_swiss_relevance": 3.42,
        "event_count": 31
    }
]
```

---

## Watchlists

### `GET /api/watchlists`

List all watchlists.

**Response:** `200 OK`

```json
[
    {
        "id": "a1b2c3d4",
        "name": "Swiss Border Zoonoses",
        "diseases": ["Avian influenza A(H5N1)", "Rabies"],
        "countries": ["DE", "FR", "IT", "AT", "LI"],
        "min_risk_score": 4.0,
        "one_health_tags": ["zoonotic"]
    }
]
```

---

### `POST /api/watchlists`

Create a new watchlist.

**Request Body:**

```json
{
    "name": "Swiss Border Zoonoses",
    "diseases": ["Avian influenza A(H5N1)", "Rabies"],
    "countries": ["DE", "FR", "IT", "AT", "LI"],
    "min_risk_score": 4.0,
    "one_health_tags": ["zoonotic"]
}
```

All fields except `name` are optional (default to empty lists or 0.0).

**Response:** `201 Created` -- Full watchlist object with generated `id`

---

### `DELETE /api/watchlists/{watchlist_id}`

Delete a watchlist.

**Response:** `204 No Content`

**Error:** `404 Not Found`

---

## Exports

### `POST /api/exports/csv`

Export events as CSV with optional filtering.

**Request Body:**

```json
{
    "date_from": "2026-03-01",
    "date_to": "2026-03-06",
    "source": "ECDC",
    "disease": "influenza",
    "risk_category": "HIGH",
    "country": "DE",
    "min_swiss_relevance": 5.0,
    "limit": 500
}
```

All fields are optional. Default limit is 1000, maximum is 10000.

**Response:** `200 OK`
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename=sentinel_export.csv`

CSV columns: `id`, `title`, `source`, `date_reported`, `date_collected`, `disease`, `pathogen`, `countries`, `regions`, `species`, `case_count`, `death_count`, `risk_score`, `risk_category`, `swiss_relevance`, `one_health_tags`, `url`, `summary`

---

### `POST /api/exports/json`

Export events as JSON with the same filtering options as CSV export.

**Request Body:** Same as CSV export.

**Response:** `200 OK` -- Array of event objects (same format as `GET /api/events`)

---

### `GET /api/exports/reports/{report_date}`

Get the daily Markdown report for a specific date.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `report_date` | `date` | Report date (YYYY-MM-DD) |

**Response:** `200 OK`
- Content-Type: `text/markdown`
- Body: Markdown-formatted daily intelligence brief

**Error:** `404 Not Found`

```json
{
    "detail": "Report not found"
}
```

---

## Running the API Server

For local development:

```bash
cd backend
uv run uvicorn sentinel.main:app --reload
```

The API will be available at `http://localhost:8000`.

Interactive API documentation (Swagger UI) is available at `http://localhost:8000/docs`.
