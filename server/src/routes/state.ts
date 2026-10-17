import { Router } from 'express';
import type Database from 'better-sqlite3';
import { buildDashboard } from '../progress';
import type { CharacterRow, NestRow, RunRow } from '../progress';
import { getWeekInfo } from '../week';

export function createStateRouter(
  db: Database.Database,
  now: () => Date,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const info = getWeekInfo(now());

    const characters = db
      .prepare(
        `SELECT id, name, created_at AS createdAt
           FROM characters
          ORDER BY name COLLATE NOCASE, id`,
      )
      .all() as CharacterRow[];

    const nests = db
      .prepare(
        `SELECT id, name, created_at AS createdAt
           FROM nests
          ORDER BY name COLLATE NOCASE, id`,
      )
      .all() as NestRow[];

    const runs = db
      .prepare(
        `SELECT character_id AS characterId, nest_id AS nestId,
                week_key AS weekKey, completed_at AS completedAt
           FROM runs
          WHERE week_key = ?
          ORDER BY character_id, nest_id`,
      )
      .all(info.weekKey) as RunRow[];

    res.json({
      weekKey: info.weekKey,
      weekStartAt: info.weekStartAt.toISOString(),
      nextResetAt: info.nextResetAt.toISOString(),
      serverNow: now().toISOString(),
      characters,
      nests,
      runs,
      dashboard: buildDashboard(characters, nests, runs),
    });
  });

  return router;
}
