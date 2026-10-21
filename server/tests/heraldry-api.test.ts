import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext } from './helpers';
import type { TestContext } from './helpers';

let context: TestContext;

afterEach(() => {
  context?.close();
});

function setup(): TestContext {
  context = createTestContext();
  return context;
}

interface SlotBody {
  characterId: number;
  slot: number;
  isEmpty: boolean;
  plateId: number | null;
  plateName: string | null;
  level: number | null;
  rarity: string | null;
  hasThirdStat: boolean;
  status: string;
}

interface HeraldryBody {
  slotCount: number;
  levels: number[];
  cap: number | null;
  plates: Array<{ id: number; name: string }>;
  slots: SlotBody[];
  perCharacter: Array<{
    characterId: number;
    name: string;
    needsUpgrade: number;
    recommended: number;
    ok: number;
    empty: number;
    status: string;
  }>;
}

async function getHeraldry(): Promise<HeraldryBody> {
  const response = await request(context.app).get('/api/state').expect(200);
  return response.body.heraldry as HeraldryBody;
}

async function addCharacter(name: string): Promise<number> {
  const response = await request(context.app)
    .post('/api/characters')
    .send({ name })
    .expect(201);
  return response.body.character.id as number;
}

async function addLevel(value: number): Promise<void> {
  await request(context.app)
    .post('/api/heraldry/levels')
    .send({ value })
    .expect(201);
}

async function addPlate(name: string): Promise<number> {
  const response = await request(context.app)
    .post('/api/heraldry/plates')
    .send({ name })
    .expect(201);
  return response.body.plate.id as number;
}

function setSlot(input: {
  characterId: number;
  slot: number;
  plateId: number;
  level: number;
  rarity: 'rare' | 'epic';
  hasThirdStat: boolean;
}) {
  return request(context.app).put('/api/heraldry/slots').send(input);
}

function slotFor(
  heraldry: HeraldryBody,
  characterId: number,
  slotNumber: number,
): SlotBody {
  const slot = heraldry.slots.find(
    (entry) => entry.characterId === characterId && entry.slot === slotNumber,
  );
  if (!slot) throw new Error('slot not found');
  return slot;
}

describe('heraldry state', () => {
  it('returns the full slot grid and computed statuses', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    await addLevel(27);
    await addLevel(25);
    const bear = await addPlate('Bear');
    const wolf = await addPlate('Wolf');

    await setSlot({
      characterId,
      slot: 1,
      plateId: bear,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);
    await setSlot({
      characterId,
      slot: 2,
      plateId: wolf,
      level: 27,
      rarity: 'epic',
      hasThirdStat: false,
    }).expect(200);

    const heraldry = await getHeraldry();

    expect(heraldry.slotCount).toBe(8);
    expect(heraldry.levels).toEqual([30, 27, 25]);
    expect(heraldry.cap).toBe(30);
    expect(heraldry.plates).toMatchObject([
      { id: bear, name: 'Bear' },
      { id: wolf, name: 'Wolf' },
    ]);
    expect(heraldry.slots).toHaveLength(8);
    expect(slotFor(heraldry, characterId, 1)).toMatchObject({
      isEmpty: false,
      plateName: 'Bear',
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
      status: 'ok',
    });
    expect(slotFor(heraldry, characterId, 2)).toMatchObject({
      isEmpty: false,
      plateName: 'Wolf',
      level: 27,
      hasThirdStat: false,
      status: 'recommended',
    });
    expect(slotFor(heraldry, characterId, 3)).toEqual({
      characterId,
      slot: 3,
      isEmpty: true,
      plateId: null,
      plateName: null,
      level: null,
      rarity: null,
      hasThirdStat: false,
      status: 'needs-upgrade',
    });
    expect(heraldry.perCharacter).toEqual([
      {
        characterId,
        name: 'Raven',
        needsUpgrade: 6,
        recommended: 1,
        ok: 1,
        empty: 6,
        status: 'needs-upgrade',
      },
    ]);
  });
});

describe('heraldry levels', () => {
  it('adds, rejects duplicates, and deletes an unused level', async () => {
    setup();

    await addLevel(30);
    const duplicate = await request(context.app)
      .post('/api/heraldry/levels')
      .send({ value: 30 })
      .expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_LEVEL');

    for (const value of [0, -1, 1.5, 'abc', null]) {
      await request(context.app)
        .post('/api/heraldry/levels')
        .send({ value })
        .expect(400);
    }

    await request(context.app)
      .delete('/api/heraldry/levels/30')
      .expect(204);
    await request(context.app)
      .delete('/api/heraldry/levels/30')
      .expect(404);

    expect((await getHeraldry()).levels).toEqual([]);
  });

  it('returns LEVEL_IN_USE details when the FK fallback is reached', async () => {
    setup();
    await addLevel(30);

    // Simulate a restored database with an orphan row the joined pre-check
    // cannot see. The foreign-key fallback must still map the RESTRICT error.
    context.db.pragma('foreign_keys = OFF');
    context.db
      .prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (999, 1, 999, 30, 'epic', 1)`,
      )
      .run();
    context.db.pragma('foreign_keys = ON');

    const response = await request(context.app)
      .delete('/api/heraldry/levels/30')
      .expect(409);
    expect(response.body.error.code).toBe('LEVEL_IN_USE');
    expect(response.body.error.details).toEqual({
      affectedCount: 0,
      affectedSlots: [],
    });
  });

  it('blocks deleting a level in use and reports the affected slots', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    const plateId = await addPlate('Bear');
    await setSlot({
      characterId,
      slot: 1,
      plateId,
      level: 30,
      rarity: 'epic',
      hasThirdStat: false,
    }).expect(200);

    const response = await request(context.app)
      .delete('/api/heraldry/levels/30')
      .expect(409);
    expect(response.body.error.code).toBe('LEVEL_IN_USE');
    expect(response.body.error.details).toEqual({
      affectedCount: 1,
      affectedSlots: [
        {
          characterId,
          characterName: 'Raven',
          plateId,
          plateName: 'Bear',
          slot: 1,
        },
      ],
    });

    await request(context.app)
      .delete(`/api/heraldry/slots/${characterId}/1`)
      .expect(204);
    await request(context.app)
      .delete('/api/heraldry/levels/30')
      .expect(204);
  });
});

describe('heraldry plates', () => {
  it('adds, renames, and deletes plates with cascade behavior', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    const bear = await addPlate('Bear');

    const duplicate = await request(context.app)
      .post('/api/heraldry/plates')
      .send({ name: 'bear' })
      .expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_NAME');

    await request(context.app)
      .post('/api/heraldry/plates')
      .send({ name: '   ' })
      .expect(400);

    await setSlot({
      characterId,
      slot: 1,
      plateId: bear,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);

    const renamed = await request(context.app)
      .patch(`/api/heraldry/plates/${bear}`)
      .send({ name: 'Polar' })
      .expect(200);
    expect(renamed.body.plate).toMatchObject({ id: bear, name: 'Polar' });
    expect(slotFor(await getHeraldry(), characterId, 1).plateName).toBe(
      'Polar',
    );

    const wolf = await addPlate('Wolf');
    const conflict = await request(context.app)
      .patch(`/api/heraldry/plates/${wolf}`)
      .send({ name: 'polar' })
      .expect(409);
    expect(conflict.body.error.code).toBe('DUPLICATE_NAME');

    await request(context.app)
      .patch('/api/heraldry/plates/9999')
      .send({ name: 'Nope' })
      .expect(404);

    await request(context.app)
      .delete(`/api/heraldry/plates/${bear}`)
      .expect(204);
    expect(slotFor(await getHeraldry(), characterId, 1)).toMatchObject({
      isEmpty: true,
      plateId: null,
      status: 'needs-upgrade',
    });
    await request(context.app)
      .delete(`/api/heraldry/plates/${bear}`)
      .expect(404);
  });
});

describe('heraldry slots', () => {
  it('validates references, slot bounds, rarity, and third-stat type', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    const plateId = await addPlate('Bear');

    const base = {
      characterId,
      slot: 1,
      plateId,
      level: 30,
      rarity: 'epic' as const,
      hasThirdStat: true,
    };

    await setSlot(base).expect(200);

    await setSlot({ ...base, characterId: 9999 }).expect(404);
    await setSlot({ ...base, plateId: 9999 }).expect(404);
    await setSlot({ ...base, level: 27 }).expect(404);
    await setSlot({ ...base, slot: 0 }).expect(400);
    await setSlot({ ...base, slot: 9 }).expect(400);
    await setSlot({ ...base, rarity: 'legendary' as 'epic' }).expect(400);
    await setSlot({ ...base, hasThirdStat: 'yes' as unknown as boolean }).expect(
      400,
    );
    await request(context.app)
      .put('/api/heraldry/slots')
      .send({ characterId, slot: 1, plateId, level: 30, rarity: 'epic' })
      .expect(400);
  });

  it('upserts a slot and rejects the same plate twice for one character', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    await addLevel(27);
    const bear = await addPlate('Bear');
    const wolf = await addPlate('Wolf');

    await setSlot({
      characterId,
      slot: 1,
      plateId: bear,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);

    const duplicate = await setSlot({
      characterId,
      slot: 2,
      plateId: bear,
      level: 27,
      rarity: 'epic',
      hasThirdStat: false,
    }).expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_PLATE');
    expect(duplicate.body.error.details).toEqual({ conflictingSlot: 1 });

    await setSlot({
      characterId,
      slot: 1,
      plateId: wolf,
      level: 27,
      rarity: 'rare',
      hasThirdStat: false,
    }).expect(200);

    const heraldry = await getHeraldry();
    expect(slotFor(heraldry, characterId, 1)).toMatchObject({
      plateName: 'Wolf',
      level: 27,
      rarity: 'rare',
      hasThirdStat: false,
      status: 'needs-upgrade',
    });
    expect(
      heraldry.slots.filter(
        (slot) => slot.characterId === characterId && !slot.isEmpty,
      ),
    ).toHaveLength(1);
  });

  it('clears slots idempotently and validates the character and slot', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    const plateId = await addPlate('Bear');
    await setSlot({
      characterId,
      slot: 1,
      plateId,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);

    await request(context.app)
      .delete(`/api/heraldry/slots/${characterId}/1`)
      .expect(204);
    expect(slotFor(await getHeraldry(), characterId, 1).isEmpty).toBe(true);

    await request(context.app)
      .delete(`/api/heraldry/slots/${characterId}/1`)
      .expect(204);
    await request(context.app)
      .delete('/api/heraldry/slots/9999/1')
      .expect(404);
    await request(context.app)
      .delete(`/api/heraldry/slots/${characterId}/0`)
      .expect(400);
    await request(context.app)
      .delete(`/api/heraldry/slots/${characterId}/9`)
      .expect(400);
  });
});

describe('heraldry copy', () => {
  it('replaces every target slot in one copy', async () => {
    setup();
    const source = await addCharacter('Raven');
    const target = await addCharacter('Luna');
    await addLevel(30);
    await addLevel(27);
    const bear = await addPlate('Bear');
    const wolf = await addPlate('Wolf');

    await setSlot({
      characterId: source,
      slot: 1,
      plateId: bear,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);
    await setSlot({
      characterId: source,
      slot: 2,
      plateId: wolf,
      level: 27,
      rarity: 'epic',
      hasThirdStat: false,
    }).expect(200);
    await setSlot({
      characterId: target,
      slot: 3,
      plateId: bear,
      level: 27,
      rarity: 'rare',
      hasThirdStat: false,
    }).expect(200);

    const response = await request(context.app)
      .post('/api/heraldry/copy')
      .send({ sourceCharacterId: source, targetCharacterId: target })
      .expect(200);
    expect(response.body).toEqual({ copied: 2 });

    const heraldry = await getHeraldry();
    expect(slotFor(heraldry, target, 1)).toMatchObject({
      plateName: 'Bear',
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
      status: 'ok',
    });
    expect(slotFor(heraldry, target, 2)).toMatchObject({
      plateName: 'Wolf',
      level: 27,
      hasThirdStat: false,
      status: 'recommended',
    });
    expect(slotFor(heraldry, target, 3).isEmpty).toBe(true);
    expect(slotFor(heraldry, source, 1).plateName).toBe('Bear');
  });

  it('empties the target when the source has no slots', async () => {
    setup();
    const source = await addCharacter('Raven');
    const target = await addCharacter('Luna');
    await addLevel(30);
    const bear = await addPlate('Bear');
    await setSlot({
      characterId: target,
      slot: 1,
      plateId: bear,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);

    const response = await request(context.app)
      .post('/api/heraldry/copy')
      .send({ sourceCharacterId: source, targetCharacterId: target })
      .expect(200);
    expect(response.body).toEqual({ copied: 0 });
    expect(
      (await getHeraldry()).slots
        .filter((slot) => slot.characterId === target)
        .every((slot) => slot.isEmpty),
    ).toBe(true);
  });

  it('rejects same-character and unknown-character copies', async () => {
    setup();
    const characterId = await addCharacter('Raven');

    const same = await request(context.app)
      .post('/api/heraldry/copy')
      .send({
        sourceCharacterId: characterId,
        targetCharacterId: characterId,
      })
      .expect(400);
    expect(same.body.error.code).toBe('VALIDATION_ERROR');

    await request(context.app)
      .post('/api/heraldry/copy')
      .send({ sourceCharacterId: 9999, targetCharacterId: characterId })
      .expect(404);
    await request(context.app)
      .post('/api/heraldry/copy')
      .send({ sourceCharacterId: characterId, targetCharacterId: 9999 })
      .expect(404);
  });
});

describe('heraldry cascades', () => {
  it('deletes heraldry rows when a character is removed', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    await addLevel(30);
    const plateId = await addPlate('Bear');
    await setSlot({
      characterId,
      slot: 1,
      plateId,
      level: 30,
      rarity: 'epic',
      hasThirdStat: true,
    }).expect(200);

    await request(context.app)
      .delete(`/api/characters/${characterId}`)
      .expect(204);

    const row = context.db
      .prepare('SELECT COUNT(*) AS count FROM character_heraldry')
      .get() as { count: number };
    expect(row.count).toBe(0);
  });
});
