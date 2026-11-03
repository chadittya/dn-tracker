import { describe, expect, it } from 'vitest';
import {
  MANAGE_SECTIONS,
  pickActiveSectionIndex,
} from './manageSections';

describe('MANAGE_SECTIONS', () => {
  it('follows the Manage page order with unique element ids', () => {
    expect(MANAGE_SECTIONS.map((section) => section.label)).toEqual([
      'Characters',
      'Nests',
      'Plates',
      'Plate levels',
      'Engraving values',
      'Cards',
    ]);

    const elementIds = MANAGE_SECTIONS.map((section) => section.elementId);
    expect(new Set(elementIds).size).toBe(elementIds.length);
  });
});

describe('pickActiveSectionIndex', () => {
  const tops = [100, 800, 1500, 2200];

  it('picks the last section at or above the threshold', () => {
    expect(pickActiveSectionIndex(tops, 50, false)).toBe(0);
    expect(pickActiveSectionIndex(tops, 100, false)).toBe(0);
    expect(pickActiveSectionIndex(tops, 900, false)).toBe(1);
    expect(pickActiveSectionIndex(tops, 2500, false)).toBe(3);
  });

  it('picks the last section at the page bottom', () => {
    expect(pickActiveSectionIndex(tops, 50, true)).toBe(3);
  });

  it('returns 0 for an empty section list', () => {
    expect(pickActiveSectionIndex([], 500, false)).toBe(0);
    expect(pickActiveSectionIndex([], 500, true)).toBe(0);
  });
});
