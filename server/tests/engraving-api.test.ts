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

async function addCharacter(app: TestContext['app'], name: string): Promise<number> {
  const response = await request(app)
    .post('/api/characters')
    .send({ name })
    .expect(201);
  return response.body.character.id as number;
}

async function getEngraving() {
  const response = await request(context!.app).get('/api/state').expect(200);
  return response.body.engraving as {
    slotCount: number;
    slotDefinitions: Array<{ slot: number; label: string; category: string }>;
    categories: Array<{
      key: string;
      label: string;
      firstStatLabel: string;
      secondStatLabel: string | null;
    }>;
    grades: Array<{ key: string; label: string; rank: number }>;
    valueTables: Record<
      string,
      Array<{
        id: number;
        category: string;
        grade: string;
        firstStatValue: number;
        secondStatValue: number | null;
      }>
    >;
    slots: Array<Record<string, unknown>>;
    perCharacter: Array<Record<string, unknown>>;
  };
}

function findValue(
  engraving: Awaited<ReturnType<typeof getEngraving>>,
  category: string,
  grade: string,
  firstStatValue: number,
) {
  const value = engraving.valueTables[category]!.find(
    (row) => row.grade === grade && row.firstStatValue === firstStatValue,
  );
  expect(value).toBeDefined();
  return value!;
}

function setSlot(
  app: TestContext['app'],
  body: Record<string, unknown>,
) {
  return request(app).put('/api/engraving/slots').send(body);
}

describe('engraving API', () => {
  it('returns the seeded engraving state block', async () => {
    setup();
    await addCharacter(context!.app, 'Raven');

    const engraving = await getEngraving();
    expect(engraving.slotCount).toBe(14);
    expect(engraving.slotDefinitions).toHaveLength(14);
    expect(engraving.categories.map((category) => category.key)).toEqual([
      'weapon',
      'armor',
      'accessory',
      'wtd',
    ]);
    expect(engraving.grades.map((grade) => grade.rank)).toEqual([0, 1, 2, 3]);
    expect(engraving.valueTables.weapon).toHaveLength(34);
    expect(engraving.valueTables.armor).toHaveLength(34);
    expect(engraving.valueTables.accessory).toHaveLength(34);
    expect(engraving.valueTables.wtd).toHaveLength(34);

    const accessoryEpic = engraving.valueTables.accessory!.filter(
      (row) => row.grade === 'epic',
    );
    expect(accessoryEpic[4]).toMatchObject({
      firstStatValue: 28,
      secondStatValue: 56,
    });
    const wtdEpic = engraving.valueTables.wtd!.filter(
      (row) => row.grade === 'epic',
    );
    expect(wtdEpic[3]).toMatchObject({
      firstStatValue: 26,
      secondStatValue: 70,
    });

    expect(engraving.slots).toHaveLength(14);
    expect(engraving.perCharacter).toEqual([
      {
        characterId: expect.any(Number),
        name: 'Raven',
        emptyCount: 14,
        filledCount: 0,
        emptySlots: engraving.slotDefinitions.map((slot) => ({
          slot: slot.slot,
          label: slot.label,
        })),
      },
    ]);
  });

  it('creates, edits, and deletes unused engraving values', async () => {
    setup();

    const created = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 222 })
      .expect(201);
    const id = created.body.value.id as number;
    expect(created.body.value).toEqual({
      id,
      category: 'weapon',
      grade: 'rare',
      firstStatValue: 222,
      secondStatValue: null,
    });

    const updated = await request(context!.app)
      .patch(`/api/engraving/values/${id}`)
      .send({ firstStatValue: 224 })
      .expect(200);
    expect(updated.body.value.firstStatValue).toBe(224);

    const paired = await request(context!.app)
      .post('/api/engraving/values')
      .send({
        category: 'accessory',
        grade: 'epic',
        firstStatValue: 222,
        secondStatValue: 444,
      })
      .expect(201);
    expect(paired.body.value.secondStatValue).toBe(444);

    await request(context!.app)
      .patch(`/api/engraving/values/${paired.body.value.id}`)
      .send({ firstStatValue: 226, secondStatValue: 446 })
      .expect(200);

    await request(context!.app)
      .delete(`/api/engraving/values/${id}`)
      .expect(204);
    await request(context!.app)
      .delete(`/api/engraving/values/${id}`)
      .expect(404);
  });

  it('validates value create and edit input with value-worded messages', async () => {
    setup();

    const invalidCreates: Array<{ label: string; body: Record<string, unknown> }> =
      [
        { label: 'bad category', body: { category: 'ring', grade: 'rare', firstStatValue: 300 } },
        { label: 'bad grade', body: { category: 'weapon', grade: 'mythic', firstStatValue: 300 } },
        { label: 'zero first stat', body: { category: 'weapon', grade: 'rare', firstStatValue: 0 } },
        { label: 'fractional first stat', body: { category: 'weapon', grade: 'rare', firstStatValue: 1.5 } },
        {
          label: 'weapon with second stat',
          body: { category: 'weapon', grade: 'rare', firstStatValue: 300, secondStatValue: 10 },
        },
        {
          label: 'accessory without second stat',
          body: { category: 'accessory', grade: 'rare', firstStatValue: 300 },
        },
        {
          label: 'accessory zero second stat',
          body: { category: 'accessory', grade: 'rare', firstStatValue: 300, secondStatValue: 0 },
        },
      ];

    for (const testCase of invalidCreates) {
      const response = await request(context!.app)
        .post('/api/engraving/values')
        .send(testCase.body)
        .expect(400);
      expect(response.body.error.code, testCase.label).toBe('VALIDATION_ERROR');
    }

    const statResponse = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 0 })
      .expect(400);
    expect(statResponse.body.error.message).toContain('firstStatValue');
    expect(statResponse.body.error.message).toMatch(/positive integer/);
    expect(statResponse.body.error.message).not.toContain(' id');

    const existing = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 300 })
      .expect(201);
    const existingId = existing.body.value.id as number;

    await request(context!.app)
      .patch(`/api/engraving/values/${existingId}`)
      .send({ category: 'armor', firstStatValue: 300 })
      .expect(400);
    await request(context!.app)
      .patch(`/api/engraving/values/${existingId}`)
      .send({ grade: 'epic', firstStatValue: 300 })
      .expect(400);
    await request(context!.app)
      .patch('/api/engraving/values/99999')
      .send({ firstStatValue: 300 })
      .expect(404);
  });

  it('rejects duplicate engraving values on create and edit', async () => {
    setup();

    const first = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 302 })
      .expect(201);
    const second = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 304 })
      .expect(201);

    const duplicate = await request(context!.app)
      .post('/api/engraving/values')
      .send({ category: 'weapon', grade: 'rare', firstStatValue: 302 })
      .expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_ENGRAVING_VALUE');

    const editDuplicate = await request(context!.app)
      .patch(`/api/engraving/values/${second.body.value.id}`)
      .send({ firstStatValue: 302 })
      .expect(409);
    expect(editDuplicate.body.error.code).toBe('DUPLICATE_ENGRAVING_VALUE');

    await request(context!.app)
      .patch(`/api/engraving/values/${first.body.value.id}`)
      .send({ firstStatValue: 302 })
      .expect(200);
  });

  it('reports value usage and blocks deleting a value in use', async () => {
    setup();
    const characterId = await addCharacter(context!.app, 'Raven');
    const engraving = await getEngraving();
    const value = findValue(engraving, 'weapon', 'rare', 20);

    await setSlot(context!.app, {
      characterId,
      slot: 1,
      valueId: value.id,
      thirdStatName: 'Critical Damage',
      thirdStatValue: 125,
    }).expect(200);

    const usage = await request(context!.app)
      .get(`/api/engraving/values/${value.id}/usage`)
      .expect(200);
    expect(usage.body).toEqual({
      valueId: value.id,
      affectedCount: 1,
      affectedEngravingSlots: [
        {
          characterId,
          characterName: 'Raven',
          slot: 1,
          slotLabel: 'Main weapon',
        },
      ],
    });

    const blocked = await request(context!.app)
      .delete(`/api/engraving/values/${value.id}`)
      .expect(409);
    expect(blocked.body.error.code).toBe('ENGRAVING_VALUE_IN_USE');
    expect(blocked.body.error.details).toEqual(usage.body);

    await request(context!.app)
      .get('/api/engraving/values/99999/usage')
      .expect(404);
    await request(context!.app)
      .delete('/api/engraving/values/99999')
      .expect(404);
  });

  it('maps the foreign-key fallback when deleting an orphaned value', async () => {
    setup();

    context!.db.pragma('foreign_keys = OFF');
    context!.db
      .prepare(
        `INSERT INTO character_engraving
           (character_id, slot, value_id, third_stat_name, third_stat_value)
         VALUES (999, 1, 1, NULL, NULL)`,
      )
      .run();
    context!.db.pragma('foreign_keys = ON');

    const response = await request(context!.app)
      .delete('/api/engraving/values/1')
      .expect(409);
    expect(response.body.error.code).toBe('ENGRAVING_VALUE_IN_USE');
    expect(response.body.error.details).toEqual({
      valueId: 1,
      affectedCount: 0,
      affectedEngravingSlots: [],
    });
  });

  it('finds empty and lower-value slots and excludes equal or higher values', async () => {
    setup();
    const app = context!.app;
    const emptyId = await addCharacter(app, 'Empty');
    const lowerId = await addCharacter(app, 'Lower');
    const equalId = await addCharacter(app, 'Equal');
    const higherId = await addCharacter(app, 'Higher');

    const engraving = await getEngraving();
    const target = findValue(engraving, 'armor', 'unique', 108);
    const lower = findValue(engraving, 'armor', 'rare', 20);
    const higher = findValue(engraving, 'armor', 'legend', 160);

    await setSlot(app, { characterId: lowerId, slot: 3, valueId: lower.id }).expect(200);
    await setSlot(app, { characterId: equalId, slot: 3, valueId: target.id }).expect(200);
    await setSlot(app, { characterId: higherId, slot: 3, valueId: higher.id }).expect(200);

    const response = await request(app)
      .get('/api/engraving/finder')
      .query({ slot: 3, valueId: target.id })
      .expect(200);
    expect(response.body.slot).toEqual({
      slot: 3,
      label: 'Head',
      category: 'armor',
    });
    expect(response.body.targetValue).toEqual(target);
    expect(response.body.results).toEqual([
      {
        characterId: emptyId,
        name: 'Empty',
        isEmpty: true,
        valueId: null,
        grade: null,
        firstStatValue: null,
        secondStatValue: null,
      },
      {
        characterId: lowerId,
        name: 'Lower',
        isEmpty: false,
        valueId: lower.id,
        grade: 'rare',
        firstStatValue: 20,
        secondStatValue: null,
      },
    ]);

    await request(app)
      .get('/api/engraving/finder')
      .query({ slot: 1, valueId: target.id })
      .expect(400);
    await request(app)
      .get('/api/engraving/finder')
      .query({ slot: 15, valueId: target.id })
      .expect(400);
    await request(app)
      .get('/api/engraving/finder')
      .query({ slot: 1, valueId: 99999 })
      .expect(404);
  });

  it('sets, overwrites, and clears character engraving slots', async () => {
    setup();
    const app = context!.app;
    const characterId = await addCharacter(app, 'Raven');
    const engraving = await getEngraving();
    const first = findValue(engraving, 'accessory', 'epic', 28);
    const second = findValue(engraving, 'accessory', 'unique', 50);

    const created = await setSlot(app, {
      characterId,
      slot: 8,
      valueId: first.id,
      thirdStatName: '  Critical Damage  ',
      thirdStatValue: 125,
    }).expect(200);
    expect(created.body.slot).toEqual({
      characterId,
      slot: 8,
      category: 'accessory',
      label: 'Necklace',
      isEmpty: false,
      valueId: first.id,
      grade: 'epic',
      firstStatValue: 28,
      secondStatValue: 56,
      thirdStatName: 'Critical Damage',
      thirdStatValue: 125,
    });

    const overwritten = await setSlot(app, {
      characterId,
      slot: 8,
      valueId: second.id,
      thirdStatName: '',
      thirdStatValue: null,
    }).expect(200);
    expect(overwritten.body.slot.thirdStatName).toBeNull();
    expect(overwritten.body.slot.thirdStatValue).toBeNull();

    const cleared = await request(app)
      .delete(`/api/engraving/slots/${characterId}/8`)
      .expect(204);
    expect(cleared.body).toEqual({});
    await request(app)
      .delete(`/api/engraving/slots/${characterId}/8`)
      .expect(204);

    const state = await getEngraving();
    expect(state.perCharacter[0]?.emptyCount).toBe(14);
  });

  it('validates slot references, bounds, categories, and third-stat pairs', async () => {
    setup();
    const app = context!.app;
    const characterId = await addCharacter(app, 'Raven');
    const engraving = await getEngraving();
    const weapon = findValue(engraving, 'weapon', 'rare', 20);
    const armor = findValue(engraving, 'armor', 'rare', 20);

    const invalid: Array<{ label: string; body: Record<string, unknown> }> = [
      {
        label: 'unknown character',
        body: { characterId: 999, slot: 1, valueId: weapon.id },
      },
      {
        label: 'unknown value',
        body: { characterId, slot: 1, valueId: 99999 },
      },
      {
        label: 'slot 0',
        body: { characterId, slot: 0, valueId: weapon.id },
      },
      {
        label: 'slot 15',
        body: { characterId, slot: 15, valueId: weapon.id },
      },
      {
        label: 'category mismatch',
        body: { characterId, slot: 1, valueId: armor.id },
      },
      {
        label: 'name without value',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatName: 'Critical Damage',
        },
      },
      {
        label: 'value without name',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatValue: 125,
        },
      },
      {
        label: 'blank name with value',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatName: '   ',
          thirdStatValue: 125,
        },
      },
      {
        label: 'name too long',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatName: 'x'.repeat(51),
          thirdStatValue: 125,
        },
      },
      {
        label: 'zero third value',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatName: 'Critical Damage',
          thirdStatValue: 0,
        },
      },
      {
        label: 'fractional third value',
        body: {
          characterId,
          slot: 1,
          valueId: weapon.id,
          thirdStatName: 'Critical Damage',
          thirdStatValue: 1.5,
        },
      },
    ];

    for (const testCase of invalid) {
      const response = await setSlot(app, testCase.body);
      expect(response.status, testCase.label).toBe(
        testCase.label.startsWith('unknown') ? 404 : 400,
      );
      expect(response.body.error.code, testCase.label).toBe(
        testCase.label.startsWith('unknown') ? 'NOT_FOUND' : 'VALIDATION_ERROR',
      );
    }

    await setSlot(app, {
      characterId,
      slot: 1,
      valueId: weapon.id,
      thirdStatName: '   ',
    }).expect(200);

    await request(app).delete('/api/engraving/slots/99999/1').expect(404);
    await request(app)
      .delete(`/api/engraving/slots/${characterId}/15`)
      .expect(400);
  });

  it('updates every slot that references an edited value', async () => {
    setup();
    const app = context!.app;
    const characterId = await addCharacter(app, 'Raven');
    const engraving = await getEngraving();
    const value = findValue(engraving, 'armor', 'rare', 20);

    await setSlot(app, { characterId, slot: 4, valueId: value.id }).expect(200);

    await request(app)
      .patch(`/api/engraving/values/${value.id}`)
      .send({ firstStatValue: 23 })
      .expect(200);

    const state = await getEngraving();
    const slot = state.slots.find(
      (entry) => entry.characterId === characterId && entry.slot === 4,
    );
    expect(slot).toMatchObject({
      valueId: value.id,
      firstStatValue: 23,
    });
  });

  it('cascades engraving when a character is deleted', async () => {
    setup();
    const app = context!.app;
    const characterId = await addCharacter(app, 'Raven');
    const engraving = await getEngraving();
    const value = findValue(engraving, 'weapon', 'rare', 20);

    await setSlot(app, {
      characterId,
      slot: 1,
      valueId: value.id,
      thirdStatName: 'Critical Damage',
      thirdStatValue: 125,
    }).expect(200);

    await request(app).delete(`/api/characters/${characterId}`).expect(204);

    expect(
      context!.db
        .prepare('SELECT COUNT(*) AS count FROM character_engraving')
        .get(),
    ).toEqual({ count: 0 });
  });
});
