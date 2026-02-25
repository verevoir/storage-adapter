import { randomUUID } from 'node:crypto';
import type { Document, StorageAdapter } from './types.js';

/** In-memory storage adapter for development and testing */
export class MemoryAdapter implements StorageAdapter {
  private store = new Map<string, Document>();

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.store.clear();
  }

  async migrate(): Promise<void> {}

  async create(
    blockType: string,
    data: Record<string, unknown>,
  ): Promise<Document> {
    const now = new Date();
    const doc: Document = {
      id: randomUUID(),
      blockType,
      data,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(doc.id, doc);
    return doc;
  }

  async get(id: string): Promise<Document | null> {
    return this.store.get(id) ?? null;
  }

  async update(id: string, data: Record<string, unknown>): Promise<Document> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }
    const updated: Document = {
      ...existing,
      data,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new Error(`Document not found: ${id}`);
    }
    this.store.delete(id);
  }

  async list(blockType: string): Promise<Document[]> {
    const results: Document[] = [];
    for (const doc of this.store.values()) {
      if (doc.blockType === blockType) {
        results.push(doc);
      }
    }
    return results;
  }
}
