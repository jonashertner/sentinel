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
  { label: string; short: string }
> = {
  WHO_DON: { label: "WHO Disease Outbreak News", short: "WHO" },
  WHO_EIOS: { label: "WHO EIOS", short: "EIOS" },
  PROMED: { label: "ProMED-mail", short: "ProMED" },
  ECDC: { label: "European CDC", short: "ECDC" },
  WOAH: { label: "World Organisation for Animal Health", short: "WOAH" },
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
