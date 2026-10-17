/**
 * One spelling per city, so a pin labelled "Kanpur Nagar" accepts an address typed as "Kanpur"
 * and "Bangalore" matches "Bengaluru". Same rules as the API's `cityKey`.
 */
const CITY_ALIASES: Record<string, string> = {
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

export const sameCity = (a: string | null | undefined, b: string | null | undefined) => cityKey(a) === cityKey(b);
