# @verevoir/storage

Database-agnostic persistence for structured content. A stable `StorageAdapter` interface with in-memory and Postgres implementations; swap the adapter, keep the schema and the rest of your app.

```bash
npm install @verevoir/storage
```

## Quick start

### In-memory (dev / test)

```typescript
import { MemoryAdapter } from '@verevoir/storage';

const storage = new MemoryAdapter();
await storage.connect();

const doc = await storage.create('hero', { title: 'Hello', featured: true });
const fetched = await storage.get(doc.id);
const heroes = await storage.list('hero');

await storage.disconnect();
```

### Postgres

```typescript
import { PostgresAdapter } from '@verevoir/storage';

const storage = new PostgresAdapter({
  connectionString: 'postgres://user:pass@localhost:5432/mydb',
});

await storage.connect();
await storage.migrate(); // creates the documents table
const doc = await storage.create('hero', { title: 'Hello' });
await storage.disconnect();
```

Both adapters satisfy the same interface. Tests written against `MemoryAdapter` run without Docker; the Postgres adapter is a drop-in for production.

## Interface

```typescript
interface StorageAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  migrate(): Promise<void>;

  create(blockType: string, data: Record<string, unknown>): Promise<Document>;
  get(id: string): Promise<Document | null>;
  getMany(ids: string[]): Promise<Map<string, Document>>;
  update(id: string, data: Record<string, unknown>): Promise<Document>;
  delete(id: string): Promise<void>;

  list(blockType: string, options?: ListOptions): Promise<Document[]>;
}

interface Document<T = Record<string, unknown>> {
  id: string;
  blockType: string;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}
```

### Query options

`list` accepts a `ListOptions` shape with a type-safe where clause and ordering:

```typescript
const published = await storage.list('page', {
  where: {
    'data.status': 'published',
    'data.publishFrom': { lte: new Date().toISOString() },
  },
  orderBy: { 'data.publishFrom': 'desc' },
  limit: 20,
});
```

Operators: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `contains`, `startsWith`, `endsWith`. Dotted keys reach into the JSONB `data` column (or the Map equivalent on the memory adapter). The same helpers that power the memory adapter's filtering are exported as `matchesWhere`, `sortDocuments`, and `applyListOptions` for adapter authors to reuse.

## Writing your own adapter

```typescript
import type { StorageAdapter, Document, ListOptions } from '@verevoir/storage';

export class MyAdapter implements StorageAdapter {
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async migrate() { /* ... */ }

  async create(blockType, data): Promise<Document> { /* ... */ }
  async get(id): Promise<Document | null> { /* ... */ }
  async getMany(ids): Promise<Map<string, Document>> { /* ... */ }
  async update(id, data): Promise<Document> { /* ... */ }
  async delete(id): Promise<void> { /* ... */ }

  async list(blockType, options?): Promise<Document[]> { /* ... */ }
}
```

The test suite used for `MemoryAdapter` and `PostgresAdapter` is expressed against the interface — point it at your adapter to get broad coverage for free.

## Design decisions

- **No validation.** Validation is the schema engine's job ([`@verevoir/schema`](https://www.npmjs.com/package/@verevoir/schema)). The adapter persists whatever you pass it.
- **Metadata as typed columns, content as JSONB.** Postgres uses a single `documents` table with `id`, `block_type`, `created_at`, `updated_at` as proper columns (indexable, queryable) and `data` as JSONB (schemaless).
- **One interface, many backends.** MemoryAdapter isn't a test-only toy — it's the reference implementation. Postgres, S3, GCS, and filesystem adapters all implement the same contract.
- **Structural typing.** `@verevoir/access`'s `role-store` and the asset manager depend only on the `StorageAdapter` shape, never on an import — so your custom adapter works with them without a dependency on this package.

## Where it sits

- **[@verevoir/schema](https://www.npmjs.com/package/@verevoir/schema)** — define the content shapes this adapter persists.
- **[@verevoir/editor](https://www.npmjs.com/package/@verevoir/editor)** — auto-generated editing UI layered on top.
- **[@verevoir/admin](https://www.npmjs.com/package/@verevoir/admin)** — admin shell that consumes the adapter through the editor.
- **[Verevoir starter](https://github.com/verevoir/astro-sanity-starter)** — a filesystem-backed `BlobAdapter` as a worked reference; swap for Postgres for production.

## Docs

- [Building a storage adapter](https://verevoir.io/docs/building-a-storage-adapter)
- [Integration guide](https://verevoir.io/docs/integration)

## License

MIT
