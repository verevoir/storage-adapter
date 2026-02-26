import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PostgresAdapter } from '../src/postgres/adapter.js';

describe('PostgresAdapter', () => {
  let container: StartedPostgreSqlContainer;
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().withReuse().start();
    adapter = new PostgresAdapter({
      connectionString: container.getConnectionUri(),
    });
    await adapter.connect();
    await adapter.migrate();
  }, 60_000);

  afterAll(async () => {
    await adapter?.disconnect();
    await container?.stop();
  });

  it('creates a document with generated metadata', async () => {
    const doc = await adapter.create('hero', { title: 'Hello' });

    expect(doc.id).toBeDefined();
    expect(doc.blockType).toBe('hero');
    expect(doc.data).toEqual({ title: 'Hello' });
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('retrieves a document by id', async () => {
    const created = await adapter.create('hero', { title: 'Fetch me' });
    const fetched = await adapter.get(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.data).toEqual({ title: 'Fetch me' });
  });

  it('returns null for a non-existent id', async () => {
    const fetched = await adapter.get('00000000-0000-0000-0000-000000000000');

    expect(fetched).toBeNull();
  });

  it("updates a document's data", async () => {
    const created = await adapter.create('hero', { title: 'Original' });
    const updated = await adapter.update(created.id, { title: 'Updated' });

    expect(updated.id).toBe(created.id);
    expect(updated.blockType).toBe('hero');
    expect(updated.data).toEqual({ title: 'Updated' });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
  });

  it('throws when updating a non-existent document', async () => {
    await expect(
      adapter.update('00000000-0000-0000-0000-000000000000', { title: 'Nope' }),
    ).rejects.toThrow('Document not found');
  });

  it('deletes a document', async () => {
    const created = await adapter.create('hero', { title: 'Delete me' });
    await adapter.delete(created.id);

    const fetched = await adapter.get(created.id);
    expect(fetched).toBeNull();
  });

  it('throws when deleting a non-existent document', async () => {
    await expect(
      adapter.delete('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Document not found');
  });

  it('lists documents by block type', async () => {
    // Create documents with a unique block type to avoid interference
    await adapter.create('pg-list-test', { title: 'Item 1' });
    await adapter.create('pg-list-test', { title: 'Item 2' });
    await adapter.create('pg-list-other', { title: 'Other' });

    const items = await adapter.list('pg-list-test');
    const others = await adapter.list('pg-list-other');

    expect(items).toHaveLength(2);
    expect(others).toHaveLength(1);
    expect(items.every((d) => d.blockType === 'pg-list-test')).toBe(true);
  });

  it('returns an empty list for an unknown block type', async () => {
    const results = await adapter.list('nonexistent-type');

    expect(results).toEqual([]);
  });

  it('round-trips complex JSONB data', async () => {
    const complexData = {
      title: 'Complex',
      tags: ['a', 'b', 'c'],
      nested: { deep: { value: 42 } },
      flag: true,
    };

    const created = await adapter.create('complex', complexData);
    const fetched = await adapter.get(created.id);

    expect(fetched!.data).toEqual(complexData);
  });

  it('migrate is idempotent', async () => {
    // Should not throw when called again
    await adapter.migrate();
  });

  describe('list() with options', () => {
    it('filters by exact data field value', async () => {
      await adapter.create('pg-q-filter', { title: 'A', status: 'draft' });
      await adapter.create('pg-q-filter', {
        title: 'B',
        status: 'published',
      });
      await adapter.create('pg-q-filter', {
        title: 'C',
        status: 'published',
      });

      const published = await adapter.list('pg-q-filter', {
        where: { status: 'published' },
      });
      expect(published).toHaveLength(2);
      expect(
        published.every(
          (d) => (d.data as Record<string, unknown>).status === 'published',
        ),
      ).toBe(true);
    });

    it('filters with $contains (case-insensitive)', async () => {
      await adapter.create('pg-q-contains', { title: 'Hello NextLake' });
      await adapter.create('pg-q-contains', { title: 'Other post' });

      const results = await adapter.list('pg-q-contains', {
        where: { title: { $contains: 'nextlake' } },
      });
      expect(results).toHaveLength(1);
      expect((results[0].data as Record<string, unknown>).title).toBe(
        'Hello NextLake',
      );
    });

    it('sorts by data field', async () => {
      await adapter.create('pg-q-sort', { title: 'B' });
      await adapter.create('pg-q-sort', { title: 'A' });
      await adapter.create('pg-q-sort', { title: 'C' });

      const results = await adapter.list('pg-q-sort', {
        orderBy: { title: 'asc' },
      });
      expect(
        results.map((d) => (d.data as Record<string, unknown>).title),
      ).toEqual(['A', 'B', 'C']);
    });

    it('sorts by createdAt descending', async () => {
      const a = await adapter.create('pg-q-sortd', { title: 'First' });
      const b = await adapter.create('pg-q-sortd', { title: 'Second' });

      const results = await adapter.list('pg-q-sortd', {
        orderBy: { createdAt: 'desc' },
      });
      expect(results[0].id).toBe(b.id);
      expect(results[1].id).toBe(a.id);
    });

    it('applies limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.create('pg-q-page', { title: `Item ${i}` });
      }

      const page = await adapter.list('pg-q-page', { limit: 2, offset: 2 });
      expect(page).toHaveLength(2);
    });

    it('combines where, orderBy, limit, and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.create('pg-q-combo', {
          title: `Item ${String(i).padStart(2, '0')}`,
          status: i % 2 === 0 ? 'published' : 'draft',
        });
      }

      const results = await adapter.list('pg-q-combo', {
        where: { status: 'published' },
        orderBy: { title: 'asc' },
        limit: 2,
        offset: 1,
      });
      expect(results).toHaveLength(2);
      expect(
        results.every(
          (d) => (d.data as Record<string, unknown>).status === 'published',
        ),
      ).toBe(true);
    });
  });

  describe('getMany()', () => {
    it('returns documents for matching IDs', async () => {
      const a = await adapter.create('pg-getmany', { title: 'A' });
      const b = await adapter.create('pg-getmany', { title: 'B' });
      await adapter.create('pg-getmany', { title: 'C' });

      const result = await adapter.getMany([a.id, b.id]);
      expect(result.size).toBe(2);
      expect((result.get(a.id)?.data as Record<string, unknown>).title).toBe(
        'A',
      );
      expect((result.get(b.id)?.data as Record<string, unknown>).title).toBe(
        'B',
      );
    });

    it('silently omits missing IDs', async () => {
      const a = await adapter.create('pg-getmany2', { title: 'A' });

      const result = await adapter.getMany([
        a.id,
        '00000000-0000-0000-0000-000000000099',
      ]);
      expect(result.size).toBe(1);
      expect(result.has('00000000-0000-0000-0000-000000000099')).toBe(false);
    });

    it('returns empty map for empty input', async () => {
      const result = await adapter.getMany([]);
      expect(result.size).toBe(0);
    });
  });
});
