import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  clampPage,
  formatPageRange,
  formatPageStatus,
  getPageCount,
  paginate,
} from './pagination';

function numbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

describe('pagination helpers', () => {
  it('uses a page size of 10', () => {
    expect(PAGE_SIZE).toBe(10);
  });

  describe('getPageCount', () => {
    it('counts pages for empty, exact and partial lists', () => {
      expect(getPageCount(0)).toBe(1);
      expect(getPageCount(1)).toBe(1);
      expect(getPageCount(10)).toBe(1);
      expect(getPageCount(11)).toBe(2);
      expect(getPageCount(20)).toBe(2);
      expect(getPageCount(21)).toBe(3);
    });

    it('sanitizes non-finite and negative totals', () => {
      expect(getPageCount(-5)).toBe(1);
      expect(getPageCount(Number.NaN)).toBe(1);
      expect(getPageCount(Number.POSITIVE_INFINITY)).toBe(1);
    });
  });

  describe('clampPage', () => {
    it('clamps pages below 1 and above the last page', () => {
      expect(clampPage(0, 25)).toBe(1);
      expect(clampPage(-3, 25)).toBe(1);
      expect(clampPage(99, 25)).toBe(3);
    });

    it('maps non-finite pages to page 1', () => {
      expect(clampPage(Number.NaN, 25)).toBe(1);
      expect(clampPage(Number.POSITIVE_INFINITY, 25)).toBe(1);
    });

    it('floors fractional pages', () => {
      expect(clampPage(2.9, 25)).toBe(2);
    });

    it('clamps to the new last page when the list shrinks', () => {
      expect(clampPage(3, 15)).toBe(2);
    });

    it('returns page 1 for an empty list', () => {
      expect(clampPage(4, 0)).toBe(1);
    });
  });

  describe('paginate', () => {
    it('handles an empty list', () => {
      expect(paginate([], 1)).toEqual({
        page: 1,
        pageCount: 1,
        total: 0,
        start: 0,
        end: 0,
        hasPrevious: false,
        hasNext: false,
        items: [],
      });
    });

    it('handles a single item', () => {
      const paged = paginate(['a'], 1);

      expect(paged.items).toEqual(['a']);
      expect(paged.start).toBe(1);
      expect(paged.end).toBe(1);
      expect(paged.pageCount).toBe(1);
      expect(paged.hasPrevious).toBe(false);
      expect(paged.hasNext).toBe(false);
    });

    it('keeps exactly 10 items on one page', () => {
      const paged = paginate(numbers(10), 1);

      expect(paged.items).toEqual(numbers(10));
      expect(paged.pageCount).toBe(1);
      expect(paged.hasNext).toBe(false);
    });

    it('slices 11 items into two pages', () => {
      const first = paginate(numbers(11), 1);
      const second = paginate(numbers(11), 2);

      expect(first.items).toEqual(numbers(10));
      expect(first.start).toBe(1);
      expect(first.end).toBe(10);
      expect(first.hasPrevious).toBe(false);
      expect(first.hasNext).toBe(true);

      expect(second.items).toEqual([11]);
      expect(second.start).toBe(11);
      expect(second.end).toBe(11);
      expect(second.hasPrevious).toBe(true);
      expect(second.hasNext).toBe(false);
    });

    it('handles exactly 20 items across two full pages', () => {
      const first = paginate(numbers(20), 1);
      const second = paginate(numbers(20), 2);

      expect(first.pageCount).toBe(2);
      expect(first.items).toEqual(numbers(10));
      expect(second.items).toEqual(numbers(20).slice(10));
      expect(second.items).toHaveLength(10);
      expect(second.hasNext).toBe(false);
    });

    it('slices 21 items into a short last page', () => {
      const last = paginate(numbers(21), 3);

      expect(last.pageCount).toBe(3);
      expect(last.items).toEqual([21]);
      expect(last.start).toBe(21);
      expect(last.end).toBe(21);
      expect(last.hasPrevious).toBe(true);
      expect(last.hasNext).toBe(false);
    });

    it('clamps out-of-range requested pages', () => {
      expect(paginate(numbers(25), 0).page).toBe(1);
      expect(paginate(numbers(25), 99).page).toBe(3);
      expect(paginate(numbers(25), Number.NaN).page).toBe(1);
      expect(paginate(numbers(25), Number.POSITIVE_INFINITY).page).toBe(1);
    });

    it('preserves source order and does not mutate the input', () => {
      const items = numbers(21);
      const before = [...items];
      const paged = paginate(items, 2);

      expect(paged.items).toEqual(numbers(21).slice(10, 20));
      expect(items).toEqual(before);

      paged.items.push(999);
      expect(items).toEqual(before);
    });
  });

  describe('formatPageRange', () => {
    it('formats the first, middle and last page', () => {
      expect(formatPageRange(paginate(numbers(25), 1), 'characters')).toBe(
        'Showing 1–10 of 25 characters',
      );
      expect(formatPageRange(paginate(numbers(25), 2), 'characters')).toBe(
        'Showing 11–20 of 25 characters',
      );
      expect(formatPageRange(paginate(numbers(25), 3), 'characters')).toBe(
        'Showing 21–25 of 25 characters',
      );
    });

    it('formats the empty-list range', () => {
      expect(formatPageRange(paginate([], 1), 'characters')).toBe(
        'Showing 0–0 of 0 characters',
      );
    });
  });

  it('formats the page status', () => {
    expect(formatPageStatus(2, 3)).toBe('Page 2 of 3');
  });
});
