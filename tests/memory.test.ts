import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../src/memory.js';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
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
    const created = await adapter.create('hero', { title: 'Hello' });
    const fetched = await adapter.get(created.id);

    expect(fetched).toEqual(created);
  });

  it('returns null for a non-existent id', async () => {
    const fetched = await adapter.get('non-existent-id');

    expect(fetched).toBeNull();
  });

  it("updates a document's data", async () => {
    const created = await adapter.create('hero', { title: 'Hello' });
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
      adapter.update('non-existent', { title: 'Nope' }),
    ).rejects.toThrow('Document not found');
  });

  it('deletes a document', async () => {
    const created = await adapter.create('hero', { title: 'Hello' });
    await adapter.delete(created.id);

    const fetched = await adapter.get(created.id);
    expect(fetched).toBeNull();
  });

  it('throws when deleting a non-existent document', async () => {
    await expect(adapter.delete('non-existent')).rejects.toThrow(
      'Document not found',
    );
  });

  it('lists documents by block type', async () => {
    await adapter.create('hero', { title: 'Hero 1' });
    await adapter.create('hero', { title: 'Hero 2' });
    await adapter.create('footer', { text: 'Footer' });

    const heroes = await adapter.list('hero');
    const footers = await adapter.list('footer');

    expect(heroes).toHaveLength(2);
    expect(footers).toHaveLength(1);
    expect(heroes.every((d) => d.blockType === 'hero')).toBe(true);
  });

  it('returns an empty list for an unknown block type', async () => {
    const results = await adapter.list('unknown');

    expect(results).toEqual([]);
  });

  it('clears all data on disconnect', async () => {
    await adapter.create('hero', { title: 'Hello' });
    await adapter.disconnect();

    const results = await adapter.list('hero');
    expect(results).toEqual([]);
  });

  describe('list() with options', () => {
    it('filters by exact data field value', async () => {
      await adapter.create('article', { title: 'A', status: 'draft' });
      await adapter.create('article', { title: 'B', status: 'published' });
      await adapter.create('article', { title: 'C', status: 'published' });

      const published = await adapter.list('article', {
        where: { status: 'published' },
      });
      expect(published).toHaveLength(2);
      expect(published.every((d) => d.data.status === 'published')).toBe(true);
    });

    it('filters with $contains (case-insensitive)', async () => {
      await adapter.create('article', { title: 'Hello NextLake' });
      await adapter.create('article', { title: 'Other post' });

      const results = await adapter.list('article', {
        where: { title: { $contains: 'nextlake' } },
      });
      expect(results).toHaveLength(1);
      expect(results[0].data.title).toBe('Hello NextLake');
    });

    it('filters with comparison operators', async () => {
      await adapter.create('article', { title: 'A', priority: 1 });
      await adapter.create('article', { title: 'B', priority: 5 });
      await adapter.create('article', { title: 'C', priority: 10 });

      const results = await adapter.list('article', {
        where: { priority: { $gte: 5 } },
      });
      expect(results).toHaveLength(2);
    });

    it('sorts by data field', async () => {
      await adapter.create('article', { title: 'B' });
      await adapter.create('article', { title: 'A' });
      await adapter.create('article', { title: 'C' });

      const results = await adapter.list('article', {
        orderBy: { title: 'asc' },
      });
      expect(results.map((d) => d.data.title)).toEqual(['A', 'B', 'C']);
    });

    it('sorts by createdAt descending', async () => {
      const a = await adapter.create('article-sort-date', { title: 'First' });
      // Ensure distinct timestamp
      a.createdAt = new Date('2025-01-01');
      const b = await adapter.create('article-sort-date', { title: 'Second' });
      b.createdAt = new Date('2025-06-01');

      const results = await adapter.list('article-sort-date', {
        orderBy: { createdAt: 'desc' },
      });
      expect(results[0].id).toBe(b.id);
      expect(results[1].id).toBe(a.id);
    });

    it('applies limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.create('article', { title: `Item ${i}` });
      }

      const page = await adapter.list('article', { limit: 2, offset: 2 });
      expect(page).toHaveLength(2);
    });

    it('combines where, orderBy, limit, and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await adapter.create('article', {
          title: `Item ${i}`,
          status: i % 2 === 0 ? 'published' : 'draft',
        });
      }

      const results = await adapter.list('article', {
        where: { status: 'published' },
        orderBy: { title: 'asc' },
        limit: 2,
        offset: 1,
      });
      expect(results).toHaveLength(2);
      expect(results.every((d) => d.data.status === 'published')).toBe(true);
    });
  });

  describe('getMany()', () => {
    it('returns documents for matching IDs', async () => {
      const a = await adapter.create('hero', { title: 'A' });
      const b = await adapter.create('hero', { title: 'B' });
      await adapter.create('hero', { title: 'C' });

      const result = await adapter.getMany([a.id, b.id]);
      expect(result.size).toBe(2);
      expect(result.get(a.id)?.data.title).toBe('A');
      expect(result.get(b.id)?.data.title).toBe('B');
    });

    it('silently omits missing IDs', async () => {
      const a = await adapter.create('hero', { title: 'A' });

      const result = await adapter.getMany([a.id, 'non-existent']);
      expect(result.size).toBe(1);
      expect(result.has('non-existent')).toBe(false);
    });

    it('returns empty map for empty input', async () => {
      const result = await adapter.getMany([]);
      expect(result.size).toBe(0);
    });
  });
});
