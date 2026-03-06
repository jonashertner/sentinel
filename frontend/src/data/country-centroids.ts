/**
 * ISO 3166-1 numeric → ISO alpha-2 mapping for countries in our data.
 * Used to match TopoJSON geometry IDs to our event country codes.
 */
export const NUMERIC_TO_ALPHA2: Record<string, string> = {
  "756": "CH", // Switzerland
  "276": "DE", // Germany
  "250": "FR", // France
  "380": "IT", // Italy
  "040": "AT", // Austria
  "438": "LI", // Liechtenstein
  "528": "NL", // Netherlands
  "056": "BE", // Belgium
  "724": "ES", // Spain
  "826": "GB", // United Kingdom
  "616": "PL", // Poland
  "860": "UZ", // Uzbekistan
  "792": "TR", // Turkey
  "231": "ET", // Ethiopia
  "566": "NG", // Nigeria
  "180": "CD", // DR Congo
  "108": "BI", // Burundi
  "646": "RW", // Rwanda
  "404": "KE", // Kenya
  "834": "TZ", // Tanzania
  "012": "DZ", // Algeria
  "840": "US", // United States
  "076": "BR", // Brazil
  "156": "CN", // China
  "356": "IN", // India
  "764": "TH", // Thailand
  "704": "VN", // Vietnam
  "360": "ID", // Indonesia
  "418": "LA", // Laos
  "784": "AE", // UAE
};

/**
 * Country centroids [longitude, latitude] for marker placement.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  CH: [8.2275, 46.8182],
  DE: [10.4515, 51.1657],
  FR: [2.2137, 46.2276],
  IT: [12.5674, 41.8719],
  AT: [14.5501, 47.5162],
  LI: [9.5554, 47.166],
  NL: [5.2913, 52.1326],
  BE: [4.4699, 50.5039],
  ES: [-3.7038, 40.4168],
  GB: [-3.436, 55.3781],
  PL: [19.1451, 51.9194],
  UZ: [64.5853, 41.3775],
  TR: [35.2433, 38.9637],
  ET: [40.4897, 9.145],
  NG: [8.6753, 9.082],
  CD: [21.7587, -4.0383],
  BI: [29.9189, -3.3731],
  RW: [29.8739, -1.9403],
  KE: [37.9062, -0.0236],
  TZ: [34.8888, -6.369],
  DZ: [1.6596, 28.0339],
  US: [-95.7129, 37.0902],
  BR: [-51.9253, -14.235],
  CN: [104.1954, 35.8617],
  IN: [78.9629, 20.5937],
  TH: [100.9925, 15.8700],
  VN: [108.2772, 14.0583],
  ID: [113.9213, -0.7893],
  LA: [102.4955, 19.8563],
  AE: [53.8478, 23.4241],
};

/**
 * Countries that border Switzerland (used for threat arcs).
 */
export const SWISS_NEIGHBORS = ["DE", "FR", "IT", "AT", "LI"];
