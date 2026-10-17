import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, fetchState } from './helpers';
import type { TestContext } from './helpers';

let context: TestContext;

afterEach(() => {
  context?.close();
});

function setup(): TestContext {
  context = createTestContext();
  return context;
}

async function addCharacter(name: string): Promise<number> {
  const response = await request(context.app)
    .post('/api/characters')
    .send({ name })
    .expect(201);
  return response.body.character.id as number;
}

async function addNest(name: string): Promise<number> {
  const response = await request(context.app)
    .post('/api/nests')
    .send({ name })
    .expect(201);
  return response.body.nest.id as number;
}

function setRun(characterId: number, nestId: number, done: boolean) {
  return request(context.app)
    .put('/api/runs')
    .send({ characterId, nestId, done });
}

describe('runs', () => {
  it('sets done state idempotently and reports the current week', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const nestId = await addNest('Abyss');

    const first = await setRun(characterId, nestId, true).expect(200);
    expect(first.body).toMatchObject({
      done: true,
      weekKey: '2026-10-17',
      nextResetAt: '2026-10-24T01:00:00.000Z',
    });

    const second = await setRun(characterId, nestId, true).expect(200);
    expect(second.body.done).toBe(true);

    const state = await fetchState(context.app);
    expect(state.runs).toHaveLength(1);

    const off = await setRun(characterId, nestId, false).expect(200);
    expect(off.body.done).toBe(false);
    await setRun(characterId, nestId, false).expect(200);

    const after = await fetchState(context.app);
    expect(after.runs).toHaveLength(0);
  });

  it('does not count a run from the previous week as done this week', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const nestId = await addNest('Abyss');

    context.db
      .prepare(
        'INSERT INTO runs (character_id, nest_id, week_key) VALUES (?, ?, ?)',
      )
      .run(characterId, nestId, '2026-10-10');

    let state = await fetchState(context.app);
    expect(state.weekKey).toBe('2026-10-17');
    expect(state.runs).toHaveLength(0);

    await setRun(characterId, nestId, true).expect(200);

    state = await fetchState(context.app);
    expect(state.runs).toHaveLength(1);

    const totalRows = context.db
      .prepare('SELECT COUNT(*) AS count FROM runs')
      .get() as { count: number };
    expect(totalRows.count).toBe(2);
  });

  it('rejects unknown characters, nests, and non-boolean done values', async () => {
    setup();
    const characterId = await addCharacter('Raven');
    const nestId = await addNest('Abyss');

    await setRun(9999, nestId, true).expect(404);
    await setRun(characterId, 9999, true).expect(404);
    await request(context.app)
      .put('/api/runs')
      .send({ characterId, nestId, done: 'yes' })
      .expect(400);
  });
});

describe('characters and nests', () => {
  it('adds entities after runs exist without backfilling', async () => {
    setup();
    const raven = await addCharacter('Raven');
    const abyss = await addNest('Abyss');
    await setRun(raven, abyss, true).expect(200);

    const secondCharacter = await addCharacter('Luna');
    const secondNest = await addNest('Mist');

    const state = await fetchState(context.app);
    expect(state.runs).toHaveLength(1);

    const dashboard = (
      await request(context.app).get('/api/state').expect(200)
    ).body.dashboard;
    expect(dashboard.total).toBe(4);
    expect(dashboard.done).toBe(1);
    expect(dashboard.perCharacter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Raven', done: 1, total: 2 }),
        expect.objectContaining({ name: 'Luna', done: 0, total: 2 }),
      ]),
    );
    expect(dashboard.perNest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Abyss', done: 1, total: 2 }),
        expect.objectContaining({ name: 'Mist', done: 0, total: 2 }),
      ]),
    );

    expect(secondCharacter).not.toBeUndefined();
    expect(secondNest).not.toBeUndefined();
  });

  it('cascades runs when deleting a character or nest', async () => {
    setup();
    const first = await addCharacter('Raven');
    const second = await addCharacter('Luna');
    const abyss = await addNest('Abyss');
    const mist = await addNest('Mist');

    await setRun(first, abyss, true).expect(200);
    await setRun(first, mist, true).expect(200);
    await setRun(second, abyss, true).expect(200);

    await request(context.app).delete(`/api/characters/${first}`).expect(204);

    let rows = context.db
      .prepare('SELECT character_id AS characterId FROM runs')
      .all() as Array<{ characterId: number }>;
    expect(rows).toEqual([{ characterId: second }]);

    await request(context.app).delete(`/api/nests/${abyss}`).expect(204);

    rows = context.db
      .prepare('SELECT character_id AS characterId FROM runs')
      .all() as Array<{ characterId: number }>;
    expect(rows).toHaveLength(0);
  });

  it('rejects duplicate names case-insensitively and trims names', async () => {
    setup();
    const raven = await addCharacter('Raven');

    await request(context.app)
      .post('/api/characters')
      .send({ name: 'raven' })
      .expect(409);
    await request(context.app)
      .post('/api/characters')
      .send({ name: '  RAVEN  ' })
      .expect(409);

    await addNest('Abyss');
    await request(context.app)
      .post('/api/nests')
      .send({ name: 'abyss' })
      .expect(409);

    const second = await addCharacter('Luna');
    await request(context.app)
      .patch(`/api/characters/${second}`)
      .send({ name: 'raven' })
      .expect(409);

    const patched = await request(context.app)
      .patch(`/api/characters/${raven}`)
      .send({ name: '  Raven  ' })
      .expect(200);
    expect(patched.body.character.name).toBe('Raven');
  });

  it('enforces trimmed names of 1-50 characters', async () => {
    setup();
    await request(context.app)
      .post('/api/characters')
      .send({ name: '   ' })
      .expect(400);
    await request(context.app)
      .post('/api/characters')
      .send({ name: 'x'.repeat(51) })
      .expect(400);

    const ok = await request(context.app)
      .post('/api/characters')
      .send({ name: `  ${'x'.repeat(50)}  ` })
      .expect(201);
    expect(ok.body.character.name).toHaveLength(50);
  });

  it('returns 404 for missing entities and unknown API routes', async () => {
    setup();
    await request(context.app).delete('/api/characters/999').expect(404);
    await request(context.app).delete('/api/nests/999').expect(404);

    const response = await request(context.app)
      .get('/api/does-not-exist')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns json for malformed request bodies', async () => {
    setup();
    const response = await request(context.app)
      .post('/api/characters')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});

describe('state payload', () => {
  it('exposes server week data and dashboard rankings', async () => {
    setup();
    const raven = await addCharacter('Raven');
    const luna = await addCharacter('Luna');
    const abyss = await addNest('Abyss');
    const mist = await addNest('Mist');

    await setRun(raven, abyss, true).expect(200);
    await setRun(raven, mist, true).expect(200);
    await setRun(luna, abyss, true).expect(200);

    const response = await request(context.app).get('/api/state').expect(200);
    expect(response.body.weekKey).toBe('2026-10-17');
    expect(response.body.weekStartAt).toBe('2026-10-17T01:00:00.000Z');
    expect(response.body.nextResetAt).toBe('2026-10-24T01:00:00.000Z');
    expect(typeof response.body.serverNow).toBe('string');
    expect(response.body.dashboard.done).toBe(3);
    expect(response.body.dashboard.total).toBe(4);
    expect(response.body.dashboard.mostRemaining).toEqual([
      { characterId: luna, name: 'Luna', remaining: 1 },
      { characterId: raven, name: 'Raven', remaining: 0 },
    ]);
  });
});
