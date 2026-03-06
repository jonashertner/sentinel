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
    label: "ECDC Epidemiological Updates",
    short: "EIOS",
    description: "ECDC epidemiological publications and surveillance reports",
    url: "https://www.ecdc.europa.eu/en/publications-data",
  },
  PROMED: {
    label: "WHO Health News",
    short: "WHO News",
    description: "WHO news items filtered for disease-relevant content",
    url: "https://www.who.int/news",
  },
  ECDC: {
    label: "European CDC",
    short: "ECDC",
    description: "ECDC communicable disease threats reports and publications",
    url: "https://www.ecdc.europa.eu",
  },
  WOAH: {
    label: "World Organisation for Animal Health",
    short: "WOAH",
    description: "WOAH news feed filtered for disease notifications",
    url: "https://www.woah.org",
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

export const PRIORITY_LABELS = {
  P1: { label: "Immediate", color: "text-sentinel-critical" },
  P2: { label: "High", color: "text-sentinel-high" },
  P3: { label: "Medium", color: "text-sentinel-medium" },
  P4: { label: "Watch", color: "text-sentinel-low" },
} as const;
