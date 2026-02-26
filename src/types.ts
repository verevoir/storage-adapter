/** A stored content document with metadata */
export interface Document<T = Record<string, unknown>> {
  id: string;
  blockType: string;
  data: T;
  createdAt: Date;
  updatedAt: Date;
}

/** Operators for non-exact matching in where clauses */
export interface FilterOperator {
  $gt?: unknown;
  $gte?: unknown;
  $lt?: unknown;
  $lte?: unknown;
  $ne?: unknown;
  /** Case-insensitive substring match */
  $contains?: string;
}

/** A filter value: either an exact match or an operator object */
export type FilterValue =
  | string
  | number
  | boolean
  | Date
  | null
  | FilterOperator;

/** Where clause: field names mapped to filter values */
export type WhereClause = Record<string, FilterValue>;

/** Order-by clause: field names mapped to sort direction */
export type OrderByClause = Record<string, 'asc' | 'desc'>;

/** Options for the list() method */
export interface ListOptions {
  where?: WhereClause;
  orderBy?: OrderByClause;
  limit?: number;
  offset?: number;
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

  /** List documents of a given block type, with optional filtering, sorting, and pagination */
  list(blockType: string, options?: ListOptions): Promise<Document[]>;

  /** Batch-fetch documents by ID. Returns a Map; missing IDs are silently omitted. */
  getMany(ids: string[]): Promise<Map<string, Document>>;
}
