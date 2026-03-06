# Epidemic Intelligence: Real-World Workflows, Tools, and Pain Points

**Research Date**: 2026-03-06
**Purpose**: Assess whether SENTINEL addresses real professional needs or misses critical workflows

---

## 1. WHO Health Emergencies Programme (WHE)

### 1.1 Daily Epidemic Intelligence Workflow

WHO conducts public health intelligence (PHI) operations **continuously, 365 days per year**, through four interlinked steps:

**Detection -> Verification -> Risk Assessment -> Reporting/Dissemination**

Three main monitoring channels feed the detection step:
- **EIOS system**: Processes online news, social media, government websites, blogs using NLP
- **Dedicated email accounts**: Direct communications from partners, field reports, surveillance data
- **GLEWS+**: Joint FAO-WHO-WOAH early warning system for the human-animal interface

The daily workflow in practice (documented during Tokyo 2020 Olympics):
1. **Automated filtering**: EIOS filters articles by pre-identified disease/country categories
2. **Manual screening**: A WHO staff member reviews articles, discards duplicates and irrelevant items
3. **Signal identification**: Articles indicating public health risks become "signals"
4. **Data enrichment**: Analysts manually collect epidemiological data from reporting countries
5. **Risk assessment**: Each signal evaluated against standardized criteria
6. **Report compilation**: Signals compiled into daily media screening reports
7. **Dissemination**: Reports shared with national health authorities via IHR channels

**Scale**: During the Tokyo Olympics (81 days), 103,830 articles appeared on EIOS. Only 587 (0.6%) qualified as signals requiring formal assessment. PAHO screens over 2 million pieces of information annually, detecting ~1,418 potential signals per year (monthly average of 118).

### 1.2 The Event Information Site (EIS)

The EIS is a **closed WHO platform** accessible only to:
- National IHR Focal Points (NFPs)
- Authorized WHO staff
- Selected international organizations

**EIS postings contain**:
- Assessment against four IHR Annex 2 criteria (unexpected/unusual, serious public health impact, international spread risk, trade/travel restriction risk)
- Short public health event description
- WHO risk assessment summary
- Response section
- WHO advice to Member States

This confidential channel enables Member States to prepare response efforts with verified information **before public disclosure**. This is a critical distinction -- public-facing Disease Outbreak News (DONs) come later.

### 1.3 EIOS Platform Capabilities

EIOS is the world's leading open-source intelligence platform for public health. Built on WHO-European Commission JRC collaboration.

**Core technical features**:
- NLP and ML for early detection from open-source information
- All-hazards, One Health approach
- Near real-time processing
- Multi-language interface translations
- Semantic search (context and intended meaning, not just keywords)
- Speech-to-text for radio communications (EIOS 2.0)
- Integration with ProMED, HealthMap, and GPHIN

**Connected systems**: ProMED, HealthMap, GPHIN (Global Public Health Intelligence Network)

**Three pillars**: Global community of practice, multi-disciplinary collaborators, evolving fit-for-purpose system

### 1.4 Signal vs. Event vs. Acute Public Health Event

| Term | Definition |
|------|-----------|
| **Signal** | Potential indication of unusual event (elevated morbidity/mortality, unexpected case clusters, disease re-emergence) meeting detection criteria |
| **Event** | Signal verified and confirmed, typically via NFP response under IHR (2005) |
| **Acute Public Health Event** | Event potentially constituting a PHEIC requiring formal notification |

**This terminology hierarchy is critical for any tool in this space.** SENTINEL's current model uses "HealthEvent" broadly -- it should distinguish between unverified signals and confirmed events.

### 1.5 Signal Triage Process

Triage involves:
- **Triangulating** information with contemporaneous reports
- **Reviewing** against historical trends and contextual factors
- **Contextualizing** the situation (geography, health system capacity, season)
- **Consulting** subject-matter and disease experts

Triage outcomes:
1. **Discarded** as irrelevant
2. **Retained for monitoring** (1-2 weeks close watch)
3. **Designated as true signal** warranting formal verification

Verification methods:
- Formal requests to National IHR Focal Points
- Requests to WHO regional/country offices
- Coordination with UN agencies and technical networks

### 1.6 WHO Pandemic Hub (Berlin)

Established 2021 with EUR 90M German funding. Hosts EIOS 2.0 and coordinates:
- **International Pathogen Surveillance Network (IPSN)**: 350 partners in 100 countries
- **The Collaboratory**: 1,200+ analysts and data scientists from 100+ institutions in 60+ countries
- Catalytic grants for pathogen genomics in LMICs

---

## 2. Event-Based Surveillance (EBS) vs. Indicator-Based Surveillance (IBS)

This distinction is fundamental to epidemic intelligence and SENTINEL must understand it deeply.

### 2.1 Indicator-Based Surveillance (IBS)

- **Data**: Structured, pre-determined indicators (case counts, lab results, mortality rates)
- **Sources**: Clinical records from hospitals, laboratories, community health systems
- **Scope**: Known diseases with established case definitions
- **Strength**: Long-term trend monitoring, detailed epidemiological data
- **Weakness**: Slow (lab confirmation required before reporting), limited to known diseases
- **Example**: Swiss Sentinella system, mandatory reporting of notifiable diseases

### 2.2 Event-Based Surveillance (EBS)

- **Data**: Unstructured, diverse, often preliminary and unverified
- **Sources**: News media, social media, government websites, blogs, informal reports, radio
- **Scope**: All-hazards including unknown, emerging, re-emerging diseases + CBRN events
- **Strength**: Faster detection, covers gaps where health infrastructure is weak
- **Weakness**: High false positive rate, requires human verification
- **Example**: EIOS, ProMED, GPHIN, HealthMap

### 2.3 Why Both Are Needed

A complete surveillance system requires both. IBS provides the backbone of structured disease monitoring. EBS catches the signals that IBS misses -- especially for:
- Novel pathogens with no case definition yet
- Events in regions with weak health reporting infrastructure
- Rapidly evolving situations where official data lags

**SENTINEL implication**: SENTINEL currently functions primarily as an EBS aggregator. It should clearly position itself as complementary to IBS systems (Swiss mandatory reporting, Sentinella), not a replacement. The design should acknowledge that analysts will be cross-referencing SENTINEL signals with their IBS data.

---

## 3. ECDC Threat Assessment

### 3.1 Rapid Risk Assessment (RRA) Methodology

ECDC's RRA is a structured five-stage process for the initial phase of an event:

**Five Stages**:
1. Event identification and characterization
2. Hazard assessment
3. Exposure assessment
4. Context assessment
5. Risk characterization (combining all above)

**Risk is assessed on two dimensions**:
- **Likelihood (probability)**: Probability of infection/exposure in the population of interest
- **Impact (consequences)**: Severity of disease outcomes if/when infection occurs

Each dimension scored on a scale (typically: Very Low / Low / Moderate / High / Very High), producing a risk matrix.

**Scoring factors for likelihood**:
- Pathogen infectiousness and transmissibility
- Population immunity levels
- Current prevalence/incidence
- Response capacity and control measures in place

**Scoring factors for impact**:
- Disease severity (CFR, hospitalization rate)
- Population vulnerability
- Available medical countermeasures
- Potential societal disruption

**Confidence levels** (Low / Moderate / High) accompany each assessment based on evidence quality.

### 3.2 Communicable Disease Threats Report (CDTR)

Published **weekly**, the CDTR is the primary output of ECDC's epidemic intelligence activities.

**Structure** (based on Week 49, 2025):
- Organized by individual disease threat
- Each disease section contains: epidemiological update, risk assessment, ECDC guidance
- Supplementary materials: maps and epidemiological graphs (separate ZIP file)

**Typical diseases covered** in a single weekly issue:
- Respiratory virus epidemiology (EU/EEA)
- Chikungunya, West Nile virus, dengue
- Marburg virus disease
- Influenza A(H5N2) and other novel influenza
- HIV/AIDS surveillance updates
- Ebola, MERS
- Shigellosis, measles, mpox
- Any emerging threat of the week

**Audience**: Epidemiologists and health professionals across EU/EEA Member States

**SENTINEL implication**: The CDTR is what SENTINEL's daily reports should aspire to structurally -- disease-organized, with clear risk assessments per threat and supplementary visualizations. SENTINEL's daily brief should follow a similar format but be Switzerland-focused and more concise.

---

## 4. ProMED/ISID

### 4.1 Why ProMED Matters

ProMED is described as "the only human-curated, event-based surveillance system in operation globally." Its value vs. official WHO channels:

**Speed**: More than 60% of initial outbreak reports reaching WHO come from informal sources, including ProMED. ProMED was first to alert the world to:
- SARS (2003)
- Chikungunya reemergence (2005)
- MERS (2012)

**Completeness**: When combined with ECDC sources, ProMED reported "95% of all threats in a timely manner."

**Independence**: ProMED operates as an independent network where frontline healthcare providers can report firsthand observations that bypass slow official reporting chains.

**Expert curation**: Unlike purely automated systems, reports are vetted by subject matter experts who add context, commentary, and cross-references before publication.

### 4.2 How Epidemiologists Use ProMED

- **Early warning**: First source to flag unusual clusters or novel presentations
- **Gap filling**: Covers events in countries that underreport through official IHR channels
- **Expert commentary**: Moderator notes provide context that raw data doesn't
- **Community intelligence**: Global network of clinicians reporting firsthand observations
- **Historical context**: Archive enables comparison with past outbreak patterns

### 4.3 ProMED's Crisis and EIOS Integration

ProMED faced existential funding challenges (documented in Science, 2023). Its data feeds are now integrated into EIOS, but the human curation layer remains uniquely valuable.

**SENTINEL implication**: SENTINEL correctly identifies ProMED as a priority data source. The design should preserve and surface ProMED's expert commentary rather than stripping it during normalization -- this expert analysis is a key differentiator from automated feeds.

---

## 5. Swiss Federal Coordination (BAG/FOPH + BLV/FSVO)

### 5.1 One Health Governance Structure

Switzerland established its One Health interdisciplinary platform in 2017. The **Subsidiary body "One Health"** is led by FSVO/BLV and coordinates:
- Federal Office of Public Health (FOPH/BAG) -- human health
- Federal Food Safety and Veterinary Office (FSVO/BLV) -- animal health, food safety
- Federal Office for Agriculture (FOAG) -- agricultural health
- Federal Office for the Environment (FOEN) -- environmental health

Contact: onehealth@blv.admin.ch

### 5.2 Swiss Surveillance Infrastructure

**Mandatory Reporting System**: The core of IBS in Switzerland. Clinicians and labs must report notifiable diseases to cantonal medical officers, who relay to FOPH. The Infectious Diseases Dashboard (IDD) publishes updates every Wednesday.

**Sentinella System** (since 1986): A voluntary sentinel GP network co-managed with FOPH. Monitors communicable diseases and antibiotic use. Supplements mandatory reporting with primary care data.

**Wastewater Monitoring**: Added post-COVID for pathogen detection (SARS-CoV-2, influenza, RSV).

**Swiss Pathogen Surveillance Platform (SPSP)**: Nation-wide One Health genomics platform connecting human and veterinary labs, cantonal physicians, FOPH, and FSVO for integrated pathogen surveillance.

### 5.3 Key Coordination Areas

- **Antimicrobial resistance (AMR)**: Joint strategy across all four federal offices
- **Zoonosis monitoring**: Animals, humans, and food
- **Vector surveillance**: Tiger mosquito tracking, tick-borne disease monitoring
- **Imported disease risk**: Dengue, chikungunya, Zika, West Nile fever

### 5.4 Global Health Security Index Assessment

Switzerland is assessed as having:
- Established reporting obligation as the key systemic element
- Multi-system monitoring integration
- Early detection capabilities via sentinel and mandatory systems
- IHR National Focal Point compliance

**SENTINEL implication**: SENTINEL's multi-agency model (BLV/BAG/JOINT views) is well-aligned with the real Swiss structure. The design correctly identifies that BLV focuses on animal/zoonotic threats while BAG handles human health. The JOINT view for cross-cutting One Health issues (AMR, zoonoses, vectors) maps directly to how the subsidiary One Health body operates. However, SENTINEL should also consider FOAG and FOEN as potential stakeholders -- the real One Health body includes all four offices.

---

## 6. IHR (2005) Requirements

### 6.1 Core Obligations

The International Health Regulations (2005) require countries to:
- Detect and report potential events constituting a PHEIC
- Assess international public health threat within **48 hours**
- Maintain core surveillance and response capacities
- Designate a National IHR Focal Point (NFP) for 24/7 communication with WHO

### 6.2 Decision Instrument (Annex 2)

A structured decision tree to determine if an event requires notification to WHO. Evaluates:
- Is the event unusual or unexpected?
- Is there serious public health impact?
- Is there significant risk of international spread?
- Is there significant risk of trade/travel restrictions?

**Mandatory notification diseases** (always notify): Smallpox, polio (wild-type), new influenza subtypes, SARS

**Decision-tree diseases** (notify if criteria met): Cholera, plague, yellow fever, viral hemorrhagic fevers, West Nile fever, and any event of potential international concern

**SENTINEL implication**: SENTINEL's risk scoring should explicitly map to IHR Annex 2 criteria. The four questions in the decision instrument should be visible in SENTINEL's risk assessment output, as this is the framework Swiss NFPs actually use to decide whether to escalate.

---

## 7. Emergency Operations Center Workflow

### 7.1 What Information Is Needed FIRST

When a PHEOC activates, the **Director's Critical Information Requirements** drive immediate priorities:
- Serious illness or injury in deployed staff
- Identification of new routes of transmission
- Unexpected infectious disease cases or clusters
- New geographic spread
- Major genetic sequencing changes

Initial questions focus on: **What is happening? Who is affected? Where? How fast is it spreading?**

### 7.2 Activation Levels

EOCs use tiered activation (typically Level 3 to Level 1):
- **Level 3**: Monitoring/watch mode -- routine screening
- **Level 2**: Partial activation -- specific threat requiring coordination
- **Level 1**: Full activation -- major emergency requiring all resources

Example: 2016 Zika response escalated from Level 3 to Level 1 within one week.

### 7.3 Incident Management Structure

- **Incident Manager** with Deputies
- **Scientific Response Section**: Epidemiology, laboratory, vaccine, medical care, modeling task forces
- **General Staff**: Planning, logistics, operations, communications
- **Joint Information Center**: Media and public messaging

### 7.4 Information Flow

- Regular situational awareness meetings
- Upward reporting through state/national leadership
- Parallel coordination with international partners
- Data custody and release authority established before deployment

**SENTINEL implication**: SENTINEL's "Command Center" view should be designed to answer the FIRST questions in a crisis -- what, where, who, how fast. The current design has this partially right with KPI cards and priority events, but should prioritize "what changed since yesterday" over static state. The Situation model's status progression (ACTIVE -> WATCH -> ESCALATED -> RESOLVED) maps well to EOC activation levels.

---

## 8. What Existing Tools Get Wrong (Identified Gaps)

### 8.1 Information Overload

The single biggest pain point across all systems. Analysts must manually screen thousands of articles daily, with "levels of duplicative information and noise being very high." Current tools produce too many undifferentiated alerts.

### 8.2 Geographic Bias

OSINT tools have a "clear bias towards countries with higher numbers of media outlets and greater availability of electronic communication infrastructure." Regions with the greatest disease burden often have the least media coverage -- creating blind spots exactly where detection matters most.

### 8.3 Language and Accessibility Barriers

Many early signals appear only in "local television and radio broadcasts or recorded in local print media in local or regional languages" -- especially in high-risk regions.

### 8.4 Limited Automation with Manual Overload

A European survey found:
- Less than half (47%) of agencies had dedicated epidemic intelligence teams
- Only 56% had Standard Operating Procedures
- Most collection, analysis, and interpretation performed manually (25-71% depending on disease)
- Only one respondent reported fully automatic processing for any disease

### 8.5 Weak One Health Integration

Cross-sectoral collaboration was "not the rule" -- only 29-75% of agencies collaborated across sectors depending on the disease. Most collaboration limited to sharing results rather than collaborative surveillance design.

### 8.6 Verification Bottleneck

Verification is "time and resource intensive" -- requiring expert assessment, formal communications with authorities, and laboratory testing. The gap between detecting a signal and confirming it as an event is where response time is lost.

### 8.7 What Practitioners Actually Want

From user needs research:
- Tools that **accelerate specific workflow steps** rather than replace the analyst
- **Semi-automation** that allows flexibility while remaining analytical
- Better **signal-to-noise filtering** before information reaches human reviewers
- Contextual information delivered alongside signals (not requiring separate lookup)
- Integration across data sources in a single view

---

## 9. SENTINEL Gap Analysis: What the Design Gets Right and What It Misses

### Gets Right

1. **Multi-source aggregation**: Correct sources identified (WHO DON, EIOS, ProMED, ECDC, WOAH)
2. **Multi-agency views**: BLV/BAG/JOINT model matches real Swiss One Health governance
3. **Risk scoring**: Hybrid rule-engine + LLM approach is appropriate
4. **Swiss relevance factors**: Border countries, trade routes, vector habitats, travel volume -- all real considerations
5. **Situation threading**: Grouping related events into situations mirrors real EOC practice
6. **Annotation workflow**: Status progression (NEW -> MONITORING -> ESCALATED -> RESOLVED) maps to real triage outcomes
7. **Export for different audiences**: PDF briefs for leadership, CSV for epidemiologists, structured JSON for systems
8. **One Health tags**: Zoonotic, vector-borne, foodborne, AMR categorization is correct

### Needs Attention

1. **Signal vs. Event distinction**: The HealthEvent model conflates unverified signals with confirmed events. WHO's workflow has a clear hierarchy: signal -> event -> acute public health event. SENTINEL should model this explicitly.

2. **IHR Annex 2 mapping**: Risk assessments should explicitly evaluate the four IHR decision instrument questions (unusual? serious impact? international spread? trade/travel restrictions?) since this is the actual framework Swiss NFPs use.

3. **"What changed" over "what exists"**: The first thing analysts need each morning is not a list of all events, but what is new, what escalated, and what changed overnight. The daily brief should lead with deltas.

4. **Verification status tracking**: There is no explicit field for verification status on events. In real workflows, the journey from "unverified media report" to "confirmed by national authority" is critical metadata.

5. **Source credibility weighting**: The design mentions source authority in scoring but the data model lacks explicit source confidence fields. An ECDC threat assessment carries fundamentally different weight than a social media post.

6. **Expert commentary preservation**: ProMED's value is in expert commentary, not just raw data. The normalization pipeline should preserve moderator notes and expert annotations from source material.

7. **ECDC CDTR format alignment**: Daily reports should follow a disease-organized structure (like the CDTR) rather than a flat chronological list, since this is how public health professionals consume threat intelligence.

8. **Missing stakeholders**: The real Swiss One Health body includes FOAG (agriculture) and FOEN (environment). SENTINEL's organization model only covers BLV and BAG.

9. **Confidence/uncertainty indicators**: CDC and ECDC both attach confidence levels to risk assessments. SENTINEL's risk_score lacks an associated confidence measure.

10. **Historical baseline comparison**: Practitioners assess signals against historical trends. SENTINEL should surface "this is unusual because..." context automatically, comparing current signals against baseline expectations.

11. **Cross-border coordination support**: 29% or fewer agencies coordinate with neighbors. SENTINEL could add value by surfacing events in border countries (DE, FR, IT, AT, LI) with explicit cross-border impact analysis.

12. **Temporal urgency indicators**: Not all high-risk events need the same response speed. The model should distinguish between "high risk, slow burn" (e.g., AMR trends) and "moderate risk, rapidly evolving" (e.g., novel cluster).

---

## 10. Key Professional Workflow: A Day in the Life

Based on the research, here is what an epidemic intelligence analyst at BAG or BLV actually does:

**07:30 - Morning scan**
- Check overnight alerts from EIOS, ProMED email, WHO EIS notifications
- Scan ECDC CDTR if it is publication day (weekly)
- Review WOAH WAHIS for new animal disease notifications

**08:00 - Signal triage**
- Filter noise from genuine signals
- Cross-reference signals against Swiss mandatory reporting data (IBS)
- Check if signals relate to existing monitored situations
- Prioritize by Swiss relevance (border countries, trade partners, vectors)

**09:00 - Verification and assessment**
- For true signals: contact relevant cantonal offices, check lab data
- For international signals: check WHO EIS, contact IHR NFP network
- Apply IHR Annex 2 decision instrument for potentially notifiable events
- Assess One Health implications (does an animal health event have human spillover risk?)

**10:00 - Internal coordination**
- Brief leadership on overnight developments
- Coordinate with BLV/BAG counterparts on One Health issues
- Update situation tracking for active monitoring items

**11:00 - Report production**
- Draft or update situation summaries
- Prepare contributions to weekly reports
- Update the dashboard/tracking system

**Afternoon - Deeper analysis, meetings, response coordination**
- Participate in ECDC/WHO coordination calls as needed
- Contribute to risk assessments for escalated situations
- Prepare briefing materials for inter-agency meetings

**SENTINEL should support every step of this workflow**, from the morning scan through to report production. The design largely does, but the morning scan experience (what changed overnight) and the verification tracking are the weakest links.

---

## Sources

- [WHO EIOS Initiative](https://www.who.int/initiatives/eios)
- [PAHO Epidemic Intelligence](https://www.paho.org/en/topics/epidemic-intelligence)
- [EIOS for Tokyo 2020 Olympics (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9831600/)
- [WHO Global PHI Operational Practices (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10511126/)
- [ECDC Rapid Risk Assessment Methodology](https://www.ecdc.europa.eu/en/publications-data/operational-guidance-rapid-risk-assessment-methodology)
- [ECDC Operational Tool for RRA (2019 PDF)](https://www.ecdc.europa.eu/sites/default/files/documents/operational-tool-rapid-risk-assessment-methodolgy-ecdc-2019.pdf)
- [ECDC Weekly CDTR Reports](https://www.ecdc.europa.eu/en/publications-and-data/monitoring/weekly-threats-reports)
- [CDC Risk Assessment Methods](https://www.cdc.gov/cfa-qualitative-assessments/php/about/risk-assessment-methods.html)
- [CDC Emergency Operations Centers Manual](https://www.cdc.gov/field-epi-manual/php/chapters/eoc-incident-management.html)
- [Event-Based Surveillance for Communicable Diseases (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10712973/)
- [Epidemic Intelligence Activities Across Europe (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10401758/)
- [Epidemic Intelligence Trinity: Detection, Risk Assessment, Early Warning (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11190998/)
- [WHO Pandemic Hub Berlin](https://pandemichub.who.int/)
- [ProMED - Human-Curated Intelligence](https://touchinfectiousdiseases.com/insight/promed-outbreak-detection-human-curated-intelligence/)
- [ProMED Wikipedia](https://en.wikipedia.org/wiki/ProMED-mail)
- [ProMED Funding Crisis (Science)](https://www.science.org/content/article/long-running-promed-email-service-alerting-world-disease-outbreaks-trouble)
- [Swiss BLV One Health](https://www.blv.admin.ch/blv/en/home/das-blv/auftrag/one-health.html)
- [Swiss Pathogen Surveillance Platform (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10272868/)
- [Swiss FOPH Infectious Diseases Dashboard](https://www.idd.bag.admin.ch/survey-systems/sentinella)
- [IHR 2005 Overview (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7138023/)
- [Global Surveillance Systems Review (Premier Science)](https://premierscience.com/pjds-25-991/)
- [WHO EIOS 2.0 AI Capabilities (Borgen Project)](https://borgenproject.org/eios/)
- [EIOS Strategy 2024-2026](https://www.who.int/publications/i/item/B09476)
- [WHO Hub Four-Year Anniversary](https://pandemichub.who.int/news-room/news/02-09-2025-four-years-of-the-who-hub-for-pandemic-and-epidemic-intelligence)
