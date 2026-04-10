import type {
  FilterOperator,
  FilterValue,
  ListOptions,
  OrderByClause,
  WhereClause,
} from '../types.js';

const SAFE_FIELD_NAME = /^[a-zA-Z0-9_]+$/;

/** Document-level columns that map directly to SQL columns */
const COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  blockType: 'block_type',
  id: 'id',
};

function validateFieldName(field: string): void {
  if (!SAFE_FIELD_NAME.test(field)) {
    throw new Error(`Invalid field name: ${field}`);
  }
}

/** Convert a field name to its SQL column expression */
function toColumnExpr(field: string): string {
  validateFieldName(field);
  if (field in COLUMN_MAP) return COLUMN_MAP[field];
  // Data-level field: extract from JSONB. Use ->> for text extraction.
  return `data->>'${field}'`;
}

function isFilterOperator(value: FilterValue): value is FilterOperator {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    ('$gt' in value ||
      '$gte' in value ||
      '$lt' in value ||
      '$lte' in value ||
      '$ne' in value ||
      '$contains' in value)
  );
}

interface WhereResult {
  clauses: string[];
  params: unknown[];
}

function buildOperatorClauses(
  colExpr: string,
  op: FilterOperator,
  params: unknown[],
  startIdx: number,
): { clauses: string[]; count: number } {
  const clauses: string[] = [];
  let idx = startIdx;

  if (op.$gt !== undefined) {
    clauses.push(`${colExpr} > $${idx++}`);
    params.push(op.$gt);
  }
  if (op.$gte !== undefined) {
    clauses.push(`${colExpr} >= $${idx++}`);
    params.push(op.$gte);
  }
  if (op.$lt !== undefined) {
    clauses.push(`${colExpr} < $${idx++}`);
    params.push(op.$lt);
  }
  if (op.$lte !== undefined) {
    clauses.push(`${colExpr} <= $${idx++}`);
    params.push(op.$lte);
  }
  if (op.$ne !== undefined) {
    clauses.push(`${colExpr} != $${idx++}`);
    params.push(op.$ne);
  }
  if (op.$contains !== undefined) {
    clauses.push(`${colExpr} ILIKE $${idx++}`);
    params.push(`%${op.$contains}%`);
  }

  return { clauses, count: idx - startIdx };
}

/** Build WHERE clause fragments and params from a WhereClause. Param indices start at startIdx. */
export function buildWhereClause(
  where: WhereClause,
  startIdx: number,
): WhereResult {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;

  for (const [field, filter] of Object.entries(where)) {
    const colExpr = toColumnExpr(field);

    if (isFilterOperator(filter)) {
      const result = buildOperatorClauses(colExpr, filter, params, idx);
      clauses.push(...result.clauses);
      idx += result.count;
    } else if (filter === null) {
      clauses.push(`${colExpr} IS NULL`);
    } else {
      clauses.push(`${colExpr} = $${idx++}`);
      params.push(filter instanceof Date ? filter.toISOString() : filter);
    }
  }

  return { clauses, params };
}

/** Build ORDER BY fragment from an OrderByClause */
export function buildOrderByClause(orderBy: OrderByClause): string {
  const parts: string[] = [];
  for (const [field, direction] of Object.entries(orderBy)) {
    const colExpr = toColumnExpr(field);
    parts.push(`${colExpr} ${direction.toUpperCase()}`);
  }
  return parts.join(', ');
}

/** Build the full query extension (WHERE extras, ORDER BY, LIMIT, OFFSET) for a list() call */
export function buildListQuery(
  options: ListOptions | undefined,
  startIdx: number,
): { sql: string; params: unknown[] } {
  if (!options) return { sql: '', params: [] };

  let sql = '';
  const allParams: unknown[] = [];
  let idx = startIdx;

  if (options.where) {
    const { clauses, params } = buildWhereClause(options.where, idx);
    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
      allParams.push(...params);
      idx += params.length;
    }
  }

  if (options.orderBy) {
    sql += ` ORDER BY ${buildOrderByClause(options.orderBy)}`;
  } else {
    sql += ' ORDER BY created_at';
  }

  if (options.limit !== undefined) {
    sql += ` LIMIT $${idx++}`;
    allParams.push(options.limit);
  }

  if (options.offset !== undefined) {
    sql += ` OFFSET $${idx}`;
    allParams.push(options.offset);
  }

  return { sql, params: allParams };
}
