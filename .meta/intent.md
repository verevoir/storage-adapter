# Intent — @verevoir/storage

## Purpose

Provide a database-agnostic persistence layer so developers can store and retrieve NextLake content documents using whichever database they already run. The developer owns the database — NextLake never does.

## Goals

- Clean interface that any database can implement — not just relational databases
- Ship a zero-dependency MemoryAdapter so tests and prototypes need no infrastructure
- Ship a Postgres reference implementation to prove the interface works with a real database
- Keep metadata (id, type, timestamps) queryable as proper columns while storing content payload as opaque JSON

## Non-goals

- Validate data — validation belongs to the schema engine; the adapter persists whatever it receives
- Be an ORM or query builder — the interface is deliberately narrow (CRUD + list)
- Support every database — the interface exists so the _community_ can build adapters
- Handle migrations beyond initial table creation — schema migrations are the developer's responsibility

## Key design decisions

- **Interface-based abstraction.** `StorageAdapter` is a TypeScript interface, not a base class. This avoids inheritance coupling and lets adapters be structurally typed.
- **Postgres as reference, not exclusive.** The Postgres adapter proves the interface works and gives developers a production-ready starting point, but it is not privileged — MemoryAdapter has the same status.
- **MemoryAdapter ships alongside.** Every project that uses NextLake needs a test adapter. Shipping MemoryAdapter in the same package avoids a separate dev-dependency and guarantees interface parity.
- **Single documents table.** All block types share one table with a JSONB `data` column. This trades query flexibility for simplicity — no migrations when content models change.
- **No data validation.** The adapter trusts its caller. Separating validation (schema engine) from persistence (storage adapter) keeps each package focused and avoids circular dependencies.

## Constraints

- MemoryAdapter must have zero runtime dependencies
- PostgresAdapter depends only on `pg`
- The interface must remain narrow enough for non-relational databases (document stores, KV stores)
