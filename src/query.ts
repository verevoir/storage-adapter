import type {
  Document,
  FilterOperator,
  FilterValue,
  ListOptions,
  WhereClause,
  OrderByClause,
} from './types.js';

/** Document-level fields that resolve to top-level properties instead of data */
const DOC_FIELDS: Record<string, keyof Document> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  blockType: 'blockType',
  id: 'id',
};

function resolveFieldValue(doc: Document, field: string): unknown {
  if (field in DOC_FIELDS) {
    return doc[DOC_FIELDS[field]];
  }
  return (doc.data as Record<string, unknown>)[field];
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

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return 0;
}

function matchesOperator(docValue: unknown, op: FilterOperator): boolean {
  if (op.$gt !== undefined && compare(docValue, op.$gt) <= 0) return false;
  if (op.$gte !== undefined && compare(docValue, op.$gte) < 0) return false;
  if (op.$lt !== undefined && compare(docValue, op.$lt) >= 0) return false;
  if (op.$lte !== undefined && compare(docValue, op.$lte) > 0) return false;
  if (op.$ne !== undefined) {
    if (docValue instanceof Date && op.$ne instanceof Date) {
      if (docValue.getTime() === op.$ne.getTime()) return false;
    } else if (docValue === op.$ne) {
      return false;
    }
  }
  if (op.$contains !== undefined) {
    if (typeof docValue !== 'string') return false;
    if (!docValue.toLowerCase().includes(op.$contains.toLowerCase()))
      return false;
  }
  return true;
}

/** Test whether a document matches all conditions in a where clause */
export function matchesWhere(doc: Document, where: WhereClause): boolean {
  for (const [field, filter] of Object.entries(where)) {
    const docValue = resolveFieldValue(doc, field);

    if (isFilterOperator(filter)) {
      if (!matchesOperator(docValue, filter)) return false;
    } else {
      // Exact match
      if (filter instanceof Date) {
        if (
          !(docValue instanceof Date) ||
          docValue.getTime() !== filter.getTime()
        )
          return false;
      } else if (docValue !== filter) {
        return false;
      }
    }
  }
  return true;
}

/** Sort documents according to an orderBy clause */
export function sortDocuments(
  docs: Document[],
  orderBy: OrderByClause,
): Document[] {
  const entries = Object.entries(orderBy);
  if (entries.length === 0) return docs;

  return [...docs].sort((a, b) => {
    for (const [field, direction] of entries) {
      const aVal = resolveFieldValue(a, field);
      const bVal = resolveFieldValue(b, field);
      const cmp = compare(aVal, bVal);
      if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

/** Apply where, orderBy, limit, and offset to a list of documents */
export function applyListOptions(
  docs: Document[],
  options?: ListOptions,
): Document[] {
  if (!options) return docs;

  let result = docs;

  if (options.where) {
    result = result.filter((doc) => matchesWhere(doc, options.where!));
  }

  if (options.orderBy) {
    result = sortDocuments(result, options.orderBy);
  }

  if (options.offset !== undefined) {
    result = result.slice(options.offset);
  }

  if (options.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result;
}
