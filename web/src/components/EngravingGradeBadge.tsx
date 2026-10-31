import type { EngravingGrade } from '../api/types';
import { ENGRAVING_GRADE_COLORS } from '../lib/engravingColors';

export function EngravingGradeBadge({
  grade,
  className = '',
}: {
  grade: EngravingGrade;
  className?: string;
}) {
  const meta = ENGRAVING_GRADE_COLORS[grade];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClassName} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
