export const PAGE_SIZE = 10;

export interface PageSummary {
  /** 1-based page, clamped to the valid range. */
  readonly page: number;
  /** Always at least 1, even for an empty list. */
  readonly pageCount: number;
  readonly total: number;
  /** 1-based index of the first visible item; 0 for an empty list. */
  readonly start: number;
  /** 1-based index of the last visible item; 0 for an empty list. */
  readonly end: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export interface PagedItems<T> extends PageSummary {
  readonly items: T[];
}

function resolvePageSize(pageSize: number | undefined): number {
  if (pageSize === undefined || !Number.isFinite(pageSize)) return PAGE_SIZE;
  const floored = Math.floor(pageSize);
  return floored > 0 ? floored : PAGE_SIZE;
}

function normalizeTotal(total: number): number {
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, Math.floor(total));
}

export function getPageCount(total: number, pageSize?: number): number {
  const size = resolvePageSize(pageSize);
  return Math.max(1, Math.ceil(normalizeTotal(total) / size));
}

export function clampPage(
  page: number,
  total: number,
  pageSize?: number,
): number {
  const pageCount = getPageCount(total, pageSize);
  const normalized = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(normalized, 1), pageCount);
}

export function paginate<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize?: number,
): PagedItems<T> {
  const size = resolvePageSize(pageSize);
  const total = items.length;
  const pageCount = getPageCount(total, size);
  const page = clampPage(requestedPage, total, size);
  const offset = (page - 1) * size;
  const pageItems = items.slice(offset, offset + size);
  const start = pageItems.length === 0 ? 0 : offset + 1;
  const end = pageItems.length === 0 ? 0 : start + pageItems.length - 1;

  return {
    page,
    pageCount,
    total,
    start,
    end,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
    items: pageItems,
  };
}

export function formatPageRange(
  summary: PageSummary,
  itemPlural: string,
): string {
  return `Showing ${summary.start}–${summary.end} of ${summary.total} ${itemPlural}`;
}

export function formatPageStatus(page: number, pageCount: number): string {
  return `Page ${page} of ${pageCount}`;
}
