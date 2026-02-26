import { describe, it, expect } from 'vitest';
import type { Document } from '../src/types.js';
import { matchesWhere, sortDocuments, applyListOptions } from '../src/query.js';

function makeDoc(
  overrides: Partial<Document> & { data?: Record<string, unknown> },
): Document {
  return {
    id: overrides.id ?? 'test-id',
    blockType: overrides.blockType ?? 'test',
    data: overrides.data ?? {},
    createdAt: overrides.createdAt ?? new Date('2025-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01'),
  };
}

describe('matchesWhere', () => {
  it('matches exact data field values', () => {
    const doc = makeDoc({ data: { status: 'published', featured: true } });
    expect(matchesWhere(doc, { status: 'published' })).toBe(true);
    expect(matchesWhere(doc, { status: 'draft' })).toBe(false);
  });

  it('matches exact boolean values', () => {
    const doc = makeDoc({ data: { featured: true } });
    expect(matchesWhere(doc, { featured: true })).toBe(true);
    expect(matchesWhere(doc, { featured: false })).toBe(false);
  });

  it('matches document-level fields', () => {
    const doc = makeDoc({
      blockType: 'article',
      createdAt: new Date('2025-06-15'),
    });
    expect(matchesWhere(doc, { blockType: 'article' })).toBe(true);
    expect(matchesWhere(doc, { createdAt: new Date('2025-06-15') })).toBe(true);
  });

  it('matches multiple conditions (AND)', () => {
    const doc = makeDoc({ data: { status: 'published', featured: true } });
    expect(matchesWhere(doc, { status: 'published', featured: true })).toBe(
      true,
    );
    expect(matchesWhere(doc, { status: 'published', featured: false })).toBe(
      false,
    );
  });

  it('supports $gt operator', () => {
    const doc = makeDoc({ data: { count: 10 } });
    expect(matchesWhere(doc, { count: { $gt: 5 } })).toBe(true);
    expect(matchesWhere(doc, { count: { $gt: 10 } })).toBe(false);
  });

  it('supports $gte operator', () => {
    const doc = makeDoc({ data: { count: 10 } });
    expect(matchesWhere(doc, { count: { $gte: 10 } })).toBe(true);
    expect(matchesWhere(doc, { count: { $gte: 11 } })).toBe(false);
  });

  it('supports $lt operator', () => {
    const doc = makeDoc({ data: { count: 10 } });
    expect(matchesWhere(doc, { count: { $lt: 15 } })).toBe(true);
    expect(matchesWhere(doc, { count: { $lt: 10 } })).toBe(false);
  });

  it('supports $lte operator', () => {
    const doc = makeDoc({ data: { count: 10 } });
    expect(matchesWhere(doc, { count: { $lte: 10 } })).toBe(true);
    expect(matchesWhere(doc, { count: { $lte: 9 } })).toBe(false);
  });

  it('supports $ne operator', () => {
    const doc = makeDoc({ data: { status: 'published' } });
    expect(matchesWhere(doc, { status: { $ne: 'draft' } })).toBe(true);
    expect(matchesWhere(doc, { status: { $ne: 'published' } })).toBe(false);
  });

  it('supports $contains operator (case-insensitive)', () => {
    const doc = makeDoc({ data: { title: 'Hello NextLake World' } });
    expect(matchesWhere(doc, { title: { $contains: 'nextlake' } })).toBe(true);
    expect(matchesWhere(doc, { title: { $contains: 'NEXTLAKE' } })).toBe(true);
    expect(matchesWhere(doc, { title: { $contains: 'missing' } })).toBe(false);
  });

  it('supports $gt on dates', () => {
    const doc = makeDoc({ createdAt: new Date('2025-06-15') });
    expect(
      matchesWhere(doc, { createdAt: { $gt: new Date('2025-01-01') } }),
    ).toBe(true);
    expect(
      matchesWhere(doc, { createdAt: { $gt: new Date('2025-12-01') } }),
    ).toBe(false);
  });
});

describe('sortDocuments', () => {
  const docs = [
    makeDoc({
      id: '1',
      data: { title: 'B' },
      createdAt: new Date('2025-02-01'),
    }),
    makeDoc({
      id: '2',
      data: { title: 'A' },
      createdAt: new Date('2025-01-01'),
    }),
    makeDoc({
      id: '3',
      data: { title: 'C' },
      createdAt: new Date('2025-03-01'),
    }),
  ];

  it('sorts by document-level field ascending', () => {
    const sorted = sortDocuments(docs, { createdAt: 'asc' });
    expect(sorted.map((d) => d.id)).toEqual(['2', '1', '3']);
  });

  it('sorts by document-level field descending', () => {
    const sorted = sortDocuments(docs, { createdAt: 'desc' });
    expect(sorted.map((d) => d.id)).toEqual(['3', '1', '2']);
  });

  it('sorts by data-level field', () => {
    const sorted = sortDocuments(docs, { title: 'asc' });
    expect(sorted.map((d) => d.id)).toEqual(['2', '1', '3']);
  });

  it('does not mutate the original array', () => {
    const original = [...docs];
    sortDocuments(docs, { createdAt: 'desc' });
    expect(docs).toEqual(original);
  });
});

describe('applyListOptions', () => {
  const docs = Array.from({ length: 5 }, (_, i) =>
    makeDoc({
      id: String(i),
      data: { index: i },
      createdAt: new Date(`2025-0${i + 1}-01`),
    }),
  );

  it('applies limit', () => {
    const result = applyListOptions(docs, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('applies offset', () => {
    const result = applyListOptions(docs, { offset: 3 });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('3');
  });

  it('applies limit and offset together', () => {
    const result = applyListOptions(docs, { limit: 2, offset: 1 });
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(['1', '2']);
  });

  it('returns all documents when no options provided', () => {
    const result = applyListOptions(docs, undefined);
    expect(result).toHaveLength(5);
  });

  it('applies where + orderBy + limit together', () => {
    const result = applyListOptions(docs, {
      where: { index: { $gte: 2 } },
      orderBy: { createdAt: 'desc' },
      limit: 2,
    });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('4');
    expect(result[1].id).toBe('3');
  });
});
