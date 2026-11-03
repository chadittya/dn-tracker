import { describe, expect, it } from 'vitest';
import {
  MANAGE_SCROLL_OFFSET_PX,
  MANAGE_SECTIONS,
  MANAGE_SPY_TOLERANCE_PX,
  manageSpyThreshold,
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

describe('Manage spy threshold', () => {
  const header = 80;
  const scrollY = 0;
  const threshold = manageSpyThreshold(header, scrollY);

  it('sits the full tolerance above the click scroll offset', () => {
    expect(MANAGE_SPY_TOLERANCE_PX).toBeGreaterThan(0);
    expect(threshold).toBe(
      header + MANAGE_SCROLL_OFFSET_PX + MANAGE_SPY_TOLERANCE_PX,
    );
    expect(threshold - (header + MANAGE_SCROLL_OFFSET_PX)).toBe(
      MANAGE_SPY_TOLERANCE_PX,
    );
  });

  it('keeps a top exactly at the threshold active', () => {
    expect(
      pickActiveSectionIndex([100, threshold, 1500], threshold, false),
    ).toBe(1);
  });

  it('keeps a top half a pixel above the threshold active', () => {
    expect(
      pickActiveSectionIndex(
        [100, threshold - 0.5, 1500],
        threshold,
        false,
      ),
    ).toBe(1);
  });

  it('moves to the previous section only half a pixel below the threshold', () => {
    expect(
      pickActiveSectionIndex(
        [100, threshold + 0.5, 1500],
        threshold,
        false,
      ),
    ).toBe(0);
  });

  it('keeps a click-placed section active across repeated evaluation', () => {
    const clickScrollY = 640;
    // The browser places the clicked section at scroll-margin (header + 24).
    const clickedTop =
      clickScrollY + header + MANAGE_SCROLL_OFFSET_PX;
    const clickTops = [100, clickedTop, 2000];
    const clickThreshold = manageSpyThreshold(header, clickScrollY);

    const first = pickActiveSectionIndex(clickTops, clickThreshold, false);
    const second = pickActiveSectionIndex(clickTops, clickThreshold, false);

    expect(first).toBe(1);
    expect(second).toBe(first);
  });

  it('keeps a click-placed section active after half-pixel rounding', () => {
    const clickScrollY = 640;
    const clickedTop =
      clickScrollY + header + MANAGE_SCROLL_OFFSET_PX + 0.5;
    const clickThreshold = manageSpyThreshold(header, clickScrollY);

    expect(
      pickActiveSectionIndex([100, clickedTop, 2000], clickThreshold, false),
    ).toBe(1);
  });
});
