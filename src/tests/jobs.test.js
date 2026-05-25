import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing jobs.js (which imports it at module level)
vi.mock('../lib/supabase', () => ({
  supabase: {},
  withTimeout: vi.fn(),
}));

import { toJobSlug, fromJobSlug, normaliseJobRow } from '../lib/jobs';

// ─── toJobSlug ────────────────────────────────────────────────────────────────

describe('toJobSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toJobSlug('Barista')).toBe('barista');
    expect(toJobSlug('Head Chef')).toBe('head-chef');
  });

  it('strips non-alphanumeric characters', () => {
    expect(toJobSlug('Café Manager')).toBe('cafe-manager');
    expect(toJobSlug('Part-Time Sales!')).toBe('part-time-sales');
  });

  it('handles Irish accented characters (NFD normalisation)', () => {
    expect(toJobSlug('Óstán Manager')).toBe('ostan-manager');
    expect(toJobSlug('Séan')).toBe('sean');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(toJobSlug('  Head   Chef  ')).toBe('head-chef');
    expect(toJobSlug('part--time')).toBe('part-time');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toJobSlug('- Barista -')).toBe('barista');
  });

  it('returns empty string for empty input', () => {
    expect(toJobSlug('')).toBe('');
    expect(toJobSlug(null)).toBe('');
    expect(toJobSlug(undefined)).toBe('');
  });

  it('handles all-numeric strings', () => {
    expect(toJobSlug('123')).toBe('123');
  });
});

// ─── fromJobSlug ──────────────────────────────────────────────────────────────

describe('fromJobSlug', () => {
  it('replaces hyphens with spaces', () => {
    expect(fromJobSlug('head-chef')).toBe('head chef');
    expect(fromJobSlug('part-time-barista')).toBe('part time barista');
  });

  it('returns single words unchanged', () => {
    expect(fromJobSlug('barista')).toBe('barista');
  });

  it('handles empty string', () => {
    expect(fromJobSlug('')).toBe('');
  });
});

// ─── normaliseJobRow ──────────────────────────────────────────────────────────

describe('normaliseJobRow', () => {
  const base = {
    id: 1,
    title: 'Barista',
    category: 'Hospitality',
    location: 'Galway City Centre',
    lat: 53.27,
    lng: -9.06,
    pay: '€13/hr',
    description: 'Make coffee.',
    deadline: '2026-08-01',
    days: ['Monday', 'Tuesday'],
    times: { Monday: '09:00', Tuesday: ['10:00', '14:00'] },
    weekend_required: true,
    sick_pay: true,
    holidays: '4 weeks',
    photos: ['https://example.com/photo.jpg'],
    photo_crops: [{ zoom: 1, offsetX: 0, offsetY: 0 }],
    filled_shifts: ['Monday'],
    status: 'Active',
    updated_at: '2026-05-01T00:00:00Z',
    created_at: '2026-04-01T00:00:00Z',
    company_id: 'abc-123',
  };

  it('maps all fields correctly', () => {
    const result = normaliseJobRow(base, 'Acme Café');
    expect(result.id).toBe(1);
    expect(result.title).toBe('Barista');
    expect(result.company).toBe('Acme Café');
    expect(result.location).toBe('Galway City Centre');
    expect(result.pay).toBe('€13/hr');
    expect(result.days).toEqual(['Monday', 'Tuesday']);
    expect(result.weekendRequired).toBe(true);
    expect(result.sickPay).toBe(true);
    expect(result.filledShifts).toEqual(['Monday']);
    expect(result.status).toBe('Active');
  });

  it('normalises times — wraps single string values in an array', () => {
    const result = normaliseJobRow(base, 'Acme');
    expect(result.times.Monday).toEqual(['09:00']);
    expect(result.times.Tuesday).toEqual(['10:00', '14:00']);
  });

  it('falls back to "Unknown Company" when companyName is missing', () => {
    expect(normaliseJobRow(base, null).company).toBe('Unknown Company');
    expect(normaliseJobRow(base, undefined).company).toBe('Unknown Company');
    expect(normaliseJobRow(base, '').company).toBe('Unknown Company');
  });

  it('uses empty array defaults for missing array fields', () => {
    const sparse = { ...base, days: undefined, photos: undefined, filled_shifts: undefined };
    const result = normaliseJobRow(sparse, 'Acme');
    expect(result.days).toEqual([]);
    expect(result.photos).toEqual([]);
    expect(result.filledShifts).toEqual([]);
  });

  it('uses empty object default for missing times', () => {
    const sparse = { ...base, times: undefined };
    expect(normaliseJobRow(sparse, 'Acme').times).toEqual({});
  });

  it('passes through null deadline', () => {
    const result = normaliseJobRow({ ...base, deadline: null }, 'Acme');
    expect(result.deadline).toBeNull();
  });
});
