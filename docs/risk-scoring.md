# Risk Scoring Methodology

SENTINEL uses a hybrid scoring approach: a deterministic rule engine for transparent, auditable base scores, combined with Claude LLM analysis for expert-level nuance. This document fully describes both systems.

---

## Overview

Every event receives two independent scores:

- **Risk Score** (0--10) -- How dangerous is this event globally?
- **Swiss Relevance** (0--10) -- How much does this matter to Switzerland specifically?

Events are categorized by risk score:

| Category | Score Range | LLM Analysis | Action Level |
|----------|-------------|--------------|--------------|
| CRITICAL | 8.0 -- 10.0 | Sonnet 4.6 | Immediate review, cross-agency alert |
| HIGH | 6.0 -- 7.9 | Sonnet 4.6 | Priority triage, situation creation |
| MEDIUM | 4.0 -- 5.9 | Haiku 4.5 | Standard monitoring |
| LOW | 0.0 -- 3.9 | None | Logged, searchable |

---

## Rule Engine

**File:** `backend/sentinel/analysis/rule_engine.py`

The rule engine applies deterministic scoring based on six factors. Each event starts at 0.0 and accumulates points. The final score is capped at 10.0.

### Factor 1: Geographic Proximity (0--4 points)

| Condition | Points | Countries |
|-----------|--------|-----------|
| Event in Switzerland | +4.0 | `CH` |
| Swiss border country | +3.0 | `DE`, `FR`, `IT`, `AT`, `LI` |
| Swiss trade partner | +1.5 | `DE`, `FR`, `IT`, `AT`, `NL`, `BE`, `ES`, `US`, `CN`, `BR`, `GB`, `PL` |

Note: These are cumulative only in the `CH` case (a Swiss event also matches border country). For non-Swiss events, only the highest matching geographic tier applies. Border countries are a subset of trade partners, so a border country event scores +3.0 (not +4.5).

### Factor 2: Disease Severity (0--2.5 points)

Events involving a high-concern disease receive +2.5 points. The watch list:

> Avian influenza (all subtypes), Mpox, Ebola, MERS, Plague, Dengue, Marburg, Nipah, Lassa fever, CCHF, Rift Valley fever, COVID-19, Cholera, Poliomyelitis, Yellow fever

These represent diseases with pandemic potential, high case fatality rates, or specific relevance to Swiss preparedness planning.

### Factor 3: Zoonotic / One Health (0--1 point)

+1.0 if the event species is `BOTH` (cross-species) or the disease appears in the zoonotic disease set:

> Avian influenza (all subtypes), Mpox, Ebola, MERS, Nipah, Hendra, Rabies, Brucellosis, Q fever, Lassa fever, CCHF, Rift Valley fever, West Nile fever, Marburg, Campylobacteriosis, Salmonellosis, Listeriosis, E. coli infection

Events matching this factor also receive the `zoonotic` One Health tag.

### Factor 4: Case Severity (0--2 points)

| Condition | Points |
|-----------|--------|
| Deaths > 10 | +2.0 |
| Deaths > 0 (but <= 10) | +1.0 |
| Cases > 100 (no deaths reported) | +1.0 |

These conditions are mutually exclusive -- only the first matching condition applies.

### Factor 5: Source Authority (0--1 point)

+1.0 for events from ECDC or WHO DON. These sources provide verified, high-confidence data.

### Factor 6: One Health Tags (no additional points)

The rule engine also assigns One Health tags for downstream use. These do not affect the risk score but are used for filtering and agency-specific views:

| Tag | Diseases |
|-----|----------|
| `vector-borne` | Dengue, Zika, Chikungunya, West Nile fever, Yellow fever, Malaria |
| `foodborne` | Campylobacteriosis, Salmonellosis, Listeriosis, E. coli infection |
| `AMR` | Tuberculosis, Campylobacteriosis, Salmonellosis |

### Maximum Possible Score

A Swiss event (`CH`) with a high-concern zoonotic disease, 10+ deaths, from an authoritative source:

```
4.0 (CH) + 2.5 (high-concern) + 1.0 (zoonotic) + 2.0 (deaths > 10) + 1.0 (authoritative) = 10.5 → capped at 10.0
```

---

## Swiss Relevance Scoring

**File:** `backend/sentinel/analysis/swiss_relevance.py`

A separate score measuring Switzerland-specific relevance. This is independent of the global risk score.

### Factor 1: Geographic Proximity (0--10 points)

| Condition | Points |
|-----------|--------|
| Event in Switzerland | 10.0 (immediate maximum) |
| Swiss border country | +5.0 |
| European country | +2.5 |
| Swiss trade partner | +2.0 |

For non-Swiss events, only the highest tier applies (border > Europe > trade partner).

European countries included: DE, FR, IT, AT, LI, NL, BE, ES, PT, GB, IE, DK, SE, NO, FI, PL, CZ, SK, HU, RO, HR, SI, GR, RS, AL, UA, RU.

### Factor 2: Swiss Vector Diseases (+2.0)

Diseases with vectors established or emerging in Swiss climate zones:

> West Nile fever, Dengue, Chikungunya, Zika, Bluetongue

These diseases have heightened relevance because the transmission vectors (mosquitoes, midges) are present or expanding into Switzerland.

### Factor 3: One Health Tags (+1.5 each)

- **Zoonotic** (+1.5) -- Relevant for BLV's veterinary mandate
- **Foodborne** (+1.5) -- Relevant for BLV's food safety mandate

### Factor 4: High Case Count (+1.0)

Events with > 1000 cases receive a relevance boost, reflecting the epidemiological significance that affects risk assessment regardless of geography.

### Maximum Possible Score

A Swiss event: immediately 10.0 (capped).

A border country event with a Swiss vector disease and both One Health tags: `5.0 + 2.0 + 1.5 + 1.5 = 10.0`.

---

## LLM Analysis

**File:** `backend/sentinel/analysis/llm_analyzer.py`

Events scoring >= 4.0 (MEDIUM or above) receive Claude LLM analysis.

### Model Selection

| Risk Score | Model | Rationale |
|------------|-------|-----------|
| < 6.0 | Claude Haiku 4.5 | Cost-efficient for medium-risk bulk screening |
| >= 6.0 | Claude Sonnet 4.6 | Deep analysis for high-risk and critical events |

### System Prompt

The full system prompt sent to Claude:

```
You are a senior epidemiologist advising the Swiss Federal Office of Public Health
(BAG) and the Federal Food Safety and Veterinary Office (BLV). Analyze disease
events for their risk to Switzerland under the One Health framework
(human, animal, environment).

Respond in JSON format with these fields:
- risk_assessment: 2-3 sentence risk analysis
- swiss_relevance_narrative: Why this matters specifically for Switzerland
  (trade, travel, vectors, border proximity, migratory routes)
- one_health_analysis: Cross-domain implications (human<>animal<>environment)
- recommended_actions: List of 2-4 specific monitoring/preparedness actions
  for Swiss authorities
- adjusted_risk_score: Float 0-10, your professional assessment
  (can differ from automated score)
```

### Event Context Sent to Claude

For each event, the LLM receives:

- Title, disease, countries, species, source, date
- Case count and death count (or "Unknown")
- Summary (first 1000 characters)
- Current risk score and Swiss relevance (from rule engine)
- One Health tags

### How LLM Adjusts Scores

The LLM returns an `adjusted_risk_score` field. If present and valid (0--10 float), it replaces the rule engine score. This allows the LLM to:

- **Increase scores** when context suggests higher risk than rules capture (e.g., unusual strain, rapid spread, immunologically naive population)
- **Decrease scores** when context suggests lower risk (e.g., outbreak contained, vaccine available, limited human-to-human transmission)

### Analysis Output

The LLM response is formatted into a structured analysis string with four sections:

1. **Risk Assessment** -- 2--3 sentence global risk analysis
2. **Swiss Relevance** -- Why this matters for Switzerland
3. **One Health** -- Cross-domain implications
4. **Recommended Actions** -- 2--4 specific actions for Swiss authorities

This analysis is stored in the event's `analysis` field and displayed in the dashboard.

### Error Handling

- **No API key:** Warning logged, LLM analysis skipped. Events keep their rule engine scores.
- **API error:** Exception caught and logged for the specific event. Other events still analyzed.
- **Malformed response:** The analyzer attempts to extract JSON from markdown code blocks. If all parsing fails, the raw text is used as the risk assessment.

---

## Worked Examples

### Example 1: Avian Influenza H5N1 in Germany

**Event:**
- Disease: Avian influenza A(H5N1)
- Country: DE (Germany)
- Species: ANIMAL
- Source: WOAH
- Deaths: 0 (animal deaths not counted here)
- Cases: 50

**Rule Engine Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Geographic proximity | +3.0 | Germany is a Swiss border country |
| Disease severity | +2.5 | H5N1 is on the high-concern list |
| Zoonotic | +1.0 | H5N1 is in the zoonotic disease set |
| Case severity | +0.0 | No human deaths, cases < 100 |
| Source authority | +0.0 | WOAH is not in the +1.0 tier |
| **Total** | **6.5** | **Category: HIGH** |

**Swiss Relevance Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Border country | +5.0 | Germany borders Switzerland |
| Zoonotic tag | +1.5 | Tagged as zoonotic |
| **Total** | **6.5** | |

**LLM Analysis** (Sonnet 4.6, score >= 6.0):

The LLM would likely maintain or increase the score, noting migratory bird routes over Switzerland, risk of introduction to Swiss poultry, and the zoonotic pandemic potential of H5N1.

---

### Example 2: Cholera in Mozambique

**Event:**
- Disease: Cholera
- Country: MZ (Mozambique)
- Species: HUMAN
- Source: WHO DON
- Deaths: 15
- Cases: 3200

**Rule Engine Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Geographic proximity | +0.0 | Mozambique is not a neighbor or trade partner |
| Disease severity | +2.5 | Cholera is on the high-concern list |
| Zoonotic | +0.0 | Cholera is not zoonotic |
| Case severity | +2.0 | Deaths > 10 |
| Source authority | +1.0 | WHO DON |
| **Total** | **5.5** | **Category: MEDIUM** |

**Swiss Relevance Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Geographic proximity | +0.0 | Not European, not trade partner |
| High case count | +1.0 | Cases > 1000 |
| **Total** | **1.0** | |

**LLM Analysis** (Haiku 4.5, score < 6.0):

The LLM would note limited direct risk to Switzerland but flag travel-related import risk and the broader humanitarian concern.

---

### Example 3: Listeriosis in France

**Event:**
- Disease: Listeriosis
- Country: FR (France)
- Species: HUMAN
- Source: ECDC
- Deaths: 2
- Cases: 30

**Rule Engine Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Geographic proximity | +3.0 | France is a Swiss border country |
| Disease severity | +0.0 | Listeriosis is not on the high-concern list |
| Zoonotic | +1.0 | Listeriosis is in the zoonotic set |
| Case severity | +1.0 | Deaths > 0 |
| Source authority | +1.0 | ECDC |
| **Total** | **6.0** | **Category: HIGH** |

**Swiss Relevance Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Border country | +5.0 | France borders Switzerland |
| Zoonotic tag | +1.5 | Tagged as zoonotic |
| Foodborne tag | +1.5 | Listeriosis is foodborne |
| **Total** | **8.0** | |

**LLM Analysis** (Sonnet 4.6, score >= 6.0):

The LLM would emphasize the food safety dimension -- Swiss imports of French dairy and charcuterie products, BLV food safety mandate, need to check for product recalls at the Swiss border.

---

### Example 4: Dengue in Brazil

**Event:**
- Disease: Dengue
- Country: BR (Brazil)
- Species: HUMAN
- Source: ProMED
- Deaths: 200
- Cases: 50000

**Rule Engine Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Geographic proximity | +1.5 | Brazil is a Swiss trade partner |
| Disease severity | +2.5 | Dengue is on the high-concern list |
| Zoonotic | +0.0 | Dengue is not zoonotic (vector-borne, not animal-to-human) |
| Case severity | +2.0 | Deaths > 10 |
| Source authority | +0.0 | ProMED is not in the +1.0 tier |
| **Total** | **6.0** | **Category: HIGH** |

**Swiss Relevance Scoring:**

| Factor | Points | Reason |
|--------|--------|--------|
| Trade partner | +2.0 | Brazil is a Swiss trade partner |
| Swiss vector disease | +2.0 | Dengue vectors emerging in Swiss climate |
| High case count | +1.0 | Cases > 1000 |
| **Total** | **5.0** | |

**LLM Analysis** (Sonnet 4.6, score >= 6.0):

The LLM would note the travel-related import risk (Swiss tourists returning from Brazil), the expanding range of Aedes mosquitoes in southern Europe, and the relevance for Swiss vector surveillance programs.

---

## Transparency Commitment

The rule engine is fully deterministic and auditable. Given the same event data, it will always produce the same score. The LLM component introduces variability but its inputs (the system prompt, the event context) and outputs (the structured analysis, the adjusted score) are all logged and stored alongside the event data.

Analysts can always see:
- The original rule engine score
- Whether and how the LLM adjusted it
- The full LLM analysis narrative
- The exact factors that contributed to both scores
