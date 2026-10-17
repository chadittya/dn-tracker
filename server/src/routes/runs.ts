import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ApiError } from '../errors';
import { parseBoolean, parseId } from '../validation';
import { getWeekInfo } from '../week';

export function createRunsRouter(
  db: Database.Database,
  now: () => Date,
): Router {
  const router = Router();

  router.put('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const characterId = parseId(body.characterId, 'characterId');
    const nestId = parseId(body.nestId, 'nestId');
    const done = parseBoolean(body.done, 'done');

    const character = db
      .prepare('SELECT id FROM characters WHERE id = ?')
      .get(characterId);
    if (!character) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    const nest = db.prepare('SELECT id FROM nests WHERE id = ?').get(nestId);
    if (!nest) {
      throw new ApiError(404, 'NOT_FOUND', 'Nest not found.');
    }

    const info = getWeekInfo(now());

    const apply = db.transaction(() => {
      if (done) {
        db.prepare(
          `INSERT OR IGNORE INTO runs (character_id, nest_id, week_key)
           VALUES (?, ?, ?)`,
        ).run(characterId, nestId, info.weekKey);
      } else {
        db.prepare(
          `DELETE FROM runs
            WHERE character_id = ? AND nest_id = ? AND week_key = ?`,
        ).run(characterId, nestId, info.weekKey);
      }
    });

    apply();

    res.json({
      done,
      weekKey: info.weekKey,
      nextResetAt: info.nextResetAt.toISOString(),
    });
  });

  return router;
}
