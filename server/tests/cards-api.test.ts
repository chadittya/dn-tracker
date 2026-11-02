import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext } from './helpers';
import type { TestContext } from './helpers';

let context: TestContext | undefined;

function setup(): TestContext {
  context = createTestContext();
  return context;
}

afterEach(() => {
  context?.close();
  context = undefined;
});

async function addCharacter(name: string): Promise<number> {
  const response = await request(context!.app)
    .post('/api/characters')
    .send({ name })
    .expect(201);
  return response.body.character.id as number;
}

async function addCard(name: string): Promise<number> {
  const response = await request(context!.app)
    .post('/api/cards')
    .send({ name })
    .expect(201);
  return response.body.card.id as number;
}

function setCharacterCard(
  characterId: number,
  cardId: number,
  grade: string,
) {
  return request(context!.app)
    .put('/api/character-cards')
    .send({ characterId, cardId, grade });
}

async function getCards() {
  const response = await request(context!.app).get('/api/state').expect(200);
  return response.body.cards as {
    grades: Array<{ key: string; label: string; rank: number }>;
    catalog: Array<{ id: number; name: string; createdAt: string }>;
    entries: Array<Record<string, unknown>>;
    perCharacter: Array<Record<string, unknown>>;
  };
}

describe('cards API', () => {
  it('returns the card state block', async () => {
    setup();
    await addCharacter('Raven');

    const cards = await getCards();
    expect(cards.grades).toEqual([
      { key: 'magic', label: 'Magic', rank: 0 },
      { key: 'rare', label: 'Rare', rank: 1 },
      { key: 'epic', label: 'Epic', rank: 2 },
      { key: 'unique', label: 'Unique', rank: 3 },
      { key: 'legend', label: 'Legend', rank: 4 },
    ]);
    expect(cards.catalog).toEqual([]);
    expect(cards.entries).toEqual([]);
    expect(cards.perCharacter).toEqual([
      { characterId: expect.any(Number), name: 'Raven', count: 0, total: 0 },
    ]);
  });

  it('creates, renames and deletes cards', async () => {
    setup();
    const cardId = await addCard('  Red Dragon  ');

    let cards = await getCards();
    expect(cards.catalog).toEqual([
      {
        id: cardId,
        name: 'Red Dragon',
        createdAt: expect.any(String),
      },
    ]);

    await request(context!.app)
      .post('/api/cards')
      .send({ name: 'red dragon' })
      .expect(409, {
        error: {
          code: 'DUPLICATE_NAME',
          message: 'A card with that name already exists.',
        },
      });
    await request(context!.app)
      .post('/api/cards')
      .send({ name: '   ' })
      .expect(400);
    await request(context!.app)
      .post('/api/cards')
      .send({ name: 'x'.repeat(51) })
      .expect(400);

    const renamed = await request(context!.app)
      .patch(`/api/cards/${cardId}`)
      .send({ name: 'Gold Dragon' })
      .expect(200);
    expect(renamed.body.card.name).toBe('Gold Dragon');

    await request(context!.app).patch('/api/cards/999').send({ name: 'X' }).expect(404);
    await request(context!.app).delete('/api/cards/999').expect(404);
    await request(context!.app).delete(`/api/cards/${cardId}`).expect(204);

    cards = await getCards();
    expect(cards.catalog).toEqual([]);
  });

  it('sorts the catalog A to Z with a case-insensitive compare', async () => {
    setup();
    await addCard('zeta');
    await addCard('Alpha');
    await addCard('beta');

    const cards = await getCards();
    expect(cards.catalog.map((card) => card.name)).toEqual([
      'Alpha',
      'beta',
      'zeta',
    ]);
  });

  it('reports usage and cascades on card delete', async () => {
    setup();
    const raven = await addCharacter('Raven');
    const aria = await addCharacter('Aria');
    const cardId = await addCard('Red Dragon');

    await setCharacterCard(raven, cardId, 'legend').expect(200);
    await setCharacterCard(aria, cardId, 'epic').expect(200);

    const usage = await request(context!.app)
      .get(`/api/cards/${cardId}/usage`)
      .expect(200);
    expect(usage.body).toEqual({
      cardId,
      affectedCount: 2,
      affectedCharacters: [
        { characterId: aria, characterName: 'Aria', grade: 'epic' },
        { characterId: raven, characterName: 'Raven', grade: 'legend' },
      ],
    });

    const cards = await getCards();
    expect(cards.entries).toHaveLength(2);
    expect(cards.perCharacter).toEqual([
      { characterId: aria, name: 'Aria', count: 1, total: 1 },
      { characterId: raven, name: 'Raven', count: 1, total: 1 },
    ]);

    await request(context!.app).delete(`/api/cards/${cardId}`).expect(204);
    const after = await getCards();
    expect(after.entries).toEqual([]);
    expect(after.perCharacter).toEqual([
      { characterId: aria, name: 'Aria', count: 0, total: 0 },
      { characterId: raven, name: 'Raven', count: 0, total: 0 },
    ]);
  });

  it('renames a card without losing grades', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const cardId = await addCard('Red Dragon');
    await setCharacterCard(characterId, cardId, 'unique').expect(200);

    await request(context!.app)
      .patch(`/api/cards/${cardId}`)
      .send({ name: 'Gold Dragon' })
      .expect(200);

    const cards = await getCards();
    expect(cards.entries).toEqual([
      {
        characterId,
        cardId,
        cardName: 'Gold Dragon',
        grade: 'unique',
      },
    ]);
  });

  it('upserts a character card and allows any grade direction', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const cardId = await addCard('Red Dragon');

    const first = await setCharacterCard(characterId, cardId, 'magic').expect(200);
    expect(first.body.entry).toEqual({
      characterId,
      cardId,
      cardName: 'Red Dragon',
      grade: 'magic',
    });

    await setCharacterCard(characterId, cardId, 'legend').expect(200);
    await setCharacterCard(characterId, cardId, 'rare').expect(200);
    const cards = await getCards();
    expect(cards.entries).toEqual([
      { characterId, cardId, cardName: 'Red Dragon', grade: 'rare' },
    ]);

    await setCharacterCard(999, cardId, 'rare').expect(404);
    await setCharacterCard(characterId, 999, 'rare').expect(404);
    await setCharacterCard(characterId, cardId, 'super').expect(400);
  });

  it('removes a character card idempotently', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const cardId = await addCard('Red Dragon');
    await setCharacterCard(characterId, cardId, 'rare').expect(200);

    await request(context!.app)
      .delete(`/api/character-cards/${characterId}/${cardId}`)
      .expect(204);
    await request(context!.app)
      .delete(`/api/character-cards/${characterId}/${cardId}`)
      .expect(204);
    await request(context!.app)
      .delete(`/api/character-cards/${characterId}/999`)
      .expect(204);
    await request(context!.app)
      .delete('/api/character-cards/999/1')
      .expect(404);

    const cards = await getCards();
    expect(cards.entries).toEqual([]);
  });

  it('deletes a character and cascades cards', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const cardId = await addCard('Red Dragon');
    await setCharacterCard(characterId, cardId, 'legend').expect(200);

    await request(context!.app)
      .delete(`/api/characters/${characterId}`)
      .expect(204);

    const cards = await getCards();
    expect(cards.entries).toEqual([]);
    expect(cards.catalog).toHaveLength(1);
  });

  it('bulk imports valid lines and summarizes skips and invalid lines', async () => {
    setup();
    await addCard('Existing Card');

    const response = await request(context!.app)
      .post('/api/cards/import')
      .send({
        text: [
          'Red Dragon',
          '  Blue Dragon  ',
          '',
          'red dragon',
          'Existing Card',
          'x'.repeat(51),
        ].join('\n'),
      })
      .expect(200);

    expect(response.body).toEqual({
      added: 2,
      skipped: 2,
      invalid: 1,
    });

    const cards = await getCards();
    expect(cards.catalog.map((card) => card.name)).toEqual([
      'Blue Dragon',
      'Existing Card',
      'Red Dragon',
    ]);

    await request(context!.app)
      .post('/api/cards/import')
      .send({ text: 5 })
      .expect(400);
  });

  it('finds characters missing a card or below the target grade', async () => {
    setup();
    const zed = await addCharacter('Zed');
    const aria = await addCharacter('Aria');
    const bran = await addCharacter('Bran');
    const cardId = await addCard('Red Dragon');

    await setCharacterCard(zed, cardId, 'epic').expect(200);
    await setCharacterCard(aria, cardId, 'magic').expect(200);

    const response = await request(context!.app)
      .get(`/api/cards/finder?cardId=${cardId}&grade=epic`)
      .expect(200);
    expect(response.body).toEqual({
      card: {
        id: cardId,
        name: 'Red Dragon',
        createdAt: expect.any(String),
      },
      targetGrade: 'epic',
      results: [
        { characterId: bran, name: 'Bran', grade: null },
        { characterId: aria, name: 'Aria', grade: 'magic' },
      ],
    });

    await request(context!.app)
      .get(`/api/cards/finder?cardId=${cardId}&grade=super`)
      .expect(400);
    await request(context!.app)
      .get('/api/cards/finder?cardId=abc&grade=epic')
      .expect(400);
    await request(context!.app)
      .get('/api/cards/finder?cardId=999&grade=epic')
      .expect(404);
  });
});
