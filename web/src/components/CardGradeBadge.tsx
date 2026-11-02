import type { CardGrade } from '../api/types';
import { CARD_GRADE_COLORS } from '../lib/engravingColors';

export function CardGradeBadge({
  grade,
  className = '',
}: {
  grade: CardGrade;
  className?: string;
}) {
  const meta = CARD_GRADE_COLORS[grade];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClassName} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
