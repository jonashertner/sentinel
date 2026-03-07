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
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentinel-locale") as Locale | null;
      if (saved && saved in DICTS) return saved;
    }
    return "en";
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
