/** A stored content document with metadata */
export interface Document<T = Record<string, unknown>> {
  id: string;
  blockType: string;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}

/** Abstract persistence interface for NextLake content */
export interface StorageAdapter {
  /** Open connection to the backing store */
  connect(): Promise<void>;

  /** Close connection to the backing store */
  disconnect(): Promise<void>;

  /** Run any required schema migrations */
  migrate(): Promise<void>;

  /** Create a new document and return it with generated metadata */
  create(blockType: string, data: Record<string, unknown>): Promise<Document>;

  /** Retrieve a document by ID, or null if not found */
  get(id: string): Promise<Document | null>;

  /** Update a document's data by ID and return the updated document */
  update(id: string, data: Record<string, unknown>): Promise<Document>;

  /** Delete a document by ID */
  delete(id: string): Promise<void>;

  /** List all documents of a given block type */
  list(blockType: string): Promise<Document[]>;
}
