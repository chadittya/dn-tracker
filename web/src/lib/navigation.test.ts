import { describe, expect, it } from 'vitest';
import { keepsHeraldryPrefillOnHashChange } from './navigation';

describe('keepsHeraldryPrefillOnHashChange', () => {
  it('keeps the prefill for the hashchange caused by navigate()', () => {
    expect(
      keepsHeraldryPrefillOnHashChange('#/heraldry', '#/heraldry'),
    ).toBe(true);
  });

  it('clears the prefill for back/forward or a manual hash edit', () => {
    expect(keepsHeraldryPrefillOnHashChange(null, '#/heraldry')).toBe(false);
    expect(keepsHeraldryPrefillOnHashChange('#/heraldry', '#/matrix')).toBe(
      false,
    );
    expect(keepsHeraldryPrefillOnHashChange('#/dashboard', '#/heraldry')).toBe(
      false,
    );
  });
});
