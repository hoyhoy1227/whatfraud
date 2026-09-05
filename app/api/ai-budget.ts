import type { D1Database } from '@cloudflare/workers-types';

// A single atomic statement reserves before generating, across Worker isolates.
// UTC fixed windows; failed/aborted requests are intentionally not refunded.
export const RESERVE_SQL = `
INSERT INTO ai_budget (id, day, minute, day_count, minute_count)
VALUES (1, ?1, ?2, 1, 1)
ON CONFLICT(id) DO UPDATE SET
  day = excluded.day,
  minute = excluded.minute,
  day_count = CASE WHEN ai_budget.day = excluded.day THEN ai_budget.day_count + 1 ELSE 1 END,
  minute_count = CASE WHEN ai_budget.minute = excluded.minute THEN ai_budget.minute_count + 1 ELSE 1 END
WHERE (ai_budget.day != excluded.day OR ai_budget.day_count < ?3)
  AND (ai_budget.minute != excluded.minute OR ai_budget.minute_count < ?4)
RETURNING day_count
`;

export async function reserveSharedBudget(): Promise<'allowed' | 'exhausted' | 'unavailable'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { env } = await import('cloudflare:workers');
    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) return 'unavailable';
    const now = Date.now();
    const result = await Promise.race([
      db.prepare(RESERVE_SQL).bind(Math.floor(now / 86_400_000), Math.floor(now / 60_000), 240, 20).first(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('budget timeout')),1_200);}),
    ]);
    return result ? 'allowed' : 'exhausted';
  } catch {
    return 'unavailable';
  } finally {
    if (timer) clearTimeout(timer);
  }
}
