"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "en" | "de" | "fr" | "it";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};

// Flat key→string dictionary per locale
type Dict = Record<string, string>;

/* -------------------------------------------------------------------------- */
/*  English (canonical)                                                       */
/* -------------------------------------------------------------------------- */
const en: Dict = {
  // Navigation
  "nav.commandCenter": "Command Center",
  "nav.globalMap": "Global Map",
  "nav.triageQueue": "Triage Queue",
  "nav.situations": "Situations",
  "nav.analytics": "Analytics",
  "nav.watchlists": "Watchlists",
  "nav.exports": "Exports",

  // Sidebar
  "sidebar.lastCollection": "Last collection",
  "sidebar.events": "Events",
  "sidebar.expandSidebar": "Expand sidebar",
  "sidebar.collapseSidebar": "Collapse sidebar",
  "sidebar.openNav": "Open navigation",

  // Theme
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",

  // Loading
  "loading.intelligence": "Loading intelligence data",
  "loading.triage": "Loading triage queue",
  "loading.situations": "Loading situations",
  "loading.analytics": "Loading analytics",
  "loading.map": "Loading threat data",
  "loading.watchlists": "Loading watchlists",
  "loading.exports": "Loading export data",

  // Command Center
  "cc.subtitle": "Global threat landscape",
  "cc.pipeline": "Pipeline active — Collecting 06:00, 14:00 & 22:00 UTC",
  "cc.newEvents24h": "New Events (24h)",
  "cc.activeSituations": "Active Situations",
  "cc.criticalAlerts": "Critical Alerts",
  "cc.swissRelevant": "Swiss-Relevant",
  "cc.whatChanged": "What Changed",
  "cc.vs": "vs.",
  "cc.newEvents": "New Events",
  "cc.elevatedSignals": "Elevated Signals",
  "cc.noElevated": "No elevated signals",
  "cc.newThisPeriod": "New This Period",
  "cc.diseases": "Diseases",
  "cc.countries": "Countries",
  "cc.noNewDiseaseCountry": "No new diseases or countries",
  "cc.noActiveSituations": "No active situations",
  "cc.activeThreats": "Active Threats — by Disease",
  "cc.fullTriage": "Full Triage",
  "cc.dataSources": "Data Sources",
  "cc.totalEventsFrom": "total events from",
  "cc.sources": "sources",
  "cc.last": "Last",

  // Metrics
  "metric.events": "events",
  "metric.cases": "cases",
  "metric.deaths": "deaths",
  "metric.confirmed": "Confirmed",

  // Risk categories
  "risk.critical": "Critical",
  "risk.high": "High",
  "risk.medium": "Medium",
  "risk.low": "Low",

  // Verification
  "verification.unverified": "Unverified",
  "verification.pending": "Pending",
  "verification.confirmed": "Confirmed",
  "verification.refuted": "Refuted",

  // Priority
  "priority.immediate": "Immediate",
  "priority.high": "High",
  "priority.medium": "Medium",
  "priority.watch": "Watch",

  // Triage
  "triage.title": "Triage Queue",
  "triage.subtitle": "events sorted by Swiss relevance",
  "triage.source": "Source",
  "triage.disease": "Disease",
  "triage.riskLevel": "Risk Level",
  "triage.country": "Country",
  "triage.verification": "Verification",
  "triage.noMatch": "No events match the current filters.",

  // Situations
  "situations.title": "Situations",
  "situations.subtitle": "Active threat situation tracking and management",
  "situations.count": "situations",

  // Analytics
  "analytics.title": "Analytics",
  "analytics.subtitle": "intelligence analysis",
  "analytics.totalEvents": "total events",
  "analytics.diseaseTrends": "Disease Trends",
  "analytics.diseaseTrendsDesc": "Events per day by disease",
  "analytics.sourceComparison": "Source Comparison",
  "analytics.sourceComparisonDesc": "Events per intelligence source",
  "analytics.riskTimeline": "Risk Timeline",
  "analytics.riskTimelineDesc": "Average risk score and Swiss relevance per day",
  "analytics.diseaseBreakdown": "Disease Breakdown",
  "analytics.diseaseBreakdownDesc": "Total events per disease",

  // Map
  "map.title": "Global Threat Map",
  "map.subtitle": "Geographic distribution of health events",
  "map.allDates": "All dates",

  // Watchlists
  "watchlists.title": "Watchlists",
  "watchlists.subtitle": "Custom event filters and monitoring criteria",
  "watchlists.create": "Create Watchlist",
  "watchlists.cancel": "Cancel",
  "watchlists.new": "New Watchlist",
  "watchlists.name": "Name",
  "watchlists.diseases": "Diseases",
  "watchlists.countries": "Countries",
  "watchlists.minRisk": "Min Risk Score",
  "watchlists.oneHealthTags": "One Health Tags",
  "watchlists.namePlaceholder": "Watchlist name...",

  // Exports
  "exports.title": "Exports",
  "exports.subtitle": "Export event data, situations, and reports",

  // Event Card
  "eventCard.chRelevance": "CH Relevance",
  "eventCard.analystOverride": "Analyst Override",

  // Event Detail
  "detail.verification": "Verification",
  "detail.ihrAssessment": "IHR Annex 2 Assessment",
  "detail.playbook": "Decision Playbook",
  "detail.provenance": "Source Provenance",
  "detail.summary": "Summary",
  "detail.analysis": "LLM Analysis",
  "detail.overrides": "Analyst Overrides",
  "detail.triageActions": "Triage Actions",
  "detail.analystNote": "Analyst Note",
  "detail.ihr.unusual": "Unusual / unexpected",
  "detail.ihr.seriousImpact": "Serious public health impact",
  "detail.ihr.internationalSpread": "International spread risk",
  "detail.ihr.tradeTravelRisk": "Trade / travel restriction risk",
  "detail.hazard": "Hazard",
  "detail.sla": "SLA",
  "detail.escalation": "Escalation",
  "detail.viewSource": "View Source",
  "detail.monitor": "Monitor",
  "detail.escalate": "Escalate",
  "detail.dismiss": "Dismiss",
  "detail.status": "Status",
  "detail.addAnnotation": "Add annotation...",
  "detail.save": "Save",
  "detail.saved": "Saved",
  "detail.overridesApplied": "analyst override(s) applied to this event.",
  "detail.sourceNodes": "source nodes",
  "detail.mergedFrom": "merged from",
  "detail.eventIds": "event IDs",

  // WHO Regions
  "region.EURO": "Europe",
  "region.SEARO": "Southeast Asia",
  "region.AFRO": "Africa",
  "region.AMRO": "Americas",
  "region.EMRO": "Middle East",
  "region.WPRO": "Western Pacific",

  // Sources (long names)
  "source.WHO_DON": "WHO Disease Outbreak News",
  "source.WHO_EIOS": "WHO EIOS",
  "source.PROMED": "ProMED",
  "source.ECDC": "European CDC",
  "source.WOAH": "World Organisation for Animal Health",
  "source.BEACON": "Beacon (HealthMap)",
  "source.CIDRAP": "CIDRAP",
  "source.WHO_DON.desc": "Official WHO disease outbreak reports via the WHO public API",
  "source.WHO_EIOS.desc": "WHO Epidemic Intelligence from Open Sources — NLP-driven media surveillance",
  "source.PROMED.desc": "Human-curated event-based surveillance from the International Society for Infectious Diseases",
  "source.ECDC.desc": "ECDC communicable disease threats reports and rapid risk assessments",
  "source.WOAH.desc": "Official animal disease notifications via WAHIS",
  "source.BEACON.desc": "Automated real-time disease outbreak intelligence and alerts",
  "source.CIDRAP.desc": "Center for Infectious Disease Research and Policy — expert news and analysis",

  // Welcome overlay
  "welcome.acronym": "Swiss Epidemic Notification and Threat Intelligence Engine",
  "welcome.intro": "Real-time epidemic intelligence platform for Swiss public health authorities. SENTINEL aggregates global disease outbreak data, scores threats by Swiss relevance, and supports IHR-compliant notification workflows.",
  "welcome.stat1": "12 data sources",
  "welcome.stat2": "3x daily collection",
  "welcome.stat3": "4 official languages",
  "welcome.capabilities": "Core Capabilities",
  "welcome.f1.title": "Global Surveillance",
  "welcome.f1.desc": "WHO, ECDC, WOAH, ProMED, and 8 more sources — unified and deduplicated.",
  "welcome.f2.title": "Smart Triage",
  "welcome.f2.desc": "AI-powered risk scoring with Swiss relevance weighting and One Health tagging.",
  "welcome.f3.title": "Situation Tracking",
  "welcome.f3.desc": "Group related events into situations with timeline, annotations, and escalation.",
  "welcome.f4.title": "Alert Engine",
  "welcome.f4.desc": "Custom rules with real-time WebSocket push. Never miss a critical signal.",
  "welcome.f5.title": "IHR Compliance",
  "welcome.f5.desc": "Annex 2 assessment wizard with 24h deadline tracking for WHO notification.",
  "welcome.f6.title": "Analytics & Export",
  "welcome.f6.desc": "Trends, risk timelines, disease breakdowns. Export CSV/JSON for reporting.",
  "welcome.swiss.title": "Built for Swiss Public Health",
  "welcome.swiss.desc": "Designed for the Swiss Federal Office of Public Health (BAG) and the Federal Food Safety and Veterinary Office (BLV) with full support for the Swiss legal and organizational framework.",
  "welcome.swiss.bag": "BAG",
  "welcome.swiss.bagDesc": "Human health surveillance",
  "welcome.swiss.blv": "BLV",
  "welcome.swiss.blvDesc": "Animal & food safety",
  "welcome.swiss.ihr": "IHR / EpG",
  "welcome.swiss.ihrDesc": "Legal compliance",
  "welcome.skip": "Skip",
  "welcome.next": "Next",
  "welcome.start": "Get Started",
};

/* -------------------------------------------------------------------------- */
/*  German                                                                    */
/* -------------------------------------------------------------------------- */
const de: Dict = {
  "nav.commandCenter": "Lagezentrum",
  "nav.globalMap": "Weltkarte",
  "nav.triageQueue": "Triage-Warteschlange",
  "nav.situations": "Situationen",
  "nav.analytics": "Analysen",
  "nav.watchlists": "Überwachungslisten",
  "nav.exports": "Exporte",

  "sidebar.lastCollection": "Letzte Erhebung",
  "sidebar.events": "Ereignisse",
  "sidebar.expandSidebar": "Seitenleiste einblenden",
  "sidebar.collapseSidebar": "Seitenleiste ausblenden",
  "sidebar.openNav": "Navigation öffnen",

  "theme.system": "System",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",

  "loading.intelligence": "Nachrichtenlage wird geladen",
  "loading.triage": "Triage-Warteschlange wird geladen",
  "loading.situations": "Situationen werden geladen",
  "loading.analytics": "Analysen werden geladen",
  "loading.map": "Bedrohungsdaten werden geladen",
  "loading.watchlists": "Überwachungslisten werden geladen",
  "loading.exports": "Exportdaten werden geladen",

  "cc.subtitle": "Globale Bedrohungslage",
  "cc.pipeline": "Pipeline aktiv — Erhebung 06:00, 14:00 & 22:00 UTC",
  "cc.newEvents24h": "Neue Ereignisse (24 Std.)",
  "cc.activeSituations": "Aktive Situationen",
  "cc.criticalAlerts": "Kritische Meldungen",
  "cc.swissRelevant": "CH-relevant",
  "cc.whatChanged": "Lageänderungen",
  "cc.vs": "ggü.",
  "cc.newEvents": "Neue Ereignisse",
  "cc.elevatedSignals": "Erhöhte Signale",
  "cc.noElevated": "Keine erhöhten Signale",
  "cc.newThisPeriod": "Neu in diesem Zeitraum",
  "cc.diseases": "Krankheiten",
  "cc.countries": "Länder",
  "cc.noNewDiseaseCountry": "Keine neuen Krankheiten oder Länder",
  "cc.noActiveSituations": "Keine aktiven Situationen",
  "cc.activeThreats": "Aktive Bedrohungen — nach Krankheit",
  "cc.fullTriage": "Vollständige Triage",
  "cc.dataSources": "Datenquellen",
  "cc.totalEventsFrom": "Ereignisse total aus",
  "cc.sources": "Quellen",
  "cc.last": "Zuletzt",

  "metric.events": "Ereignisse",
  "metric.cases": "Fälle",
  "metric.deaths": "Todesfälle",
  "metric.confirmed": "Bestätigt",

  "risk.critical": "Kritisch",
  "risk.high": "Hoch",
  "risk.medium": "Mittel",
  "risk.low": "Niedrig",

  "verification.unverified": "Unbestätigt",
  "verification.pending": "Ausstehend",
  "verification.confirmed": "Bestätigt",
  "verification.refuted": "Widerlegt",

  "priority.immediate": "Sofort",
  "priority.high": "Hoch",
  "priority.medium": "Mittel",
  "priority.watch": "Beobachtung",

  "triage.title": "Triage-Warteschlange",
  "triage.subtitle": "Ereignisse sortiert nach CH-Relevanz",
  "triage.source": "Quelle",
  "triage.disease": "Krankheit",
  "triage.riskLevel": "Risikostufe",
  "triage.country": "Land",
  "triage.verification": "Verifizierung",
  "triage.noMatch": "Keine Ereignisse entsprechen den aktuellen Filtern.",

  "situations.title": "Situationen",
  "situations.subtitle": "Aktive Bedrohungslagen — Verfolgung und Management",
  "situations.count": "Situationen",

  "analytics.title": "Analysen",
  "analytics.subtitle": "Nachrichtendienstliche Auswertung",
  "analytics.totalEvents": "Ereignisse total",
  "analytics.diseaseTrends": "Krankheitstrends",
  "analytics.diseaseTrendsDesc": "Ereignisse pro Tag nach Krankheit",
  "analytics.sourceComparison": "Quellenvergleich",
  "analytics.sourceComparisonDesc": "Ereignisse pro Nachrichtenquelle",
  "analytics.riskTimeline": "Risikoverlauf",
  "analytics.riskTimelineDesc": "Durchschnittlicher Risiko-Score und CH-Relevanz pro Tag",
  "analytics.diseaseBreakdown": "Krankheitsverteilung",
  "analytics.diseaseBreakdownDesc": "Ereignisse total pro Krankheit",

  "map.title": "Globale Bedrohungskarte",
  "map.subtitle": "Geografische Verteilung der Gesundheitsereignisse",
  "map.allDates": "Alle Daten",

  "watchlists.title": "Überwachungslisten",
  "watchlists.subtitle": "Individuelle Ereignisfilter und Überwachungskriterien",
  "watchlists.create": "Liste erstellen",
  "watchlists.cancel": "Abbrechen",
  "watchlists.new": "Neue Überwachungsliste",
  "watchlists.name": "Name",
  "watchlists.diseases": "Krankheiten",
  "watchlists.countries": "Länder",
  "watchlists.minRisk": "Mindest-Risikoscore",
  "watchlists.oneHealthTags": "One-Health-Tags",
  "watchlists.namePlaceholder": "Name der Liste…",

  "exports.title": "Exporte",
  "exports.subtitle": "Ereignisdaten, Situationen und Berichte exportieren",

  "eventCard.chRelevance": "CH-Relevanz",
  "eventCard.analystOverride": "Analysten-Override",

  "detail.verification": "Verifizierung",
  "detail.ihrAssessment": "IGV Anhang 2 — Bewertung",
  "detail.playbook": "Entscheidungs-Playbook",
  "detail.provenance": "Quellennachverfolgung",
  "detail.summary": "Zusammenfassung",
  "detail.analysis": "LLM-Analyse",
  "detail.overrides": "Analysten-Overrides",
  "detail.triageActions": "Triage-Massnahmen",
  "detail.analystNote": "Analysten-Notiz",
  "detail.ihr.unusual": "Ungewöhnlich / unerwartet",
  "detail.ihr.seriousImpact": "Schwerwiegende Auswirkungen auf die öffentliche Gesundheit",
  "detail.ihr.internationalSpread": "Risiko der internationalen Ausbreitung",
  "detail.ihr.tradeTravelRisk": "Risiko von Handels-/Reisebeschränkungen",
  "detail.hazard": "Gefahrenklasse",
  "detail.sla": "SLA",
  "detail.escalation": "Eskalation",
  "detail.viewSource": "Quelle anzeigen",
  "detail.monitor": "Überwachen",
  "detail.escalate": "Eskalieren",
  "detail.dismiss": "Verwerfen",
  "detail.status": "Status",
  "detail.addAnnotation": "Anmerkung hinzufügen…",
  "detail.save": "Speichern",
  "detail.saved": "Gespeichert",
  "detail.overridesApplied": "Analysten-Override(s) auf dieses Ereignis angewendet.",
  "detail.sourceNodes": "Quellknoten",
  "detail.mergedFrom": "zusammengeführt aus",
  "detail.eventIds": "Ereignis-IDs",

  "region.EURO": "Europa",
  "region.SEARO": "Südostasien",
  "region.AFRO": "Afrika",
  "region.AMRO": "Amerika",
  "region.EMRO": "Naher Osten",
  "region.WPRO": "Westpazifik",

  "source.WHO_DON": "WHO Krankheitsausbruchsnachrichten",
  "source.WHO_EIOS": "WHO EIOS",
  "source.PROMED": "ProMED",
  "source.ECDC": "Europäisches CDC",
  "source.WOAH": "Weltorganisation für Tiergesundheit",
  "source.BEACON": "Beacon (HealthMap)",
  "source.CIDRAP": "CIDRAP",
  "source.WHO_DON.desc": "Offizielle WHO-Berichte zu Krankheitsausbrüchen über die öffentliche WHO-API",
  "source.WHO_EIOS.desc": "Epidemiologische Nachrichtenauswertung der WHO aus offenen Quellen — NLP-basierte Medienüberwachung",
  "source.PROMED.desc": "Humankuratierte ereignisbasierte Surveillance der International Society for Infectious Diseases",
  "source.ECDC.desc": "ECDC-Berichte zu übertragbaren Krankheiten und Schnellrisikobewertungen",
  "source.WOAH.desc": "Offizielle Tierseuchenmeldungen über WAHIS",
  "source.BEACON.desc": "Automatisierte Echtzeit-Krankheitsausbruchsnachrichten und Warnungen",
  "source.CIDRAP.desc": "Zentrum für Forschung und Politik zu Infektionskrankheiten — Expertennachrichten und Analysen",

  "welcome.acronym": "Swiss Epidemic Notification and Threat Intelligence Engine",
  "welcome.intro": "Echtzeit-Plattform für epidemiologische Nachrichtenauswertung für die Schweizer Gesundheitsbehörden. SENTINEL aggregiert globale Ausbruchsdaten, bewertet Bedrohungen nach Schweizer Relevanz und unterstützt IGV-konforme Meldeworkflows.",
  "welcome.stat1": "12 Datenquellen",
  "welcome.stat2": "3x tägliche Erhebung",
  "welcome.stat3": "4 Amtssprachen",
  "welcome.capabilities": "Kernfunktionen",
  "welcome.f1.title": "Globale Überwachung",
  "welcome.f1.desc": "WHO, ECDC, WOAH, ProMED und 8 weitere Quellen — vereinheitlicht und dedupliziert.",
  "welcome.f2.title": "Intelligente Triage",
  "welcome.f2.desc": "KI-gestütztes Risikoscoring mit Schweizer Relevanzgewichtung und One-Health-Tagging.",
  "welcome.f3.title": "Situationsverfolgung",
  "welcome.f3.desc": "Verwandte Ereignisse zu Situationen bündeln mit Zeitachse, Anmerkungen und Eskalation.",
  "welcome.f4.title": "Warn-Engine",
  "welcome.f4.desc": "Individuelle Regeln mit Echtzeit-WebSocket-Push. Kein kritisches Signal verpassen.",
  "welcome.f5.title": "IGV-Konformität",
  "welcome.f5.desc": "Anhang-2-Bewertungsassistent mit 24-Std.-Fristüberwachung für WHO-Meldungen.",
  "welcome.f6.title": "Analysen & Export",
  "welcome.f6.desc": "Trends, Risikoverläufe, Krankheitsverteilungen. Export als CSV/JSON für Berichte.",
  "welcome.swiss.title": "Entwickelt für das Schweizer Gesundheitswesen",
  "welcome.swiss.desc": "Konzipiert für das Bundesamt für Gesundheit (BAG) und das Bundesamt für Lebensmittelsicherheit und Veterinärwesen (BLV) mit vollständiger Unterstützung des schweizerischen Rechts- und Organisationsrahmens.",
  "welcome.swiss.bag": "BAG",
  "welcome.swiss.bagDesc": "Humangesundheits-Surveillance",
  "welcome.swiss.blv": "BLV",
  "welcome.swiss.blvDesc": "Tier- und Lebensmittelsicherheit",
  "welcome.swiss.ihr": "IGV / EpG",
  "welcome.swiss.ihrDesc": "Rechtskonformität",
  "welcome.skip": "Überspringen",
  "welcome.next": "Weiter",
  "welcome.start": "Loslegen",
};

/* -------------------------------------------------------------------------- */
/*  French                                                                    */
/* -------------------------------------------------------------------------- */
const fr: Dict = {
  "nav.commandCenter": "Centre de commandement",
  "nav.globalMap": "Carte mondiale",
  "nav.triageQueue": "File de triage",
  "nav.situations": "Situations",
  "nav.analytics": "Analyses",
  "nav.watchlists": "Listes de veille",
  "nav.exports": "Exports",

  "sidebar.lastCollection": "Dernière collecte",
  "sidebar.events": "Événements",
  "sidebar.expandSidebar": "Déplier la barre latérale",
  "sidebar.collapseSidebar": "Replier la barre latérale",
  "sidebar.openNav": "Ouvrir la navigation",

  "theme.system": "Système",
  "theme.light": "Clair",
  "theme.dark": "Sombre",

  "loading.intelligence": "Chargement des données de renseignement",
  "loading.triage": "Chargement de la file de triage",
  "loading.situations": "Chargement des situations",
  "loading.analytics": "Chargement des analyses",
  "loading.map": "Chargement des données de menace",
  "loading.watchlists": "Chargement des listes de veille",
  "loading.exports": "Chargement des données d'export",

  "cc.subtitle": "Panorama mondial des menaces",
  "cc.pipeline": "Pipeline actif — Collecte 06h00, 14h00 & 22h00 UTC",
  "cc.newEvents24h": "Nouveaux événements (24h)",
  "cc.activeSituations": "Situations actives",
  "cc.criticalAlerts": "Alertes critiques",
  "cc.swissRelevant": "Pertinent pour la CH",
  "cc.whatChanged": "Évolutions récentes",
  "cc.vs": "vs",
  "cc.newEvents": "Nouveaux événements",
  "cc.elevatedSignals": "Signaux élevés",
  "cc.noElevated": "Aucun signal élevé",
  "cc.newThisPeriod": "Nouveautés de la période",
  "cc.diseases": "Maladies",
  "cc.countries": "Pays",
  "cc.noNewDiseaseCountry": "Aucune nouvelle maladie ni pays",
  "cc.noActiveSituations": "Aucune situation active",
  "cc.activeThreats": "Menaces actives — par maladie",
  "cc.fullTriage": "Triage complet",
  "cc.dataSources": "Sources de données",
  "cc.totalEventsFrom": "événements au total de",
  "cc.sources": "sources",
  "cc.last": "Dernier",

  "metric.events": "événements",
  "metric.cases": "cas",
  "metric.deaths": "décès",
  "metric.confirmed": "Confirmé",

  "risk.critical": "Critique",
  "risk.high": "Élevé",
  "risk.medium": "Moyen",
  "risk.low": "Faible",

  "verification.unverified": "Non vérifié",
  "verification.pending": "En attente",
  "verification.confirmed": "Confirmé",
  "verification.refuted": "Réfuté",

  "priority.immediate": "Immédiat",
  "priority.high": "Élevé",
  "priority.medium": "Moyen",
  "priority.watch": "Surveillance",

  "triage.title": "File de triage",
  "triage.subtitle": "événements triés par pertinence suisse",
  "triage.source": "Source",
  "triage.disease": "Maladie",
  "triage.riskLevel": "Niveau de risque",
  "triage.country": "Pays",
  "triage.verification": "Vérification",
  "triage.noMatch": "Aucun événement ne correspond aux filtres actuels.",

  "situations.title": "Situations",
  "situations.subtitle": "Suivi et gestion des situations de menace actives",
  "situations.count": "situations",

  "analytics.title": "Analyses",
  "analytics.subtitle": "analyse du renseignement",
  "analytics.totalEvents": "événements au total",
  "analytics.diseaseTrends": "Tendances des maladies",
  "analytics.diseaseTrendsDesc": "Événements par jour et par maladie",
  "analytics.sourceComparison": "Comparaison des sources",
  "analytics.sourceComparisonDesc": "Événements par source de renseignement",
  "analytics.riskTimeline": "Évolution du risque",
  "analytics.riskTimelineDesc": "Score de risque moyen et pertinence suisse par jour",
  "analytics.diseaseBreakdown": "Répartition par maladie",
  "analytics.diseaseBreakdownDesc": "Nombre total d'événements par maladie",

  "map.title": "Carte mondiale des menaces",
  "map.subtitle": "Distribution géographique des événements sanitaires",
  "map.allDates": "Toutes les dates",

  "watchlists.title": "Listes de veille",
  "watchlists.subtitle": "Filtres d'événements personnalisés et critères de surveillance",
  "watchlists.create": "Créer une liste",
  "watchlists.cancel": "Annuler",
  "watchlists.new": "Nouvelle liste de veille",
  "watchlists.name": "Nom",
  "watchlists.diseases": "Maladies",
  "watchlists.countries": "Pays",
  "watchlists.minRisk": "Score de risque min.",
  "watchlists.oneHealthTags": "Tags One Health",
  "watchlists.namePlaceholder": "Nom de la liste…",

  "exports.title": "Exports",
  "exports.subtitle": "Exporter les données d'événements, situations et rapports",

  "eventCard.chRelevance": "Pertinence CH",
  "eventCard.analystOverride": "Override analyste",

  "detail.verification": "Vérification",
  "detail.ihrAssessment": "Évaluation RSI Annexe 2",
  "detail.playbook": "Playbook décisionnel",
  "detail.provenance": "Provenance des sources",
  "detail.summary": "Résumé",
  "detail.analysis": "Analyse LLM",
  "detail.overrides": "Overrides analyste",
  "detail.triageActions": "Actions de triage",
  "detail.analystNote": "Note d'analyste",
  "detail.ihr.unusual": "Inhabituel / inattendu",
  "detail.ihr.seriousImpact": "Impact grave sur la santé publique",
  "detail.ihr.internationalSpread": "Risque de propagation internationale",
  "detail.ihr.tradeTravelRisk": "Risque de restrictions commerciales / voyages",
  "detail.hazard": "Classe de danger",
  "detail.sla": "SLA",
  "detail.escalation": "Escalade",
  "detail.viewSource": "Voir la source",
  "detail.monitor": "Surveiller",
  "detail.escalate": "Escalader",
  "detail.dismiss": "Rejeter",
  "detail.status": "Statut",
  "detail.addAnnotation": "Ajouter une annotation…",
  "detail.save": "Enregistrer",
  "detail.saved": "Enregistré",
  "detail.overridesApplied": "override(s) analyste appliqué(s) à cet événement.",
  "detail.sourceNodes": "nœuds source",
  "detail.mergedFrom": "fusionné à partir de",
  "detail.eventIds": "IDs d'événement",

  "region.EURO": "Europe",
  "region.SEARO": "Asie du Sud-Est",
  "region.AFRO": "Afrique",
  "region.AMRO": "Amériques",
  "region.EMRO": "Moyen-Orient",
  "region.WPRO": "Pacifique occidental",

  "source.WHO_DON": "Bulletins OMS sur les flambées",
  "source.WHO_EIOS": "OMS EIOS",
  "source.PROMED": "ProMED",
  "source.ECDC": "CDC européen",
  "source.WOAH": "Organisation mondiale de la santé animale",
  "source.BEACON": "Beacon (HealthMap)",
  "source.CIDRAP": "CIDRAP",
  "source.WHO_DON.desc": "Rapports officiels de l'OMS sur les flambées via l'API publique",
  "source.WHO_EIOS.desc": "Veille épidémiologique de l'OMS à partir de sources ouvertes — surveillance médiatique par NLP",
  "source.PROMED.desc": "Surveillance événementielle curatée par l'International Society for Infectious Diseases",
  "source.ECDC.desc": "Rapports de l'ECDC sur les menaces de maladies transmissibles et évaluations rapides des risques",
  "source.WOAH.desc": "Notifications officielles de maladies animales via WAHIS",
  "source.BEACON.desc": "Renseignement automatisé en temps réel sur les flambées épidémiques",
  "source.CIDRAP.desc": "Centre de recherche et politique sur les maladies infectieuses — analyses et actualités d'experts",

  "welcome.acronym": "Swiss Epidemic Notification and Threat Intelligence Engine",
  "welcome.intro": "Plateforme de renseignement épidémiologique en temps réel pour les autorités suisses de santé publique. SENTINEL agrège les données mondiales sur les flambées, évalue les menaces selon leur pertinence suisse et prend en charge les workflows de notification conformes au RSI.",
  "welcome.stat1": "12 sources de données",
  "welcome.stat2": "Collecte 3x par jour",
  "welcome.stat3": "4 langues officielles",
  "welcome.capabilities": "Fonctionnalités clés",
  "welcome.f1.title": "Surveillance mondiale",
  "welcome.f1.desc": "OMS, ECDC, WOAH, ProMED et 8 autres sources — unifiées et dédupliquées.",
  "welcome.f2.title": "Triage intelligent",
  "welcome.f2.desc": "Scoring de risque par IA avec pondération de pertinence suisse et tags One Health.",
  "welcome.f3.title": "Suivi des situations",
  "welcome.f3.desc": "Regroupez les événements en situations avec chronologie, annotations et escalade.",
  "welcome.f4.title": "Moteur d'alertes",
  "welcome.f4.desc": "Règles personnalisées avec push WebSocket en temps réel. Ne ratez aucun signal.",
  "welcome.f5.title": "Conformité RSI",
  "welcome.f5.desc": "Assistant d'évaluation Annexe 2 avec suivi du délai de 24h pour la notification OMS.",
  "welcome.f6.title": "Analyses & export",
  "welcome.f6.desc": "Tendances, chronologies de risque, répartitions. Export CSV/JSON pour les rapports.",
  "welcome.swiss.title": "Conçu pour la santé publique suisse",
  "welcome.swiss.desc": "Conçu pour l'Office fédéral de la santé publique (OFSP) et l'Office fédéral de la sécurité alimentaire et des affaires vétérinaires (OSAV) avec prise en charge complète du cadre juridique et organisationnel suisse.",
  "welcome.swiss.bag": "OFSP",
  "welcome.swiss.bagDesc": "Surveillance sanitaire humaine",
  "welcome.swiss.blv": "OSAV",
  "welcome.swiss.blvDesc": "Sécurité animale et alimentaire",
  "welcome.swiss.ihr": "RSI / LEp",
  "welcome.swiss.ihrDesc": "Conformité juridique",
  "welcome.skip": "Passer",
  "welcome.next": "Suivant",
  "welcome.start": "Commencer",
};

/* -------------------------------------------------------------------------- */
/*  Italian                                                                   */
/* -------------------------------------------------------------------------- */
const it: Dict = {
  "nav.commandCenter": "Centro di comando",
  "nav.globalMap": "Mappa globale",
  "nav.triageQueue": "Coda di triage",
  "nav.situations": "Situazioni",
  "nav.analytics": "Analisi",
  "nav.watchlists": "Liste di sorveglianza",
  "nav.exports": "Esportazioni",

  "sidebar.lastCollection": "Ultima raccolta",
  "sidebar.events": "Eventi",
  "sidebar.expandSidebar": "Espandi barra laterale",
  "sidebar.collapseSidebar": "Comprimi barra laterale",
  "sidebar.openNav": "Apri navigazione",

  "theme.system": "Sistema",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",

  "loading.intelligence": "Caricamento dati di intelligence",
  "loading.triage": "Caricamento coda di triage",
  "loading.situations": "Caricamento situazioni",
  "loading.analytics": "Caricamento analisi",
  "loading.map": "Caricamento dati sulle minacce",
  "loading.watchlists": "Caricamento liste di sorveglianza",
  "loading.exports": "Caricamento dati di esportazione",

  "cc.subtitle": "Panorama globale delle minacce",
  "cc.pipeline": "Pipeline attivo — Raccolta 06:00, 14:00 & 22:00 UTC",
  "cc.newEvents24h": "Nuovi eventi (24h)",
  "cc.activeSituations": "Situazioni attive",
  "cc.criticalAlerts": "Allerte critiche",
  "cc.swissRelevant": "Rilevante per la CH",
  "cc.whatChanged": "Variazioni recenti",
  "cc.vs": "vs",
  "cc.newEvents": "Nuovi eventi",
  "cc.elevatedSignals": "Segnali elevati",
  "cc.noElevated": "Nessun segnale elevato",
  "cc.newThisPeriod": "Novità del periodo",
  "cc.diseases": "Malattie",
  "cc.countries": "Paesi",
  "cc.noNewDiseaseCountry": "Nessuna nuova malattia o paese",
  "cc.noActiveSituations": "Nessuna situazione attiva",
  "cc.activeThreats": "Minacce attive — per malattia",
  "cc.fullTriage": "Triage completo",
  "cc.dataSources": "Fonti dati",
  "cc.totalEventsFrom": "eventi totali da",
  "cc.sources": "fonti",
  "cc.last": "Ultimo",

  "metric.events": "eventi",
  "metric.cases": "casi",
  "metric.deaths": "decessi",
  "metric.confirmed": "Confermato",

  "risk.critical": "Critico",
  "risk.high": "Alto",
  "risk.medium": "Medio",
  "risk.low": "Basso",

  "verification.unverified": "Non verificato",
  "verification.pending": "In attesa",
  "verification.confirmed": "Confermato",
  "verification.refuted": "Confutato",

  "priority.immediate": "Immediato",
  "priority.high": "Alto",
  "priority.medium": "Medio",
  "priority.watch": "Osservazione",

  "triage.title": "Coda di triage",
  "triage.subtitle": "eventi ordinati per rilevanza svizzera",
  "triage.source": "Fonte",
  "triage.disease": "Malattia",
  "triage.riskLevel": "Livello di rischio",
  "triage.country": "Paese",
  "triage.verification": "Verifica",
  "triage.noMatch": "Nessun evento corrisponde ai filtri attuali.",

  "situations.title": "Situazioni",
  "situations.subtitle": "Monitoraggio e gestione delle situazioni di minaccia attive",
  "situations.count": "situazioni",

  "analytics.title": "Analisi",
  "analytics.subtitle": "analisi di intelligence",
  "analytics.totalEvents": "eventi totali",
  "analytics.diseaseTrends": "Tendenze delle malattie",
  "analytics.diseaseTrendsDesc": "Eventi al giorno per malattia",
  "analytics.sourceComparison": "Confronto delle fonti",
  "analytics.sourceComparisonDesc": "Eventi per fonte di intelligence",
  "analytics.riskTimeline": "Andamento del rischio",
  "analytics.riskTimelineDesc": "Punteggio di rischio medio e rilevanza svizzera per giorno",
  "analytics.diseaseBreakdown": "Distribuzione per malattia",
  "analytics.diseaseBreakdownDesc": "Totale eventi per malattia",

  "map.title": "Mappa globale delle minacce",
  "map.subtitle": "Distribuzione geografica degli eventi sanitari",
  "map.allDates": "Tutte le date",

  "watchlists.title": "Liste di sorveglianza",
  "watchlists.subtitle": "Filtri personalizzati e criteri di monitoraggio",
  "watchlists.create": "Crea lista",
  "watchlists.cancel": "Annulla",
  "watchlists.new": "Nuova lista di sorveglianza",
  "watchlists.name": "Nome",
  "watchlists.diseases": "Malattie",
  "watchlists.countries": "Paesi",
  "watchlists.minRisk": "Punteggio di rischio min.",
  "watchlists.oneHealthTags": "Tag One Health",
  "watchlists.namePlaceholder": "Nome della lista…",

  "exports.title": "Esportazioni",
  "exports.subtitle": "Esporta dati eventi, situazioni e rapporti",

  "eventCard.chRelevance": "Rilevanza CH",
  "eventCard.analystOverride": "Override analista",

  "detail.verification": "Verifica",
  "detail.ihrAssessment": "Valutazione RSI Allegato 2",
  "detail.playbook": "Playbook decisionale",
  "detail.provenance": "Provenienza delle fonti",
  "detail.summary": "Riepilogo",
  "detail.analysis": "Analisi LLM",
  "detail.overrides": "Override analista",
  "detail.triageActions": "Azioni di triage",
  "detail.analystNote": "Nota dell'analista",
  "detail.ihr.unusual": "Insolito / inatteso",
  "detail.ihr.seriousImpact": "Grave impatto sulla salute pubblica",
  "detail.ihr.internationalSpread": "Rischio di diffusione internazionale",
  "detail.ihr.tradeTravelRisk": "Rischio di restrizioni commerciali / viaggi",
  "detail.hazard": "Classe di pericolo",
  "detail.sla": "SLA",
  "detail.escalation": "Escalation",
  "detail.viewSource": "Vedi fonte",
  "detail.monitor": "Monitorare",
  "detail.escalate": "Escalare",
  "detail.dismiss": "Archiviare",
  "detail.status": "Stato",
  "detail.addAnnotation": "Aggiungi annotazione…",
  "detail.save": "Salva",
  "detail.saved": "Salvato",
  "detail.overridesApplied": "override analista applicato/i a questo evento.",
  "detail.sourceNodes": "nodi fonte",
  "detail.mergedFrom": "unificato da",
  "detail.eventIds": "ID evento",

  "region.EURO": "Europa",
  "region.SEARO": "Sud-est asiatico",
  "region.AFRO": "Africa",
  "region.AMRO": "Americhe",
  "region.EMRO": "Medio Oriente",
  "region.WPRO": "Pacifico occidentale",

  "source.WHO_DON": "Notizie OMS sulle epidemie",
  "source.WHO_EIOS": "OMS EIOS",
  "source.PROMED": "ProMED",
  "source.ECDC": "CDC europeo",
  "source.WOAH": "Organizzazione mondiale per la sanità animale",
  "source.BEACON": "Beacon (HealthMap)",
  "source.CIDRAP": "CIDRAP",
  "source.WHO_DON.desc": "Rapporti ufficiali dell'OMS sulle epidemie tramite API pubblica",
  "source.WHO_EIOS.desc": "Intelligence epidemiologica dell'OMS da fonti aperte — sorveglianza mediatica basata su NLP",
  "source.PROMED.desc": "Sorveglianza basata su eventi curata dall'International Society for Infectious Diseases",
  "source.ECDC.desc": "Rapporti ECDC sulle minacce di malattie trasmissibili e valutazioni rapide del rischio",
  "source.WOAH.desc": "Notifiche ufficiali di malattie animali tramite WAHIS",
  "source.BEACON.desc": "Intelligence automatizzata in tempo reale su focolai epidemici",
  "source.CIDRAP.desc": "Centro di ricerca e politica sulle malattie infettive — notizie e analisi di esperti",

  "welcome.acronym": "Swiss Epidemic Notification and Threat Intelligence Engine",
  "welcome.intro": "Piattaforma di intelligence epidemiologica in tempo reale per le autorità sanitarie svizzere. SENTINEL aggrega i dati globali sulle epidemie, valuta le minacce in base alla rilevanza svizzera e supporta i flussi di lavoro di notifica conformi al RSI.",
  "welcome.stat1": "12 fonti dati",
  "welcome.stat2": "Raccolta 3x al giorno",
  "welcome.stat3": "4 lingue ufficiali",
  "welcome.capabilities": "Funzionalità principali",
  "welcome.f1.title": "Sorveglianza globale",
  "welcome.f1.desc": "OMS, ECDC, WOAH, ProMED e altre 8 fonti — unificate e deduplicate.",
  "welcome.f2.title": "Triage intelligente",
  "welcome.f2.desc": "Scoring del rischio basato su IA con ponderazione della rilevanza svizzera e tag One Health.",
  "welcome.f3.title": "Tracciamento situazioni",
  "welcome.f3.desc": "Raggruppa eventi in situazioni con cronologia, annotazioni ed escalation.",
  "welcome.f4.title": "Motore di allerta",
  "welcome.f4.desc": "Regole personalizzate con push WebSocket in tempo reale. Non perdere nessun segnale.",
  "welcome.f5.title": "Conformità RSI",
  "welcome.f5.desc": "Assistente di valutazione Allegato 2 con monitoraggio della scadenza di 24h per la notifica OMS.",
  "welcome.f6.title": "Analisi ed export",
  "welcome.f6.desc": "Tendenze, cronologie di rischio, distribuzione. Export CSV/JSON per i rapporti.",
  "welcome.swiss.title": "Progettato per la sanità pubblica svizzera",
  "welcome.swiss.desc": "Progettato per l'Ufficio federale della sanità pubblica (UFSP) e l'Ufficio federale della sicurezza alimentare e di veterinaria (USAV) con pieno supporto del quadro giuridico e organizzativo svizzero.",
  "welcome.swiss.bag": "UFSP",
  "welcome.swiss.bagDesc": "Sorveglianza sanitaria umana",
  "welcome.swiss.blv": "USAV",
  "welcome.swiss.blvDesc": "Sicurezza animale e alimentare",
  "welcome.swiss.ihr": "RSI / LEp",
  "welcome.swiss.ihrDesc": "Conformità legale",
  "welcome.skip": "Salta",
  "welcome.next": "Avanti",
  "welcome.start": "Inizia",
};

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

const DICTS: Record<Locale, Dict> = { en, de, fr, it };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "de",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel-locale") as Locale | null;
      if (saved && saved in DICTS) return saved;
    }
    return "de";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel-locale", l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      return DICTS[locale][key] ?? DICTS.en[key] ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
