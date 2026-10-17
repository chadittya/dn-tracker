/**
 * All week/reset logic lives here.
 *
 * The app's week boundary is Saturday 08:00 WIB (UTC+7, no DST). A week_key is
 * the WIB calendar date (YYYY-MM-DD) of the Saturday that started the week.
 *
 * Everything below uses epoch milliseconds and UTC getters only. WIB has a
 * fixed offset, so the host machine's timezone can never affect the result.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const RESET_HOUR_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface WeekInfo {
  /** YYYY-MM-DD date of the active Saturday 08:00 WIB. */
  weekKey: string;
  /** The active Saturday 08:00 WIB as a real instant. */
  weekStartAt: Date;
  /** The next Saturday 08:00 WIB as a real instant. */
  nextResetAt: Date;
}

function formatDateKey(ms: number): string {
  const d = new Date(ms);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekInfo(now: Date = new Date()): WeekInfo {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError('Invalid date passed to getWeekInfo');
  }

  // Express the WIB wall clock as if it were UTC.
  const wibShiftedMs = nowMs + WIB_OFFSET_MS;
  const wibDay = new Date(wibShiftedMs).getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysSinceSaturday = (wibDay + 1) % 7;
  const startOfWibDayMs = Math.floor(wibShiftedMs / DAY_MS) * DAY_MS;

  let candidateShiftedMs =
    startOfWibDayMs - daysSinceSaturday * DAY_MS + RESET_HOUR_MS;

  // Before Saturday 08:00 WIB the most recent reset is a week earlier.
  if (wibShiftedMs < candidateShiftedMs) {
    candidateShiftedMs -= WEEK_MS;
  }

  const weekStartMs = candidateShiftedMs - WIB_OFFSET_MS;

  return {
    weekKey: formatDateKey(candidateShiftedMs),
    weekStartAt: new Date(weekStartMs),
    nextResetAt: new Date(weekStartMs + WEEK_MS),
  };
}

export function getWeekKey(now: Date): string {
  return getWeekInfo(now).weekKey;
}

export function getNextResetAt(now: Date): Date {
  return getWeekInfo(now).nextResetAt;
}

/**
 * A valid week_key is a real calendar date (YYYY-MM-DD) that falls on a
 * Saturday, because week keys are always reset Saturdays in WIB.
 */
export function isValidWeekKey(key: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || year > 9999) return false;

  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return false;
  }

  return d.getUTCDay() === 6;
}
