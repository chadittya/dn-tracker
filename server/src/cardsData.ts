import type Database from 'better-sqlite3';
import { buildCardsState, planCharacterCardImport } from './cards';
import type {
  CardRow,
  CardsState,
  CharacterCardImportPlan,
  CharacterCardRow,
} from './cards';
import type { CharacterRow } from './progress';

export function readCards(db: Database.Database): CardRow[] {
  return db
    .prepare(
      `SELECT id, name, created_at AS createdAt
         FROM cards
        ORDER BY id`,
    )
    .all() as CardRow[];
}

export function readCharacterCards(
  db: Database.Database,
): CharacterCardRow[] {
  return db
    .prepare(
      `SELECT character_id AS characterId, card_id AS cardId, grade
         FROM character_cards
        ORDER BY character_id, card_id`,
    )
    .all() as CharacterCardRow[];
}

export function readCardById(
  db: Database.Database,
  id: number,
): CardRow | undefined {
  return db
    .prepare(
      `SELECT id, name, created_at AS createdAt
         FROM cards
        WHERE id = ?`,
    )
    .get(id) as CardRow | undefined;
}

export function readCardsState(
  db: Database.Database,
  characters: readonly CharacterRow[],
): CardsState {
  return buildCardsState(
    characters,
    readCards(db),
    readCharacterCards(db),
  );
}

/**
 * Plan and apply a `Card name, Grade` import for one character in a single
 * transaction. Reading the catalog and existing rows inside the transaction
 * keeps the plan and the writes consistent; any failure rolls everything back.
 */
export function importCharacterCards(
  db: Database.Database,
  characterId: number,
  text: string,
): CharacterCardImportPlan {
  const run = db.transaction(() => {
    const plan = planCharacterCardImport(
      text,
      readCards(db),
      characterId,
      readCharacterCards(db),
    );

    if (plan.operations.length === 0) return plan;

    const upsert = db.prepare(
      `INSERT INTO character_cards (character_id, card_id, grade)
       VALUES (?, ?, ?)
       ON CONFLICT(character_id, card_id) DO UPDATE SET
         grade = excluded.grade`,
    );
    for (const operation of plan.operations) {
      upsert.run(characterId, operation.cardId, operation.grade);
    }

    return plan;
  });

  return run();
}
