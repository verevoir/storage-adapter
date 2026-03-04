# @verevoir/storage

A database-agnostic persistence layer for NextLake content. Provides an abstract `StorageAdapter` interface and two implementations: an in-memory adapter for development/testing and a Postgres adapter using JSONB.

## What It Does

- Defines a `StorageAdapter` interface for CRUD + listing of content documents
- Ships a `MemoryAdapter` for tests and local development (zero dependencies)
- Ships a `PostgresAdapter` backed by a single JSONB table (depends on `pg`)
- Stores metadata (id, block type, timestamps) as proper columns; content payload as JSONB
- Does **not** validate data — validation is the schema engine's job

## Install

```bash
npm install @verevoir/storage
```

## Quick Example

### In-Memory (development/testing)

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
await storage.migrate(); // creates documents table
const doc = await storage.create('hero', { title: 'Hello' });
await storage.disconnect();
```

## StorageAdapter Interface

```typescript
interface StorageAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  migrate(): Promise<void>;

  create(blockType: string, data: Record<string, unknown>): Promise<Document>;
  get(id: string): Promise<Document | null>;
  update(id: string, data: Record<string, unknown>): Promise<Document>;
  delete(id: string): Promise<void>;

  list(blockType: string): Promise<Document[]>;
}
```

## Document Type

```typescript
interface Document<T = Record<string, unknown>> {
  id: string;
  blockType: string;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}
```

## Architecture

| File                         | Responsibility                                        |
| ---------------------------- | ----------------------------------------------------- |
| `src/types.ts`               | `Document` and `StorageAdapter` interface definitions |
| `src/memory.ts`              | In-memory adapter using a Map                         |
| `src/postgres/adapter.ts`    | Postgres adapter using `pg`                           |
| `src/postgres/migrations.ts` | Table creation SQL                                    |
| `src/index.ts`               | Public API exports                                    |

## Design Decisions

- **The adapter does not validate data.** Validation belongs to the schema engine. The adapter persists whatever it receives.
- **Postgres stores content in a single `documents` table** with a JSONB `data` column. Metadata columns (`id`, `block_type`, `created_at`, `updated_at`) are proper typed columns for indexing and querying.
- **The in-memory adapter matches the same interface**, making it a drop-in replacement for tests.

## Development

```bash
npm install    # Install dependencies
make build     # Compile TypeScript
make test      # Run test suite (needs Docker for Postgres integration tests)
make lint      # Check formatting
```
