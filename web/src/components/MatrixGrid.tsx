import type { Character, Nest } from '../api/types';

export function MatrixGrid({
  characters,
  nests,
  donePairs,
  pendingRuns,
  onToggle,
}: {
  characters: Character[];
  nests: Nest[];
  donePairs: ReadonlySet<string>;
  pendingRuns: ReadonlySet<string>;
  onToggle: (characterId: number, nestId: number, done: boolean) => void;
}) {
  return (
    <div className="card overflow-auto">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-40 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold dark:border-slate-800 dark:bg-slate-900">
              Character
            </th>
            {nests.map((nest) => (
              <th
                key={nest.id}
                scope="col"
                className="sticky top-0 z-20 min-w-24 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-center font-semibold dark:border-slate-800 dark:bg-slate-900"
              >
                {nest.name}
              </th>
            ))}
            <th className="sticky top-0 z-20 whitespace-nowrap border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-center font-semibold dark:border-slate-800 dark:bg-slate-900">
              Done
            </th>
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => {
            let doneCount = 0;
            for (const nest of nests) {
              if (donePairs.has(`${character.id}:${nest.id}`)) doneCount += 1;
            }

            return (
              <tr key={character.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-56 truncate border-b border-r border-slate-200 bg-white px-4 py-2 text-left font-medium dark:border-slate-800 dark:bg-slate-950"
                >
                  {character.name}
                </th>
                {nests.map((nest) => {
                  const key = `${character.id}:${nest.id}`;
                  const done = donePairs.has(key);
                  const pending = pendingRuns.has(key);

                  return (
                    <td
                      key={nest.id}
                      className="border-b border-slate-200 p-1 text-center dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => onToggle(character.id, nest.id, !done)}
                        disabled={pending}
                        aria-label={`${character.name} on ${nest.name}: ${
                          done ? 'done' : 'not done'
                        }`}
                        aria-pressed={done}
                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border text-base font-bold transition-colors disabled:cursor-wait disabled:opacity-50 ${
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400'
                            : 'border-slate-200 bg-slate-50 text-transparent hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        ✓
                      </button>
                    </td>
                  );
                })}
                <td className="border-b border-l border-slate-200 px-3 py-2 text-center tabular-nums text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {doneCount} / {nests.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
