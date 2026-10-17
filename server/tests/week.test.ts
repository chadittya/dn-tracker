import { afterEach, describe, expect, it } from 'vitest';
import {
  getNextResetAt,
  getWeekInfo,
  getWeekKey,
  isValidWeekKey,
} from '../src/week';

const at = (iso: string) => new Date(iso);

describe('getWeekInfo', () => {
  it('keeps Saturday 07:59:59 WIB in the previous week', () => {
    // 2026-10-17T00:59:59Z = Saturday 07:59:59 WIB
    const info = getWeekInfo(at('2026-10-17T00:59:59.000Z'));
    expect(info.weekKey).toBe('2026-10-10');
    expect(info.weekStartAt.toISOString()).toBe('2026-10-10T01:00:00.000Z');
    expect(info.nextResetAt.toISOString()).toBe('2026-10-17T01:00:00.000Z');
  });

  it('keeps Saturday 07:59:59.999 WIB in the previous week', () => {
    expect(getWeekKey(at('2026-10-17T00:59:59.999Z'))).toBe('2026-10-10');
  });

  it('starts the new week exactly at Saturday 08:00:00 WIB', () => {
    const info = getWeekInfo(at('2026-10-17T01:00:00.000Z'));
    expect(info.weekKey).toBe('2026-10-17');
    expect(info.weekStartAt.toISOString()).toBe('2026-10-17T01:00:00.000Z');
    expect(info.nextResetAt.toISOString()).toBe('2026-10-24T01:00:00.000Z');
  });

  it('keeps the new week immediately after 08:00:00 WIB', () => {
    expect(getWeekKey(at('2026-10-17T01:00:00.001Z'))).toBe('2026-10-17');
  });

  it('maps all of Friday to the previous Saturday', () => {
    // Friday 00:00 WIB = Thursday 17:00Z
    expect(getWeekKey(at('2026-10-15T17:00:00.000Z'))).toBe('2026-10-10');
    // Friday 23:59:59 WIB = Friday 16:59:59Z
    expect(getWeekKey(at('2026-10-16T16:59:59.000Z'))).toBe('2026-10-10');
  });

  it('maps Saturday midnight WIB to the previous week', () => {
    // Saturday 00:00 WIB = Friday 17:00Z
    expect(getWeekKey(at('2026-10-16T17:00:00.000Z'))).toBe('2026-10-10');
  });

  it('maps Sunday midnight WIB to the Saturday that just reset', () => {
    // Sunday 00:00 WIB = Saturday 17:00Z
    expect(getWeekKey(at('2026-10-17T17:00:00.000Z'))).toBe('2026-10-17');
  });

  it('handles midweek times', () => {
    // Wednesday 12:00 WIB
    expect(getWeekKey(at('2026-10-21T05:00:00.000Z'))).toBe('2026-10-17');
  });

  it('crosses month and year boundaries', () => {
    // Friday 2027-01-01 00:00 WIB = 2026-12-31T17:00Z
    expect(getWeekKey(at('2026-12-31T17:00:00.000Z'))).toBe('2026-12-26');
    // Saturday 2027-01-02 08:00 WIB = 2027-01-02T01:00Z
    expect(getWeekKey(at('2027-01-02T01:00:00.000Z'))).toBe('2027-01-02');
  });

  it('handles leap-day weeks', () => {
    // Tuesday 2028-02-29 12:00 WIB
    expect(getWeekKey(at('2028-02-29T05:00:00.000Z'))).toBe('2028-02-26');
  });

  it('rejects an invalid date', () => {
    expect(() => getWeekInfo(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('always produces start + 7 days = next reset and a Saturday key', () => {
    const samples = [
      '2026-10-17T01:00:00.000Z',
      '2026-10-16T16:59:59.000Z',
      '2026-10-17T17:00:00.000Z',
      '2027-01-02T01:00:00.000Z',
      '2028-02-29T05:00:00.000Z',
    ];
    for (const iso of samples) {
      const info = getWeekInfo(at(iso));
      expect(info.nextResetAt.getTime() - info.weekStartAt.getTime()).toBe(
        7 * 24 * 60 * 60 * 1000,
      );
      expect(isValidWeekKey(info.weekKey)).toBe(true);
    }
  });
});

describe('getNextResetAt', () => {
  it('returns the next Saturday 08:00 WIB after a reset', () => {
    expect(getNextResetAt(at('2026-10-17T01:00:00.000Z')).toISOString()).toBe(
      '2026-10-24T01:00:00.000Z',
    );
  });

  it('returns the upcoming reset when before Saturday 08:00', () => {
    expect(getNextResetAt(at('2026-10-17T00:59:59.000Z')).toISOString()).toBe(
      '2026-10-17T01:00:00.000Z',
    );
  });

  it('moves to the following week after the reset instant', () => {
    expect(getNextResetAt(at('2026-10-17T01:00:00.001Z')).toISOString()).toBe(
      '2026-10-24T01:00:00.000Z',
    );
  });
});

describe('host timezone independence', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it('returns identical results under different process timezones', () => {
    const now = at('2026-10-17T00:59:59.000Z');
    const expected = getWeekInfo(now);

    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Jakarta']) {
      process.env.TZ = tz;
      const actual = getWeekInfo(now);
      expect(actual.weekKey).toBe(expected.weekKey);
      expect(actual.weekStartAt.toISOString()).toBe(
        expected.weekStartAt.toISOString(),
      );
      expect(actual.nextResetAt.toISOString()).toBe(
        expected.nextResetAt.toISOString(),
      );
    }
  });
});

describe('isValidWeekKey', () => {
  it('accepts real Saturday dates', () => {
    expect(isValidWeekKey('2026-10-17')).toBe(true);
    expect(isValidWeekKey('2026-10-10')).toBe(true);
    expect(isValidWeekKey('2028-02-26')).toBe(true);
  });

  it('rejects non-Saturdays', () => {
    expect(isValidWeekKey('2026-10-16')).toBe(false);
    expect(isValidWeekKey('2026-10-18')).toBe(false);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidWeekKey('2026-1-17')).toBe(false);
    expect(isValidWeekKey('not-a-date')).toBe(false);
    expect(isValidWeekKey('2026-02-30')).toBe(false);
    expect(isValidWeekKey('2026-10-17T00:00:00Z')).toBe(false);
  });
});
