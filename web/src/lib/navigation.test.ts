import { describe, expect, it } from 'vitest';
import {
  TABS,
  characterPrefillForTab,
  keepsCharacterPrefillOnHashChange,
  parseTabFromHash,
} from './navigation';

describe('tabs', () => {
  it('lists the tabs in the approved order', () => {
    expect(TABS.map((tab) => tab.id)).toEqual([
      'runs',
      'matrix',
      'heraldry',
      'engraving',
      'cards',
      'dashboard',
      'backup',
      'manage',
    ]);
  });

  it('reads the Engraving hash and falls back to Runs', () => {
    expect(parseTabFromHash('#/engraving')).toBe('engraving');
    expect(parseTabFromHash('#engraving')).toBe('engraving');
    expect(parseTabFromHash('#/cards')).toBe('cards');
    expect(parseTabFromHash('#/unknown')).toBe('runs');
    expect(parseTabFromHash('')).toBe('runs');
  });
});

describe('keepsCharacterPrefillOnHashChange', () => {
  it('keeps the prefill for the hashchange caused by navigate()', () => {
    expect(
      keepsCharacterPrefillOnHashChange('#/heraldry', '#/heraldry'),
    ).toBe(true);
    expect(
      keepsCharacterPrefillOnHashChange('#/engraving', '#/engraving'),
    ).toBe(true);
  });

  it('clears the prefill for back/forward or a manual hash edit', () => {
    expect(keepsCharacterPrefillOnHashChange(null, '#/heraldry')).toBe(false);
    expect(keepsCharacterPrefillOnHashChange('#/heraldry', '#/matrix')).toBe(
      false,
    );
    expect(keepsCharacterPrefillOnHashChange('#/dashboard', '#/heraldry')).toBe(
      false,
    );
  });
});

describe('characterPrefillForTab', () => {
  it('applies a Heraldry prefill only to Heraldry', () => {
    const prefill = { tab: 'heraldry' as const, characterQuery: 'Raven' };
    expect(characterPrefillForTab(prefill, 'heraldry')).toBe('Raven');
    expect(characterPrefillForTab(prefill, 'engraving')).toBeUndefined();
  });

  it('applies an Engraving prefill only to Engraving', () => {
    const prefill = { tab: 'engraving' as const, characterQuery: 'Luna' };
    expect(characterPrefillForTab(prefill, 'engraving')).toBe('Luna');
    expect(characterPrefillForTab(prefill, 'heraldry')).toBeUndefined();
  });

  it('has no prefill without a Dashboard row click', () => {
    expect(characterPrefillForTab(undefined, 'engraving')).toBeUndefined();
  });
});
