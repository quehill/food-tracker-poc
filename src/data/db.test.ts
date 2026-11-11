import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './db';

describe('AppDB', () => {
  let db: AppDB | undefined;

  afterEach(async () => {
    await db?.delete();
  });

  it('opens with the expected tables', async () => {
    db = new AppDB('test-schema');
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'foods',
      'logEntries',
      'meals',
      'settings',
    ]);
  });
});
