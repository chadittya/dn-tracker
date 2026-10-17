import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ApiError, isUniqueConstraintError } from '../errors';
import { parseId, parseName } from '../validation';
import type { NestRow } from '../progress';

function duplicateError(): ApiError {
  return new ApiError(409, 'DUPLICATE_NAME', 'A nest with that name already exists.');
}

export function createNestsRouter(db: Database.Database): Router {
  const router = Router();

  const selectOne = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM nests WHERE id = ?',
  );

  router.post('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    try {
      const result = db.prepare('INSERT INTO nests (name) VALUES (?)').run(name);
      const nest = selectOne.get(Number(result.lastInsertRowid)) as
        | NestRow
        | undefined;
      res.status(201).json({ nest });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw duplicateError();
      throw error;
    }
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    try {
      const result = db
        .prepare('UPDATE nests SET name = ? WHERE id = ?')
        .run(name, id);
      if (result.changes === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Nest not found.');
      }
      res.json({ nest: selectOne.get(id) });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw duplicateError();
      throw error;
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const result = db.prepare('DELETE FROM nests WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Nest not found.');
    }
    res.status(204).end();
  });

  return router;
}
