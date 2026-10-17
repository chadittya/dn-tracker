import { useEffect, useState } from 'react';

/**
 * Milliseconds remaining until `targetIso` according to the server clock.
 * `serverClockOffsetMs` = server time minus client time at fetch.
 */
export function useCountdown(
  targetIso: string | null,
  serverClockOffsetMs: number,
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!targetIso) return 0;

  return Math.max(
    0,
    Date.parse(targetIso) - (nowMs + serverClockOffsetMs),
  );
}
