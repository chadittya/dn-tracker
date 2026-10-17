import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
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

function validPayload() {
  return {
    version: 1,
    characters: [
      {
        id: 10,
        name: 'Raven',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    nests: [
      {
        id: 20,
        name: 'Abyss',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    runs: [
      {
        characterId: 10,
        nestId: 20,
        weekKey: '2026-10-17',
        completedAt: '2026-10-17T05:00:00.000Z',
      },
    ],
  };
}

describe('import', () => {
  it('replaces all data and creates a pre-import backup', async () => {
    setup();

    const oldCharacter = context.db
      .prepare('INSERT INTO characters (name) VALUES (?)')
      .run('Old')
      .lastInsertRowid;
    const oldNest = context.db
      .prepare('INSERT INTO nests (name) VALUES (?)')
      .run('OldNest')
      .lastInsertRowid;
    context.db
      .prepare(
        'INSERT INTO runs (character_id, nest_id, week_key) VALUES (?, ?, ?)',
      )
      .run(oldCharacter, oldNest, '2026-10-17');

    const response = await request(context.app)
      .post('/api/data/import')
      .send(validPayload())
      .expect(200);

    expect(response.body.imported).toEqual({
      characters: 1,
      nests: 1,
      runs: 1,
    });
    expect(response.body.backup).toMatch(/^preimport-\d{8}-\d{6}\.db$/);

    const state = await fetchState(context.app);
    expect(state.characters).toEqual([
      { id: 10, name: 'Raven', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(state.nests).toEqual([
      { id: 20, name: 'Abyss', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);
    expect(state.runs).toEqual([
      {
        characterId: 10,
        nestId: 20,
        weekKey: '2026-10-17',
        completedAt: '2026-10-17T05:00:00.000Z',
      },
    ]);

    const backup = new Database(
      path.join(context.backupDir, response.body.backup),
      { readonly: true },
    );
    const backupCharacters = backup
      .prepare('SELECT name FROM characters')
      .all() as Array<{ name: string }>;
    expect(backupCharacters.map((row) => row.name)).toEqual(['Old']);
    backup.close();
  });

  it('rejects invalid payloads without changing the database or creating a backup', async () => {
    setup();

    await request(context.app)
      .post('/api/characters')
      .send({ name: 'Original' })
      .expect(201);

    const before = await fetchState(context.app);

    const cases: Array<{ label: string; payload: unknown }> = [
      { label: 'bad version', payload: { ...validPayload(), version: 2 } },
      {
        label: 'characters not array',
        payload: { ...validPayload(), characters: {} },
      },
      {
        label: 'duplicate character ids',
        payload: {
          ...validPayload(),
          characters: [
            { id: 1, name: 'A' },
            { id: 1, name: 'B' },
          ],
          runs: [],
        },
      },
      {
        label: 'duplicate names case-insensitively',
        payload: {
          ...validPayload(),
          characters: [
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'alpha' },
          ],
          runs: [],
        },
      },
      {
        label: 'blank name',
        payload: {
          ...validPayload(),
          characters: [{ id: 1, name: '   ' }],
          runs: [],
        },
      },
      {
        label: 'name longer than 50',
        payload: {
          ...validPayload(),
          characters: [{ id: 1, name: 'x'.repeat(51) }],
          runs: [],
        },
      },
      {
        label: 'dangling character reference',
        payload: {
          ...validPayload(),
          runs: [
            {
              characterId: 999,
              nestId: 20,
              weekKey: '2026-10-17',
            },
          ],
        },
      },
      {
        label: 'dangling nest reference',
        payload: {
          ...validPayload(),
          runs: [
            {
              characterId: 10,
              nestId: 999,
              weekKey: '2026-10-17',
            },
          ],
        },
      },
      {
        label: 'week key not a Saturday',
        payload: {
          ...validPayload(),
          runs: [
            {
              characterId: 10,
              nestId: 20,
              weekKey: '2026-10-16',
            },
          ],
        },
      },
      {
        label: 'duplicate run triple',
        payload: {
          ...validPayload(),
          runs: [
            { characterId: 10, nestId: 20, weekKey: '2026-10-17' },
            { characterId: 10, nestId: 20, weekKey: '2026-10-17' },
          ],
        },
      },
      {
        label: 'runs not array',
        payload: { ...validPayload(), runs: 'nope' },
      },
    ];

    for (const testCase of cases) {
      const response = await request(context.app)
        .post('/api/data/import')
        .send(testCase.payload);
      expect(response.status, testCase.label).toBe(400);
      expect(response.body.error.code, testCase.label).toBe('INVALID_IMPORT');
    }

    const after = await fetchState(context.app);
    expect(after).toEqual(before);
    expect(fs.readdirSync(context.backupDir)).toEqual([]);
  });

  it('returns 400 for malformed JSON', async () => {
    setup();
    const response = await request(context.app)
      .post('/api/data/import')
      .set('Content-Type', 'application/json')
      .send('{"version": 1,')
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('accepts an import body larger than the default json limit', async () => {
    setup();
    const payload = {
      ...validPayload(),
      padding: 'x'.repeat(200_000),
    };

    await request(context.app)
      .post('/api/data/import')
      .send(payload)
      .expect(200);
  });

  it('keeps the default body limit on other routes', async () => {
    setup();
    const response = await request(context.app)
      .post('/api/characters')
      .send({ name: 'x'.repeat(200_000) })
      .expect(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
