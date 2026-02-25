import type { Pool } from "pg";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type  TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_documents_block_type ON documents (block_type);
`;

/** Create the documents table and indexes if they don't exist */
export async function migrate(pool: Pool): Promise<void> {
  await pool.query(CREATE_TABLE);
  await pool.query(CREATE_INDEX);
}
