import type { EngravingGrade } from '../api/types';

export interface EngravingGradeColor {
  label: string;
  icon: string;
  /** Tinted badge: light-mode background/text, then dark-mode background/text. */
  badgeClassName: string;
  /** Colored grade button, unselected. */
  buttonClassName: string;
  /** Colored grade button, selected. */
  buttonSelectedClassName: string;
}

/**
 * Single source of truth for engraving grade colors. Heraldry rarity and
 * status colors are separate and intentionally unchanged.
 */
export const ENGRAVING_GRADE_COLORS: Record<
  EngravingGrade,
  EngravingGradeColor
> = {
  rare: {
    label: 'Rare',
    icon: '◇',
    badgeClassName:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
    buttonClassName:
      'border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950',
    buttonSelectedClassName:
      'border border-indigo-500 bg-indigo-200 text-indigo-950 ring-2 ring-indigo-500 ring-offset-2 dark:border-indigo-400 dark:bg-indigo-900 dark:text-indigo-50 dark:ring-indigo-400 dark:ring-offset-slate-900',
  },
  epic: {
    label: 'Epic',
    icon: '◆',
    badgeClassName:
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    buttonClassName:
      'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950',
    buttonSelectedClassName:
      'border border-amber-500 bg-amber-200 text-amber-950 ring-2 ring-amber-500 ring-offset-2 dark:border-amber-400 dark:bg-amber-900 dark:text-amber-50 dark:ring-amber-400 dark:ring-offset-slate-900',
  },
  unique: {
    label: 'Unique',
    icon: '✦',
    badgeClassName:
      'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200',
    buttonClassName:
      'border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950',
    buttonSelectedClassName:
      'border border-fuchsia-500 bg-fuchsia-200 text-fuchsia-950 ring-2 ring-fuchsia-500 ring-offset-2 dark:border-fuchsia-400 dark:bg-fuchsia-900 dark:text-fuchsia-50 dark:ring-fuchsia-400 dark:ring-offset-slate-900',
  },
  legend: {
    label: 'Legend',
    icon: '★',
    badgeClassName:
      'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    buttonClassName:
      'border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950',
    buttonSelectedClassName:
      'border border-red-500 bg-red-200 text-red-950 ring-2 ring-red-500 ring-offset-2 dark:border-red-400 dark:bg-red-900 dark:text-red-50 dark:ring-red-400 dark:ring-offset-slate-900',
  },
};
