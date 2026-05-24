import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  formatDistance,
  coordsForLocation,
  mockLocationCoords,
} from '../utils/geo';
import { supabaseImg } from '../utils/img';

// ─── haversineDistance ─────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(53.27, -9.06, 53.27, -9.06)).toBe(0);
  });

  it('calculates distance between Dublin and Galway (~190 km)', () => {
    const km = haversineDistance(53.3498, -6.2603, 53.2707, -9.0568);
    expect(km).toBeGreaterThan(180);
    expect(km).toBeLessThan(210);
  });

  it('is symmetric', () => {
    const ab = haversineDistance(53.27, -9.06, 53.35, -6.26);
    const ba = haversineDistance(53.35, -6.26, 53.27, -9.06);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns a positive number for any two different points', () => {
    expect(haversineDistance(51.5, -0.1, 48.86, 2.35)).toBeGreaterThan(0);
  });
});

// ─── formatDistance ───────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('shows metres when under 1 km', () => {
    expect(formatDistance(0.5)).toBe('500m away');
  });

  it('rounds metres to the nearest whole number', () => {
    expect(formatDistance(0.123)).toBe('123m away');
  });

  it('shows km with one decimal place when 1 km or more', () => {
    expect(formatDistance(1)).toBe('1.0km away');
    expect(formatDistance(2.5)).toBe('2.5km away');
    expect(formatDistance(15.75)).toBe('15.8km away');
  });

  it('handles exactly 1 km', () => {
    expect(formatDistance(1.0)).toBe('1.0km away');
  });
});

// ─── coordsForLocation ────────────────────────────────────────────────────────

describe('coordsForLocation', () => {
  it('returns coords for a known location (case-insensitive)', () => {
    const result = coordsForLocation('Galway City Centre');
    expect(result).toEqual(mockLocationCoords['galway city centre']);
  });

  it('is case-insensitive', () => {
    expect(coordsForLocation('SALTHILL')).toEqual(coordsForLocation('salthill'));
  });

  it('returns null for an unknown location', () => {
    expect(coordsForLocation('Narnia')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(coordsForLocation('')).toBeNull();
  });

  it('returns null when location is undefined/null', () => {
    expect(coordsForLocation(null)).toBeNull();
    expect(coordsForLocation(undefined)).toBeNull();
  });

  it('trims whitespace before lookup', () => {
    expect(coordsForLocation('  salthill  ')).toEqual(mockLocationCoords['salthill']);
  });

  it('finds coords from extraCoords when not in built-in map', () => {
    const extra = { 'custom place': { lat: 1, lng: 2 } };
    expect(coordsForLocation('Custom Place', extra)).toEqual({ lat: 1, lng: 2 });
  });

  it('built-in map takes priority over extraCoords for the same key', () => {
    const extra = { 'salthill': { lat: 0, lng: 0 } };
    expect(coordsForLocation('salthill', extra)).toEqual(mockLocationCoords['salthill']);
  });
});

// ─── supabaseImg ──────────────────────────────────────────────────────────────

describe('supabaseImg', () => {
  const SUPABASE = 'https://example.supabase.co';

  beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', SUPABASE); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('appends width and quality to a Supabase storage URL', () => {
    const url = `${SUPABASE}/storage/v1/object/public/avatars/user.jpg`;
    const result = supabaseImg(url, 200, 80);
    expect(result).toContain('width=200');
    expect(result).toContain('quality=80');
  });

  it('uses default quality of 80', () => {
    const url = `${SUPABASE}/storage/v1/object/public/avatars/user.jpg`;
    expect(supabaseImg(url, 300)).toContain('quality=80');
  });

  it('returns the original URL unchanged for non-Supabase URLs', () => {
    const url = 'https://example.com/image.jpg';
    expect(supabaseImg(url, 200)).toBe(url);
  });

  it('returns the original URL when url is null', () => {
    expect(supabaseImg(null, 200)).toBeNull();
  });

  it('appends with & when URL already has query params', () => {
    const url = `${SUPABASE}/storage/v1/object/public/avatars/user.jpg?existing=1`;
    const result = supabaseImg(url, 200);
    expect(result).toContain('existing=1');
    expect(result).toContain('&width=200');
  });
});
