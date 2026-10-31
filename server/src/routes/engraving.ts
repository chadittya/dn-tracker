import { Router } from 'express';
import type Database from 'better-sqlite3';
import {
  ApiError,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from '../errors';
import {
  buildEngravingSlot,
  findEngravingCandidates,
  slotDefinition,
} from '../engraving';
import type {
  EngravingCategory,
  EngravingSlotDefinition,
  EngravingValue,
} from '../engraving';
import {
  readCharacterEngravingRows,
  readEngravingValueById,
  readEngravingValues,
} from '../engravingData';
import type { CharacterRow } from '../progress';
import {
  parseEngravingCategory,
  parseEngravingGrade,
  parseEngravingSlot,
  parseId,
  parseName,
  parsePositiveInteger,
} from '../validation';

interface UsageRow {
  characterId: number;
  characterName: string;
  slot: number;
}

interface AffectedEngravingSlot {
  characterId: number;
  characterName: string;
  slot: number;
  slotLabel: string;
}

function duplicateValueError(
  category: EngravingCategory,
  grade: string,
  firstStatValue: number,
): ApiError {
  return new ApiError(
    409,
    'DUPLICATE_ENGRAVING_VALUE',
    'An engraving value with that grade and first stat already exists.',
    { category, grade, firstStatValue },
  );
}

function valueInUseError(
  valueId: number,
  affectedSlots: AffectedEngravingSlot[],
): ApiError {
  const count = affectedSlots.length;
  const message =
    count === 0
      ? 'This engraving value is used by character slots.'
      : `Engraving value is used by ${count} slot${count === 1 ? '' : 's'}.`;

  return new ApiError(409, 'ENGRAVING_VALUE_IN_USE', message, {
    valueId,
    affectedCount: count,
    affectedEngravingSlots: affectedSlots,
  });
}

function parsePairedValue(
  category: EngravingCategory,
  raw: unknown,
): number | null {
  if (category === 'weapon' || category === 'armor') {
    if (raw !== undefined && raw !== null) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'secondStatValue must be absent for weapon and armor values.',
      );
    }
    return null;
  }

  if (raw === undefined || raw === null) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'secondStatValue is required for accessory and W/T/D values.',
    );
  }

  return parsePositiveInteger(raw, 'secondStatValue');
}

export function createEngravingRouter(db: Database.Database): Router {
  const router = Router();

  const selectValue = db.prepare(
    `SELECT id, category, grade,
            first_stat_value AS firstStatValue,
            second_stat_value AS secondStatValue
       FROM engraving_values
      WHERE id = ?`,
  );
  const selectCharacter = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM characters WHERE id = ?',
  );
  const selectUsage = db.prepare(
    `SELECT ce.character_id AS characterId, c.name AS characterName, ce.slot
       FROM character_engraving ce
       JOIN characters c ON c.id = ce.character_id
      WHERE ce.value_id = ?
      ORDER BY c.name COLLATE NOCASE, ce.slot`,
  );

  const readUsage = (valueId: number): AffectedEngravingSlot[] => {
    const rows = selectUsage.all(valueId) as UsageRow[];
    return rows.map((row) => ({
      characterId: row.characterId,
      characterName: row.characterName,
      slot: row.slot,
      slotLabel: slotDefinition(row.slot)?.label ?? `Slot ${row.slot}`,
    }));
  };

  const insertValue = db.prepare(
    `INSERT INTO engraving_values
       (category, grade, first_stat_value, second_stat_value)
     VALUES (?, ?, ?, ?)`,
  );
  const updateValue = db.prepare(
    `UPDATE engraving_values
        SET first_stat_value = ?, second_stat_value = ?
      WHERE id = ?`,
  );

  router.post('/values', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const category = parseEngravingCategory(body.category);
    const grade = parseEngravingGrade(body.grade);
    const firstStatValue = parsePositiveInteger(
      body.firstStatValue,
      'firstStatValue',
    );
    const secondStatValue = parsePairedValue(category, body.secondStatValue);

    let id: number;
    try {
      const result = insertValue.run(
        category,
        grade,
        firstStatValue,
        secondStatValue,
      );
      id = Number(result.lastInsertRowid);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateValueError(category, grade, firstStatValue);
      }
      throw error;
    }

    res.status(201).json({ value: selectValue.get(id) });
  });

  router.patch('/values/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const existing = selectValue.get(id) as EngravingValue | undefined;

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Engraving value not found.');
    }
    if ('category' in body || 'grade' in body) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'category and grade cannot be changed.',
      );
    }

    const firstStatValue = parsePositiveInteger(
      body.firstStatValue,
      'firstStatValue',
    );
    const secondStatValue = parsePairedValue(
      existing.category,
      body.secondStatValue,
    );

    try {
      updateValue.run(firstStatValue, secondStatValue, id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw duplicateValueError(
          existing.category,
          existing.grade,
          firstStatValue,
        );
      }
      throw error;
    }

    res.json({ value: selectValue.get(id) });
  });

  router.get('/values/:id/usage', (req, res) => {
    const id = parseId(req.params.id, 'id');
    if (!selectValue.get(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Engraving value not found.');
    }

    const affectedEngravingSlots = readUsage(id);
    res.json({
      valueId: id,
      affectedCount: affectedEngravingSlots.length,
      affectedEngravingSlots,
    });
  });

  router.delete('/values/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    if (!selectValue.get(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Engraving value not found.');
    }

    const affected = readUsage(id);
    if (affected.length > 0) {
      throw valueInUseError(id, affected);
    }

    try {
      db.prepare('DELETE FROM engraving_values WHERE id = ?').run(id);
    } catch (error) {
      if (isForeignKeyConstraintError(error)) {
        throw valueInUseError(id, readUsage(id));
      }
      throw error;
    }

    res.status(204).end();
  });

  router.get('/finder', (req, res) => {
    const slot = parseEngravingSlot(req.query.slot);
    const valueId = parseId(req.query.valueId, 'valueId');
    const definition = slotDefinition(slot) as EngravingSlotDefinition;
    const targetValue = readEngravingValueById(db, valueId);

    if (!targetValue) {
      throw new ApiError(404, 'NOT_FOUND', 'Engraving value not found.');
    }
    if (targetValue.category !== definition.category) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Engraving value category does not match the slot category.',
      );
    }

    const characters = db
      .prepare(
        `SELECT id, name, created_at AS createdAt
           FROM characters
          ORDER BY name COLLATE NOCASE, id`,
      )
      .all() as CharacterRow[];

    res.json({
      slot: definition,
      targetValue,
      results: findEngravingCandidates(
        characters,
        readEngravingValues(db),
        readCharacterEngravingRows(db),
        definition,
        targetValue,
      ),
    });
  });

  router.put('/slots', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const characterId = parseId(body.characterId, 'characterId');
    const slot = parseEngravingSlot(body.slot);
    const valueId = parseId(body.valueId, 'valueId');
    const definition = slotDefinition(slot) as EngravingSlotDefinition;

    const character = selectCharacter.get(characterId) as
      | CharacterRow
      | undefined;
    if (!character) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    const value = selectValue.get(valueId) as EngravingValue | undefined;
    if (!value) {
      throw new ApiError(404, 'NOT_FOUND', 'Engraving value not found.');
    }
    if (value.category !== definition.category) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Engraving value category does not match the slot category.',
      );
    }

    const rawName = body.thirdStatName;
    const rawValue = body.thirdStatValue;
    const nameAbsent =
      rawName === undefined ||
      rawName === null ||
      (typeof rawName === 'string' && rawName.trim() === '');
    const valueAbsent = rawValue === undefined || rawValue === null;

    if (nameAbsent !== valueAbsent) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'thirdStatName and thirdStatValue must both be provided or both omitted.',
      );
    }

    const thirdStatName = nameAbsent ? null : parseName(rawName);
    const thirdStatValue = valueAbsent
      ? null
      : parsePositiveInteger(rawValue, 'thirdStatValue');

    db.prepare(
      `INSERT INTO character_engraving
         (character_id, slot, value_id, third_stat_name, third_stat_value)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(character_id, slot) DO UPDATE SET
         value_id = excluded.value_id,
         third_stat_name = excluded.third_stat_name,
         third_stat_value = excluded.third_stat_value`,
    ).run(characterId, slot, valueId, thirdStatName, thirdStatValue);

    res.json({
      slot: buildEngravingSlot(
        {
          characterId,
          slot,
          valueId,
          thirdStatName,
          thirdStatValue,
        },
        definition,
        value,
      ),
    });
  });

  router.delete('/slots/:characterId/:slot', (req, res) => {
    const characterId = parseId(req.params.characterId, 'characterId');
    const slot = parseEngravingSlot(req.params.slot);

    if (!selectCharacter.get(characterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    db.prepare(
      'DELETE FROM character_engraving WHERE character_id = ? AND slot = ?',
    ).run(characterId, slot);

    res.status(204).end();
  });

  return router;
}
