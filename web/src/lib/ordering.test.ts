import { describe, expect, it } from 'vitest';
import {
  compareCreatedAtDesc,
  sortEntitiesForManage,
  sortLevelsDesc,
} from './ordering';

function entity(id: number, createdAt: string, name = `Item ${id}`) {
  return { id, name, createdAt };
}

function ids(items: ReadonlyArray<{ id: number }>): number[] {
  return items.map((item) => item.id);
}

describe('ordering helpers', () => {
  it('sorts newest created date first', () => {
    const items = [
      entity(1, '2024-01-01T00:00:00.000Z'),
      entity(3, '2024-03-01T00:00:00.000Z'),
      entity(2, '2024-02-01T00:00:00.000Z'),
    ];

    expect(ids(sortEntitiesForManage(items))).toEqual([3, 2, 1]);
  });

  it('breaks equal timestamps by id descending', () => {
    const timestamp = '2024-01-01T00:00:00.000Z';
    const items = [
      entity(9, timestamp),
      entity(10, timestamp),
      entity(2, timestamp),
    ];

    expect(ids(sortEntitiesForManage(items))).toEqual([10, 9, 2]);
  });

  it('compares instants written with different offsets', () => {
    const items = [
      entity(1, '2024-01-01T07:00:00+07:00'), // same instant as 00:00Z
      entity(2, '2024-01-01T00:00:00.000Z'),
      entity(3, '2023-12-31T23:00:00.000Z'),
    ];

    expect(ids(sortEntitiesForManage(items))).toEqual([2, 1, 3]);
  });

  it('sorts invalid timestamps after valid ones', () => {
    const items = [
      entity(1, 'not a date'),
      entity(2, '2024-01-01T00:00:00.000Z'),
      entity(3, ''),
    ];

    expect(ids(sortEntitiesForManage(items))).toEqual([2, 3, 1]);
  });

  it('never returns NaN from the comparator', () => {
    const first = entity(1, 'bad');
    const second = entity(2, 'also bad');
    const valid = entity(3, '2024-01-01T00:00:00.000Z');

    expect(Number.isNaN(compareCreatedAtDesc(first, second))).toBe(false);
    expect(Number.isNaN(compareCreatedAtDesc(second, first))).toBe(false);
    expect(Number.isNaN(compareCreatedAtDesc(first, valid))).toBe(false);
    expect(Number.isNaN(compareCreatedAtDesc(valid, first))).toBe(false);
  });

  it('does not mutate its input and keeps a rename in place', () => {
    const items = [
      entity(1, '2024-01-01T00:00:00.000Z', 'Old'),
      entity(2, '2024-02-01T00:00:00.000Z', 'New'),
    ];
    const before = items.map((item) => ({ ...item }));

    expect(ids(sortEntitiesForManage(items))).toEqual([2, 1]);
    expect(items).toEqual(before);

    const renamed = [
      entity(1, '2024-01-01T00:00:00.000Z', 'Renamed'),
      entity(2, '2024-02-01T00:00:00.000Z', 'New'),
    ];
    expect(ids(sortEntitiesForManage(renamed))).toEqual([2, 1]);
  });

  it('sorts levels descending without mutating the input', () => {
    const levels = [25, 30, 27];

    expect(sortLevelsDesc(levels)).toEqual([30, 27, 25]);
    expect(levels).toEqual([25, 30, 27]);
  });
});
