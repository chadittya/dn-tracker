import { describe, expect, it } from 'vitest';
import {
  addedLevelNote,
  addedNote,
  changedCardGradeNote,
  removedCardNote,
} from './notes';

describe('note text', () => {
  it('formats add notes with and without an active search', () => {
    expect(addedNote('Red Dragon', false)).toBe('Added Red Dragon.');
    expect(addedNote('Red Dragon', true)).toBe(
      'Added Red Dragon. It is hidden by your current search.',
    );
  });

  it('formats plate level add notes', () => {
    expect(addedLevelNote(70)).toBe('Added Level 70.');
  });

  it('formats grade changes and removals', () => {
    expect(changedCardGradeNote('Red Dragon', 'Legend')).toBe(
      'Changed Red Dragon to Legend.',
    );
    expect(removedCardNote('Red Dragon', 'Aria')).toBe(
      'Removed Red Dragon from Aria.',
    );
  });
});
