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

function readDatabaseSnapshot(db: Database.Database) {
  return {
    characters: db
      .prepare('SELECT id, name, created_at FROM characters ORDER BY id')
      .all(),
    nests: db
      .prepare('SELECT id, name, created_at FROM nests ORDER BY id')
      .all(),
    runs: db
      .prepare(
        `SELECT character_id, nest_id, week_key, completed_at
           FROM runs
          ORDER BY character_id, nest_id, week_key`,
      )
      .all(),
    plateLevels: db
      .prepare('SELECT value FROM plate_levels ORDER BY value')
      .all(),
    plates: db
      .prepare('SELECT id, name, created_at FROM plates ORDER BY id')
      .all(),
    heraldry: db
      .prepare(
        `SELECT character_id, slot, plate_id, level, rarity, has_third_stat
           FROM character_heraldry
          ORDER BY character_id, slot`,
      )
      .all(),
    engravingValues: db
      .prepare(
        `SELECT id, category, grade, first_stat_value, second_stat_value
           FROM engraving_values
          ORDER BY id`,
      )
      .all(),
    engraving: db
      .prepare(
        `SELECT character_id, slot, value_id, third_stat_name, third_stat_value
           FROM character_engraving
          ORDER BY character_id, slot`,
      )
      .all(),
    cards: db
      .prepare('SELECT id, name, created_at FROM cards ORDER BY id')
      .all(),
    characterCards: db
      .prepare(
        `SELECT character_id, card_id, grade
           FROM character_cards
          ORDER BY character_id, card_id`,
      )
      .all(),
  };
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

function validV2Payload() {
  return {
    version: 2,
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
    plateLevels: [30, 27],
    plates: [
      {
        id: 30,
        name: 'Bear',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 31,
        name: 'Wolf',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
    ],
    characterHeraldry: [
      {
        characterId: 10,
        slot: 1,
        plateId: 30,
        level: 30,
        rarity: 'epic',
        hasThirdStat: true,
      },
      {
        characterId: 10,
        slot: 2,
        plateId: 31,
        level: 27,
        rarity: 'epic',
        hasThirdStat: false,
      },
    ],
  };
}

function validV3Payload() {
  return {
    ...validV2Payload(),
    version: 3,
    engravingValues: {
      weapon: [
        { id: 40, grade: 'rare', firstStatValue: 20, secondStatValue: null },
      ],
      armor: [
        { id: 41, grade: 'unique', firstStatValue: 108, secondStatValue: null },
      ],
      accessory: [
        { id: 42, grade: 'epic', firstStatValue: 28, secondStatValue: 56 },
      ],
      wtd: [{ id: 43, grade: 'epic', firstStatValue: 26, secondStatValue: 70 }],
    },
    characterEngraving: [
      {
        characterId: 10,
        slot: 1,
        valueId: 40,
        thirdStatName: 'Critical Damage',
        thirdStatValue: 125,
      },
      {
        characterId: 10,
        slot: 3,
        valueId: 41,
        thirdStatName: null,
        thirdStatValue: null,
      },
      {
        characterId: 10,
        slot: 8,
        valueId: 42,
        thirdStatName: null,
        thirdStatValue: null,
      },
      {
        characterId: 10,
        slot: 12,
        valueId: 43,
        thirdStatName: null,
        thirdStatValue: null,
      },
    ],
  };
}

function validV4Payload() {
  return {
    ...validV3Payload(),
    version: 4,
    cards: [
      {
        id: 50,
        name: 'Red Dragon',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 51,
        name: 'Blue Dragon',
        createdAt: '2026-01-06T00:00:00.000Z',
      },
    ],
    characterCards: [
      { characterId: 10, cardId: 50, grade: 'legend' },
      { characterId: 10, cardId: 51, grade: 'magic' },
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
      plateLevels: 0,
      plates: 0,
      heraldrySlots: 0,
      engravingValues: 0,
      engravingSlots: 0,
      cards: 0,
      cardSlots: 0,
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

  it('clears heraldry when importing a version 1 file', async () => {
    setup();

    const characterId = Number(
      context.db
        .prepare('INSERT INTO characters (name) VALUES (?)')
        .run('Existing')
        .lastInsertRowid,
    );
    context.db.prepare('INSERT INTO plate_levels (value) VALUES (30)').run();
    const plateId = Number(
      context.db
        .prepare('INSERT INTO plates (name) VALUES (?)')
        .run('Bear')
        .lastInsertRowid,
    );
    context.db
      .prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (?, 1, ?, 30, 'epic', 1)`,
      )
      .run(characterId, plateId);
    context.db
      .prepare(
        `INSERT INTO character_engraving
           (character_id, slot, value_id, third_stat_name, third_stat_value)
         VALUES (?, 1, 1, ?, 25)`,
      )
      .run(characterId, 'Critical Damage');

    const response = await request(context.app)
      .post('/api/data/import')
      .send(validPayload())
      .expect(200);

    expect(response.body.imported).toEqual({
      characters: 1,
      nests: 1,
      runs: 1,
      plateLevels: 0,
      plates: 0,
      heraldrySlots: 0,
      engravingValues: 0,
      engravingSlots: 0,
      cards: 0,
      cardSlots: 0,
    });

    expect(
      context.db
        .prepare('SELECT COUNT(*) AS count FROM engraving_values')
        .get(),
    ).toEqual({ count: 136 });
    expect(
      context.db
        .prepare('SELECT COUNT(*) AS count FROM character_engraving')
        .get(),
    ).toEqual({ count: 0 });

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(state.heraldry.levels).toEqual([]);
    expect(state.heraldry.cap).toBeNull();
    expect(state.heraldry.plates).toEqual([]);
    expect(state.heraldry.slots).toHaveLength(8);
    expect(
      state.heraldry.slots.every(
        (slot: { characterId: number; isEmpty: boolean }) =>
          slot.characterId === 10 && slot.isEmpty,
      ),
    ).toBe(true);
  });

  it('round-trips a version 2 export with heraldry', async () => {
    setup();

    const first = await request(context.app)
      .post('/api/data/import')
      .send(validV2Payload())
      .expect(200);

    expect(first.body.imported).toEqual({
      characters: 1,
      nests: 1,
      runs: 1,
      plateLevels: 2,
      plates: 2,
      heraldrySlots: 2,
      engravingValues: 0,
      engravingSlots: 0,
      cards: 0,
      cardSlots: 0,
    });

    const exported = (
      await request(context.app).get('/api/data/export').expect(200)
    ).body;
    expect(exported).toMatchObject({
      version: 4,
      plateLevels: [30, 27],
      plates: [
        { id: 30, name: 'Bear' },
        { id: 31, name: 'Wolf' },
      ],
      characterHeraldry: [
        {
          characterId: 10,
          slot: 1,
          plateId: 30,
          level: 30,
          rarity: 'epic',
          hasThirdStat: true,
        },
        {
          characterId: 10,
          slot: 2,
          plateId: 31,
          level: 27,
          rarity: 'epic',
          hasThirdStat: false,
        },
      ],
      characterEngraving: [],
    });
    expect(
      Object.values(exported.engravingValues as Record<string, unknown[]>).reduce(
        (total, rows) => total + rows.length,
        0,
      ),
    ).toBe(136);

    const second = await request(context.app)
      .post('/api/data/import')
      .send(exported)
      .expect(200);
    expect(second.body.imported).toEqual({
      ...first.body.imported,
      engravingValues: 136,
    });

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(state.heraldry.levels).toEqual([30, 27]);
    expect(state.heraldry.cap).toBe(30);
    expect(state.heraldry.plates.map((plate: { name: string }) => plate.name))
      .toEqual(['Bear', 'Wolf']);

    const filled = state.heraldry.slots.filter(
      (slot: { isEmpty: boolean }) => !slot.isEmpty,
    );
    expect(
      filled.map(
        (slot: {
          slot: number;
          plateName: string;
          level: number;
          rarity: string;
          hasThirdStat: boolean;
          status: string;
        }) => ({
          slot: slot.slot,
          plateName: slot.plateName,
          level: slot.level,
          rarity: slot.rarity,
          hasThirdStat: slot.hasThirdStat,
          status: slot.status,
        }),
      ),
    ).toEqual([
      {
        slot: 1,
        plateName: 'Bear',
        level: 30,
        rarity: 'epic',
        hasThirdStat: true,
        status: 'ok',
      },
      {
        slot: 2,
        plateName: 'Wolf',
        level: 27,
        rarity: 'epic',
        hasThirdStat: false,
        status: 'recommended',
      },
    ]);
  });

  it('round-trips a version 3 export with engraving', async () => {
    setup();

    const first = await request(context.app)
      .post('/api/data/import')
      .send(validV3Payload())
      .expect(200);

    expect(first.body.imported).toEqual({
      characters: 1,
      nests: 1,
      runs: 1,
      plateLevels: 2,
      plates: 2,
      heraldrySlots: 2,
      engravingValues: 4,
      engravingSlots: 4,
      cards: 0,
      cardSlots: 0,
    });

    const exported = (
      await request(context.app).get('/api/data/export').expect(200)
    ).body;
    expect(exported.version).toBe(4);
    expect(exported.cards).toEqual([]);
    expect(exported.characterCards).toEqual([]);
    expect(exported.engravingValues).toEqual({
      weapon: [
        { id: 40, grade: 'rare', firstStatValue: 20, secondStatValue: null },
      ],
      armor: [
        { id: 41, grade: 'unique', firstStatValue: 108, secondStatValue: null },
      ],
      accessory: [
        { id: 42, grade: 'epic', firstStatValue: 28, secondStatValue: 56 },
      ],
      wtd: [
        { id: 43, grade: 'epic', firstStatValue: 26, secondStatValue: 70 },
      ],
    });
    expect(exported.characterEngraving).toEqual(
      validV3Payload().characterEngraving,
    );

    const second = await request(context.app)
      .post('/api/data/import')
      .send(exported)
      .expect(200);
    expect(second.body.imported).toEqual(first.body.imported);

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(state.engraving.slotCount).toBe(14);
    expect(state.engraving.perCharacter).toEqual([
      {
        characterId: 10,
        name: 'Raven',
        emptyCount: 10,
        filledCount: 4,
        emptySlots: expect.arrayContaining([
          { slot: 2, label: 'Secondary weapon' },
          { slot: 14, label: 'Decal' },
        ]),
      },
    ]);
  });

  it('round-trips a version 4 export with cards', async () => {
    setup();

    const first = await request(context.app)
      .post('/api/data/import')
      .send(validV4Payload())
      .expect(200);

    expect(first.body.imported).toEqual({
      characters: 1,
      nests: 1,
      runs: 1,
      plateLevels: 2,
      plates: 2,
      heraldrySlots: 2,
      engravingValues: 4,
      engravingSlots: 4,
      cards: 2,
      cardSlots: 2,
    });

    const exported = (
      await request(context.app).get('/api/data/export').expect(200)
    ).body;
    expect(exported).toEqual({
      ...validV4Payload(),
      exportedAt: expect.any(String),
    });

    const second = await request(context.app)
      .post('/api/data/import')
      .send(exported)
      .expect(200);
    expect(second.body.imported).toEqual(first.body.imported);

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(state.heraldry.levels).toEqual([30, 27]);
    expect(state.heraldry.cap).toBe(30);
    expect(state.heraldry.plates.map((plate: { name: string }) => plate.name))
      .toEqual(['Bear', 'Wolf']);

    const filled = state.heraldry.slots.filter(
      (slot: { isEmpty: boolean }) => !slot.isEmpty,
    );
    expect(
      filled.map(
        (slot: {
          slot: number;
          plateName: string;
          level: number;
          rarity: string;
          hasThirdStat: boolean;
          status: string;
        }) => ({
          slot: slot.slot,
          plateName: slot.plateName,
          level: slot.level,
          rarity: slot.rarity,
          hasThirdStat: slot.hasThirdStat,
          status: slot.status,
        }),
      ),
    ).toEqual([
      {
        slot: 1,
        plateName: 'Bear',
        level: 30,
        rarity: 'epic',
        hasThirdStat: true,
        status: 'ok',
      },
      {
        slot: 2,
        plateName: 'Wolf',
        level: 27,
        rarity: 'epic',
        hasThirdStat: false,
        status: 'recommended',
      },
    ]);

    expect(state.engraving.slotCount).toBe(14);
    expect(state.engraving.perCharacter).toEqual([
      {
        characterId: 10,
        name: 'Raven',
        emptyCount: 10,
        filledCount: 4,
        emptySlots: expect.arrayContaining([
          { slot: 2, label: 'Secondary weapon' },
          { slot: 14, label: 'Decal' },
        ]),
      },
    ]);

    expect(state.cards.catalog.map((card: { name: string }) => card.name))
      .toEqual(['Blue Dragon', 'Red Dragon']);
    expect(state.cards.entries).toEqual([
      {
        characterId: 10,
        cardId: 51,
        cardName: 'Blue Dragon',
        grade: 'magic',
      },
      {
        characterId: 10,
        cardId: 50,
        cardName: 'Red Dragon',
        grade: 'legend',
      },
    ]);
  });

  it('keeps the card catalog and clears character cards for versions 1 to 3', async () => {
    setup();

    const cardId = Number(
      context.db
        .prepare('INSERT INTO cards (name) VALUES (?)')
        .run('Existing Card')
        .lastInsertRowid,
    );

    const payloads = [
      validPayload(),
      validV2Payload(),
      validV3Payload(),
    ];
    const versions = [1, 2, 3];

    for (let index = 0; index < payloads.length; index += 1) {
      const characterId = Number(
        context.db
          .prepare('INSERT INTO characters (name) VALUES (?)')
          .run(`Seed ${versions[index]}`)
          .lastInsertRowid,
      );
      const seedCardId = Number(
        context.db
          .prepare('INSERT INTO cards (name) VALUES (?)')
          .run(`Seed Card ${versions[index]}`)
          .lastInsertRowid,
      );
      context.db
        .prepare(
          'INSERT INTO character_cards (character_id, card_id, grade) VALUES (?, ?, ?)',
        )
        .run(characterId, seedCardId, 'rare');
      context.db
        .prepare(
          'INSERT INTO character_cards (character_id, card_id, grade) VALUES (?, ?, ?)',
        )
        .run(characterId, cardId, 'magic');

      await request(context.app)
        .post('/api/data/import')
        .send(payloads[index])
        .expect(200);

      expect(
        context.db.prepare('SELECT COUNT(*) AS count FROM character_cards').get(),
      ).toEqual({ count: 0 });
    }

    expect(
      context.db.prepare('SELECT COUNT(*) AS count FROM cards').get(),
    ).toEqual({ count: 4 });
  });

  it('replaces the card catalog and character cards for version 4', async () => {
    setup();

    const characterId = Number(
      context.db
        .prepare('INSERT INTO characters (name) VALUES (?)')
        .run('Existing')
        .lastInsertRowid,
    );
    const cardId = Number(
      context.db
        .prepare('INSERT INTO cards (name) VALUES (?)')
        .run('Existing Card')
        .lastInsertRowid,
    );
    context.db
      .prepare(
        'INSERT INTO character_cards (character_id, card_id, grade) VALUES (?, ?, ?)',
      )
      .run(characterId, cardId, 'legend');

    await request(context.app)
      .post('/api/data/import')
      .send(validV4Payload())
      .expect(200);

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(
      state.cards.catalog.map((card: { name: string }) => card.name),
    ).toEqual(['Blue Dragon', 'Red Dragon']);
    expect(state.cards.entries).toHaveLength(2);
  });

  it('accepts empty engraving category arrays in a version 3 file', async () => {
    setup();

    const payload = {
      ...validV3Payload(),
      engravingValues: {
        weapon: [],
        armor: [],
        accessory: [],
        wtd: [],
      },
      characterEngraving: [],
    };

    const response = await request(context.app)
      .post('/api/data/import')
      .send(payload)
      .expect(200);

    expect(response.body.imported.engravingValues).toBe(0);
    expect(response.body.imported.engravingSlots).toBe(0);

    const state = (await request(context.app).get('/api/state').expect(200))
      .body;
    expect(state.engraving.valueTables).toEqual({
      weapon: [],
      armor: [],
      accessory: [],
      wtd: [],
    });
  });

  it('clears character engraving but keeps values when importing version 2', async () => {
    setup();

    const characterId = Number(
      context.db
        .prepare('INSERT INTO characters (name) VALUES (?)')
        .run('Existing')
        .lastInsertRowid,
    );
    context.db
      .prepare(
        `INSERT INTO character_engraving
           (character_id, slot, value_id, third_stat_name, third_stat_value)
         VALUES (?, 1, 1, ?, 25)`,
      )
      .run(characterId, 'Critical Damage');

    await request(context.app)
      .post('/api/data/import')
      .send(validV2Payload())
      .expect(200);

    expect(
      context.db
        .prepare('SELECT COUNT(*) AS count FROM engraving_values')
        .get(),
    ).toEqual({ count: 136 });
    expect(
      context.db
        .prepare('SELECT COUNT(*) AS count FROM character_engraving')
        .get(),
    ).toEqual({ count: 0 });
  });

  it('rejects invalid payloads without changing the database or creating a backup', async () => {
    setup();

    const characterId = Number(
      context.db
        .prepare('INSERT INTO characters (name) VALUES (?)')
        .run('Original').lastInsertRowid,
    );
    const nestId = Number(
      context.db
        .prepare('INSERT INTO nests (name) VALUES (?)')
        .run('Original Nest').lastInsertRowid,
    );
    context.db
      .prepare(
        `INSERT INTO runs (character_id, nest_id, week_key, completed_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        characterId,
        nestId,
        '2026-10-17',
        '2026-10-17T05:00:00.000Z',
      );
    context.db.prepare('INSERT INTO plate_levels (value) VALUES (?)').run(30);
    const plateId = Number(
      context.db
        .prepare('INSERT INTO plates (name) VALUES (?)')
        .run('Original Plate').lastInsertRowid,
    );
    context.db
      .prepare(
        `INSERT INTO character_heraldry
           (character_id, slot, plate_id, level, rarity, has_third_stat)
         VALUES (?, 1, ?, 30, 'rare', 0)`,
      )
      .run(characterId, plateId);

    const engravingValue = context.db
      .prepare(
        `SELECT id FROM engraving_values
          WHERE category = 'weapon'
          ORDER BY id
          LIMIT 1`,
      )
      .get() as { id: number } | undefined;
    if (!engravingValue) {
      throw new Error('Expected the engraving seed to create a weapon value.');
    }
    context.db
      .prepare(
        `INSERT INTO character_engraving
           (character_id, slot, value_id, third_stat_name, third_stat_value)
         VALUES (?, 1, ?, NULL, NULL)`,
      )
      .run(characterId, engravingValue.id);

    const cardId = Number(
      context.db
        .prepare('INSERT INTO cards (name) VALUES (?)')
        .run('Original Card').lastInsertRowid,
    );
    context.db
      .prepare(
        `INSERT INTO character_cards (character_id, card_id, grade)
         VALUES (?, ?, 'magic')`,
      )
      .run(characterId, cardId);

    const before = await fetchState(context.app);
    const databaseBefore = readDatabaseSnapshot(context.db);
    const backupsBefore = fs.readdirSync(context.backupDir);
    for (const [table, rows] of Object.entries(databaseBefore)) {
      expect(rows.length, table).toBeGreaterThan(0);
    }

    const cases: Array<{ label: string; payload: unknown }> = [
      { label: 'bad version', payload: { ...validPayload(), version: 5 } },
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
      {
        label: 'v2 slot level not in file levels',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 30,
              level: 25,
              rarity: 'epic',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 duplicate plate for one character',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
            {
              characterId: 10,
              slot: 2,
              plateId: 30,
              level: 27,
              rarity: 'epic',
              hasThirdStat: false,
            },
          ],
        },
      },
      {
        label: 'v2 invalid rarity',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 30,
              level: 30,
              rarity: 'legendary',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 slot 0',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 0,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 slot 9',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 9,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 duplicate character slot',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
            {
              characterId: 10,
              slot: 1,
              plateId: 31,
              level: 27,
              rarity: 'epic',
              hasThirdStat: false,
            },
          ],
        },
      },
      {
        label: 'v2 unknown character reference',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 999,
              slot: 1,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 unknown plate reference',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 999,
              level: 30,
              rarity: 'epic',
              hasThirdStat: true,
            },
          ],
        },
      },
      {
        label: 'v2 non-boolean third stat',
        payload: {
          ...validV2Payload(),
          characterHeraldry: [
            {
              characterId: 10,
              slot: 1,
              plateId: 30,
              level: 30,
              rarity: 'epic',
              hasThirdStat: 'yes',
            },
          ],
        },
      },
      {
        label: 'v2 duplicate levels',
        payload: { ...validV2Payload(), plateLevels: [30, 30] },
      },
      {
        label: 'v2 missing plateLevels',
        payload: { ...validV2Payload(), plateLevels: undefined },
      },
      {
        label: 'v2 missing plates',
        payload: { ...validV2Payload(), plates: undefined },
      },
      {
        label: 'v2 missing characterHeraldry',
        payload: { ...validV2Payload(), characterHeraldry: undefined },
      },
      {
        label: 'v3 missing engravingValues',
        payload: { ...validV3Payload(), engravingValues: undefined },
      },
      {
        label: 'v3 missing category array',
        payload: {
          ...validV3Payload(),
          engravingValues: { ...validV3Payload().engravingValues, weapon: undefined },
        },
      },
      {
        label: 'v3 missing characterEngraving',
        payload: { ...validV3Payload(), characterEngraving: undefined },
      },
      {
        label: 'v3 duplicate value ids across categories',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            armor: [
              { id: 40, grade: 'unique', firstStatValue: 108, secondStatValue: null },
            ],
          },
        },
      },
      {
        label: 'v3 duplicate value natural key',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            weapon: [
              { id: 40, grade: 'rare', firstStatValue: 20, secondStatValue: null },
              { id: 44, grade: 'rare', firstStatValue: 20, secondStatValue: null },
            ],
          },
        },
      },
      {
        label: 'v3 invalid value grade',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            weapon: [
              { id: 40, grade: 'mythic', firstStatValue: 20, secondStatValue: null },
            ],
          },
        },
      },
      {
        label: 'v3 weapon with second stat',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            weapon: [
              { id: 40, grade: 'rare', firstStatValue: 20, secondStatValue: 10 },
            ],
          },
        },
      },
      {
        label: 'v3 accessory without second stat',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            accessory: [
              { id: 42, grade: 'epic', firstStatValue: 28, secondStatValue: null },
            ],
          },
        },
      },
      {
        label: 'v3 non-positive stat value',
        payload: {
          ...validV3Payload(),
          engravingValues: {
            ...validV3Payload().engravingValues,
            weapon: [
              { id: 40, grade: 'rare', firstStatValue: 0, secondStatValue: null },
            ],
          },
        },
      },
      {
        label: 'v3 duplicate character slot',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            validV3Payload().characterEngraving[0],
            validV3Payload().characterEngraving[0],
          ],
        },
      },
      {
        label: 'v3 unknown character reference',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 999,
              slot: 1,
              valueId: 40,
              thirdStatName: null,
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 unknown value reference',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 1,
              valueId: 999,
              thirdStatName: null,
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 value category does not match slot',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 8,
              valueId: 40,
              thirdStatName: null,
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 slot 0',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 0,
              valueId: 40,
              thirdStatName: null,
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 slot 15',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 15,
              valueId: 43,
              thirdStatName: null,
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 third stat name without value',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 1,
              valueId: 40,
              thirdStatName: 'Critical Damage',
              thirdStatValue: null,
            },
          ],
        },
      },
      {
        label: 'v3 blank third stat name with value',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 1,
              valueId: 40,
              thirdStatName: '   ',
              thirdStatValue: 25,
            },
          ],
        },
      },
      {
        label: 'v3 non-positive third stat value',
        payload: {
          ...validV3Payload(),
          characterEngraving: [
            {
              characterId: 10,
              slot: 1,
              valueId: 40,
              thirdStatName: 'Critical Damage',
              thirdStatValue: 0,
            },
          ],
        },
      },
      {
        label: 'v4 missing cards',
        payload: { ...validV4Payload(), cards: undefined },
      },
      {
        label: 'v4 missing characterCards',
        payload: { ...validV4Payload(), characterCards: undefined },
      },
      {
        label: 'v4 invalid card grade',
        payload: {
          ...validV4Payload(),
          characterCards: [
            { characterId: 10, cardId: 50, grade: 'mythic' },
          ],
        },
      },
      {
        label: 'v4 unknown card reference',
        payload: {
          ...validV4Payload(),
          characterCards: [
            { characterId: 10, cardId: 999, grade: 'rare' },
          ],
        },
      },
      {
        label: 'v4 unknown character reference',
        payload: {
          ...validV4Payload(),
          characterCards: [
            { characterId: 999, cardId: 50, grade: 'rare' },
          ],
        },
      },
      {
        label: 'v4 duplicate character card',
        payload: {
          ...validV4Payload(),
          characterCards: [
            { characterId: 10, cardId: 50, grade: 'rare' },
            { characterId: 10, cardId: 50, grade: 'epic' },
          ],
        },
      },
      {
        label: 'v4 duplicate card ids',
        payload: {
          ...validV4Payload(),
          cards: [
            { id: 50, name: 'A' },
            { id: 50, name: 'B' },
          ],
          characterCards: [],
        },
      },
      {
        label: 'v4 duplicate card names case-insensitively',
        payload: {
          ...validV4Payload(),
          cards: [
            { id: 50, name: 'Alpha' },
            { id: 51, name: 'alpha' },
          ],
          characterCards: [],
        },
      },
      {
        label: 'v4 blank card name',
        payload: {
          ...validV4Payload(),
          cards: [{ id: 50, name: '   ' }],
          characterCards: [],
        },
      },
      {
        label: 'v4 long card name',
        payload: {
          ...validV4Payload(),
          cards: [{ id: 50, name: 'x'.repeat(51) }],
          characterCards: [],
        },
      },
    ];

    for (const testCase of cases) {
      const response = await request(context.app)
        .post('/api/data/import')
        .send(testCase.payload);
      expect(response.status, testCase.label).toBe(400);
      expect(response.body.error.code, testCase.label).toBe('INVALID_IMPORT');
      expect(readDatabaseSnapshot(context.db), testCase.label).toEqual(
        databaseBefore,
      );
      expect(fs.readdirSync(context.backupDir), testCase.label).toEqual(
        backupsBefore,
      );
    }

    const after = await fetchState(context.app);
    expect(after).toEqual(before);
    expect(fs.readdirSync(context.backupDir)).toEqual(backupsBefore);
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
