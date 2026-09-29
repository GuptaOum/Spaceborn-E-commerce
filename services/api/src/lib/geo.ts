const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Same formula for use inside SQL; $lat/$lng are the query parameters, s the stores alias.
export const distanceSql = (latParam: string, lngParam: string, alias = 's') => `
  (2 * ${EARTH_RADIUS_KM} * asin(sqrt(
    power(sin(radians(${alias}.latitude - ${latParam}) / 2), 2) +
    cos(radians(${latParam})) * cos(radians(${alias}.latitude)) *
    power(sin(radians(${alias}.longitude - ${lngParam}) / 2), 2)
  )))`;
