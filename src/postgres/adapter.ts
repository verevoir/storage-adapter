import pg from 'pg';
import type { Document, StorageAdapter } from '../types.js';
import { migrate } from './migrations.js';

/** Connection options for the Postgres adapter. */
export interface PostgresAdapterOptions {
  /** A `postgres://` connection string. Passed directly to `pg.Pool`. */
  connectionString: string;
}

/** Postgres storage adapter using a single JSONB-backed documents table */
export class PostgresAdapter implements StorageAdapter {
  private pool: pg.Pool;

  constructor(options: PostgresAdapterOptions) {
    this.pool = new pg.Pool({ connectionString: options.connectionString });
  }

  async connect(): Promise<void> {
    // Verify the connection is working
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async migrate(): Promise<void> {
    await migrate(this.pool);
  }

  async create(
    blockType: string,
    data: Record<string, unknown>,
  ): Promise<Document> {
    const result = await this.pool.query(
      `INSERT INTO documents (block_type, data)
       VALUES ($1, $2)
       RETURNING id, block_type, data, created_at, updated_at`,
      [blockType, JSON.stringify(data)],
    );
    return this.rowToDocument(result.rows[0]);
  }

  async get(id: string): Promise<Document | null> {
    const result = await this.pool.query(
      `SELECT id, block_type, data, created_at, updated_at
       FROM documents WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.rowToDocument(result.rows[0]);
  }

  async update(id: string, data: Record<string, unknown>): Promise<Document> {
    const result = await this.pool.query(
      `UPDATE documents
       SET data = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, block_type, data, created_at, updated_at`,
      [id, JSON.stringify(data)],
    );
    if (result.rows.length === 0) {
      throw new Error(`Document not found: ${id}`);
    }
    return this.rowToDocument(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM documents WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new Error(`Document not found: ${id}`);
    }
  }

  async list(blockType: string): Promise<Document[]> {
    const result = await this.pool.query(
      `SELECT id, block_type, data, created_at, updated_at
       FROM documents WHERE block_type = $1
       ORDER BY created_at`,
      [blockType],
    );
    return result.rows.map((row) => this.rowToDocument(row));
  }

  private rowToDocument(row: Record<string, unknown>): Document {
    return {
      id: row.id as string,
      blockType: row.block_type as string,
      data: row.data as Record<string, unknown>,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
