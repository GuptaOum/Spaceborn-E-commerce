import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { notFound, parse } from '../errors.js';
import { logger } from '../logger.js';
import { pincode } from './schemas.js';

export const geoRouter = Router();

interface GeoResult {
  latitude: number;
  longitude: number;
  label: string;
  area: string;
  pincode: string;
}

const cache = new Map<string, { at: number; value: GeoResult | null }>();
const CACHE_MS = 24 * 60 * 60_000;

const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

// Nominatim is free for light use; results are cached so a PIN is looked up at most once a day.
async function geocodePincode(pin: string): Promise<GeoResult | null> {
  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('postalcode', pin);
  url.searchParams.set('country', 'India');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: { 'User-Agent': 'Spaceborn/1.0 (quick-commerce; contact: support@spaceborn.in)' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const [row] = (await res.json()) as { lat: string; lon: string; display_name: string; address?: Record<string, string> }[];
  let value: GeoResult | null = null;
  if (row) {
    const a = row.address ?? {};
    const city = a.city || a.town || a.state_district || a.county || a.state || 'India';
    const area = a.suburb || a.neighbourhood || a.village || a.city_district || city;
    value = {
      latitude: Number(Number(row.lat).toFixed(6)),
      longitude: Number(Number(row.lon).toFixed(6)),
      label: city,
      area: `${area}, ${city}`,
      pincode: pin,
    };
  }
  cache.set(pin, { at: Date.now(), value });
  return value;
}

geoRouter.get('/geo/pincode/:pin', limiter, async (req, res) => {
  const pin = parse(pincode, req.params.pin);
  let result: GeoResult | null;
  try {
    result = await geocodePincode(pin);
  } catch (err) {
    logger.warn({ err, pin }, 'pincode geocode failed');
    throw notFound('Could not look up that PIN code right now');
  }
  if (!result) throw notFound('PIN code not found');
  res.json({ location: result });
});

geoRouter.get('/geo/search', limiter, async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(3).max(80) }), req.query);
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${q}, India`);
  url.searchParams.set('countrycodes', 'in');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  let rows: { lat: string; lon: string; display_name: string; address?: Record<string, string> }[] = [];
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Spaceborn/1.0 (quick-commerce; contact: support@spaceborn.in)' }, signal: AbortSignal.timeout(6000) });
    if (r.ok) rows = await r.json();
  } catch (err) {
    logger.warn({ err, q }, 'place search failed');
  }
  res.json({
    results: rows.map((row) => {
      const a = row.address ?? {};
      const city = a.city || a.town || a.state_district || a.county || a.state || 'India';
      return {
        latitude: Number(Number(row.lat).toFixed(6)),
        longitude: Number(Number(row.lon).toFixed(6)),
        label: city,
        area: row.display_name.split(',').slice(0, 3).join(',').trim(),
        pincode: a.postcode ?? '',
      } satisfies GeoResult;
    }),
  });
});
