/**
 * One spelling per city, so "Kanpur Nagar", "kanpur" and "Cawnpore" are the same region and
 * "Bangalore" matches "Bengaluru". Mirrors the `sb_city_key` SQL function (migration 016); the
 * city test checks the two agree.
 */
export const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  madras: 'chennai',
  calcutta: 'kolkata',
  gurgaon: 'gurugram',
  'new delhi': 'delhi',
  poona: 'pune',
  mysore: 'mysuru',
  baroda: 'vadodara',
  cawnpore: 'kanpur',
  banaras: 'varanasi',
  benares: 'varanasi',
  allahabad: 'prayagraj',
  vizag: 'visakhapatnam',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  pondicherry: 'puducherry',
  mangalore: 'mangaluru',
  belgaum: 'belagavi',
  gauhati: 'guwahati',
  simla: 'shimla',
  'gautam buddha': 'noida',
};

/** District-style suffixes that name the same city: "Kanpur Nagar", "Pune City", "Bengaluru Urban". */
const SUFFIX = / (nagar|city|district|urban)$/;

export function cityKey(city: string | null | undefined): string {
  const c = (city ?? '')
    .toLowerCase()
    .replace(/[-.,()/0-9'_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = /^.+ (nagar|city|district|urban)$/.test(c) ? c.replace(SUFFIX, '') : c;
  return CITY_ALIASES[base] ?? base;
}
