import type Database from 'better-sqlite3';
import { buildCardsState } from './cards';
import type {
  CardRow,
  CardsState,
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
