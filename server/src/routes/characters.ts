import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ApiError, isUniqueConstraintError } from '../errors';
import { parseId, parseName } from '../validation';
import type { CharacterRow } from '../progress';

function duplicateError(): ApiError {
  return new ApiError(
    409,
    'DUPLICATE_NAME',
    'A character with that name already exists.',
  );
}

export function createCharactersRouter(db: Database.Database): Router {
  const router = Router();

  const selectOne = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM characters WHERE id = ?',
  );

  router.post('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    try {
      const result = db
        .prepare('INSERT INTO characters (name) VALUES (?)')
        .run(name);
      const character = selectOne.get(Number(result.lastInsertRowid)) as
        | CharacterRow
        | undefined;
      res.status(201).json({ character });
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
        .prepare('UPDATE characters SET name = ? WHERE id = ?')
        .run(name, id);
      if (result.changes === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
      }
      res.json({ character: selectOne.get(id) });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw duplicateError();
      throw error;
    }
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const result = db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }
    res.status(204).end();
  });

  return router;
}
