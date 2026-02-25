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
});
