import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { CardGrade } from '../api/types';
import type { Navigate } from '../lib/navigation';
import { filterByName, isFilterActive } from '../lib/search';
import { useAppState } from '../state/context';
import { CardCharacterList } from '../components/CardCharacterList';
import { CardCharacterPanel } from '../components/CardCharacterPanel';
import { CardsFinder } from '../components/CardsFinder';
import type { CardFinderResponse } from '../components/CardsFinder';
import { EmptyState } from '../components/EmptyState';
import { FilterStatus } from '../components/FilterStatus';
import { LoadingState } from '../components/LoadingState';
import { NoMatchState } from '../components/NoMatchState';
import { SearchField } from '../components/SearchField';

export function CardsPage({ onNavigate }: { onNavigate: Navigate }) {
  const { state, loading, refresh } = useAppState();
  const [characterQuery, setCharacterQuery] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );

  const [finderCardId, setFinderCardId] = useState<number | null>(null);
  const [finderGrade, setFinderGrade] = useState<CardGrade | null>(null);
  const [finderResult, setFinderResult] = useState<CardFinderResponse | null>(
    null,
  );
  const [finderLoading, setFinderLoading] = useState(false);
  const [finderError, setFinderError] = useState<string | null>(null);
  const [finderNonce, setFinderNonce] = useState(0);

  useEffect(() => {
    if (finderCardId === null || finderGrade === null) {
      setFinderResult(null);
      setFinderError(null);
      setFinderLoading(false);
      return;
    }

    let cancelled = false;
    setFinderLoading(true);
    setFinderError(null);

    api
      .getCardFinder(finderCardId, finderGrade)
      .then((result) => {
        if (!cancelled) setFinderResult(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFinderResult(null);
          setFinderError(errorMessage(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setFinderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [finderCardId, finderGrade, finderNonce]);

  if (loading && !state) return <LoadingState />;
  if (!state) return null;

  if (state.characters.length === 0) {
    return (
      <EmptyState
        title="No characters yet"
        description="Add your characters first, then track their cards here."
        actionLabel="Add characters"
        onAction={() => onNavigate('manage')}
      />
    );
  }

  const cards = state.cards;
  const summaries = new Map(
    cards.perCharacter.map((summary) => [summary.characterId, summary]),
  );
  const visibleCharacters = filterByName(state.characters, characterQuery);
  const characterFilterActive = isFilterActive(characterQuery);
  const selectedCharacter = state.characters.find(
    (character) => character.id === selectedCharacterId,
  );

  const rerunFinderAfterMutation = async () => {
    await refresh();
    setFinderNonce((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
        <p className="muted mt-1">
          Track each character&apos;s card collection. Cards persist across
          weekly resets.
        </p>
      </div>

      <CardsFinder
        catalog={cards.catalog}
        grades={cards.grades}
        cardId={finderCardId}
        grade={finderGrade}
        onCardChange={setFinderCardId}
        onGradeChange={setFinderGrade}
        result={finderResult}
        loading={finderLoading}
        error={finderError}
      />

      <section className="card flex flex-col gap-3 p-4">
        <SearchField
          value={characterQuery}
          onChange={setCharacterQuery}
          placeholder="Search characters"
          label="Search characters"
        />
        <FilterStatus
          messages={
            characterFilterActive
              ? [
                  `Showing ${visibleCharacters.length} of ${state.characters.length} characters`,
                ]
              : []
          }
          onClear={() => setCharacterQuery('')}
        />
      </section>

      {visibleCharacters.length === 0 ? (
        <NoMatchState
          message={`No characters match “${characterQuery.trim()}”.`}
          onAction={() => setCharacterQuery('')}
        />
      ) : (
        <CardCharacterList
          characters={visibleCharacters}
          summaries={summaries}
          onOpen={(characterId) => setSelectedCharacterId(characterId)}
        />
      )}

      {selectedCharacter && (
        <CardCharacterPanel
          key={selectedCharacter.id}
          character={selectedCharacter}
          cards={cards}
          onClose={() => setSelectedCharacterId(null)}
          onChanged={rerunFinderAfterMutation}
        />
      )}
    </div>
  );
}
