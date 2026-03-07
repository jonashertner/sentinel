export const RISK_COLORS = {
  CRITICAL: {
    text: "text-sentinel-critical",
    bg: "bg-sentinel-critical-bg",
    border: "border-sentinel-critical",
    dot: "#ef4444",
  },
  HIGH: {
    text: "text-sentinel-high",
    bg: "bg-sentinel-high-bg",
    border: "border-sentinel-high",
    dot: "#f97316",
  },
  MEDIUM: {
    text: "text-sentinel-medium",
    bg: "bg-sentinel-medium-bg",
    border: "border-sentinel-medium",
    dot: "#eab308",
  },
  LOW: {
    text: "text-sentinel-low",
    bg: "bg-sentinel-low-bg",
    border: "border-sentinel-low",
    dot: "#3b82f6",
  },
} as const;

export const SOURCE_LABELS: Record<
  string,
  { label: string; short: string; description: string; url: string }
> = {
  WHO_DON: {
    label: "WHO Disease Outbreak News",
    short: "WHO",
    description: "Official WHO disease outbreak reports via the WHO public API",
    url: "https://www.who.int/emergencies/disease-outbreak-news",
  },
  WHO_EIOS: {
    label: "WHO EIOS",
    short: "EIOS",
    description: "WHO Epidemic Intelligence from Open Sources — NLP-driven media surveillance",
    url: "https://www.who.int/initiatives/eios",
  },
  PROMED: {
    label: "ProMED",
    short: "ProMED",
    description: "Human-curated event-based surveillance from the International Society for Infectious Diseases",
    url: "https://promedmail.org",
  },
  ECDC: {
    label: "European CDC",
    short: "ECDC",
    description: "ECDC communicable disease threats reports and rapid risk assessments",
    url: "https://www.ecdc.europa.eu",
  },
  WOAH: {
    label: "World Organisation for Animal Health",
    short: "WOAH",
    description: "Official animal disease notifications via WAHIS",
    url: "https://wahis.woah.org",
  },
  BEACON: {
    label: "Beacon (HealthMap)",
    short: "Beacon",
    description: "Automated real-time disease outbreak intelligence and alerts",
    url: "https://beacon.healthmap.org",
  },
  CIDRAP: {
    label: "CIDRAP",
    short: "CIDRAP",
    description: "Center for Infectious Disease Research and Policy — expert news and analysis",
    url: "https://www.cidrap.umn.edu",
  },
};

export const COUNTRY_NAMES: Record<string, string> = {
  CH: "Switzerland",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  AT: "Austria",
  LI: "Liechtenstein",
  NL: "Netherlands",
  BE: "Belgium",
  ES: "Spain",
  GB: "United Kingdom",
  US: "United States",
  CN: "China",
  BR: "Brazil",
  IN: "India",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  CD: "DR Congo",
  BI: "Burundi",
  RW: "Rwanda",
  ET: "Ethiopia",
  UZ: "Uzbekistan",
  PL: "Poland",
  NG: "Nigeria",
  KE: "Kenya",
};

export const VERIFICATION_STYLES: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  UNVERIFIED: { label: "Unverified", color: "text-amber-400", bg: "bg-amber-500/10" },
  PENDING: { label: "Pending", color: "text-sky-400", bg: "bg-sky-500/10" },
  CONFIRMED: { label: "Confirmed", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  REFUTED: { label: "Refuted", color: "text-red-400", bg: "bg-red-500/10" },
};

export const PRIORITY_LABELS = {
  P1: { label: "Immediate", color: "text-sentinel-critical" },
  P2: { label: "High", color: "text-sentinel-high" },
  P3: { label: "Medium", color: "text-sentinel-medium" },
  P4: { label: "Watch", color: "text-sentinel-low" },
} as const;
