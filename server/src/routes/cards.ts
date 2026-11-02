import { Router } from 'express';
import type Database from 'better-sqlite3';
import {
  ApiError,
  isUniqueConstraintError,
} from '../errors';
import {
  findCardCandidates,
  parseCardGrade,
  planBulkCardImport,
} from '../cards';
import type {
  CardRow,
  CharacterCardEntry,
} from '../cards';
import { readCards, readCharacterCards } from '../cardsData';
import type { CharacterRow } from '../progress';
import {
  parseId,
  parseName,
} from '../validation';

function duplicateNameError(): ApiError {
  return new ApiError(
    409,
    'DUPLICATE_NAME',
    'A card with that name already exists.',
  );
}

export function createCardsRouter(db: Database.Database): Router {
  const router = Router();

  const selectCard = db.prepare(
    `SELECT id, name, created_at AS createdAt
       FROM cards
      WHERE id = ?`,
  );
  const selectCharacters = db.prepare(
    `SELECT id, name, created_at AS createdAt
       FROM characters
      ORDER BY name COLLATE NOCASE, id`,
  );
  const selectUsage = db.prepare(
    `SELECT cc.character_id AS characterId, c.name AS characterName, cc.grade
       FROM character_cards cc
       JOIN characters c ON c.id = cc.character_id
      WHERE cc.card_id = ?
      ORDER BY c.name COLLATE NOCASE, cc.character_id`,
  );

  router.post('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);

    let id: number;
    try {
      const result = db
        .prepare('INSERT INTO cards (name) VALUES (?)')
        .run(name);
      id = Number(result.lastInsertRowid);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw duplicateNameError();
      throw error;
    }

    res.status(201).json({ card: selectCard.get(id) });
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const existing = selectCard.get(id) as CardRow | undefined;

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    }

    const name = parseName(body.name);
    try {
      db.prepare('UPDATE cards SET name = ? WHERE id = ?').run(name, id);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw duplicateNameError();
      throw error;
    }

    res.json({ card: selectCard.get(id) });
  });

  router.get('/:id/usage', (req, res) => {
    const id = parseId(req.params.id, 'id');
    if (!selectCard.get(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    }

    const affectedCharacters = selectUsage.all(id) as Array<{
      characterId: number;
      characterName: string;
      grade: string;
    }>;

    res.json({
      cardId: id,
      affectedCount: affectedCharacters.length,
      affectedCharacters,
    });
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id, 'id');
    if (!selectCard.get(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    }

    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    res.status(204).end();
  });

  router.post('/import', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.text !== 'string') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'text must be a string.');
    }

    const existingNames = readCards(db).map((card) => card.name);
    const plan = planBulkCardImport(body.text, existingNames);
    const insert = db.prepare('INSERT INTO cards (name) VALUES (?)');
    const insertAll = db.transaction(() => {
      for (const name of plan.names) {
        insert.run(name);
      }
    });
    insertAll();

    res.json({
      added: plan.added,
      skipped: plan.skipped,
      invalid: plan.invalid,
    });
  });

  router.get('/finder', (req, res) => {
    const cardId = parseId(req.query.cardId, 'cardId');
    const grade = parseCardGrade(req.query.grade);
    const card = selectCard.get(cardId) as CardRow | undefined;

    if (!card) {
      throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    }

    const characters = selectCharacters.all() as CharacterRow[];
    res.json({
      card,
      targetGrade: grade,
      results: findCardCandidates(
        characters,
        readCharacterCards(db),
        cardId,
        grade,
      ),
    });
  });

  return router;
}

export function createCharacterCardsRouter(db: Database.Database): Router {
  const router = Router();

  const selectCharacter = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM characters WHERE id = ?',
  );
  const selectCard = db.prepare(
    `SELECT id, name, created_at AS createdAt
       FROM cards
      WHERE id = ?`,
  );

  router.put('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const characterId = parseId(body.characterId, 'characterId');
    const cardId = parseId(body.cardId, 'cardId');
    const grade = parseCardGrade(body.grade);

    if (!selectCharacter.get(characterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }
    const card = selectCard.get(cardId) as CardRow | undefined;
    if (!card) {
      throw new ApiError(404, 'NOT_FOUND', 'Card not found.');
    }

    db.prepare(
      `INSERT INTO character_cards (character_id, card_id, grade)
       VALUES (?, ?, ?)
       ON CONFLICT(character_id, card_id) DO UPDATE SET
         grade = excluded.grade`,
    ).run(characterId, cardId, grade);

    const entry: CharacterCardEntry = {
      characterId,
      cardId,
      cardName: card.name,
      grade,
    };
    res.json({ entry });
  });

  router.delete('/:characterId/:cardId', (req, res) => {
    const characterId = parseId(req.params.characterId, 'characterId');
    const cardId = parseId(req.params.cardId, 'cardId');

    if (!selectCharacter.get(characterId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Character not found.');
    }

    db.prepare(
      'DELETE FROM character_cards WHERE character_id = ? AND card_id = ?',
    ).run(characterId, cardId);

    res.status(204).end();
  });

  return router;
}
