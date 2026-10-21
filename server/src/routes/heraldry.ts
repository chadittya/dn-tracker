import { Router } from 'express';
import type Database from 'better-sqlite3';
import {
  ApiError,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from '../errors';
import { buildSlotState } from '../heraldry';
import type { HeraldryRow, PlateRow } from '../heraldry';
import { readLevels } from '../heraldryData';
import {
  parseBoolean,
  parseId,
  parseName,
  parsePositiveInteger,
  parseRarity,
  parseSlot,
} from '../validation';

interface AffectedSlotRow {
  characterId: number;
  characterName: string;
  plateId: number;
  plateName: string;
  slot: number;
}

function duplicatePlateError(plateName: string, slot: number): ApiError {
  return new ApiError(
    409,
    'DUPLICATE_PLATE',
    `Plate "${plateName}" is already used in slot ${slot}.`,
    { conflictingSlot: slot },
  );
}

function levelInUseError(
  value: number,
  affectedSlots: AffectedSlotRow[],
): ApiError {
  const affectedCount = affectedSlots.length;
  const message =
    affectedCount === 0
      ? `Level ${value} is used by heraldry slots.`
      : `Level ${value} is used by ${affectedCount} heraldry slot${
          affectedCount === 1 ? '' : 's'
        }.`;

  return new ApiError(409, 'LEVEL_IN_USE', message, {
    affectedCount,
    affectedSlots,
  });
}

export function createHeraldryRouter(db: Database.Database): Router {
  const router = Router();

  const selectPlate = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM plates WHERE id = ?',
  );
  const selectCharacter = db.prepare('SELECT id FROM characters WHERE id = ?');
  const selectLevel = db.prepare('SELECT value FROM plate_levels WHERE value = ?');
  const selectAffectedSlots = db.prepare(
    `SELECT ch.character_id AS characterId, c.name AS characterName,
            ch.plate_id AS plateId, p.name AS plateName, ch.slot
       FROM character_heraldry ch
       JOIN characters c ON c.id = ch.character_id
       JOIN plates p ON p.id = ch.plate_id
      WHERE ch.level = ?
      ORDER BY c.name COLLATE NOCASE, ch.slot`,
  );
  const readAffectedSlots = (value: number): AffectedSlotRow[] =>
    selectAffectedSlots.all(value) as AffectedSlotRow[];

  router.post('/levels', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const value = parsePositiveInteger(body.value, 'value');

    try {
      db.prepare('INSERT INTO plate_levels (value) VALUES (?)').run(value);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(
          409,
          'DUPLICATE_LEVEL',
          `Level ${value} already exists.`,
        );
      }
      throw error;
    }

    res.status(201).json({ level: { value } });
  });

  router.delete('/levels/:value', (req, res) => {
    const value = parsePositiveInteger(req.params.value, 'value');

    const affected = readAffectedSlots(value);

    if (affected.length > 0) {
      throw levelInUseError(value, affected);
    }

    try {
      const changes = db
        .prepare('DELETE FROM plate_levels WHERE value = ?')
        .run(value).changes;
      if (changes === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Level not found.');
      }
    } catch (error) {
      if (isForeignKeyConstraintError(error)) {
        throw levelInUseError(value, readAffectedSlots(value));
      }
      throw error;
    }

    res.status(204).end();
  });

  router.post('/plates', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    try {
      const result = db.prepare('INSERT INTO plates (name) VALUES (?)').run(name);
      const plate = selectPlate.get(Number(result.lastInsertRowid)) as
        | PlateRow
        | undefined;
      res.status(201).json({ plate });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(
          409,
          'DUPLICATE_NAME',
          'A plate with that name already exists.',
        );
      }
      throw error;
    }
  });

  router.patch('/plates/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    try {
      const result = db
        .prepare('UPDATE plates SET name = ? WHERE id = ?')
        .run(name, id);
      if (result.changes === 0) {
        throw new ApiError(404, 'NOT_FOUND', 'Plate not found.');
      }
      res.json({ plate: selectPlate.get(id) });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(
          409,
          'DUPLICATE_NAME',
          'A plate with that name already exists.',
        );
      }
      throw error;
    }
  });

  router.delete('/plates/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const result = db.prepare('DELETE FROM plates WHERE id = ?').run(id);
    if (result.changes === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Plate not found.');
    }
    res.status(204).end();
  });

  router.put('/slots', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const characterId = parseId(body.characterId, 'characterId');
    const slot = parseSlot(body.slot);
    const plateId = parseId(body.plateId, 'plateId');
    const level = parsePositiveInteger(body.level, 'level');
    const rarity = parseRarity(body.rarity);
    const hasThirdStat = parseBoolean(body.hasThirdStat, 'hasThirdStat');

    if (!selectCharacter.get(characterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    const plate = selectPlate.get(plateId) as PlateRow | undefined;
    if (!plate) {
      throw new ApiError(404, 'NOT_FOUND', 'Plate not found.');
    }

    if (!selectLevel.get(level)) {
      throw new ApiError(404, 'NOT_FOUND', 'Level not found.');
    }

    const conflict = db
      .prepare(
        `SELECT slot
           FROM character_heraldry
          WHERE character_id = ? AND plate_id = ? AND slot <> ?`,
      )
      .get(characterId, plateId, slot) as { slot: number } | undefined;

    if (conflict) {
      throw duplicatePlateError(plate.name, conflict.slot);
    }

    try {
      db.prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(character_id, slot) DO UPDATE SET
           plate_id = excluded.plate_id,
           level = excluded.level,
           rarity = excluded.rarity,
           has_third_stat = excluded.has_third_stat`,
      ).run(characterId, slot, plateId, level, rarity, hasThirdStat ? 1 : 0);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicatePlateError(plate.name, slot);
      }
      throw error;
    }

    const row: HeraldryRow = {
      characterId,
      slot,
      plateId,
      level,
      rarity,
      hasThirdStat,
    };

    res.json({ slot: buildSlotState(row, plate.name, readLevels(db)) });
  });

  router.delete('/slots/:characterId/:slot', (req, res) => {
    const characterId = parseId(req.params.characterId, 'characterId');
    const slot = parseSlot(req.params.slot);

    if (!selectCharacter.get(characterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    db.prepare(
      'DELETE FROM character_heraldry WHERE character_id = ? AND slot = ?',
    ).run(characterId, slot);

    res.status(204).end();
  });

  router.post('/copy', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sourceCharacterId = parseId(
      body.sourceCharacterId,
      'sourceCharacterId',
    );
    const targetCharacterId = parseId(
      body.targetCharacterId,
      'targetCharacterId',
    );

    if (sourceCharacterId === targetCharacterId) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Source and target characters must be different.',
      );
    }

    if (!selectCharacter.get(sourceCharacterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Source character not found.');
    }
    if (!selectCharacter.get(targetCharacterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Target character not found.');
    }

    const copy = db.transaction(() => {
      db.prepare('DELETE FROM character_heraldry WHERE character_id = ?').run(
        targetCharacterId,
      );
      return db
        .prepare(
          `INSERT INTO character_heraldry
             (character_id, slot, plate_id, level, rarity, has_third_stat)
           SELECT ?, slot, plate_id, level, rarity, has_third_stat
             FROM character_heraldry
            WHERE character_id = ?`,
        )
        .run(targetCharacterId, sourceCharacterId).changes;
    });

    res.json({ copied: copy() });
  });

  return router;
}
