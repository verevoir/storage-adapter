import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAdapter } from "../src/memory.js";

describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  it("creates a document with generated metadata", async () => {
    const doc = await adapter.create("hero", { title: "Hello" });

    expect(doc.id).toBeDefined();
    expect(doc.blockType).toBe("hero");
    expect(doc.data).toEqual({ title: "Hello" });
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it("retrieves a document by id", async () => {
    const created = await adapter.create("hero", { title: "Hello" });
    const fetched = await adapter.get(created.id);

    expect(fetched).toEqual(created);
  });

  it("returns null for a non-existent id", async () => {
    const fetched = await adapter.get("non-existent-id");

    expect(fetched).toBeNull();
  });

  it("updates a document's data", async () => {
    const created = await adapter.create("hero", { title: "Hello" });
    const updated = await adapter.update(created.id, { title: "Updated" });

    expect(updated.id).toBe(created.id);
    expect(updated.blockType).toBe("hero");
    expect(updated.data).toEqual({ title: "Updated" });
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
  });

  it("throws when updating a non-existent document", async () => {
    await expect(
      adapter.update("non-existent", { title: "Nope" }),
    ).rejects.toThrow("Document not found");
  });

  it("deletes a document", async () => {
    const created = await adapter.create("hero", { title: "Hello" });
    await adapter.delete(created.id);

    const fetched = await adapter.get(created.id);
    expect(fetched).toBeNull();
  });

  it("throws when deleting a non-existent document", async () => {
    await expect(adapter.delete("non-existent")).rejects.toThrow(
      "Document not found",
    );
  });

  it("lists documents by block type", async () => {
    await adapter.create("hero", { title: "Hero 1" });
    await adapter.create("hero", { title: "Hero 2" });
    await adapter.create("footer", { text: "Footer" });

    const heroes = await adapter.list("hero");
    const footers = await adapter.list("footer");

    expect(heroes).toHaveLength(2);
    expect(footers).toHaveLength(1);
    expect(heroes.every((d) => d.blockType === "hero")).toBe(true);
  });

  it("returns an empty list for an unknown block type", async () => {
    const results = await adapter.list("unknown");

    expect(results).toEqual([]);
  });

  it("clears all data on disconnect", async () => {
    await adapter.create("hero", { title: "Hello" });
    await adapter.disconnect();

    const results = await adapter.list("hero");
    expect(results).toEqual([]);
  });
});
