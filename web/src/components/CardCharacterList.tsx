import type {
  Character,
  CharacterCardSummary,
} from '../api/types';
import { formatCardCount } from '../lib/cards';

export function CardCharacterList({
  characters,
  summaries,
  onOpen,
}: {
  characters: Character[];
  summaries: ReadonlyMap<number, CharacterCardSummary>;
  onOpen: (characterId: number) => void;
}) {
  return (
    <ul className="card divide-y divide-slate-200 dark:divide-slate-800">
      {characters.map((character) => {
        const summary = summaries.get(character.id);
        return (
          <li key={character.id}>
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => onOpen(character.id)}
            >
              <span className="font-medium">{character.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {formatCardCount(
                  summary?.count ?? 0,
                  summary?.total ?? 0,
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
