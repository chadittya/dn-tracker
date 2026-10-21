import type { HeraldryStatus } from '../api/types';

const STATUS_META: Record<
  HeraldryStatus,
  { label: string; icon: string; className: string }
> = {
  ok: {
    label: 'OK',
    icon: '✓',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  },
  recommended: {
    label: 'Recommended',
    icon: '!',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  'needs-upgrade': {
    label: 'Needs upgrade',
    icon: '↑',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  },
};

export function HeraldryStatusBadge({
  status,
  className = '',
}: {
  status: HeraldryStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className} ${className}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
